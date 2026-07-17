import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, Copy, CheckCircle2, Ticket, CheckSquare, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CouponsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'history'
  const [coupons, setCoupons] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchCouponsData = async () => {
    setLoading(true);
    const token = localStorage.getItem('userToken');
    try {
      // 1. Fetch available active coupons
      const couponsRes = await fetch(`${API_BASE}/admin/promotions/coupons`);
      const couponsData = await couponsRes.json();
      if (couponsData.success) {
        setCoupons(couponsData.coupons.filter(c => c.status === 'Active'));
      }

      // 2. Fetch history of used coupons (if logged in)
      if (token) {
        const historyRes = await fetch(`${API_BASE}/admin/promotions/coupons/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const historyData = await historyRes.json();
        if (historyData.success) {
          setHistory(historyData.history);
        }
      }
    } catch (err) {
      console.error('Failed to load coupons', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouponsData();
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col font-sans pb-20">
      {/* Header */}
      <div className="bg-[#fff4f2] px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 text-[#02006c]" />
        </button>
        <h1 className="text-[17px] font-bold text-[#02006c]">My Coupons</h1>
      </div>

      {/* History List */}
      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center py-20 gap-2">
          <div className="w-8 h-8 border-4 border-[#0B132B] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-400">Loading coupons...</span>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-bold text-xs space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-200" />
              <p>No coupons redeemed yet.</p>
              <p className="text-[10px] text-slate-300 font-normal">Use a coupon on checkout to save Aramish Coins and log history!</p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="bg-surface rounded-xl shadow-sm border border-white/10 overflow-hidden flex opacity-90">
                {/* Left Tag */}
                <div className="bg-surface w-24 flex flex-col items-center justify-center p-3 text-slate-600 border-r border-dashed border-white/10 relative">
                  <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-surface"></div>
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-surface"></div>
                  <CheckCircle2 className="w-6 h-6 mb-1 text-emerald-500" />
                  <span className="text-[10px] font-black text-center leading-tight uppercase tracking-wider text-emerald-600">USED</span>
                </div>
                
                {/* Right Info */}
                <div className="flex-1 p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="bg-surface text-slate-500 border border-white/10 px-2 py-0.5 rounded font-black tracking-wide text-[11px] uppercase font-mono">
                        {item.code}
                      </span>
                      <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded">
                        {item.discount}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 mt-2">
                      Successfully applied on Order value of ₹{item.total}.
                    </p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 tracking-wider">
                    Redeemed on {formatDate(item.date)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
