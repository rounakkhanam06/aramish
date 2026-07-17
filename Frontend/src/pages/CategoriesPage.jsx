import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Search, ChevronLeft, LayoutGrid } from 'lucide-react';
import { CATEGORIES, CRAZY_DEALS } from '../data/mockData';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ui/ProductCard';
import OptimizedImage from '../components/ui/OptimizedImage';
import { getImageUrl } from '../utils/imageHelper';
import { formatDiscount } from '../utils/discountHelper';
import { cachedFetch } from '../utils/apiCache';

// Category Images
import catForYou from '../assets/CategorySection/categoryForU-removebg-preview.webp';
import cat1 from '../assets/CategorySection/Category1-removebg-preview.webp';
import cat2 from '../assets/CategorySection/Category2-removebg-preview.webp';
import cat3 from '../assets/CategorySection/Category3-removebg-preview.webp';
import cat4 from '../assets/CategorySection/Category4-removebg-preview.webp';
import cat5 from '../assets/CategorySection/Category5-removebg-preview.webp';
import cat6 from '../assets/CategorySection/Category6-removebg-preview.webp';
import cat7 from '../assets/CategorySection/Category7-removebg-preview.webp';

export default function CategoriesPage() {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useApp();
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState('for-you');
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');

  const [sortBy, setSortBy] = useState('none'); // 'none', 'price-low', 'price-high', 'rating'
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [categories, setCategories] = useState(CATEGORIES);
  const [subCategories, setSubCategories] = useState([]);
  const [rawProducts, setRawProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  const containerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Sync with URL parameter (e.g. when navigated from Home category capsule)
  useEffect(() => {
    const catParam = searchParams.get('cat');
    if (catParam) {
      const matchedCat = categories.find(
        c => c.id === catParam || c._id === catParam
      ) || categories.find(
        c => (c.name || '').toLowerCase() === catParam.toLowerCase() || 
             (c.categoryName || '').toLowerCase() === catParam.toLowerCase()
      );
      if (matchedCat) {
        setSelectedCategory(matchedCat._id || matchedCat.id);
      }
    }
  }, [searchParams, categories]);

  // Clear search query on mount
  useEffect(() => {
    setSearchQuery('');
  }, []);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page and products when filters change
  const prevFiltersRef = useRef({ selectedCategory, selectedSubCategory, sortBy, debouncedSearchQuery });
  const activeRequestRef = useRef(null);

  const loadProducts = async (pageNum, isReset) => {
    const requestId = Math.random().toString(36).substring(7);
    activeRequestRef.current = requestId;

    if (isReset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        category: selectedCategory,
        subCategory: selectedSubCategory,
        sortBy,
        search: (debouncedSearchQuery || '').trim()
      });

      const data = await cachedFetch(`/admin/catalog/products/combined?${queryParams.toString()}`, { ttl: 5 });

      if (activeRequestRef.current === requestId && data && data.success) {
        if (isReset) {
          if (data.chips) {
            const activeChips = (data.chips || []).filter(c => c.active && c.id !== 'for-you');
            const forYouChip = CATEGORIES.find(c => c.id === 'for-you');
            setCategories([forYouChip, ...activeChips]);
          }
          if (data.subchips) {
            const finalSubCategories = (data.subchips || []).filter(sc => sc.active);
            setSubCategories(finalSubCategories);
          }
          setRawProducts(data.products || []);
        } else {
          setRawProducts((prev) => {
            const existingIds = new Set(prev.map(p => p._id || p.id));
            const newProducts = (data.products || []).filter(p => !existingIds.has(p._id || p.id));
            return [...prev, ...newProducts];
          });
        }
        setHasMore(data.hasMore);
      }
    } catch (err) {
      console.error('Error fetching combined catalog page:', pageNum, err);
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged = 
      prev.selectedCategory !== selectedCategory ||
      prev.selectedSubCategory !== selectedSubCategory ||
      prev.sortBy !== sortBy ||
      prev.debouncedSearchQuery !== debouncedSearchQuery;

    if (filtersChanged) {
      prevFiltersRef.current = { selectedCategory, selectedSubCategory, sortBy, debouncedSearchQuery };
      setPage(1);
      if (page === 1) {
        loadProducts(1, true);
      }
    } else {
      loadProducts(page, page === 1);
    }
  }, [page, selectedCategory, selectedSubCategory, sortBy, debouncedSearchQuery]);

  useEffect(() => {
    setSelectedSubCategory('all');
  }, [selectedCategory]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage((prev) => prev + 1);
        }
      },
      {
        root: containerRef.current,
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadingMore]);

  // Category Image drawer
  const renderCatIcon = (id, isActive) => {
    let imgSrc = null;
    switch (id) {
      case 'for-you': imgSrc = catForYou; break;
      case 'beauty': imgSrc = cat1; break;
      case 'toys': imgSrc = cat2; break; // teddy bear
      case 'jewellery': imgSrc = cat3; break; // woman with necklace
      case 'electronics': imgSrc = cat4; break; // home appliances
      case 'stationery': imgSrc = cat5; break; // pencils
      case 'fashion': imgSrc = cat6; break;
      case 'gifting': imgSrc = cat7; break;
      case 'electrical': imgSrc = cat4; break;
      default: imgSrc = catForYou;
    }

    if (!imgSrc) return null;

    return (
      <img
        src={imgSrc}
        alt={id}
        className={`w-[36px] h-[36px] object-contain drop-shadow-sm transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}
      />
    );
  };

  // Normalise API product to match the shape the UI expects
  const normaliseProduct = (p) => ({
    id: p._id || p.id,
    name: p.name,
    desc: p.description || '',
    price: p.sellingPrice,
    originalPrice: p.mrp || p.sellingPrice,
    discount: formatDiscount(p.discountLabel, p.mrp, p.sellingPrice, 'minus'),
    rating: p.rating || 0,
    type: (p.category || '').toLowerCase(),
    subCategory: p.subCategory ? p.subCategory.toLowerCase() : '',
    image: p.images && p.images[0] ? p.images[0] : '',
    brandName: 'Aramish',
    flags: p.flags || {},
    stock: p.stock || 0,
    sales: p.sales || 0,
  });

  const filteredProducts = rawProducts.map(normaliseProduct);

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden select-none">
      {/* Elevated Sticky Header (Mobile Only) */}
      <header className="sticky top-0 bg-[#0B132B] border-b border-[#0B132B] px-4 py-3 flex items-center justify-between z-40 flex-shrink-0 md:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1 bg-surface hover:bg-surface/90 border border-transparent rounded-full shadow-2xs transition-colors active:scale-95 cursor-pointer text-[#0B132B]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide uppercase font-syne">
              Discover <span>Aramish</span>
            </h1>
            <p className="text-[10px] text-white/90 font-bold uppercase tracking-widest font-sans mt-0.5">
              Trend Starts Here
            </p>
          </div>
        </div>

        {/* Pulsing Active Badge */}
        <div className="flex items-center gap-1 bg-surface/20 text-white px-2 py-0.5 rounded-full border border-white/30">
          <span className="w-2 h-2 bg-surface rounded-full animate-ping"></span>
          <span className="text-[9px] font-bold uppercase tracking-wider">Live Catalog</span>
        </div>
      </header>

      <div className="flex-grow flex animate-fade-in overflow-hidden">

        {/* 1. Vertical Sidebar Category Navigation (Responsive sidebar) */}
        <div className="w-[72px] md:w-64 bg-[#02006c]/[0.02] md:bg-surface border-r border-white/10 flex flex-col items-center md:items-stretch pt-2 pb-2 md:p-4 overflow-y-auto scrollbar-none gap-3 flex-shrink-0 md:sticky md:top-[110px] md:h-[calc(100vh-110px)] md:self-start">
          {categories.map((cat) => {
            const catKey = cat._id || cat.id;
            const isActive = selectedCategory === catKey;
            const labelText = cat.categoryName || cat.name;

            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className="flex flex-col md:flex-row items-center md:gap-3 w-full relative pb-1 md:pb-0 md:p-2.5 rounded-xl group cursor-pointer"
              >
                <div className={`relative w-[52px] h-[52px] md:w-9 md:h-9 flex items-center justify-center flex-shrink-0 rounded-xl overflow-hidden ${
                  cat.image ? 'bg-surface border border-white/10 shadow-3xs' : ''
                }`}>
                  {/* Background Cover */}
                  {isActive ? (
                    cat.image ? (
                      <div className="absolute inset-0 border-2 border-[#0B132B] rounded-xl" />
                    ) : (
                      <motion.div
                        layoutId="activeCategoryCapsule"
                        className="absolute inset-0 rounded-xl bg-[#0B132B] shadow-md shadow-[#0B132B]/30"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )
                  ) : (
                    !cat.image && <div className="absolute inset-0 rounded-xl bg-gold/10 group-hover:bg-gold/10 transition-colors duration-300" />
                  )}

                  {/* Image Icon */}
                  <div className="relative z-10 flex items-center justify-center w-full h-full">
                    {cat.image ? (
                      <OptimizedImage
                        src={cat.image}
                        alt={labelText}
                        type="category"
                        objectFit="contain"
                        className={`w-full h-full object-contain p-1 transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}
                      />
                    ) : (
                      renderCatIcon(cat.id, isActive)
                    )}
                  </div>
                </div>

                {/* Text Label */}
                <span className={`text-[10px] md:text-sm leading-tight font-bold tracking-tight select-none px-1 text-center md:text-left mt-1 md:mt-0 transition-colors relative z-10 ${
                  isActive 
                    ? 'text-[#0F172A] md:text-[#0B132B] font-bold' 
                    : 'text-slate-500 md:text-slate-700 font-semibold group-hover:text-[#0B132B]'
                }`}>
                  {labelText}
                </span>

                {/* Active Indicator Line (Vertical Left) - Mobile only */}
                {isActive && (
                  <motion.div
                    layoutId="activeCategoryLine"
                    className="absolute left-0 top-1 bottom-1 w-1 bg-[#02006c] rounded-r-full z-20 md:hidden"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 2. Main filtered products catalog grid */}
        <div ref={containerRef} className="flex-grow p-2.5 md:p-6 overflow-y-auto space-y-4 bg-[#ff7400]/5 md:bg-surface relative">

          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 relative z-20 px-1">
            <div className="space-y-0.5">
              <h3 className="text-xs md:text-sm font-black text-[#02006c] uppercase tracking-wider">
                {categories.find((c) => c.id === selectedCategory || c._id === selectedCategory)?.categoryName || categories.find((c) => c.id === selectedCategory || c._id === selectedCategory)?.name || "Catalog"}
              </h3>
              <p className="text-[8px] md:text-xs text-slate-400 font-bold uppercase tracking-widest">
                {filteredProducts.length} items found
              </p>
            </div>
            <div className="relative">
              <Filter
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className={`w-4 h-4 cursor-pointer transition-colors ${showSortDropdown ? 'text-[#0B132B]' : 'text-[#02006c]/70 hover:text-[#02006c]'}`}
              />
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-36 bg-surface border border-white/10 rounded-lg shadow-lg py-1 z-30 animate-fade-in text-[10px]">
                  <button
                    onClick={() => { setSortBy('none'); setShowSortDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gold/10 font-bold ${sortBy === 'none' ? 'text-[#0B132B]' : 'text-slate-600'}`}
                  >
                    DEFAULT
                  </button>
                  <button
                    onClick={() => { setSortBy('price-low'); setShowSortDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gold/10 font-bold ${sortBy === 'price-low' ? 'text-[#0B132B]' : 'text-slate-600'}`}
                  >
                    PRICE: LOW TO HIGH
                  </button>
                  <button
                    onClick={() => { setSortBy('price-high'); setShowSortDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gold/10 font-bold ${sortBy === 'price-high' ? 'text-[#0B132B]' : 'text-slate-600'}`}
                  >
                    PRICE: HIGH TO LOW
                  </button>
                  <button
                    onClick={() => { setSortBy('rating'); setShowSortDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gold/10 font-bold ${sortBy === 'rating' ? 'text-[#0B132B]' : 'text-slate-600'}`}
                  >
                    TOP RATED
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Horizontal Subcategories Scroll */}
          {(() => {
            if (selectedCategory === 'for-you') return null;
            const selectedCatObj = categories.find(c => c._id === selectedCategory || c.id === selectedCategory);
            if (!selectedCatObj) return null;

            const catId = (selectedCatObj._id || '').toLowerCase();
            const catSlug = (selectedCatObj.id || '').toLowerCase();

            // Filter subcategories belonging to this category (by id or slug)
            const matchedSubs = subCategories.filter(sc => {
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
              <div className="flex overflow-x-auto gap-3 py-3 scrollbar-none snap-x relative z-20 px-2 flex-shrink-0 bg-surface border border-white/10 rounded-2xl shadow-3xs items-start">
                <button
                  onClick={() => setSelectedSubCategory('all')}
                  className="flex flex-col items-center w-[68px] group cursor-pointer flex-shrink-0 snap-start"
                >
                  <div className="relative w-[52px] h-[52px] md:w-11 md:h-11 flex items-center justify-center">
                    {selectedSubCategory === 'all' ? (
                      <div className="absolute inset-0 rounded-lg bg-[#0B132B] shadow-md shadow-[#0B132B]/25" />
                    ) : (
                      <div className="absolute inset-0 rounded-lg bg-gold/10 group-hover:bg-gold/10 transition-colors duration-300" />
                    )}
                    <div className="relative z-10 flex items-center justify-center">
                      <LayoutGrid className={`w-6 h-6 md:w-5 md:h-5 transition-all duration-300 ${selectedSubCategory === 'all' ? 'text-white scale-110' : 'text-[#0B132B]'}`} />
                    </div>
                  </div>
                  <span className={`text-[9px] leading-[1.1] font-black tracking-tight select-none px-0.5 text-center mt-1.5 w-full transition-colors ${selectedSubCategory === 'all' ? 'text-[#0F172A]' : 'text-slate-500'
                    }`}>
                    ALL
                  </span>
                </button>
                {uniqueMatchedSubs.map((sub) => {
                  const subKey = sub._id || sub.id;
                  const isSubActive = selectedSubCategory === subKey;
                  return (
                    <button
                      key={subKey}
                      onClick={() => setSelectedSubCategory(subKey)}
                      className="flex flex-col items-center w-[68px] group cursor-pointer flex-shrink-0 snap-start"
                    >
                      <div className={`relative w-[52px] h-[52px] md:w-11 md:h-11 flex items-center justify-center rounded-lg overflow-hidden ${
                        sub.image ? 'bg-surface border border-white/10 shadow-3xs' : ''
                      }`}>
                        {isSubActive ? (
                          sub.image ? (
                            <div className="absolute inset-0 border-2 border-[#0B132B] rounded-lg" />
                          ) : (
                            <div className="absolute inset-0 rounded-lg bg-[#0B132B] shadow-md shadow-[#0B132B]/25 animate-scale-up" />
                          )
                        ) : (
                          !sub.image && <div className="absolute inset-0 rounded-lg bg-gold/10 group-hover:bg-gold/10 transition-colors duration-300" />
                        )}
                        <div className="relative z-10 flex items-center justify-center w-full h-full">
                          {sub.image ? (
                            <OptimizedImage
                              src={sub.image}
                              alt=""
                              type="subcategory"
                              objectFit="contain"
                              className={`w-full h-full object-contain p-1 transition-transform duration-300 ${isSubActive ? 'scale-110' : 'scale-100'}`}
                            />
                          ) : (
                            <div className="w-[34px] h-[34px] bg-surface rounded" />
                          )}
                        </div>
                      </div>
                      <span className={`text-[9px] leading-[1.1] font-black tracking-tight select-none px-0.5 text-center line-clamp-2 w-full mt-1.5 transition-colors ${isSubActive ? 'text-[#0F172A]' : 'text-slate-500'
                        }`}>
                        {sub.subCategoryName}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}


          {/* Dynamic product list */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-surface flex flex-col items-center pb-3 shadow-sm border border-white/10 rounded-lg overflow-hidden">
                  <div className="w-full aspect-square skeleton-shimmer mb-2" />
                  <div className="w-3/4 h-3 skeleton-shimmer rounded mb-1.5" />
                  <div className="w-1/2 h-2.5 skeleton-shimmer rounded" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <>
              <motion.div
                key={selectedCategory + sortBy}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </motion.div>

              {/* Skeleton loader for subsequent page fetches */}
              {loadingMore && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={`skeleton-more-${i}`} className="bg-surface flex flex-col items-center pb-3 shadow-sm border border-white/10 rounded-lg overflow-hidden">
                      <div className="w-full aspect-square skeleton-shimmer mb-2" />
                      <div className="w-3/4 h-3 skeleton-shimmer rounded mb-1.5" />
                      <div className="w-1/2 h-2.5 skeleton-shimmer rounded" />
                    </div>
                  ))}
                </div>
              )}

              {/* Sentinel element for infinite scroll */}
              <div ref={sentinelRef} className="h-10 w-full" />
            </>
          ) : (
            /* Empty state if search parameters yield nothing */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="bg-surface border border-dashed border-white/10 rounded-3xl p-8 text-center space-y-3 mt-6 animate-scale-in"
            >
              <div className="w-12 h-12 bg-gold/10 text-[#0B132B] rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Search className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-[#0F172A]">No Items Found</h4>
                <p className="text-[9px] text-slate-400 leading-normal font-medium max-w-[150px] mx-auto">
                  No items match this filter in this category.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedCategory('for-you');
                  setSearchQuery('');
                }}
                className="bg-surface border border-white/10 hover:border-[#0B132B] text-[#0B132B] text-[8px] font-black px-4 py-2 rounded-xl transition-all duration-300 cursor-pointer"
              >
                RESET FILTERS
              </button>
            </motion.div>
          )}

        </div>

      </div>
    </div>
  );
}
