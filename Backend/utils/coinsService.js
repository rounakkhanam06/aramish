/**
 * Coins & Rewards reporting for the admin panel (read-only).
 *
 * Coins live in ONE wallet per customer (User.walletBalance), so redemptions can't be
 * attributed to a particular source. What this reports, all from the WalletTransaction
 * ledger and the orders:
 *  - how many coins each source issued (welcome bonus, purchase rewards, referral rewards,
 *    other credits), how many were clawed back, and how many were redeemed on orders;
 *  - per purchase: the reward the order earns and where it stands (pending delivery, locked
 *    in the return window, released, clawed back), the referrer's reward, and coins used;
 *  - per customer: received by source, clawed back, used, current balance and locked part;
 *  - the raw coin ledger, and reconciliation of balances against it.
 */
const Order = require('../Models/Order');
const User = require('../Models/User');
const WalletTransaction = require('../Models/WalletTransaction');
const walletService = require('./walletService');

const { roundMoney } = walletService;
const DAY_MS = 24 * 60 * 60 * 1000;
const EPSILON = 0.01;

// Coin (MAIN) wallet entries only — Refund Wallet money is reported under Earnings.
const COIN_LEDGER_MATCH = { wallet: { $ne: 'REFUND' }, type: { $not: /^REFUND_WALLET/ } };

const BUCKETS = ['welcome', 'purchaseReward', 'purchaseRewardClawback', 'referralReward', 'referralRewardClawback', 'redeemed', 'otherCredit', 'otherDebit'];
const BUCKET_LABELS = {
  welcome: 'Welcome Bonus',
  purchaseReward: 'Purchase Reward',
  purchaseRewardClawback: 'Purchase Reward Clawed Back',
  referralReward: 'Referral Reward',
  referralRewardClawback: 'Referral Reward Clawed Back',
  redeemed: 'Used on Order',
  otherCredit: 'Other Credit',
  otherDebit: 'Other Debit'
};
const CREDIT_BUCKETS = new Set(['welcome', 'purchaseReward', 'referralReward', 'otherCredit']);

/** Ledger entry -> bucket (same rules in JS and in the aggregation below). */
const bucketOf = (txn) => {
  switch (txn.type) {
    case 'Welcome Bonus': return 'welcome';
    case 'ORDER_REWARD': return 'purchaseReward';
    case 'ORDER_REWARD_REDUCE': return 'purchaseRewardClawback';
    case 'REFERRAL_REWARD':
    case 'LEGACY_BALANCE_MERGE': return 'referralReward';
    case 'REFERRAL_REWARD_REVERSAL': return 'referralRewardClawback';
    // Legacy 'Redemption' entries are positive credits (walletService treats them as such),
    // so they fall through to the direction-based buckets below.
    case 'ORDER_REDEMPTION':
    case 'Payment': return 'redeemed';
    default: return walletService.getTransactionDirection(txn) === 'debit' ? 'otherDebit' : 'otherCredit';
  }
};

const bucketExpr = {
  $switch: {
    branches: [
      { case: { $eq: ['$type', 'Welcome Bonus'] }, then: 'welcome' },
      { case: { $eq: ['$type', 'ORDER_REWARD'] }, then: 'purchaseReward' },
      { case: { $eq: ['$type', 'ORDER_REWARD_REDUCE'] }, then: 'purchaseRewardClawback' },
      { case: { $in: ['$type', ['REFERRAL_REWARD', 'LEGACY_BALANCE_MERGE']] }, then: 'referralReward' },
      { case: { $eq: ['$type', 'REFERRAL_REWARD_REVERSAL'] }, then: 'referralRewardClawback' },
      { case: { $in: ['$type', ['ORDER_REDEMPTION', 'Payment']] }, then: 'redeemed' },
      { case: { $lt: ['$amount', 0] }, then: 'otherDebit' }
    ],
    default: 'otherCredit'
  }
};
const BUCKET_TYPES = {
  welcome: ['Welcome Bonus'],
  purchaseReward: ['ORDER_REWARD'],
  purchaseRewardClawback: ['ORDER_REWARD_REDUCE'],
  referralReward: ['REFERRAL_REWARD', 'LEGACY_BALANCE_MERGE'],
  referralRewardClawback: ['REFERRAL_REWARD_REVERSAL'],
  redeemed: ['ORDER_REDEMPTION', 'Payment']
};
const KNOWN_TYPES = Object.values(BUCKET_TYPES).flat();

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const paging = ({ page, pageSize }) => {
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const p = Math.max(1, parseInt(page, 10) || 1);
  return { page: p, pageSize: size, skip: (p - 1) * size };
};
const pagination = (page, pageSize, total) => ({ page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) });
const orderNo = (id) => {
  const s = String(id);
  return s.length === 24 ? `OD${s.substring(18).toUpperCase()}` : s;
};

