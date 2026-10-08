/**
 * Wallet service — the ONE place that reads the reward rules, calculates coin amounts and
 * changes User.walletBalance.
 *
 * Rules (all values come from SystemConfig and are admin-configurable):
 *  - Welcome bonus: `welcomeBonusCoins`, once per user.
 *  - Referral reward: fixed `referralRewardPerOrder` coins to the referrer for EVERY successful
 *    (delivered) order of the referred customer, regardless of order value.
 *  - Order reward: `orderRewardPercentage` % of the product selling value, floored to whole
 *    coins, capped at `orderRewardMaxCap` coins per order.
 *  - Redemption: at most `walletRedemptionPercentage` % of the eligible product value
 *    (selling price x qty; excludes GST, delivery and other charges) per order, and never
 *    more than the spendable balance.
 *  - Order/referral reward coins stay LOCKED during the return window (and while a return
 *    is open) and are clawed back if the order is returned/refunded. Once the window
 *    passes they become spendable automatically.
 *  - Coins are non-returnable: redeemed coins are never restored on cancel/return.
 *
 * Money is calculated in integer paise to avoid floating-point errors, and every balance
 * change is written with a WalletTransaction (unique idempotencyKey per logical event) in
 * the same MongoDB transaction as the claim flag that guards it.
 */
const mongoose = require('mongoose');
const SystemConfig = require('../Models/SystemConfig');
const Order = require('../Models/Order');
const User = require('../Models/User');
const WalletTransaction = require('../Models/WalletTransaction');
const Referral = require('../Models/Referral');
const { isTransientTransactionError, sleep } = require('./transactionRetry');

const DEFAULT_WALLET_CONFIG = Object.freeze({
  walletEnabled: true,
  welcomeBonusEnabled: true,
  welcomeBonusCoins: 1000,
  referralEnabled: true,
  referralRewardPerOrder: 200,
  rewardCoinsEnabled: true,
  orderRewardPercentage: 10,
  orderRewardMaxCap: 400,
  walletRedemptionPercentage: 25,
  returnWindowDays: 2
});

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSIENT_RETRIES = 3;
// Tolerance when comparing stored balances (doubles) against paise-exact amounts
const BALANCE_EPSILON = 0.005;

// ─── Money helpers ──────────────────────────────────────────────────────────

/** Rupees (possibly fractional) -> integer paise. 999.99 -> 99999 (not 99998). */
const toPaise = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

const fromPaise = (paise) => Math.round(paise) / 100;

/** Round any rupee amount to exact 2-decimal money. */
const roundMoney = (value) => fromPaise(toPaise(value));

/** Percentage -> integer basis points (10% -> 1000, 12.5% -> 1250), clamped to 0..100%. */
const toBasisPoints = (percentage) => {
  const n = Number(percentage);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(Math.min(n, 100) * 100);
};

// ─── Config ─────────────────────────────────────────────────────────────────

const pickNumber = (value, fallback, { min = 0, max = Infinity } = {}) => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const normalizeWalletConfig = (raw = {}) => ({
  walletEnabled: raw.walletEnabled !== false,
  welcomeBonusEnabled: raw.welcomeBonusEnabled !== false,
  welcomeBonusCoins: pickNumber(raw.welcomeBonusCoins, DEFAULT_WALLET_CONFIG.welcomeBonusCoins),
  referralEnabled: raw.referralEnabled !== false,
  referralRewardPerOrder: pickNumber(raw.referralRewardPerOrder, DEFAULT_WALLET_CONFIG.referralRewardPerOrder),
  rewardCoinsEnabled: raw.rewardCoinsEnabled !== false,
  orderRewardPercentage: pickNumber(raw.orderRewardPercentage, DEFAULT_WALLET_CONFIG.orderRewardPercentage, { max: 100 }),
  orderRewardMaxCap: pickNumber(raw.orderRewardMaxCap, DEFAULT_WALLET_CONFIG.orderRewardMaxCap),
  walletRedemptionPercentage: pickNumber(raw.walletRedemptionPercentage, DEFAULT_WALLET_CONFIG.walletRedemptionPercentage, { max: 100 }),
  returnWindowDays: pickNumber(raw.returnWindowDays, DEFAULT_WALLET_CONFIG.returnWindowDays)
});

const getWalletConfig = async (sessionOpt = {}) => {
  const raw = await SystemConfig.findOne({}, null, sessionOpt).lean();
  return normalizeWalletConfig(raw || {});
};

// ─── Pure calculations ──────────────────────────────────────────────────────

/**
 * Product selling value of order/cart lines: sum(price x quantity), where `price` is the
 * admin selling price the customer actually pays (never MRP). Excludes GST, delivery,
 * platform fee and COD charges. Returns rupees with exact 2-decimal precision.
 */
const calculateEligibleProductValue = (items = []) => {
  const totalPaise = items.reduce((sum, item) => {
    const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
    return sum + toPaise(item.price) * qty;
  }, 0);
  return fromPaise(totalPaise);
};

/**
 * Customer's own order reward in whole coins:
 * floor(eligibleValue x percentage%) capped at maxCap (0 = no cap).
 * 999.99 @ 10% -> 99; 5000 @ 10% cap 400 -> 400.
 */
