import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 text-center select-none font-sans bg-surface animate-fade-in">
      <div className="relative mb-6">
        <div className="text-8xl md:text-9xl font-black text-slate-200">404</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <ShoppingBag className="w-16 h-16 text-[#02006c] animate-bounce" />
        </div>
      </div>
      
      <h2 className="text-2xl font-black text-[#02006c] mb-2 nunito-heading">
        LOOKS LIKE YOU'RE LOST
      </h2>
      <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed font-semibold">
        The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.
      </p>

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-3 bg-[#0B132B] hover:bg-[#02006c] active:scale-98 text-white text-sm font-black uppercase rounded-xl shadow-md transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shopping
      </button>
    </div>
  );
}