/** Customers matching a name / phone / email search (null = no search). */
const findUserIds = async (search) => {
  if (!search || !String(search).trim()) return null;
  const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
  const users = await User.find({ $or: [{ name: rx }, { phone: rx }, { email: rx }] }).select('_id').limit(500).lean();
  return users.map(u => u._id);
};

const emptyBuckets = () => Object.fromEntries(BUCKETS.map(b => [b, 0]));

/**
 * Locked (not yet spendable) reward coins per customer right now: purchase and referral rewards
 * still inside the return window or with a return pending. Capped at the customer's balance.
 */
const getLockedByUser = async (config) => {
  const cutoff = new Date(Date.now() - config.returnWindowDays * DAY_MS);
  const [own, referral] = await Promise.all([
    Order.find({
      rewardCredited: true, rewardDeducted: { $ne: true },
      $or: [{ rewardCreditedAt: { $gt: cutoff } }, { status: 'Return Requested' }]
    }, 'userId status rewardCreditedAt rewardCoinsAmount').lean(),
    Order.find({
      referralRewardCredited: true, referralRewardReversed: { $ne: true }, referrerId: { $ne: null },
      $or: [{ referralRewardCreditedAt: { $gt: cutoff } }, { status: 'Return Requested' }]
    }, 'referrerId status referralRewardCreditedAt referralRewardAmount').lean()
  ]);
  const locked = new Map();
  const add = (userId, amount) => locked.set(String(userId), (locked.get(String(userId)) || 0) + (Number(amount) || 0));
  own.forEach(o => { if (walletService.isRewardLocked(o, o.rewardCreditedAt, config)) add(o.userId, o.rewardCoinsAmount); });
  referral.forEach(o => { if (walletService.isRewardLocked(o, o.referralRewardCreditedAt, config)) add(o.referrerId, o.referralRewardAmount); });
  return locked;
};

/** Where a purchase's own reward stands. */
const purchaseRewardStatus = (o, config) => {
  if (o.rewardDeducted) return { status: 'Clawed back', coins: Number(o.rewardCoinsAmount) || 0 };
  if (o.rewardCredited) {
    const coins = Number(o.rewardCoinsAmount) || 0;
    if (walletService.isRewardLocked(o, o.rewardCreditedAt, config)) {
      const unlocksAt = o.status === 'Return Requested' ? null : new Date(new Date(o.rewardCreditedAt).getTime() + config.returnWindowDays * DAY_MS);
      return { status: 'Locked', coins, unlocksAt };
    }
    return { status: 'Released', coins };
  }
  const expected = o.rewardCoinsExpected !== null && o.rewardCoinsExpected !== undefined ? Math.max(0, Math.floor(o.rewardCoinsExpected)) : null;
  if (['Cancelled', 'Refunded'].includes(o.status)) return { status: 'Not earned', coins: 0 };
  if (expected === 0) return { status: 'No reward', coins: 0 };
  return { status: 'Pending delivery', coins: expected || 0 };
};

const referralRewardStatus = (o, config) => {
  if (!o.referrerId) return null;
  if (o.referralRewardReversed) return { status: 'Clawed back', coins: Number(o.referralRewardAmount) || 0 };
  if (o.referralRewardCredited) {
    const locked = walletService.isRewardLocked(o, o.referralRewardCreditedAt, config);
    return { status: locked ? 'Locked' : 'Released', coins: Number(o.referralRewardAmount) || 0 };
  }
  if (['Cancelled', 'Refunded'].includes(o.status)) return { status: 'Not earned', coins: 0 };
  return { status: 'Pending delivery', coins: 0 };
};

