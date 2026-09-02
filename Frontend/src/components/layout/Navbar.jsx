import React, { useState, useRef, useEffect } from 'react';
import { Bell, Heart, ShoppingCart, MapPin, ChevronDown, Search, Camera, Mic, Scan, X, Crosshair, MoreHorizontal, Home, Plus, Gamepad2, User, LogOut, Compass, Gift, Sparkles, HelpCircle, Wallet, Percent } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import toast from '../../utils/toast';
import { NOTIFICATIONS, CATEGORIES as MOCK_CATEGORIES } from '../../data/mockData';
import analytics from '../../utils/analytics';
import { cachedFetch } from '../../utils/apiCache';

const getCategoryIcon = (catId) => {
  const id = String(catId).toLowerCase();
  if (id.includes('men') || id.includes('women') || id.includes('kid') || id.includes('fashion') || id.includes('shoe') || id.includes('wear')) {
    return <User className="w-3.5 h-3.5" />;
  }
  if (id.includes('brand')) {
    return <Compass className="w-3.5 h-3.5" />;
  }
  if (id.includes('new') || id.includes('launch') || id.includes('trend')) {
    return <Sparkles className="w-3.5 h-3.5" />;
  }
  return <Compass className="w-3.5 h-3.5" />;
};

export default function Navbar() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const isHome = routerLocation.pathname === '/';

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (!scrollContainer) return;

    const handleScroll = (e) => {
      const currentScrollY = e.target.scrollTop;
      setIsScrolled((prev) => {
        if (!prev && currentScrollY > 150) {
          return true; // Collapse header when scrolling down past 150px
        }
        if (prev && currentScrollY < 20) {
          return false; // Expand header when scrolling back up near the top
        }
        return prev;
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const shouldHideTopSections = isHome && isScrolled;
  const {
    user,
    totalCartItems,
    wishlist,
    location,
    setLocation,
    searchQuery,
    setSearchQuery,
    isLocationModalOpen,
    setIsLocationModalOpen,
    logout,
    notifications,
    loadingNotifications,
    fetchNotifications,
    setNotifications
  } = useApp();

  const [tempLocation, setTempLocation] = useState(location);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const [savedAddresses, setSavedAddresses] = useState([]);

  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [newAddressForm, setNewAddressForm] = useState({ name: '', address: '', pincode: '' });

  const [categories, setCategories] = useState(() => 
    MOCK_CATEGORIES.filter(c => c.id !== 'for-you').slice(0, 5)
  );

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await cachedFetch('/homepage', { ttl: 5 });
        if (data.success && data.chips && data.chips.length > 0) {
          const activeChips = data.chips.filter(c => c.active && c.id !== 'for-you');
          const products = data.products || [];
          
          // Calculate product count for each category chip
          const chipsWithCounts = activeChips.map(c => {
            const catId = (c._id || '').toLowerCase();
            const catSlug = (c.id || '').toLowerCase();
            const catName = (c.categoryName || c.name || '').toLowerCase();
            
            const productCount = products.filter(p => {
              const prodCat = (p.category || '').toLowerCase();
              if (prodCat === catId || prodCat === catSlug) return true;
              
              const pCatObj = activeChips.find(ch => (ch._id || '').toLowerCase() === prodCat || (ch.id || '').toLowerCase() === prodCat);
              const pCatName = pCatObj ? (pCatObj.categoryName || pCatObj.name || '').toLowerCase() : '';
              return pCatName === catName && catName !== '';
            }).length;
            
            return {
              ...c,
              productCount
            };
          });
          
          // Sort by product count descending and take the top 5
          const sortedTop5 = chipsWithCounts
            .sort((a, b) => b.productCount - a.productCount)
            .slice(0, 5);
            
          setCategories(sortedTop5);
        }
      } catch (err) {
        console.error('Error fetching categories in Navbar:', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) {
        setSavedAddresses([]);
        return;
      }
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return;
        const res = await fetch(`${API_BASE}/addresses`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.status === 401) {
          logout();
          toast.error("Session expired. Please log in again.");
          return;
        }
        const data = await res.json();
        if (data.success) {
          const mapped = data.data.map(addr => ({
            id: addr._id,
            name: addr.name,
            type: addr.type,
            address: addr.address,
            pincode: addr.pincode
          }));
          setSavedAddresses(mapped);
        }
      } catch (err) {
        console.error("Failed to fetch addresses:", err);
      }
    };

    if (isLocationModalOpen) {
      fetchAddresses();
    }
  }, [user, isLocationModalOpen]);

  // Prevent background scrolling when location modal is open
  useEffect(() => {
    if (isLocationModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLocationModalOpen]);

  const filteredAddresses = savedAddresses.filter(addr => 
    addr.name.toLowerCase().includes(addressSearchQuery.toLowerCase()) || 
    addr.address.toLowerCase().includes(addressSearchQuery.toLowerCase())
  );

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      const toastId = toast.loading("Listening... Speak now 🎙️");

      recognition.onresult = (event) => {
        toast.dismiss(toastId);
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        analytics.trackSearch(transcript);
        toast.success(`Voice search: "${transcript}"`);
        if (routerLocation.pathname !== '/categories') {
          navigate('/categories');
        }
      };

      recognition.onspeechstart = () => {
        console.log('🎙️ [SpeechRecognition] Speech start detected');
      };

      recognition.onspeechend = () => {
        console.log('🎙️ [SpeechRecognition] Speech end detected');
      };

      recognition.onsoundstart = () => {
        console.log('🎙️ [SpeechRecognition] Sound start detected');
      };

      recognition.onsoundend = () => {
        console.log('🎙️ [SpeechRecognition] Sound end detected');
      };

      recognition.onerror = (event) => {
        toast.dismiss(toastId);
        console.error('Speech recognition error', event.error);
      };

      recognition.start();
    } else {
      toast.error("Your browser doesn't support voice search.");
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.info('Image size cannot exceed 10MB!');
        return;
      }
      setSearchQuery("Camera search result");
      analytics.trackSearch("Camera visual search");
      if (window.location.pathname !== '/categories') {
        navigate('/categories');
      }
      toast.success("Image captured! Performing visual search...");
    }
  };

  const handleSaveLocation = (loc) => {
    setLocation(loc);
    setIsLocationModalOpen(false);
  };

  const markNotificationsAsRead = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('userToken');
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Update local read status
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const markSingleNotificationAsRead = async (id) => {
    if (!user) return;
    try {
      const token = localStorage.getItem('userToken');
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Update local read status for this notification only
      setNotifications(prev => prev.map(notif => notif._id === id ? { ...notif, read: true } : notif));
    } catch (err) {
      console.error('Error marking single notification as read:', err);
    }
  };

  useEffect(() => {
    if (isNotificationModalOpen) {
      fetchNotifications();
    }
  }, [isNotificationModalOpen]);

  return (
    <>
      {/* MOBILE HEADER: Visible only on screen sizes < md */}
      <header className="sticky top-0 z-50 bg-white text-[#0B132B] shadow-sm transition-all duration-300 pb-2 md:hidden">
        {/* Compact Main top header */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${shouldHideTopSections ? 'max-h-0 opacity-0' : 'max-h-[100px] opacity-100'}`}>
          <div className="flex items-center justify-between px-2.5 py-1 bg-transparent">
            <div className="flex items-center gap-2 cursor-pointer animate-fade-in" onClick={() => navigate('/')}>
              {/* Logo image */}
              <img
                src="/aramish-logo.png"
                alt="Aramish Logo"
                className="h-16 object-contain hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.target.alt = "Aramish";
                }}
              />
            </div>

            {/* Color theme updated to white for dark bg */}
            <div className="flex items-center gap-3 text-[#0B132B]">
              <button 
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    setIsNotificationModalOpen(true);
                  }
                }}
                className="relative p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Bell className="w-5.5 h-5.5 stroke-[1.8]" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-surface border-2 border-[#0B132B] rounded-full"></span>
                )}
              </button>
              <button 
                onClick={() => navigate('/wishlist')}
                className="relative p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Heart className="w-5.5 h-5.5 stroke-[1.8]" />
                {user && wishlist && wishlist.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-surface border border-[#0B132B] rounded-full"></span>
                )}
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="relative p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ShoppingCart className="w-5.5 h-5.5 stroke-[1.8]" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-surface text-[8.5px] font-black text-[#0B132B] ring-1.5 ring-[#0B132B] animate-pulse">
                    {totalCartItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Location selector bar with INCREASED WIDTH (px-1.5) and DECREASED BORDER RADIUS (rounded-lg) */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${shouldHideTopSections ? 'max-h-0 opacity-0' : 'max-h-[100px] opacity-100'}`}>
          <div className="px-2 py-1 bg-transparent">
            <div
              onClick={() => setIsLocationModalOpen(true)}
              className="bg-slate-100 border border-white/30 text-[#0B132B] flex items-center justify-between px-4 py-2.5 rounded-lg text-[10.5px] font-black cursor-pointer hover:bg-surface/30 shadow-md shadow-black/5 active:scale-[0.99] transition-all duration-300"
            >
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-4 h-4 text-[#0B132B] flex-shrink-0" />
                <span className="truncate tracking-wide">
                  HOME &nbsp;<span className="font-normal text-orange-50/90">| &nbsp;{location}</span>
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-[#0B132B] flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Search bar row */}
        <div className="px-2 pt-1.5">
          <div className="flex items-center gap-2">
            {/* Search Input Bar (Symmetrical rounded-lg and increased height with py-2) */}
            <div className="flex-1 relative flex items-center bg-surface rounded-lg px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-white/50 transition-all duration-300 shadow-3xs">
              <Search className="w-4.5 h-4.5 text-slate-500 mr-2.5" />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full bg-transparent text-sm text-[#02006c] outline-none placeholder-slate-400 font-semibold cursor-pointer"
                value={searchQuery}
                readOnly
                onClick={() => navigate('/search')}
              />
              {/* Voice search Mic option inside input capsule */}
              <div className="flex items-center gap-2 ml-2.5">
                <Mic 
                  onClick={handleVoiceSearch}
                  className="w-4.5 h-4.5 text-slate-500 cursor-pointer hover:text-[#0B132B] transition-colors" 
                />
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* DESKTOP HEADER: Visible on screen sizes >= md */}
      <header className="hidden md:block sticky top-0 z-[60] bg-white text-[#0B132B] shadow-md select-none">
        {/* Main top header bar */}
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 cursor-pointer transition-transform duration-300 hover:scale-102" onClick={() => navigate('/')}>
              <img
                src="/aramish-logo.png"
                alt="Aramish Logo"
                className="h-16 object-contain hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.target.alt = "Aramish";
                }}
              />
            </div>

            {/* Location selector capsule */}
            <div
              onClick={() => setIsLocationModalOpen(true)}
              className="bg-surface/10 hover:bg-slate-100 border border-white/25 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all duration-200 truncate max-w-[200px]"
              title={location}
            >
              <MapPin className="w-3.5 h-3.5 text-[#0B132B] flex-shrink-0" />
              <span className="truncate tracking-wide font-black">
                HOME | <span className="font-normal text-orange-100">{location}</span>
              </span>
              <ChevronDown className="w-3 h-3 text-[#0B132B] flex-shrink-0" />
            </div>
          </div>

          {/* Search bar wrapper */}
          <div className="flex-1 max-w-xl relative flex items-center bg-surface rounded-lg px-4 py-2 focus-within:ring-2 focus-within:ring-orange-200 transition-all duration-300 shadow-sm text-slate-800">
            <Search className="w-4.5 h-4.5 text-slate-500 mr-2.5 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search for sneakers, boots, formal shoes..."
              className="w-full bg-transparent text-sm text-[#02006c] outline-none placeholder-slate-400 font-semibold cursor-pointer"
              value={searchQuery}
              readOnly
              onClick={() => navigate('/search')}
            />
            {/* Action buttons inside search */}
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <Mic 
                onClick={handleVoiceSearch}
                className="w-4.5 h-4.5 text-slate-500 cursor-pointer hover:text-[#0B132B] transition-colors" 
                title="Voice Search"
              />
            </div>
          </div>

          {/* Right Action Menu Icons */}
          <div className="flex items-center gap-4 text-[#0B132B] flex-shrink-0">

            {/* Notifications */}
            <button 
              onClick={() => {
                if (!user) navigate('/login');
                else setIsNotificationModalOpen(true);
              }}
              className="p-2 hover:bg-surface/10 rounded-full transition-colors flex items-center justify-center relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5 stroke-[1.8]" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-surface border border-[#0B132B] rounded-full"></span>
              )}
            </button>

            {/* Wishlist */}
            <button 
              onClick={() => navigate('/wishlist')}
              className="p-2 hover:bg-surface/10 rounded-full transition-colors flex items-center justify-center relative cursor-pointer"
              title="Wishlist"
            >
              <Heart className="w-5 h-5 stroke-[1.8]" />
              {user && wishlist && wishlist.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-surface border border-[#0B132B] rounded-full"></span>
              )}
            </button>

            {/* Cart */}
            <button 
              onClick={() => navigate('/cart')}
              className="p-2 hover:bg-surface/10 rounded-full transition-colors flex items-center justify-center relative cursor-pointer"
              title="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 stroke-[1.8]" />
              {totalCartItems > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-surface text-[9px] font-black text-[#0B132B] ring-1.5 ring-[#0B132B]">
                  {totalCartItems}
                </span>
              )}
            </button>

            {/* User Account / Profile Dropdown */}
            <div className="relative">
              {user ? (
                <div>
                  <button 
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    onBlur={() => setTimeout(() => setProfileDropdownOpen(false), 200)}
                    className="flex items-center gap-1.5 bg-surface/10 hover:bg-surface/15 px-3 py-1.5 rounded-lg border border-[#0B132B]/30 cursor-pointer transition-all duration-200"
                  >
                    <User className="w-4 h-4 text-[#0B132B]" />
                    <span className="text-xs font-bold text-[#0B132B] max-w-[80px] truncate">{user.name}</span>
                    <ChevronDown className="w-3 h-3 text-[#0B132B]" />
                  </button>
                  
                  {/* Dropdown Card */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-surface text-slate-800 rounded-xl shadow-xl border border-[#0B132B]/20 py-1.5 z-[100] animate-fade-in">
                      <div className="px-4 py-2 border-b border-[#0B132B]/20">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account</p>
                        <p className="text-xs font-black text-slate-800 truncate">{user.name}</p>
                      </div>
                      
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate('/profile');
                          setProfileDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-surface flex items-center gap-2"
                      >
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        My Profile
                      </button>
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate('/orders');
                          setProfileDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-surface flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                        My Orders
                      </button>
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate('/saved-addresses');
                          setProfileDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-surface flex items-center gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        Addresses
                      </button>
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate('/wallet');
                          setProfileDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-surface flex items-center gap-2"
                      >
                        <Wallet className="w-3.5 h-3.5 text-slate-500" />
                        Wallet & Coins
                      </button>
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          navigate('/coupons');
                          setProfileDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-surface flex items-center gap-2"
                      >
                        <Percent className="w-3.5 h-3.5 text-slate-500" />
                        My Coupons
                      </button>
                      
                      <div className="border-t border-[#0B132B]/20 my-1"></div>
                      <button 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          logout();
                          setProfileDropdownOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => navigate('/login')}
                  className="bg-surface hover:bg-gold/10 text-[#0B132B] text-xs font-black px-4.5 py-2 rounded-lg transition-colors cursor-pointer shadow-3xs"
                >
                  Login / Register
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sub-header with Category Nav */}
        <div className="bg-surface text-[#02006c] border-b border-[#0B132B]/20">
          <div className="max-w-7xl mx-auto px-12 lg:px-24 py-2.5 flex items-center justify-between text-xs font-bold tracking-wide">
            {/* Category horizontal list */}
            <div className="flex items-center gap-6 lg:gap-8">
              <button 
                onClick={() => navigate('/')} 
                className={`hover:text-[#0B132B] transition-colors cursor-pointer flex items-center gap-1 ${routerLocation.pathname === '/' ? 'text-[#0B132B]' : ''}`}
              >
                <Home className="w-3.5 h-3.5" />
                Home
              </button>
              {categories.map((cat) => {
                const isActive = routerLocation.pathname.startsWith('/categories') && 
                                 (routerLocation.search.includes(`cat=${cat.id}`) || routerLocation.search.includes(`cat=${cat._id}`));
                return (
                  <button 
                    key={cat.id || cat._id}
                    onClick={() => navigate(`/categories?cat=${cat.id || cat._id}`)} 
                    className={`hover:text-[#0B132B] transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap capitalize ${isActive ? 'text-[#0B132B]' : ''}`}
                  >
                    {getCategoryIcon(cat.id)}
                    {cat.categoryName || cat.name}
                  </button>
                );
              })}
            </div>

            {/* Right-aligned links */}
            <div className="flex items-center gap-5 text-[#64748B]">

              <button onClick={() => navigate('/refer')} className="hover:text-[#0B132B] transition-colors cursor-pointer flex items-center gap-1 font-bold">
                <Gift className="w-3.5 h-3.5 text-teal-600" />
                Refer & Earn
              </button>
              <button onClick={() => navigate('/support')} className="hover:text-[#0B132B] transition-colors cursor-pointer flex items-center gap-1 font-bold">
                <HelpCircle className="w-3.5 h-3.5" />
                Help
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Delivery Address Modal - Responsive wrapper centering on desktop */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300 p-0 md:p-4">
          <div className="w-full max-w-md md:rounded-2xl bg-surface rounded-t-3xl p-5 shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">
            {/* Drag Handle */}
            <div className="w-10 h-1 bg-surface rounded-full mx-auto mb-4 md:hidden" />
            
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-[17px] font-bold text-[#02006c] nunito-heading">Select delivery address</h3>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto scrollbar-none pb-24 md:pb-4 flex-grow space-y-5">
              {/* Search Bar */}
              <div className="relative flex items-center bg-surface rounded-xl border border-[#0B132B]/20 px-3 py-2.5 shadow-3xs focus-within:border-[#0B132B] focus-within:ring-2 focus-within:ring-orange-100 transition-all">
                <Search className="w-4 h-4 text-slate-500 mr-2.5" />
                <input
                  type="text"
                  placeholder="Search by area, street name, pin code"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder-slate-400 font-medium"
                  value={addressSearchQuery}
                  onChange={(e) => setAddressSearchQuery(e.target.value)}
                />
              </div>


              {/* Saved Addresses Header */}
              <div className="flex items-center justify-between mt-2 mb-3">
                <h4 className="text-[13px] font-bold text-[#0F172A] nunito-heading">Saved addresses</h4>
                <button 
                  onClick={() => {
                    if (isAddingNewAddress) {
                      setIsAddingNewAddress(false);
                      setEditingAddressId(null);
                      setNewAddressForm({ name: '', address: '', pincode: '' });
                    } else {
                      setIsAddingNewAddress(true);
                      setEditingAddressId(null);
                      setNewAddressForm({ name: '', address: '', pincode: '' });
                    }
                  }}
                  className="text-[#0B132B] text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  {isAddingNewAddress ? "Cancel" : <><Plus className="w-3.5 h-3.5" /> Add New</>}
                </button>
              </div>

              {/* Address List */}
              <div className="space-y-5">
                {isAddingNewAddress ? (
                  <div className="bg-gold/10 p-4 rounded-xl border border-gold/20 space-y-3 animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Name</label>
                      <input 
                        type="text" 
                        value={newAddressForm.name}
                        onChange={(e) => setNewAddressForm({...newAddressForm, name: e.target.value})}
                        className="w-full border border-[#0B132B]/20 rounded-lg px-3 py-2 text-sm focus:border-[#0B132B] focus:outline-none bg-surface font-medium" 
                        placeholder="e.g. John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Pin Code <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={newAddressForm.pincode}
                        onChange={(e) => setNewAddressForm({...newAddressForm, pincode: e.target.value.replace(/[^0-9]/g, '')})}
                        className="w-full border border-[#0B132B]/20 rounded-lg px-3 py-2 text-sm focus:border-[#0B132B] focus:outline-none bg-surface font-medium" 
                        placeholder="e.g. 452010"
                        maxLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Full Address</label>
                      <textarea 
                        value={newAddressForm.address}
                        onChange={(e) => setNewAddressForm({...newAddressForm, address: e.target.value})}
                        className="w-full border border-[#0B132B]/20 rounded-lg px-3 py-2 text-sm focus:border-[#0B132B] focus:outline-none bg-surface min-h-[80px] font-medium" 
                        placeholder="e.g. 123 Main St, Apartment 4B..."
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        if (!newAddressForm.name || !newAddressForm.address || !newAddressForm.pincode) {
                          toast.info("Please fill in all mandatory fields, including the Pin Code.");
                          return;
                        }
                        if (!user) {
                          toast.info("Please login to save addresses.");
                          return;
                        }
                        try {
                          const token = localStorage.getItem('userToken');
                          const url = editingAddressId 
                            ? `${API_BASE}/addresses/${editingAddressId}`
                            : `${API_BASE}/addresses`;
                          const method = editingAddressId ? 'PUT' : 'POST';

                          const res = await fetch(url, {
                            method,
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              name: newAddressForm.name,
                              type: 'Home',
                              address: newAddressForm.address,
                              pincode: newAddressForm.pincode
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            toast.success(editingAddressId ? "Address updated!" : "Address saved!");
                            // Refresh addresses
                            const updatedRes = await fetch(`${API_BASE}/addresses`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const updatedData = await updatedRes.json();
                            if (updatedData.success) {
                              setSavedAddresses(updatedData.data.map(addr => ({
                                id: addr._id,
                                name: addr.name,
                                type: addr.type,
                                address: addr.address,
                                pincode: addr.pincode
                              })));
                            }
                            setIsAddingNewAddress(false);
                            setEditingAddressId(null);
                            setNewAddressForm({ name: '', address: '', pincode: '' });
                          } else {
                            toast.error(data.message || "Failed to save address");
                          }
                        } catch (err) {
                          console.error(err);
                          toast.error("Failed to save address.");
                        }
                      }}
                      className="w-full bg-[#0B132B] text-[#0B132B] text-sm font-bold py-2.5 rounded-lg hover:bg-gold transition-colors cursor-pointer"
                    >
                      {editingAddressId ? "Update Address" : "Save Address"}
                    </button>
                    {editingAddressId && (
                      <button
                        onClick={async () => {
                          if (!user) return;
                          if (!confirm("Are you sure you want to delete this address?")) return;
                          try {
                            const token = localStorage.getItem('userToken');
                            const res = await fetch(`${API_BASE}/addresses/${editingAddressId}`, {
                              method: 'DELETE',
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });
                            const data = await res.json();
                            if (data.success) {
                              toast.success("Address deleted!");
                              setSavedAddresses(prev => prev.filter(a => a.id !== editingAddressId));
                              setIsAddingNewAddress(false);
                              setEditingAddressId(null);
                              setNewAddressForm({ name: '', address: '', pincode: '' });
                            } else {
                              toast.error(data.message || "Failed to delete address");
                            }
                          } catch (err) {
                            console.error(err);
                            toast.error("Failed to delete address");
                          }
                        }}
                        className="w-full bg-red-500 text-[#0B132B] text-sm font-bold py-2.5 rounded-lg hover:bg-red-600 transition-colors mt-2 cursor-pointer"
                      >
                        Delete Address
                      </button>
                    )}
                  </div>
                ) : (
                  filteredAddresses.map((addr) => {
                    const isSelected = location === addr.address || (location === "Delhi, India" && addr.id === 1);
                    return (
                      <div key={addr.id} className="flex items-start gap-3 w-full group animate-fade-in">
                        <Home className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-[#0B132B]' : 'text-slate-500'}`} />
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleSaveLocation(addr.address)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-bold text-[#0F172A]">{addr.name}</span>
                            {isSelected && (
                              <span className="bg-gold/10 text-[#0B132B] text-[9px] font-bold px-1.5 py-0.5 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug pr-4 font-medium">{addr.address}</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAddressId(addr.id);
                            setNewAddressForm({
                              name: addr.name,
                              address: addr.address,
                              pincode: addr.pincode || ''
                            });
                            setIsAddingNewAddress(true);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })
                )}
                {!isAddingNewAddress && filteredAddresses.length === 0 && (
                  <div className="text-center py-4 text-slate-500 text-sm font-medium animate-fade-in">
                    No addresses found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal - Responsive wrapper centering on desktop */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300 p-0 md:p-4">
          <div className="w-full max-w-md md:rounded-2xl bg-surface rounded-t-3xl p-6 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between mb-4 border-b border-[#0B132B]/20 pb-3 flex-shrink-0">
              <div className="flex items-baseline gap-3">
                <h3 className="text-base font-bold text-[#02006c] nunito-heading">Notifications</h3>
                {notifications.some(n => !n.read) && (
                  <button 
                    onClick={markNotificationsAsRead}
                    className="text-[10px] font-black text-[#0B132B] uppercase tracking-wider hover:underline cursor-pointer"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsNotificationModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pb-24 md:pb-4 scrollbar-none">
              {loadingNotifications ? (
                <div className="text-center py-8 text-slate-500 text-xs font-medium">
                  Loading notifications...
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div 
                    key={notif._id} 
                    onClick={() => !notif.read && markSingleNotificationAsRead(notif._id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${notif.read ? 'bg-surface border-[#0B132B]/20 hover:bg-surface' : 'bg-gold/10 border-gold/20 hover:bg-gold/10'}`}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className={`text-sm font-bold nunito-heading ${notif.read ? 'text-slate-700' : 'text-[#02006c]'}`}>{notif.title}</h4>
                      {!notif.read && <span className="w-2 h-2 rounded-full bg-[#0B132B] flex-shrink-0 mt-1.5"></span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{notif.body}</p>
                    <span className="text-[10px] text-slate-500 mt-2 block font-medium">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm font-medium">
                  No notifications yet!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