const calculateOrderRewardCoins = (eligibleProductValue, { orderRewardPercentage, orderRewardMaxCap } = DEFAULT_WALLET_CONFIG) => {
  const valuePaise = toPaise(eligibleProductValue);
  if (valuePaise <= 0) return 0;
  const bp = toBasisPoints(orderRewardPercentage);
  // valuePaise * bp / 10000 = reward in paise; / 100 more = whole coins. Integer math throughout.
  const coins = Math.floor((valuePaise * bp) / 1000000);
  const cap = Math.floor(Number(orderRewardMaxCap) || 0);
  return cap > 0 ? Math.min(coins, cap) : coins;
};

/**
 * Maximum coins redeemable on one order, in whole coins (no paise):
 * min(available balance, redemption% of eligible product value[, payable total]).
 * The % limit is rounded UP to the next whole coin so the amount left to pay is a whole
 * rupee (limit ₹874.50 on ₹3408 -> 875 coins, ₹2533 payable); the balance and payable
 * total are floored so neither is ever exceeded.
 */
const calculateMaxRedeemable = ({ availableBalance, eligibleProductValue, walletRedemptionPercentage, payableTotal = null }) => {
  const limitPaise = Math.floor((toPaise(eligibleProductValue) * toBasisPoints(walletRedemptionPercentage)) / 10000);
  const candidates = [Math.floor(Number(availableBalance) + 1e-6), Math.ceil(limitPaise / 100)];
  if (payableTotal !== null && payableTotal !== undefined) candidates.push(Math.floor(toPaise(payableTotal) / 100));
  return Math.max(0, Math.min(...candidates));
};

// ─── Transaction runner ─────────────────────────────────────────────────────

let transactionsSupported = null; // null = unknown until the first attempt

const isTransactionUnsupportedError = (err) =>
  !!err && (err.code === 20 || /Transaction numbers are only allowed|replica set/i.test(err.message || ''));

const isDuplicateKeyError = (err) => !!err && (err.code === 11000 || /E11000/.test(err.message || ''));

const runUndo = async (undo, label) => {
  for (const step of [...undo].reverse()) {
    try {
      await step();
    } catch (undoErr) {
      console.error(`CRITICAL: wallet compensation step failed (${label}). Manual reconciliation required.`, undoErr);
    }
  }
};

/**
 * Runs `work(ctx)` atomically. ctx = { sessionOpt, session, undo }.
 * Uses a MongoDB transaction when the deployment supports it (retrying transient write
 * conflicts); on standalone MongoDB it runs without one and replays the registered `undo`
 * steps in reverse if anything fails, so a failed operation never leaves partial state.
 */
const runWalletTransaction = async (work, label = 'wallet operation') => {
  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    const useTx = transactionsSupported !== false;
    const session = useTx ? await mongoose.startSession() : null;
    const ctx = { sessionOpt: useTx ? { session } : {}, session, undo: [] };
    try {
      if (useTx) session.startTransaction();
      const result = await work(ctx);
      if (useTx) await session.commitTransaction();
      if (useTx) transactionsSupported = true;
      return result;
    } catch (err) {
      if (useTx) {
        try { await session.abortTransaction(); } catch (_) { /* ignore */ }
        if (isTransactionUnsupportedError(err) && transactionsSupported !== true) {
          console.warn('MongoDB transactions not supported by deployment. Wallet operations will use manual compensation.');
          transactionsSupported = false;
          attempt--; // retry immediately without a transaction; doesn't count as a transient retry
          continue;
        }
        if (isTransientTransactionError(err) && attempt < MAX_TRANSIENT_RETRIES) {
          await sleep(20 * attempt);
          continue;
        }
      } else {
        await runUndo(ctx.undo, label);
      }
      throw err;
    } finally {
      if (session) session.endSession();
    }
  }
};

/** Use the caller's ctx when nested inside a larger transaction, otherwise open our own. */
const withCtx = (ctx, work, label) => (ctx ? work(ctx) : runWalletTransaction(work, label));

// ─── Ledger primitives (the only code that writes walletBalance) ────────────

const orderLabel = (orderId) => {
  const s = String(orderId);
  return s.substring(s.length - 6).toUpperCase();
};

const writeLedger = async (entry, ctx) => {
  // Ledger first: a duplicate idempotencyKey throws here, before any balance is touched.
  const [txn] = await WalletTransaction.create([entry], ctx.sessionOpt);
  ctx.undo.push(() => WalletTransaction.deleteOne({ _id: txn._id }));
  return txn;
};

// MAIN = coins wallet (walletBalance); REFUND = Refund Wallet money (refundWalletBalance)
const WALLET_FIELDS = { MAIN: 'walletBalance', REFUND: 'refundWalletBalance' };
const walletField = (wallet = 'MAIN') => {
  const field = WALLET_FIELDS[wallet];
  if (!field) throw new Error(`Unknown wallet "${wallet}"`);
  return field;
};

