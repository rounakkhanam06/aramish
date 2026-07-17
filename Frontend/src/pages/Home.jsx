import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sparkles, Gift, Gamepad2, Gem, Heart, LayoutGrid, Compass, HelpCircle, Layers, MapPin, Trophy, ShieldAlert, Truck, RotateCcw, ShieldCheck, Tag, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, BANNERS, VALUE_PROPS } from '../data/mockData';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ui/ProductCard';
import OptimizedImage from '../components/ui/OptimizedImage';
import LazySection from '../components/ui/LazySection';
import { cachedFetch } from '../utils/apiCache';
import { getImageUrl } from '../utils/imageHelper';
import { formatDiscount } from '../utils/discountHelper';

export default function Home() {
  const navigate = useNavigate();
  const { searchQuery, toggleWishlist, isInWishlist, user } = useApp();
  const [activeBanner, setActiveBanner] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('for-you');
  const [activeFlashTab, setActiveFlashTab] = useState('All');
  const [budgetFilter, setBudgetFilter] = useState(null);

  const [categories, setCategories] = useState(CATEGORIES);
  const [dynamicBanners, setDynamicBanners] = useState([]);

  // Dynamic Products from API
  const [rawAllProducts, setRawAllProducts] = useState([]);
  const [crazyDealsProducts, setCrazyDealsProducts] = useState([]);
  const [flashSaleProducts, setFlashSaleProducts] = useState([]);
  const [topSelectionProducts, setTopSelectionProducts] = useState([]);
  const [subCategoryChips, setSubCategoryChips] = useState([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');
  const [productsLoading, setProductsLoading] = useState(true);
  const [topBuys, setTopBuys] = useState([]);
  const [trendingBrands, setTrendingBrands] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchHomepageData = async () => {
      try {
        setProductsLoading(true);
        const data = await cachedFetch('/homepage', { ttl: 5, signal: controller.signal });
        if (data.success) {
          if (data.chips && data.chips.length > 0) {
            const activeChips = data.chips.filter(c => c.active && c.id !== 'for-you');
            const forYouChip = CATEGORIES.find(c => c.id === 'for-you') || { id: 'for-you', name: 'For You', active: true };
            setCategories([forYouChip, ...activeChips]);
          }

          if (data.banners) {
            setDynamicBanners(data.banners.filter(b => b.active));
          }

          if (data.products) {
            const allProducts = data.products;
            setRawAllProducts(allProducts);
            setCrazyDealsProducts(allProducts.filter(p => p.flags?.crazyDeals));
            setFlashSaleProducts(allProducts.filter(p => p.flags?.flashSale));
            setTopSelectionProducts(allProducts.filter(p => p.flags?.topSection));
          }

          if (data.topBuys) {
            setTopBuys(data.topBuys);
          }

          if (data.trendingBrands) {
            setTrendingBrands(data.trendingBrands);
          }

          if (data.subchips) {
            setSubCategoryChips(data.subchips.filter(sc => sc.active));
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Error fetching homepage data:', err);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchHomepageData();

    return () => controller.abort(); // cleanup on unmount
  }, []);






  // Reset subcategory selection when the main category selection changes
  useEffect(() => {
    setSelectedSubCategory('all');
  }, [selectedCategory]);

  const getFilteredCategoryProducts = () => {
    if (selectedCategory === 'for-you') {
      return [];
    }
    const selectedCatObj = categories.find(c => c._id === selectedCategory || c.id === selectedCategory);
    const catName = selectedCatObj ? (selectedCatObj.categoryName || selectedCatObj.name || '').toLowerCase() : '';
    const catSlug = selectedCatObj ? (selectedCatObj.id || '').toLowerCase() : '';
    const catId = selectedCategory.toLowerCase();

    let filtered = rawAllProducts.filter(p => {
      const prodCat = (p.category || '').toLowerCase();
      if (prodCat === catId || prodCat === catSlug) return true;
      const pCatObj = categories.find(c => (c._id || '').toLowerCase() === prodCat || (c.id || '').toLowerCase() === prodCat);
      const pCatName = pCatObj ? (pCatObj.categoryName || pCatObj.name || '').toLowerCase() : '';
      return pCatName === catName && catName !== '';
    });

    if (selectedSubCategory !== 'all') {
      const targetSub = selectedSubCategory.toLowerCase();
      const activeSubObj = subCategoryChips.find(sc => (sc._id || sc.id || '').toLowerCase() === targetSub);
      const subName = activeSubObj ? (activeSubObj.subCategoryName || '').toLowerCase() : '';
      const subSlug = activeSubObj ? (activeSubObj.id || '').toLowerCase() : '';

      filtered = filtered.filter(p => {
        const prodSub = (p.subCategory || '').toLowerCase();
        if (prodSub === targetSub || prodSub === subSlug) return true;
        if (subName && prodSub === subName) return true;

        const pSubObj = subCategoryChips.find(sc => (sc._id || '').toLowerCase() === prodSub || (sc.id || '').toLowerCase() === prodSub);
        if (pSubObj) {
          const pSubName = (pSubObj.subCategoryName || '').toLowerCase();
          const pSubSlug = (pSubObj.id || '').toLowerCase();
          if (subName && pSubName === subName) return true;
          if (subSlug && pSubSlug === subSlug) return true;
        }
        return false;
      });
    }
    return filtered.map(normaliseProduct);
  };

  const getActiveBanners = () => {
    if (dynamicBanners.length > 0) {
      return dynamicBanners;
    }
    return BANNERS;
  };

  const activeBannersList = getActiveBanners();

  // Reset active banner index when active banners change
  useEffect(() => {
    setActiveBanner(0);
    setIsTransitioning(true);
  }, [activeBannersList.length]);

  const slideInterval = useRef(null);

  const startAutoPlay = useCallback(() => {
    if (activeBannersList.length === 0) return;
    if (slideInterval.current) clearInterval(slideInterval.current);
    slideInterval.current = setInterval(() => {
      setIsTransitioning(true);
      setActiveBanner((prev) => (prev >= activeBannersList.length ? prev : prev + 1));
    }, 4500);
  }, [activeBannersList.length]);

  const stopAutoPlay = useCallback(() => {
    if (slideInterval.current) {
      clearInterval(slideInterval.current);
      slideInterval.current = null;
    }
  }, []);

  const resetAutoPlay = () => {
    stopAutoPlay();
    startAutoPlay();
  };

  const handleNextBanner = () => {
    if (activeBannersList.length === 0) return;
    setIsTransitioning(true);
    setActiveBanner((prev) => (prev >= activeBannersList.length ? prev : prev + 1));
    resetAutoPlay();
  };

  const handlePrevBanner = () => {
    if (activeBannersList.length === 0) return;
    setIsTransitioning(true);
    setActiveBanner(prev => prev === 0 ? activeBannersList.length - 1 : prev - 1);
    resetAutoPlay();
  };

  const handleDotClick = (idx) => {
    setIsTransitioning(true);
    setActiveBanner(idx);
    resetAutoPlay();
  };

  // Touch Swipe Handlers for Manual Carousel Control
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNextBanner();
    } else if (isRightSwipe) {
      handlePrevBanner();
    }
    
    // Reset touch coordinates
    setTouchStart(0);
    setTouchEnd(0);
  };

  // Auto-slide Banners with infinite loop logic
  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, [startAutoPlay, stopAutoPlay]);

  // Handle seamless loop rewind without animation
  useEffect(() => {
    if (activeBannersList.length === 0) return;
    if (activeBanner === activeBannersList.length) {
      const timer = setTimeout(() => {
        setIsTransitioning(false); // Turn off transition temporarily
        setActiveBanner(0);        // Snap back to real first slide
      }, 700); // 700ms matches the CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [activeBanner, activeBannersList.length]);

  // 1. Live Countdown Timer State for Crazy Deals (ticking down from 2h 45m 30s)
  const [timeLeft, setTimeLeft] = useState(9930); // 9930 seconds = 02 hours, 45 minutes, 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 9930));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return {
      hrs: hrs < 10 ? `0${hrs}` : hrs,
      mins: mins < 10 ? `0${mins}` : mins,
      secs: secs < 10 ? `0${secs}` : secs,
    };
  };

  const { hrs, mins, secs } = formatTime(timeLeft);

  // Custom Category Inline SVG Renderer to match reference drawings
  const renderCategoryIcon = (id, isActive) => {
    const strokeColor = isActive ? "#FFFFFF" : "#02006c";

    switch (id) {
      case 'for-you':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        );
      case 'beauty':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 9 A 2 2 0 0 1 9 7 H 15 A 2 2 0 0 1 17 9 V 20 A 2 2 0 0 1 15 22 H 9 A 2 2 0 0 1 7 20 Z" />
            <path d="M10 7 V 3 H 14 V 7" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="10" y1="17" x2="14" y2="17" />
          </svg>
        );
      case 'gifting':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        );
      case 'electronics':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        );
      case 'jewellery':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12l4 6-10 12L2 9z" />
            <path d="M11 3 8 9l4 12 4-12-3-6" />
            <path d="M2 9h20" />
          </svg>
        );
      case 'toys':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="13" rx="3" />
            <rect x="7" y="10" width="10" height="4" rx="1" />
            <path d="M 6 17 H 10 M 8 15 V 19" />
            <circle cx="15.5" cy="17.5" r="1.2" fill={strokeColor} />
            <circle cx="18" cy="16" r="1.2" fill={strokeColor} />
            <line x1="12" y1="8" x2="12" y2="3" />
            <circle cx="12" cy="3" r="1.5" />
          </svg>
        );
      case 'stationery':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 L20 20 H4 Z" />
            <line x1="2" y1="16" x2="22" y2="16" />
            <rect x="10" y="8" width="4" height="4" rx="0.5" />
          </svg>
        );
      case 'fashion':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.38 3.46L16 6a2 2 0 0 1-2-2V2H10v2a2 2 0 0 1-2 2L3.62 3.46a2 2 0 0 0-2.38.88l-1 1.5a2 2 0 0 0 .38 2.56L4 10v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10l3.38-2.6a2 2 0 0 0 .38-2.56l-1-1.5a2 2 0 0 0-2.38-.88z" />
          </svg>
        );
      case 'electrical':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Normalise API product to match the shape the UI expects
  const normaliseProduct = (p) => ({
    id: p._id || p.id,
    name: p.name,
    desc: p.description || '',
    price: p.sellingPrice,
    originalPrice: p.mrp || p.sellingPrice,
    discount: formatDiscount(p.discountLabel, p.mrp, p.sellingPrice, 'minus'),
    rating: p.rating || 4.5,
    type: (p.category || '').toLowerCase(),
    image: (p.images && p.images[0]) ? p.images[0] : '',
    brandName: 'Aramish',
    flags: p.flags || {},
    stock: p.stock || 0,
    sales: p.sales || 0,
  });

  const filteredCategoryProducts = useMemo(() => {
    if (selectedCategory === 'for-you') {
      return [];
    }
    const selectedCatObj = categories.find(c => c._id === selectedCategory || c.id === selectedCategory);
    const catName = selectedCatObj ? (selectedCatObj.categoryName || selectedCatObj.name || '').toLowerCase() : '';
    const catSlug = selectedCatObj ? (selectedCatObj.id || '').toLowerCase() : '';
    const catId = selectedCategory.toLowerCase();

    let filtered = rawAllProducts.filter(p => {
      const prodCat = (p.category || '').toLowerCase();
      if (prodCat === catId || prodCat === catSlug) return true;
      const pCatObj = categories.find(c => (c._id || '').toLowerCase() === prodCat || (c.id || '').toLowerCase() === prodCat);
      const pCatName = pCatObj ? (pCatObj.categoryName || pCatObj.name || '').toLowerCase() : '';
      return pCatName === catName && catName !== '';
    });

    if (selectedSubCategory !== 'all') {
      const targetSub = selectedSubCategory.toLowerCase();
      const activeSubObj = subCategoryChips.find(sc => (sc._id || sc.id || '').toLowerCase() === targetSub);
      const subName = activeSubObj ? (activeSubObj.subCategoryName || '').toLowerCase() : '';
      const subSlug = activeSubObj ? (activeSubObj.id || '').toLowerCase() : '';

      filtered = filtered.filter(p => {
        const prodSub = (p.subCategory || '').toLowerCase();
        if (prodSub === targetSub || prodSub === subSlug) return true;
        if (subName && prodSub === subName) return true;

        const pSubObj = subCategoryChips.find(sc => (sc._id || '').toLowerCase() === prodSub || (sc.id || '').toLowerCase() === prodSub);
        if (pSubObj) {
          const pSubName = (pSubObj.subCategoryName || '').toLowerCase();
          const pSubSlug = (pSubObj.id || '').toLowerCase();
          if (subName && pSubName === subName) return true;
          if (subSlug && pSubSlug === subSlug) return true;
        }
        return false;
      });
    }
    return filtered.map(normaliseProduct);
  }, [rawAllProducts, selectedCategory, selectedSubCategory, subCategoryChips, categories]);



  const normalisedCrazyDeals = useMemo(() => {
    return crazyDealsProducts.map(normaliseProduct);
  }, [crazyDealsProducts]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery) return normalisedCrazyDeals;
    const query = searchQuery.trim().toLowerCase();
    return normalisedCrazyDeals.filter(
      (deal) =>
        deal.name.toLowerCase().includes(query) ||
        (deal.desc && deal.desc.toLowerCase().includes(query))
    );
  }, [normalisedCrazyDeals, searchQuery]);

  const normalisedFlashSale = useMemo(() => {
    return flashSaleProducts.map(normaliseProduct);
  }, [flashSaleProducts]);

  const flashDeals = useMemo(() => {
    const items = normalisedFlashSale;
    switch (activeFlashTab) {
      case 'All':
        return items;
      case 'Newest':
        return [...items].reverse();
      case 'Popular':
        return items.filter(d => d.rating >= 4.8);
      default:
        const tab = activeFlashTab.toLowerCase();
        return items.filter(d =>
          (d.type || '').toLowerCase().includes(tab) ||
          (d.name || '').toLowerCase().includes(tab)
        );
    }
  }, [normalisedFlashSale, activeFlashTab]);

  const topSelectionNormalised = useMemo(() => {
    return topSelectionProducts.map(normaliseProduct);
  }, [topSelectionProducts]);




  if (productsLoading) {
    return (
      <div className="flex-grow space-y-5 pb-10 animate-fade-in bg-surface">
        {/* 1. Category Strip Skeleton */}
        <div className="flex items-center gap-4 overflow-x-auto px-4 py-3.5 bg-surface border-b border-white/10 scrollbar-none">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0 w-[60px] animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-surface" />
              <div className="w-10 h-2.5 bg-surface rounded" />
            </div>
          ))}
        </div>

        {/* 2. Banner Skeleton */}
        <div className="px-3 animate-pulse">
          <div className="w-full aspect-[21/9] rounded-2xl bg-surface shadow-sm" />
        </div>

        {/* 3. Flash Sale / Crazy Deals Header Skeleton */}
        <div className="px-4 space-y-3 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="w-28 h-5 bg-surface rounded" />
            <div className="w-20 h-4 bg-surface rounded-full" />
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-32 aspect-[3/4.2] bg-surface rounded-2xl flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* 4. Top 10 Buys Skeleton */}
        <div className="px-4 space-y-3 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="w-24 h-5 bg-surface rounded" />
            <div className="w-16 h-4 bg-surface rounded-full" />
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-32 h-44 bg-surface rounded-2xl flex-shrink-0" />
            ))}
          </div>
        </div>


      </div>
    );
  }

  return (
    <div className="flex-grow space-y-8 pb-12 animate-fade-in bg-surface">
      
      {/* Container wrapper for centering content on desktop */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-8">
        
        {/* 1. Category strip - Horizontal scroll on mobile, clean grid on desktop */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 bg-surface md:bg-transparent rounded-2xl md:rounded-none border-b border-white/10 md:border-b-0 scrollbar-none mt-4 md:grid md:grid-cols-10 md:gap-2 lg:gap-3 md:overflow-visible">
          {categories.map((cat) => {
            const catKey = cat._id || cat.id;
            const isActive = selectedCategory === catKey;
            const labelText = cat.categoryName || cat.name;

            return (
              <button
                key={catKey}
                onClick={() => {
                  setSelectedCategory(catKey);
                }}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer transition-all duration-300 w-[72px] md:w-auto hover:scale-105"
              >
                {/* Image Box */}
                <div className={`w-13 h-13 md:w-16 md:h-16 flex items-center justify-center rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isActive
                    ? cat.image
                      ? 'bg-surface border-[#0B132B] ring-2 ring-orange-100 shadow-md'
                      : 'bg-[#0B132B] border-[#0B132B] text-white shadow-md'
                    : cat.image
                      ? 'bg-surface border-white/10 hover:border-[#0B132B]/40'
                      : 'bg-[#FFF0ED] border-[#FFF0ED] text-[#02006c] hover:border-[#0B132B]/40'
                }`}>
                  {cat.image ? (
                    <OptimizedImage src={getImageUrl(cat.image)} alt={labelText} type="category" objectFit="contain" className="w-full h-full object-contain p-1" />
                  ) : (
                    renderCategoryIcon(cat.id, isActive)
                  )}
                </div>

                {/* Label */}
                <div className="w-full text-center px-1">
                  <span className={`text-[10px] md:text-xs block truncate rounded-full transition-colors py-0.5 ${
                    isActive 
                      ? 'font-bold text-[#0B132B] md:text-[#0B132B]' 
                      : 'font-semibold text-[#02006c]'
                  }`} title={labelText}>
                    {labelText}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* 2. Banner Slider (Hero Banner Section) */}
        <div className="relative group">
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="overflow-hidden rounded-2xl shadow-sm relative aspect-[2.5/1] w-full select-none"
          >
            <div 
              className={`flex w-full h-full ${isTransitioning ? 'transition-transform duration-700 ease-in-out' : ''}`}
              style={{ transform: `translateX(-${activeBanner * 100}%)` }}
            >
              {activeBannersList.length > 0 && [...activeBannersList, activeBannersList[0]].map((banner, idx) => (
                <div
                  key={`banner-${banner.id || banner._id || idx}-${idx}`}
                  className="w-full h-full flex-shrink-0 cursor-pointer"
                  onClick={() => navigate(banner.link || '/categories')}
                >
                  <OptimizedImage src={getImageUrl(banner.image)} alt="Banner" type="banner" fetchPriority="high" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            {activeBannersList.length > 1 && (
              <>
                <button 
                  onClick={handlePrevBanner}
                  className="absolute left-1 top-1/2 -translate-y-1/2 text-white hover:text-[#0B132B] transition-all duration-200 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex cursor-pointer select-none active:scale-95 drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.5)]"
                >
                  <ChevronRight className="w-8 h-8 rotate-180 stroke-[3]" />
                </button>
                <button 
                  onClick={handleNextBanner}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-white hover:text-[#0B132B] transition-all duration-200 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex cursor-pointer select-none active:scale-95 drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.5)]"
                >
                  <ChevronRight className="w-8 h-8 stroke-[3]" />
                </button>
              </>
            )}
          </div>

          {/* Indicators */}
          {activeBannersList.length > 1 && (
            <div className="flex justify-center items-center gap-1.5 mt-2">
              {activeBannersList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDotClick(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === (activeBanner % activeBannersList.length) ? 'w-5 bg-[#0B132B]' : 'w-1.5 bg-surface hover:bg-slate-350'
                  }`}
                ></button>
              ))}
            </div>
          )}
        </div>

        {/* CONDITIONAL RENDER: "For You" vs Other Categories */}
        {selectedCategory === 'for-you' ? (
          <>
            {/* 4. Crazy Deals Grid Layout (Responsive: Grid on Desktop/Tablet, Horizontal on Mobile) */}
            <div className="space-y-3">
              
              {/* Title Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl font-extrabold text-[#02006c] font-sans">
                    Crazy Deals
                  </span>
                  <span className="text-[10px] md:text-xs text-slate-400 font-bold bg-surface px-2 py-0.5 rounded-md">
                    (Like, really crazy!)
                  </span>
                </div>
                <button 
                  onClick={() => navigate('/crazy-deals')}
                  className="text-xs md:text-sm font-black text-[#0B132B] hover:underline cursor-pointer"
                >
                  See All
                </button>
              </div>

              {/* Ticking Countdown Timer */}
              <div className="flex items-center gap-1 text-[13px] md:text-sm font-black text-[#0B132B] tracking-wide -mt-1 font-sans">
                <span className="bg-gold/10 px-1.5 py-0.5 rounded-md border border-gold/20">{hrs}</span>
                <span className="animate-pulse">:</span>
                <span className="bg-gold/10 px-1.5 py-0.5 rounded-md border border-gold/20">{mins}</span>
                <span className="animate-pulse">:</span>
                <span className="bg-gold/10 px-1.5 py-0.5 rounded-md border border-gold/20">{secs}</span>
              </div>

              {/* Responsive Container */}
              {filteredDeals.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2.5 scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-6 md:gap-4 md:overflow-visible">
                  {filteredDeals.map((deal) => (
                    <div 
                      key={deal.id}
                      onClick={() => navigate(`/product/${deal.id}`)}
                      className={`flex-shrink-0 w-24 md:w-auto flex flex-col justify-between cursor-pointer group bg-surface p-2 rounded-2xl border border-white/10 hover:shadow-md transition-all duration-300 ${deal.stock === 0 ? 'opacity-70 grayscale' : ''}`}
                    >
                      <div>
                        {/* Image display box */}
                        <div className="w-24 h-24 md:w-auto md:h-auto md:aspect-square bg-gold/10 border border-gold/20 rounded-xl flex items-center justify-center relative overflow-hidden">
                          {/* Discount Pill */}
                          <span className="absolute top-0 left-0 bg-[#0B132B] text-white text-[8.5px] md:text-[9.5px] font-black px-2 py-0.5 rounded-br-lg z-10">
                            {deal.discount}
                          </span>

                          <OptimizedImage
                            src={deal.image}
                            alt={deal.name}
                            type="product"
                            className="absolute inset-0 group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Out of Stock Overlay */}
                          {deal.stock === 0 && (
                            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[0.5px] flex items-center justify-center z-20">
                              <span className="bg-red-650 text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow-md border border-red-500">
                                Out of Stock
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-[10.5px] md:text-xs font-bold text-[#02006c] truncate mt-2 px-0.5 tracking-tight group-hover:text-[#0B132B] transition-colors">
                          {deal.name}
                        </h4>
                      </div>

                      {/* Pricing row */}
                      <div className="flex items-center gap-1.5 mt-1 px-0.5 leading-none">
                        <span className="text-xs md:text-sm font-extrabold text-[#0B132B]">₹{deal.price}</span>
                        <span className="text-[9px] md:text-xs text-slate-400 font-bold line-through">₹{deal.originalPrice}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback empty state */
                <div className="bg-surface border border-dashed border-white/10 rounded-2xl p-8 text-center space-y-2">
                  <ShieldAlert className="w-8 h-8 text-[#0B132B] mx-auto opacity-75" />
                  <h4 className="text-xs font-bold text-[#0F172A]">No Matching Deals</h4>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Try searching for something else like "teddy" or "car"
                  </p>
                </div>
              )}
            </div>

            {/* 5.5 Top Selection Section (Responsive Grid) */}
            <LazySection placeholderHeight="250px">
              <div className="space-y-4">
                
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xl md:text-2xl font-extrabold text-[#02006c] font-sans">
                    FEATURED COLLECTION
                  </h3>
                  <button 
                    onClick={() => navigate('/top-selection')}
                    className="bg-surface border border-white/10 text-[#02006c] w-8 h-8 rounded-xl flex items-center justify-center shadow-3xs cursor-pointer hover:bg-surface hover:scale-105 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>

                {/* Responsive Grid - 2x2 on Mobile, 4 columns inline on Desktop */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {topSelectionNormalised.length > 0 ? (
                    topSelectionNormalised.slice(0, 4).map((deal) => (
                      <div 
                        key={deal.id}
                        onClick={() => navigate(`/product/${deal.id}`)}
                        className={`bg-surface border border-[#0B132B]/35 rounded-2xl p-3 flex flex-col justify-between shadow-2xs hover:shadow-md cursor-pointer hover:scale-[1.01] active:scale-95 transition-all duration-300 group ${deal.stock === 0 ? 'opacity-70 grayscale' : ''}`}
                      >
                        <div>
                          <div className="bg-[#F8F9FD] rounded-xl w-full aspect-square flex items-center justify-center mb-2.5 relative overflow-hidden">
                            <OptimizedImage
                              src={getImageUrl(deal.image)}
                              alt={deal.name}
                              type="product"
                              className="absolute inset-0 group-hover:scale-105 transition-transform duration-500"
                            />
                            {/* Out of Stock Overlay */}
                            {deal.stock === 0 && (
                              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[0.5px] flex items-center justify-center z-20">
                                <span className="bg-red-650 text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow-md border border-red-500">
                                  Out of Stock
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="text-[9.5px] md:text-xs font-bold text-slate-400 tracking-tight leading-normal px-1 block truncate">
                            {deal.brandName}
                          </span>
                        </div>
                        <h4 className="text-xs md:text-sm font-bold text-slate-800 leading-tight mt-0.5 px-1 truncate group-hover:text-[#0B132B]">
                          {deal.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          <span className="text-sm md:text-base font-black text-[#0B132B]">₹{deal.price}</span>
                          {deal.originalPrice && deal.originalPrice > deal.price && (
                            <span className="text-[10px] md:text-xs text-slate-400 font-semibold line-through">₹{deal.originalPrice}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 md:col-span-4 py-8 text-center text-slate-400 text-xs font-medium border border-dashed border-white/10 rounded-xl">
                      No featured collections found
                    </div>
                  )}
                </div>
              </div>
            </LazySection>

            {/* 6. Flash Sale Section (Responsive layout tabs & grids) */}
            <LazySection placeholderHeight="300px">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xl md:text-2xl font-extrabold text-[#02006c] font-sans">New Arrivals</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] md:text-xs text-slate-400 font-bold mr-1">Closing in:</span>
                    <div className="flex items-center gap-1 text-[11px] md:text-xs font-bold text-[#0B132B] font-sans">
                      <span className="bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-md">{hrs}</span>
                      <span className="text-slate-300">:</span>
                      <span className="bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-md">{mins}</span>
                      <span className="text-slate-300">:</span>
                      <span className="bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-md">{secs}</span>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 md:overflow-visible">
                  {['All', 'Newest', 'Popular', 'Clothes', 'Beauty', 'Gifts', 'Electronics', 'Toys'].map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveFlashTab(tab)}
                      className={`px-4 py-2 rounded-full text-[11px] md:text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        activeFlashTab === tab 
                          ? 'bg-[#0B132B] text-white shadow-md' 
                          : 'bg-surface border border-white/10 text-slate-600 hover:bg-surface'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Products Grid - 2 columns on Mobile, 4 columns on Tablet, 5 columns on Desktop */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {flashDeals.length > 0 ? (
                    flashDeals.slice(0, 5).map((deal) => (
                      <div 
                        key={deal.id} 
                        onClick={() => navigate(`/product/${deal.id}`)} 
                        className={`bg-surface rounded-2xl border border-white/10 p-2.5 relative cursor-pointer hover:shadow-md transition-shadow group flex flex-col justify-between ${deal.stock === 0 ? 'opacity-70 grayscale' : ''}`}
                      >
                        {/* Heart Icon */}
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
                          className={`absolute top-3.5 right-3.5 w-7 h-7 bg-surface rounded-full flex items-center justify-center shadow-md z-10 transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                            isInWishlist(deal.id) ? 'text-[#0B132B]' : 'text-slate-300 hover:text-[#0B132B]'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isInWishlist(deal.id) ? 'fill-[#0B132B] text-[#0B132B]' : ''}`} />
                        </button>
                        
                        <div>
                          <div className="aspect-square bg-surface rounded-xl mb-2 relative overflow-hidden flex items-center justify-center">
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
                          <div className="px-1">
                            <h4 className="text-xs md:text-sm font-bold text-[#02006c] truncate group-hover:text-[#0B132B]">{deal.name}</h4>
                          </div>
                        </div>
                        <div className="px-1 mt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs md:text-sm font-extrabold text-[#0B132B]">₹{deal.price}</span>
                            <span className="text-[10px] md:text-xs text-slate-400 line-through">₹{deal.originalPrice}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 md:col-span-5 py-8 text-center text-slate-400 text-xs font-medium border border-dashed border-white/10 rounded-xl">
                      No deals found in this category
                    </div>
                  )}
                </div>
              </div>
            </LazySection>

            {/* 6.5 Top 10 Buys Section (Responsive Scroll) */}
            <LazySection placeholderHeight="200px">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl md:text-2xl font-extrabold text-[#02006c] font-sans">
                    TOP 10 BUYS
                  </h3>
                  <span className="text-[10px] md:text-xs bg-gold/10 border border-gold/20 text-[#0B132B] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>

                {/* Responsive Container - Horizontal scroll on mobile, 5 columns or inline grid on Desktop */}
                <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 md:grid md:grid-cols-5 lg:grid-cols-10 md:gap-4 md:overflow-visible">
                  {(topBuys.length > 0 ? topBuys.map(normaliseProduct) : rawAllProducts
                    .map(normaliseProduct)
                    .filter((p, index, self) => self.findIndex(t => t.id === p.id) === index)
                    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
                    .slice(0, 10))
                    .map((buy, idx) => {
                      const gradients = [
                        'bg-gradient-to-b from-[#FFA781] to-[#F3557A]',
                        'bg-gradient-to-b from-[#81F5FF] to-[#0A5FA6]',
                        'bg-gradient-to-b from-[#E2F5FF] to-[#3B82F6]',
                        'bg-gradient-to-b from-[#FFF5C6] to-[#D97706]',
                        'bg-gradient-to-b from-[#D1FAE5] to-[#059669]',
                        'bg-gradient-to-b from-[#F3E8FF] to-[#7C3AED]',
                        'bg-gradient-to-b from-[#FFF1F2] to-[#E11D48]',
                        'bg-gradient-to-b from-[#F0FDF4] to-[#16A34A]',
                        'bg-gradient-to-b from-[#ECFDF5] to-[#047857]',
                        'bg-gradient-to-b from-[#FFFBEB] to-[#D97706]'
                      ];
                      const bgGradient = gradients[idx % gradients.length];
                      return (
                        <div 
                          key={`top-buy-${buy.id}`} 
                          onClick={() => navigate(`/product/${buy.id}`)}
                          className={`flex-shrink-0 w-32 h-44 md:w-auto md:h-auto md:aspect-[3/4.2] rounded-2xl p-3.5 flex flex-col justify-between ${bgGradient} text-white relative shadow-sm cursor-pointer hover:-translate-y-1 transition-transform ${buy.stock === 0 ? 'opacity-70 grayscale' : ''}`}
                        >
                          <div className="absolute top-1 left-2.5 text-[32px] md:text-[38px] font-black opacity-90 leading-none" style={{ fontFamily: 'sans-serif' }}>
                            {idx + 1}.
                          </div>
                          
                          <div className="mt-8 flex-grow flex items-center justify-center relative z-10">
                            <div className="w-18 h-18 bg-surface/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner overflow-hidden relative">
                              {buy.image ? (
                                <>
                                  <OptimizedImage src={getImageUrl(buy.image)} alt={buy.name} type="product" className="w-full h-full" />
                                  {buy.stock === 0 && (
                                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[0.5px] flex items-center justify-center z-20">
                                      <span className="bg-red-650 text-white text-[7.5px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded-full border border-red-500">
                                        Sold Out
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <Sparkles className="w-7 h-7 text-white/80" />
                              )}
                            </div>
                          </div>

                          <div className="z-10 mt-2">
                            <h4 className="text-[10px] md:text-xs font-semibold leading-tight truncate">{buy.name}</h4>
                            <p className="text-[11px] md:text-xs font-black">{buy.discount} OFF</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </LazySection>


          </>
        ) : (
          <div className="space-y-6">
            {/* Sub-categories row */}
            {(() => {
              if (selectedCategory === 'for-you') return null;
              const selectedCatObj = categories.find(c => c._id === selectedCategory || c.id === selectedCategory);
              if (!selectedCatObj) return null;

              const catId = (selectedCatObj._id || '').toLowerCase();
              const catSlug = (selectedCatObj.id || '').toLowerCase();

              // Filter subcategories belonging to this category (by id or slug)
              const matchedSubs = subCategoryChips.filter(sc => {
                const scCatId = (sc.categoryId || '').toLowerCase();
                return scCatId === catId || scCatId === catSlug;
              });

              // Deduplicate subcategories by name
              const uniqueMatchedSubs = [];
              const seenSubNames = new Set();
              matchedSubs.forEach(sub => {
                const name = (sub.subCategoryName || '').toLowerCase().trim();
                if (name && !seenSubNames.has(name)) {
                  seenSubNames.add(name);
                  uniqueMatchedSubs.push(sub);
                }
              });

              if (uniqueMatchedSubs.length === 0) return null;

              return (
                <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 mt-2 md:grid md:grid-cols-8 md:gap-4 md:overflow-visible">
                  {/* 'All' option for subcategory filter */}
                  <div 
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
                    onClick={() => setSelectedSubCategory('all')}
                  >
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden border transition-all flex items-center justify-center bg-surface shadow-2xs hover:scale-102 ${selectedSubCategory === 'all' ? 'border-[#0B132B] ring-2 ring-orange-100' : 'border-white/10'}`}>
                      <LayoutGrid className="w-6 h-6 text-slate-400" />
                    </div>
                    <span className={`text-[10px] md:text-xs font-bold ${selectedSubCategory === 'all' ? 'text-[#0B132B]' : 'text-slate-700'}`}>All</span>
                  </div>

                  {uniqueMatchedSubs.map(sub => {
                    const subKey = sub._id || sub.id;
                    const isSubActive = selectedSubCategory.toLowerCase() === subKey.toLowerCase();
                    return (
                      <div 
                        key={subKey} 
                        className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer w-16 md:w-auto text-center hover:scale-102"
                        onClick={() => setSelectedSubCategory(subKey)}
                      >
                        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden border transition-all relative bg-surface shadow-2xs ${isSubActive ? 'border-[#0B132B] ring-2 ring-orange-100' : 'border-white/10'}`}>
                          <OptimizedImage src={getImageUrl(sub.image)} alt={sub.subCategoryName} type="subcategory" className="absolute inset-0" />
                        </div>
                        <span className={`text-[10px] md:text-xs font-bold block truncate w-full ${isSubActive ? 'text-[#0B132B]' : 'text-slate-700'}`} title={sub.subCategoryName}>
                          {sub.subCategoryName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
   
            {/* Category UI: Filtered Product Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {(() => {
                  const selectedCatObj = categories.find(c => c._id === selectedCategory || c.id === selectedCategory);
                  const displayCatName = selectedCatObj ? (selectedCatObj.categoryName || selectedCatObj.name) : selectedCategory;
                  const selectedSubObj = subCategoryChips.find(sc => sc._id === selectedSubCategory || sc.id === selectedSubCategory);
                  const displaySubName = selectedSubObj ? selectedSubObj.subCategoryName : selectedSubCategory;
                  return (
                    <h3 className="text-xl md:text-2xl font-extrabold text-[#02006c] font-sans capitalize">
                      {displayCatName.replace('-', ' ')} {selectedSubCategory !== 'all' ? `> ${displaySubName}` : ''}
                    </h3>
                  );
                })()}
                <span className="text-[10px] md:text-xs text-[#0B132B] font-bold bg-gold/10 border border-gold/20 px-3 py-1 rounded-full">
                  {filteredCategoryProducts.length} Items
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredCategoryProducts.length > 0 ? (
                  filteredCategoryProducts.map((deal) => (
                    <ProductCard key={deal.id} product={deal} />
                  ))
                ) : (
                  <div className="col-span-2 md:col-span-4 py-16 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-3xl bg-surface">
                    <LayoutGrid className="w-8 h-8 text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-800 mb-1">Nothing here yet</h4>
                    <p className="text-xs text-slate-400 max-w-[220px]">
                      We are updating our catalog for this category. Check back soon!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamically append Top 10 Buys and Trending Brands */}
            
            {/* Top 10 Buys Section */}
            <LazySection placeholderHeight="200px">
              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl md:text-2xl font-extrabold text-[#02006c] font-sans">
                    TOP 10 BUYS
                  </h3>
                  <span className="text-[9px] md:text-xs bg-gold/10 border border-gold/20 text-[#0B132B] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Popular
                  </span>
                </div>

                <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 md:grid md:grid-cols-5 lg:grid-cols-10 md:gap-4 md:overflow-visible">
                  {(topBuys.length > 0 ? topBuys.map(normaliseProduct) : [...crazyDealsProducts, ...flashSaleProducts, ...topSelectionProducts]
                    .map(normaliseProduct)
                    .filter((p, index, self) => self.findIndex(t => t.id === p.id) === index)
                    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
                    .slice(0, 10))
                    .map((buy, idx) => {
                      const gradients = [
                        'bg-gradient-to-b from-[#FFA781] to-[#F3557A]',
                        'bg-gradient-to-b from-[#81F5FF] to-[#0A5FA6]',
                        'bg-gradient-to-b from-[#E2F5FF] to-[#3B82F6]'
                      ];
                      return (
                        <div 
                          key={`cat-top-buy-${buy.id}`} 
                          onClick={() => navigate(`/product/${buy.id}`)}
                          className={`flex-shrink-0 w-28 h-40 md:w-auto md:h-auto md:aspect-[3/4.2] rounded-2xl p-3 flex flex-col justify-between ${gradients[idx % gradients.length]} text-white relative shadow-sm cursor-pointer hover:-translate-y-1 transition-transform`}
                        >
                          <div className="absolute top-1 left-2 text-[32px] font-black opacity-90 leading-none">
                            {idx + 1}.
                          </div>
                          <div className="mt-6 flex-grow flex items-center justify-center overflow-hidden">
                            <div className="w-16 h-16 bg-surface/20 rounded-full flex items-center justify-center relative overflow-hidden">
                              <OptimizedImage src={getImageUrl(buy.image)} alt={buy.name} type="product" className="absolute inset-0" />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[9px] md:text-xs font-semibold leading-tight truncate">{buy.name}</h4>
                            <p className="text-[10px] md:text-xs font-black">{buy.discount} OFF</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </LazySection>


          </div>
        )}
      </div>
    </div>
  );
}
