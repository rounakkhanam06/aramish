import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function CountdownScreen({ onComplete }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onComplete();
    }
  }, [count, onComplete]);

  return (
    <motion.div 
      className="flex-1 flex flex-col items-center justify-center bg-[#071226] p-6 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
    >
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-[#0B132B] rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              opacity: Math.random() * 0.5 + 0.2
            }}
            animate={{ 
              y: [null, Math.random() * window.innerHeight],
              opacity: [null, 0]
            }}
            transition={{ 
              duration: Math.random() * 2 + 1, 
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      <h2 className="text-xl font-bold tracking-widest text-white uppercase mb-12 z-10">Get Ready!</h2>
      
      <div className="relative flex items-center justify-center w-64 h-64 z-10">
        {/* Animated Ring */}
        <motion.svg 
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 100 100"
        >
          <circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="#1E293B" 
            strokeWidth="4" 
          />
          <motion.circle 
            cx="50" cy="50" r="45" 
            fill="none" 
            stroke="#0B132B" 
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3, ease: "linear" }}
          />
        </motion.svg>

        {/* Number */}
        <AnimateNumber key={count} number={count} />
      </div>

      <p className="text-slate-400 mt-12 font-medium z-10">Game starts in...</p>
    </motion.div>
  );
}

function AnimateNumber({ number }) {
  if (number === 0) return null;
  return (
    <motion.span 
      className="text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(255,90,31,0.5)]"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 10 }}
    >
      {number}
    </motion.span>
  );
}
