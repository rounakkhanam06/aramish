const SystemConfig = require('../Models/SystemConfig');
const { gstinError, panError, resolveState, normalizeGstin } = require('../utils/gstData');

// GST rates (%) that can be configured for goods.
const ALLOWED_GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

/**
 * Validates the Business & Tax (GST invoice) fields of a settings update against the current
 * config and applies them. Returns an error message, or null when applied.
 */
const applyBusinessTaxSettings = (config, body) => {
  const str = (v) => String(v === undefined || v === null ? '' : v).trim();
  const next = {};
  ['businessLegalName', 'businessTradeName', 'businessAddress'].forEach(f => {
    if (body[f] !== undefined) next[f] = str(body[f]).slice(0, f === 'businessAddress' ? 500 : 200);
  });
  // GSTIN/PAN are validated when changed; an unchanged stored value (e.g. the old placeholder)
  // doesn't block saving other settings — invoice issuance checks it separately.
  if (body.gstNo !== undefined && normalizeGstin(body.gstNo) !== normalizeGstin(config.gstNo)) {
    next.gstNo = normalizeGstin(body.gstNo);
    if (next.gstNo) {
      const err = gstinError(next.gstNo);
      if (err) return `Seller ${err}`;
    }
  }
  if (body.businessPan !== undefined && str(body.businessPan).toUpperCase() !== str(config.businessPan).toUpperCase()) {
    next.businessPan = str(body.businessPan).toUpperCase();
    if (next.businessPan && panError(next.businessPan)) return panError(next.businessPan);
  }
  if (body.businessState !== undefined || body.businessStateCode !== undefined) {
    const byName = str(body.businessState) ? resolveState(body.businessState) : null;
    const byCode = str(body.businessStateCode) ? resolveState(body.businessStateCode) : null;
    if (str(body.businessState) && !byName) return 'Business state is invalid';
    if (str(body.businessStateCode) && !byCode) return 'Business state code is invalid';
    if (byName && byCode && byName.code !== byCode.code) return `State code ${byCode.code} does not match ${byName.name} (${byName.code})`;
    const state = byName || byCode;
    next.businessState = state ? state.name : '';
    next.businessStateCode = state ? state.code : '';
  }
  if (body.invoicePrefix !== undefined) {
    next.invoicePrefix = str(body.invoicePrefix).toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(next.invoicePrefix)) return 'Invoice prefix must be 1-10 letters/digits';
  }
  if (body.defaultHsnCode !== undefined) {
    next.defaultHsnCode = str(body.defaultHsnCode);
    if (next.defaultHsnCode && !/^\d{4}(\d{2}){0,2}$/.test(next.defaultHsnCode)) return 'Default HSN code must be 4, 6 or 8 digits';
  }
  if (body.gstRateRules !== undefined) {
    if (!Array.isArray(body.gstRateRules) || body.gstRateRules.length === 0) return 'At least one GST rate rule is required';
    const seen = new Set();
    const rules = [];
    for (const r of body.gstRateRules) {
      const effectiveFrom = new Date(r && r.effectiveFrom);
      const threshold = Number(r && r.threshold);
      const low = Number(r && r.rateUpToThreshold);
      const high = Number(r && r.rateAboveThreshold);
      if (Number.isNaN(effectiveFrom.getTime())) return 'Each GST rate rule needs a valid effective date';
      if (!Number.isFinite(threshold) || threshold < 0) return 'GST slab threshold must be 0 or more';
      if (!ALLOWED_GST_RATES.includes(low) || !ALLOWED_GST_RATES.includes(high)) return `GST rates must be one of ${ALLOWED_GST_RATES.join(', ')}%`;
      const day = effectiveFrom.toISOString().slice(0, 10);
      if (seen.has(day)) return 'Two GST rate rules have the same effective date';
      seen.add(day);
      rules.push({ effectiveFrom, threshold, rateUpToThreshold: low, rateAboveThreshold: high });
    }
    next.gstRateRules = rules.sort((a, b) => a.effectiveFrom - b.effectiveFrom);
  }

  // Cross-checks on the resulting values (GSTIN embeds the state code and the PAN)
  const gstin = next.gstNo !== undefined ? next.gstNo : normalizeGstin(config.gstNo);
  const stateCode = next.businessStateCode !== undefined ? next.businessStateCode : config.businessStateCode;
  const pan = next.businessPan !== undefined ? next.businessPan : config.businessPan;
  const touched = ['gstNo', 'businessPan'].some(f => next[f] !== undefined)
    || (next.businessStateCode !== undefined && next.businessStateCode !== config.businessStateCode);
  if (touched && gstin && !gstinError(gstin)) {
    if (stateCode && gstin.slice(0, 2) !== stateCode) return `GSTIN ${gstin} belongs to state code ${gstin.slice(0, 2)}, not ${stateCode}`;
    if (pan && gstin.slice(2, 12) !== pan) return 'PAN does not match the GSTIN (characters 3-12)';
  }

  Object.assign(config, next);
  return null;
};

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Public
const getSettings = async (req, res) => {
  try {
    let config = await SystemConfig.findOne({});
    if (!config) {
      config = new SystemConfig();
      await config.save();
    }
    res.status(200).json({ success: true, settings: config });
  } catch (error) {
    console.error('Get Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private (Admin)
const updateSettings = async (req, res) => {
  try {
    let config = await SystemConfig.findOne({});
    if (!config) {
      config = new SystemConfig();
    }

    // Wallet/reward rules: validated here, applied by utils/walletService to all future
    // transactions. Whole-coin amounts and 0-100 percentages.
    const walletRuleLimits = {
      welcomeBonusCoins: { label: 'Welcome bonus', integer: true },
      referralRewardPerOrder: { label: 'Referral reward per order', integer: true },
      orderRewardPercentage: { label: 'Order reward percentage', max: 100 },
      orderRewardMaxCap: { label: 'Order reward maximum cap', integer: true },
      walletRedemptionPercentage: { label: 'Wallet redemption percentage', max: 100 }
    };
    for (const [key, rule] of Object.entries(walletRuleLimits)) {
      if (req.body[key] === undefined) continue;
      const n = Number(req.body[key]);
      if (req.body[key] === '' || !Number.isFinite(n) || n < 0 || (rule.max !== undefined && n > rule.max) || (rule.integer && !Number.isInteger(n))) {
        const expected = rule.integer ? 'a whole number of coins (0 or more)' : `a number between 0 and ${rule.max}`;
        return res.status(400).json({ success: false, message: `${rule.label} must be ${expected}` });
      }
    }

    const fields = [
      'platformName', 'supportEmail', 'helpline', 'currency',
      'commission', 'returnWindowDays',
      'welcomeBonusCoins', 'rewardCoinsEnabled', 'marqueeEnabled', 'walletEnabled',
      'referralRewardPerOrder', 'orderRewardPercentage', 'orderRewardMaxCap', 'walletRedemptionPercentage', 'referralEnabled',
      'crazyDealsHeaderName', 'showCrazyDealsTimer', 'crazyDealsDuration',
      'featuredCollectionHeaderName', 'showFeaturedCollectionTimer', 'featuredCollectionDuration',
      'newArrivalsHeaderName', 'showNewArrivalsTimer', 'newArrivalsDuration',
      'codChargeEnabled', 'codChargeAmount', 'prepaidDiscountEnabled', 'prepaidDiscountAmount', 'welcomeBonusEnabled', 'freeShippingEnabled'
    ];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if ([
          'commission',
          'returnWindowDays', 'welcomeBonusCoins', 'crazyDealsDuration', 'featuredCollectionDuration', 'newArrivalsDuration',
          'codChargeAmount', 'prepaidDiscountAmount',
          'referralRewardPerOrder', 'orderRewardPercentage', 'orderRewardMaxCap', 'walletRedemptionPercentage'
        ].includes(f)) {
          config[f] = Number(req.body[f]);
        } else if (['rewardCoinsEnabled', 'marqueeEnabled', 'walletEnabled', 'referralEnabled', 'showCrazyDealsTimer', 'showFeaturedCollectionTimer', 'showNewArrivalsTimer', 'codChargeEnabled', 'prepaidDiscountEnabled', 'welcomeBonusEnabled', 'freeShippingEnabled'].includes(f)) {
          config[f] = req.body[f] === true || req.body[f] === 'true';
        } else {
          config[f] = req.body[f];
        }
      }
    });

    const taxError = applyBusinessTaxSettings(config, req.body);
    if (taxError) {
      return res.status(400).json({ success: false, message: taxError });
    }

    // Blocked couriers are deliberately NOT written here: a whole-list save from a Settings page
    // opened earlier would overwrite couriers blocked since (e.g. from a shipment's courier list).
    // They change one courier at a time through blockCourier / unblockCourier below.

    await config.save();
    res.status(200).json({ success: true, message: 'Settings updated successfully', settings: config });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const loadConfig = async () => (await SystemConfig.findOne({})) || SystemConfig.create({});
const blockedList = async (id) => ((await SystemConfig.findById(id).select('blockedCouriers').lean()) || {}).blockedCouriers || [];

// @desc    Block one courier partner (never offered for booking). Atomic and idempotent.
// @route   POST /admin/settings/blocked-couriers   { courierId, name?, reason? }
// @access  Private (Admin)
const blockCourier = async (req, res) => {
  try {
    const courierId = Number(req.body && req.body.courierId);
    if (!Number.isInteger(courierId) || courierId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid Shiprocket courier ID is required' });
    }
    const config = await loadConfig();
    // Only adds when absent, so parallel blocks never duplicate or drop each other.
    await SystemConfig.updateOne(
      { _id: config._id, 'blockedCouriers.courierId': { $ne: courierId } },
      { $push: { blockedCouriers: {
        courierId,
        name: String(req.body.name || '').trim().slice(0, 100),
        reason: String(req.body.reason || '').trim().slice(0, 200),
        blockedAt: new Date()
      } } }
    );
    res.status(200).json({ success: true, blockedCouriers: await blockedList(config._id) });
  } catch (error) {
    console.error('Block Courier Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Unblock one courier partner. Atomic and idempotent.
// @route   DELETE /admin/settings/blocked-couriers/:courierId
// @access  Private (Admin)
const unblockCourier = async (req, res) => {
  try {
    const courierId = Number(req.params.courierId);
    if (!Number.isInteger(courierId) || courierId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid Shiprocket courier ID is required' });
    }
    const config = await loadConfig();
    await SystemConfig.updateOne({ _id: config._id }, { $pull: { blockedCouriers: { courierId } } });
    res.status(200).json({ success: true, blockedCouriers: await blockedList(config._id) });
  } catch (error) {
    console.error('Unblock Courier Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  blockCourier,
  unblockCourier
};