/** Credit `amount` (> 0) to the MAIN (coins) or REFUND (money) wallet and record it. */
const creditWallet = async ({ userId, amount, wallet = 'MAIN', type, source, description, orderId, referredUserId, unlocksAt, idempotencyKey }, ctx) => {
  const value = roundMoney(amount);
  if (value <= 0) throw new Error('Credit amount must be positive');
  const field = walletField(wallet);

  const txn = await writeLedger({ userId, wallet, amount: value, type, source, description, orderId, referredUserId, unlocksAt, idempotencyKey }, ctx);

  const user = await User.findOneAndUpdate(
    { _id: userId },
    [{ $set: { [field]: { $round: [{ $add: [{ $ifNull: [`$${field}`, 0] }, value] }, 2] } } }],
    { ...ctx.sessionOpt, returnDocument: 'after', updatePipeline: true }
  );
  if (!user) throw new Error(`User ${userId} not found for wallet credit`);
  ctx.undo.push(() => User.updateOne({ _id: userId }, [{ $set: { [field]: { $round: [{ $subtract: [`$${field}`, value] }, 2] } } }], { updatePipeline: true }));

  await WalletTransaction.updateOne({ _id: txn._id }, { $set: { balanceAfter: user[field] } }, ctx.sessionOpt);
  return { amount: value, balanceAfter: user[field], transactionId: txn._id };
};

/**
 * Debit exactly `amount` if the balance covers it plus `reserve` (locked coins that must
 * stay untouched). Returns null — without writing anything — when funds are insufficient,
 * so the balance can never go negative or dip into locked coins.
 */
const debitWallet = async ({ userId, amount, wallet = 'MAIN', reserve = 0, type, source, description, orderId, idempotencyKey }, ctx) => {
  const value = roundMoney(amount);
  if (value <= 0) throw new Error('Debit amount must be positive');
  const field = walletField(wallet);

  const user = await User.findOneAndUpdate(
    { _id: userId, [field]: { $gte: roundMoney(value + reserve) - BALANCE_EPSILON } },
    [{ $set: { [field]: { $max: [0, { $round: [{ $subtract: [`$${field}`, value] }, 2] }] } } }],
    { ...ctx.sessionOpt, returnDocument: 'after', updatePipeline: true }
  );
  if (!user) return null;
  ctx.undo.push(() => User.updateOne({ _id: userId }, [{ $set: { [field]: { $round: [{ $add: [`$${field}`, value] }, 2] } } }], { updatePipeline: true }));

  const txn = await writeLedger({ userId, wallet, amount: -value, type, source, description, orderId, idempotencyKey }, ctx);
  await WalletTransaction.updateOne({ _id: txn._id }, { $set: { balanceAfter: user[field] } }, ctx.sessionOpt);
  return { amount: value, balanceAfter: user[field], transactionId: txn._id };
};

/**
 * Debit up to `amount`, stopping at zero (used for reward clawbacks, which must never make
 * the balance negative). Returns the amount actually deducted.
 */
const debitWalletClamped = async ({ userId, amount, type, source, description, orderId, idempotencyKey }, ctx) => {
  const value = roundMoney(amount);
  if (value <= 0) return { amount: 0 };

  const before = await User.findOneAndUpdate(
    { _id: userId },
    [{ $set: { walletBalance: { $max: [0, { $round: [{ $subtract: [{ $ifNull: ['$walletBalance', 0] }, value] }, 2] }] } } }],
    { ...ctx.sessionOpt, returnDocument: 'before', updatePipeline: true }
  );
  if (!before) return { amount: 0 };
  const deducted = Math.min(value, roundMoney(Math.max(0, before.walletBalance || 0)));
  const balanceAfter = roundMoney(Math.max(0, (before.walletBalance || 0) - value));
  ctx.undo.push(() => User.updateOne({ _id: userId }, { $set: { walletBalance: before.walletBalance } }));

  if (deducted > 0) {
    const shortfall = roundMoney(value - deducted);
    const txn = await writeLedger({
      userId, amount: -deducted, type, source, orderId, idempotencyKey,
      description: shortfall > 0 ? `${description} (₹${shortfall} could not be recovered — balance was insufficient)` : description
    }, ctx);
    await WalletTransaction.updateOne({ _id: txn._id }, { $set: { balanceAfter } }, ctx.sessionOpt);
  }
  return { amount: deducted, balanceAfter };
};

// ─── Locked / available balance ─────────────────────────────────────────────

const lockExpiry = (creditedAt, config) => new Date(new Date(creditedAt).getTime() + config.returnWindowDays * DAY_MS);

/** A credited reward stays locked while its order's return window is open or a return is pending. */
const isRewardLocked = (order, creditedAt, config, now = new Date()) =>
  order.status === 'Return Requested' || (!!creditedAt && now < lockExpiry(creditedAt, config));

