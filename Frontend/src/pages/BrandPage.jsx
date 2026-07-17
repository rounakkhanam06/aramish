import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Star, Tag, ShoppingBag } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import OptimizedImage from '../components/ui/OptimizedImage';
import { getImageUrl } from '../utils/imageHelper';
import { formatDiscount } from '../utils/discountHelper';

export default function BrandPage() {
  const { brandId } = useParams();
  const navigate = useNavigate();

  const [brand, setBrand] = useState(null);
  const [popularProducts, setPopularProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Normalise product shape to match what ProductCard expects
  const normaliseProduct = (p) => ({
    id: p._id || p.id,
    name: p.name,
    desc: p.description || '',
    price: p.sellingPrice,
    originalPrice: p.mrp || p.sellingPrice,
    discount: formatDiscount(p.discountLabel, p.mrp, p.sellingPrice, 'minus'),
    rating: p.rating || 4.5,
    type: (p.category || '').toLowerCase(),
    image: (p.images && p.images[0]) ? p.images[0] : '',
    brandName: 'Aramish',
    flags: p.flags || {},
    stock: p.stock || 0,
    sales: p.sales || 0,
  });

  useEffect(() => {
    const fetchBrandData = async () => {
      try {
        setLoading(true);
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/catalog/brands/${brandId}/products`);
        const data = await res.json();
        
        if (res.ok && data.success) {
          setBrand(data.brand);
          const trendingOnly = (data.allProducts || [])
            .filter(p => p.isTrending === true || p.isTrending === 'true')
            .map(normaliseProduct);
          setAllProducts(trendingOnly);
          setPopularProducts([]);
        }
      } catch (err) {
        console.error('Failed to load brand data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (brandId) {
      fetchBrandData();
    }
  }, [brandId]);

  if (loading) {
    return (
      <div className="flex-grow space-y-6 pb-12 bg-surface animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-surface border-b border-slate-150 py-8">
          <div className="max-w-7xl mx-auto px-4 space-y-4">
            <div className="w-20 h-20 bg-surface rounded-2xl" />
            <div className="w-48 h-6 bg-surface rounded" />
            <div className="w-96 max-w-full h-4 bg-surface rounded" />
          </div>
        </div>

        {/* Products Horizontal Section Skeleton */}
        <div className="max-w-7xl mx-auto px-4 pt-6 space-y-4">
          <div className="w-32 h-5 bg-surface rounded" />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-40 aspect-[3/4.2] bg-surface rounded-2xl flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-20 px-4 text-center bg-surface">
        <div className="p-4 bg-red-50 text-red-500 rounded-full mb-4">
          <ShoppingBag size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Brand Not Found</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">The brand profile you are looking for does not exist or has been disabled.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-5 py-2 bg-[#0B132B] text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex-grow space-y-8 pb-16 bg-surface">
      
      {/* Brand Header Section */}
      <div className="bg-surface border-b border-white/10 py-8 relative">
        <div className="max-w-7xl mx-auto px-4">
          {/* Back Button and Info Row */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 bg-surface text-slate-700 rounded-full flex items-center justify-center hover:bg-surface hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
            </button>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Brand Page</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
            {/* Brand Logo */}
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-surface border border-white/10 p-2 flex items-center justify-center shadow-xs overflow-hidden flex-shrink-0 animate-scale-in">
              <img 
                src={getImageUrl(brand.logo)} 
                alt={`${brand.name} Logo`} 
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-2 flex-grow">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{brand.name}</h1>
                {brand.isTrending && (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white flex items-center gap-0.5 shadow-2xs">
                    <Star size={8} className="fill-current" /> Trending Brand
                  </span>
                )}
              </div>
              {brand.description && (
                <p className="text-xs md:text-sm font-medium text-slate-500 max-w-3xl leading-relaxed">
                  {brand.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        
        {/* Popular / Trending Products Horizontal List Scroll */}
        {popularProducts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-bold text-[#02006c] font-sans flex items-center gap-1.5">
                <Sparkles size={16} className="text-amber-500 fill-amber-500 animate-pulse" />
                Popular in {brand.name}
              </h3>
              <span className="text-[9.5px] bg-gold/10 border border-gold/20 text-[#0B132B] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Best Sellers
              </span>
            </div>

            <div className="flex gap-4 overflow-x-auto scrollbar-none pb-3">
              {popularProducts.map(product => (
                <div key={product.id} className="w-44 md:w-52 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Products Grid Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-lg md:text-xl font-bold text-[#02006c] font-sans flex items-center gap-1.5">
              <Sparkles size={16} className="text-amber-500 fill-amber-500 animate-pulse" />
              Trending {brand.name} Products
            </h3>
            <span className="text-[10px] text-slate-400 font-bold font-sans">
              {allProducts.length} {allProducts.length === 1 ? 'Product' : 'Products'}
            </span>
          </div>

          {allProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-white/10 rounded-2xl bg-surface space-y-2">
              <ShoppingBag size={24} className="mx-auto text-slate-350" />
              <h4 className="text-sm font-bold text-slate-600">No Products Available</h4>
              <p className="text-xs text-slate-400">We couldn't find any products listed under this brand.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
