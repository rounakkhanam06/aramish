import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Users, Gift, ShoppingBag, X as XIcon, Circle, Play } from 'lucide-react';

export default function TicTacHome({ onStart, onClose, onViewTutorial }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, staggerChildren: 0.1 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-surface relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-[#0B132B] rounded-full blur-[120px] opacity-10 pointer-events-none"></div>
      
      {/* Header */}
      <div className="flex items-center justify-between p-5 relative z-10">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-slate-800 hover:text-gold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-sm tracking-wide">Game Zone</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center pt-8 px-6 pb-8 relative z-10 overflow-y-auto w-full no-scrollbar">
        <motion.div variants={itemVariants} className="text-center space-y-1 mb-8">
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">
            TIC <span className="text-[#0B132B]">TAC</span> TOE
          </h1>
          <p className="text-slate-500 font-medium text-sm">Play. Win. Shop More!</p>
        </motion.div>

        {/* Center Graphic */}
        <motion.div variants={itemVariants} className="relative w-full h-48 flex items-center justify-center mb-10">
          <motion.div 
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute z-10"
          >
            {/* Custom SVG Illustration for Shopping Bags */}
            <svg viewBox="0 0 100 100" className="w-40 h-40 drop-shadow-xl">
              <rect x="20" y="30" width="40" height="50" rx="4" fill="#071226" />
              <path d="M30 30 V20 C30 10, 50 10, 50 20 V30" fill="none" stroke="#071226" strokeWidth="4" />
              
              <rect x="45" y="45" width="35" height="35" rx="4" fill="#0B132B" />
              <path d="M55 45 V35 C55 25, 70 25, 70 35 V45" fill="none" stroke="#0B132B" strokeWidth="3" />
              
              <circle cx="62" cy="62" r="8" fill="#FFF" />
              <path d="M59 62 L65 62 M62 59 L62 65" stroke="#0B132B" strokeWidth="2" />
            </svg>
          </motion.div>

          {/* Floating X and O */}
          <motion.div 
            animate={{ rotate: 360, y: [-10, 10, -10] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute left-[15%] top-[10%] text-slate-300"
          >
            <XIcon className="w-8 h-8" strokeWidth={4} />
          </motion.div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1], y: [10, -10, 10] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-[15%] top-[20%] text-[#0B132B]"
          >
            <XIcon className="w-6 h-6" strokeWidth={4} />
          </motion.div>
          <motion.div 
            animate={{ y: [-15, 15, -15] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-[25%] bottom-[10%] text-slate-300"
          >
            <Circle className="w-6 h-6" strokeWidth={4} />
          </motion.div>
        </motion.div>

        {/* Game Mode Cards */}
        <motion.div variants={itemVariants} className="flex gap-4 w-full mb-6">
          <div 
            onClick={() => onStart('computer')}
            className="flex-1 bg-surface border border-white/10 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center mb-3 group-hover:bg-[#071226] group-hover:text-white transition-colors">
              <User className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-wide">VS Computer</h3>
            <p className="text-[10px] text-slate-500 font-medium mb-4">Play against AI</p>
            <button className="w-full bg-[#0B132B] text-white font-black text-xs py-2.5 rounded-full shadow-[0_0_15px_rgba(255,90,31,0.3)] group-hover:scale-105 transition-transform">
              PLAY
            </button>
          </div>

          <div 
            onClick={() => onStart('friend')}
            className="flex-1 bg-surface border border-white/10 rounded-3xl p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-14 h-14 bg-gold/10 rounded-full flex items-center justify-center mb-3 text-[#0B132B] group-hover:bg-[#0B132B] group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-wide">VS Friend</h3>
            <p className="text-[10px] text-slate-500 font-medium mb-4">Challenge a friend</p>
            <button className="w-full bg-[#0B132B] text-white font-black text-xs py-2.5 rounded-full shadow-[0_0_15px_rgba(255,90,31,0.3)] group-hover:scale-105 transition-transform">
              PLAY
            </button>
          </div>
        </motion.div>

        {/* Daily Reward Card */}
        <motion.div variants={itemVariants} className="w-full">
          <div 
            onClick={onViewTutorial}
            className="w-full bg-[#071226] text-white rounded-2xl p-4 flex items-center justify-between shadow-lg cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Gift className="w-8 h-8 text-[#0B132B]" />
              <div className="text-left">
                <h4 className="font-black text-sm uppercase tracking-wider">How To Play</h4>
                <p className="text-[10px] text-slate-400 font-medium">Win games to earn rewards!</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-surface/10 px-3 py-1.5 rounded-full">
              <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-black text-amber-900">M</div>
              <span className="font-bold text-sm">50</span>
              <ArrowLeft className="w-4 h-4 rotate-180 ml-1 opacity-50" />
            </div>
          </div>
        </motion.div>
      </div>

    </motion.div>
  );
}
