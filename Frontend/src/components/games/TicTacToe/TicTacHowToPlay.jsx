import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, X as XIcon, Circle, Trophy, Gift } from 'lucide-react';

export default function TicTacHowToPlay({ onBack }) {
  return (
    <motion.div 
      className="flex-1 flex flex-col bg-surface relative overflow-hidden"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-5 bg-surface shadow-sm z-10">
        <button onClick={onBack} className="p-1 hover:bg-surface rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-800" />
        </button>
        <span className="font-black text-sm tracking-wide uppercase text-slate-800">
          HOW TO PLAY
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        
        <div className="flex justify-center mb-10 mt-4 relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <XIcon className="w-24 h-24 text-slate-800 absolute -left-4 -top-4" />
            <Circle className="w-20 h-20 text-[#0B132B] absolute -right-4 top-4" />
          </div>
          <ShoppingBag className="w-24 h-24 text-[#071226] relative z-10" />
          <Gift className="w-16 h-16 text-[#0B132B] absolute -right-4 bottom-0 z-20" />
        </div>

        <div className="space-y-4">
          <div className="bg-surface rounded-3xl p-5 flex items-center gap-4 shadow-sm border border-white/10">
            <div className="w-12 h-12 bg-[#071226] rounded-2xl flex items-center justify-center flex-shrink-0">
              <XIcon className="w-6 h-6 text-white" strokeWidth={3} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-0.5">You are X (Dark Blue)</h4>
              <p className="text-[11px] text-slate-500 font-medium">Make a line of 3 X's horizontally, vertically or diagonally to win.</p>
            </div>
          </div>

          <div className="bg-surface rounded-3xl p-5 flex items-center gap-4 shadow-sm border border-white/10">
            <div className="w-12 h-12 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Circle className="w-6 h-6 text-[#0B132B]" strokeWidth={4} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-0.5">Opponent is O (Orange)</h4>
              <p className="text-[11px] text-slate-500 font-medium">Block your opponent from making their line of 3 O's.</p>
            </div>
          </div>

          <div className="bg-surface rounded-3xl p-5 flex items-center gap-4 shadow-sm border border-white/10">
            <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-0.5">Win & Earn Rewards</h4>
              <p className="text-[11px] text-slate-500 font-medium">Win games against the AI to earn Aramish Coins and exclusive shopping coupons.</p>
            </div>
          </div>
          
          <div className="bg-surface rounded-3xl p-5 flex items-center gap-4 shadow-sm border border-white/10">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Gift className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-0.5">Play Daily</h4>
              <p className="text-[11px] text-slate-500 font-medium">Play daily to get exciting rewards and maintain your win streak!</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 bg-surface border-t border-white/10">
        <button
          onClick={onBack}
          className="w-full bg-[#0B132B] text-white font-black text-sm py-4 rounded-2xl shadow-[0_0_20px_rgba(255,90,31,0.3)] active:scale-95 transition-all"
        >
          GOT IT!
        </button>
      </div>
    </motion.div>
  );
}