const getLockedBalance = async (userId, { config, sessionOpt = {} } = {}) => {
  const cfg = config || await getWalletConfig(sessionOpt);
  const now = new Date();
  const cutoff = new Date(now.getTime() - cfg.returnWindowDays * DAY_MS);

  const [ownRewards, referralRewards] = await Promise.all([
    Order.find({
      userId,
      rewardCredited: true,
      rewardDeducted: { $ne: true },
      $or: [{ rewardCreditedAt: { $gt: cutoff } }, { status: 'Return Requested' }]
    }, 'status rewardCreditedAt rewardCoinsAmount', sessionOpt).lean(),
    Order.find({
      referrerId: userId,
      referralRewardCredited: true,
      referralRewardReversed: { $ne: true },
      $or: [{ referralRewardCreditedAt: { $gt: cutoff } }, { status: 'Return Requested' }]
    }, 'status referralRewardCreditedAt referralRewardAmount', sessionOpt).lean()
  ]);

  let lockedPaise = 0;
  for (const o of ownRewards) {
    if (isRewardLocked(o, o.rewardCreditedAt, cfg, now)) lockedPaise += toPaise(o.rewardCoinsAmount);
  }
  for (const o of referralRewards) {
    if (isRewardLocked(o, o.referralRewardCreditedAt, cfg, now)) lockedPaise += toPaise(o.referralRewardAmount);
  }
  return fromPaise(lockedPaise);
};

/** { walletBalance, lockedBalance, availableBalance } — the numbers every screen should show. */
const getWalletSummary = async (userId, { config, sessionOpt = {} } = {}) => {
  const cfg = config || await getWalletConfig(sessionOpt);
  const user = await User.findById(userId, 'walletBalance', sessionOpt).lean();
  const walletBalance = roundMoney(Math.max(0, (user && user.walletBalance) || 0));
  const lockedBalance = Math.min(walletBalance, await getLockedBalance(userId, { config: cfg, sessionOpt }));
  return { walletBalance, lockedBalance, availableBalance: roundMoney(walletBalance - lockedBalance) };
};

// ─── Welcome bonus ──────────────────────────────────────────────────────────

const creditWelcomeBonus = async (userId) => {
  const config = await getWalletConfig();
  const amount = config.welcomeBonusEnabled ? Math.floor(config.welcomeBonusCoins) : 0;

  try {
    return await runWalletTransaction(async (ctx) => {
      // One-time claim; when the bonus is disabled we still mark it so it isn't granted later.
      const claimed = await User.findOneAndUpdate(
        { _id: userId, welcomeBonusGiven: { $ne: true } },
        { $set: { welcomeBonusGiven: true, welcomeBonusDate: new Date() } },
        ctx.sessionOpt
      );
      if (!claimed) return { success: false, reason: 'Welcome bonus already processed' };
      ctx.undo.push(() => User.updateOne({ _id: userId }, { $set: { welcomeBonusGiven: false, welcomeBonusDate: null } }));
      if (amount <= 0) return { success: false, reason: 'Welcome bonus disabled' };

      await creditWallet({
        userId, amount, type: 'Welcome Bonus', source: 'WELCOME_BONUS',
        description: `Welcome Bonus of ${amount} coins credited`,
        idempotencyKey: `WELCOME_BONUS:${userId}`
      }, ctx);
      return { success: true, amount };
    }, `welcome bonus ${userId}`);
  } catch (err) {
    if (isDuplicateKeyError(err)) return { success: false, reason: 'Welcome bonus already credited' };
    throw err;
  }
};

// ─── Order reward (customer's own purchase) ─────────────────────────────────

/** Reward coins an order earns: the checkout snapshot, or (legacy orders) computed from its items. */
const getOrderRewardCoins = (order, config) => {
  if (order.rewardCoinsExpected !== null && order.rewardCoinsExpected !== undefined) {
    return Math.max(0, Math.floor(order.rewardCoinsExpected));
  }
  const eligible = order.eligibleProductValue !== null && order.eligibleProductValue !== undefined
    ? order.eligibleProductValue
    : calculateEligibleProductValue(order.items);
  return calculateOrderRewardCoins(eligible, config);
};

const creditOrderReward = async (orderId, { ctx } = {}) => {
  const config = await getWalletConfig();
  if (!config.walletEnabled || !config.rewardCoinsEnabled) {
    return { success: false, reason: 'Reward coins feature disabled in admin settings' };
  }

  // Legacy safety net: a ledger entry without the flag means an earlier run credited it.
  const legacyTxn = await WalletTransaction.findOne({ orderId, type: 'ORDER_REWARD' }).lean();
  if (legacyTxn) {
    await Order.updateOne(
      { _id: orderId, rewardCredited: { $ne: true } },
      { $set: { rewardCredited: true, rewardCreditedAt: legacyTxn.createdAt, rewardCoinsAmount: legacyTxn.amount } }
    );
    return { success: false, reason: 'Reward already credited for this order' };
  }

  try {
    return await withCtx(ctx, async (c) => {
      const order = await Order.findOne({ _id: orderId }, null, c.sessionOpt).lean();
      if (!order) return { success: false, reason: 'Order not found' };
      if (order.status !== 'Delivered') return { success: false, reason: 'Order is not Delivered' };
      if (order.rewardCredited) return { success: false, reason: 'Reward already credited for this order' };

      const amount = getOrderRewardCoins(order, config);
      if (amount <= 0) return { success: false, reason: 'Reward amount is 0' };

      const now = new Date();
      // Atomic claim — duplicate webhooks / webhook + manual status racing can't both win.
      const claimed = await Order.findOneAndUpdate(
        { _id: orderId, status: 'Delivered', rewardCredited: { $ne: true } },
        { $set: { rewardCredited: true, rewardCreditedAt: now, rewardCoinsAmount: amount } },
        c.sessionOpt
      );
      if (!claimed) return { success: false, reason: 'Reward already credited for this order' };
      c.undo.push(() => Order.updateOne({ _id: orderId }, { $set: { rewardCredited: false, rewardCreditedAt: null, rewardCoinsAmount: 0 } }));

      await creditWallet({
        userId: order.userId, amount, type: 'ORDER_REWARD', source: 'ORDER_REWARD', orderId,
        unlocksAt: lockExpiry(now, config),
        description: `${amount} reward coins for Order #${orderLabel(orderId)} (unlock after the return window)`,
        idempotencyKey: `ORDER_REWARD:${orderId}`
      }, c);

      console.log(`🎉 Credited ${amount} locked order reward coins to user ${order.userId} for Order #${orderLabel(orderId)}`);
      return { success: true, rewardAmount: amount };
    }, `order reward ${orderId}`);
  } catch (err) {
    if (isDuplicateKeyError(err)) return { success: false, reason: 'Reward already credited for this order' };
    throw err;
  }
};