// ─── Overview ───────────────────────────────────────────────────────────────

const getCoinsOverview = async ({ from = null } = {}) => {
  const config = await walletService.getWalletConfig();
  const ledgerMatch = { ...COIN_LEDGER_MATCH, ...(from ? { createdAt: { $gte: from } } : {}) };
  const orderMatch = from ? { createdAt: { $gte: from } } : {};

  const [bucketTotals, ledgerAllTime, balanceStats, lockedByUser, rewardOrders, welcomeUsers] = await Promise.all([
    WalletTransaction.aggregate([
      { $match: ledgerMatch },
      { $group: { _id: bucketExpr, total: { $sum: { $abs: '$amount' } }, entries: { $sum: 1 }, users: { $addToSet: '$userId' } } }
    ]),
    WalletTransaction.find(COIN_LEDGER_MATCH).select('type amount').lean(),
    User.aggregate([{ $group: { _id: null, coins: { $sum: { $ifNull: ['$walletBalance', 0] } }, holders: { $sum: { $cond: [{ $gt: ['$walletBalance', 0] }, 1, 0] } } } }]),
    getLockedByUser(config),
    // Legacy duplicate records (non-ObjectId ids) are copies of real orders — skip them
    Order.find({ ...orderMatch, _id: { $type: 'objectId' } }).select('userId status rewardCredited rewardCreditedAt rewardDeducted rewardCoinsAmount rewardCoinsExpected referrerId referralRewardCredited referralRewardCreditedAt referralRewardReversed referralRewardAmount walletUsed referralCoinsUsed').lean(),
    WalletTransaction.distinct('userId', { type: 'Welcome Bonus', ...(from ? { createdAt: { $gte: from } } : {}) })
  ]);

  const movement = emptyBuckets();
  const entryCounts = emptyBuckets();
  const userCounts = emptyBuckets();
  bucketTotals.forEach(b => {
    movement[b._id] = roundMoney(b.total);
    entryCounts[b._id] = b.entries;
    userCounts[b._id] = b.users.length;
  });
  const issued = roundMoney(movement.welcome + movement.purchaseReward + movement.referralReward + movement.otherCredit);
  const removed = roundMoney(movement.purchaseRewardClawback + movement.referralRewardClawback + movement.redeemed + movement.otherDebit);

  // Welcome bonus: how many recipients went on to use coins, and how much they used (all time)
  const welcomeUsage = welcomeUsers.length ? await WalletTransaction.aggregate([
    { $match: { ...COIN_LEDGER_MATCH, userId: { $in: welcomeUsers }, type: { $in: BUCKET_TYPES.redeemed } } },
    { $group: { _id: '$userId', used: { $sum: { $abs: '$amount' } } } }
  ]) : [];
  const welcomeBalances = welcomeUsers.length
    ? await User.aggregate([{ $match: { _id: { $in: welcomeUsers } } }, { $group: { _id: null, coins: { $sum: { $ifNull: ['$walletBalance', 0] } } } }])
    : [];

  // Per-purchase rewards, for orders placed in the period
  const purchase = { orders: rewardOrders.length, pendingDelivery: 0, pendingDeliveryOrders: 0, locked: 0, lockedOrders: 0, released: 0, releasedOrders: 0, clawedBack: 0, clawedBackOrders: 0 };
  const referral = { pendingDeliveryOrders: 0, locked: 0, released: 0, clawedBack: 0, rewardedOrders: 0 };
  let coinsUsedOnOrders = 0; let ordersUsingCoins = 0;
  rewardOrders.forEach(o => {
    const r = purchaseRewardStatus(o, config);
    if (r.status === 'Pending delivery') { purchase.pendingDelivery += r.coins; purchase.pendingDeliveryOrders += 1; }
    if (r.status === 'Locked') { purchase.locked += r.coins; purchase.lockedOrders += 1; }
    if (r.status === 'Released') { purchase.released += r.coins; purchase.releasedOrders += 1; }
    if (r.status === 'Clawed back') { purchase.clawedBack += r.coins; purchase.clawedBackOrders += 1; }
    const rf = referralRewardStatus(o, config);
    if (rf) {
      if (rf.status === 'Pending delivery') referral.pendingDeliveryOrders += 1;
      if (rf.status === 'Locked') { referral.locked += rf.coins; referral.rewardedOrders += 1; }
      if (rf.status === 'Released') { referral.released += rf.coins; referral.rewardedOrders += 1; }
      if (rf.status === 'Clawed back') referral.clawedBack += rf.coins;
    }
    const used = (Number(o.walletUsed) || 0) + (Number(o.referralCoinsUsed) || 0);
    if (used > 0) { coinsUsedOnOrders += used; ordersUsingCoins += 1; }
  });
  Object.keys(purchase).forEach(k => { purchase[k] = roundMoney(purchase[k]); });
  Object.keys(referral).forEach(k => { referral[k] = roundMoney(referral[k]); });

  const balances = balanceStats[0] || { coins: 0, holders: 0 };
  const balanceByUser = lockedByUser.size
    ? new Map((await User.find({ _id: { $in: [...lockedByUser.keys()] } }).select('walletBalance').lean()).map(u => [String(u._id), Number(u.walletBalance) || 0]))
    : new Map();
  let lockedNow = 0;
  lockedByUser.forEach((amt, uid) => { lockedNow += Math.min(amt, Math.max(0, balanceByUser.get(uid) || 0)); });

  // Reconciliation
  const ledgerBalance = roundMoney(ledgerAllTime.reduce((s, t) => s + (walletService.getTransactionDirection(t) === 'debit' ? -Math.abs(t.amount) : Math.abs(t.amount)), 0));
  const allOrdersCoins = await Order.aggregate([
    { $match: { _id: { $type: 'objectId' } } },
    { $group: { _id: null, used: { $sum: { $ifNull: ['$walletUsed', 0] } } } }
  ]);
  const redemptionLedger = await WalletTransaction.aggregate([
    { $match: { type: 'ORDER_REDEMPTION' } },
    { $lookup: { from: 'orders', localField: 'orderId', foreignField: '_id', as: 'o' } },
    { $match: { 'o.0': { $exists: true } } },
    { $group: { _id: null, used: { $sum: { $abs: '$amount' } } } }
  ]);
  const check = (key, label, expected, actual, detail) => ({
    key, label, expected: roundMoney(expected), actual: roundMoney(actual), difference: roundMoney(actual - expected), ok: Math.abs(actual - expected) <= EPSILON, detail
  });
  const checks = [
    check('coinBalances', 'Customer coin balances match the coin ledger (all time)', ledgerBalance, balances.coins, 'Sum of balances vs sum of every coin ledger entry'),
    check('coinsOnOrders', 'Coins used on orders match the ledger (all time)', allOrdersCoins[0]?.used || 0, redemptionLedger[0]?.used || 0, 'Order.walletUsed vs ORDER_REDEMPTION entries for existing orders')
  ];

  return {
    from,
    rules: {
      walletEnabled: config.walletEnabled,
      welcomeBonusEnabled: config.welcomeBonusEnabled,
      welcomeBonusCoins: config.welcomeBonusCoins,
      rewardCoinsEnabled: config.rewardCoinsEnabled,
      orderRewardPercentage: config.orderRewardPercentage,
      orderRewardMaxCap: config.orderRewardMaxCap,
      referralEnabled: config.referralEnabled,
      referralRewardPerOrder: config.referralRewardPerOrder,
      walletRedemptionPercentage: config.walletRedemptionPercentage,
      returnWindowDays: config.returnWindowDays
    },
    movement: { ...movement, issued, removed, netChange: roundMoney(issued - removed) },
    entryCounts,
    userCounts,
    welcome: {
      recipients: welcomeUsers.length,
      coinsGiven: movement.welcome,
      recipientsWhoUsedCoins: welcomeUsage.length,
      coinsUsedByRecipients: roundMoney(welcomeUsage.reduce((s, u) => s + u.used, 0)),
      recipientsCurrentBalance: roundMoney(welcomeBalances[0]?.coins || 0)
    },
    purchase: { ...purchase, coinsUsedOnOrders: roundMoney(coinsUsedOnOrders), ordersUsingCoins },
    referral,
    balance: {
      outstanding: roundMoney(balances.coins),
      lockedNow: roundMoney(lockedNow),
      spendableNow: roundMoney(balances.coins - lockedNow),
      customersWithCoins: balances.holders
    },
    checks
  };
};

