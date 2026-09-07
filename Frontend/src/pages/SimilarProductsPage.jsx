import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OptimizedImage from '../components/ui/OptimizedImage';
import { getImageUrl } from '../utils/imageHelper';
import { cachedFetch } from '../utils/apiCache';

export default function SimilarProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchProducts = async () => {
      try {
        const data = await cachedFetch('/admin/catalog/products?status=Approved', { ttl: 300, signal: controller.signal });
        if (data.success && data.products) {
          setProducts(data.products);
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Error fetching similar products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
    return () => controller.abort();
  }, []);

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
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface flex flex-col items-center pb-3 animate-pulse shadow-sm rounded-lg overflow-hidden">
              <div className="w-full aspect-square bg-surface mb-2" />
              <div className="w-3/4 h-3 bg-surface rounded mb-1.5" />
              <div className="w-1/2 h-2.5 bg-surface rounded" />
            </div>
          ))
        ) : products.length > 0 ? (
          products.map((deal) => (
            <div
              key={deal._id}
              onClick={() => navigate(`/product/${deal._id}`)}
              className="bg-surface flex flex-col items-center pt-0 px-0 pb-3 cursor-pointer hover:shadow-md transition-all shadow-sm"
            >
              <div className="w-full aspect-square bg-surface mb-2 flex items-center justify-center overflow-hidden relative">
                <OptimizedImage src={getImageUrl(deal.images && deal.images[0])} alt={deal.name} type="product" objectFit="contain" className="absolute inset-0" />
              </div>
              <h3 className="text-[12px] font-medium text-slate-600 text-center tracking-wide mt-1" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                {deal.name}
              </h3>
              <p className="text-[10px] text-emerald-600 mt-1 text-center font-medium tracking-wide px-1 line-clamp-1" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                ₹{deal.sellingPrice}
              </p>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-16 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-3xl bg-surface">
            <LayoutGrid className="w-8 h-8 text-slate-300 mb-3" />
            <h4 className="text-sm font-bold text-slate-800 mb-1">No products yet</h4>
            <p className="text-xs text-slate-400 max-w-[220px]">
              We are updating our catalog. Check back soon!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