// ─── Referral reward (referrer, per successful order of the referee) ────────

const notifyReferrer = async (referrerId, refereeName, amount) => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const Notification = require('../Models/Notification');
    const { sendNotificationToUser } = require('../Router/firebaseAdmin');
    const notif = await Notification.create({
      title: 'Referral Reward Earned! 🎉',
      body: `Your friend ${refereeName} completed an order. ${amount} coins were added to your wallet (usable after the return window).`,
      target: 'Selected Users',
      targetUserIds: [referrerId],
      status: 'Delivered'
    });
    await sendNotificationToUser(referrerId, { title: notif.title, body: notif.body });
  } catch (err) {
    console.error('Error sending referral reward notification:', err.message);
  }
};

const creditReferralReward = async (orderId, { ctx } = {}) => {
  const config = await getWalletConfig();
  if (!config.walletEnabled || !config.referralEnabled) {
    return { success: false, reason: 'Referral program disabled in admin settings' };
  }
  const amount = Math.floor(config.referralRewardPerOrder);
  if (amount <= 0) return { success: false, reason: 'Referral reward amount is 0' };

  const order = await Order.findById(orderId, 'userId status referralRewardCredited').lean();
  if (!order) return { success: false, reason: 'Order not found' };
  if (order.status !== 'Delivered') return { success: false, reason: 'Order is not Delivered' };
  if (order.referralRewardCredited) return { success: false, reason: 'Referral reward already credited for this order' };

  const referee = await User.findById(order.userId, 'referredBy name phone').lean();
  if (!referee || !referee.referredBy) return { success: false, reason: 'Customer was not referred' };
  const referrerId = referee.referredBy;
  if (String(referrerId) === String(order.userId)) return { success: false, reason: 'Self referral' };
  if (!(await User.exists({ _id: referrerId }))) return { success: false, reason: 'Referrer not found' };

  let result;
  try {
    result = await withCtx(ctx, async (c) => {
      const now = new Date();
      const claimed = await Order.findOneAndUpdate(
        { _id: orderId, status: 'Delivered', referralRewardCredited: { $ne: true } },
        { $set: { referralRewardCredited: true, referralRewardCreditedAt: now, referralRewardAmount: amount, referrerId } },
        c.sessionOpt
      );
      if (!claimed) return { success: false, reason: 'Referral reward already credited for this order' };
      c.undo.push(() => Order.updateOne({ _id: orderId }, { $set: { referralRewardCredited: false, referralRewardCreditedAt: null, referralRewardAmount: 0, referrerId: null } }));

      await creditWallet({
        userId: referrerId, amount, type: 'REFERRAL_REWARD', source: 'REFERRAL_REWARD', orderId,
        referredUserId: order.userId,
        unlocksAt: lockExpiry(now, config),
        description: `Referral reward: ${referee.name || 'your friend'} completed Order #${orderLabel(orderId)}`,
        idempotencyKey: `REFERRAL_REWARD:${orderId}`
      }, c);

      const referral = await Referral.findOneAndUpdate(
        { referee: order.userId, referrer: referrerId },
        { $inc: { referrerCoinsAwarded: amount, successfulOrders: 1 }, $set: { status: 'rewarded', completedAt: now } },
        c.sessionOpt
      );
      if (referral) {
        c.undo.push(() => Referral.updateOne({ _id: referral._id }, {
          $inc: { referrerCoinsAwarded: -amount, successfulOrders: -1 },
          $set: { status: referral.status, completedAt: referral.completedAt }
        }));
      }

      console.log(`🎁 Credited ${amount} referral coins to referrer ${referrerId} for Order #${orderLabel(orderId)}`);
      return { success: true, rewardAmount: amount, referrerId };
    }, `referral reward ${orderId}`);
  } catch (err) {
    if (isDuplicateKeyError(err)) return { success: false, reason: 'Referral reward already credited for this order' };
    throw err;
  }

  if (result.success && !ctx) await notifyReferrer(referrerId, referee.name || referee.phone || 'A friend', amount);
  return result;
};

/**
 * Called whenever an order reaches 'Delivered' — from the admin status update AND from the
 * Shiprocket webhook / manual sync — so both fulfilment paths earn the same coins. Safe to
 * call any number of times.
 */