// ─── Per-purchase rewards ───────────────────────────────────────────────────

const PURCHASE_FILTERS = {
  pending: { rewardCredited: { $ne: true }, status: { $nin: ['Cancelled', 'Refunded'] } },
  credited: { rewardCredited: true, rewardDeducted: { $ne: true } },
  clawedBack: { rewardDeducted: true },
  usedCoins: { $or: [{ walletUsed: { $gt: 0 } }, { referralCoinsUsed: { $gt: 0 } }] },
  referral: { referrerId: { $ne: null } }
};

const getPurchaseRewards = async ({ from = null, page, pageSize, filter = 'all', search } = {}) => {
  const config = await walletService.getWalletConfig();
  const p = paging({ page, pageSize });
  const match = { _id: { $type: 'objectId' }, ...(from ? { createdAt: { $gte: from } } : {}), ...(PURCHASE_FILTERS[filter] || {}) };
  const userIds = await findUserIds(search);
  if (userIds) match.userId = { $in: userIds };

  const [orders, total] = await Promise.all([
    Order.find(match)
      .select('userId referrerId status createdAt eligibleProductValue subtotal items rewardCredited rewardCreditedAt rewardDeducted rewardCoinsAmount rewardCoinsExpected referralRewardCredited referralRewardCreditedAt referralRewardReversed referralRewardAmount walletUsed referralCoinsUsed')
      .populate('userId', 'name phone')
      .populate('referrerId', 'name phone')
      .sort({ createdAt: -1 }).skip(p.skip).limit(p.pageSize).lean(),
    Order.countDocuments(match)
  ]);

  const rows = orders.map(o => {
    const reward = purchaseRewardStatus(o, config);
    const ref = referralRewardStatus(o, config);
    const productValue = o.eligibleProductValue !== null && o.eligibleProductValue !== undefined
      ? o.eligibleProductValue
      : walletService.calculateEligibleProductValue(o.items || []);
    return {
      id: String(o._id),
      orderNo: orderNo(o._id),
      createdAt: o.createdAt,
      status: o.status,
      customer: o.userId ? { name: o.userId.name || 'Customer', phone: o.userId.phone || '' } : null,
      productValue: roundMoney(productValue),
      reward: { ...reward, coins: roundMoney(reward.coins) },
      referral: ref ? { ...ref, coins: roundMoney(ref.coins), referrer: o.referrerId ? { name: o.referrerId.name || 'Customer', phone: o.referrerId.phone || '' } : null } : null,
      coinsUsed: roundMoney((Number(o.walletUsed) || 0) + (Number(o.referralCoinsUsed) || 0))
    };
  });
  return { rows, pagination: pagination(p.page, p.pageSize, total) };
};

