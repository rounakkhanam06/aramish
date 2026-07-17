import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ShoppingBag, X as XIcon, Circle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function TicTacResult({ result, mode, onPlayAgain, onHome, claimReward }) {
  const isWin = result?.winner === 'X';
  const isLoss = result?.winner === 'O' && mode === 'computer';
  const isDraw = result?.winner === 'Draw';

  useEffect(() => {
    if (isWin || (result?.winner === 'O' && mode === 'friend')) {
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#0B132B', '#FBBF24', '#FFFFFF', '#071226']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#0B132B', '#FBBF24', '#FFFFFF', '#071226']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [isWin, result?.winner, mode]);

  const handleReward = () => {
    if (isWin) claimReward(100);
    else if (isDraw) claimReward(10);
    onPlayAgain();
  };

  const handleHome = () => {
    if (isWin) claimReward(100);
    else if (isDraw) claimReward(10);
    onHome();
  };

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#071226] p-6 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#0B132B] rounded-full blur-[100px] opacity-20"></div>
        
        {/* Floating elements */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-8 bg-surface/10 rounded-full rotate-45"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
            }}
            animate={{ 
              y: [null, Math.random() * window.innerHeight],
            }}
            transition={{ 
              duration: Math.random() * 5 + 3, 
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 pt-10">
        
        {/* Top Trophy/Icon */}
        <motion.div 
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
          className="mb-8 relative"
        >
          {isWin ? (
            <Trophy className="w-24 h-24 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" />
          ) : isDraw ? (
            <div className="w-24 h-24 flex items-center justify-center gap-2">
              <XIcon className="w-12 h-12 text-slate-400" />
              <Circle className="w-10 h-10 text-slate-400" />
            </div>
          ) : (
            <Circle className="w-24 h-24 text-[#0B132B] drop-shadow-[0_0_20px_rgba(255,90,31,0.6)]" />
          )}
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center pointer-events-none">
             <div className="bg-[#0B132B] text-white px-6 py-2 rounded-lg font-black text-2xl uppercase tracking-widest shadow-lg -rotate-6 transform scale-110 whitespace-nowrap border-b-4 border-orange-700">
               {isWin ? 'YOU WIN!' : isDraw ? 'IT\'S A TIE!' : 'YOU LOSE!'}
             </div>
          </div>
        </motion.div>
        
        <p className="text-slate-300 font-bold mb-10 text-sm mt-4">
          {isWin ? 'Great Move!' : isDraw ? 'Good effort! Try again.' : 'Better luck next time!'}
        </p>

        {/* Small Game Board Representation */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="w-40 aspect-square bg-surface rounded-2xl p-2 relative shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-10"
        >
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-full h-full relative z-10">
            {/* Just decorative dots representing board */}
            {[...Array(9)].map((_, idx) => (
              <div key={idx} className="bg-surface rounded-lg flex items-center justify-center">
                 {result?.combo?.includes(idx) && (
                   result.winner === 'X' ? <XIcon className="w-6 h-6 text-[#071226]" strokeWidth={3} /> : <Circle className="w-5 h-5 text-[#0B132B]" strokeWidth={4} />
                 )}
              </div>
            ))}
          </div>
          {/* Winning Line Overlay */}
          {result?.combo?.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ padding: '8px' }}>
              <line
                x1={`${(result.combo[0] % 3) * 33.33 + 16.66}%`}
                y1={`${Math.floor(result.combo[0] / 3) * 33.33 + 16.66}%`}
                x2={`${(result.combo[2] % 3) * 33.33 + 16.66}%`}
                y2={`${Math.floor(result.combo[2] / 3) * 33.33 + 16.66}%`}
                stroke={result.winner === 'X' ? "#071226" : "#0B132B"}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </motion.div>

        {/* Reward Section */}
        {(isWin || isDraw) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="w-full bg-[#1a2a47] rounded-3xl p-5 flex items-center justify-between border border-[#2a3a57] shadow-xl"
          >
            <div className="text-left">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">You Earned</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-[12px] font-black text-amber-900">M</div>
                <span className="text-3xl font-black text-amber-400">{isWin ? '100' : '10'}</span>
              </div>
            </div>
            
            {isWin && (
              <div className="bg-surface text-slate-800 px-4 py-3 rounded-2xl flex items-center gap-3">
                <ShoppingBag className="w-6 h-6 text-slate-700" />
                <div className="text-left">
                  <span className="block font-black text-sm leading-none">10% OFF</span>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">COUPON</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Action Buttons */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-auto pt-6 z-10 w-full flex gap-4"
      >
        <button
          onClick={handleReward}
          className="flex-1 bg-surface text-slate-800 font-black text-sm py-4 rounded-2xl hover:bg-surface active:scale-95 transition-all"
        >
          PLAY AGAIN
        </button>
        <button
          onClick={handleHome}
          className="flex-1 bg-[#0B132B] text-white font-black text-sm py-4 rounded-2xl shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] active:scale-95 transition-all"
        >
          BACK TO HOME
        </button>
      </motion.div>
    </motion.div>
  );
}
