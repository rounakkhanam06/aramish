import React, { useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight, Wallet, ShoppingBag } from 'lucide-react';
import CoinDrop from '../components/ui/CoinDrop';

export default function OrderSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const order = location.state?.order;

  // If no order data is in state, redirect to home or orders
  if (!order) {
    return <Navigate to="/orders" replace />;
  }

  const expectedCoins = order.rewardCoinsExpected || order.rewardCoinsAmount || 0;

  return (
    <div className="bg-surface min-h-screen font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      <CoinDrop count={30} />
      
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-emerald-100 flex flex-col items-center text-center animate-scale-up relative z-10">
        
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-inner animate-pulse">
          <CheckCircle2 className="w-14 h-14 text-emerald-600" />
        </div>
        
        <h1 className="text-3xl font-black text-[#02006c] mb-2 tracking-tight">Order Placed!</h1>
        <p className="text-slate-500 font-medium mb-6">
          Yay! Your order <span className="font-bold text-slate-800">#{order._id?.slice(-6).toUpperCase() || order.id?.slice(-6).toUpperCase()}</span> has been placed successfully.
        </p>

        {expectedCoins > 0 && (
          <div className="w-full bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/60 rounded-2xl p-5 mb-8 shadow-sm">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <span className="text-2xl animate-bounce">🪙</span>
              </div>
            </div>
            <h3 className="text-lg font-extrabold text-amber-900 mb-1">
              You earned <span className="text-2xl text-amber-600">{expectedCoins}</span> Coins!
            </h3>
            <p className="text-xs text-amber-700/80 font-semibold leading-relaxed">
              Coins will be credited once order is Delivered
            </p>
          </div>
        )}

        <div className="flex flex-col w-full gap-3 mt-2">
          <button
            onClick={() => navigate('/orders', { replace: true })}
            className="w-full py-4 bg-[#0B132B] text-white rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-[#02006c] active:scale-95 transition-all shadow-md"
          >
            <Package className="w-5 h-5" />
            Track My Order
          </button>
          
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-4 bg-slate-50 text-slate-700 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-slate-100 active:scale-95 transition-all border border-slate-200"
          >
            <ShoppingBag className="w-5 h-5" />
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