const processDeliveredOrderRewards = async (orderId) => {
  const results = {};
  for (const [key, fn] of [['orderReward', creditOrderReward], ['referralReward', creditReferralReward]]) {
    try {
      results[key] = await fn(orderId);
    } catch (err) {
      console.error(`Error crediting ${key} for order ${orderId}:`, err);
      results[key] = { success: false, error: err.message };
    }
  }
  return results;
};

// ─── Reversal on return / refund / post-delivery cancellation ───────────────

/**
 * Claws back the order reward and the referral reward credited for this order (each at most
 * once). Normally the coins are still locked so the balance always covers them; if not, the
 * deduction stops at zero rather than making the wallet negative.
 */
const reverseOrderRewards = async (orderId, { ctx } = {}) => withCtx(ctx, async (c) => {
  const now = new Date();
  const result = { orderReward: 0, referralReward: 0 };

  const own = await Order.findOneAndUpdate(
    { _id: orderId, rewardCredited: true, rewardDeducted: { $ne: true } },
    { $set: { rewardDeducted: true, rewardDeductedAt: now } },
    { ...c.sessionOpt, returnDocument: 'before' }
  );
  if (own) {
    c.undo.push(() => Order.updateOne({ _id: orderId }, { $set: { rewardDeducted: false, rewardDeductedAt: null } }));
    const r = await debitWalletClamped({
      userId: own.userId, amount: own.rewardCoinsAmount, type: 'ORDER_REWARD_REDUCE', source: 'ORDER_REWARD', orderId,
      description: `Reward coins for Order #${orderLabel(orderId)} withdrawn (order returned/refunded)`,
      idempotencyKey: `ORDER_REWARD_REVERSAL:${orderId}`
    }, c);
    result.orderReward = r.amount;
  }

  const ref = await Order.findOneAndUpdate(
    { _id: orderId, referralRewardCredited: true, referralRewardReversed: { $ne: true } },
    { $set: { referralRewardReversed: true, referralRewardReversedAt: now } },
    { ...c.sessionOpt, returnDocument: 'before' }
  );
  if (ref && ref.referrerId) {
    c.undo.push(() => Order.updateOne({ _id: orderId }, { $set: { referralRewardReversed: false, referralRewardReversedAt: null } }));
    const r = await debitWalletClamped({
      userId: ref.referrerId, amount: ref.referralRewardAmount, type: 'REFERRAL_REWARD_REVERSAL', source: 'REFERRAL_REWARD', orderId,
      description: `Referral reward for Order #${orderLabel(orderId)} withdrawn (order returned/refunded)`,
      idempotencyKey: `REFERRAL_REWARD_REVERSAL:${orderId}`
    }, c);
    result.referralReward = r.amount;

    const referral = await Referral.findOneAndUpdate(
      { referee: ref.userId, referrer: ref.referrerId },
      { $inc: { referrerCoinsAwarded: -ref.referralRewardAmount, successfulOrders: -1 } },
      c.sessionOpt
    );
    if (referral) {
      c.undo.push(() => Referral.updateOne({ _id: referral._id }, { $inc: { referrerCoinsAwarded: ref.referralRewardAmount, successfulOrders: 1 } }));
    }
  }

  return result;
}, `reward reversal ${orderId}`);

// ─── Checkout redemption ────────────────────────────────────────────────────

/**
 * Deducts the allowed wallet amount for a new order and returns { amount, limit }.
 * Must run inside the order-creation ctx so it commits/rolls back with the order.
 */
const redeemForOrder = async ({ userId, orderId, eligibleProductValue, payableTotal }, ctx) => {
  const config = await getWalletConfig(ctx.sessionOpt);
  if (!config.walletEnabled) return { amount: 0, limit: 0 };

  const summary = await getWalletSummary(userId, { config, sessionOpt: ctx.sessionOpt });
  const limit = calculateMaxRedeemable({ availableBalance: Infinity, eligibleProductValue, walletRedemptionPercentage: config.walletRedemptionPercentage });
  const amount = calculateMaxRedeemable({
    availableBalance: summary.availableBalance,
    eligibleProductValue,
    walletRedemptionPercentage: config.walletRedemptionPercentage,
    payableTotal
  });
  if (amount <= 0) return { amount: 0, limit };

  const debit = await debitWallet({
    userId, amount, reserve: summary.lockedBalance, type: 'ORDER_REDEMPTION', source: 'ORDER_REDEMPTION', orderId,
    description: `Used for Order #${orderLabel(orderId)} (max ${config.walletRedemptionPercentage}% of ₹${roundMoney(eligibleProductValue)} product value)`,
    idempotencyKey: `ORDER_REDEMPTION:${orderId}`
  }, ctx);
  if (!debit) throw Object.assign(new Error('Your wallet balance changed while placing the order. Please try again.'), { status: 409 });
  return { amount, limit };
};

