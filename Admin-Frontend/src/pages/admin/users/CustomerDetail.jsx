import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Mail, Smartphone, MapPin, 
  ShoppingBag, Star, MessageSquare, Wallet,
  Clock, ArrowLeft, ShieldAlert, CheckCircle2,
  ChevronRight, Calendar, ExternalLink, LayoutGrid
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

  const tabs = ['Orders', 'Wishlist', 'Reviews', 'Support'];

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
                   Customer ID: #{userId} • Member since {new Date(customer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
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

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
               <div className="flex border-b border-slate-50 overflow-x-auto no-scrollbar">
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
                        activeTab === tab 
                        ? 'text-blue-600 border-blue-600 bg-blue-50/20' 
                        : 'text-slate-400 border-transparent hover:text-slate-600'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
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
                                   <img src={item.image} alt={item.name} className="w-10 h-10 rounded-xl object-cover shadow-sm border border-slate-100" />
                                 ) : (
                                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100">
                                      <ShoppingBag size={18} />
                                   </div>
                                 )}
                                 <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Product ID: #{item.productId}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="text-right">
                                    <p className="text-sm font-black text-slate-900 font-roboto">₹{(item.price || 0).toLocaleString('en-IN')}</p>
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
                    <div className="space-y-4">
                       {reviewsList.length > 0 ? (
                         reviewsList.map((review) => (
                           <div key={review.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all">
                              <div className="flex items-start gap-4">
                                 {review.productImage ? (
                                   <img src={review.productImage} alt={review.productName} className="w-14 h-14 rounded-xl object-cover shadow-sm border border-slate-100 flex-shrink-0" />
                                 ) : (
                                   <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 flex-shrink-0">
                                      <ShoppingBag size={20} />
                                   </div>
                                 )}
                                 <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{review.productName}</p>
                                    <div className="flex items-center gap-1.5">
                                       <div className="flex text-amber-400">
                                          {Array.from({ length: 5 }).map((_, idx) => (
                                             <Star key={idx} size={12} className={idx < review.rating ? 'fill-current' : 'text-slate-200'} />
                                          ))}
                                       </div>
                                       <span className="text-[10px] text-slate-400 font-bold">{review.rating}/5 Rating</span>
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium italic mt-1">"{review.caption || 'No caption'}"</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{review.createdAt}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-4">
                                 {review.video && (
                                   <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black w-24 aspect-[9/16] shadow-sm flex-shrink-0">
                                      <video 
                                        src={getImageUrl(review.video)} 
                                        className="w-full h-full object-cover" 
                                        muted 
                                        controls 
                                      />
                                   </div>
                                 )}
                                 <div className="text-right flex flex-col items-end gap-1">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                                      review.status === 'approved' ? 'bg-green-50 text-green-600 border border-green-100' :
                                      review.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                    }`}>
                                       {review.status}
                                    </span>
                                 </div>
                              </div>
                           </div>
                         ))
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 py-10 opacity-60">
                            <MessageSquare size={48} className="opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-center">No reviews submitted yet</p>
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
    </div>
  );
};

export default CustomerDetail;
