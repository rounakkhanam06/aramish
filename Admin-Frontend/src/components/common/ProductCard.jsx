import React from 'react';
import { Heart } from 'lucide-react';
import OptimizedImage from './OptimizedImage';

const ProductCard = ({ product }) => {
  return (
    <div className="bg-white rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer border border-slate-100 flex flex-col h-full">
      <div className="relative aspect-square overflow-hidden bg-white p-4">
        <OptimizedImage
          src={product.image}
          alt={product.title}
          type="product"
          objectFit="contain"
          className="w-full h-full group-hover:scale-105 transition-transform duration-500"
        />
        <button className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full text-slate-300 hover:text-red-500 transition-colors shadow-sm">
          <Heart size={18} />
        </button>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug min-h-[40px]" title={product.title}>
          {product.title}
        </h3>

        <div className="mt-2 flex items-center gap-2">
          <div className="bg-[#e47911] text-white text-[10px] px-1.5 py-0.5 rounded flex items-center font-bold">
            {product.rating || "4.2"} ★
          </div>
          <span className="text-slate-400 text-xs font-medium">({product.reviews || "120"})</span>
        </div>

        <div className="mt-3 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-slate-900">₹{product.price}</span>
            {product.oldPrice && (
              <span className="text-xs text-slate-400 line-through">₹{product.oldPrice}</span>
            )}
            <span className="text-[#b12704] text-xs font-bold">
              {Math.round(((parseInt(product.oldPrice?.replace(/,/g, '')) - parseInt(product.price?.replace(/,/g, ''))) / parseInt(product.oldPrice?.replace(/,/g, ''))) * 100)}% off
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-[#e47911] font-bold">Prime</span> Get it by Tomorrow
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
