import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Lock, Coins, Percent, Truck, Gift, Zap } from 'lucide-react';

export default function RewardsScreen({ bestScore, onBack }) {
  const milestones = [
    { target: 20, reward: "5 Coins", icon: <Coins className="w-5 h-5 text-amber-500" />, unlocked: bestScore >= 20 },
    { target: 40, reward: "10% OFF", icon: <Percent className="w-5 h-5 text-[#0B132B]" />, unlocked: bestScore >= 40 },
    { target: 60, reward: "Free Shipping", icon: <Truck className="w-5 h-5 text-blue-500" />, unlocked: bestScore >= 60 },
    { target: 80, reward: "Mystery Box", icon: <Gift className="w-5 h-5 text-rose-500" />, unlocked: bestScore >= 80 },
    { target: 100, reward: "Premium Coupon", icon: <Zap className="w-5 h-5 text-purple-500" />, unlocked: bestScore >= 100 },
  ];

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#F8FAFC] text-slate-900"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="flex items-center gap-4 p-4 bg-surface shadow-sm relative z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-surface transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-black tracking-wide text-slate-800">REWARDS</h1>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="bg-surface rounded-2xl shadow-sm border border-white/10 p-2 space-y-2">
          {milestones.map((m, idx) => (
            <div 
              key={idx} 
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                m.unlocked 
                  ? 'border-white/10 bg-surface' 
                  : 'border-white/10 bg-surface opacity-70'
              }`}
            >
              <div className="w-12 text-center">
                <span className={`text-lg font-black ${m.unlocked ? 'text-[#0B132B]' : 'text-slate-400'}`}>
                  {m.target}+
                </span>
                <span className="block text-[9px] font-bold text-slate-400 uppercase">Taps</span>
              </div>
              
              <div className="flex-1 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${m.unlocked ? 'bg-gold/10' : 'bg-surface'}`}>
                  {m.icon}
                </div>
                <span className={`font-bold ${m.unlocked ? 'text-slate-800' : 'text-slate-500'}`}>
                  {m.reward}
                </span>
              </div>

              <div>
                {m.unlocked ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <Lock className="w-5 h-5 text-slate-300" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-gold/10 border border-gold/20 rounded-2xl p-4 flex items-center gap-4">
          <Gift className="w-8 h-8 text-[#0B132B]" />
          <div>
            <h4 className="font-bold text-slate-800">Tap more, win more!</h4>
            <p className="text-xs font-medium text-slate-500">Better score = Better rewards</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
