  import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Gift, ArrowLeft, RotateCcw, Home, ShoppingBag, Percent, ShoppingCart, User, Gamepad2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getImageUrl } from '../../../utils/imageHelper';

export default function QuizResult({ score, total, onPlayAgain, onClose, addCoins }) {
  const coinsEarned = score * 10;
  const isPerfect = score === total;

  const coinsAddedRef = React.useRef(false);

  useEffect(() => {
    // Confetti explosion
    const duration = 2500;
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
    
    // Automatically add coins for playing - ensuring it only happens once
    if (addCoins && !coinsAddedRef.current) {
      coinsAddedRef.current = true;
      addCoins(coinsEarned);
    }
  }, [coinsEarned, addCoins]);

  // Mock Recommended Products
  const recommendedProducts = [
    {
      brand: "GLOW CARE",
      name: "Hydrating Moisturizer",
      discount: "10%",
      price: 449,
      oldPrice: 499,
      image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=200&auto=format&fit=crop"
    },
    {
      brand: "GLOW CARE",
      name: "Hyaluronic Serum",
      discount: "15%",
      price: 594,
      oldPrice: 699,
      image: "https://images.unsplash.com/photo-1629198688000-71f23e745b6e?q=80&w=200&auto=format&fit=crop"
    },
    {
      brand: "GLOW CARE",
      name: "Gentle Face Wash",
      discount: "10%",
      price: 269,
      oldPrice: 299,
      image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=200&auto=format&fit=crop"
    }
  ];

  return (
    <motion.div 
      className="flex-1 flex flex-col bg-[#FFF6F2] relative overflow-hidden"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Top Celebration Area (Dark) */}
      <div className="bg-[#071226] text-white pt-8 pb-10 px-5 rounded-b-[2rem] relative z-20 shadow-xl flex flex-col items-center">
        
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4 absolute top-4 left-0 px-4 z-30">
          <button onClick={onClose} className="p-1 hover:bg-surface/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <span className="font-bold text-sm tracking-wide">Quiz <span className="text-[#0B132B]">Game</span></span>
          <div className="w-8 h-8"></div> {/* spacer */}
        </div>

        {/* Decorative Background */}
        <div className="absolute inset-0 overflow-hidden rounded-b-[2rem] pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#0B132B] rounded-full blur-[80px] opacity-20"></div>
          
          {/* Confetti specs static */}
          {[...Array(8)].map((_, i) => (
             <div 
               key={i} 
               className="absolute w-2 h-4 bg-[#0B132B] rounded-sm opacity-60 rotate-45"
               style={{
                 left: `${Math.random() * 100}%`,
                 top: `${Math.random() * 100}%`,
                 transform: `rotate(${Math.random() * 360}deg)`
               }}
             />
          ))}
        </div>

        <motion.div 
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
          className="relative z-10 mt-8 mb-4"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-amber-300 to-amber-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.3)]">
            <Trophy className="w-12 h-12 text-white" fill="currentColor" />
          </div>
        </motion.div>

        <h2 className="text-3xl font-black mb-1 z-10">{isPerfect ? 'Perfect Score!' : 'Great Job!'}</h2>
        <p className="text-slate-300 font-medium text-sm z-10">You answered {score} out of {total} correctly</p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-6 pb-32">
        
        {/* You Earned Section */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-[1px] bg-surface flex-1"></div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">You Earned</span>
            <div className="h-[1px] bg-surface flex-1"></div>
          </div>
          
          <div className="flex gap-4">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex-1 bg-surface rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm border border-white/10"
            >
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center mb-2">
                <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-[12px] font-black text-amber-900 shadow-inner">M</div>
              </div>
              <span className="text-2xl font-black text-slate-800 leading-none">{coinsEarned}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Coins</span>
            </motion.div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex-1 bg-surface rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm border border-white/10"
            >
              <div className="w-10 h-10 rounded-full bg-[#0B132B]/10 flex items-center justify-center mb-2">
                <Percent className="w-5 h-5 text-[#0B132B]" />
              </div>
              <span className="text-xl font-black text-slate-800 leading-none">10%</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1 text-center leading-tight">Off Coupon</span>
            </motion.div>
          </div>
        </div>

        {/* Today's Streak */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-[#071226] rounded-3xl p-5 mb-8 shadow-lg relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-4 relative z-10">
            <h3 className="font-bold text-white text-sm">Today's Streak</h3>
            <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
              2 Days <span className="text-lg">🔥</span>
            </span>
          </div>
          
          <div className="flex justify-between relative z-10">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <div key={day} className="flex flex-col items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] ${
                  day <= 2 
                    ? 'bg-[#0B132B] text-white shadow-[0_0_10px_rgba(238,73,35,0.5)]' 
                    : day === 7 
                      ? 'bg-[#1a2a47] text-[#0B132B]' 
                      : 'bg-[#1a2a47] text-slate-500'
                }`}>
                  {day <= 2 ? '✓' : day === 7 ? <Gift className="w-3 h-3" /> : '✓'}
                </div>
                <span className="text-[9px] font-medium text-slate-400">Day {day}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recommended For You */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-800 text-sm">Recommended for You</h3>
            <button className="text-[10px] font-bold text-[#0B132B] border border-[#0B132B] px-3 py-1 rounded-full uppercase tracking-wide">
              View All
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar -mx-5 px-5">
            {recommendedProducts.map((prod, idx) => (
              <div key={idx} className="min-w-[140px] snap-start bg-surface rounded-2xl p-3 shadow-sm border border-white/10 flex flex-col">
                <div className="relative w-full aspect-square bg-surface rounded-xl mb-3 flex items-center justify-center p-2">
                  <span className="absolute top-2 left-2 bg-[#0B132B] text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm">
                    {prod.discount} OFF
                  </span>
                  <img src={getImageUrl(prod.image)} alt={prod.name} className="w-full h-full object-cover rounded-lg drop-shadow-sm mix-blend-multiply" />
                </div>
                <div className="flex-1">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase">{prod.brand}</span>
                  <h4 className="text-[11px] font-bold text-slate-800 leading-tight mb-2 h-8 overflow-hidden">{prod.name}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-slate-800">₹{prod.price}</span>
                    <span className="text-[10px] text-slate-400 line-through">₹{prod.oldPrice}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Action Button */}
      <div className="absolute bottom-20 left-0 right-0 p-5 bg-gradient-to-t from-[#FFF6F2] via-[#FFF6F2] to-transparent z-20">
        <button
          onClick={onPlayAgain}
          className="w-full bg-[#0B132B] text-white font-black text-sm py-4 rounded-2xl shadow-[0_0_20px_rgba(238,73,35,0.4)] hover:shadow-[0_0_30px_rgba(238,73,35,0.6)] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          Play Another Quiz
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Navbar (Mock) */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-surface border-t border-white/10 flex items-center justify-around px-2 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <Home className="w-5 h-5" />
          <span className="text-[8px] font-bold">Home</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[8px] font-bold">Cart</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[#0B132B]">
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[8px] font-bold">Games</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <User className="w-5 h-5" />
          <span className="text-[8px] font-bold">Account</span>
        </div>
      </div>
    </motion.div>
  );
}