/** What the checkout screen shows. `payableTotal` is optional (clamps to the order total). */
const getRedemptionPreview = async (userId, { eligibleProductValue, payableTotal = null }) => {
  const config = await getWalletConfig();
  const summary = await getWalletSummary(userId, { config });
  const maxRedeemable = config.walletEnabled
    ? calculateMaxRedeemable({ availableBalance: summary.availableBalance, eligibleProductValue, walletRedemptionPercentage: config.walletRedemptionPercentage, payableTotal })
    : 0;
  // Refund Wallet: 100% usable, limited only by what is still payable after the coins
  const refundWalletBalance = await getRefundWalletBalance(userId);
  const maxRefundWalletUsable = payableTotal === null || payableTotal === undefined
    ? refundWalletBalance
    : fromPaise(Math.max(0, Math.min(toPaise(refundWalletBalance), toPaise(payableTotal) - toPaise(maxRedeemable))));
  return {
    ...summary,
    refundWalletBalance,
    maxRefundWalletUsable,
    walletEnabled: config.walletEnabled,
    eligibleProductValue: roundMoney(eligibleProductValue),
    walletRedemptionPercentage: config.walletRedemptionPercentage,
    maxRedeemable,
    rewardCoinsEnabled: config.walletEnabled && config.rewardCoinsEnabled,
    orderRewardPercentage: config.orderRewardPercentage,
    orderRewardMaxCap: config.orderRewardMaxCap,
    estimatedRewardCoins: config.walletEnabled && config.rewardCoinsEnabled ? calculateOrderRewardCoins(eligibleProductValue, config) : 0
  };
};

// ─── Refund Wallet (actual money — separate from coins) ─────────────────────
//
// No redemption % limit, no locking. Money used from it on an order is credited back to it
// (up to what was used, tracked per order) when that order is cancelled/returned.

const getRefundWalletBalance = async (userId, sessionOpt = {}) => {
  const user = await User.findById(userId, 'refundWalletBalance', sessionOpt).lean();
  return roundMoney(Math.max(0, (user && user.refundWalletBalance) || 0));
};

/**
 * Uses Refund Wallet money on a new order: up to 100% of the balance, capped only by the
 * amount still payable. Must run inside the order-creation ctx. Returns { amount }.
 */
const useRefundWalletForOrder = async ({ userId, orderId, payableTotal }, ctx) => {
  const balance = await getRefundWalletBalance(userId, ctx.sessionOpt);
  const amount = fromPaise(Math.max(0, Math.min(toPaise(balance), toPaise(payableTotal))));
  if (amount <= 0) return { amount: 0 };

  const debit = await debitWallet({
    userId, amount, wallet: 'REFUND', type: 'REFUND_WALLET_DEBIT', source: 'REFUND', orderId,
    description: `Refund Wallet used for Order #${orderLabel(orderId)}`,
    idempotencyKey: `REFUND_WALLET_DEBIT:${orderId}`
  }, ctx);
  if (!debit) throw Object.assign(new Error('Your Refund Wallet balance changed while placing the order. Please try again.'), { status: 409 });
  return { amount };
};

/** Credits an actual refund (Wallet refund method, Razorpay failure, ...) to the Refund Wallet. */
const creditRefundWallet = async ({ userId, amount, orderId, type = 'REFUND_WALLET_CREDIT', description, idempotencyKey }, { ctx } = {}) => {
  const work = (c) => creditWallet({ userId, amount, wallet: 'REFUND', type, source: 'REFUND', orderId, description, idempotencyKey }, c);
  try {
    return await withCtx(ctx, work, `refund wallet credit ${userId}`);
  } catch (err) {
    if (!ctx && isDuplicateKeyError(err)) return null; // already credited for this idempotencyKey
    throw err;
  }
};

/**
 * Credits Refund Wallet money used on `orderId` back to the Refund Wallet — at most
 * `maxAmount` (the eligible refund; omit for everything not yet restored), and never more in
 * total than was originally used on the order. Returns the amount credited back.
 */
const restoreRefundWalletForOrder = async (orderId, { maxAmount = null, partial = false, idempotencyKey, ctx } = {}) => withCtx(ctx, async (c) => {
  if (idempotencyKey) {
    // Retried call for the same cancellation/return: report what was already credited back.
    const existing = await WalletTransaction.findOne({ idempotencyKey }, 'amount', c.sessionOpt).lean();
    if (existing) return existing.amount;
  }
  const order = await Order.findById(orderId, 'userId refundWalletUsed refundWalletRestored', c.sessionOpt).lean();
  if (!order) return 0;
  const remainingPaise = toPaise(order.refundWalletUsed) - toPaise(order.refundWalletRestored);
  const capPaise = maxAmount === null || maxAmount === undefined ? remainingPaise : Math.min(remainingPaise, toPaise(maxAmount));
  const amount = fromPaise(Math.max(0, capPaise));
  if (amount <= 0) return 0;

  // Conditional increment: concurrent restores can never push the total past what was used.
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, $expr: { $lte: [{ $add: [{ $ifNull: ['$refundWalletRestored', 0] }, amount] }, { $add: ['$refundWalletUsed', BALANCE_EPSILON] }] } },
    [{ $set: { refundWalletRestored: { $round: [{ $add: [{ $ifNull: ['$refundWalletRestored', 0] }, amount] }, 2] } } }],
    { ...c.sessionOpt, updatePipeline: true }
  );
  if (!claimed) return 0;
  c.undo.push(() => Order.updateOne({ _id: orderId }, [{ $set: { refundWalletRestored: { $round: [{ $subtract: ['$refundWalletRestored', amount] }, 2] } } }], { updatePipeline: true }));

  await creditWallet({
    userId: order.userId, amount, wallet: 'REFUND', source: 'REFUND', orderId,
    type: partial ? 'REFUND_WALLET_PARTIAL_REFUND' : 'REFUND_WALLET_RESTORE',
    description: partial
      ? `Partial refund of Refund Wallet money used on Order #${orderLabel(orderId)}`
      : `Refund Wallet money credited back for cancelled/returned Order #${orderLabel(orderId)}`,
    idempotencyKey
  }, c);
  return amount;
}, `refund wallet restore ${orderId}`);

