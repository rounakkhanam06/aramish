import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Gift, ShoppingBag, Percent, Zap } from 'lucide-react';

export default function IntroScreen({ bestScore, onStart, onClose, onViewRewards }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { duration: 0.5, staggerChildren: 0.1 } 
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#071226] p-6 relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#0B132B] rounded-full blur-[100px] opacity-20"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20"></div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-surface/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-surface/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="bg-[#0B132B]/20 border border-[#0B132B]/50 px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-md">
          <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-black text-amber-900">M</div>
          <span className="text-sm font-bold text-white">350</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 space-y-8 mt-8">
        
        {/* Floating Icons */}
        <div className="relative w-full h-40 flex items-center justify-center">
          <motion.div 
            animate={{ y: [-10, 10, -10], rotate: [-5, 5, -5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-[10%] top-[20%] text-[#0B132B]"
          >
            <Percent className="w-10 h-10 drop-shadow-[0_0_15px_rgba(255,90,31,0.5)]" />
          </motion.div>
          
          <motion.div 
            animate={{ y: [10, -10, 10], rotate: [5, -5, 5] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-[10%] top-[10%] text-amber-400"
          >
            <Gift className="w-12 h-12 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
          </motion.div>
          
          <motion.div 
            animate={{ y: [-15, 15, -15] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-[20%] bottom-0 text-white opacity-80"
          >
            <ShoppingBag className="w-16 h-16 drop-shadow-lg" />
          </motion.div>
          
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute z-10"
          >
            <Zap className="w-24 h-24 text-[#0B132B] drop-shadow-[0_0_30px_rgba(255,90,31,0.8)] fill-[#0B132B]" />
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="space-y-2">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-md flex flex-col">
            <span className="text-[#0B132B]">Speed Tap</span>
            <span>Challenge</span>
          </h1>
          <p className="text-slate-300 font-medium">Tap as fast as you can in 10 seconds!</p>
        </motion.div>

        {/* Info Cards */}
        <motion.div variants={itemVariants} className="flex gap-4 w-full px-4">
          <div 
            className="flex-1 bg-surface/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 backdrop-blur-sm"
          >
            <Trophy className="w-6 h-6 text-amber-400 mb-1" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Best Score</span>
            <span className="text-2xl font-black text-[#0B132B]">{bestScore}</span>
          </div>
          
          <div 
            onClick={onViewRewards}
            className="flex-1 bg-surface/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-surface/10 transition-colors backdrop-blur-sm"
          >
            <Percent className="w-6 h-6 text-[#0B132B] mb-1" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Rewards</span>
            <span className="text-sm font-bold text-white mt-1 underline decoration-[#0B132B] decoration-2 underline-offset-4">View All</span>
          </div>
        </motion.div>
      </div>

      {/* Action Button */}
      <motion.div variants={itemVariants} className="mt-auto pt-6 z-10 w-full px-4 mb-4">
        <button
          onClick={onStart}
          className="w-full bg-[#0B132B] text-white font-black text-xl py-4 rounded-2xl shadow-[0_0_40px_rgba(255,90,31,0.4)] hover:shadow-[0_0_60px_rgba(255,90,31,0.6)] active:scale-95 transition-all"
        >
          START GAME
        </button>
      </motion.div>
    </motion.div>
  );
}
