import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Check, Download, Globe } from 'lucide-react';
import toast from '../utils/toast';
import { isMobileAppWebView } from '../utils/platform';
import { setPendingReferralCode, buildPlayStoreUrl, IOS_APP_STORE_URL } from '../utils/referral';

// Landing page for shared invite links: https://aramishshoes.com/r/CODE
//   - Inside the Flutter app -> signup with the code pre-filled
//   - Android browser        -> Play Store, with the code passed as the install referrer
//   - iPhone / iPad          -> copy the code, then App Store (iOS has no install referrer)
//   - Desktop / other        -> website signup with the code pre-filled
// When the app is installed, Android App Links / iOS Universal Links open the app directly
// and this page is never shown.

const detectPlatform = () => {
  if (isMobileAppWebView() || window.flutter_inappwebview) return 'app';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  // iPadOS 13+ reports itself as a Mac, so check for touch support too
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
};

export default function ReferralLandingPage() {
  const { code: rawCode } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Saved for 30 days, so the code is auto-applied at signup even if they browse around first
  const code = useMemo(() => setPendingReferralCode(rawCode), [rawCode]);
  const platform = useMemo(() => detectPlatform(), []);
  const signupPath = `/login?ref=${code}`;

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
    } else if (platform === 'android') {
      window.location.replace(buildPlayStoreUrl(code));
    } else if (platform === 'app' || platform === 'desktop' || (platform === 'ios' && !IOS_APP_STORE_URL)) {
      navigate(signupPath, { replace: true });
    }
  }, [code, platform, signupPath, navigate]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      return true;
    } catch {
      return false;
    }
  };

  const handleGetApp = async () => {
    if (platform === 'ios') {
      // Must run inside the tap handler — iOS only allows clipboard writes from a user gesture
      if (await copyCode()) toast.success('Code copied! Paste it when you sign up in the app.');
      window.location.href = IOS_APP_STORE_URL;
    } else {
      window.location.href = buildPlayStoreUrl(code);
    }
  };

  if (!code) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 text-center font-sans animate-fade-in">
      <img src="/icons/icon-192.png" alt="Aramish" className="w-24 h-24 rounded-2xl shadow-md mb-6" />

      <h1 className="text-2xl font-black text-[#02006c] mb-2 nunito-heading">You're invited to Aramish!</h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6 font-semibold">
        {platform === 'android'
          ? 'Opening the Play Store… Install the app and your referral code will be applied at signup.'
          : 'Download the app and use this referral code when you sign up.'}
      </p>

      <button
        onClick={async () => { if (await copyCode()) toast.success('Code copied!'); }}
        className="flex items-center gap-3 px-5 py-3 mb-6 border-2 border-dashed border-[#02006c]/30 rounded-xl cursor-pointer"
      >
        <span className="text-xl font-black tracking-widest text-[#02006c]">{code}</span>
        {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5 text-slate-400" />}
      </button>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleGetApp}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#0B132B] hover:bg-[#02006c] text-white text-sm font-black uppercase rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {platform === 'ios' ? 'Copy code & get the app' : 'Get the app'}
        </button>
        <button
          onClick={() => navigate(signupPath, { replace: true })}
          className="flex items-center justify-center gap-2 px-6 py-3 text-[#02006c] text-sm font-black uppercase rounded-xl border border-slate-200 transition-all cursor-pointer"
        >
          <Globe className="w-4 h-4" />
          Continue on website
        </button>
      </div>
    </div>
  );
}
