import React, { useState, useEffect } from 'react';
import {
  Users, Gift, Coins, TrendingUp, CheckCircle2, Clock,
  Search, Filter, RefreshCw, Settings2, Save, AlertCircle,
  ChevronDown, ToggleLeft, ToggleRight, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400' },
  completed: { label: 'Completed', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  rewarded:  { label: 'Rewarded',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
};

const ReferralProgram = () => {
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

  // Config panel
  const [showConfig, setShowConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [referralCoinsReferrer, setReferralCoinsReferrer] = useState(100);
  const [referralCoinsReferee, setReferralCoinsReferee] = useState(100);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/admin/referrals?${params}`, { headers });
      const data = await res.json();
      if (data.success) {
        setReferrals(data.referrals);
        setStats(data.stats);
        toast.success('Referrals list refreshed!');
      } else {
        toast.error(data.message || 'Failed to load referrals');
      }
    } catch {
      toast.error('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/referrals/config`, { headers });
      const data = await res.json();
      if (data.success) {
        setReferralCoinsReferrer(data.config.referralCoinsReferrer);
        setReferralCoinsReferee(data.config.referralCoinsReferee);
        setReferralEnabled(data.config.referralEnabled);
      }
    } catch { /* silent */ }
    finally { setConfigLoading(false); }
  };

  useEffect(() => { fetchReferrals(); }, [statusFilter]);
  useEffect(() => { fetchConfig(); }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch(`${API_BASE}/admin/referrals/config`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCoinsReferrer,
          referralCoinsReferee,
          referralCoinsPerReferral: referralCoinsReferrer,
          referralEnabled
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Referral config saved!');
        setShowConfig(false);
      } else {
        toast.error(data.message || 'Failed to save config');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingConfig(false);
    }
  };

  const filtered = referrals.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.referrer?.name?.toLowerCase().includes(q) ||
      r.referrer?.phone?.includes(q) ||
      r.referee?.name?.toLowerCase().includes(q) ||
      r.referee?.phone?.includes(q) ||
      r.referralCode?.toLowerCase().includes(q)
    );
  });

  const statCards = [
    { label: 'Total Referrals', value: stats.total ?? 0,     icon: Users,      color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'Pending',         value: stats.pending ?? 0,   icon: Clock,      color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: 'Rewarded',        value: stats.rewarded ?? 0,  icon: Gift,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Coins Awarded',   value: stats.totalCoins ?? 0, icon: TrendingUp, color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700 relative">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">
            Referral Program
          </h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">
            Monitor referrals, track coin payouts, and configure the reward program.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchReferrals}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Settings2 size={14} />
            Configure
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={22} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 font-roboto leading-none">{stat.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="p-6 border-b border-slate-50 flex gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by name, phone or code..."
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-12 pr-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-900"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`px-5 h-[52px] border rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-black uppercase tracking-widest ${
                filterOpen || statusFilter !== 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:text-slate-900'
              }`}
            >
              <Filter size={16} />
              {statusFilter !== 'all' && <span>{statusFilter}</span>}
              <ChevronDown size={12} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    className="absolute right-0 top-16 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 py-2 w-44 overflow-hidden"
                  >
                    <p className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
                      Filter by Status
                    </p>
                    {['all', 'pending', 'completed', 'rewarded'].map(s => (
                      <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setFilterOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between ${
                          statusFilter === s ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {s}
                        {statusFilter === s && <CheckCircle2 size={12} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Referrer</th>
                <th className="px-6 py-4">Referee</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Coins Awarded</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                      <Loader2 size={36} className="animate-spin text-blue-400" />
                      <p className="text-xs font-bold uppercase tracking-widest">Loading referrals...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                      <Gift size={48} className="opacity-30" />
                      <p className="text-xs font-bold uppercase tracking-widest">No referrals found</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((ref, i) => {
                const sc = STATUS_CONFIG[ref.status] || STATUS_CONFIG.pending;
                return (
                  <motion.tr
                    key={ref._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-blue-50/20 transition-colors border-l-4 border-transparent hover:border-blue-400"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-black text-indigo-600 text-xs">
                          {ref.referrer?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[13px]">{ref.referrer?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{ref.referrer?.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-xs">
                          {ref.referee?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[13px]">{ref.referee?.name || 'New User'}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{ref.referee?.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[12px] font-black text-[#0B132B] bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                        {ref.referralCode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${sc.bg} ${sc.text} ${sc.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {ref.referrerCoinsAwarded > 0 ? (
                        <span className="font-black text-amber-600 text-[13px]">+{ref.referrerCoinsAwarded} MC</span>
                      ) : (
                        <span className="text-slate-300 text-[12px] font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                      {new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Config Slide-Over */}
      <AnimatePresence>
        {showConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-white h-full rounded-[32px] shadow-2xl p-10 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 font-montserrat uppercase tracking-tight">Referral Config</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Set rewards &amp; program rules</p>
                </div>
                <button
                  onClick={() => setShowConfig(false)}
                  className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90 shadow-sm"
                >
                  ✕
                </button>
              </div>

              {configLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-blue-400" />
                </div>
              ) : (
                <div className="flex-1 space-y-8">
                  {/* Enable Toggle */}
                  <div className="bg-slate-50 rounded-2xl p-6 flex items-center justify-between border border-slate-100">
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Referral Program</p>
                      <p className="text-[11px] text-slate-400 font-bold mt-1">
                        {referralEnabled ? 'Program is active' : 'Program is disabled'}
                      </p>
                    </div>
                    <button
                      onClick={() => setReferralEnabled(!referralEnabled)}
                      className="transition-all active:scale-90"
                    >
                      {referralEnabled
                        ? <ToggleRight size={40} className="text-emerald-500" />
                        : <ToggleLeft size={40} className="text-slate-300" />}
                    </button>
                  </div>

                  {/* Coins to Referrer */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Coins to Referrer (Jo refer kar raha hai)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={referralCoinsReferrer}
                        onChange={e => setReferralCoinsReferrer(Number(e.target.value.replace(/\D/g, '')) || 0)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coins</span>
                    </div>
                  </div>

                  {/* Coins to Referee */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Coins to Referee (Jo refer ho raha hai)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={referralCoinsReferee}
                        onChange={e => setReferralCoinsReferee(Number(e.target.value.replace(/\D/g, '')) || 0)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coins</span>
                    </div>
                  </div>

                  {/* Info box */}
                  <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex gap-3 items-start">
                    <AlertCircle size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-blue-500 font-bold leading-relaxed uppercase tracking-wide">
                      Coins are credited to both parties automatically when the referred user completes their first order.
                    </p>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-8 border-t border-slate-50">
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {savingConfig ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReferralProgram;
