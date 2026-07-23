import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Coins, ArrowUpRight, ArrowDownLeft, Gift, Clock, Landmark, Sparkles, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function WalletPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [coins, setCoins] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [welcomeBonusRemaining, setWelcomeBonusRemaining] = useState(0);
  const [coinTransactions, setCoinTransactions] = useState([]);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Coin Conversion settings
  const [config, setConfig] = useState({
    coinConversionEnabled: true,
    coinsPerRupee: 100,
    minimumRedeemCoins: 500,
    maximumRedeemPerOrder: 10000
  });

  // Redemption state
  const [redeemAmount, setRedeemAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyTab, setHistoryTab] = useState('cash'); // default to cash/wallet transactions
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
        setCoins(data.coins || 0);
        setWalletBalance(data.walletBalance || 0);
        setWelcomeBonusRemaining(data.welcomeBonusRemaining || 0);
        setCoinTransactions(data.coinTransactions || []);
        setWalletTransactions(data.walletTransactions || []);
      }

      // Fetch conversion configurations (Public Settings API)
      const settingsRes = await fetch(`${API_BASE}/admin/settings`);
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings) {
        setConfig(settingsData.settings);
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

  const handleRedeem = async (e) => {
    e.preventDefault();
  };

  const handleAddTestCoins = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/wallet/test-coins`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success("1000 Test Coins added!");
        fetchWalletDetails();
      }
    } catch (err) {
      console.error(err);
    }
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
              <p className="text-indigo-200 text-[10px] font-bold tracking-wider uppercase mb-1">Total Wallet Coins Balance</p>
              <h2 className="text-3xl font-black tracking-tight">₹{walletBalance.toFixed(2)}</h2>
              <span className="text-[10px] text-indigo-300 font-semibold mt-2.5 bg-white/10 px-3 py-1 rounded-full border border-white/5">
                Welcome points remaining: ₹{welcomeBonusRemaining.toFixed(2)}
              </span>
            </div>
          </div>


            </div>

            {/* Right Column (History Section) */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex border-b border-white/10 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#02006c]">
                  Wallet Transactions History
                </h3>
              </div>

            {walletTransactions.length === 0 ? (
              <div className="bg-surface rounded-xl shadow-sm border border-white/10 p-8 text-center text-slate-400">
                <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-bold">No transactions yet.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-xl shadow-sm border border-white/10 overflow-hidden">
                {walletTransactions.map((tx, idx) => {
                  const isCredit = ['Refund', 'Redemption', 'Order Cancellation', 'Welcome Bonus', 'REFUND'].includes(tx.type);
                  const TxIcon = isCredit ? ArrowDownLeft : ArrowUpRight;
                  
                  return (
                    <div 
                      key={tx.id} 
                      className={`flex items-center justify-between p-4.5 ${idx !== walletTransactions.length - 1 ? 'border-b border-white/10' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isCredit ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          <TxIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-tight mb-0.5">{tx.type}</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{tx.description}</p>
                          <p className="text-[9px] font-medium text-slate-400 mt-0.5">{formatTxDate(tx.createdAt)}</p>
                        </div>
                      </div>
                      <div className={`text-xs font-black ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isCredit ? '+' : '-'}₹{tx.amount.toFixed(2)}
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
