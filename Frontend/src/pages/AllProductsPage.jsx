import React, { useState, useEffect } from 'react';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ui/ProductCard';
import { cachedFetch } from '../utils/apiCache';
import { formatDiscount } from '../utils/discountHelper';

// Normalise API product to match the shape ProductCard expects
const normaliseProduct = (p) => ({
  id: p._id || p.id,
  name: p.name,
  desc: p.description || '',
  price: p.sellingPrice,
  originalPrice: p.mrp || p.sellingPrice,
  discount: formatDiscount(p.discountLabel, p.mrp, p.sellingPrice, 'minus'),
  rating: p.rating || 0,
  type: (p.category || '').toLowerCase(),
  image: p.images && p.images[0] ? p.images[0] : '',
  brandName: 'Aramish',
  flags: p.flags || {},
  stock: p.stock || 0,
  sales: p.sales || 0,
});

export default function AllProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchAllProducts = async () => {
      try {
        const data = await cachedFetch('/admin/catalog/products?status=Approved', { ttl: 300, signal: controller.signal });
        if (data.success && data.products) {
          setProducts(data.products.map(normaliseProduct));
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Error fetching all products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllProducts();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-surface px-4 py-4 flex items-center justify-between shadow-sm z-50 sticky top-0">
        <h1 className="text-[#02006c] text-[17px] font-bold tracking-wide uppercase font-sans">
          All Products
        </h1>
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-surface rounded-full transition-colors border border-white/10">
          <ArrowLeft className="w-5 h-5 text-[#02006c]" />
        </button>
      </div>

      {!loading && (
        <p className="px-4 pt-3 text-xs text-slate-400 font-semibold">
          {products.length} {products.length === 1 ? 'product' : 'products'} to explore
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface flex flex-col items-center pb-3 animate-pulse shadow-sm rounded-xl overflow-hidden border border-white/10">
              <div className="w-full aspect-square bg-surface mb-2" />
              <div className="w-3/4 h-3 bg-surface rounded mb-1.5" />
              <div className="w-1/2 h-2.5 bg-surface rounded" />
            </div>
          ))
        ) : products.length > 0 ? (
          products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="col-span-2 md:col-span-3 lg:col-span-4 py-16 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-3xl bg-surface">
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
