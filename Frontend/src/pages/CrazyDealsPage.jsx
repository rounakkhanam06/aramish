import React, { useState, useEffect } from 'react';
import { Heart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import OptimizedImage from '../components/ui/OptimizedImage';
import { cachedFetch } from '../utils/apiCache';
import { getImageUrl } from '../utils/imageHelper';
import { formatDiscount } from '../utils/discountHelper';

export default function CrazyDealsPage() {
  const navigate = useNavigate();
  const { toggleWishlist, isInWishlist, user } = useApp();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDeals = async () => {
      try {
        const data = await cachedFetch('/admin/catalog/products?status=Approved', { ttl: 300, signal: controller.signal });
        if (data.success && data.products) {
          const crazy = data.products.filter(p => p.flags?.crazyDeals);
          setDeals(crazy.map(p => ({
            id: p._id || p.id,
            name: p.name,
            desc: p.description || '',
            price: p.sellingPrice,
            originalPrice: p.mrp || p.sellingPrice,
            discount: formatDiscount(p.discountLabel, p.mrp, p.sellingPrice, 'minus'),
            rating: p.rating || 0,
            image: (p.images && p.images[0]) ? p.images[0] : '',
            brandName: 'Aramish',
            stock: p.stock || 0,
            sales: p.sales || 0
          })));
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Error fetching crazy deals:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
    return () => controller.abort();
  }, []);


  return (
    <div className="min-h-screen bg-surface flex flex-col pb-20 animate-fade-in">

      {/* Hero Banner Area */}
      <div className="bg-gradient-to-r from-orange-100 to-rose-100 py-3 px-4 flex items-center justify-center text-center relative">
        <button 
          onClick={() => navigate(-1)}
          className="absolute left-4 p-1.5 bg-surface/40 hover:bg-surface/70 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-orange-900" />
        </button>
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-[#0B132B] tracking-tight leading-none mb-1">CRAZY DEALS</h2>
          <p className="text-[10px] text-orange-800 font-medium leading-none">Up to 50% Off! Don't miss out.</p>
        </div>
      </div>

      {/* Grid of Deals */}
      <div className="p-4 grid grid-cols-2 gap-4 mt-2">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface rounded-lg shadow-sm border border-white/10 animate-pulse overflow-hidden flex flex-col pb-3">
              <div className="aspect-square w-full bg-surface" />
              <div className="p-2 space-y-2">
                <div className="w-3/4 h-3 bg-surface rounded" />
                <div className="w-1/2 h-2 bg-surface rounded" />
                <div className="w-1/3 h-3.5 bg-surface rounded pt-1" />
              </div>
            </div>
          ))
        ) : deals.length > 0 ? (
          deals.map((deal) => {
            const isWished = isInWishlist(deal.id);
            return (
               <div 
                key={deal.id} 
                className={`bg-surface rounded-lg shadow-sm border border-white/10 relative cursor-pointer hover:shadow-md transition-shadow group overflow-hidden flex flex-col ${deal.stock === 0 ? 'opacity-70 grayscale' : ''}`}
                onClick={() => navigate(`/product/${deal.id}`)} 
              >  
                {/* Discount Badge */}
                <span className="absolute top-2 left-2 bg-[#0B132B] text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-sm z-10">
                  {deal.discount}
                </span>

                {/* Wishlist Button */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    toggleWishlist(deal);
                  }}
                  className={`absolute top-2 right-2 w-7 h-7 bg-surface/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm z-10 transition-colors ${
                    isWished ? 'text-red-500' : 'text-slate-300 hover:text-red-500'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
                </button>
                
                {/* Image */}
                <div className="aspect-square w-full bg-surface relative overflow-hidden flex items-center justify-center">
                  <OptimizedImage src={getImageUrl(deal.image)} alt={deal.name} type="product" objectFit="contain" className="absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
                  {/* Out of Stock Overlay */}
                  {deal.stock === 0 && (
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[0.5px] flex items-center justify-center z-20">
                      <span className="bg-red-650 text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow-md border border-red-500">
                        Out of Stock
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="p-2 space-y-1">
                  <h4 className="text-xs font-bold text-[#02006c] truncate">{deal.name}</h4>
                  <p className="text-[9px] text-slate-500 truncate">{deal.desc}</p>
                  
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-sm font-extrabold text-[#0B132B]">₹{deal.price}</span>
                    <span className="text-[10px] text-slate-400 font-medium line-through">₹{deal.originalPrice}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 py-10 text-center text-slate-400 text-xs font-medium">
            No Crazy Deals available right now.
          </div>
        )}
      </div>
    </div>
  );
}
