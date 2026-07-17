import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Pause, Play } from 'lucide-react';

export default function GameplayScreen({ onGameEnd }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10000); // 10 seconds in ms
  const [combo, setCombo] = useState(1);
  const [taps, setTaps] = useState([]); // for ripple effects
  const [isPaused, setIsPaused] = useState(false);
  
  const lastTapTime = useRef(0);
  const scoreRef = useRef(score);
  const isPausedRef = useRef(isPaused);
  const timerRef = useRef(null);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      
      setTimeLeft((prev) => {
        const nextTime = Math.max(prev - 50, 0);
        if (nextTime === 0) {
          clearInterval(timerRef.current);
          onGameEnd(scoreRef.current);
        }
        return nextTime;
      });
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [onGameEnd]);

  const handleTap = (e) => {
    if (isPaused) return;
    // Generate ripple
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX ? e.clientX - rect.left : 150; // Fallback for synthetic events
    const y = e.clientY ? e.clientY - rect.top : 150;
    const newTap = { id: Date.now(), x, y };
    setTaps((prev) => [...prev, newTap].slice(-5)); // Keep last 5 ripples

    const now = Date.now();
    let currentCombo = combo;
    
    // Combo logic: if tapped within 300ms, increase combo up to 5x
    if (now - lastTapTime.current < 300) {
      currentCombo = Math.min(currentCombo + 1, 5);
    } else if (now - lastTapTime.current > 800) {
      currentCombo = 1; // Reset combo if too slow
    }
    
    setCombo(currentCombo);
    setScore(s => s + (1 * currentCombo));
    lastTapTime.current = now;

    // Optional: Vibration for mobile
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const formattedTime = (timeLeft / 1000).toFixed(2);
  const progressPercent = (timeLeft / 10000) * 100;

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#071226] relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Pause Button */}
      <button 
        onClick={() => setIsPaused(!isPaused)} 
        className="absolute top-6 right-6 z-20 w-10 h-10 bg-surface/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 text-white hover:bg-surface/20 transition-colors"
      >
        {isPaused ? <Play className="w-5 h-5 ml-1" fill="currentColor" /> : <Pause className="w-5 h-5" fill="currentColor" />}
      </button>

      {/* Pause Overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[15] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <h2 className="text-4xl font-black text-white tracking-tighter mb-6 drop-shadow-lg">PAUSED</h2>
            <button 
              onClick={() => setIsPaused(false)}
              className="bg-[#0B132B] text-white font-black px-10 py-4 rounded-full text-lg shadow-[0_5px_20px_rgba(255,90,31,0.5)] active:scale-95 transition-transform"
            >
              RESUME
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top HUD */}
      <div className="pt-12 px-6 flex flex-col items-center z-10">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Time Left</span>
        <div className="text-4xl font-black text-[#0B132B] font-mono tracking-tighter">
          {formattedTime}
        </div>
        
        <div className="mt-8 flex flex-col items-center">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Score</span>
          <div className="text-5xl font-black text-white">{score}</div>
          
          <AnimatePresence>
            {combo > 1 && (
              <motion.div 
                key={combo}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="mt-2 bg-[#0B132B] text-white text-xs font-black px-3 py-1 rounded-full shadow-[0_0_15px_rgba(255,90,31,0.6)]"
              >
                COMBO x{combo}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tap Area */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <motion.button
          onPointerDown={handleTap}
          whileTap={{ scale: 0.92 }}
          className="w-72 h-72 rounded-full relative flex items-center justify-center outline-none overflow-hidden"
          style={{
            background: 'radial-gradient(circle, #0B132B 0%, #D93800 100%)',
            boxShadow: `0 0 ${40 + (combo * 10)}px rgba(255, 90, 31, ${0.4 + (combo * 0.1)})`
          }}
        >
          {/* Pulsing rings */}
          <div className="absolute inset-4 rounded-full border border-white/20"></div>
          <div className="absolute inset-8 rounded-full border border-white/10"></div>
          
          <div className="text-center">
            <span className="block text-4xl font-black text-white leading-none tracking-tighter drop-shadow-md">
              TAP<br/>TAP<br/>TAP!
            </span>
          </div>

          {/* Ripples */}
          <AnimatePresence>
            {taps.map((tap) => (
              <motion.div
                key={tap.id}
                className="absolute w-20 h-20 bg-surface rounded-full pointer-events-none"
                style={{ left: tap.x - 40, top: tap.y - 40 }}
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            ))}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Progress Bar Bottom */}
      <div className="absolute bottom-10 left-6 right-6 z-10 flex items-center gap-3">
        <span className="text-[10px] text-amber-400 font-bold uppercase whitespace-nowrap flex items-center gap-1">
          <Zap className="w-3 h-3" /> Ultimate
        </span>
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-[#0B132B] rounded-full transition-all duration-75 ease-linear"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>
    </motion.div>
  );
}
