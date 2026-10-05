const DeferredReferralClick = require('../Models/DeferredReferralClick');
const { validateReferralCode } = require('./referralController');

// Deferred deep linking for iOS referral invites.
//   1. Safari, app not installed: ReferralLandingPage records the tap here, then opens the App Store.
//   2. First launch of the app: its WebView asks for a match and gets the referral code back.
// A match needs the same network (IP) within MATCH_WINDOW_MS, and the device signals that are
// known on both sides (screen size, timezone) must agree. OS version and language break ties.

const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

const LOOPBACK_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

// IPv4 as-is; IPv6 reduced to its /64 prefix, since iOS rotates the interface part of the address
const toIpKey = (rawIp = '') => {
  let ip = rawIp.trim().split('%')[0];
  if (ip.startsWith('::ffff:') && ip.includes('.')) ip = ip.slice(7);
  if (!ip.includes(':')) return ip;

  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const groups = tail === undefined
    ? headParts
    : [...headParts, ...Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts];
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
};

const getIpKey = (req) => {
  // Behind nginx without `trust proxy`, every visitor shows up as loopback and would match each other
  if (process.env.ENV === 'production' && LOOPBACK_IPS.includes(req.ip)) {
    console.warn('Deferred referral: request IP is loopback, check the `trust proxy` setting');
    return null;
  }
  return toIpKey(req.ip) || null;
};

const readSignals = (body = {}) => ({
  osVersion: typeof body.osVersion === 'string' && /^\d{1,3}(\.\d{1,3})?$/.test(body.osVersion) ? body.osVersion : undefined,
  screen: typeof body.screen === 'string' && /^\d{2,5}x\d{2,5}$/.test(body.screen) ? body.screen : undefined,
  tzOffset: Number.isInteger(body.tzOffset) && Math.abs(body.tzOffset) <= 900 ? body.tzOffset : undefined,
  language: typeof body.language === 'string' ? body.language.toLowerCase().slice(0, 16) : undefined
});

// @desc    Record a referral link tap from iOS Safari before redirecting to the App Store
// @route   POST /referral/deferred/click   body: { code, osVersion, screen, tzOffset, language }
// @access  Public
const recordReferralClick = async (req, res) => {
  try {
    const ipKey = getIpKey(req);
    if (!ipKey) return res.status(200).json({ success: true, recorded: false });

    const { normalized, error } = await validateReferralCode(req.body?.code);
    if (error) return res.status(400).json({ success: false, message: error });

    const signals = readSignals(req.body);
    // One record per device and code: tapping the same link again just refreshes it
    await DeferredReferralClick.findOneAndUpdate(
      { ipKey, code: normalized, screen: signals.screen, claimedAt: null },
      { $set: { ...signals, createdAt: new Date() } },
      { upsert: true }
    );

    res.status(200).json({ success: true, recorded: true });
  } catch (error) {
    console.error('Deferred Referral Click Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    On the app's first launch, find the referral link this device tapped before installing
// @route   POST /referral/deferred/match   body: { osVersion, screen, tzOffset, language }
// @access  Public
const matchDeferredReferral = async (req, res) => {
  try {
    const ipKey = getIpKey(req);
    if (!ipKey) return res.status(200).json({ success: true, code: null });

    const signals = readSignals(req.body);
    const candidates = await DeferredReferralClick.find({
      ipKey,
      claimedAt: null,
      createdAt: { $gte: new Date(Date.now() - MATCH_WINDOW_MS) }
    }).sort({ createdAt: -1 }).limit(20);

    // Newest first, so on equal scores the most recent tap wins
    let best = null;
    let bestScore = -1;
    for (const click of candidates) {
      if (signals.screen && click.screen && signals.screen !== click.screen) continue;
      if (signals.tzOffset !== undefined && click.tzOffset != null && signals.tzOffset !== click.tzOffset) continue;
      const score = (signals.osVersion && signals.osVersion === click.osVersion ? 2 : 0)
        + (signals.language && signals.language === click.language ? 1 : 0);
      if (score > bestScore) {
        best = click;
        bestScore = score;
      }
    }
    if (!best) return res.status(200).json({ success: true, code: null });

    // Claim atomically so another device on the same network can't take the same tap
    const claimed = await DeferredReferralClick.findOneAndUpdate(
      { _id: best._id, claimedAt: null },
      { $set: { claimedAt: new Date() } }
    );
    if (!claimed) return res.status(200).json({ success: true, code: null });

    // The referrer may have been deactivated since the tap
    const { error } = await validateReferralCode(claimed.code);
    res.status(200).json({ success: true, code: error ? null : claimed.code });
  } catch (error) {
    console.error('Deferred Referral Match Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  recordReferralClick,
  matchDeferredReferral,
  toIpKey
};
