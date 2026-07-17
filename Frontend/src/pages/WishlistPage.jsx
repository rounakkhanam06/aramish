import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Heart, ChevronLeft, ShoppingBag } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import shoppingBagAnimation from '../assets/Lotties/Shopping bag.json';

export default function WishlistPage() {
  const { wishlist } = useApp();
  const navigate = useNavigate();

  return (
    <div className="flex-grow flex flex-col bg-surface min-h-screen select-none">
      {/* Elevated Sticky Header (Mobile Only) */}
      <header className="sticky top-0 bg-gold/10 border-b border-gold/20 px-4 py-3 flex items-center justify-between z-40 md:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-1 bg-surface hover:bg-gold/10 border border-white/10 rounded-full shadow-sm transition-colors active:scale-95 cursor-pointer text-[#02006c]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 -ml-1">
            <Lottie animationData={shoppingBagAnimation} loop={true} className="w-10 h-10" />
            <div className="flex flex-col justify-center">
              <h1 className="text-sm font-black text-[#02006c] tracking-wide uppercase font-sans flex items-center gap-1.5 leading-tight">
                My Picks
                <Heart className="w-3.5 h-3.5 text-[#0B132B] fill-current" />
              </h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest font-sans leading-tight">
                Saved Treasures
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-[#0B132B]/10 text-[#0B132B] px-2.5 py-0.5 rounded-full border border-[#0B132B]/15">
          <span className="text-[8.5px] font-bold uppercase tracking-wider">{wishlist.length} Items</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto w-full p-4 md:px-6 lg:px-8 py-6 md:py-10 space-y-6 pb-24 flex-grow animate-fade-in">
        <h2 className="hidden md:block text-xl font-black text-[#02006c] uppercase tracking-wide border-b border-white/10 pb-3.5 mb-4">
          My Wishlist ({wishlist.length} {wishlist.length === 1 ? 'item' : 'items'})
        </h2>

        <AnimatePresence mode="popLayout">
          {wishlist.length > 0 ? (
            <motion.div 
              layout
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
            >
              {wishlist.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-surface border border-white/10 rounded-3xl p-12 text-center space-y-4 max-w-md mx-auto shadow-3xs mt-12 animate-scale-in"
            >
              <div className="w-16 h-16 bg-rose-50 text-[#0B132B] rounded-full flex items-center justify-center mx-auto shadow-md shadow-rose-500/10">
                <Heart className="w-8 h-8 animate-pulse fill-current text-[#0B132B]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-[#02006c] font-syne">Your wishlist is empty</h4>
                <p className="text-[10px] md:text-xs text-slate-400 font-medium leading-relaxed font-sans max-w-[280px] mx-auto">
                  Start browsing our collections and click the heart icon on your favorite gifts to save them here.
                </p>
              </div>

              <button
                onClick={() => navigate('/')}
                className="bg-[#0B132B] hover:bg-gold active:scale-95 text-white text-[10px] font-black px-6 py-3.5 rounded-xl shadow-md shadow-gold/25 transition-all duration-300 font-sans cursor-pointer"
              >
                EXPLORE PRODUCTS
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
