import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, SlidersHorizontal, ChevronRight, Star, PenLine, Package, X, Image as ImageIcon, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';
import { BANNERS } from '../data/mockData';
import OptimizedImage from '../components/ui/OptimizedImage';

// Mock data matching the new design
const MOCK_ORDERS = [
  {
    id: 'ORD-8X92-K1',
    date: 'Arriving by May 10',
    status: 'In Transit',
    name: 'WALKAROO Men Casual',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=200',
    rating: 0,
    ratingText: ''
  },
  {
    id: 'ORD-3M44-P9',
    date: 'Delivered on Apr 13',
    status: 'Delivered',
    name: 'SONATA NP7987YM06W Sonata Qua...',
    image: 'https://images.unsplash.com/photo-1524592094714-cb9c5d4d3bd1?auto=format&fit=crop&q=80&w=200',
    rating: 3,
    ratingText: 'Okay'
  },
  {
    id: 'ORD-1K99-L2',
    date: 'Delivered on Mar 19',
    status: 'Delivered',
    name: 'Lakmé Sunscreen - SPF 50 PA+++ Su...',
    image: 'https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&q=80&w=200',
    rating: 0,
    ratingText: 'Rate & Review'
  }
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { orders: appOrders } = useApp();

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);

  // Auto-slide Banners
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % BANNERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handleOpenReview = (order) => {
    setSelectedOrderForReview(order);
    setReviewRating(order.rating || 0);
    setReviewText('');
    setReviewModalOpen(true);
  };

  const handlePhotoUpload = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const invalidFile = filesArray.find(f => f.size > 10 * 1024 * 1024);
      if (invalidFile) {
        toast.info('Image size cannot exceed 10MB!');
        e.target.value = '';
        return;
      }
      toast.success('Photos selected successfully!');
    }
  };

  const handleVideoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.info('Video size cannot exceed 10MB!');
        e.target.value = '';
        return;
      }
      toast.success('Video selected successfully!');
    }
  };
  
  const fallbackImages = [
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=200', // Shoes
    'https://images.unsplash.com/photo-1524592094714-cb9c5d4d3bd1?auto=format&fit=crop&q=80&w=200', // Watch
    'https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&q=80&w=200'  // Sunscreen
  ];

  // Transform appOrders to match the required UI structure, or use MOCK_ORDERS
  let rawOrders = appOrders && appOrders.length > 0 ? appOrders.map((o, idx) => {
    const dateObj = o.createdAt ? new Date(o.createdAt) : null;
    const formattedDateTime = dateObj 
      ? `${dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at ${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      : o.date;

    return {
      id: o.id || `ORD-MOCK-${idx}`,
      date: formattedDateTime,
      status: o.status || (idx === 0 ? 'In Transit' : 'Delivered'),
      name: o.items && o.items[0] ? o.items[0].name : 'Product',
      image: (o.items && o.items[0] && o.items[0].image) ? o.items[0].image : fallbackImages[idx % fallbackImages.length],
      rating: idx === 1 ? 3 : 0,
      ratingText: idx === 1 ? 'Okay' : (idx === 0 ? '' : 'Rate & Review'),
      createdAt: o.createdAt || ''
    };
  }) : [];

  // Sort: Latest orders top pe (descending order by createdAt)
  rawOrders.sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return b.id.localeCompare(a.id);
  });

  // Apply Search
  if (searchQuery.trim() !== '') {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    rawOrders = rawOrders.filter(o => 
      o.name.toLowerCase().includes(trimmedQuery) || 
      o.id.toLowerCase().includes(trimmedQuery)
    );
  }

  // Apply Filter
  if (filterStatus !== 'All') {
    rawOrders = rawOrders.filter(o => o.status === filterStatus);
  }

  const orders = rawOrders;

  return (
    <div className="bg-surface min-h-screen font-sans pb-20 select-none">
      {/* Header (Mobile Only) */}
      <div className="px-4 py-3 flex items-center gap-3 sticky top-0 bg-[#FFE4D6] z-50 shadow-sm md:hidden">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-gold/10 rounded-full transition-colors cursor-pointer">
          <ArrowLeft className="w-6 h-6 text-[#02006c]" />
        </button>
        <h1 className="text-[#02006c] text-[18px] font-semibold tracking-wide">My Orders</h1>
      </div>

      {/* Main Page Content Wrapper */}
      <div className="max-w-4xl mx-auto w-full px-0 md:px-6 py-4 md:py-8 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-3 md:px-0">
          <h2 className="hidden md:block text-xl font-black text-[#02006c] uppercase tracking-wide">
            My Order History
          </h2>

          {/* Search and Filters */}
          <div className="flex items-center gap-3 w-full md:w-auto relative z-40">
            <div className="flex-1 md:w-64 flex items-center gap-2 border border-white/10 rounded-xl px-3 py-2 bg-surface shadow-3xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search orders"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 outline-none text-xs text-slate-700 placeholder-slate-450 font-bold bg-transparent"
              />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 text-slate-700 hover:text-[#0B132B] font-bold text-xs px-2.5 py-2.5 bg-surface border border-white/10 rounded-xl shadow-3xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
              </button>
              
              {showFilters && (
                <div className="absolute right-0 top-full mt-2 bg-surface border border-slate-250/20 rounded-xl shadow-lg p-1.5 z-50 w-36 animate-fade-in text-xs">
                  {['All', 'In Transit', 'Delivered'].map(status => (
                    <div 
                      key={status}
                      onClick={() => { setFilterStatus(status); setShowFilters(false); }}
                      className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${filterStatus === status ? 'bg-[#0B132B]/10 text-[#0B132B] font-black' : 'text-slate-650 font-bold hover:bg-surface'}`}
                    >
                      {status}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="p-12 bg-surface rounded-2xl border border-white/10 shadow-3xs text-center flex flex-col items-center justify-center">
            <Package className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold text-sm">No orders found.</p>
          </div>
        ) : (
          <div className="space-y-4 px-3 md:px-0">
            {orders.map((order) => (
              <div key={order.id} className="bg-surface rounded-2xl shadow-3xs border border-white/10 p-4 flex flex-col justify-between hover:border-white/10 transition-all">
                <div 
                  className="flex items-center gap-4 cursor-pointer group"
                  onClick={() => navigate(`/order-details/${order.id}`)}
                >
                  <div className="w-16 h-16 rounded-xl bg-surface p-2 flex-shrink-0 flex items-center justify-center border border-white/10 relative">
                    <OptimizedImage src={order.image} alt={order.name} type="product" objectFit="contain" className="absolute inset-0 p-1 mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <h3 className="font-extrabold text-slate-800 text-xs md:text-sm group-hover:text-[#0B132B] transition-colors">{order.date}</h3>
                    <p className="text-slate-500 text-[11px] md:text-xs mt-1 truncate">{order.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">ID: {order.id?.slice(0, 5)}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
                
                {/* Rating Section */}
                {order.status === 'Delivered' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-4 bg-surface rounded-xl p-2.5 border border-white/10">
                    <div 
                      className="flex items-center gap-1.5 min-w-0 cursor-pointer"
                      onClick={() => handleOpenReview(order)}
                    >
                      <span className="text-[11px] font-bold text-[#02006c] truncate hover:underline">{order.ratingText}</span>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-3.5 h-3.5 ${
                              star <= order.rating 
                                ? 'text-green-600 fill-green-600' 
                                : 'text-slate-200'
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                    {order.rating > 0 ? (
                      <button 
                        onClick={() => handleOpenReview(order)}
                        className="flex items-center gap-1 border border-[#02006c] bg-surface text-[#02006c] rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors flex-shrink-0 ml-auto text-[11px] font-bold cursor-pointer"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        <span>Write review</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-surface w-full sm:w-[400px] rounded-t-2xl sm:rounded-2xl p-5 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[18px] font-bold text-slate-800">Write a Review</h2>
              <button onClick={() => setReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-surface hover:bg-surface rounded-full transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {selectedOrderForReview && (
              <div className="flex items-center gap-3 mb-6 bg-surface p-3 rounded-xl border border-white/10">
                <div className="w-12 h-12 rounded-lg bg-surface p-1 flex-shrink-0 border border-white/10 flex items-center justify-center relative">
                  <OptimizedImage src={selectedOrderForReview.image} alt="" type="product" objectFit="contain" className="absolute inset-0 p-0.5 mix-blend-multiply" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[13px] text-slate-800 line-clamp-1">{selectedOrderForReview.name}</h3>
                  <p className="text-[11px] text-slate-500">{selectedOrderForReview.status}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center justify-center mb-6">
              <p className="text-[14px] font-semibold text-slate-700 mb-3">How would you rate this product?</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setReviewRating(star)} className="p-1 hover:scale-110 transition-transform cursor-pointer">
                    <Star 
                      className={`w-8 h-8 ${star <= reviewRating ? 'text-green-500 fill-green-500' : 'text-slate-200'} transition-colors`} 
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[14px] font-semibold text-slate-700 mb-2">Add a written review</p>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="What did you like or dislike?"
                className="w-full bg-surface border border-white/10 rounded-xl p-3 text-[14px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none h-[100px]"
              ></textarea>
            </div>

            <div className="mb-6">
              <p className="text-[14px] font-semibold text-slate-700 mb-2">Add Photos or Reel (Optional)</p>
              <div className="flex gap-3">
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-white/10 bg-surface rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                  <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-[11px] font-medium text-slate-600">Add Photos</span>
                  <input type="file" accept="image/jpeg, image/png, image/webp" multiple className="hidden" onChange={handlePhotoUpload} />
                </label>
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-white/10 bg-surface rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                  <Video className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-[11px] font-medium text-slate-600">Add Reel</span>
                  <input type="file" accept="video/mp4, video/webm" className="hidden" onChange={handleVideoUpload} />
                </label>
              </div>
            </div>

            <button 
              onClick={() => {
                setReviewModalOpen(false);
                alert("Review submitted successfully!");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Submit Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
