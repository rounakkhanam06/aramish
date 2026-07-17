import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Copy, Share2, Users, CheckCircle2, Gift,
  Clock, Loader2, AlertCircle, Coins, ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_STYLES = {
  pending:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400' },
  completed: { label: 'Completed', bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-400' },
  rewarded:  { label: 'Rewarded',  bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
};

export default function ReferEarnPage() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Apply code state
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [showApply, setShowApply] = useState(false);

  const fetchReferral = async () => {
    if (!user || (!user.id && !user._id)) {
      console.log('Refer & Earn: User or User ID is missing!', user);
      setLoading(false);
      return;
    }
    const userId = user.id || user._id;
    try {
      const token = localStorage.getItem('userToken');
      console.log('Refer & Earn: Fetching referral details for user:', userId);
      const res = await fetch(`${API_BASE}/referral/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('Refer & Earn: Received response:', data);
      if (data.success) {
        setReferralData(data);
      } else {
        console.error('Refer & Earn: API error:', data.message);
      }
    } catch (err) {
      console.error('Refer & Earn: Referral fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferral();
  }, [user]);

  const referralCode = referralData?.referralCode || '...';
  const shareText = `Hey! Join Aramish using my referral code ${referralCode} and we both get ${referralData?.stats?.coinsPerReferral || 100} Aramish Coins! 🎉`;
  const shareUrl = `${window.location.origin}/#/login?ref=${referralCode}`;
  const fullShareText = `${shareText}\n\n${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullShareText)}`;
    window.open(url, '_blank');
  };

  const handleNativeShare = async () => {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
      window.flutter_inappwebview.callHandler('shareContent', {
        title: 'Join Aramish!',
        text: fullShareText
      });
    } else if (navigator.share) {
      try {
        await navigator.share({ title: 'Join Aramish!', text: shareText, url: shareUrl });
      } catch (err) { /* canceled */ }
    } else {
      navigator.clipboard.writeText(fullShareText);
      toast.success('Share text copied!');
    }
  };

  const handleApplyCode = async () => {
    if (!applyCode.trim()) {
      toast.info('Enter a referral code');
      return;
    }
    setApplying(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE}/referral/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: applyCode.trim().toUpperCase() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setApplyCode('');
        setShowApply(false);
        fetchReferral();
      } else {
        toast.error(data.message || 'Invalid code');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col font-sans pb-20">
      {/* Header */}
      <div className="bg-[#fff4f2] px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto px-0 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-[#02006c]" />
            </button>
            <h1 className="text-[17px] font-bold text-[#02006c]">Refer &amp; Earn</h1>
          </div>
        </div>
      </div>

      {/* Not logged in */}
      {!user || !user.id ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
          <h2 className="text-[16px] font-bold text-slate-700 mb-1">Please log in</h2>
          <p className="text-[13px] text-slate-400">Sign in to get your unique referral code and earn coins.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-5 bg-[#02006c] text-white font-bold text-[13px] px-6 py-2.5 rounded-lg hover:bg-[#02006c]/90 transition-all shadow-md active:scale-[0.98]"
          >
            Go to Login
          </button>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-[#0B132B] animate-spin" />
          <p className="text-[13px] text-slate-400 font-medium">Loading your referral info...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 md:px-12 py-4 w-full flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-4 flex flex-col gap-4">

          {/* Hero Banner */}
          <div className="bg-gradient-to-br from-[#02006c] to-indigo-900 rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden mt-2">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#0B132B]/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#0B132B]/20 rounded-full blur-2xl" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 bg-surface/20 rounded-full flex items-center justify-center mb-3 border border-white/30">
                <Gift className="w-7 h-7 text-amber-300" />
              </div>
              <h2 className="text-2xl font-black mb-1 tracking-tight">Invite &amp; Earn!</h2>
              <p className="text-sm text-indigo-200 font-medium px-4 leading-snug">
                You and your friend both get{' '}
                <span className="text-amber-300 font-black">{referralData?.stats?.coinsPerReferral || 100} Aramish Coins</span>{' '}
                when they complete their first order.
              </p>
            </div>
          </div>

          {/* Stats Row */}
          {referralData?.stats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Referrals', value: referralData.stats.totalReferrals, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                { label: 'Successful', value: referralData.stats.completedReferrals, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { label: 'Coins Earned', value: referralData.stats.totalCoinsEarned, icon: Coins, color: 'text-amber-500', bg: 'bg-amber-50' },
              ].map((stat) => (
                <div key={stat.label} className="bg-surface rounded-xl p-3 shadow-sm border border-white/10 text-center">
                  <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center mx-auto mb-1.5`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <p className="text-[18px] font-black text-slate-800 leading-none">{stat.value}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Share Code Section */}
          <div className="bg-surface rounded-xl p-5 shadow-sm border border-white/10">
            <p className="text-[12px] font-bold text-slate-400 mb-3 text-center uppercase tracking-wider">Your Referral Code</p>
            <div className="flex items-center justify-between bg-gold/10 border border-gold/20 rounded-lg p-2 pl-4 mb-4">
              <span className="text-xl font-black text-[#0B132B] tracking-widest">{referralCode}</span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md font-bold text-sm transition-all ${
                  copied ? 'bg-emerald-500 text-white' : 'bg-[#02006c] text-white hover:bg-[#02006c]/90'
                }`}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 flex items-center justify-center gap-2 bg-[#25D366]/10 text-[#25D366] font-bold py-2.5 rounded-lg border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors"
              >
                WhatsApp
              </button>
              <button
                onClick={handleNativeShare}
                className="flex-1 flex items-center justify-center gap-2 bg-surface text-slate-700 font-bold py-2.5 rounded-lg border border-white/10 hover:bg-surface transition-colors"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>

          {/* Apply Friend's Code */}
          <div className="bg-surface rounded-xl shadow-sm border border-white/10 overflow-hidden">
            <button
              onClick={() => setShowApply(s => !s)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Gift className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-bold text-slate-800">Have a friend's code?</p>
                  <p className="text-[11px] text-slate-400">Apply it to earn coins</p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showApply ? 'rotate-90' : ''}`} />
            </button>
            {showApply && (
              <div className="px-5 pb-4 flex gap-2 animate-fade-in border-t border-white/10 pt-3">
                <input
                  type="text"
                  value={applyCode}
                  onChange={e => setApplyCode(e.target.value.toUpperCase())}
                  placeholder="Enter referral code"
                  maxLength={12}
                  className="flex-1 px-3 py-2.5 bg-surface border border-white/10 rounded-lg text-[13px] font-bold tracking-widest focus:outline-none focus:border-[#0B132B] transition-all uppercase"
                />
                <button
                  onClick={handleApplyCode}
                  disabled={applying}
                  className="bg-[#02006c] text-white font-bold text-[12px] px-4 py-2.5 rounded-lg hover:bg-[#02006c]/90 transition-all disabled:opacity-60 flex items-center gap-1.5"
                >
                  {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (History & Guide) */}
        <div className="md:col-span-5 space-y-4 flex flex-col gap-4">

          {/* Referral History */}
          <div className="bg-surface rounded-xl shadow-sm border border-white/10">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-[14px] font-bold text-slate-800">Your Referrals</h3>
            </div>
            {referralData?.referrals?.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {referralData.referrals.map((ref) => {
                  const s = STATUS_STYLES[ref.status] || STATUS_STYLES.pending;
                  return (
                    <div key={ref.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-slate-500 font-black text-sm">
                          {ref.referee ? ref.referee.name?.charAt(0)?.toUpperCase() || '?' : '?'}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-800">
                            {ref.referee?.name || 'New User'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ref.coinsEarned > 0 && (
                          <span className="text-[11px] font-black text-amber-600">+{ref.coinsEarned} MC</span>
                        )}
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${s.bg} ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 px-6 text-center">
                <Users className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-[13px] font-bold text-slate-400">No referrals yet</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Share your code to get started!</p>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-surface rounded-xl p-5 shadow-sm border border-white/10">
            <h3 className="text-[14px] font-bold text-slate-800 mb-4">How it works</h3>
            <div className="space-y-4 relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-surface" />
              {[
                { n: 1, title: 'Share your code', desc: 'Send your unique referral code to friends.' },
                { n: 2, title: 'Friend signs up', desc: 'They register using your referral code.' },
                { n: 3, title: 'You both earn!', desc: 'Both get Aramish Coins after their first order.' },
              ].map((step) => (
                <div key={step.n} className="flex gap-4 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-[#0B132B]/10 border border-[#0B132B]/30 flex items-center justify-center flex-shrink-0 text-[#0B132B] font-black text-sm">
                    {step.n}
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm font-bold text-slate-800 leading-tight">{step.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      </div>
      )}
    </div>
  );
}
