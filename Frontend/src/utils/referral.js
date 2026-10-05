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

// Stores the code only if no other code is already waiting, so the first invite a visitor
// followed is the one applied. Returns the code that will be applied.
export const savePendingReferralCode = (code) => getPendingReferralCode() || setPendingReferralCode(code);

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
  return code ? savePendingReferralCode(code) : '';
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

// ---- iOS deferred deep linking ----
// iOS has no install referrer. Instead, ReferralLandingPage records the tap in Safari before
// opening the App Store, and on the app's first launch its WebView asks the backend for the tap
// made from the same network and device. Both sides are WebKit, so these signals line up.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DEFERRED_CHECKED_KEY = 'deferredReferralChecked';
export const REFERRAL_RECOVERED_EVENT = 'aramish:referral-recovered';

const getDeviceSignals = () => {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(window.screen.width * dpr);
  const height = Math.round(window.screen.height * dpr);
  const os = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  return {
    screen: `${Math.min(width, height)}x${Math.max(width, height)}`,
    tzOffset: -new Date().getTimezoneOffset(),
    language: (navigator.language || '').toLowerCase(),
    osVersion: os ? `${os[1]}.${os[2]}` : undefined
  };
};

// Waits at most 1.5s, so a slow network never holds up the App Store redirect
export const recordReferralClick = (code) => {
  const request = fetch(`${API_BASE}/referral/deferred/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, ...getDeviceSignals() }),
    keepalive: true
  }).catch(() => {});
  return Promise.race([request, new Promise((resolve) => setTimeout(resolve, 1500))]);
};

// Runs once per install (until the backend answers). Stores a recovered code without replacing
// one that is already waiting, and fires REFERRAL_RECOVERED_EVENT so an open signup form can fill it in.
export const recoverDeferredReferral = async () => {
  try {
    if (localStorage.getItem(DEFERRED_CHECKED_KEY)) return '';
  } catch {
    return '';
  }
  const markChecked = () => {
    try { localStorage.setItem(DEFERRED_CHECKED_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  };
  if (getPendingReferralCode()) {
    markChecked();
    return '';
  }

  try {
    const res = await fetch(`${API_BASE}/referral/deferred/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getDeviceSignals())
    });
    const data = await res.json();
    if (!res.ok || !data.success) return ''; // try again on the next launch
    markChecked();
    if (!data.code) return '';
    const code = savePendingReferralCode(data.code);
    window.dispatchEvent(new CustomEvent(REFERRAL_RECOVERED_EVENT, { detail: code }));
    return code;
  } catch {
    return '';
  }
};

// For a logged-in user who followed an invite link (e.g. the app opened through a Universal Link):
// applies the waiting code if their account has none. The backend refuses to replace an existing
// referral or to apply one after a first order. Returns the backend response on success, else null.
let applyingPendingReferral = false;
export const applyPendingReferralForUser = async () => {
  const code = getPendingReferralCode();
  const token = localStorage.getItem('userToken');
  if (!code || !token || applyingPendingReferral) return null;

  applyingPendingReferral = true;
  try {
    const res = await fetch(`${API_BASE}/referral/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code })
    });
    if (res.status === 401 || res.status >= 500) return null; // keep the code and retry later
    clearPendingReferralCode();
    const data = await res.json().catch(() => ({}));
    return data.success ? data : null;
  } catch {
    return null;
  } finally {
    applyingPendingReferral = false;
  }
};
