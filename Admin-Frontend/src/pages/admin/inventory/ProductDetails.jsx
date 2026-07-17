import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Package, DollarSign,
  Info, Image as ImageIcon, Layers,
  FileText, Truck, ShieldCheck, Tag
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import OptimizedImage from '../../../components/common/OptimizedImage';

const SectionTitle = ({ icon: Icon, color, children }) => (
  <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-100">
    <div className={`p-2 rounded-xl ${color}`}>
      <Icon size={17} />
    </div>
    <h3 className="text-base font-semibold text-slate-700">{children}</h3>
  </div>
);

const DetailItem = ({ label, value }) => {
  const isZeroAllowed = label.toLowerCase().includes('stock');
  const isEmpty = value === undefined || 
                  value === null || 
                  value === '' || 
                  value === '-' || 
                  (!isZeroAllowed && (value === 0 || value === '0'));
                  
  if (isEmpty) return null;

  return (
    <div className="mb-4 animate-fade-in">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
};

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/admin/catalog/products/${id}`);
        const data = await res.json();
        
        if (res.ok && data.success) {
          setProduct(data.product);
          if (data.product.images && data.product.images.length > 0) {
            setActiveImage(data.product.images[0]);
          }
        } else {
          toast.error(data.message || 'Failed to load product details');
          navigate('/admin/inventory/all');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        toast.error('Error fetching product details');
        navigate('/admin/inventory/all');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProduct();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/inventory/all')}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Product Details</h1>
            <p className="text-sm font-medium text-slate-500">View information for {product.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <SectionTitle icon={FileText} color="bg-orange-50 text-orange-600">Basic Information</SectionTitle>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailItem label="Product Name" value={product.name} />
              <DetailItem label="Category" value={`${product.categoryName || product.category} ${product.subCategory ? `> ${product.subCategoryName || product.subCategory}` : ''}`} />
              <div className="md:col-span-2">
                <DetailItem label="Detailed Description" value={product.description} />
              </div>
            </div>
          </div>

          {/* Highlights & Specs */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <SectionTitle icon={Info} color="bg-blue-50 text-blue-600">Highlights & Technical Specs</SectionTitle>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-700 border-b border-slate-50 pb-2 mb-4">Key Highlights</h4>
                <DetailItem label="Pack Of" value={product.highlights?.packOf} />
                <DetailItem label="Fabric" value={product.highlights?.fabric} />
                <DetailItem label="Material" value={product.highlights?.material} />
                <DetailItem label="Sleeve" value={product.highlights?.sleeve} />
                <DetailItem label="Pattern" value={product.highlights?.pattern} />
                <DetailItem label="Collar" value={product.highlights?.collar} />
                <DetailItem label="Color" value={product.highlights?.color} />
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-700 border-b border-slate-50 pb-2 mb-4">Technical Specs</h4>
                <DetailItem label="Fit" value={product.technicalSpecs?.fit} />
                <DetailItem label="Fabric Care" value={product.technicalSpecs?.fabricCare} />
                <DetailItem label="Suitable For" value={product.technicalSpecs?.suitableFor} />
                <DetailItem label="Hem" value={product.technicalSpecs?.hem} />
              </div>
            </div>
          </div>

          {/* Shipping & Logistics */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <SectionTitle icon={Truck} color="bg-purple-50 text-purple-600">Shipping & Logistics</SectionTitle>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <DetailItem label="Weight (kg)" value={product.shippingSpecs?.weight} />
              <DetailItem label="Length (cm)" value={product.shippingSpecs?.length} />
              <DetailItem label="Width (cm)" value={product.shippingSpecs?.width} />
              <DetailItem label="Height (cm)" value={product.shippingSpecs?.height} />
            </div>
          </div>
          
          {/* Variations */}
          {product.variations && product.variations.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <SectionTitle icon={Layers} color="bg-indigo-50 text-indigo-600">Variations (SKUs)</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Attributes</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                    {product.variations.map((v, idx) => {
                      const attrText = v.attributes 
                        ? Object.entries(v.attributes).map(([key, val]) => `${key}: ${val}`).join(', ')
                        : '-';
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-[#0B132B]">{v.sku}</td>
                          <td className="py-3.5 px-4 text-slate-500 text-xs">{attrText}</td>
                          <td className="py-3.5 px-4">₹{v.price}</td>
                          <td className="py-3.5 px-4">{v.stock}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Images */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <SectionTitle icon={ImageIcon} color="bg-rose-50 text-rose-600">Product Visuals</SectionTitle>
            {product.images && product.images.length > 0 ? (
              <div className="space-y-4">
                {/* Main Large Preview */}
                <div className="rounded-xl border border-slate-100 overflow-hidden aspect-square bg-white flex items-center justify-center relative">
                  <OptimizedImage 
                    src={activeImage || product.images[0]} 
                    alt={product.name} 
                    type="product" 
                    objectFit="contain"
                    className="absolute inset-0 w-full h-full object-contain p-2" 
                  />
                </div>
                {/* Thumbnails Row */}
                {product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {product.images.map((img, i) => (
                      <button 
                        key={i} 
                        onClick={() => setActiveImage(img)}
                        className={`w-20 h-20 bg-white rounded-lg border overflow-hidden shrink-0 transition-all flex items-center justify-center p-1 ${
                          (activeImage || product.images[0]) === img 
                            ? 'border-[#0B132B] ring-2 ring-orange-50' 
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <OptimizedImage src={img} alt={`Thumbnail ${i+1}`} type="product" objectFit="contain" className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                <ImageIcon size={32} className="mb-2 opacity-50" />
                <p className="text-sm font-medium">No Images Available</p>
              </div>
            )}
          </div>

          {/* Pricing & Stocks */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <SectionTitle icon={DollarSign} color="bg-green-50 text-green-600">Pricing & Stocks</SectionTitle>
            
            <div className="space-y-4">
              <DetailItem label="Selling Price" value={`₹${product.sellingPrice}`} />
              <DetailItem label="MRP / Strike-off" value={product.mrp ? `₹${product.mrp}` : null} />
              <DetailItem label="Current Stock" value={product.stock} />
              <DetailItem label="SKU / Product Code" value={product.sku} />
              <DetailItem label="Discount Label" value={(() => {
                if (!product.discountLabel) return null;
                const parsed = parseFloat(product.discountLabel);
                if (!isNaN(parsed) && parsed > 0 && parsed < 1) {
                  return `-${Math.round(parsed * 100)}% OFF`;
                }
                const cleanStr = String(product.discountLabel).replace('-', '').replace('%', '').trim();
                const cleanNum = parseFloat(cleanStr);
                if (!isNaN(cleanNum)) {
                  return `-${Math.round(cleanNum)}% OFF`;
                }
                return String(product.discountLabel).includes('%') ? `-${String(product.discountLabel).replace('-', '')}` : String(product.discountLabel);
              })()} />
            </div>
          </div>

          {/* Status & Flags */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <SectionTitle icon={Tag} color="bg-amber-50 text-amber-600">Status & Flags</SectionTitle>
            
            <div className="space-y-4">
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  product.status === 'Approved' ? 'bg-green-50 text-green-600 border border-green-100' :
                  product.status === 'Out of Stock' ? 'bg-red-50 text-red-500 border border-red-100' :
                  'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  {product.status}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Top Section</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${product.flags?.topSection ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {product.flags?.topSection ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Crazy Deals</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${product.flags?.crazyDeals ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {product.flags?.crazyDeals ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Flash Sale</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${product.flags?.flashSale ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {product.flags?.flashSale ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Organization & Compliance */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <SectionTitle icon={ShieldCheck} color="bg-cyan-50 text-cyan-600">Organization</SectionTitle>
            <div className="space-y-4">
              <DetailItem label="Brand Name" value={product.brandName} />
              <DetailItem label="Manufacturer Info" value={product.manufacturerInfo} />
              <DetailItem label="HSN Code" value={product.hsnCode} />
              
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {product.tags && product.tags.length > 0 ? (
                    product.tags.map((t, idx) => (
                      <span key={idx} className="px-2 py-1 bg-slate-50 text-slate-500 text-xs font-medium rounded border border-slate-100">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