// ─── Other credits ──────────────────────────────────────────────────────────

/** Generic credit for non-reward sources (store-credit refunds). */
const creditWalletStandalone = async (params) => {
  try {
    return await runWalletTransaction((ctx) => creditWallet(params, ctx), `${params.type} credit ${params.userId}`);
  } catch (err) {
    if (isDuplicateKeyError(err)) return null; // already credited for this idempotencyKey
    throw err;
  }
};

// ─── History helpers ────────────────────────────────────────────────────────

const DEBIT_TYPES = new Set(['ORDER_REDEMPTION', 'Payment', 'ORDER_REWARD_REDUCE', 'REFERRAL_REWARD_REVERSAL', 'REFUND_WALLET_DEBIT']);
const SOURCE_BY_TYPE = {
  'Welcome Bonus': 'WELCOME_BONUS',
  ORDER_REWARD: 'ORDER_REWARD',
  ORDER_REWARD_REDUCE: 'ORDER_REWARD',
  REFERRAL_REWARD: 'REFERRAL_REWARD',
  REFERRAL_REWARD_REVERSAL: 'REFERRAL_REWARD',
  ORDER_REDEMPTION: 'ORDER_REDEMPTION',
  REFUND_WALLET_CREDIT: 'REFUND',
  REFUND_WALLET_DEBIT: 'REFUND',
  REFUND_WALLET_RESTORE: 'REFUND',
  REFUND_WALLET_PARTIAL_REFUND: 'REFUND'
};

const getTransactionDirection = (txn) => (txn.amount < 0 || DEBIT_TYPES.has(txn.type) ? 'debit' : 'credit');
const getTransactionSource = (txn) => txn.source || SOURCE_BY_TYPE[txn.type] || 'REFUND';

// ─── One-time migration to the single combined wallet ───────────────────────

/**
 * Moves any legacy separate `referralCoins` balance into walletBalance (with a ledger entry)
 * and drops the old welcome-bonus sub-balance. Idempotent: safe to run on every startup.
 */
const migrateLegacyWalletBalances = async () => {
  const users = User.collection;
  const pending = await users.find({ referralCoins: { $gt: 0 } }, { projection: { _id: 1 } }).toArray();
  let merged = 0;

  for (const { _id } of pending) {
    try {
      await runWalletTransaction(async (ctx) => {
        const opts = ctx.session ? { session: ctx.session } : {};
        const before = await users.findOneAndUpdate({ _id, referralCoins: { $gt: 0 } }, { $set: { referralCoins: 0 } }, opts);
        if (!before) return;
        ctx.undo.push(() => users.updateOne({ _id }, { $set: { referralCoins: before.referralCoins } }));
        const amount = roundMoney(before.referralCoins);
        if (amount > 0) {
          await creditWallet({
            userId: _id, amount, type: 'LEGACY_BALANCE_MERGE', source: 'REFERRAL_REWARD',
            description: 'Referral coins balance merged into your wallet'
          }, ctx);
          merged++;
        }
      }, `legacy wallet merge ${_id}`);
    } catch (err) {
      console.error(`Failed to merge legacy referral coins for user ${_id}:`, err.message);
    }
  }

  await users.updateMany({ referralCoins: { $lte: 0 } }, { $unset: { referralCoins: '' } });
  await users.updateMany({ welcomeBonusRemaining: { $exists: true } }, { $unset: { welcomeBonusRemaining: '' } });
  if (merged > 0) console.log(`💰 Merged legacy referral coins into the combined wallet for ${merged} user(s).`);
  return { merged };
};

module.exports = {
  DEFAULT_WALLET_CONFIG,
  toPaise,
  fromPaise,
  roundMoney,
  normalizeWalletConfig,
  getWalletConfig,
  calculateEligibleProductValue,
  calculateOrderRewardCoins,
  calculateMaxRedeemable,
  runWalletTransaction,
  getLockedBalance,
  getWalletSummary,
  isRewardLocked,
  creditWelcomeBonus,
  creditOrderReward,
  creditReferralReward,
  processDeliveredOrderRewards,
  reverseOrderRewards,
  redeemForOrder,
  getRedemptionPreview,
  getRefundWalletBalance,
  useRefundWalletForOrder,
  creditRefundWallet,
  restoreRefundWalletForOrder,
  creditWalletStandalone,
  getTransactionDirection,
  getTransactionSource,
  migrateLegacyWalletBalances
};
