import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Users, LogOut,
  Bell, Search, Menu, ShieldCheck, Briefcase, Layers, Star,
  Truck, Store, Key, Settings, ChevronDown, ChevronRight,
  UserPlus, DollarSign, BarChart3, HelpCircle, FileText, Image, LayoutGrid, Layout, Bookmark,
  Tag, Zap, MessageSquare, RotateCcw, Inbox, Gamepad2,
  Banknote, Percent, AlertCircle, CheckCircle2, GitBranch
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OptimizedImage from '../components/common/OptimizedImage';

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Auth Guard - redirect to login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/auth', { replace: true });
    }
  }, [navigate]);

  // Get logged in admin info as reactive state
  const [adminInfo, setAdminInfo] = useState(() => {
    return JSON.parse(localStorage.getItem('adminInfo') || '{"name":"Admin","email":"admin@gmail.com"}');
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      setAdminInfo(JSON.parse(localStorage.getItem('adminInfo') || '{"name":"Admin","email":"admin@gmail.com"}'));
    };
    window.addEventListener('adminInfoUpdated', handleProfileUpdate);
    return () => window.removeEventListener('adminInfoUpdated', handleProfileUpdate);
  }, []);

  // Proper logout function
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    navigate('/admin/auth', { replace: true });
  };

  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/analytics/notifications/system`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const menuGroups = [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
        { name: 'Analytics', path: '/admin/analytics', icon: <BarChart3 size={18} /> },
        { name: 'Customers', path: '/admin/users', icon: <Users size={18} /> },
      ]
    },
    {
      title: 'STOREFRONT',
      items: [
        { name: 'Banner Manager', path: '/admin/storefront/banners', icon: <Image size={18} /> },
        { name: 'Category Chips', path: '/admin/storefront/chips', icon: <LayoutGrid size={18} /> },
        { name: 'Subcategory Chips', path: '/admin/storefront/subchips', icon: <LayoutGrid size={18} /> },
      ]
    },
    {
      title: 'BUSINESS OPS',
      items: [
        {
          name: 'Products Management',
          icon: <Package size={18} />,
          subItems: [
            { name: 'All Products', path: '/admin/inventory/all' },
            { name: 'Add Product', path: '/admin/inventory/add' },
            { name: 'Stock Alerts', path: '/admin/inventory/alerts' },
          ]
        },
        { name: 'Orders', path: '/admin/orders', icon: <ShoppingCart size={18} /> },
        { name: 'Returns & Refunds', path: '/admin/operations/returns', icon: <RotateCcw size={18} /> },
      ]
    },
    {
      title: 'PROMOTIONS',
      items: [
        { name: 'Coupon Manager', path: '/admin/promotions/coupons', icon: <Tag size={18} /> },
        { name: 'Game Manager', path: '/admin/promotions/games', icon: <Gamepad2 size={18} /> },
        { name: 'Referral Program', path: '/admin/promotions/referrals', icon: <GitBranch size={18} /> },
      ]
    },
    {
      title: 'COMMS',
      items: [
        { name: 'Notification Hub', path: '/admin/comms/notifications', icon: <Bell size={18} /> },
        { name: 'Support Tickets', path: '/admin/support/tickets', icon: <HelpCircle size={18} /> },
      ]
    },
    {
      title: 'CONTENT',
      items: [
        { name: 'Review Moderation', path: '/admin/content/reviews', icon: <MessageSquare size={18} /> },
        { name: 'FAQs', path: '/admin/content/qna', icon: <HelpCircle size={18} /> },
        { name: 'Legal & Policies', path: '/admin/content/legal', icon: <FileText size={18} /> },
      ]
    },
    {
      title: 'FINANCE',
      items: [
        { name: 'Earnings', path: '/admin/finance/earnings', icon: <DollarSign size={18} /> },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
      ]
    }
  ];

  const quickLinks = [];
  menuGroups.forEach(group => {
    group.items.forEach(item => {
      if (item.subItems) {
        item.subItems.forEach(sub => {
          quickLinks.push({ name: sub.name, path: sub.path });
        });
      } else {
        quickLinks.push({ name: item.name, path: item.path });
      }
    });
  });

  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/admin/analytics/search/global?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Error performing global search:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const filteredLinks = quickLinks.filter(link => 
    link.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSubMenu = (name) => {
    setOpenMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };


  const getPageTitle = () => {
    const currentPath = location.pathname;
    for (const group of menuGroups) {
      for (const item of group.items) {
        if (item.path === currentPath) return item.name;
        if (item.subItems) {
          const sub = item.subItems.find(s => s.path === currentPath);
          if (sub) return sub.name;
        }
      }
    }
    return 'Admin Console';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-blue-900 font-nunito">
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-white border-r border-slate-200 transition-all duration-500 ease-in-out flex flex-col fixed inset-y-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}
      >
        <div className="h-20 flex items-center px-6 gap-3">
          {isSidebarOpen ? (
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              <img 
                src="/HopeFinal.webp" 
                alt="Logo" 
                className="h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
              />
            </Link>
          ) : (
            <div className="w-12 h-12 flex items-center justify-center transition-all">
              <img 
                src="/HopeFinal.webp" 
                alt="Logo" 
                className="h-10 w-10 object-contain" 
              />
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 px-3 space-y-6 overflow-y-auto no-scrollbar">
          {menuGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              {isSidebarOpen && (
                <h3 className="px-4 text-[13px] font-[800] text-orange-600 uppercase tracking-[2px]">
                  {group.title}
                </h3>
              )}
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isMenuOpen = !!openMenus[item.name];
                  const isActive = location.pathname === item.path ||
                    (hasSubItems && item.subItems.some(sub => location.pathname === sub.path));

                  if (hasSubItems) {
                    return (
                      <div key={item.name} className="space-y-1">
                        <button
                          onClick={() => toggleSubMenu(item.name)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 transition-all outline-none focus:outline-none focus:ring-0 ${isActive
                              ? 'bg-blue-50 text-blue-500 rounded-md'
                              : 'text-blue-900/60 hover:bg-blue-50/50 hover:text-blue-500 rounded-xl'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`flex-shrink-0 ${isActive ? 'text-blue-500' : ''}`}>{item.icon}</span>
                            {isSidebarOpen && <span className="font-bold text-[17px] font-raleway whitespace-nowrap">{item.name}</span>}
                          </div>
                          {isSidebarOpen && (
                            <span className="opacity-40">{isMenuOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                          )}
                        </button>

                        <AnimatePresence>
                          {isMenuOpen && isSidebarOpen && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="ml-10 space-y-1.5 border-l-2 border-slate-100 pl-5 overflow-hidden"
                            >
                              {item.subItems.map((sub) => (
                                <Link
                                  key={sub.path}
                                  to={sub.path}
                                  className={`block py-2.5 text-[16px] font-bold transition-all outline-none focus:outline-none ${location.pathname === sub.path
                                      ? 'text-blue-500'
                                      : 'text-slate-400 hover:text-blue-500'
                                    }`}
                                >
                                  {sub.name}
                                </Link>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-all outline-none focus:outline-none focus:ring-0 ${isActive
                          ? 'bg-blue-500 text-white shadow-md shadow-blue-100/30 rounded-md'
                          : 'text-blue-900/60 hover:bg-blue-50/50 hover:text-blue-500 rounded-xl'
                        }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {isSidebarOpen && <span className="font-bold text-[17px] font-raleway whitespace-nowrap">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-slate-50 space-y-3">
            <div 
              onClick={() => navigate('/admin/settings')}
              className={`p-4 bg-blue-50 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-blue-100 transition-all`}
            >
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-xs text-blue-500 border border-blue-100 overflow-hidden">
                 {adminInfo.avatar ? (
                    <OptimizedImage src={adminInfo.avatar} alt="Admin" type="default" className="w-full h-full" />
                 ) : (
                    adminInfo.name?.charAt(0).toUpperCase() || 'A'
                 )}
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                   <p className="text-[11px] font-bold text-blue-500 uppercase leading-none truncate">{adminInfo.name || 'Super Admin'}</p>
                   <p className="text-[10px] text-green-500 font-bold mt-1 flex items-center gap-1">
                      <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> Live & Secure
                   </p>
                </div>
              )}
           </div>
           <button
             onClick={handleLogout}
             className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-red-400 hover:bg-red-50 hover:text-red-500 ${!isSidebarOpen ? 'justify-center' : ''}`}
           >
             <LogOut size={16} />
             {isSidebarOpen && <span className="font-bold text-[13px]">Logout</span>}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 min-w-0 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'pl-72' : 'pl-24'}`}>
        {/* Topbar */}
        <header className="h-24 bg-white border-b border-slate-100 sticky top-0 z-40 px-10 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 border border-blue-50 flex items-center justify-center rounded-xl hover:bg-blue-50 transition-all shadow-sm active:scale-90"
            >
              <Menu size={18} className="text-blue-500" />
            </button>

            <div className="hidden lg:block">
              <h2 className="text-xl font-semibold text-slate-900 uppercase tracking-tight font-montserrat">{getPageTitle()}</h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 font-raleway">
                Admin Management • Verified Session
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(e.target.value.length > 0);
                }}
                onFocus={() => searchQuery.length > 0 && setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                placeholder="Search global records..."
                className="bg-blue-50/50 border-none rounded-[20px] py-3.5 pl-14 pr-8 text-[14px] font-bold focus:ring-4 focus:ring-blue-100 w-96 shadow-inner transition-all text-blue-900"
              />

              {/* Search Dropdown */}
              <AnimatePresence>
                {showSearchDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-[24px] shadow-2xl overflow-hidden z-50 p-3 max-h-96 overflow-y-auto no-scrollbar"
                  >
                    {/* Quick Navigation Section */}
                    {filteredLinks.length > 0 && (
                      <div className="mb-2">
                        <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Navigation</p>
                        {filteredLinks.map(link => (
                          <button
                            key={link.path}
                            onClick={() => {
                              navigate(link.path);
                              setSearchQuery('');
                              setShowSearchDropdown(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 rounded-xl text-xs font-bold text-slate-700 transition-all text-left"
                          >
                            <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                              <Layers size={12} />
                            </div>
                            {link.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Database Results Section */}
                    {searchResults.length > 0 && (
                      <div>
                        <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Database Records</p>
                        {searchResults.map((res, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              navigate(res.path);
                              setSearchQuery('');
                              setShowSearchDropdown(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 rounded-xl text-xs font-bold text-slate-700 transition-all text-left"
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${res.type === 'Product' ? 'bg-amber-100 text-amber-600' : res.type === 'Customer' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                              {res.type.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 truncate">{res.name}</p>
                              <p className="text-[9px] text-slate-400 font-medium truncate">{res.type} • {res.extra}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredLinks.length === 0 && searchResults.length === 0 && (
                      <p className="px-4 py-6 text-xs text-slate-400 font-medium text-center">No matching records found.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3">
               <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`w-12 h-12 border rounded-2xl flex items-center justify-center relative transition-all ${showNotifications ? 'bg-blue-500 text-white border-blue-500 shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm'}`}
                  >
                     <Bell size={20} />
                     {!showNotifications && notifications.length > 0 && <div className="absolute top-3.5 right-3.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />}
                  </button>

                  {/* Notifications Dropdown */}
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-100 rounded-[28px] shadow-2xl z-50 overflow-hidden"
                      >
                         <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <h4 className="font-black text-[11px] uppercase tracking-widest text-slate-900">Notifications</h4>
                            <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-full">{notifications.length} New</span>
                         </div>
                         <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                            {notifications.length === 0 ? (
                              <p className="px-5 py-8 text-center text-xs font-bold text-slate-400">No new notifications</p>
                            ) : (
                              notifications.map(n => (
                                <button key={n.id} className="w-full p-5 flex gap-4 hover:bg-slate-50 transition-all text-left border-b border-slate-50 last:border-0">
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.type === 'warning' ? 'bg-amber-100 text-amber-600' : n.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                      {n.type === 'warning' ? <AlertCircle size={18} /> : n.type === 'success' ? <CheckCircle2 size={18} /> : <Bell size={18} />}
                                   </div>
                                   <div>
                                      <p className={`text-xs font-bold ${n.read ? 'text-slate-500' : 'text-slate-900'}`}>{n.title}</p>
                                      <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">{n.time}</p>
                                      <p className="text-[10px] text-slate-500 font-normal mt-0.5">{n.desc}</p>
                                   </div>
                                </button>
                              ))
                            )}
                         </div>
                        <button 
                          onClick={() => { navigate('/admin/comms/notifications'); setShowNotifications(false); }}
                          className="w-full py-4 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-all"
                        >
                           View All Notifications
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
               <div 
                 onClick={() => navigate('/admin/settings')}
                 className={`w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white font-semibold text-lg shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-all overflow-hidden`}
               >
                 {adminInfo.avatar ? (
                    <OptimizedImage src={adminInfo.avatar} alt="Admin" type="default" className="w-full h-full" />
                 ) : (
                    adminInfo.name?.charAt(0).toUpperCase() || 'A'
                 )}
               </div>
            </div>
          </div>
        </header>

        <main className="p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
