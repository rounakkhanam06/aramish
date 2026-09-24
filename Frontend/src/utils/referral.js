// Persists a referral code picked up from a shared link (?ref=CODE) so it is
// auto-applied at signup, even if the visitor browses around or closes the tab first.

const STORAGE_KEY = 'pendingReferralCode';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const normalize = (code) => (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export const setPendingReferralCode = (code) => {
  const clean = normalize(code);
  try {
    if (clean) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: clean, savedAt: Date.now() }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* storage unavailable */ }
  return clean;
};

export const getPendingReferralCode = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    const { code, savedAt } = JSON.parse(raw);
    if (!code || Date.now() - savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return '';
    }
    return code;
  } catch {
    return '';
  }
};

export const clearPendingReferralCode = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY); // legacy location
  } catch { /* storage unavailable */ }
};

// Reads ?ref=CODE from the query string or from a hash-style URL (#/login?ref=CODE)
// and stores it. Returns the captured code, or '' if the URL has none.
export const captureReferralFromUrl = (search = window.location.search, hash = window.location.hash) => {
  let code = new URLSearchParams(search).get('ref');
  if (!code && hash && hash.includes('ref=')) {
    const hashQuery = hash.split('?')[1];
    if (hashQuery) code = new URLSearchParams(hashQuery).get('ref');
  }
  return code ? setPendingReferralCode(code) : '';
};

// ---- Referral invite links (/r/CODE) and app store redirects ----

export const ANDROID_PACKAGE_ID = 'com.aramishshoes.app';
// App Store listing, e.g. https://apps.apple.com/in/app/aramish/id1234567890 — unset until the iOS app is live
export const IOS_APP_STORE_URL = import.meta.env.VITE_IOS_APP_STORE_URL || '';

const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');

// The link users share. Opens the app (App Links) when installed, otherwise ReferralLandingPage.
export const buildReferralShareUrl = (code) => `${SITE_URL}/r/${encodeURIComponent(code)}`;

// Play Store link carrying the code as an install referrer. After install, the Flutter app reads it
// with the Play Install Referrer API and gets back "utm_source=referral&utm_medium=invite&ref=CODE".
export const buildPlayStoreUrl = (code) => {
  const referrer = `utm_source=referral&utm_medium=invite&ref=${code}`;
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}&referrer=${encodeURIComponent(referrer)}`;
};
