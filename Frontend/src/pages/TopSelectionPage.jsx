import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OptimizedImage from '../components/ui/OptimizedImage';
import { cachedFetch } from '../utils/apiCache';
import { getImageUrl } from '../utils/imageHelper';

export default function TopSelectionPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTopSelections = async () => {
      try {
        const data = await cachedFetch('/admin/catalog/products?status=Approved', { ttl: 300, signal: controller.signal });
        if (data.success && data.products) {
          setProducts(data.products.filter(p => p.flags?.topSection));
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Error fetching top picks:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopSelections();
    return () => controller.abort();
  }, []);


  return (
    <div className="min-h-screen bg-surface flex flex-col pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-surface px-4 py-4 flex items-center justify-between shadow-sm z-50 sticky top-0">
        <h1 className="text-[#02006c] text-[17px] font-bold tracking-wide uppercase font-sans">Featured Collection</h1>
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-surface rounded-full transition-colors border border-white/10">
          <ArrowLeft className="w-5 h-5 text-[#02006c]" />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 bg-surface gap-3 p-3">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface flex flex-col items-center pb-3 animate-pulse shadow-sm rounded-lg overflow-hidden">
              <div className="w-full aspect-[4/5] bg-surface mb-2" />
              <div className="w-3/4 h-3 bg-surface rounded mb-1.5" />
              <div className="w-1/2 h-2.5 bg-surface rounded" />
            </div>
          ))
        ) : products.length > 0 ? (
          products.map((product) => (
            <div 
              key={product._id || product.id} 
              onClick={() => navigate(`/product/${product._id || product.id}`)}
              className="bg-surface flex flex-col pt-0 px-0 pb-2 cursor-pointer transition-all border border-[#0B132B] rounded-xl overflow-hidden shadow-sm"
            >
              <div className="w-full aspect-square mb-2 relative overflow-hidden bg-surface">
                <OptimizedImage
                  src={getImageUrl((product.images && product.images[0]) ? product.images[0] : '')}
                  alt={product.name}
                  type="product"
                  className="absolute inset-0 object-cover"
                />
              </div>
              <div className="px-2.5 pb-1 w-full text-left">
                <p className="text-[10px] text-slate-400 font-medium truncate mb-0.5">
                  {product.brandName || 'Aramish'}
                </p>
                <h3 className="text-xs font-bold text-[#02006c] tracking-tight truncate w-full">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[13px] font-black text-[#0B132B]">₹{product.sellingPrice}</span>
                  {product.mrp && product.mrp > product.sellingPrice && (
                    <span className="text-[10px] text-slate-400 font-semibold line-through mt-0.5">₹{product.mrp}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-10 text-center text-slate-400 text-xs font-medium">
            No Top Picks available at this moment.
          </div>
        )}
      </div>
    </div>
  );
}
