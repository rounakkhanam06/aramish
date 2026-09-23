import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Mail, Smartphone, MapPin, 
  ShoppingBag, Star, MessageSquare, Wallet,
  Clock, ArrowLeft, ShieldAlert, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, Calendar, ExternalLink, LayoutGrid,
  Play, Film, Image as ImageIcon, Eye, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getImageUrl } from '../../../utils/imageHelper';

const CustomerDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Orders');
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [address, setAddress] = useState(null);
  const [statsData, setStatsData] = useState({ totalOrders: 0, ltv: 0, returnsCount: 0, coinsBalance: 0, avgRating: 0 });
  const [ordersList, setOrdersList] = useState([]);
  const [wishlistList, setWishlistList] = useState([]);
  const [reviewsList, setReviewsList] = useState([]);
  const [ticketsList, setTicketsList] = useState([]);
  const [walletData, setWalletData] = useState({ balance: 0, transactions: [] });

  // Preview & Moderation states
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewImageState, setPreviewImageState] = useState(null); // { url, photos: [], index: 0, title: '' }
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all');

  const tabs = ['Orders', 'Wishlist', 'Reviews', 'Support'];

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (previewVideoUrl || previewImageState) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewVideoUrl, previewImageState]);

  const handleUpdateReviewStatus = async (reviewId, newStatus) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    setStatusUpdatingId(reviewId);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels/admin/${reviewId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Review marked as ${newStatus}`);
        setReviewsList(prev => prev.map(r => r.id === reviewId ? { ...r, status: newStatus } : r));
      } else {
        toast.error(data.message || 'Failed to update review status');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating review status');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openImageModal = (photos, index, title) => {
    setPreviewImageState({
      photos,
      index,
      url: photos[index],
      title
    });
  };

  const nextImage = (e) => {
    e?.stopPropagation();
    if (!previewImageState || !previewImageState.photos.length) return;
    const nextIdx = (previewImageState.index + 1) % previewImageState.photos.length;
    setPreviewImageState({
      ...previewImageState,
      index: nextIdx,
      url: previewImageState.photos[nextIdx]
    });
  };

  const prevImage = (e) => {
    e?.stopPropagation();
    if (!previewImageState || !previewImageState.photos.length) return;
    const prevIdx = (previewImageState.index - 1 + previewImageState.photos.length) % previewImageState.photos.length;
    setPreviewImageState({
      ...previewImageState,
      index: prevIdx,
      url: previewImageState.photos[prevIdx]
    });
  };

  const fetchCustomerDetails = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/auth/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomer(data.user);
        setAddress(data.address);
        setStatsData(data.stats);
        setOrdersList(data.orders);
        setWishlistList(data.wishlist);
        setReviewsList(data.reviews || []);
        setTicketsList(data.tickets || []);
        setWalletData(data.wallet);
      } else {
        toast.error(data.message || 'Failed to load customer details');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchCustomerDetails();
    }
  }, [userId]);

  const handleAction = async (action) => {
    if (action === 'force-logout') {
      const confirmLogout = window.confirm(`Are you sure you want to FORCE LOGOUT ${customer.name || 'this user'}? This will clear their session on all devices immediately.`);
      if (!confirmLogout) return;

      const token = localStorage.getItem('adminToken');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${apiBase}/admin/auth/users/${userId}/force-logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success(data.message || 'User forced logged out successfully');
        } else {
          toast.error(data.message || 'Failed to force logout user');
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not connect to backend server');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center py-20 space-y-4">
        <h2 className="text-xl font-bold text-slate-900 font-montserrat uppercase tracking-tight">Customer not found</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider">Go Back</button>
      </div>
    );
  }

  const initials = customer.name
    ? customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'UU';

  const stats = [
    { label: 'Total Orders', value: statsData.totalOrders.toString(), icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'LTV (Revenue)', value: `₹${(statsData.ltv || 0).toLocaleString('en-IN')}`, icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Avg Rating', value: statsData.avgRating ? statsData.avgRating.toString() : '0', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Returns', value: statsData.returnsCount.toString().padStart(2, '0'), icon: Clock, color: 'text-red-500', bg: 'bg-red-50' },
  ];

  const getBadgeClass = (status) => {
    if (status === 'Inactive') return 'bg-rose-50 text-rose-600 border border-rose-100';
    return 'bg-green-50 text-green-600 border border-green-100';
  };

  const filteredReviews = reviewsList.filter(review => {
    if (reviewFilter === 'all') return true;
    return review.status === reviewFilter;
  });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
           <button onClick={() => navigate(-1)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">
              <ArrowLeft size={20} />
           </button>
           <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl shadow-blue-100 uppercase overflow-hidden border border-slate-100 bg-slate-100">
                 {customer.avatar ? (
                    <img 
                      src={getImageUrl(customer.avatar)} 
                      alt={customer.name || 'User'} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        // Replace container innerHTML with the initials fallback on image loading error
                        e.target.parentNode.className = "w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl shadow-blue-100 uppercase";
                        e.target.parentNode.innerHTML = initials;
                      }}
                    />
                 ) : (
                    <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center">
                       {initials}
                    </div>
                 )}
              </div>
              <div>
                 <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-slate-900 font-montserrat uppercase tracking-tight">{customer.name || 'Anonymous User'}</h1>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getBadgeClass(customer.derivedStatus)}`}>
                      {customer.derivedStatus || 'Active'} Customer
                    </span>
                 </div>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                   Customer ID: #{userId.slice(-6).toUpperCase()} • Member since {new Date(customer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                 </p>
              </div>
           </div>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => handleAction('force-logout')}
             className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-500 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
           >
              <ShieldAlert size={16} />
              Force Logout
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Sidebar: Profile Summary */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-4">Contact Information</h3>
               <div className="space-y-4">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center border border-slate-100">
                        <Mail size={18} />
                     </div>
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{customer.email || 'N/A'}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center border border-slate-100">
                        <Smartphone size={18} />
                     </div>
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{customer.phone || 'N/A'}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-4">
                     <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center border border-slate-100 flex-shrink-0">
                        <MapPin size={18} />
                     </div>
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Primary Address</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5 leading-relaxed">
                          {address ? `${address.address}, ${address.pincode} (${address.type})` : 'No address saved'}
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-10">
                  <User size={100} />
               </div>
               <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Admin Notes</p>
                  <p className="text-[11px] opacity-80 mt-4 leading-relaxed font-medium italic font-raleway">
                     "Customer is highly active on the Aramish platform. Coin wallet is synced and monitored."
                  </p>
               </div>
            </div>
         </div>

         {/* Main Content: Stats & Activity */}
         <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {stats.map((stat, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                     <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3 shadow-inner`}>
                        <stat.icon size={20} />
                     </div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                     <p className="text-xl font-black text-slate-900 font-roboto">{stat.value}</p>
                  </div>
               ))}
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[580px]">
               <div className="flex border-b border-slate-50 overflow-x-auto no-scrollbar">
                  {tabs.map(tab => {
                    const count = tab === 'Orders' ? ordersList.length :
                                  tab === 'Wishlist' ? wishlistList.length :
                                  tab === 'Reviews' ? reviewsList.length :
                                  ticketsList.length;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 flex items-center gap-2 ${
                          activeTab === tab 
                          ? 'text-blue-600 border-blue-600 bg-blue-50/20' 
                          : 'text-slate-400 border-transparent hover:text-slate-600'
                        }`}
                      >
                        <span>{tab}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                          activeTab === tab
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {activeTab === 'Orders' && (
                    <div className="space-y-4">
                       {ordersList.length > 0 ? (
                         ordersList.map((order) => (
                           <div key={order.id} onClick={() => navigate(`/admin/orders/${order.id}`)} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all group cursor-pointer">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                                    <ShoppingBag size={18} />
                                 </div>
                                 <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Order #{order.id}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{order.date} • {order.itemsCount} Items</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="text-right">
                                    <p className="text-sm font-black text-slate-900 font-roboto">₹{(order.total || 0).toLocaleString('en-IN')}</p>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${order.status === 'Cancelled' ? 'text-red-500' : 'text-green-500'}`}>{order.status}</p>
                                 </div>
                                 <button className="p-2 bg-white text-slate-300 rounded-lg group-hover:text-blue-500 transition-all">
                                    <ExternalLink size={16} />
                                 </button>
                              </div>
                           </div>
                         ))
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-10 opacity-60">
                            <ShoppingBag size={48} className="opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-center">No orders placed yet</p>
                         </div>
                       )}
                    </div>
                  )}

                  {activeTab === 'Wishlist' && (
                    <div className="space-y-4">
                       {wishlistList.length > 0 ? (
                         wishlistList.map((item) => (
                           <div key={item.id} onClick={() => navigate(`/admin/inventory/view/${item.productId}`)} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all group cursor-pointer">
                              <div className="flex items-center gap-4">
                                 {item.image ? (
                                   <img src={getImageUrl(item.image)} alt={item.name} className="w-12 h-12 rounded-xl object-cover shadow-sm border border-slate-100 bg-white flex-shrink-0" />
                                 ) : (
                                   <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 flex-shrink-0">
                                      <ShoppingBag size={18} />
                                   </div>
                                 )}
                                 <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.name}</p>
                                    <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider flex-wrap">
                                       {item.variant?.color && <span className="text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded text-[8.5px]">{item.variant.color}</span>}
                                       {item.variant?.size && <span className="text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded text-[8.5px]">Size: {item.variant.size}</span>}
                                       {item.article && <span>Art: {item.article} •</span>}
                                       <span>Product ID: #{item.productId}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="text-right">
                                    <p className="text-sm font-black text-slate-900 font-roboto">₹{(item.price || 0).toLocaleString('en-IN')}</p>
                                    {item.mrp > item.price && (
                                       <p className="text-[10px] text-slate-400 line-through font-roboto font-bold">
                                          ₹{item.mrp.toLocaleString('en-IN')}
                                       </p>
                                    )}
                                 </div>
                                 <button className="p-2 bg-white text-slate-300 rounded-lg group-hover:text-blue-500 transition-all">
                                    <ExternalLink size={16} />
                                 </button>
                              </div>
                           </div>
                         ))
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-10 opacity-60">
                            <Star size={48} className="opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-center">Wishlist is empty</p>
                         </div>
                       )}
                    </div>
                  )}

                  {activeTab === 'Reviews' && (
                    <div className="space-y-5">
                       {/* Summary Header */}
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                                <Star size={20} className="fill-amber-400 text-amber-400" />
                             </div>
                             <div>
                                <div className="flex items-center gap-2">
                                   <span className="text-sm font-black text-slate-900 font-montserrat">
                                      {statsData.avgRating || (reviewsList.length > 0 ? (reviewsList.reduce((acc, r) => acc + (r.rating || 0), 0) / reviewsList.length).toFixed(1) : 0)} / 5
                                   </span>
                                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Average Rating</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium">
                                   {reviewsList.length} total {reviewsList.length === 1 ? 'review' : 'reviews'} given by this customer
                                </p>
                             </div>
                          </div>

                          {/* Filter Badges */}
                          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-100 text-[10px] font-black uppercase tracking-wider">
                             {['all', 'approved', 'pending', 'rejected'].map((filter) => {
                                const count = filter === 'all' 
                                   ? reviewsList.length 
                                   : reviewsList.filter(r => r.status === filter).length;
                                return (
                                   <button
                                      key={filter}
                                      onClick={() => setReviewFilter(filter)}
                                      className={`px-3 py-1.5 rounded-lg transition-all ${
                                         reviewFilter === filter
                                            ? 'bg-[#02006c] text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                      }`}
                                   >
                                      {filter} ({count})
                                   </button>
                                );
                             })}
                          </div>
                       </div>

                       {/* Reviews List */}
                       {filteredReviews.length > 0 ? (
                         <div className="space-y-4">
                            {filteredReviews.map((review) => {
                               const videoUrl = review.video ? getImageUrl(review.video) : null;
                               const photoUrls = Array.isArray(review.photos) ? review.photos.map(getImageUrl).filter(Boolean) : [];
                               const reviewMessage = review.reviewText || review.caption || '';
                               const hasDifferentCaption = review.caption && review.reviewText && review.caption !== review.reviewText;

                               return (
                                 <div 
                                   key={review.id} 
                                   className="p-5 bg-slate-50/80 hover:bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:shadow-slate-100 transition-all space-y-4 group"
                                 >
                                    {/* Header: Product & Status */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                       <div className="flex items-center gap-3">
                                          {review.productImage ? (
                                            <img 
                                              src={getImageUrl(review.productImage)} 
                                              alt={review.productName} 
                                              className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-sm flex-shrink-0 bg-white" 
                                            />
                                          ) : (
                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-sm flex-shrink-0">
                                               <ShoppingBag size={20} />
                                            </div>
                                          )}
                                          <div>
                                             <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight font-montserrat hover:text-blue-600 transition-colors">
                                                   {review.productName}
                                                </h4>
                                                {review.productId && (
                                                   <button 
                                                     onClick={() => navigate(`/admin/inventory/view/${review.productId}`)}
                                                     className="text-slate-400 hover:text-blue-600 transition-colors"
                                                     title="View Product in Inventory"
                                                   >
                                                      <ExternalLink size={12} />
                                                   </button>
                                                )}
                                             </div>
                                             <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                                <span>{review.createdAt}</span>
                                                {review.productPrice > 0 && (
                                                   <>
                                                      <span>•</span>
                                                      <span className="text-slate-700 font-roboto font-black">₹{Number(review.productPrice).toLocaleString('en-IN')}</span>
                                                   </>
                                                )}
                                                {review.productArticle && (
                                                   <>
                                                      <span>•</span>
                                                      <span>Art: {review.productArticle}</span>
                                                   </>
                                                )}
                                             </div>
                                          </div>
                                       </div>

                                       {/* Status & Inline Moderation Controls */}
                                       <div className="flex items-center gap-2 self-start sm:self-auto">
                                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                                             review.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                             review.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                                          }`}>
                                             <span className={`w-1.5 h-1.5 rounded-full ${
                                                review.status === 'approved' ? 'bg-emerald-500' :
                                                review.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                                             }`} />
                                             {review.status}
                                          </span>

                                          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                                             {review.status !== 'approved' && (
                                                <button
                                                   disabled={statusUpdatingId === review.id}
                                                   onClick={() => handleUpdateReviewStatus(review.id, 'approved')}
                                                   className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50"
                                                   title="Approve Review"
                                                >
                                                   <CheckCircle2 size={12} />
                                                   Approve
                                                </button>
                                             )}
                                             {review.status !== 'rejected' && (
                                                <button
                                                   disabled={statusUpdatingId === review.id}
                                                   onClick={() => handleUpdateReviewStatus(review.id, 'rejected')}
                                                   className="px-2.5 py-1 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50"
                                                   title="Reject Review"
                                                >
                                                   <XCircle size={12} />
                                                   Reject
                                                </button>
                                             )}
                                          </div>
                                       </div>
                                    </div>

                                    {/* Rating Row */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                       <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                                          <div className="flex text-amber-400">
                                             {Array.from({ length: 5 }).map((_, idx) => (
                                                <Star 
                                                   key={idx} 
                                                   size={14} 
                                                   className={idx < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} 
                                                />
                                             ))}
                                          </div>
                                          <span className="text-[11px] font-black text-amber-700 ml-1.5 font-roboto">{review.rating}.0</span>
                                       </div>
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                          {review.rating >= 4 ? 'Positive Review' : review.rating === 3 ? 'Neutral Review' : 'Critical Review'}
                                       </span>
                                       {videoUrl && (
                                          <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-100 flex items-center gap-1">
                                             <Film size={10} /> Video Reel
                                          </span>
                                       )}
                                       {photoUrls.length > 0 && (
                                          <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                                             <ImageIcon size={10} /> {photoUrls.length} {photoUrls.length === 1 ? 'Photo' : 'Photos'}
                                          </span>
                                       )}
                                    </div>

                                    {/* Written Message (reviewText or caption) */}
                                    {reviewMessage ? (
                                      <div className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-sm relative space-y-1.5">
                                         <div className="flex items-center gap-1.5 text-slate-400 text-[9px] font-black uppercase tracking-wider">
                                            <MessageSquare size={12} className="text-blue-500" />
                                            <span>Customer Review Message</span>
                                         </div>
                                         <p className="text-xs text-slate-700 font-medium leading-relaxed italic whitespace-pre-line">
                                            "{reviewMessage}"
                                         </p>
                                         {hasDifferentCaption && (
                                            <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-50">
                                               Caption: {review.caption}
                                            </p>
                                         )}
                                      </div>
                                    ) : (
                                      <div className="p-2.5 bg-white/60 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[10px] italic flex items-center gap-2">
                                         <MessageSquare size={12} className="opacity-40" />
                                         <span>No written message provided (rating / media submission only).</span>
                                      </div>
                                    )}

                                    {/* Attached Media: Video Reels & Photos */}
                                    {(videoUrl || photoUrls.length > 0) && (
                                      <div className="space-y-2 pt-1">
                                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            Customer Uploaded Media (Reels & Photos)
                                         </p>
                                         <div className="flex flex-wrap items-start gap-3">
                                            {/* Video Reel Preview Card */}
                                            {videoUrl && (
                                              <div
                                                 onClick={() => setPreviewVideoUrl(videoUrl)}
                                                 className="relative w-32 h-44 bg-slate-950 rounded-2xl overflow-hidden cursor-pointer group shadow-md border border-slate-200 flex-shrink-0"
                                                 title="Click to play full reel"
                                              >
                                                 <video
                                                    src={videoUrl}
                                                    className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                                                    muted
                                                    playsInline
                                                 />
                                                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-between p-2">
                                                    <span className="self-start px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[7.5px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                                                       <Film size={8} /> Reel
                                                    </span>
                                                    <div className="self-center w-10 h-10 rounded-full bg-white/25 backdrop-blur-md text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 transition-all shadow-lg">
                                                       <Play size={16} className="fill-current ml-0.5" />
                                                    </div>
                                                    <span className="text-[8px] font-black text-white/90 text-center uppercase tracking-wider">
                                                       Watch Video
                                                    </span>
                                                 </div>
                                              </div>
                                            )}

                                            {/* Photos Gallery */}
                                            {photoUrls.map((url, imgIdx) => (
                                              <div
                                                 key={imgIdx}
                                                 onClick={() => openImageModal(photoUrls, imgIdx, `${review.productName} - Review Photo`)}
                                                 className="relative w-32 h-44 bg-slate-100 rounded-2xl overflow-hidden cursor-pointer group shadow-sm border border-slate-200 flex-shrink-0"
                                                 title="Click to zoom photo"
                                              >
                                                 <img
                                                    src={url}
                                                    alt={`Review photo ${imgIdx + 1}`}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                 />
                                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                    <div className="p-2 bg-white/30 backdrop-blur-md rounded-full text-white transform scale-90 group-hover:scale-100 transition-transform">
                                                       <Eye size={16} />
                                                    </div>
                                                 </div>
                                                 <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-md text-white px-1.5 py-0.5 rounded text-[7.5px] font-black">
                                                    #{imgIdx + 1}
                                                 </div>
                                              </div>
                                            ))}
                                         </div>
                                      </div>
                                    )}

                                    {/* Stats footer */}
                                    {(review.views > 0 || review.likesCount > 0) && (
                                      <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest pt-1">
                                         <span>Views: {review.views || 0}</span>
                                         <span>•</span>
                                         <span>Likes: {review.likesCount || 0}</span>
                                      </div>
                                    )}
                                 </div>
                               );
                            })}
                         </div>
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-16 opacity-60">
                            <MessageSquare size={48} className="opacity-20" />
                            <div className="text-center">
                               <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                                  {reviewFilter === 'all' ? 'No reviews submitted yet' : `No ${reviewFilter} reviews found`}
                               </p>
                               <p className="text-[10px] text-slate-400 font-medium mt-1">
                                  {reviewFilter === 'all'
                                    ? 'This customer has not given any ratings, reels, photos, or feedback yet.'
                                    : `There are currently no reviews matching status "${reviewFilter}".`}
                               </p>
                            </div>
                         </div>
                       )}
                    </div>
                  )}

                  {activeTab === 'Support' && (
                    <div className="space-y-6">
                       {/* Direct Communication Channels */}
                       <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                          <p className="text-[10px] font-black text-[#02006c] uppercase tracking-widest">Contact Customer Directly</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <a href={`tel:${customer.phone}`} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-blue-500 hover:text-blue-500 hover:shadow-md transition-all font-black text-[10px] text-slate-700 uppercase tracking-wider">
                                <Smartphone size={16} className="text-blue-500" />
                                CALL CLIENT ({customer.phone || 'N/A'})
                             </a>
                             <a href={`mailto:${customer.email}`} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-blue-500 hover:text-blue-500 hover:shadow-md transition-all font-black text-[10px] text-slate-700 uppercase tracking-wider">
                                <Mail size={16} className="text-blue-500" />
                                EMAIL CLIENT ({customer.email || 'N/A'})
                             </a>
                          </div>
                       </div>

                       {/* Support Tickets Raised */}
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Tickets Raised By Customer</p>
                          
                          {ticketsList.length > 0 ? (
                             ticketsList.map((ticket) => (
                                <div key={ticket.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all">
                                   <div className="space-y-1">
                                      <div className="flex items-center gap-3">
                                         <span className="text-[10px] font-black text-blue-600 font-roboto">{ticket.ticketId || ticket.id}</span>
                                         <span className="text-[8px] text-slate-400 font-bold uppercase">{ticket.date}</span>
                                         <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                                            ticket.priority === 'High' ? 'bg-red-55 text-red-655 border border-red-100' :
                                            ticket.priority === 'Medium' ? 'bg-amber-55 text-amber-655 border border-amber-100' : 'bg-green-55 text-green-655 border border-green-100'
                                         }`}>
                                            {ticket.priority} Priority
                                         </span>
                                      </div>
                                      <h4 className="text-xs font-black text-slate-900 font-montserrat uppercase tracking-tight mt-1">{ticket.subject}</h4>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Category: {ticket.category}</p>
                                   </div>
                                   <div className="flex items-center gap-4">
                                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                         ticket.status === 'Open' ? 'bg-red-50 text-red-600 border-red-100' :
                                         ticket.status === 'In-Progress' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'
                                      }`}>
                                         {ticket.status}
                                      </span>
                                      <button 
                                         onClick={() => navigate('/admin/support/tickets')} 
                                         className="p-2 bg-white text-slate-350 rounded-lg hover:text-blue-500 hover:border-blue-500 transition-all border border-slate-100"
                                         title="Open Support Helpdesk"
                                      >
                                         <ExternalLink size={14} />
                                      </button>
                                   </div>
                                </div>
                             ))
                          ) : (
                             <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-10 opacity-60">
                                <MessageSquare size={48} className="opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-center">0 Support Tickets Raised</p>
                             </div>
                          )}
                       </div>
                    </div>
                  )}
               </div>
            </div>
         </div>
      </div>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewVideoUrl && (
          <div 
            onClick={() => setPreviewVideoUrl(null)}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          >
            <motion.div 
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl md:max-w-2xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            >
              {/* Close Button */}
              <button 
                onClick={() => setPreviewVideoUrl(null)} 
                className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/60 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-all border border-white/10"
              >
                <X size={18} />
              </button>

              <video 
                src={previewVideoUrl} 
                className="w-full max-h-[80vh] object-contain mx-auto" 
                controls 
                autoPlay 
                playsInline 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {previewImageState && (
          <div 
            onClick={() => setPreviewImageState(null)}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          >
            <motion.div 
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-black/90 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col items-center"
            >
              {/* Header */}
              <div className="w-full px-6 py-4 flex items-center justify-between border-b border-white/10 text-white">
                <span className="text-xs font-black uppercase tracking-wider truncate max-w-[80%]">
                  {previewImageState.title || 'Review Photo'} {previewImageState.photos.length > 1 ? `(${previewImageState.index + 1} of ${previewImageState.photos.length})` : ''}
                </span>
                <button 
                  onClick={() => setPreviewImageState(null)} 
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Image with Prev/Next Controls */}
              <div className="relative w-full flex items-center justify-center p-4 min-h-[300px]">
                {previewImageState.photos.length > 1 && (
                  <button
                    onClick={prevImage}
                    className="absolute left-6 z-10 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-all border border-white/10"
                    title="Previous Photo"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                <img
                  src={previewImageState.url}
                  alt="Review High Resolution"
                  className="max-h-[75vh] max-w-full object-contain rounded-xl select-none"
                />

                {previewImageState.photos.length > 1 && (
                  <button
                    onClick={nextImage}
                    className="absolute right-6 z-10 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-all border border-white/10"
                    title="Next Photo"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerDetail;
