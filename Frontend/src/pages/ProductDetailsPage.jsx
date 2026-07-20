import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ShoppingCart, Heart, Send, Star, ChevronRight, Home, Truck, Store, RotateCcw, Banknote, ShieldCheck, ArrowRight, ChevronDown, ChevronUp, CheckCircle2, CheckCircle, X, Play, MapPin } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useApp } from '../context/AppContext';
import analytics from '../utils/analytics';
import { CRAZY_DEALS } from '../data/mockData';
import OptimizedImage from '../components/ui/OptimizedImage';
import { getImageUrl } from '../utils/imageHelper';
import { formatDiscount } from '../utils/discountHelper';

export default function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { totalCartItems, addToCart, cart, toggleWishlist, isInWishlist, user, setSearchQuery, location: userLocation } = useApp();
  
  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Video Reels States
  const [productReels, setProductReels] = useState([]);
  const [isUploadReelOpen, setIsUploadReelOpen] = useState(false);
  const [reelRating, setReelRating] = useState(5);
  const [reelCaption, setReelCaption] = useState('');
  const [reelVideoFile, setReelVideoFile] = useState(null);
  const [isUploadingReel, setIsUploadingReel] = useState(false);
  const [isEligibleToReview, setIsEligibleToReview] = useState(false);

  const fetchProductReels = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Filter approved reels for this product
        const filtered = (data.reels || []).filter(r => {
          const prodId = r.productId?._id || r.productId;
          return prodId === id;
        });
        setProductReels(filtered);
      }
    } catch (err) {
      console.error('Error fetching reels for product:', err);
    }
  };

  const fetchReviewEligibility = async () => {
    if (!user) {
      setIsEligibleToReview(false);
      return;
    }
    try {
      const token = localStorage.getItem('userToken');
      if (!token) return;
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels/check-eligibility?productId=${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsEligibleToReview(data.eligible);
      }
    } catch (err) {
      console.error('Error checking review eligibility:', err);
    }
  };

  useEffect(() => {
    fetchProductReels();
    fetchReviewEligibility();
  }, [id, user]);

  const handleUploadReel = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!reelVideoFile) {
      alert('Please select a video file first!');
      return;
    }

    const token = localStorage.getItem('userToken');
    if (!token) {
      alert('Please log in again');
      return;
    }

    const formData = new FormData();
    formData.append('productId', id);
    formData.append('rating', reelRating);
    formData.append('caption', reelCaption);
    formData.append('video', reelVideoFile);

    try {
      setIsUploadingReel(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage('Reel review uploaded! Awaiting Admin Approval.');
        setTimeout(() => setToastMessage(''), 4000);
        setIsUploadReelOpen(false);
        setReelCaption('');
        setReelVideoFile(null);
      } else {
        alert(data.message || 'Failed to upload video review');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    } finally {
      setIsUploadingReel(false);
    }
  };

  // Accordion and Tab States
  const [isHighlightsOpen, setIsHighlightsOpen] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isReviewsOpen, setIsReviewsOpen] = useState(true);
  const [activeDetailTab, setActiveDetailTab] = useState('specifications');
  
  // Review Media Viewer State
  const [selectedReviewMedia, setSelectedReviewMedia] = useState(null);
  const videoRef = useRef(null);
  useEffect(() => {
    if (selectedReviewMedia?.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(e => console.error("Autoplay prevented:", e));
    }
  }, [selectedReviewMedia]);

  const [pincode, setPincode] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState(null);
  const [deliveryChargeCOD, setDeliveryChargeCOD] = useState(null);
  const [deliveryEtd, setDeliveryEtd] = useState('');
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  useEffect(() => {
    const checkKeyboard = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        setIsKeyboardOpen(windowHeight - viewportHeight > 150);
      }
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkKeyboard);
      return () => window.visualViewport.removeEventListener('resize', checkKeyboard);
    }
  }, []);

  // Auto-fetch user's default address pincode and estimate shipping
  useEffect(() => {
    if (user && product) {
      const fetchDefaultAddressAndEstimate = async () => {
        try {
          const token = localStorage.getItem('userToken');
          if (!token) return;
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/addresses`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            const defaultAddress = data.data[0];
            if (defaultAddress.pincode) {
              setPincode(defaultAddress.pincode);
              // Calculate automatically
              const [prepaidRes, codRes] = await Promise.all([
                fetch(`${apiBase}/api/shiprocket/estimate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deliveryPincode: defaultAddress.pincode, weight: product?.shippingSpecs?.weight || 0.5, cod: 0 })
                }),
                fetch(`${apiBase}/api/shiprocket/estimate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deliveryPincode: defaultAddress.pincode, weight: product?.shippingSpecs?.weight || 0.5, cod: 1 })
                })
              ]);
              const estimateData = await prepaidRes.json();
              const estimateDataCOD = await codRes.json();
              
              if (prepaidRes.ok && estimateData.success) {
                setDeliveryCharge(estimateData.deliveryCharge);
                setDeliveryEtd(estimateData.etd);
                if (codRes.ok && estimateDataCOD.success) {
                  setDeliveryChargeCOD(estimateDataCOD.deliveryCharge);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error auto-fetching pincode:", err);
        }
      };
      // only run once when product is loaded
      fetchDefaultAddressAndEstimate();
    }
  }, [user, product?.id]);


  const handleCheckPincode = async () => {
    if (!pincode || pincode.length !== 6) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }
    setIsCheckingPincode(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const [prepaidRes, codRes] = await Promise.all([
        fetch(`${apiBase}/api/shiprocket/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deliveryPincode: pincode, weight: product?.shippingSpecs?.weight || 0.5, cod: 0 })
        }),
        fetch(`${apiBase}/api/shiprocket/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deliveryPincode: pincode, weight: product?.shippingSpecs?.weight || 0.5, cod: 1 })
        })
      ]);
      const data = await prepaidRes.json();
      const dataCOD = await codRes.json();
      if (prepaidRes.ok && data.success) {
        setDeliveryCharge(data.deliveryCharge);
        setDeliveryEtd(data.etd);
        if (codRes.ok && dataCOD.success) {
          setDeliveryChargeCOD(dataCOD.deliveryCharge);
        }
      } else {
        alert('Could not fetch delivery details for this pincode');
        setDeliveryCharge(null);
        setDeliveryChargeCOD(null);
        setDeliveryEtd('');
      }
    } catch (err) {
      alert('Error checking serviceability');
      setDeliveryCharge(null);
      setDeliveryChargeCOD(null);
      setDeliveryEtd('');
    } finally {
      setIsCheckingPincode(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoading(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/admin/catalog/products/${id}`);
        const data = await res.json();
        
        if (res.ok && data.success && data.product) {
          const p = data.product;
          console.log("=== FRONTEND PRODUCT DATA ===", { id: p._id, weight: p.shippingSpecs?.weight });
          
          let productImages = p.images || [];
          if (productImages.length === 0) {
            productImages = ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800'];
          }
          
          const normalised = {
            id: p._id || p.id,
            name: p.name,
            desc: p.description || '',
            price: p.sellingPrice,
            originalPrice: p.mrp || p.sellingPrice,
            discount: formatDiscount(p.discountLabel, p.mrp, p.sellingPrice, 'off'),
            rating: p.rating || 0,
            type: (p.category || '').toLowerCase(),
            image: getImageUrl(productImages[0]),
            images: productImages.map(getImageUrl),
            brandName: 'Aramish',
            flags: p.flags || {},
            stock: p.stock || 0,
            highlights: p.highlights || {},
            technicalSpecs: p.technicalSpecs || {},
            manufacturerInfo: p.manufacturerInfo || '',
            shippingSpecs: p.shippingSpecs || {},
            variations: p.variations || []
          };
          
          if (normalised.variations.length > 0) {
              const defaultVariant = normalised.variations[0];
              setSelectedColor(defaultVariant.color || '');
              setSelectedSize(defaultVariant.size || '');
          }

          setProduct(normalised);

          // Fetch similar products dynamically
          try {
             const simRes = await fetch(`${apiBase}/admin/catalog/products`);
             const simData = await simRes.json();
             if (simRes.ok && simData.success) {
                const similar = simData.products.filter(p => p._id !== p.id && p._id !== id).slice(0, 10);
                setSimilarProducts(similar);
             }
          } catch(e) { console.error(e); }

        } else {
          const foundProduct = CRAZY_DEALS.find(item => item.id === id);
          if (foundProduct) {
            setProduct({
              ...foundProduct,
              images: [foundProduct.image]
            });
          } else {
            setProduct({
              id: 'fallback',
              name: 'Product Details',
              desc: 'Product description goes here',
              price: 999,
              originalPrice: 1999,
              discount: '50% OFF',
              image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800',
              images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800'],
              brandName: 'Aramish',
              highlights: {},
              technicalSpecs: {}
            });
          }
        }
      } catch (err) {
        console.error('Error fetching product details:', err);
        const foundProduct = CRAZY_DEALS.find(item => item.id === id);
        if (foundProduct) {
          setProduct({
            ...foundProduct,
            images: [foundProduct.image]
          });
        }
      } finally {
        setIsLoading(false);
        setActiveImageIndex(0);
        window.scrollTo(0, 0);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product && product.id !== 'fallback') {
      analytics.trackProductView(product.id, product.name, product.type);
    }
  }, [product]);

  if (isLoading || !product) {
    return (
      <div className="flex flex-col min-h-screen bg-surface font-sans pb-[80px]">
        {/* Sticky Header Skeleton */}
        <header className="bg-surface sticky top-0 z-50 flex items-center justify-between px-3 py-3 shadow-sm border-b border-white/10 animate-pulse">
          <div className="w-6 h-6 bg-surface rounded-full" />
          <div className="flex-1 mx-3 h-8 bg-surface rounded" />
          <div className="w-6 h-6 bg-surface rounded-full" />
        </header>

        {/* Hero Image Section Skeleton */}
        <div className="w-full aspect-[3/4] bg-surface animate-pulse" />

        {/* Product Info Section Skeleton */}
        <div className="bg-surface p-4 space-y-3 animate-pulse">
          <div className="w-3/4 h-5 bg-surface rounded" />
          <div className="w-1/2 h-4 bg-surface rounded" />
          <div className="w-1/3 h-6 bg-surface rounded" />
        </div>

        {/* Size Selector Skeleton */}
        <div className="bg-surface p-4 mt-2 space-y-3 animate-pulse">
          <div className="w-24 h-4 bg-surface rounded" />
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-12 h-12 rounded-xl bg-surface" />
            ))}
          </div>
        </div>

        {/* Product Details Description Skeleton */}
        <div className="bg-surface p-4 mt-2 space-y-2.5 animate-pulse">
          <div className="w-28 h-5 bg-surface rounded" />
          <div className="w-full h-3.5 bg-surface rounded" />
          <div className="w-5/6 h-3.5 bg-surface rounded" />
        </div>
      </div>
    );
  }

  const activeVariant = product?.variations?.find(v => v.color === selectedColor && v.size === selectedSize) || product?.variations?.[0];
  const displayPrice = activeVariant && !activeVariant.useDefaultPricing ? activeVariant.sellingPrice : product?.price;
  const displayOriginalPrice = activeVariant && !activeVariant.useDefaultPricing ? activeVariant.mrp : product?.originalPrice;
  const displayStock = activeVariant ? activeVariant.stock : product?.stock;
  
  let displayDiscount = product?.discount;
  if (activeVariant && !activeVariant.useDefaultPricing && displayOriginalPrice && displayPrice) {
      displayDiscount = formatDiscount('', displayOriginalPrice, displayPrice, 'off');
  }
  const colorVariantWithImage = product?.variations?.find(v => v.color === selectedColor && v.images && v.images.length > 0);
  let displayImages = [];
  if (activeVariant?.images?.length > 0) {
      displayImages = activeVariant.images.map(getImageUrl);
  } else if (colorVariantWithImage?.images?.length > 0) {
      displayImages = colorVariantWithImage.images.map(getImageUrl);
  } else if (product?.images?.length > 0) {
      displayImages = product.images;
  } else {
      displayImages = [product?.image];
  }
  
  const uniqueColors = product?.variations ? [...new Set(product.variations.map(v => v.color).filter(c => c && c.toUpperCase() !== 'N/A' && c.toUpperCase() !== 'NA'))] : [];
  const sizesForSelectedColor = product?.variations ? product.variations.filter(v => v.color === selectedColor).map(v => v.size).filter(Boolean) : [];

  const handleAddToCart = () => {
    if (!displayStock || displayStock <= 0) {
      toast.error('Item is out of stock!');
      return;
    }
    const cartItem = {
       ...product,
       price: displayPrice,
       originalPrice: displayOriginalPrice,
       selectedColor,
       selectedSize,
       variantSku: activeVariant?.sku || product.sku
    };
    addToCart(cartItem);
    setToastMessage('Item added to cart!');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleBuyNow = () => {
    if (!displayStock || displayStock <= 0) {
      toast.error('Item is out of stock!');
      return;
    }
    const cartItem = {
       ...product,
       price: displayPrice,
       originalPrice: displayOriginalPrice,
       selectedColor,
       selectedSize,
       variantSku: activeVariant?.sku || product.sku
    };
    const itemInCart = cart.find(item => item.id === product.id && item.selectedColor === selectedColor && item.selectedSize === selectedSize);
    if (!itemInCart) {
      addToCart(cartItem);
    }
    navigate('/review-order');
  };

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface font-sans relative pb-[80px] md:pb-12 animate-fade-in select-none">
      
      {/* Sticky Header (Mobile Only) */}
      <header className="bg-surface sticky top-0 z-50 flex items-center justify-between px-3 py-2 shadow-sm md:hidden">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-700">
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="flex-1 mx-2 bg-surface rounded flex items-center px-3 py-1.5 border border-white/10">
          <Search className="w-5 h-5 text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder="Search for products" 
            className="w-full bg-transparent outline-none text-sm text-slate-700"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value.trimStart())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && localSearchQuery.trim() !== '') {
                setSearchQuery(localSearchQuery);
                navigate('/categories');
              }
            }}
          />
        </div>

        <button onClick={() => navigate('/cart')} className="p-2 relative text-slate-700">
          <ShoppingCart className="w-6 h-6" />
          {totalCartItems > 0 && (
            <span className="absolute top-0 right-0 bg-[#0B132B] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
              {totalCartItems}
            </span>
          )}
        </button>
      </header>

      {/* Main Content wrapper */}
      <div className={`max-w-7xl mx-auto w-full px-0 md:px-6 lg:px-8 md:py-8 pb-28 md:pb-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start ${(!displayStock || displayStock <= 0) ? 'grayscale opacity-90' : ''}`}>
        
        {/* Left Column: Image Gallery on desktop */}
        <div className="md:col-span-7 bg-surface p-0 md:p-6 md:rounded-2xl md:border md:border-white/10 md:shadow-xs space-y-6">
          {/* Hero Image Section */}
          <div className="relative bg-surface border-b border-white/10 md:border-b-0">
            <div className={`w-full aspect-square relative overflow-hidden rounded-none md:rounded-2xl ${displayStock === 0 ? 'grayscale opacity-75' : ''}`}>
              {/* Main Product Images Slider */}
              <div 
                id="product-image-slider"
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
                style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
                onScroll={(e) => {
                  const scrollPosition = e.target.scrollLeft;
                  const width = e.target.offsetWidth;
                  setActiveImageIndex(Math.round(scrollPosition / width));
                }}
              >
                {displayImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="w-full h-full flex-shrink-0 snap-center relative overflow-hidden bg-surface flex items-center justify-center cursor-pointer"
                    onClick={() => setFullscreenImage(img)}
                  >
                    <OptimizedImage src={img} alt={`${product.name} - view ${idx + 1}`} type="product" objectFit="contain" className="absolute inset-0" />
                  </div>
                ))}
              </div>

              {/* Out of Stock Overlay Badge */}
              {displayStock === 0 && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[0.5px] flex items-center justify-center z-25">
                  <span className="bg-red-650 text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-full shadow-lg border border-red-500">
                    Out of Stock
                  </span>
                </div>
              )}

              {/* Dots Indicator Overlay */}
              {displayImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {displayImages.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeImageIndex === idx ? 'bg-[#0B132B] w-3.5' : 'bg-surface/60'}`}
                    />
                  ))}
                </div>
              )}

              {/* Right Action Overlays */}
              <div className="absolute top-4 right-4 flex flex-col gap-3 z-10">
                <button 
                  onClick={() => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    toggleWishlist(product);
                  }}
                  className="w-10 h-10 bg-surface rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
                >
                  <Heart className={`w-5 h-5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
                </button>
                <button 
                  onClick={handleShare}
                  className="w-10 h-10 bg-surface rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer"
                >
                  <Send className="w-5 h-5 text-slate-600 ml-[-2px]" />
                </button>
              </div>

              {/* Left Rating Badge Overlay */}
              <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-md flex items-center gap-1">
                <span className="text-[11px] font-bold text-[#02006c]">4.5</span>
                <Star className="w-2.5 h-2.5 fill-[#0B132B] text-[#0B132B]" />
                <span className="text-slate-300 text-[10px] mx-0.5">|</span>
                <span className="text-[10px] text-slate-500 font-medium">1.2k</span>
              </div>

              {/* Highlights Overlay (Gradient Mask) */}
              <div className={`absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent pointer-events-none flex flex-col justify-center px-4 transition-opacity duration-300 ${activeImageIndex === 1 ? 'opacity-100' : 'opacity-0'}`}>
                <h2 className="text-white font-black tracking-tight text-xl mb-4 drop-shadow-md">Key Highlights</h2>
                
                <div className="space-y-3">
                  {(() => {
                    const validHighlights = product.highlights
                      ? Object.entries(product.highlights).filter(([key, val]) => val !== undefined && val !== null && val !== '' && val !== '-' && val !== '0' && val !== 0)
                      : [];
                    if (validHighlights.length > 0) {
                      return validHighlights.slice(0, 5).map(([key, val]) => (
                        <div key={key} className="flex flex-col border-b border-white/20 pb-0.5 w-28">
                          <span className="text-[10px] text-white/70 capitalize">{key}</span>
                          <span className="text-xs font-bold text-white drop-shadow truncate">{val}</span>
                        </div>
                      ));
                    }
                    return (
                      <>
                        <div className="flex flex-col border-b border-white/20 pb-1 w-24">
                          <span className="text-[10px] text-white/70">Fit</span>
                          <span className="text-sm font-bold text-white drop-shadow">Regular</span>
                        </div>
                        <div className="flex flex-col border-b border-white/20 pb-1 w-24">
                          <span className="text-[10px] text-white/70">Fabric</span>
                          <span className="text-sm font-bold text-white drop-shadow">Premium Quality</span>
                        </div>
                        <div className="flex flex-col border-b border-white/20 pb-1 w-24">
                          <span className="text-[10px] text-white/70">Origin</span>
                          <span className="text-sm font-bold text-white drop-shadow">Made in India</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Image Thumbnails Row */}
            {displayImages.length > 1 && (
              <div className={`flex justify-center gap-2 mt-4 px-4 overflow-x-auto scrollbar-none ${(!displayStock || displayStock <= 0) ? 'grayscale opacity-70' : ''}`}>
                {displayImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveImageIndex(idx);
                      const slider = document.getElementById('product-image-slider');
                      if (slider) {
                        slider.scrollTo({
                          left: idx * slider.offsetWidth,
                          behavior: 'smooth'
                        });
                      }
                    }}
                    className={`w-12 h-16 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 relative cursor-pointer ${
                      activeImageIndex === idx ? 'border-[#0B132B] scale-105 shadow-sm' : 'border-white/10 opacity-60'
                    }`}
                  >
                    <OptimizedImage src={img} alt="" type="product" className="absolute inset-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Info & Specs on desktop */}
        <div className="md:col-span-5 bg-surface p-4 md:p-6 md:rounded-2xl md:border md:border-white/10 md:shadow-xs space-y-4 md:sticky md:top-28">
          {/* Brand & Name */}
          <div className="border-b border-white/10 pb-3">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block mb-1">
              {product.brandName}
            </span>
            <h1 className="text-base md:text-xl font-bold text-[#02006c] leading-tight">
              {product.name}
            </h1>
          </div>

          {/* Variant Selectors */}
          <div className="pb-3 border-b border-white/10 space-y-3">
            {uniqueColors.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-[#02006c]">Selected Color: <span className="font-normal text-slate-700">{selectedColor}</span></span>
                </div>
                <div className="flex gap-2.5 flex-wrap">
                  {uniqueColors.map((color) => {
                    const isSelected = selectedColor === color;
                    const colorVariant = product.variations.find(v => v.color === color);
                    let colorImg = colorVariant?.images?.[0] ? getImageUrl(colorVariant.images[0]) : null;

                    // Fallback to global product image if variation has no image
                    if (!colorImg && product) {
                      colorImg = product.images?.[0] ? getImageUrl(product.images[0]) : (product.image ? getImageUrl(product.image) : null);
                    }

                    return (
                      <button
                        key={color}
                        title={color}
                        onClick={() => {
                           setSelectedColor(color);
                           setActiveImageIndex(0);
                           // auto-select first available size for this color
                           const sizes = product.variations.filter(v => v.color === color).map(v => v.size).filter(Boolean);
                           if (sizes.length > 0 && !sizes.includes(selectedSize)) {
                               setSelectedSize(sizes[0]);
                           }
                        }}
                        className={`rounded-xl border-2 flex items-center justify-center text-xs font-bold transition-all cursor-pointer overflow-hidden bg-white
                          ${isSelected ? 'border-[#0B132B] shadow-sm scale-[1.02]' : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'}
                          ${colorImg ? 'w-16 h-20 p-1' : 'px-4 py-2 text-slate-700'}
                        `}
                      >
                        {colorImg ? <img src={colorImg} alt={color} className="w-full h-full object-cover rounded-lg" /> : color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {sizesForSelectedColor.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-[#02006c]">Select Size</span>
                  <button 
                    onClick={() => setIsSizeChartOpen(true)}
                    className="text-[#0B132B] font-bold text-[11px] cursor-pointer hover:underline"
                  >
                    Size Chart
                  </button>
                </div>
                
                <div className="flex gap-2.5 flex-wrap">
                  {sizesForSelectedColor.map((size) => {
                    const isSelected = selectedSize === size;
                    // check if this specific variant is out of stock
                    const vInfo = product.variations.find(v => v.color === selectedColor && v.size === size);
                    const isOutOfStock = !vInfo || vInfo.stock <= 0;
                    
                    return (
                      <button
                        key={size}
                        disabled={isOutOfStock}
                        onClick={() => setSelectedSize(size)}
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xs font-bold transition-all relative overflow-hidden cursor-pointer
                          ${isSelected ? 'border-[#0B132B] text-[#0B132B] bg-[#0B132B]/5' : 
                            isOutOfStock ? 'border-dashed border-white/10 text-slate-300 bg-surface cursor-not-allowed' : 
                            'border-white/10 text-slate-700 hover:border-slate-400'
                          }
                        `}
                      >
                        {size}
                        {isOutOfStock && <div className="absolute w-[150%] h-[1px] bg-slate-300 -rotate-45" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="border-b border-white/10 pb-4 flex items-center justify-between mt-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[#0B132B] font-bold text-lg">{displayDiscount}</span>
                <span className="text-2xl md:text-3xl font-black text-[#02006c] tracking-tight">₹{displayPrice}</span>
              </div>
              <p className="text-xs text-slate-400 line-through mt-1">MRP ₹{displayOriginalPrice}</p>
            </div>
            <div>
              {displayStock === 0 ? (
                <span className="text-xs font-black text-red-650 bg-red-50 border border-red-250 px-3 py-1.5 rounded-full uppercase tracking-wider animate-pulse">
                  Out of Stock
                </span>
              ) : displayStock <= 10 ? (
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                  Hurry up! Only {displayStock} left
                </span>
              ) : null}
            </div>
          </div>

          {/* Product Description */}
          {product.desc && (
            <div className="border-b border-white/10 pb-4">
              <h3 className="font-bold text-sm text-[#02006c] mb-2">Description</h3>
              <p className="text-xs text-slate-500 font-medium">
                {product.desc}
              </p>
            </div>
          )}

          {/* Delivery Details Section */}
          <div className="pb-4 border-b border-white/10">
            <h3 className="font-bold text-sm text-[#02006c] mb-3">Delivery Details</h3>
            <div className="bg-surface border border-white/10 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Enter Pincode" 
                  className="flex-1 bg-transparent text-sm outline-none text-slate-700 font-semibold"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  onFocus={(e) => {
                    const target = e.target;
                    setTimeout(() => {
                      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                  }}
                />
                <button 
                  onClick={handleCheckPincode}
                  disabled={isCheckingPincode || pincode.length !== 6}
                  className="text-[#0B132B] text-sm font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isCheckingPincode ? 'Checking...' : 'Check'}
                </button>
              </div>
              
              {deliveryCharge !== null && (
                <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="flex items-center gap-1 font-semibold"><Truck className="w-3.5 h-3.5 text-slate-400"/> Prepaid Delivery</span>
                    <span className="font-extrabold text-slate-900">{deliveryCharge > 0 ? `₹${deliveryCharge}` : 'FREE'}</span>
                  </div>
                  {deliveryChargeCOD !== null && (
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="flex items-center gap-1 font-semibold"><Truck className="w-3.5 h-3.5 text-slate-400"/> COD Delivery</span>
                      <span className="font-extrabold text-slate-900">{deliveryChargeCOD > 0 ? `₹${deliveryChargeCOD}` : 'FREE'}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="flex items-center gap-1 font-semibold"><CheckCircle className="w-3.5 h-3.5 text-emerald-600"/> Est. Delivery Date</span>
                    <span className="font-bold text-emerald-600">{deliveryEtd || '3-5 Days'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Purchase Action Buttons (Visible only on md: and above) */}
          <div className="hidden md:flex gap-3 pt-2">
            <button 
              onClick={handleAddToCart}
              disabled={!displayStock || displayStock <= 0}
              className={`flex-1 rounded-xl font-black text-xs uppercase tracking-wider py-3.5 transition-colors flex items-center justify-center gap-1.5
                ${(!displayStock || displayStock <= 0) 
                  ? 'bg-white border border-slate-200 text-slate-400 cursor-not-allowed opacity-60' 
                  : 'bg-white hover:bg-slate-50 border border-[#02006c] text-[#02006c] cursor-pointer'
                }`}
            >
              Add to cart
            </button>
            <button 
              onClick={handleBuyNow}
              disabled={!displayStock || displayStock <= 0}
              className={`flex-1 rounded-xl font-black text-xs uppercase tracking-wider py-3.5 shadow-md transition-colors flex items-center justify-center gap-1.5
                ${(!displayStock || displayStock <= 0) 
                  ? 'bg-surface text-slate-400 cursor-not-allowed opacity-60 shadow-none' 
                  : 'bg-[#0B132B] hover:bg-gold text-white shadow-gold/20 cursor-pointer'
                }`}
            >
              {(!displayStock || displayStock <= 0) ? 'Out of Stock' : `Buy at ₹${displayPrice}`}
            </button>
          </div>
        </div>

        {/* Bottom Area (Specs & Reviews & Similar Products) - Spans full 12 columns */}
        <div className="col-span-1 md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-8 mt-4">
          
          {/* Specifications, Highlights & Details - col-span-7 */}
          <div className="md:col-span-7 space-y-6">
            {/* Highlights */}
            <div className="bg-surface p-4 rounded-2xl border border-white/10 shadow-3xs">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsHighlightsOpen(!isHighlightsOpen)}>
                <div className="flex flex-col">
                  <span className="font-bold text-base text-[#02006c]">Product Highlights</span>
                  {!isHighlightsOpen && <span className="text-xs text-slate-500">Key features and descriptions</span>}
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center transition-transform">
                  {isHighlightsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
              
              {isHighlightsOpen && (
                <div className="mt-4 grid grid-cols-2 gap-y-4 gap-x-6 animate-fade-in border-t border-white/10 pt-4">
                  {(() => {
                    const validHighlights = product.highlights 
                      ? Object.entries(product.highlights).filter(([key, val]) => val !== undefined && val !== null && val !== '' && val !== '-' && val !== '0' && val !== 0)
                      : [];
                    if (validHighlights.length > 0) {
                      return validHighlights.map(([key, val]) => (
                        <div key={key} className="flex flex-col border-b border-white/10 pb-2">
                          <span className="text-[11px] text-slate-400 mb-0.5 capitalize font-extrabold">{key}</span>
                          <span className="text-xs font-bold text-slate-800">{val}</span>
                        </div>
                      ));
                    } else {
                      return (
                        <>
                          <div className="flex flex-col border-b border-white/10 pb-2">
                            <span className="text-[11px] text-slate-400 mb-0.5 font-extrabold">Quality</span>
                            <span className="text-xs font-bold text-slate-800">Premium Grade</span>
                          </div>
                          <div className="flex flex-col border-b border-white/10 pb-2">
                            <span className="text-[11px] text-slate-400 mb-0.5 font-extrabold">Warranty</span>
                            <span className="text-xs font-bold text-slate-800">1 Year Warranty</span>
                          </div>
                        </>
                      );
                    }
                  })()}
                </div>
              )}
            </div>

            {/* Technical Specifications */}
            <div className="bg-surface p-4 rounded-2xl border border-white/10 shadow-3xs">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsDetailsOpen(!isDetailsOpen)}>
                <div className="flex flex-col">
                  <span className="font-bold text-base text-[#02006c]">All Details & Specs</span>
                  {!isDetailsOpen && <span className="text-xs text-slate-500">Manufacturer info and complete list</span>}
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center transition-transform">
                  {isDetailsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isDetailsOpen && (
                <div className="mt-4 animate-fade-in border-t border-white/10 pt-4">
                  <div className="flex gap-2 mb-4">
                    <button 
                      onClick={() => setActiveDetailTab('specifications')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${activeDetailTab === 'specifications' ? 'bg-[#02006c] text-white' : 'bg-surface text-slate-600 border border-white/10'}`}
                    >
                      Specifications
                    </button>
                    <button 
                      onClick={() => setActiveDetailTab('manufacturer')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${activeDetailTab === 'manufacturer' ? 'bg-[#02006c] text-white' : 'bg-surface text-slate-600 border border-white/10'}`}
                    >
                      Manufacturer Info
                    </button>
                  </div>

                  {activeDetailTab === 'specifications' && (
                    <div className="animate-fade-in">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        {(() => {
                          const validSpecs = product.technicalSpecs 
                            ? Object.entries(product.technicalSpecs).filter(([key, val]) => val !== undefined && val !== null && val !== '' && val !== '-' && val !== '0' && val !== 0)
                            : [];

                          if (product.shippingSpecs) {
                            const weightVal = product.shippingSpecs.weight;
                            if (weightVal !== undefined && weightVal !== null && weightVal !== '' && Number(weightVal) > 0) {
                              validSpecs.push(['weight', `${weightVal} kg`]);
                            }
                            const heightVal = product.shippingSpecs.height;
                            if (heightVal !== undefined && heightVal !== null && heightVal !== '' && Number(heightVal) > 0) {
                              validSpecs.push(['height', `${heightVal} cm`]);
                            }
                            const lengthVal = product.shippingSpecs.length;
                            if (lengthVal !== undefined && lengthVal !== null && lengthVal !== '' && Number(lengthVal) > 0) {
                              validSpecs.push(['length', `${lengthVal} cm`]);
                            }
                            const widthVal = product.shippingSpecs.width;
                            if (widthVal !== undefined && widthVal !== null && widthVal !== '' && Number(widthVal) > 0) {
                              validSpecs.push(['width', `${widthVal} cm`]);
                            }
                          }

                          if (validSpecs.length > 0) {
                            return validSpecs.map(([key, val]) => (
                              <div key={key} className="flex flex-col border-b border-white/10 pb-2">
                                <span className="text-[11px] text-slate-400 mb-0.5 capitalize font-extrabold">{key}</span>
                                <span className="text-xs font-bold text-slate-800">{val}</span>
                              </div>
                            ));
                          } else {
                            return (
                              <>
                                <div className="flex flex-col border-b border-white/10 pb-2">
                                  <span className="text-[11px] text-slate-400 mb-0.5 font-extrabold">Brand</span>
                                  <span className="text-xs font-bold text-slate-800">{product.brandName || 'Generic'}</span>
                                </div>
                                <div className="flex flex-col border-b border-white/10 pb-2">
                                  <span className="text-[11px] text-slate-400 mb-0.5 font-extrabold">Type</span>
                                  <span className="text-xs font-bold text-slate-800">Premium quality product</span>
                                </div>
                              </>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {activeDetailTab === 'manufacturer' && (
                    <div className="text-xs font-bold text-slate-600 animate-fade-in space-y-2">
                      <p><span className="text-slate-800 uppercase tracking-wide text-[10px] block text-slate-400">Manufactured by</span> {product.manufacturerInfo || 'Premium Brand Logistics Ltd.'}</p>
                      <p><span className="text-slate-800 uppercase tracking-wide text-[10px] block text-slate-400">Country of Origin</span> India</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ratings, Reviews & Reels - col-span-5 */}
          <div className="md:col-span-5 bg-surface p-4 rounded-2xl border border-white/10 shadow-3xs space-y-6">
            <div className="flex items-center justify-between cursor-pointer animate-fade-in" onClick={() => setIsReviewsOpen(!isReviewsOpen)}>
              <span className="font-bold text-base text-[#02006c]">Ratings & Reviews</span>
              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center transition-transform">
                {isReviewsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {isReviewsOpen && (
              <div className="space-y-4 animate-fade-in border-t border-white/10 pt-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl font-black text-slate-800">4.1</span>
                  <Star className="w-6 h-6 fill-emerald-600 text-emerald-600" />
                  <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs font-extrabold">Very Good</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span>based on 63 ratings by</span>
                  <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Verified Buyers</span>
                </div>

                {/* Video Review Reels list */}
                {productReels.length > 0 && (
                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Video Reviews (Reels)</h4>
                    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                      {productReels.map((reel) => {
                        const videoUrl = getImageUrl(reel.video);
                        return (
                          <div 
                            key={reel._id}
                            onClick={() => setSelectedReviewMedia({ type: 'video', url: videoUrl, reel })}
                            className="relative w-20 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-black cursor-pointer shadow-md group border border-white/10"
                          >
                            <div className="absolute inset-0 bg-black/15 flex items-center justify-center group-hover:bg-black/35 transition-colors z-10">
                              <Play className="w-6 h-6 text-white fill-white opacity-85" />
                            </div>
                            <video src={videoUrl} className="w-full h-full object-cover opacity-80" muted playsInline />
                            
                            <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/90 to-transparent text-white text-[8px] z-10">
                              <p className="font-bold truncate">@{reel.username}</p>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                <span>{reel.rating}</span>
                                <Star className="w-1.5 h-1.5 fill-amber-400 text-amber-400" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upload Reel button */}
                <div>
                  {user && !isEligibleToReview ? (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center text-xs text-rose-600 font-bold leading-relaxed">
                      ⚠️ You can only review products that you have purchased.
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        if (!user) navigate('/login');
                        else setIsUploadReelOpen(true);
                      }}
                      className="w-full py-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                      Submit Video Review (Reel)
                    </button>
                  )}
                </div>

                {/* Customer Reviews List */}
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Customer Reviews</h4>
                  
                  {productReels.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-6 font-semibold">
                      No reviews yet. Be the first to submit a video review!
                    </p>
                  ) : (
                    <div className="space-y-3.5">
                      {productReels.map((reel) => {
                        const videoUrl = getImageUrl(reel.video);
                        return (
                          <div key={reel._id} className="p-3.5 bg-surface border border-white/10 rounded-xl flex gap-3.5 items-start">
                            {/* Playable Video Thumbnail */}
                            <div 
                              onClick={() => setSelectedReviewMedia({ type: 'video', url: videoUrl, reel })}
                              className="relative w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black cursor-pointer shadow-sm border border-white/10 group"
                            >
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                <Play className="w-4 h-4 text-white fill-white opacity-90" />
                              </div>
                              <video src={videoUrl} className="w-full h-full object-cover" muted playsInline />
                            </div>

                            {/* Text content */}
                            <div className="flex-grow space-y-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-extrabold text-[11px] text-slate-800 truncate">
                                  {reel.username}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">
                                  {new Date(reel.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              </div>

                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`w-3 h-3 ${i < (reel.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                                  />
                                ))}
                              </div>

                              <p className="text-[11.5px] text-slate-600 font-bold leading-normal break-words">
                                {reel.caption || "No comment provided."}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Similar Products Grid (Spans full width) */}
        <div className="col-span-1 md:col-span-12 bg-surface py-6 px-4 md:rounded-2xl md:border md:border-white/10 md:shadow-xs mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg tracking-tight text-[#02006c]">Similar Products</h3>
            <div 
              onClick={() => navigate('/similar-products')}
              className="w-8 h-8 bg-slate-800 hover:bg-[#0B132B] transition-colors rounded-full flex items-center justify-center cursor-pointer shadow-sm"
            >
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </div>
          
          {/* Horizontal Scroll on Mobile, responsive grid layout on Desktop */}
          <div className="flex overflow-x-auto gap-4 pb-2 snap-x scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-6 md:gap-4 md:overflow-visible">
            {similarProducts.length > 0 ? similarProducts.map((deal) => (
              <div 
                key={deal._id} 
                className="w-32 md:w-auto flex-shrink-0 snap-start flex flex-col cursor-pointer group" 
                onClick={() => { navigate(`/product/${deal._id}`); window.scrollTo(0,0); }}
              >
                <div className="aspect-square bg-surface rounded-xl overflow-hidden relative mb-2.5 flex items-center justify-center border border-white/10">
                  <OptimizedImage src={getImageUrl(deal.images && deal.images[0])} alt={deal.name} type="product" objectFit="contain" className="absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-2 left-2 bg-surface/90 px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                    <span className="text-[9.5px] font-bold text-slate-800">{deal.rating || '4.2'}</span>
                    <Star className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                  </div>
                </div>
                <h4 className="text-xs font-bold text-[#02006c] truncate group-hover:text-[#0B132B]">{deal.name}</h4>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{deal.description || 'Premium Product'}</p>
                <div className="flex items-center gap-1.5 mt-1 leading-none">
                  <span className="text-xs md:text-sm font-extrabold text-[#0B132B]">₹{deal.sellingPrice}</span>
                  <span className="text-[9.5px] md:text-xs text-slate-400 line-through">₹{deal.mrp || deal.sellingPrice + 500}</span>
                </div>
              </div>
            )) : CRAZY_DEALS.map((deal) => (
              <div 
                key={deal.id} 
                className="w-32 md:w-auto flex-shrink-0 snap-start flex flex-col cursor-pointer group" 
                onClick={() => { navigate(`/product/${deal.id}`); window.scrollTo(0,0); }}
              >
                <div className="aspect-square bg-surface rounded-xl overflow-hidden relative mb-2.5 flex items-center justify-center border border-white/10">
                  <OptimizedImage src={deal.image} alt={deal.name} type="product" objectFit="contain" className="absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-2 left-2 bg-surface/90 px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                    <span className="text-[9.5px] font-bold text-slate-800">4.2</span>
                    <Star className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                  </div>
                </div>
                <h4 className="text-xs font-bold text-[#02006c] truncate group-hover:text-[#0B132B]">{deal.name}</h4>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{deal.desc}</p>
                <div className="flex items-center gap-1.5 mt-1 leading-none">
                  <span className="text-xs md:text-sm font-extrabold text-[#0B132B]">₹{deal.price}</span>
                  <span className="text-[9.5px] md:text-xs text-slate-400 line-through">₹{deal.originalPrice}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 p-2.5 z-45 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] max-w-md mx-auto w-full md:hidden">
        <div className="flex gap-2 h-12">
          <button 
            onClick={handleAddToCart}
            disabled={!product.stock || product.stock <= 0}
            className={`flex-1 rounded font-bold text-[13px] flex items-center justify-center transition-colors
              ${(!product.stock || product.stock <= 0) 
                ? 'bg-white border border-slate-200 text-slate-400 cursor-not-allowed opacity-60' 
                : 'bg-white border border-[#02006c] text-[#02006c] active:bg-slate-50'
              }`}
          >
            Add to cart
          </button>
          <button 
            onClick={handleBuyNow}
            disabled={!product.stock || product.stock <= 0}
            className={`flex-1 rounded font-bold text-[13px] flex items-center justify-center transition-colors
              ${(!product.stock || product.stock <= 0) 
                ? 'bg-surface text-slate-400 cursor-not-allowed opacity-60' 
                : 'bg-[#0B132B] text-white active:bg-gold shadow-sm'
              }`}
          >
            {(!product.stock || product.stock <= 0) ? 'Out of Stock' : `Buy at ₹${product.price}`}
          </button>
        </div>
      </div>

      {/* Size Chart Modal */}
      {['tee', 'pants', 'blouse', 'outfit'].includes(product.type) && isSizeChartOpen && (
        <div className="fixed inset-0 z-[100] bg-surface flex flex-col animate-fade-in font-sans">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-white/10 sticky top-0 bg-surface">
            <button onClick={() => setIsSizeChartOpen(false)} className="p-1 hover:bg-surface rounded-full">
              <X className="w-6 h-6 text-slate-500" />
            </button>
            <h2 className="text-[17px] text-slate-800">Size Chart</h2>
          </div>

          <div className="overflow-y-auto flex-1 bg-surface">
            {/* Title */}
            <div className="bg-surface px-4 py-4 text-center">
              <h3 className="font-bold text-slate-900 text-sm">{product.name}</h3>
            </div>

            {/* Table */}
            <div className="bg-surface overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-3 font-bold text-slate-800">Size</th>
                    <th className="p-3 font-bold text-slate-800">Chest</th>
                    <th className="p-3 font-bold text-slate-800">Brand Size</th>
                    <th className="p-3 font-bold text-slate-800">Shoulder</th>
                    <th className="p-3 font-bold text-slate-800">Length</th>
                    <th className="p-3 font-bold text-slate-800">Sleeve Length</th>
                    <th className="p-3 font-bold text-slate-800">Waist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="p-3 font-black text-black">M</td>
                    <td className="p-3 whitespace-nowrap">35.5 - 37</td>
                    <td className="p-3">M</td>
                    <td className="p-3">14</td>
                    <td className="p-3">23</td>
                    <td className="p-3">6</td>
                    <td className="p-3">34</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-black text-black">L</td>
                    <td className="p-3 whitespace-nowrap">37.5 - 39</td>
                    <td className="p-3">L</td>
                    <td className="p-3">15</td>
                    <td className="p-3">23.5</td>
                    <td className="p-3">6.5</td>
                    <td className="p-3">36</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-black text-black">XL</td>
                    <td className="p-3 whitespace-nowrap">39.5 - 41</td>
                    <td className="p-3">XL</td>
                    <td className="p-3">16</td>
                    <td className="p-3">24</td>
                    <td className="p-3">7</td>
                    <td className="p-3">38</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Measurement Guidelines */}
            <div className="bg-surface p-4 pb-12 mt-1 h-full">
              <h4 className="font-bold text-slate-900 text-sm mb-3">Measurement Guidelines:</h4>
              <p className="text-sm text-slate-800 mb-2 leading-snug">
                <span className="font-bold">Measuring T Shirt Size</span> Not sure about your t shirt size? Follow these simple steps to figure it out:
              </p>
              <ul className="text-sm text-slate-800 space-y-2 leading-snug">
                <li><span className="font-bold">Shoulder</span> - Measure the shoulder at the back, from edge to edge with arms relaxed on both sides</li>
                <li><span className="font-bold">Chest</span> - Measure around the body under the arms at the fullest part of the chest with your arms relaxed at both sides.</li>
                <li><span className="font-bold">Sleeve</span> - Measure from the shoulder seam through the outer arm to the cuff/hem</li>
                <li><span className="font-bold">Neck</span> - Measured horizontally across the neck Length - Measure from the highest point of the shoulder seam to the bottom hem of the garment's</li>
              </ul>
              
              <div className="mt-6 flex justify-center bg-surface rounded-lg p-3 max-w-[280px] mx-auto border border-white/10">
                <svg viewBox="0 0 200 150" className="w-full h-auto text-slate-800" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M60,40 Q100,20 140,40 L180,90 L160,110 L140,90 L140,150 L60,150 L60,90 L40,110 L20,90 Z" />
                  <path strokeDasharray="4 4" d="M100,30 L100,150" stroke="#0B132B" />
                  <path strokeDasharray="4 4" d="M60,90 L140,90" stroke="#0B132B" />
                  <path strokeDasharray="4 4" d="M60,40 L140,40" stroke="#0B132B" />
                  <path strokeDasharray="4 4" d="M40,65 L80,65" stroke="#0B132B" />
                  <text x="90" y="20" fontSize="8" fill="currentColor" stroke="none">NECK</text>
                  <text x="130" y="35" fontSize="8" fill="currentColor" stroke="none">SHOULDER</text>
                  <text x="95" y="100" fontSize="8" fill="currentColor" stroke="none">CHEST</text>
                  <text x="25" y="125" fontSize="8" fill="currentColor" stroke="none">SLEEVE</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-[70px] left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-bold animate-slide-up z-[60] flex items-center gap-2 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Media Viewer Modal */}
      {selectedReviewMedia && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col animate-fade-in font-sans">
          <div className="flex justify-end p-4">
            <button 
              onClick={() => setSelectedReviewMedia(null)} 
              className="p-2 bg-surface/10 rounded-full hover:bg-surface/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {selectedReviewMedia.type === 'video' ? (
              <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl">
                <video 
                  ref={videoRef}
                  src={selectedReviewMedia.url} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  controls
                  onTimeUpdate={(e) => {
                    if (e.target.currentTime >= 8) {
                      e.target.currentTime = 0;
                      e.target.play();
                    }
                  }}
                  className="w-full h-full object-cover" 
                />
                <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                      {(selectedReviewMedia.reel?.username || 'A').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold shadow-sm">@{selectedReviewMedia.reel?.username || 'Aman Sharma'}</span>
                  </div>
                  <p className="text-[10px] line-clamp-2 text-white/90">{selectedReviewMedia.reel?.caption || 'Amazing quality! The fabric feels premium and the fit is exactly as shown.'}</p>
                </div>
              </div>
            ) : (
              <OptimizedImage src={selectedReviewMedia.url} alt="Review" type="product" className="w-full max-w-sm rounded-xl object-contain max-h-[80vh] shadow-2xl" />
            )}
          </div>
        </div>
      )}

      {/* Upload Video Reel Modal */}
      {isUploadReelOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-surface rounded-t-3xl rounded-b-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-slide-up pb-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-slate-800 text-base uppercase tracking-wider">Submit video review (reel)</h3>
              <button onClick={() => setIsUploadReelOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadReel} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Rating (1-5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setReelRating(star)}
                      className="text-amber-400 hover:scale-110 transition-transform"
                    >
                      <Star className={`w-8 h-8 ${star <= reelRating ? 'fill-amber-400' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Review Caption / Text</label>
                <textarea
                  required
                  rows={3}
                  value={reelCaption}
                  onChange={(e) => setReelCaption(e.target.value)}
                  placeholder="Tell us what you loved about this product..."
                  className="w-full bg-surface border border-white/10 rounded-xl py-3 px-4 text-xs font-bold focus:ring-4 focus:ring-indigo-50 outline-none text-slate-800 placeholder:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Video File</label>
                <input
                  required
                  type="file"
                  accept="video/*"
                  onChange={(e) => setReelVideoFile(e.target.files[0])}
                  className="w-full text-xs font-bold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 file:cursor-pointer hover:file:bg-indigo-100"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUploadingReel}
                  className="w-full py-3 bg-[#0B132B] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gold transition-colors shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:bg-surface disabled:shadow-none"
                >
                  {isUploadingReel ? 'Uploading Video...' : 'Submit Reel Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Image Zoom Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col animate-fade-in font-sans touch-none">
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-[310]">
            <button 
              onClick={() => setFullscreenImage(null)} 
              className="p-2 bg-surface/10 rounded-full hover:bg-surface/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={4}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
              doubleClick={{ mode: 'toggle' }}
              pinch={{ step: 5 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <TransformComponent wrapperStyle={{ width: '100vw', height: '100vh' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <OptimizedImage 
                    src={fullscreenImage} 
                    alt="Zoomed Product" 
                    type="product"
                    objectFit="contain"
                    className="w-full h-auto max-h-[100dvh] pointer-events-auto" 
                  />
                </TransformComponent>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}

      {/* Custom Share Modal */}
      {isShareModalOpen && (
        <>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            @keyframes scaleIn {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .animate-modal-fade {
              animation: fadeIn 0.2s ease-out forwards;
            }
            .animate-modal-slide {
              animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .animate-modal-scale {
              animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end md:items-center justify-center z-[250] animate-modal-fade"
            onClick={() => setIsShareModalOpen(false)}
          >
            <div 
              className="w-full md:max-w-md bg-surface rounded-t-3xl md:rounded-2xl p-6 md:p-7 shadow-2xl flex flex-col gap-5 animate-modal-slide md:animate-modal-scale"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-black text-[#02006c]">Share Product</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Spread the word about this product</p>
                </div>
                <button 
                  onClick={() => setIsShareModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface hover:bg-surface flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Social Grid */}
              <div className="grid grid-cols-4 gap-4 py-2">
                {/* WhatsApp */}
                <button 
                  onClick={() => {
                    const text = `Check out this amazing product on Aramish: ${product?.name || ''}`;
                    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + window.location.href)}`;
                    window.open(url, '_blank');
                    setIsShareModalOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.114-2.905-6.99C16.557 1.875 14.07 1.84 11.472 1.84c-5.437 0-9.862 4.42-9.866 9.863-.001 1.762.461 3.483 1.337 5.019L1.87 22.13l5.59-1.466.162-.093zM18.23 15.65c-.3-.15-1.782-.88-2.062-.98-.28-.1-.48-.15-.68.15-.2.3-.77.98-.94 1.18-.17.2-.34.22-.64.07-1.125-.565-2.063-1.166-2.855-1.848-.77-.665-1.3-1.468-1.45-1.72-.15-.27-.02-.415.115-.55.12-.12.27-.3.4-.45.13-.15.17-.25.26-.43.09-.17.04-.32-.02-.47-.06-.15-.48-1.15-.66-1.58-.17-.43-.35-.37-.48-.37h-.41c-.14 0-.36.05-.55.25-.19.2-.72.7-0.72 1.7 0 1 .73 1.97.83 2.1.1.13 1.44 2.2 3.49 3.08.49.21.87.34 1.17.44.5.16.95.14 1.31.08.4-.06 1.782-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.08-.13-.28-.21-.58-.36z"/></svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">WhatsApp</span>
                </button>

                {/* Facebook */}
                <button 
                  onClick={() => {
                    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
                    window.open(url, '_blank');
                    setIsShareModalOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">Facebook</span>
                </button>

                {/* Twitter / X */}
                <button 
                  onClick={() => {
                    const text = `Check out this amazing product on Aramish: ${product?.name || ''}`;
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
                    window.open(url, '_blank');
                    setIsShareModalOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-surface text-slate-800 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">Twitter / X</span>
                </button>

                {/* Email */}
                <button 
                  onClick={() => {
                    const subject = `Check out this product on Aramish`;
                    const body = `Hey, check out this amazing product on Aramish: ${product?.name || ''}\n\n${window.location.href}`;
                    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    window.open(url, '_self');
                    setIsShareModalOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-surface text-slate-600 flex items-center justify-center group-hover:bg-slate-600 group-hover:text-white transition-all shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">Email</span>
                </button>
              </div>

              {/* Copy Link Input Bar */}
              <div className="flex items-center gap-2 bg-surface border border-white/10 rounded-xl p-2 mt-2">
                <input 
                  type="text" 
                  readOnly 
                  value={window.location.href} 
                  className="flex-1 bg-transparent border-none outline-none text-xs text-slate-500 px-2 select-all"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Link copied to clipboard!', {
                      position: 'top-center',
                      style: {
                        padding: '8px 14px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        borderRadius: '50px',
                        background: '#ffffff',
                        color: '#1e293b',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                      }
                    });
                    setIsShareModalOpen(false);
                  }}
                  className="bg-[#02006c] hover:bg-[#02006c]/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
