import React from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CRAZY_DEALS } from '../data/mockData';
import OptimizedImage from '../components/ui/OptimizedImage';

export default function SimilarProductsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-[#FFE4D6] px-4 py-4 flex items-center gap-3 shadow-sm z-50 sticky top-0">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 hover:bg-gold/10 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#02006c]" />
        </button>
        <h1 className="text-[#02006c] text-[18px] font-black tracking-tight">Similar Products</h1>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {CRAZY_DEALS.map((deal) => (
          <div 
            key={deal.id} 
            onClick={() => navigate(`/product/${deal.id}`)}
            className="bg-surface flex flex-col items-center pt-0 px-0 pb-3 cursor-pointer hover:shadow-md transition-all shadow-sm"
          >
            <div className="w-full aspect-square bg-surface mb-2 flex items-center justify-center overflow-hidden relative">
              <OptimizedImage src={deal.image} alt={deal.name} type="product" objectFit="contain" className="absolute inset-0" />
            </div>
            <h3 className="text-[12px] font-medium text-slate-600 text-center tracking-wide mt-1" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              {deal.name}
            </h3>
            <p className="text-[10px] text-emerald-600 mt-1 text-center font-medium tracking-wide px-1 line-clamp-1" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              {deal.id === 'deal-4' ? 'Widest Range' : 'Best Selling Products'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
