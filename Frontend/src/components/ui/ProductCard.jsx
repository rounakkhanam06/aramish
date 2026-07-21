import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import OptimizedImage from './OptimizedImage';

function ProductCard({ product }) {
  const { toggleWishlist, isInWishlist, user } = useApp();
  const navigate = useNavigate();

  const getProductBrand = (type) => {
    switch (type) {
      case 'earbuds':
      case 'headphones':
      case 'powerbank':
      case 'smartwatch': return 'TechBrand';
      case 'skincare':
      case 'makeup':
      case 'tint': return 'Glow & Co';
      case 'tee':
      case 'pants':
      case 'outfit': return 'Roadster';
      default: return 'Aramish Originals';
    }
  };

  const getBadgeText = (type) => {
    switch (type) {
      case 'earbuds':
      case 'headphones': return 'Best Seller';
      case 'skincare':
      case 'makeup': return 'Top Rated';
      case 'tee':
      case 'pants':
      case 'outfit': return 'House of Brands';
      default: return 'Trending';
    }
  };

  const brandName = "Aramish";

  let baseSellingPrice = product.price || product.sellingPrice;
  let baseMrp = product.originalPrice || product.mrp;
  
  // Handle swapped prices dynamically (if MRP < SellingPrice in DB, swap them)
  if (baseMrp && baseMrp < baseSellingPrice) {
      const temp = baseMrp;
      baseMrp = baseSellingPrice;
      baseSellingPrice = temp;
  }

  let minPrice = baseSellingPrice;
  let hasDifferentPrices = false;
  
  if (product.variations && product.variations.length > 0) {
     const prices = product.variations.map(v => v.useDefaultPricing ? baseSellingPrice : v.sellingPrice).filter(Boolean);
     if (prices.length > 0) {
        minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        hasDifferentPrices = minPrice !== maxPrice;
     }
  }

  const displaySellingPrice = minPrice;
  const displayMrp = baseMrp;

  // Format discount nicely (especially if it is a decimal like 0.38)
  const displayDiscount = (() => {
    const rawDiscount = product.discount;
    if (!rawDiscount) return '-10% OFF';
    
    const parsed = parseFloat(rawDiscount);
    if (!isNaN(parsed) && parsed > 0 && parsed < 1) {
      return `-${Math.round(parsed * 100)}% OFF`;
    }
    
    const cleanStr = String(rawDiscount).replace('-', '').replace('%', '').trim();
    if (cleanStr && !isNaN(cleanStr)) {
      return `-${cleanStr}% OFF`;
    }
    
    // Ensure it starts with a minus sign if it doesn't already
    let res = String(rawDiscount);
    if (!res.startsWith('-')) {
      res = '-' + res;
    }
    return res;
  })();

  return (
    <div 
      onClick={() => navigate(`/product/${product._id || product.id}`)}
      className={`flex flex-col group cursor-pointer w-full bg-surface rounded-xl shadow-xs hover:shadow-md border border-white/10 overflow-hidden transition-shadow duration-300 ${product.stock === 0 ? 'opacity-70 grayscale' : ''}`}
    >
      {/* Image container */}
      <div className={`relative aspect-square w-full bg-surface overflow-hidden flex items-center justify-center ${product.stock === 0 ? 'grayscale' : ''}`}>
        <OptimizedImage
          src={product.image || (product.images && product.images[0]) || ''}
          alt={product.name}
          type="product"
          objectFit="contain"
          className="absolute inset-0 w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        
        {/* Out of Stock Overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[0.5px] flex items-center justify-center z-25">
            <span className="bg-red-650 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full shadow-md border border-red-500">
              Out of Stock
            </span>
          </div>
        )}
        
        {/* Top Left Badge */}
        <div className="absolute top-0 left-0 bg-[#0B132B] text-white text-[12px] font-logo px-2.5 py-1 rounded-br-lg shadow-sm z-10 tracking-wider">
          {brandName}
        </div>

        {/* Top Right Wishlist Button */}
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!user) {
              navigate('/login');
              return;
            }
            toggleWishlist(product);
          }}
          className="absolute top-2 right-2 w-7 h-7 bg-surface/90 hover:bg-surface text-slate-600 rounded-full flex items-center justify-center shadow-sm z-10 transition-all hover:scale-110 active:scale-95 cursor-pointer"
        >
          <Heart className={`w-3.5 h-3.5 ${isInWishlist(product._id || product.id) ? 'fill-[#FF4500] text-[#FF4500]' : 'text-slate-600'}`} />
        </button>

        {/* Bottom Left Rating Pill */}
        <div className="absolute bottom-2 left-2 bg-surface/95 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm z-10">
          <span className="text-[10px] font-bold text-slate-800">{product.rating}</span>
          <Star className="w-2.5 h-2.5 text-teal-600 fill-current" />
          <div className="w-px h-2.5 bg-surface mx-0.5"></div>
          <span className="text-[9px] font-medium text-slate-600">{product.sales || 0}</span>
        </div>
      </div>

      {/* Info Section */}
      <div className="flex flex-col w-full p-1.5 pt-1 bg-surface">
        
        {/* Title */}
        <div className="flex items-start justify-between gap-1 h-4.5 overflow-hidden">
          <h3 className="text-xs md:text-sm font-bold text-slate-800 truncate leading-tight w-full">
            {product.name}
          </h3>
        </div>
        
        {/* Description / Product Name */}
        <div className="h-4 overflow-hidden mt-0.5">
          <p className="text-[14px] md:text-[15px] text-[#0B132B] truncate w-full font-logo">
            Aramish
          </p>
        </div>

        {/* Prices */}
        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap leading-none h-4.5 overflow-hidden">
          <span className="text-xs md:text-[14px] font-black text-slate-800">
            {hasDifferentPrices ? 'From ' : ''}₹{displaySellingPrice}
          </span>
          {displayMrp && displayMrp > displaySellingPrice && (
            <span className="text-[10px] md:text-[11px] text-slate-400 line-through">₹{displayMrp}</span>
          )}
        </div>

        {/* Discount Line */}
        <div className="mt-0.5 text-[9px] md:text-[9.5px] font-bold text-[#FF7A45] leading-tight h-3.5 overflow-hidden">
          {displayDiscount}
        </div>
        
      </div>
    </div>
  );
}

// Only re-render when the product id or stock/wishlist state changes
export default memo(ProductCard, (prev, next) => (prev.product._id || prev.product.id) === (next.product._id || next.product.id) && prev.product.stock === next.product.stock);
