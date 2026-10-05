// Detects if the site is running inside the Aramish Flutter mobile app's WebView.
// The Flutter app must set a custom User-Agent containing this token when loading the site,
// e.g. WebView(userAgent: "AramishFlutterApp/1.0 " + defaultUserAgent).
const APP_UA_TOKEN = 'AramishFlutterApp';

export function isMobileAppWebView() {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes(APP_UA_TOKEN);
}

// iPadOS WebViews report a Mac user agent by default, so check for touch support too
export function isIosAppWebView() {
  if (!isMobileAppWebView()) return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}
