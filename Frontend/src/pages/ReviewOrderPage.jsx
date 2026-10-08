import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Tag, Banknote, ShieldCheck, X, CheckCircle2, Plus, Coins, Landmark, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';
import OptimizedImage from '../components/ui/OptimizedImage';
import analytics from '../utils/analytics';

export default function ReviewOrderPage() {
  const navigate = useNavigate();
  const { cart, totalCartPrice, user, clearCart, addOrder, refreshOrders, systemSettings, removeFromCart } = useApp();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);


  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [dbAddresses, setDbAddresses] = useState([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  
  // Add new address form state
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrType, setNewAddrType] = useState('Home');
  const [newAddrText, setNewAddrText] = useState('');
  const [newAddrPhone, setNewAddrPhone] = useState('');
  const [newAddrPincode, setNewAddrPincode] = useState('');

  // Promo code states
  const [promoInput, setPromoInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [feeInfoModal, setFeeInfoModal] = useState(null);
  
  // Single combined wallet — redemption limit and reward estimate come from the backend
  const [redeemWallet, setRedeemWallet] = useState(false);
  const [redeemRefundWallet, setRedeemRefundWallet] = useState(false);
  const [walletPreview, setWalletPreview] = useState(null);
  
  // Payment states
  const [paymentMethod, setPaymentMethod] = useState('ONLINE'); // 'COD' | 'ONLINE'
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrderState] = useState(false);
  // The ref blocks a second tap before React re-renders (state alone lets a fast double tap through)
  const placingOrderRef = useRef(false);
  const setIsPlacingOrder = (value) => {
    placingOrderRef.current = value;
    setIsPlacingOrderState(value);
  };
  // A Razorpay payment that succeeded but whose order request failed (network/server error).
  // The next tap retries the order with this payment instead of charging the customer again.
  const unplacedPaymentIdRef = useRef(null);

  // Shipping estimate states
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [etd, setEtd] = useState('');
  const [isEstimatingDelivery, setIsEstimatingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');
  const isAnyModalOpen = isAddressModalOpen || Boolean(feeInfoModal);

  useEffect(() => {
    if (isAnyModalOpen) {
      const scrollContainer = document.getElementById('main-scroll-container');
      const originalBodyOverflow = document.body.style.overflow;
      const originalContainerOverflow = scrollContainer ? scrollContainer.style.overflow : '';

      document.body.style.overflow = 'hidden';
      if (scrollContainer) {
        scrollContainer.style.overflow = 'hidden';
      }

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        if (scrollContainer) {
          scrollContainer.style.overflow = originalContainerOverflow;
        }
      };
    }
  }, [isAnyModalOpen]);

  // Fetch addresses
  const fetchAddresses = async () => {
    if (user && user.id) {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return;
        const res = await fetch(`${API_BASE}/addresses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setDbAddresses(data.data);
          if (data.data.length > 0) {
            setSelectedAddressId(data.data[0]._id);
          }
        }
      } catch (err) {
        console.error("Error fetching addresses:", err);
      }
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  // Wallet redemption preview for the current cart (backend is the single source of truth)
  const walletPreviewKey = cart.map(item => `${item.id}:${item.variationSku || ''}:${item.quantity}`).join('|');
  useEffect(() => {
    const fetchWalletPreview = async () => {
      const token = localStorage.getItem('userToken');
      if (!user || !user.id || !token || cart.length === 0) {
        setWalletPreview(null);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/orders/wallet-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            items: cart.map(item => ({ productId: item.id, variationSku: item.variationSku || null, quantity: item.quantity }))
          })
        });
        const data = await res.json();
        if (data.success) setWalletPreview(data);
      } catch (err) {
        console.error("Error fetching wallet preview:", err);
      }
    };
    fetchWalletPreview();
  }, [user, API_BASE, walletPreviewKey]);

  useEffect(() => {
    if (cart && cart.length > 0) {
      analytics.trackCheckoutStarted(cart, totalCartPrice);
    }
  }, []);

  useEffect(() => {
    if (selectedAddress) {
      analytics.trackShippingAdded(selectedAddress.type, selectedAddress.pincode);
    }
  }, [selectedAddressId]);

  useEffect(() => {
    analytics.trackPaymentSelected(paymentMethod);
  }, [paymentMethod]);

  const addressesList = dbAddresses;
  
  useEffect(() => {
    if (!selectedAddressId && addressesList.length > 0) {
      setSelectedAddressId(addressesList[0]._id || addressesList[0].id);
    }
  }, [addressesList, selectedAddressId]);

  const selectedAddress = addressesList.find(a => (a._id === selectedAddressId || a.id === selectedAddressId)) || addressesList[0];

  useEffect(() => {
    if (selectedAddress && selectedAddress.pincode && cart.length > 0) {
      const estimateShipping = async () => {
        setIsEstimatingDelivery(true);
        try {
          const totalWeight = cart.reduce((total, item) => total + ((item.weight || 0.5) * item.quantity), 0);
          const res = await fetch(`${API_BASE}/api/shiprocket/estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              deliveryPincode: selectedAddress.pincode, 
              weight: totalWeight, 
              cod: paymentMethod === 'COD' ? 1 : 0 
            })
          });
          const data = await res.json();
          if (data.success) {
            setDeliveryCharge(data.deliveryCharge);
            setEtd(data.etd);
            setDeliveryError('');
          } else {
            // Not deliverable / quote failed: never show it as free delivery.
            setDeliveryCharge(0);
            setEtd('');
            setDeliveryError(data.message || 'Could not calculate the delivery charge. Please try again.');
          }
        } catch (err) {
          console.error("Error estimating shipping:", err);
          setDeliveryCharge(0);
          setEtd('');
          setDeliveryError('Could not calculate the delivery charge. Please check your connection and try again.');
        } finally {
          setIsEstimatingDelivery(false);
        }
      };
      estimateShipping();
    }
  }, [selectedAddress, paymentMethod, cart, API_BASE]);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!newAddrName || !newAddrText || !newAddrPincode || !newAddrPhone) {
      alert("Please fill all required fields");
      return;
    }
    if (/\d/.test(newAddrName)) {
      alert("Receiver name cannot contain numerical digits");
      return;
    }
    let cleanedPhone = newAddrPhone.trim().replace(/\D/g, '');
    if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
      cleanedPhone = cleanedPhone.slice(2);
    } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('0')) {
      cleanedPhone = cleanedPhone.slice(1);
    }

    if (cleanedPhone.length !== 10) {
      alert("Phone number must be exactly 10 digits");
      return;
    }
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(newAddrPincode)) {
      alert("Pincode must be exactly 6 digits");
      return;
    }
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE}/addresses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newAddrName,
          phone: cleanedPhone,
          type: newAddrType,
          address: newAddrText,
          pincode: newAddrPincode
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDbAddresses(prev => [...prev, data.data]);
        setSelectedAddressId(data.data._id);
        setIsAddingAddress(false);
        setNewAddrName('');
        setNewAddrPhone('');
        setNewAddrType('Home');
        setNewAddrText('');
        setNewAddrPincode('');
      } else {
        alert(data.message || "Failed to add address");
      }
    } catch (err) {
      console.error("Error adding address:", err);
      alert("Failed to add address due to server error");
    }
  };

  useEffect(() => {
    const fetchAvailableCoupons = async () => {
      try {
        const token = localStorage.getItem('userToken');
        const res = await fetch(`${API_BASE}/admin/promotions/coupons`, {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          // Filter active coupons that expire in the future
          const active = (data.coupons || []).filter(c => c.status === 'Active' && new Date(c.expiry) > new Date());
          setAvailableCoupons(active);
        }
      } catch (err) {
        console.error('Failed to load eligible coupons:', err);
      }
    };
    fetchAvailableCoupons();
  }, [API_BASE]);

  const handleApplyPromo = async (codeOverride = null) => {
    const code = (typeof codeOverride === 'string' ? codeOverride : promoInput).trim();
    if (!code) {
      setPromoError('Please enter a coupon code.');
      return;
    }
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE}/admin/promotions/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          code: code,
          orderAmount: totalCartPrice
        })
      });
      const data = await res.json();
      if (data.success && data.coupon) {
        const found = data.coupon;
        setAppliedCoupon(found);
        setPromoError('');
        setPromoInput(found.code);
        let discount = 0;
        if (found.type === 'Percentage') {
          discount = Math.round((totalCartPrice * found.value) / 100);
        } else {
          discount = found.value;
        }
        setDiscountAmount(discount);
        analytics.trackCouponApplied(found.code, true, discount);
      } else {
        setPromoError(data.message || 'Failed to validate coupon.');
        setAppliedCoupon(null);
        setDiscountAmount(0);
        analytics.trackCouponApplied(code, false, 0);
      }
    } catch (err) {
      console.error("Error applying promo:", err);
      setPromoError('Server error validating coupon.');
      setAppliedCoupon(null);
      setDiscountAmount(0);
    }
  };


  const handleRemovePromo = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setPromoInput('');
    setPromoError('');
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async () => {
    if (placingOrderRef.current) return;
    if (cart.length === 0) {
      toast.info("Your cart is empty");
      return;
    }
    
    if (!selectedAddress) {
      toast.info("Please add a delivery address before placing order");
      return;
    }

    // Don't take a payment until the delivery charge is known.
    if (isEstimatingDelivery) {
      toast.info("Calculating delivery charge, please wait a moment");
      return;
    }
    if (deliveryError) {
      toast.error(deliveryError);
      return;
    }

    setIsPlacingOrder(true);
    
    if (paymentMethod === 'ONLINE' && unplacedPaymentIdRef.current) {
      executeOrderPlacement("Online", unplacedPaymentIdRef.current);
    } else if (paymentMethod === 'ONLINE') {
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error("Razorpay SDK failed to load. Are you offline?");
        setIsPlacingOrder(false);
        return;
      }
      
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_mockkey",
        amount: grandTotal * 100,
        currency: "INR",
        name: "Aramish",
        description: "Purchase Transaction",
        handler: function (response) {
          unplacedPaymentIdRef.current = response.razorpay_payment_id;
          executeOrderPlacement("Online", response.razorpay_payment_id);
        },
        prefill: {
          name: user?.name || "Customer",
          email: user?.email || "customer@example.com",
          contact: user?.phone || ""
        },
        notes: {
          userId: user?.id || user?._id || "",
          addressId: selectedAddress?._id || selectedAddress?.id || "",
          couponCode: appliedCoupon ? appliedCoupon.code : "",
          cartSummary: cart.map(item => `${item.id || item.productId}:${item.quantity}`).join(',')
        },
        theme: {
          color: "#0B132B"
        },
        modal: {
          ondismiss: function() {
            setIsPlacingOrder(false);
          }
        }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      // Direct COD placement
      setTimeout(() => {
        executeOrderPlacement("COD");
      }, 1500);
    }
  };

  const executeOrderPlacement = async (method, paymentId = '') => {
    try {
      const token = localStorage.getItem('userToken');
      const orderItems = cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        variationSku: item.variationSku || null,
        attributes: item.attributes || {}
      }));
      
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: orderItems,
          total: grandTotal,
          deliveryAddress: {
            name: selectedAddress.name,
            type: selectedAddress.type,
            address: selectedAddress.address,
            pincode: selectedAddress.pincode,
            phone: selectedAddress.phone
          },
          paymentMethod: method === 'Online' ? 'Online' : 'COD',
          paymentStatus: method === 'Online' ? 'Paid' : 'Pending',
          paymentId: paymentId,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          deliveryCharge: deliveryCharge,
          etd: etd,
          redeemWallet: redeemWallet,
          redeemRefundWallet: redeemRefundWallet
        })
      });
      
      const data = await res.json().catch(() => ({}));

      // The order for this payment already exists (e.g. created by the Razorpay webhook while
      // this request was in flight), so the purchase went through.
      if (data.code === 'PAYMENT_ALREADY_USED') {
        unplacedPaymentIdRef.current = null;
        clearCart();
        refreshOrders();
        toast.success('Your order has been placed.');
        navigate('/orders', { replace: true });
        return;
      }

      if (data.success && data.order) {
        unplacedPaymentIdRef.current = null;
        const o = data.order;
        const mappedOrder = {
          id: o._id || o.id,
          date: new Date(o.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
          items: o.items.map(item => ({
            id: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            variationSku: item.variationSku || null,
            attributes: item.attributes || {}
          })),
          total: o.total,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          deliveryCharge: o.deliveryCharge,
          etd: o.etd
        };
        
        addOrder(mappedOrder);
        clearCart();
        toast.success(`Order Placed Successfully via ${method}!`);
        navigate('/order-success', { replace: true, state: { order: o } });
      } else if (method === 'Online' && res.status >= 500) {
        toast.error("Your payment was received but we couldn't confirm the order. Tap Place order to try again. You won't be charged twice.");
      } else {
        // The order was rejected (stock, amount, coupon...): the payment is not used, and Razorpay
        // refunds an uncaptured payment automatically.
        unplacedPaymentIdRef.current = null;
        toast.error(data.message || "Failed to place order.");
      }
    } catch (err) {
      console.error("Order placement failed:", err);
      toast.error(method === 'Online'
        ? "Network problem while confirming your order. Your payment is safe. Tap Place order to try again."
        : "Failed to place order. Please check your connection and try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };


  const originalTotal = cart.reduce((sum, item) => sum + (item.originalPrice || item.price) * item.quantity, 0);
  const productDiscount = Math.max(0, originalTotal - totalCartPrice);
  const platformCommission = systemSettings?.commission ?? 15;

  const codChargeAmount = systemSettings?.codChargeAmount ?? 150;
  const isCodChargeEnabled = systemSettings?.codChargeEnabled ?? true;
  const prepaidDiscountAmount = systemSettings?.prepaidDiscountAmount ?? 100;
  const isPrepaidDiscountEnabled = systemSettings?.prepaidDiscountEnabled ?? true;

  const codCharge = (isCodChargeEnabled && paymentMethod === 'COD') ? codChargeAmount : 0;
  const prepaidDiscount = (isPrepaidDiscountEnabled && paymentMethod === 'ONLINE') ? prepaidDiscountAmount : 0;

  const grandTotalBeforeCoins = Math.max(0, totalCartPrice - discountAmount + platformCommission + deliveryCharge + codCharge - prepaidDiscount);
  
  // Wallet figures are backend-calculated (min(available balance, redemption% of product value)).
  // The order total can only cap it further; the backend applies the same cap when placing the order.
  const walletBalance = walletPreview?.walletBalance ?? 0;
  const availableWalletBalance = walletPreview?.availableBalance ?? 0;
  const lockedRewardCoins = walletPreview?.lockedBalance ?? 0;
  const walletUsedAmount = redeemWallet ? Math.min(walletPreview?.maxRedeemable ?? 0, Math.floor(grandTotalBeforeCoins)) : 0; // whole coins only

  // Refund Wallet (actual money, separate from coins): no % limit — the backend applies it
  // after the coins, up to whatever is still payable.
  const refundWalletBalance = walletPreview?.refundWalletBalance ?? 0;
  const refundWalletUsedAmount = redeemRefundWallet
    ? Math.min(refundWalletBalance, Math.max(0, grandTotalBeforeCoins - walletUsedAmount))
    : 0;

  const grandTotal = Math.max(0, grandTotalBeforeCoins - walletUsedAmount - refundWalletUsedAmount);

  const firstItem = cart && cart.length > 0 ? cart[0] : null;


  return (
    <div className="min-h-screen bg-surface font-sans pb-32 md:pb-12 animate-fade-in select-none">
      {/* Header (Mobile Only) */}
      <header className="bg-[#fff4f2] px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow-sm border-b border-gold/20 md:hidden">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-surface/50 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#02006c]" />
        </button>
        <div className="flex flex-col leading-tight">
          <h1 className="text-base font-black text-[#02006c] tracking-tight">Review Order</h1>
          <span className="text-[11px] font-bold text-emerald-600">You're saving ₹{productDiscount + discountAmount}</span>
        </div>
      </header>

      {/* Responsive two-column wrapper */}
      <div className="max-w-7xl mx-auto w-full px-0 md:px-6 lg:px-8 py-4 md:py-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Delivery details, Coupons, Payment Method, Items - Spans 8 cols */}
        <div className="md:col-span-8 space-y-6">
          <h2 className="hidden md:block text-xl font-black text-[#02006c] mb-2 uppercase tracking-wide">
            Review Your Order
          </h2>

          {/* Delivery Details Section */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-1 text-[#02006c]">
              <MapPin className="w-4 h-4" />
              <h2 className="text-xs font-black uppercase tracking-wide">Delivery Details</h2>
            </div>
            <div className="bg-surface rounded-2xl p-4 shadow-3xs border border-white/10">
              {selectedAddress ? (
                <>
                  <p className="text-[13px] leading-snug text-slate-600 mb-3">
                    <span className="font-bold text-slate-800">{selectedAddress.name}</span> ({selectedAddress.type}) - {selectedAddress.address}, {selectedAddress.pincode}
                  </p>
                  <button 
                    onClick={() => setIsAddressModalOpen(true)}
                    className="text-[#0B132B] text-xs font-bold mb-4 cursor-pointer hover:underline"
                  >
                    Change Address <span className="ml-1">›</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 bg-gold/10 rounded-lg border border-gold/20 mb-4">
                  <p className="text-sm font-bold text-slate-700 mb-2">Please add shipping info</p>
                  <button 
                    onClick={() => {
                      setIsAddingAddress(true);
                      setIsAddressModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#0B132B] text-white text-xs font-bold rounded-lg shadow-sm hover:scale-105 transition-transform cursor-pointer"
                  >
                    Add New Address
                  </button>
                </div>
              )}
              
              {/* Product items list in checkout */}
              <div className="space-y-3.5 mt-2">
                {cart && cart.map((item, idx) => (
                  <div key={item.id || idx} className="relative flex items-center gap-3.5 bg-surface p-3 rounded-xl border border-slate-150/40 pr-8">
                    <div className="w-14 h-14 relative flex-shrink-0 bg-surface rounded-lg border border-white/10 overflow-hidden flex items-center justify-center">
                      <OptimizedImage src={item.image} alt={item.name} type="product" objectFit="contain" className="absolute inset-0 shadow-3xs" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h3 className="text-xs md:text-sm font-bold text-slate-800 leading-snug truncate">{item.name}</h3>
                      {item.variationSku && (
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5 font-medium">
                          SKU: <span className="font-semibold text-slate-700">{item.variationSku}</span>
                        </p>
                      )}
                      {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(item.attributes).map(([key, val], idx) => (
                            <span key={`${key}-${idx}`} className="text-[9px] bg-surface text-slate-700 px-1.5 py-0.5 rounded font-black uppercase">
                              {key}: {val}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs md:text-sm font-black text-[#02006c]">₹{item.price * item.quantity}</span>
                        <span className="text-[10px] md:text-xs font-bold text-slate-400">Qty: {item.quantity}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 w-fit px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {etd ? `Estimated Delivery: ${etd}` : 'Delivery Tomorrow'}
                      </div>
                    </div>
                    {cart.length > 1 && (
                      <button 
                        onClick={() => removeFromCart(item.id, item.variationSku)}
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Promo Code Input Block */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2 text-[#02006c]">
                <Tag className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-black uppercase tracking-wide">Promo Code / Coupons</h2>
              </div>
              {appliedCoupon && (
                <span className="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  Active
                </span>
              )}
            </div>
            <div className="bg-surface rounded-2xl p-3 shadow-3xs border border-white/10 flex flex-col gap-1.5">
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <input 
                    type="text" 
                    placeholder="Enter Coupon (e.g. FLAT50)" 
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    className="w-full border border-white/10 rounded-lg pl-3 pr-8 py-2 text-xs font-bold focus:outline-none focus:border-[#0B132B] uppercase"
                    disabled={!!appliedCoupon}
                  />
                  {appliedCoupon && (
                    <button 
                      onClick={handleRemovePromo}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {!appliedCoupon ? (
                  <button 
                    onClick={handleApplyPromo}
                    className="bg-[#0B132B] hover:bg-[#d8401e] text-white px-4 py-2 rounded-lg text-xs font-black transition-all active:scale-95 shadow-sm cursor-pointer"
                  >
                    Apply
                  </button>
                ) : (
                  <button 
                    onClick={handleRemovePromo}
                    className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                  </button>
                )}
              </div>
              {promoError && <p className="text-[10px] text-rose-500 font-bold">{promoError}</p>}
              {appliedCoupon && (
                <p className="text-[10px] text-green-600 font-bold">
                  ✓ Coupon '{appliedCoupon.code}' applied successfully!
                </p>
              )}
              
              {/* Available Coupons List */}
              {availableCoupons.length > 0 && !appliedCoupon && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Available Coupons</p>
                  <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                    {availableCoupons.map((coupon) => (
                      <div 
                        key={coupon._id} 
                        onClick={() => handleApplyPromo(coupon.code)}
                        className="flex justify-between items-center p-2 rounded-xl bg-surface border border-white/10 hover:border-gold/20 hover:bg-gold/10 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-[#0B132B] bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-lg w-max mb-1">
                            {coupon.code}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {coupon.type === 'Percentage' ? `${coupon.value}% Off` : `₹${coupon.value} Off`}
                            {coupon.minOrder > 0 && ` on orders above ₹${coupon.minOrder}`}
                          </span>
                        </div>
                        <button className="text-[10px] font-black text-blue-600 hover:text-blue-700 pointer-events-none">
                          APPLY
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aramish Wallet Cash Redemption */}
          {walletBalance > 0 && walletPreview?.walletEnabled !== false && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 text-[#02006c]">
                <Landmark className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-black uppercase tracking-wide">Main Wallet / Coins</h2>
              </div>
              <div className="bg-surface rounded-2xl p-4 shadow-3xs border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">
                      Use Wallet Balance (Max {walletPreview?.walletRedemptionPercentage ?? 0}% of product value)
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Available Balance: <span className="font-bold text-slate-700">₹{Number(availableWalletBalance).toFixed(2)}</span>
                      {lockedRewardCoins > 0 && (
                        <span className="text-amber-600"> · 🔒 ₹{Number(lockedRewardCoins).toFixed(2)} locked</span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRedeemWallet(!redeemWallet)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      redeemWallet ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                        redeemWallet ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                
                {redeemWallet && (
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <div>
                      <p>Coins to use: <span className="text-emerald-600">{walletUsedAmount} coins (₹{walletUsedAmount})</span></p>
                    </div>
                    <div>
                      <p>Remaining Wallet: <span className="text-slate-700">₹{Math.max(0, walletBalance - walletUsedAmount).toFixed(2)}</span></p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Refund Wallet — actual refunded money, separate from coins, no % limit */}
          {refundWalletBalance > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 text-[#02006c]">
                <Banknote className="w-4 h-4 text-sky-600" />
                <h2 className="text-xs font-black uppercase tracking-wide">Refund Wallet</h2>
              </div>
              <div className="bg-surface rounded-2xl p-4 shadow-3xs border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">Use Refund Wallet (up to 100% of the order)</span>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Balance: <span className="font-bold text-slate-700">₹{Number(refundWalletBalance).toFixed(2)}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRedeemRefundWallet(!redeemRefundWallet)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      redeemRefundWallet ? 'bg-sky-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                        redeemRefundWallet ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {redeemRefundWallet && (
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <div>
                      <p>Amount to use: <span className="text-sky-700">₹{refundWalletUsedAmount.toFixed(2)}</span></p>
                    </div>
                    <div>
                      <p>Remaining: <span className="text-slate-700">₹{Math.max(0, refundWalletBalance - refundWalletUsedAmount).toFixed(2)}</span></p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Method Selected Dropdown */}
          <div className="bg-surface rounded-2xl shadow-3xs border border-white/10 overflow-hidden">
            <button 
              type="button"
              onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
              className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-[#02006c]">
                <Banknote className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-wide">Select Payment Mode</span>
                <span className="text-[11px] font-bold text-slate-500 lowercase ml-1">
                  (Selected: {paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online'})
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isPaymentDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPaymentDropdownOpen && (
              <div className="p-4 border-t border-slate-100 bg-[#fafafa] flex flex-col gap-2.5 animate-fade-in">
                {/* Cash on Delivery option */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('COD');
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all bg-white ${
                    paymentMethod === 'COD'
                      ? 'border-[#0B132B] text-[#0B132B] font-black shadow-3xs'
                      : 'border-white/10 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="text-xs">Cash on Delivery</span>
                    {isCodChargeEnabled && (
                      <span className="text-[10px] text-slate-500 font-medium mt-0.5">₹{codChargeAmount} Additional handling fee applies</span>
                    )}
                  </div>
                  {paymentMethod === 'COD' && <span className="w-2 h-2 rounded-full bg-[#0B132B]" />}
                </button>

                {/* Online Payment option */}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('ONLINE');
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all bg-white ${
                    paymentMethod === 'ONLINE'
                      ? 'border-[#0B132B] text-[#0B132B] font-black shadow-3xs'
                      : 'border-white/10 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="text-xs">
                      Online 
                      {isPrepaidDiscountEnabled && (
                        <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black">RECOMMENDED</span>
                      )}
                    </span>
                    {isPrepaidDiscountEnabled && (
                      <span className="self-start mt-1 text-[10px] font-black uppercase tracking-wide text-white bg-emerald-600 px-2 py-0.5 rounded-md shadow-sm">₹{prepaidDiscountAmount} EXTRA OFF ON PREPAID ORDERS</span>
                    )}
                  </div>
                  {paymentMethod === 'ONLINE' && <span className="w-2 h-2 rounded-full bg-[#0B132B]" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order summary breakdown & place order button - Spans 4 cols */}
        <div className="md:col-span-4 bg-surface rounded-2xl border border-white/10 shadow-3xs p-6 space-y-6 md:sticky md:top-28">
          <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide border-b border-white/10 pb-3">
            Price Details
          </h3>

          <div className="space-y-3.5 text-xs text-slate-600 font-semibold">
            <div className="flex justify-between items-center">
              <span>Total MRP</span>
              <span className="text-slate-800">₹{Number(originalTotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Product Discount</span>
              <span className="text-emerald-600 font-medium">- ₹{Number(productDiscount).toFixed(2)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between items-center">
                <span>Coupon Discount ({appliedCoupon.code})</span>
                <span className="text-emerald-600 font-medium">- ₹{Number(discountAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Platform Fee</span>
              <span className="text-slate-800">₹{Number(platformCommission).toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                Shipping Fee
                <span className="text-[9.5px] text-slate-400">(Weight: {cart.reduce((total, item) => total + ((item.weight || 0.5) * item.quantity), 0)}kg)</span>
              </span>
              {isEstimatingDelivery ? (
                <span className="text-slate-400 font-medium">Calculating...</span>
              ) : deliveryError ? (
                <span className="text-red-600 font-bold">Unavailable</span>
              ) : (
                <span className={deliveryCharge > 0 ? "text-slate-800" : "text-emerald-600 font-bold"}>
                  {deliveryCharge > 0 ? `₹${Number(deliveryCharge).toFixed(2)}` : 'FREE'}
                </span>
              )}
            </div>
            {!isEstimatingDelivery && deliveryError && (
              <p className="text-[11px] text-red-600 font-semibold leading-snug">{deliveryError}</p>
            )}
            {codCharge > 0 && (
              <div className="flex justify-between items-center">
                <span>COD Charge</span>
                <span className="text-slate-800">₹{Number(codCharge).toFixed(2)}</span>
              </div>
            )}
            {prepaidDiscount > 0 && (
              <div className="flex justify-between items-center">
                <span>Prepaid Discount</span>
                <span className="text-emerald-600 font-medium">- ₹{Number(prepaidDiscount).toFixed(2)}</span>
              </div>
            )}
            
            <div className="border-t border-white/10 pt-3.5 flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Total Price</span>
              <span>₹{Number(grandTotalBeforeCoins).toFixed(2)}</span>
            </div>
            {redeemWallet && walletUsedAmount > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-emerald-600">
                <span>Coins (Main Wallet)</span>
                <span>- ₹{walletUsedAmount}</span>
              </div>
            )}
            {redeemRefundWallet && refundWalletUsedAmount > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-sky-700">
                <span>Refund Wallet</span>
                <span>- ₹{Number(refundWalletUsedAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-3.5 flex justify-between items-center text-base font-black text-[#02006c]">
              <span>Net Payable</span>
              <span>₹{Number.isInteger(grandTotal) ? grandTotal : Number(grandTotal).toFixed(2)}</span>
            </div>
            <p className="-mt-3 text-right text-[10px] font-semibold text-slate-500">Inclusive of all taxes (GST)</p>

            {/* Order Reward Coins Info Badge */}
            {walletPreview?.rewardCoinsEnabled && walletPreview.estimatedRewardCoins > 0 && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-amber-500/10 border border-amber-200/60 rounded-xl p-3 flex items-center gap-2.5 text-amber-900 shadow-3xs">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Coins className="w-4 h-4 text-amber-600 animate-pulse" />
                </div>
                <div className="text-[11px] leading-tight font-semibold">
                  <p className="font-black text-amber-800">Earn Reward Coins 🎉</p>
                  <p className="text-amber-700/90 text-[10px] mt-0.5 font-bold">
                    You will get <span className="text-amber-900 font-extrabold">{walletPreview.estimatedRewardCoins} Coins</span> when this order is delivered (usable after the return window).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Place order button */}
          <button 
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="hidden md:flex w-full bg-[#0B132B] hover:bg-gold text-white py-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-gold/20 transition-all cursor-pointer items-center justify-center gap-2 disabled:bg-surface"
          >
            <ShieldCheck className="w-4 h-4" /> Confirm & Place Order
          </button>

          <div className="text-[10px] text-slate-450 font-bold text-center leading-relaxed">
            Safe & secure transactions. 100% money back guarantee.
          </div>
        </div>
      </div>

      {/* Full-screen Loading Overlay for Order Placement */}
      {isPlacingOrder && (
        <div className="fixed inset-0 bg-surface/90 backdrop-blur-sm z-[200] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-t-[#0B132B] border-white/10 rounded-full animate-spin mb-4"></div>
          <h3 className="text-lg font-bold text-[#02006c] animate-pulse">Processing your order securely...</h3>
        </div>
      )}

      {/* Sticky Bottom Action Bar (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto z-40 bg-surface md:hidden">
        <div className="bg-surface p-3 border-t border-white/10 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] rounded-t-2xl relative">
          {/* Place Order Button */}
          <button 
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="w-full bg-[#0B132B] active:bg-[#e05b43] text-white py-3.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95"
          >
            Confirm & Place order ₹{Number(grandTotal).toFixed(2)}
          </button>
        </div>
      </div>


      {/* Address Selection Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col md:items-center md:justify-center justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in p-0 md:p-4">
          {/* Modal Content */}
          <div className="bg-surface rounded-t-2xl md:rounded-2xl max-h-[85vh] w-full md:max-w-md flex flex-col overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surface sticky top-0 z-10">
              <h2 className="text-base font-black text-[#02006c]">Select Delivery Address</h2>
              <button 
                onClick={() => {
                  setIsAddressModalOpen(false);
                  setIsAddingAddress(false);
                }}
                className="p-1.5 bg-surface rounded-full text-slate-500 hover:text-slate-800 transition-colors active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body / List */}
            <div className="overflow-y-auto p-4 flex flex-col gap-3 pb-safe">
              {!isAddingAddress ? (
                <>
                  {addressesList.map(addr => {
                    const idVal = addr._id || addr.id;
                    const isSelected = selectedAddressId === idVal;
                    return (
                      <div 
                        key={idVal}
                        onClick={() => {
                          setSelectedAddressId(idVal);
                          setIsAddressModalOpen(false);
                        }}
                        className={`border rounded-xl p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-[#0B132B] bg-gold/10' 
                            : 'border-white/10 hover:border-white/10 bg-surface'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5">
                            <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center ${
                              isSelected ? 'border-[#0B132B]' : 'border-white/10'
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-[#0B132B]" />}
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[13px] font-bold text-slate-800">{addr.name}</span>
                              <span className="bg-surface text-[9px] px-1.5 py-0.5 rounded text-slate-600 font-bold uppercase">{addr.type}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 leading-snug">{addr.address}</span>
                            <span className="text-[11px] font-bold text-slate-600 mt-1">Pincode: {addr.pincode}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {user && (
                    <button 
                      onClick={() => setIsAddingAddress(true)}
                      className="mt-2 w-full border border-dashed border-[#02006c] hover:bg-surface text-[#02006c] py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add New Address
                    </button>
                  )}
                </>
              ) : (
                <form onSubmit={handleAddAddress} className="flex flex-col gap-3.5 p-1 animate-fade-in">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Receiver Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Vini Sharma" 
                      value={newAddrName} 
                      onChange={(e) => setNewAddrName(e.target.value.replace(/\d/g, ''))}
                      className="mt-1 w-full border border-white/10 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-[#0B132B]"
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. 9876543210" 
                      value={newAddrPhone} 
                      onChange={(e) => setNewAddrPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="mt-1 w-full border border-white/10 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-[#0B132B]"
                      required 
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Address Type</label>
                    <div className="flex gap-2 mt-1">
                      {['Home', 'Work', 'Other'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewAddrType(t)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                            newAddrType === t 
                              ? 'border-[#0B132B] bg-gold/10 text-[#0B132B]' 
                              : 'border-white/10 text-slate-600 hover:bg-surface'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Detailed Address</label>
                    <textarea 
                      placeholder="e.g. Flat/House No, Building, Street, Area" 
                      value={newAddrText} 
                      onChange={(e) => setNewAddrText(e.target.value)}
                      className="mt-1 w-full border border-white/10 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-[#0B132B] min-h-[70px]"
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Pincode</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 452001" 
                      value={newAddrPincode} 
                      onChange={(e) => setNewAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-1 w-full border border-white/10 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-[#0B132B]"
                      required 
                    />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsAddingAddress(false)}
                      className="flex-1 py-3 bg-surface rounded-xl text-slate-600 text-xs font-bold hover:bg-surface transition-colors"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-[#0B132B] text-white text-xs font-black rounded-xl hover:bg-gold transition-colors shadow-sm"
                    >
                      Save Address
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fee Info Modal */}
      {feeInfoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in px-4">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#02006c] text-lg">
                {feeInfoModal === 'platform' ? 'Platform Fee' : 'Cash on Delivery Fee'}
              </h3>
              <button onClick={() => setFeeInfoModal(null)} className="p-1 rounded-full bg-surface hover:bg-surface">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              {feeInfoModal === 'platform' 
                ? 'This nominal fee helps us maintain the platform, ensure secure payments, and provide you with a seamless shopping experience.'
                // Online payment is switched off for now — restore " Pay online to avoid this fee!" when it's back.
                : 'A small fee charged by our delivery partners for handling cash.'
              }
            </p>
            <button onClick={() => setFeeInfoModal(null)} className="w-full bg-[#0B132B] text-white py-3 rounded-xl font-bold active:scale-95 transition-transform">
              Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
