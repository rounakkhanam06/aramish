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