// ─── Per-customer coins ─────────────────────────────────────────────────────

const getCustomerCoins = async ({ page, pageSize, search, sort = 'balance' } = {}) => {
  const config = await walletService.getWalletConfig();
  const p = paging({ page, pageSize });
  const match = { ...COIN_LEDGER_MATCH };
  const userIds = await findUserIds(search);
  if (userIds) match.userId = { $in: userIds };

  const sortStage = sort === 'received' ? { received: -1 } : sort === 'used' ? { redeemed: -1 } : { balance: -1 };
  const grouped = await WalletTransaction.aggregate([
    { $match: match },
    { $addFields: { bucket: bucketExpr, abs: { $abs: '$amount' } } },
    {
      $group: {
        _id: '$userId',
        ...Object.fromEntries(BUCKETS.map(b => [b, { $sum: { $cond: [{ $eq: ['$bucket', b] }, '$abs', 0] } }])),
        lastActivity: { $max: '$createdAt' }
      }
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $addFields: { user: { $arrayElemAt: ['$user', 0] } } },
    {
      $addFields: {
        balance: { $ifNull: ['$user.walletBalance', 0] },
        received: { $add: ['$welcome', '$purchaseReward', '$referralReward', '$otherCredit'] }
      }
    },
    { $sort: { ...sortStage, _id: 1 } },
    { $facet: { rows: [{ $skip: p.skip }, { $limit: p.pageSize }], total: [{ $count: 'n' }] } }
  ]);

  const rowsRaw = grouped[0]?.rows || [];
  const total = grouped[0]?.total[0]?.n || 0;
  const lockedByUser = await getLockedByUser(config);
  const rows = rowsRaw.map(r => {
    const balance = roundMoney(r.balance);
    const locked = roundMoney(Math.min(lockedByUser.get(String(r._id)) || 0, Math.max(0, balance)));
    const received = roundMoney(r.received);
    const clawedBack = roundMoney(r.purchaseRewardClawback + r.referralRewardClawback);
    const ledgerBalance = roundMoney(received - clawedBack - r.redeemed - r.otherDebit);
    return {
      userId: String(r._id),
      name: r.user?.name || 'Deleted customer',
      phone: r.user?.phone || '',
      welcome: roundMoney(r.welcome),
      purchaseRewards: roundMoney(r.purchaseReward),
      referralRewards: roundMoney(r.referralReward),
      otherCredits: roundMoney(r.otherCredit),
      received,
      clawedBack,
      usedOnOrders: roundMoney(r.redeemed),
      otherDebits: roundMoney(r.otherDebit),
      balance,
      locked,
      spendable: roundMoney(balance - locked),
      ledgerBalance,
      matchesLedger: Math.abs(ledgerBalance - balance) <= EPSILON,
      lastActivity: r.lastActivity
    };
  });
  return { rows, pagination: pagination(p.page, p.pageSize, total) };
};

