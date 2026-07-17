import React, { useState, useEffect } from 'react';
import { ArrowLeft, Copy, CheckCircle2, Star, MapPin, Receipt, Download, ChevronDown, PenLine, X, Package, Image as ImageIcon, Video, RotateCcw, AlertCircle, Loader2, Check } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';
import OptimizedImage from '../components/ui/OptimizedImage';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function OrderDetailsPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { addStudioPost, user, getOrderReview, addOrderReview, orders, systemSettings } = useApp();

  const id = orderId || 'OD337252952617879100';
  const initialDraft = getOrderReview(id) || {};

  const [isEditingReview, setIsEditingReview] = useState(initialDraft.isEditingReview || false);
  const [reviewRating, setReviewRating] = useState(initialDraft.reviewRating || 0);
  const [reviewText, setReviewText] = useState(initialDraft.reviewText || '');
  const [reviewPhotos, setReviewPhotos] = useState(initialDraft.reviewPhotos || []);
  const [reviewVideo, setReviewVideo] = useState(initialDraft.reviewVideo || null);
  const [submittedReview, setSubmittedReview] = useState(initialDraft.submittedReview || null);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const [localOrder, setLocalOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  // Pull to refresh states
  const [startY, setStartY] = useState(0);
  const [pullOffset, setPullOffset] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOrderDetails = async (showLoader = true) => {
    const token = localStorage.getItem('userToken');
    if (!token) return;

    try {
      if (showLoader) setLoading(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setLocalOrder(data.order);
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const handleTouchStart = (e) => {
    if (window.scrollY === 0 && !isRefreshing) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff > 0) {
      // Add friction resistance
      const resistance = Math.min(diff * 0.4, 80);
      setPullOffset(resistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullOffset > 50) {
      setIsRefreshing(true);
      setPullOffset(50);

      await fetchOrderDetails(false);

      setTimeout(() => {
        setIsRefreshing(false);
        setPullOffset(0);
      }, 500);
    } else {
      setPullOffset(0);
    }
  };

  const [cancelling, setCancelling] = useState(false);

  const handleCancelOrder = async () => {
    const confirmCancel = window.confirm("Are you sure you want to cancel this order?");
    if (!confirmCancel) return;

    const token = localStorage.getItem('userToken');
    if (!token) return;

    try {
      setCancelling(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order cancelled successfully!');
        fetchOrderDetails(false);
      } else {
        toast.error(data.message || 'Failed to cancel order');
      }
    } catch (err) {
      toast.error('Could not cancel order');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    addOrderReview(id, {
      isEditingReview,
      reviewRating,
      reviewText,
      reviewPhotos,
      reviewVideo,
      submittedReview
    });
  }, [id, isEditingReview, reviewRating, reviewText, reviewPhotos, reviewVideo, submittedReview]);

  const handlePhotoUpload = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const invalidFile = filesArray.find(f => f.size > 10 * 1024 * 1024);
      if (invalidFile) {
        toast.info('Image size cannot exceed 10MB!');
        return;
      }
      const newPhotos = filesArray.map(f => URL.createObjectURL(f));
      setReviewPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleVideoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.info('Video size cannot exceed 10MB!');
        return;
      }
      setReviewVideo(URL.createObjectURL(file));
    }
  };
  const [isOffersExpanded, setIsOffersExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAddressExpanded, setIsAddressExpanded] = useState(false);

  const globalOrderFromContext = orders?.find(o => o.id === id);
  const orderData = localOrder || globalOrderFromContext;

  const globalOrder = orderData ? {
    id: orderData._id || orderData.id,
    date: orderData.createdAt ? new Date(orderData.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : orderData.date,
    items: orderData.items ? orderData.items.map(item => ({
      id: item.productId || item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image
    })) : [],
    total: orderData.total,
    status: orderData.status,
    paymentMethod: orderData.paymentMethod,
    paymentStatus: orderData.paymentStatus,
    deliveryAddress: orderData.deliveryAddress,
    deliveryCharge: orderData.deliveryCharge,
    etd: orderData.etd,
    walletUsed: orderData.walletUsed,
    coinsRedeemed: orderData.coinsRedeemed,
    couponCode: orderData.couponCode,
    createdAt: orderData.createdAt
  } : null;

  const isDelivered = globalOrder ? globalOrder.status === 'Delivered' : id !== 'ORD-8X92-K1';

  // Return request state
  const [showReturnSheet, setShowReturnSheet] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnReasonDetails, setReturnReasonDetails] = useState('');
  const [returnSelectedItems, setReturnSelectedItems] = useState([]);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [existingReturn, setExistingReturn] = useState(null);
  const [checkingReturn, setCheckingReturn] = useState(false);

  const RETURN_REASONS = ['Damaged Product', 'Wrong Item Sent', 'Defective Unit', 'Not As Described', 'Size/Fit Issue', 'Changed Mind', 'Other'];

  // Check if a return request already exists for this order
  useEffect(() => {
    const checkExistingReturn = async () => {
      if (!globalOrder || globalOrder.status !== 'Delivered' && globalOrder.status !== 'Return Requested') return;
      const token = localStorage.getItem('userToken');
      if (!token) return;
      try {
        setCheckingReturn(true);
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/returns/by-order/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success && data.returnRequest) {
          setExistingReturn(data.returnRequest);
        }
      } catch (err) {
        console.error('Check existing return error:', err);
      } finally {
        setCheckingReturn(false);
      }
    };
    checkExistingReturn();
  }, [id, globalOrder]);

  const handleReturnToggleItem = (item) => {
    setReturnSelectedItems(prev => {
      const exists = prev.find(i => (i.productId || i.id) === (item.productId || item.id));
      if (exists) return prev.filter(i => (i.productId || i.id) !== (item.productId || item.id));
      return [...prev, item];
    });
  };

  const handleSubmitReturn = async () => {
    if (returnSelectedItems.length === 0) { toast.info('Select at least one item to return'); return; }
    if (!returnReason) { toast.info('Select a reason for return'); return; }

    const token = localStorage.getItem('userToken');
    if (!token) { toast.error('Please login to continue'); return; }

    try {
      setSubmittingReturn(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          orderId: id,
          items: returnSelectedItems.map(item => ({
            productId: item.productId || item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image || ''
          })),
          reason: returnReason,
          reasonDetails: returnReasonDetails
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Return request submitted!');
        setExistingReturn(data.returnRequest);
        setShowReturnSheet(false);
        setReturnReason('');
        setReturnReasonDetails('');
        setReturnSelectedItems([]);
      } else {
        toast.error(data.message || 'Failed to submit return');
      }
    } catch (err) {
      toast.error('Could not submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const MOCK_ORDER_DETAILS = {
    'ORD-8X92-K1': {
       name: 'WALKAROO Men Casual',
       image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=200',
       price: 999,
       selling: 855
    },
    'ORD-3M44-P9': {
       name: 'SONATA NP7987YM06W Sonata Quartz Gold...',
       image: 'https://images.unsplash.com/photo-1524592094714-cb9c5d4d3bd1?auto=format&fit=crop&q=80&w=200',
       price: 2499,
       selling: 1999
    },
    'ORD-1K99-L2': {
       name: 'Lakmé Sunscreen - SPF 50 PA+++ Su...',
       image: 'https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&q=80&w=200',
       price: 350,
       selling: 299
    }
  };

  const orderItems = globalOrder ? globalOrder.items : [
    {
      id: 'mock-1',
      name: (MOCK_ORDER_DETAILS[id] || MOCK_ORDER_DETAILS['ORD-3M44-P9']).name,
      image: (MOCK_ORDER_DETAILS[id] || MOCK_ORDER_DETAILS['ORD-3M44-P9']).image,
      price: (MOCK_ORDER_DETAILS[id] || MOCK_ORDER_DETAILS['ORD-3M44-P9']).selling,
      quantity: 1
    }
  ];

  // Helper product details for reviews / first item reference
  const firstItem = orderItems[0];
  const product = {
    name: firstItem.name,
    image: firstItem.image,
    price: firstItem.price * 1.2, // mock original price
    selling: firstItem.price
  };

  const deliveryAddress = globalOrder?.deliveryAddress || {
    name: user?.name || "",
    type: "Home",
    address: "",
    pincode: "",
    phone: user?.phone || ""
  };

  const orderTotal = globalOrder ? globalOrder.total : (product.selling + 7 - 150);

  const subtotal = orderItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const platformCommission = systemSettings?.commission ?? 15;
  const gstPercentage = systemSettings?.gstPercentage ?? 18;
  const deliveryCharge = globalOrder?.deliveryCharge || 0;
  const coinsRedeemed = globalOrder?.coinsRedeemed || 0;
  const walletUsed = globalOrder?.walletUsed || 0;

  // Mathematically solve for coupon discount:
  // (subtotal - discountAmount) * (1 + gstPercentage/100) + platformCommission + deliveryCharge - coinsRedeemed - walletUsed = orderTotal
  // (subtotal - discountAmount) * (1 + gstPercentage/100) = orderTotal - platformCommission - deliveryCharge + coinsRedeemed + walletUsed
  // subtotal - discountAmount = (orderTotal - platformCommission - deliveryCharge + coinsRedeemed + walletUsed) / (1 + gstPercentage/100)
  // discountAmount = subtotal - (orderTotal - platformCommission - deliveryCharge + coinsRedeemed + walletUsed) / (1 + gstPercentage/100)
  let deducedDiscount = 0;
  let gstAmount = 0;

  const gstFactor = 1 + (gstPercentage / 100);

  if (globalOrder?.couponCode) {
    const targetValue = orderTotal - platformCommission - deliveryCharge + coinsRedeemed + walletUsed;
    const discountedSubtotal = targetValue / gstFactor;
    deducedDiscount = Math.max(0, Math.round(subtotal - discountedSubtotal));
    gstAmount = Math.round((subtotal - deducedDiscount) * (gstPercentage / 100));
  } else {
    deducedDiscount = 0;
    gstAmount = Math.round(subtotal * (gstPercentage / 100));
  }

  const returnWindowExpiry = globalOrder?.createdAt ? (() => {
    const expiry = new Date(globalOrder.createdAt);
    expiry.setDate(expiry.getDate() + 7);
    const now = new Date();
    const formattedDate = expiry.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      expired: now > expiry,
      dateText: formattedDate
    };
  })() : { expired: true, dateText: 'Apr 23' };

  const handleDownload = () => {
    setIsDownloading(true);
    
    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '700px'; // fixed width for clean rendering
    container.style.background = '#ffffff';
    container.style.padding = '40px';
    container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    container.style.color = '#1e293b';
    container.style.lineHeight = '1.5';
    
    const itemsRowsHtml = orderItems.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 13px;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 13px;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 13px;">₹${item.price}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 13px;">₹${item.price * item.quantity}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="border: 1px solid #e2e8f0; border-radius: 20px; padding: 40px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #02006c; padding-bottom: 24px; margin-bottom: 30px;">
          <div style="text-align: left;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #02006c; letter-spacing: 0.5px;">TAX INVOICE</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b; font-weight: 600;">Order ID: #${id?.slice(0, 5)}</p>
          </div>
          <div style="text-align: right;">
            <img src="/aramish-logo.png" style={{ maxHeight: '50px', width: 'auto', objectFit: 'contain' }} alt="Aramish Logo" />
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 35px;">
          <div style="flex: 1.5;">
            <div style="font-size: 13px; margin-bottom: 8px;">
              <span style="font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Invoice Date:</span>
              <span style="color: #1e293b; font-weight: 600; margin-left: 8px;">${globalOrder?.date || new Date().toLocaleDateString()}</span>
            </div>
            <div style="font-size: 13px; margin-bottom: 8px; margin-top: 15px;">
              <span style="display: block; font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; margin-bottom: 5px;">Shipping To:</span>
              <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 16px; display: inline-block; text-align: left; min-width: 250px;">
                <strong style="color: #02006c; font-size: 14px;">${deliveryAddress.name}</strong><br/>
                <span style="display: block; margin-top: 4px; color: #475569; font-weight: 500; line-height: 1.4;">
                  ${deliveryAddress.address}<br/>
                  Pincode: ${deliveryAddress.pincode}
                </span>
                <span style="display: block; margin-top: 6px; color: #64748b; font-size: 12px;">
                  Phone: ${deliveryAddress.phone || user?.phone || ''}
                </span>
              </div>
            </div>
          </div>
          
          <div style="flex: 1; text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
            <div style="font-size: 13px; margin-bottom: 8px;">
              <span style="display: block; font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; margin-bottom: 4px;">Payment Method:</span>
              <span style="font-size: 14px; font-weight: 900; color: #02006c;">${globalOrder?.paymentMethod || 'COD'}</span>
            </div>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr>
              <th style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px; text-align: left; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Item Description</th>
              <th style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px; text-align: center; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 60px;">Qty</th>
              <th style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px; text-align: right; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 100px;">Unit Price</th>
              <th style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px; text-align: right; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 100px;">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>
        
        <table style="width: 320px; margin-left: auto; margin-bottom: 30px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #475569;">Items Subtotal:</td>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #475569; text-align: right;">₹${subtotal}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #475569;">GST (${gstPercentage}%):</td>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #475569; text-align: right;">₹\${gstAmount}</td>
          </tr>
          ${deliveryCharge > 0 ? `
            <tr>
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #475569;">Delivery Charge:</td>
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #475569; text-align: right;">₹${Number(deliveryCharge).toFixed(2)}</td>
            </tr>
          ` : ''}
          ${deducedDiscount > 0 ? `
            <tr style="color: #16a34a;">
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600;">Discount / Coupon:</td>
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; text-align: right;">-₹${deducedDiscount}</td>
            </tr>
          ` : ''}
          ${coinsRedeemed > 0 ? `
            <tr style="color: #16a34a;">
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600;">Coins Redeemed:</td>
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; text-align: right;">-₹${coinsRedeemed}</td>
            </tr>
          ` : ''}
          ${walletUsed > 0 ? `
            <tr style="color: #16a34a;">
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600;">Wallet Used:</td>
              <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; text-align: right;">-₹${walletUsed}</td>
            </tr>
          ` : ''}
          <tr style="font-size: 16px; font-weight: 900; color: #02006c; background-color: #f8fafc; border-top: 2px solid #02006c;">
            <td style="padding: 12px; color: #02006c;">Total Paid:</td>
            <td style="padding: 12px; color: #02006c; text-align: right;">₹${orderTotal}</td>
          </tr>
        </table>
        
        <div style="text-align: center; margin-top: 60px; font-size: 11px; color: #94a3b8; font-weight: 600; border-top: 1px solid #e2e8f0; padding-top: 24px;">
          Thank you for shopping with Aramish!<br/>
          For support or other queries, write to support@aramish.com
        </div>
      </div>
    `;
    
    document.body.appendChild(container);

    // Wait for images/styles to be completely layouted
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(container, {
          scale: 2, // high resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        
        // Calculate page size to match layout aspect ratio
        const pdfWidth = canvas.width / 2;
        const pdfHeight = canvas.height / 2;
        
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [pdfWidth, pdfHeight]
        });
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Invoice_${id?.slice(0, 5)}.pdf`);
        toast.success('Invoice downloaded successfully!');
      } catch (err) {
        console.error('Error generating PDF:', err);
        toast.error('Failed to download invoice PDF. Please try again.');
      } finally {
        document.body.removeChild(container);
        setIsDownloading(false);
      }
    }, 600);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    toast.success('Order ID copied to clipboard!');
  };

  return (
    <div 
      className="bg-surface min-h-screen font-sans pb-24 select-none relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      {(pullOffset > 0 || isRefreshing) && (
        <div 
          className="fixed left-1/2 -translate-x-1/2 z-[100] bg-surface rounded-full p-2.5 shadow-md flex items-center justify-center transition-all duration-100 ease-out"
          style={{ 
            top: '55px', 
            transform: `translate(-50%, ${pullOffset}px)`,
            opacity: Math.min(pullOffset / 50, 1)
          }}
        >
          <Loader2 
            className={`w-5 h-5 text-[#0B132B] ${isRefreshing ? 'animate-spin' : ''}`}
            style={!isRefreshing ? { transform: `rotate(${pullOffset * 4}deg)` } : undefined}
          />
        </div>
      )}
      {/* Header (Mobile Only) */}
      <div className="bg-[#FFE4D6] px-4 py-3 sticky top-0 z-50 flex items-center justify-between shadow-sm md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-gold/10 rounded-full transition-colors cursor-pointer">
            <ArrowLeft className="w-6 h-6 text-[#02006c]" />
          </button>
          <h1 className="text-[18px] font-semibold tracking-wide text-[#02006c]">Order Details</h1>
        </div>
        <button 
          onClick={() => navigate('/support')}
          className="border border-[#02006c]/20 bg-surface/50 rounded-lg px-4 py-1.5 text-[14px] font-semibold text-[#02006c] hover:bg-surface transition-colors cursor-pointer"
        >
          Help & Support
        </button>
      </div>

      {/* Responsive layout wrapper */}
      <div className="max-w-6xl mx-auto w-full px-4 py-6 md:py-10 space-y-6">
        
        {/* Desktop title header */}
        <div className="hidden md:flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-[#02006c] uppercase tracking-wide">
              Order Details & Invoice
            </h2>
            <span className="text-xs text-slate-400 font-bold mt-1">Order ID: #{id?.slice(0, 5)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/support')}
              className="px-4 py-2 border border-[#02006c]/20 bg-surface text-[#02006c] rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer hover:bg-surface"
            >
              Help & Support
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-[#02006c] text-white rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer hover:bg-opacity-90"
            >
              Go Back
            </button>
          </div>
        </div>

        {/* Desktop 2-column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Items, Status & Review forms (Spans 7 cols on desktop) */}
          <div className="md:col-span-7 space-y-6">
            
            {/* Products List & Order ID */}
            <div className="bg-surface rounded-2xl p-5 border border-white/10 shadow-3xs space-y-4">
              <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide border-b border-white/10 pb-2">
                Purchased Items ({orderItems.reduce((acc, curr) => acc + curr.quantity, 0)})
              </h3>

              <div className="flex flex-col gap-3">
                {orderItems.map((item, idx) => (
                  <div key={item.id || idx} className="flex gap-4 items-center p-3 bg-surface rounded-xl border border-white/10">
                    <div className="w-14 h-14 bg-surface rounded-lg p-1.5 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-150 shadow-3xs relative">
                       <OptimizedImage src={item.image} alt={item.name} type="product" className="absolute inset-0 p-0.5 object-contain mix-blend-multiply" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm text-slate-800 line-clamp-1 font-bold">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                        Quantity: {item.quantity} • Price: ₹{item.price}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 justify-between pt-2">
                <div className="flex items-center gap-1">
                  <span>Order ID: {id?.slice(0, 5)}</span>
                  <Copy onClick={handleCopyId} className="w-3.5 h-3.5 text-[#0B132B] cursor-pointer hover:text-[#ff5c3f]" />
                </div>
              </div>
            </div>

            {/* Compact Delivered Status Card */}
            <div className="bg-surface rounded-2xl border border-white/10 shadow-3xs overflow-hidden">
              <div className="p-5 border-b border-slate-105 flex items-center justify-between">
                 <div>
                   <h2 className={`text-base font-black ${isDelivered ? 'text-green-700' : 'text-[#0B132B]'} mb-1`}>
                     {isDelivered ? `Delivered, ${globalOrder?.date || 'Apr 13'}` : (globalOrder?.etd ? `Estimated Delivery: ${globalOrder.etd}` : 'Processing Order')}
                   </h2>
                   {isDelivered ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-455">
                        <div className="w-3.5 h-3.5 border border-slate-400 rounded-full flex items-center justify-center text-[9px] font-bold">i</div>
                        {returnWindowExpiry.expired 
                          ? `Return window expired on ${returnWindowExpiry.dateText}` 
                          : `Return window active until ${returnWindowExpiry.dateText}`}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-455">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        {globalOrder?.status === 'Pending' ? 'Order is pending verification' :
                         globalOrder?.status === 'Processing' ? 'Item is being processed' :
                         globalOrder?.status === 'Shipped' ? 'Item has been shipped' :
                         globalOrder?.status === 'Out for Delivery' ? 'Item is out for delivery' :
                         globalOrder?.status === 'Cancelled' ? 'Order is cancelled' :
                         globalOrder?.status === 'Return Requested' ? 'Return requested' :
                         globalOrder?.status === 'Refunded' ? 'Refunded' :
                         globalOrder?.status === 'Partially Refunded' ? 'Partially refunded' :
                         'Processing Order'}
                      </div>
                    )}
                 </div>
                 <div className={`${isDelivered ? 'bg-green-600' : 'bg-[#0B132B]'} rounded-full w-8 h-8 flex items-center justify-center shadow-sm`}>
                   {isDelivered ? (
                     <CheckCircle2 className="w-4 h-4 text-white" />
                   ) : (
                     <Package className="w-4 h-4 text-white" />
                   )}
                 </div>
              </div>
              <button 
                onClick={() => navigate(`/track-order/${id}`)}
                className="w-full py-3.5 text-xs font-black text-[#0B132B] hover:bg-gold/10 active:bg-gold/10 transition-colors border-b border-white/10 uppercase tracking-wider"
              >
                {isDelivered ? 'See all updates' : 'Track your order'}
              </button>

              {/* Return Request Section */}
              {isDelivered && !existingReturn && !checkingReturn && (
                <button 
                  onClick={() => setShowReturnSheet(true)}
                  className="w-full py-3.5 text-xs font-black text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <RotateCcw className="w-4 h-4" />
                  Request Return / Refund
                </button>
              )}

              {existingReturn && (
                <div className="px-5 py-3.5 bg-amber-50/40 border-t border-amber-100 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      <span className="font-black text-amber-700">Return {existingReturn.status}</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                      existingReturn.status === 'Refunded' ? 'bg-green-50 text-green-600 border-green-100' :
                      existingReturn.status === 'Rejected' ? 'bg-red-50 text-red-650' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>{existingReturn.status}</span>
                  </div>
                  <p className="text-amber-600 font-bold mt-1.5">Refund: ₹{existingReturn.refundAmount?.toLocaleString()} • Reason: {existingReturn.reason}</p>
                </div>
              )}

              {globalOrder && ['Pending', 'Processing', 'Shipped'].includes(globalOrder.status) && (
                <button 
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="w-full py-3.5 text-xs font-black text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors flex items-center justify-center gap-2 border-t border-white/10 uppercase tracking-wider cursor-pointer"
                >
                  {cancelling ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</>
                  ) : (
                    'Cancel Order'
                  )}
                </button>
              )}
            </div>

            {/* Rate Experience section */}
            {isDelivered && (
              <div className="bg-surface rounded-2xl p-5 border border-white/10 shadow-3xs">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-white/10 pb-2 mb-4">
                  Rate your experience
                </h3>
                
                {isEditingReview ? (
                  <div className="bg-slate-55 rounded-xl p-4 border border-white/10 space-y-4">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">How would you rate this product?</p>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setReviewRating(star)} className="p-1 hover:scale-115 transition-transform cursor-pointer">
                            <Star className={`w-8 h-8 ${star <= reviewRating ? 'text-green-500 fill-green-500' : 'text-slate-200'} transition-colors`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Add a written review</p>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="What did you like or dislike?"
                        className="w-full bg-surface border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[#0B132B] focus:ring-1 focus:ring-[#0B132B] transition-all resize-none h-[80px]"
                      ></textarea>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Add Photos or Reel (Optional)</p>
                      {(reviewPhotos.length > 0 || reviewVideo) && (
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {reviewPhotos.map((p, i) => (
                            <div key={i} className="w-14 h-14 rounded-lg border border-white/10 overflow-hidden relative">
                              <OptimizedImage src={p} alt="" type="default" className="absolute inset-0" />
                              <button onClick={() => setReviewPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-surface rounded-full p-0.5 text-slate-555 shadow-sm"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          {reviewVideo && (
                            <div className="w-14 h-14 rounded-lg border border-white/10 overflow-hidden relative bg-black flex items-center justify-center">
                              <Video className="w-5 h-5 text-white/70 absolute z-10" />
                              <video src={reviewVideo} className="w-full h-full object-cover opacity-50 animate-fade-in" />
                              <button onClick={() => setReviewVideo(null)} className="absolute top-1 right-1 bg-surface rounded-full p-0.5 text-slate-555 shadow-sm z-20"><X className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex gap-3">
                        <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-white/10 bg-surface rounded-xl cursor-pointer hover:border-[#0B132B] hover:bg-gold/10 transition-colors">
                          <ImageIcon className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Add Photos</span>
                          <input type="file" accept="image/jpeg, image/png, image/webp" multiple className="hidden" onChange={handlePhotoUpload} />
                        </label>
                        <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-white/10 bg-surface rounded-xl cursor-pointer hover:border-[#0B132B] hover:bg-gold/10 transition-colors">
                          <Video className="w-5 h-5 text-slate-400 mb-1" />
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Add Reel</span>
                          <input type="file" accept="video/mp4, video/webm" className="hidden" onChange={handleVideoUpload} />
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {submittedReview && (
                        <button 
                          onClick={() => setIsEditingReview(false)}
                          className="flex-1 bg-surface hover:bg-surface text-slate-800 font-bold py-3 rounded-xl transition-colors shadow-3xs cursor-pointer text-xs uppercase tracking-wider"
                        >
                          Cancel
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setSubmittedReview({ rating: reviewRating, text: reviewText, photos: reviewPhotos, video: reviewVideo });
                          setIsEditingReview(false);
                          
                          if (reviewVideo || reviewPhotos.length > 0) {
                            addStudioPost({
                              id: Date.now(),
                              username: user ? user.name.toLowerCase().replace(' ', '_') : 'guest_user',
                              desc: reviewText || "Check out my new purchase! ✨",
                              likes: 0,
                              comments: 0,
                              views: "0",
                              isLiked: false,
                              product: product,
                              videoUrl: reviewVideo,
                              imageUrl: reviewPhotos.length > 0 ? reviewPhotos[0] : null
                            });
                          }
                          
                          alert("Review submitted successfully!");
                        }}
                        className="flex-1 bg-[#0B132B] hover:bg-gold text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-gold/10 cursor-pointer text-xs uppercase tracking-wider"
                      >
                        Submit Review
                      </button>
                    </div>
                  </div>
                ) : submittedReview ? (
                  <div className="bg-surface rounded-xl p-4 border border-white/10 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className={`w-4 h-4 ${star <= submittedReview.rating ? 'text-green-600 fill-green-600' : 'text-slate-200 fill-slate-200'}`} />
                        ))}
                      </div>
                      <button onClick={() => setIsEditingReview(true)} className="text-xs font-bold text-[#0B132B] hover:underline flex items-center gap-1 cursor-pointer">
                        <PenLine className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>
                    {submittedReview.text && (
                      <p className="text-xs text-slate-650 leading-relaxed font-semibold">{submittedReview.text}</p>
                    )}
                    {(submittedReview.photos.length > 0 || submittedReview.video) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {submittedReview.photos.map((p, i) => (
                          <div key={i} onClick={() => setSelectedMedia({ type: 'image', url: p })} className="w-12 h-12 rounded-lg border border-slate-150 overflow-hidden bg-surface cursor-pointer hover:opacity-85 transition-opacity relative">
                            <OptimizedImage src={p} alt="" type="default" className="absolute inset-0" />
                          </div>
                        ))}
                        {submittedReview.video && (
                          <div onClick={() => setSelectedMedia({ type: 'video', url: submittedReview.video })} className="w-12 h-12 rounded-lg border border-slate-150 overflow-hidden bg-black relative flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity">
                            <Video className="w-4 h-4 text-white/80 absolute z-10" />
                            <video src={submittedReview.video} className="w-full h-full object-cover opacity-60" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-surface rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-650">
                       <Receipt className="w-4 h-4 text-slate-400" />
                       Share your thoughts about this product
                    </div>
                    <button 
                      onClick={() => setIsEditingReview(true)}
                      className="border border-[#0B132B] text-[#0B132B] bg-surface px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-gold/10 transition-all cursor-pointer uppercase tracking-wider"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      Write review
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Delivery address & Price details invoice (Spans 5 cols on desktop) */}
          <div className="md:col-span-5 space-y-6">
            
            {/* Delivery details card */}
            <div className="bg-surface rounded-2xl p-5 border border-white/10 shadow-3xs space-y-3">
              <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide border-b border-white/10 pb-2">
                Delivery Details
              </h3>
              
              <div className="bg-slate-55 rounded-xl p-4 space-y-3 text-xs">
                 <div 
                   className="flex gap-2.5 cursor-pointer group"
                   onClick={() => setIsAddressExpanded(!isAddressExpanded)}
                 >
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 group-hover:text-slate-650 transition-colors" />
                    <p className={`text-slate-650 leading-relaxed font-semibold transition-all ${isAddressExpanded ? '' : 'line-clamp-2'}`}>
                      <span className="font-black text-[#02006c] mr-1 uppercase">{deliveryAddress.type}</span>
                      {deliveryAddress.address}, {deliveryAddress.pincode}
                    </p>
                 </div>
                 <div className="flex gap-2.5 items-center pt-2 border-t border-slate-150/40">
                    <div className="w-4 h-4 flex items-center justify-center text-slate-400">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <p className="font-bold text-slate-800">
                      {deliveryAddress.name} <span className="font-semibold text-slate-450 ml-1">{deliveryAddress.phone || user?.phone || '9302841832'}</span>
                    </p>
                 </div>
              </div>
            </div>

            {/* Price details card */}
            <div className="bg-surface rounded-2xl p-5 border border-white/10 shadow-3xs">
              <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide border-b border-white/10 pb-2 mb-4">
                Price Breakdown
              </h3>

              <div className="space-y-3.5 text-xs">
                 <div className="flex justify-between items-center text-slate-600 font-semibold">
                   <span>Listing price</span>
                   <span>₹{orderItems.reduce((acc, curr) => acc + (curr.price * 1.2 * curr.quantity), 0).toFixed(0)}</span>
                 </div>
                 <div className="flex justify-between items-center text-slate-600 font-semibold">
                   <span className="flex items-center gap-1">Selling price <div className="w-3.5 h-3.5 border border-slate-350 rounded-full flex items-center justify-center text-[8px] font-bold">i</div></span>
                   <span>₹{subtotal}</span>
                 </div>
                 <div className="flex justify-between items-center text-slate-600 font-semibold">
                   <span>GST ({gstPercentage}%)</span>
                   <span>₹{gstAmount}</span>
                 </div>
                 <div className="flex justify-between items-center text-slate-600 font-semibold">
                   <span className="flex items-center gap-1">Total fees <ChevronDown className="w-3.5 h-3.5 text-slate-400" /></span>
                   <span>₹{platformCommission}</span>
                 </div>
                 <div className="flex justify-between items-center text-slate-600 font-semibold">
                   <span>Delivery Charges</span>
                   <span className={deliveryCharge ? "font-bold text-slate-800" : "text-green-600 font-black"}>
                     {deliveryCharge ? `₹${Number(deliveryCharge).toFixed(2)}` : 'FREE'}
                   </span>
                 </div>
                 
                 <div className="border-t border-dashed border-white/10 pt-3 flex justify-between items-center text-xs font-semibold text-slate-600">
                   <span>Items Total</span>
                   <span>₹{subtotal}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                   <span>Delivery Charge</span>
                   {deliveryCharge > 0 ? (
                     <span>₹{Number(deliveryCharge).toFixed(2)}</span>
                   ) : (
                     <span className="font-bold text-green-600">FREE</span>
                   )}
                 </div>

                 {deducedDiscount > 0 && (
                   <div className="flex justify-between items-center text-xs font-semibold text-green-600">
                     <span>Discount / Coupon {globalOrder?.couponCode ? `(${globalOrder.couponCode})` : ''}</span>
                     <span>-₹{deducedDiscount}</span>
                   </div>
                 )}

                 {coinsRedeemed > 0 && (
                   <div className="flex justify-between items-center text-xs font-semibold text-green-600">
                     <span>Coins Redeemed</span>
                     <span>-₹{coinsRedeemed}</span>
                   </div>
                 )}

                 {walletUsed > 0 && (
                   <div className="flex justify-between items-center text-xs font-semibold text-green-600">
                     <span>Wallet Used</span>
                     <span>-₹{walletUsed}</span>
                   </div>
                 )}

                 <div className="border-t border-white/10 my-2"></div>
                 
                 <div className="flex justify-between items-center text-sm font-black text-[#02006c] uppercase">
                   <span>Total Paid</span>
                   <span>₹{orderTotal}</span>
                 </div>

                 <div className="bg-surface rounded-xl p-3 flex justify-between items-center text-xs mt-3 border border-white/10">
                   <span className="text-slate-500 font-semibold">Paid Method</span>
                   <div className="flex items-center gap-1.5 font-bold text-slate-700">
                     <span className="border border-slate-350 rounded px-1 text-[9px] font-black uppercase tracking-wider">{globalOrder?.paymentMethod || 'COD'}</span>
                     {globalOrder?.paymentMethod || 'Cash on Delivery'}
                   </div>
                 </div>

                 <button 
                   onClick={handleDownload}
                   disabled={isDownloading}
                   className="w-full mt-4 flex items-center justify-center gap-2 border border-white/10 rounded-xl py-3 text-xs font-black text-slate-705 hover:bg-surface transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-3xs cursor-pointer uppercase tracking-wider"
                 >
                   <Download className="w-4 h-4" /> 
                   {isDownloading ? 'Downloading...' : 'Download Invoice'}
                 </button>
              </div>
            </div>

            {/* Shop more from Aramish button (Only visible on desktop) */}
            <button 
              onClick={() => navigate('/')}
              className="hidden md:block w-full border border-[#0B132B] text-[#0B132B] font-black text-xs py-3.5 rounded-xl hover:bg-gold/10 transition-all uppercase tracking-wider text-center cursor-pointer shadow-3xs"
            >
              Shop more from Aramish
            </button>

          </div>

        </div>

      </div>

      {/* Bottom Bar (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-2 bg-surface border-t border-white/10 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50 md:hidden">
         <button 
           onClick={() => navigate('/')}
           className="w-full border border-[#0B132B] text-[#0B132B] font-bold text-[13px] py-2.5 rounded-lg hover:bg-[#0B132B]/5 active:bg-[#0B132B]/10 transition-colors cursor-pointer"
         >
           Shop more from Aramish
         </button>
      </div>

      {/* Return Request Bottom Sheet Modal */}
      {showReturnSheet && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" 
          onClick={() => setShowReturnSheet(false)}
        >
          <div 
            className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-6 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar (Mobile Only) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-surface rounded-full"></div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h2 className="text-base font-black text-[#02006c] uppercase tracking-wide">Request Return</h2>
                <button onClick={() => setShowReturnSheet(false)} className="p-1 hover:bg-surface rounded-full transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Select items */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select items to return</p>
                <div className="space-y-2">
                  {orderItems.map((item, idx) => {
                    const isSelected = returnSelectedItems.find(i => (i.productId || i.id) === (item.productId || item.id));
                    return (
                      <div 
                        key={idx}
                        onClick={() => handleReturnToggleItem(item)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected ? 'border-[#0B132B] bg-gold/10' : 'border-white/10 bg-surface hover:bg-slate-105'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? 'border-[#0B132B] bg-[#0B132B]' : 'border-white/10'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {item.image && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-surface">
                            <OptimizedImage src={item.image} alt={item.name} type="product" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                          <p className="text-[10px] font-semibold text-slate-555 font-sans">Qty: {item.quantity} • ₹{item.price}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Select reason */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reason for return</p>
                <div className="grid grid-cols-2 gap-2">
                  {RETURN_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReturnReason(reason)}
                      className={`px-3 py-2.5 rounded-xl text-[11px] font-bold text-left transition-all border ${
                        returnReason === reason 
                          ? 'border-[#0B132B] bg-gold/10 text-[#0B132B]' 
                          : 'border-white/10 bg-surface text-slate-600 hover:bg-surface'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional details */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Additional details (optional)</p>
                <textarea
                  value={returnReasonDetails}
                  onChange={(e) => setReturnReasonDetails(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  className="w-full bg-surface border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[#0B132B] focus:ring-1 focus:ring-[#0B132B] transition-all resize-none h-[80px]"
                />
              </div>

              {/* Refund summary */}
              {returnSelectedItems.length > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-green-700">Estimated Refund</span>
                    <span className="text-sm font-black text-green-700">₹{returnSelectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-green-600 mt-1 font-semibold">Refund will be credited back to your wallet</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmitReturn}
                disabled={submittingReturn || returnSelectedItems.length === 0 || !returnReason}
                className="w-full bg-[#0B132B] text-white font-bold text-xs py-3.5 rounded-xl hover:bg-[#ff5c3f] active:bg-[#d43d1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
              >
                {submittingReturn ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                ) : (
                  <><RotateCcw className="w-4 h-4" /> Submit Return Request</>
                )}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Media Lightbox Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4">
          <button 
            onClick={() => setSelectedMedia(null)}
            className="absolute top-4 right-4 p-2 bg-surface/10 hover:bg-surface/20 rounded-full text-white transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="max-w-full max-h-full flex items-center justify-center">
            {selectedMedia.type === 'image' ? (
              <OptimizedImage src={selectedMedia.url} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-fade-in" alt="Review Media" type="default" />
            ) : (
              <video src={selectedMedia.url} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
