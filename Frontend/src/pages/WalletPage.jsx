import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Coins, ArrowUpRight, ArrowDownLeft, Gift, Clock, Landmark, Sparkles, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function WalletPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  // All values come from the backend — nothing is calculated here.
  // Main Wallet = coins (welcome/referral/order rewards); Refund Wallet = actual refunded money.
  const [walletBalance, setWalletBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [lockedRewardCoins, setLockedRewardCoins] = useState(0);
  const [redemptionPercentage, setRedemptionPercentage] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [refundWalletBalance, setRefundWalletBalance] = useState(0);
  const [refundWalletTransactions, setRefundWalletTransactions] = useState([]);
  const [historyTab, setHistoryTab] = useState('MAIN');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWalletDetails = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      // Fetch wallet balance & transactions
      const res = await fetch(`${API_BASE}/auth/wallet`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setWalletBalance(data.walletBalance || 0);
        setAvailableBalance(data.availableWalletBalance || 0);
        setLockedRewardCoins(data.lockedRewardCoins || 0);
        setRedemptionPercentage(data.walletRedemptionPercentage ?? null);
        setWalletTransactions(data.walletTransactions || []);
        setRefundWalletBalance(data.refundWalletBalance || 0);
        setRefundWalletTransactions(data.refundWalletTransactions || []);
      }
    } catch (err) {
      console.error('Wallet fetch error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchWalletDetails();
      toast.success('Wallet details refreshed successfully!');
    } catch (err) {
      toast.error('Failed to refresh wallet details.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWalletDetails();
  }, [user]);

  const TX_LABELS = {
    WELCOME_BONUS: 'Welcome Bonus',
    REFERRAL_REWARD: 'Referral Reward',
    ORDER_REWARD: 'Order Reward',
    ORDER_REDEMPTION: 'Used on Order',
    GAME_REWARD: 'Game Reward',
    REFUND: 'Refund'
  };
  const REFUND_WALLET_LABELS = {
    REFUND_WALLET_CREDIT: 'Refund Credited',
    REFUND_WALLET_DEBIT: 'Used on Order',
    REFUND_WALLET_RESTORE: 'Credited Back (Order Cancelled/Returned)',
    REFUND_WALLET_PARTIAL_REFUND: 'Partial Refund'
  };
  const txLabel = (tx) => {
    if (REFUND_WALLET_LABELS[tx.type]) return REFUND_WALLET_LABELS[tx.type];
    if (tx.type === 'ORDER_REWARD_REDUCE') return 'Order Reward Withdrawn';
    if (tx.type === 'REFERRAL_REWARD_REVERSAL') return 'Referral Reward Withdrawn';
    return TX_LABELS[tx.source] || tx.type;
  };

  const formatTxDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            <h1 className="text-[17px] font-bold text-[#02006c]">My Wallet</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="p-2 rounded-full hover:bg-surface transition-colors cursor-pointer"
              title="Refresh Balance"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center py-20 gap-2">
          <div className="w-8 h-8 border-4 border-[#0B132B] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-400">Loading wallet details...</span>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 md:px-12 py-4 w-full flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-5 flex flex-col">
          
          {/* Unified Wallet Balance Card */}
          <div className="bg-gradient-to-br from-[#02006c] to-indigo-900 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-surface/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gold/10 rounded-full blur-xl -ml-10 -mb-10"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-surface/15 rounded-full flex items-center justify-center mb-3 border border-white/20 shadow-inner">
                <Coins className="w-6 h-6 text-amber-300 animate-pulse" />
              </div>
              <p className="text-indigo-200 text-[10px] font-bold tracking-wider uppercase mb-1">Main Wallet / Coins</p>
              <h2 className="text-3xl font-black tracking-tight">₹{walletBalance.toFixed(2)}</h2>
              
              <div className="mt-3 pt-3 border-t border-white/10 w-full flex items-center justify-around gap-2 text-xs">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-emerald-300 font-semibold uppercase">Available to Spend</span>
                  <span className="text-sm font-extrabold text-emerald-200">₹{Number(availableBalance).toFixed(2)}</span>
                </div>
                {lockedRewardCoins > 0 && (
                  <div className="flex flex-col items-center border-l border-white/10 pl-4">
                    <span className="text-[10px] text-amber-300 font-semibold uppercase flex items-center gap-1">🔒 Locked Coins</span>
                    <span className="text-sm font-extrabold text-amber-200">₹{lockedRewardCoins.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {redemptionPercentage !== null && (
                  <span className="text-[10px] text-indigo-300 font-semibold bg-white/10 px-3 py-1 rounded-full border border-white/5">
                    Use up to {redemptionPercentage}% of the product value on each order
                  </span>
                )}
                {lockedRewardCoins > 0 && (
                  <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/30">
                    🔒 Locked until return window closes
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Refund Wallet Card — actual refunded money, kept separate from coins */}
          <div className="bg-gradient-to-br from-sky-700 to-cyan-900 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-surface/15 rounded-full flex items-center justify-center mb-3 border border-white/20 shadow-inner">
                <Landmark className="w-6 h-6 text-cyan-200" />
              </div>
              <p className="text-cyan-100 text-[10px] font-bold tracking-wider uppercase mb-1">Refund Wallet</p>
              <h2 className="text-3xl font-black tracking-tight">₹{Number(refundWalletBalance).toFixed(2)}</h2>
              <span className="mt-3 text-[10px] text-cyan-100 font-semibold bg-white/10 px-3 py-1 rounded-full border border-white/5">
                Your refunded money — usable up to 100% on any order
              </span>
            </div>
          </div>

            </div>

            {/* Right Column (History Section) */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                {[
                  { key: 'MAIN', label: 'Coins History' },
                  { key: 'REFUND', label: 'Refund Wallet History' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setHistoryTab(tab.key)}
                    className={`text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                      historyTab === tab.key ? 'bg-[#02006c] text-white' : 'text-[#02006c] hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

            {(historyTab === 'REFUND' ? refundWalletTransactions : walletTransactions).length === 0 ? (
              <div className="bg-surface rounded-xl shadow-sm border border-white/10 p-8 text-center text-slate-400">
                <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-bold">No transactions yet.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-xl shadow-sm border border-white/10 overflow-hidden">
                {(historyTab === 'REFUND' ? refundWalletTransactions : walletTransactions).map((tx, idx, list) => {
                  const isCredit = tx.direction === 'credit';
                  const TxIcon = isCredit ? ArrowDownLeft : ArrowUpRight;
                  const isLocked = tx.isLocked;

                  return (
                    <div
                      key={tx.id}
                      className={`flex items-start justify-between p-4 ${idx !== list.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                        <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center mt-0.5 ${isCredit ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          <TxIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <p className="text-[13px] font-bold text-slate-800 leading-tight mr-1">
                              {txLabel(tx)}
                            </p>
                            {tx.wallet === 'REFUND' && (
                              <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 shrink-0 shadow-sm">
                                Refund Wallet
                              </span>
                            )}
                            {tx.orderId && (
                              <span 
                                onClick={() => navigate(`/order/${tx.orderId}`)}
                                className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors shrink-0 shadow-sm"
                              >
                                Order #{tx.orderId.slice(0, 5)}
                              </span>
                            )}
                            {isLocked ? (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5 shrink-0 shadow-sm">
                                🔒 Locked{tx.unlocksAt ? ` till ${formatTxDate(tx.unlocksAt)}` : ''}
                              </span>
                            ) : tx.rewardState === 'UNLOCKED' ? (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 shadow-sm">
                                ✅ Unlocked
                              </span>
                            ) : tx.rewardState === 'WITHDRAWN' ? (
                              <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0 shadow-sm">
                                Withdrawn (order returned)
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug font-medium line-clamp-2">{tx.description}</p>
                          <p className="text-[9.5px] font-semibold text-slate-400 mt-1">{formatTxDate(tx.createdAt)}</p>
                        </div>
                      </div>
                      <div className={`text-sm font-black shrink-0 ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isCredit ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
      )}
    </div>
  );
}