// ─── Coin ledger ────────────────────────────────────────────────────────────

const getCoinLedger = async ({ from = null, page, pageSize, source = 'all', search } = {}) => {
  const p = paging({ page, pageSize });
  const match = { ...COIN_LEDGER_MATCH, ...(from ? { createdAt: { $gte: from } } : {}) };
  if (BUCKET_TYPES[source]) match.type = { $in: BUCKET_TYPES[source] };
  else if (source === 'otherCredit') match.$and = [{ type: { $nin: KNOWN_TYPES } }, { type: { $not: /^REFUND_WALLET/ } }, { amount: { $gte: 0 } }];
  else if (source === 'otherDebit') match.$and = [{ type: { $nin: KNOWN_TYPES } }, { type: { $not: /^REFUND_WALLET/ } }, { amount: { $lt: 0 } }];
  const userIds = await findUserIds(search);
  if (userIds) match.userId = { $in: userIds };

  const [entries, total] = await Promise.all([
    WalletTransaction.find(match)
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 }).skip(p.skip).limit(p.pageSize).lean(),
    WalletTransaction.countDocuments(match)
  ]);
  const rows = entries.map(t => {
    const bucket = bucketOf(t);
    const credit = CREDIT_BUCKETS.has(bucket);
    return {
      id: String(t._id),
      createdAt: t.createdAt,
      customer: t.userId ? { name: t.userId.name || 'Customer', phone: t.userId.phone || '' } : null,
      bucket,
      label: BUCKET_LABELS[bucket],
      amount: roundMoney(credit ? Math.abs(t.amount) : -Math.abs(t.amount)),
      balanceAfter: t.balanceAfter,
      orderNo: t.orderId ? orderNo(t.orderId) : null,
      orderId: t.orderId ? String(t.orderId) : null,
      description: t.description || ''
    };
  });
  return { rows, pagination: pagination(p.page, p.pageSize, total) };
};

module.exports = { getCoinsOverview, getPurchaseRewards, getCustomerCoins, getCoinLedger, bucketOf, BUCKET_LABELS };
