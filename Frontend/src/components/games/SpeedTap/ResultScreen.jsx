import React from 'react';
import { motion } from 'framer-motion';
import { Percent, Gift, Trophy, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ResultScreen({ score, bestScore, onPlayAgain, onClose, claimReward, onViewRewards }) {
  const isNewBest = score > bestScore;

  React.useEffect(() => {
    // Trigger confetti burst on load
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#0B132B', '#FBBF24', '#FFFFFF']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#0B132B', '#FBBF24', '#FFFFFF']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  // Determine reward unlocked based on score
  let rewardText = "5 Coins Unlocked!";
  let rewardIcon = <Trophy className="w-8 h-8 text-amber-400" />;
  let rewardAmount = 5;

  if (score >= 100) {
    rewardText = "Premium Coupon Unlocked!";
    rewardAmount = 100;
    rewardIcon = <Zap className="w-8 h-8 text-[#0B132B]" />;
  } else if (score >= 80) {
    rewardText = "Mystery Box Unlocked!";
    rewardAmount = 80;
    rewardIcon = <Gift className="w-8 h-8 text-rose-500" />;
  } else if (score >= 40) {
    rewardText = "10% OFF Coupon Unlocked!";
    rewardAmount = 40;
    rewardIcon = <Percent className="w-8 h-8 text-[#0B132B]" />;
  }

  const handleClaim = () => {
    claimReward(rewardAmount);
    onViewRewards();
  };

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#071226] p-6 relative overflow-hidden text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="pt-10 z-10">
        <h2 className="text-xl font-bold tracking-widest text-white uppercase mb-4">Time's Up!</h2>
        
        <span className="text-[12px] text-slate-400 font-bold uppercase tracking-widest">Score</span>
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
          className="text-8xl font-black text-[#0B132B] drop-shadow-[0_0_20px_rgba(255,90,31,0.5)] leading-none mt-2"
        >
          {score}
        </motion.div>

        {isNewBest && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-amber-400 font-bold mt-2 animate-pulse flex items-center justify-center gap-1"
          >
            NEW BEST SCORE! 🔥
          </motion.div>
        )}
      </div>

      {/* Reward Card */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-12 bg-surface text-slate-800 rounded-3xl p-6 relative z-10 shadow-[0_0_30px_rgba(255,255,255,0.1)] mx-2"
      >
        <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">Your Reward</span>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center shadow-inner">
            {rewardIcon}
          </div>
          <div className="text-left flex-1">
            <h3 className="text-2xl font-black text-[#0B132B] leading-none mb-1">{rewardText.split(' ')[0]} {rewardText.split(' ')[1]}</h3>
            <p className="text-sm font-bold text-slate-600 leading-none">{rewardText.split(' ').slice(2).join(' ')}</p>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-auto pt-6 z-10 w-full space-y-3 mb-4"
      >
        <button
          onClick={handleClaim}
          className="w-full bg-[#0B132B] text-white font-black text-lg py-4 rounded-2xl shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] active:scale-95 transition-all"
        >
          CLAIM REWARD
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-surface/10 text-white border border-white/20 font-bold text-sm py-4 rounded-2xl hover:bg-surface/20 active:scale-95 transition-all backdrop-blur-sm"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-surface/10 text-white border border-white/20 font-bold text-sm py-4 rounded-2xl hover:bg-surface/20 active:scale-95 transition-all backdrop-blur-sm"
          >
            QUIT
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
