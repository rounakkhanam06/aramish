import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Package, Truck, Home, MapPin, Loader2, AlertCircle } from 'lucide-react';
import toast from '../utils/toast';

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exchange, setExchange] = useState(null);
  const [returnRequest, setReturnRequest] = useState(null);

  const [liveTracking, setLiveTracking] = useState(null);

  useEffect(() => {
    const fetchOrderAndTracking = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('userToken');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${apiBase}/orders/track/${orderId}`, { headers });
        const data = await res.json();
        if (res.ok && data.success) {
          setOrder(data.order);
          
          // Fetch Live Tracking from Shiprocket if AWB exists
          if (data.order.awbCode) {
            try {
              const srRes = await fetch(`${apiBase}/api/shiprocket/track/${data.order.awbCode}`);
              const srData = await srRes.json();
              if (srRes.ok && srData.success) {
                // Shiprocket tracking response structure varies, usually in tracking_data.shipment_track
                const trackingData = srData.tracking?.tracking_data?.shipment_track || [];
                const trackingActivities = srData.tracking?.tracking_data?.shipment_track_activities || [];
                setLiveTracking({ track: trackingData[0], activities: trackingActivities });
              }
            } catch (e) {
              console.error('Error fetching live tracking:', e);
            }
          }
          
        } else {
          toast.error('Could not fetch order details');
        }

        // Fetch Return details if exists
        try {
          const retRes = await fetch(`${apiBase}/returns/by-order/${orderId}`, { headers });
          const retData = await retRes.json();
          if (retRes.ok && retData.success && retData.returnRequest) {
            setReturnRequest(retData.returnRequest);
          }
        } catch (e) {
          console.error('Error fetching return details:', e);
        }

        // Fetch Exchange details if exists
        try {
          const exRes = await fetch(`${apiBase}/exchanges/by-order/${orderId}`, { headers });
          const exData = await exRes.json();
          if (exRes.ok && exData.success && exData.exchangeRequest) {
            setExchange(exData.exchangeRequest);
          }
        } catch (e) {
          console.error('Error fetching exchange details:', e);
        }
      } catch (error) {
        toast.error('Error fetching tracking info');
      } finally {
        setLoading(false);
      }
    };
    if (orderId) fetchOrderAndTracking();
  }, [orderId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#02006c]" size={32} /></div>;
  }

  if (!order) {
    return <div className="min-h-screen flex flex-col gap-2 items-center justify-center font-bold text-slate-500">
      <AlertCircle size={40} className="text-slate-300" />
      <p>Order not found</p>
      <button onClick={() => navigate(-1)} className="text-[#02006c] underline mt-2 text-sm">Go Back</button>
    </div>;
  }

  const isDelivered = ['Delivered', 'Return Requested', 'Refunded', 'Partially Refunded'].includes(order.status);
  const isCancelled = order.status === 'Cancelled' && !returnRequest;
  const trackingHistory = order.trackingHistory || [];

  // Helper to find step completion & date inside exchange timeline
  const getExchangeStepInfo = (stepStatuses) => {
    if (!exchange) return { completed: false, dateText: 'Pending' };
    const entry = exchange.timeline?.find(e => stepStatuses.includes(e.status));
    if (!entry) return { completed: false, dateText: 'Pending' };

    const date = new Date(entry.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateText = '';
    if (date.toDateString() === today.toDateString()) {
      dateText = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateText = 'Yesterday';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateText = 'Tomorrow';
    } else {
      dateText = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    return { completed: true, dateText };
  };

  const getExchangeActiveStepIndex = () => {
    if (!exchange) return -1;
    const s = exchange.status;
    if (s === 'Requested') return 0;
    if (s === 'Approved') return 1;
    if (['Pickup Scheduled', 'Old Item Picked Up'].includes(s)) return 2;
    if (s === 'Replacement Dispatched') return 3;
    if (s === 'Completed') return 4;
    return -1;
  };

  const getExchangeHeaderTitle = () => {
    if (!exchange) return '';
    const s = exchange.status;
    if (s === 'Failed') return 'Exchange delayed';
    if (s === 'Manual Review') return "We're checking your exchange";
    if (s === 'Completed') return 'Exchange completed';
    if (s === 'Rejected') return 'Exchange rejected';
    if (s === 'Cancelled') return 'Exchange cancelled';
    return 'Exchange in progress';
  };

  const getExchangeHeaderSubtitle = () => {
    if (!exchange) return '';
    const s = exchange.status;
    if (s === 'Failed') return 'There was an issue processing your replacement. We are resolving it.';
    if (s === 'Manual Review') return 'Our support team is reviewing your request.';
    if (s === 'Rejected') return exchange.rejectionReason || 'Your request was rejected.';
    return 'Track your replacement request';
  };

  const getExchangeHeaderBadgeClass = () => {
    if (!exchange) return '';
    const s = exchange.status;
    if (s === 'Failed' || s === 'Rejected') return 'bg-red-50 text-red-650 border-red-100';
    if (s === 'Manual Review') return 'bg-amber-50 text-amber-650 border-amber-100';
    if (s === 'Completed') return 'bg-green-50 text-green-650 border-green-100';
    return 'bg-blue-50 text-blue-650 border-blue-100';
  };

  const getExchangeHeaderBadgeText = () => {
    if (!exchange) return '';
    const s = exchange.status;
    if (s === 'Failed') return 'Delayed';
    if (s === 'Manual Review') return 'Checking';
    if (s === 'Completed') return 'Completed';
    if (s === 'Rejected') return 'Rejected';
    if (s === 'Cancelled') return 'Cancelled';
    return 'In progress';
  };

  // Dynamic tracking steps
  let steps = [];
  
  if (exchange) {
    const activeIndex = getExchangeActiveStepIndex();
    const exchangeStepsConfig = [
      {
        title: 'Exchange requested',
        desc: 'We have received your exchange request.',
        statuses: ['Requested'],
        icon: CheckCircle2
      },
      {
        title: 'Exchange approved',
        desc: 'Your replacement request has been approved and stock has been reserved.',
        statuses: ['Approved'],
        icon: Package
      },
      {
        title: 'Pickup scheduled',
        desc: 'Our courier partner will collect your old item.',
        statuses: ['Pickup Scheduled', 'Old Item Picked Up'],
        icon: MapPin
      },
      {
        title: 'Replacement on the way',
        desc: 'Your replacement item has been dispatched.',
        statuses: ['Replacement Dispatched'],
        icon: Truck
      },
      {
        title: 'Exchange completed',
        desc: 'You received the replacement item successfully.',
        statuses: ['Completed'],
        icon: Home
      }
    ];

    steps = exchangeStepsConfig.map((step, idx) => {
      const info = getExchangeStepInfo(step.statuses);
      const isActive = idx === activeIndex;
      const isCompleted = idx < activeIndex || info.completed;
      return {
        id: `exchange_${idx}`,
        title: step.title,
        desc: step.desc,
        date: info.dateText,
        icon: step.icon,
        status: isCompleted ? 'completed' : (isActive ? 'active' : 'pending')
      };
    });
  } else if (isCancelled) {
    steps = [
      { id: 'placed', title: 'Order Placed', desc: 'We have received your order', date: new Date(order.createdAt).toLocaleString(), icon: CheckCircle2, status: 'completed' },
      { id: 'cancelled', title: 'Order Cancelled', desc: 'Your order has been cancelled', date: order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '', icon: AlertCircle, status: 'active' }
    ];
  } else if (liveTracking && liveTracking.activities && liveTracking.activities.length > 0) {
    // Merge live tracking data
    steps = [
      { id: 'placed', title: 'Order Placed', desc: 'We have received your order', date: new Date(order.createdAt).toLocaleString(), icon: CheckCircle2, status: 'completed' },
      ...liveTracking.activities.map((history, idx) => ({
        id: `live_${idx}`,
        title: history.activity,
        desc: history.location || 'Update from courier',
        date: new Date(history.date).toLocaleString(),
        icon: history.activity.toUpperCase().includes('DELIVERED') ? Home : (history.activity.toUpperCase().includes('OUT FOR DELIVERY') ? MapPin : Truck),
        status: 'completed'
      }))
    ];
  } else if (trackingHistory.length > 0 && !returnRequest && !['Return Requested', 'Refunded', 'Partially Refunded'].includes(order.status)) {
    steps = [
      { id: 'placed', title: 'Order Placed', desc: 'We have received your order', date: new Date(order.createdAt).toLocaleString(), icon: CheckCircle2, status: 'completed' },
      ...trackingHistory.map((history, idx) => ({
        id: `hist_${idx}`,
        title: history.status,
        desc: history.activity || history.location || 'Update from courier',
        date: new Date(history.timestamp).toLocaleString(),
        icon: history.status.includes('DELIVERED') ? Home : (history.status.includes('OUT FOR DELIVERY') ? MapPin : Truck),
        status: 'completed'
      }))
    ];
  } else {
    steps = [
      { id: 1, title: 'Order Placed', desc: 'We have received your order', date: new Date(order.createdAt).toLocaleString(), icon: CheckCircle2, status: 'completed' },
      { id: 2, title: 'Order Processed', desc: 'Your order is being prepared', date: '', icon: Package, status: order.status !== 'Pending' ? 'completed' : 'pending' },
      { id: 3, title: 'Shipped', desc: 'Your item has been shipped', date: '', icon: Truck, status: (isDelivered || ['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status)) ? 'completed' : (order.status === 'Processing' ? 'active' : 'pending') },
      { id: 4, title: 'Out for Delivery', desc: 'Delivery partner is on the way', date: '', icon: MapPin, status: isDelivered ? 'completed' : (order.status === 'Out for Delivery' ? 'active' : 'pending') },
      { id: 5, title: 'Delivered', desc: 'Package arrived', date: '', icon: Home, status: isDelivered ? 'completed' : 'pending' },
    ];

    if (returnRequest || ['Return Requested', 'Refunded', 'Partially Refunded'].includes(order.status)) {
      const rStatus = returnRequest?.status || order.status;
      const isReqCompleted = true;
      const isAppCompleted = ['Approved', 'Pick-up Scheduled', 'Received', 'Refunded'].includes(rStatus);
      const isPickupCompleted = ['Pick-up Scheduled', 'Received', 'Refunded'].includes(rStatus);
      const isRefundCompleted = rStatus === 'Refunded';

      steps.push(
        { 
          id: 6, 
          title: 'Return Requested', 
          desc: returnRequest?.reason ? `Reason: ${returnRequest.reason}` : 'Return request submitted', 
          date: returnRequest?.createdAt ? new Date(returnRequest.createdAt).toLocaleString() : '', 
          icon: CheckCircle2, 
          status: isAppCompleted ? 'completed' : 'active' 
        },
        { 
          id: 7, 
          title: 'Return Approved', 
          desc: 'Your return request was reviewed and approved.', 
          date: '', 
          icon: Package, 
          status: isPickupCompleted ? 'completed' : (isAppCompleted ? 'active' : 'pending') 
        },
        { 
          id: 8, 
          title: 'Pickup Scheduled / Collected', 
          desc: returnRequest?.courierName ? `Courier: ${returnRequest.courierName}` : 'Item pickup by courier partner', 
          date: '', 
          icon: Truck, 
          status: isRefundCompleted ? 'completed' : (isPickupCompleted ? 'active' : 'pending') 
        },
        { 
          id: 9, 
          title: 'Refund Processed', 
          desc: returnRequest?.refundMethod === 'Bank' ? 'Refund transferred to Bank/UPI' : 'Refund credited to Aramish Wallet', 
          date: '', 
          icon: CheckCircle2, 
          status: isRefundCompleted ? 'completed' : 'pending' 
        }
      );
    }
  }

  // Estimated delivery based on order ETD, live tracking, or fallback
  let estDeliveryDate = new Date(order.createdAt);
  estDeliveryDate.setDate(estDeliveryDate.getDate() + 4); // basic 4 days fallback
  
  if (order.etd) {
    estDeliveryDate = new Date(order.etd);
  }

  if (liveTracking?.track?.expected_date) {
    estDeliveryDate = new Date(liveTracking.track.expected_date);
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans pb-20 select-none">
      {/* Header (Mobile Only) */}
      <div className="bg-[#fff4f2] px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center gap-3 md:hidden">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 text-[#02006c]" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-[17px] font-bold text-[#02006c] leading-tight">Track Order</h1>
          <span className="text-[11px] font-bold text-slate-500 tracking-wider">#{orderId ? orderId.slice(0, 5) : '12345'}</span>
        </div>
      </div>
      
      {/* Centered tracking block on desktop */}
      <div className="max-w-xl mx-auto w-full px-4 py-6 md:py-10 space-y-6">
        
        <div className="hidden md:flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-[#02006c] uppercase tracking-wide">
              Live Order Tracker
            </h2>
            <span className="text-xs text-slate-400 font-bold mt-1">Order ID: #{orderId?.slice(0, 5)}</span>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="px-3.5 py-1.5 bg-surface hover:bg-slate-55 border border-white/10 rounded-lg text-slate-600 text-xs font-bold transition-all shadow-3xs cursor-pointer"
          >
            Go Back
          </button>
        </div>

        {/* Estimated Delivery & Courier Card */}
        <div className="bg-surface rounded-2xl p-5 shadow-3xs border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                {exchange ? 'Exchange Status' : (returnRequest || ['Return Requested', 'Refunded', 'Partially Refunded'].includes(order.status) ? 'Return Status' : (isCancelled ? 'Order Status' : 'Estimated Delivery'))}
              </p>
              <p className={`text-base md:text-lg font-black ${exchange ? (exchange.status === 'Failed' || exchange.status === 'Rejected' ? 'text-red-650' : 'text-[#02006c]') : (isCancelled ? 'text-red-600' : 'text-[#02006c]')}`}>
                {exchange ? getExchangeHeaderTitle() : (
                  returnRequest || ['Return Requested', 'Refunded', 'Partially Refunded'].includes(order.status)
                    ? (order.status === 'Refunded' ? 'Refund Processed' : 'Return in Progress')
                    : (isCancelled ? 'Cancelled' : estDeliveryDate.toDateString())
                )}
              </p>
              {exchange && (
                <p className="text-[11px] text-slate-450 font-semibold mt-1">
                  {getExchangeHeaderSubtitle()}
                </p>
              )}
            </div>
            <div className={`w-10 h-10 ${isCancelled || (exchange && ['Failed', 'Rejected'].includes(exchange.status)) ? 'bg-red-50' : 'bg-[#0B132B]/10'} rounded-full flex items-center justify-center`}>
              {isCancelled || (exchange && ['Failed', 'Rejected'].includes(exchange.status)) ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <Truck className="w-5 h-5 text-[#0B132B]" />
              )}
            </div>
          </div>
          
          {exchange ? (
            <div className="pt-3.5 border-t border-white/10 flex flex-col gap-2">
              <p className="text-xs font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-xl inline-block border border-white/10 self-start">
                Exchange Swap: {exchange.originalItem?.size}/{exchange.originalItem?.color} → <span className="text-blue-600 font-extrabold">{exchange.requestedVariant?.size}/{exchange.requestedVariant?.color}</span>
              </p>
              
              {/* Show AWB code if exists */}
              {(exchange.reverse?.awb || exchange.forward?.awb) && (
                <div className="flex justify-between items-center text-xs mt-1 border-t border-slate-100 pt-2">
                  {exchange.reverse?.awb && !['Old Item Picked Up', 'Replacement Dispatched', 'Completed'].includes(exchange.status) ? (
                    <>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pickup Partner</p>
                        <p className="text-xs font-black text-slate-755">Shiprocket Partner</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AWB (Pickup)</p>
                        <a href={exchange.reverse.trackingUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 underline">{exchange.reverse.awb}</a>
                      </div>
                    </>
                  ) : exchange.forward?.awb ? (
                    <>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Delivery Partner</p>
                        <p className="text-xs font-black text-slate-755">Shiprocket Partner</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AWB (Delivery)</p>
                        <a href={exchange.forward.trackingUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 underline">{exchange.forward.awb}</a>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            order.awbCode && (
              <div className="pt-3.5 border-t border-white/10 flex justify-between items-center text-xs">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Courier Partner</p>
                  <p className="text-xs font-black text-slate-750">{order.courierName || 'Shiprocket Partner'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AWB Number</p>
                  <p className="text-xs font-black text-blue-600">{order.awbCode}</p>
                </div>
              </div>
            )
          )}
        </div>
 
        {/* Tracking Timeline */}
        <div className="bg-surface rounded-2xl p-5 shadow-3xs border border-white/10">
          <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide mb-4">
            {exchange ? 'Exchange Timeline' : 'Order Status'}
          </h3>
          
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-5 top-4 bottom-6 w-0.5 bg-slate-100"></div>
 
            <div className="space-y-5 relative z-10">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = step.status === 'completed';
                const isActive = step.status === 'active';
                const isPending = step.status === 'pending';
                
                return (
                  <div key={step.id || idx} className="flex gap-4">
                    {/* Status Icon */}
                    <div className="relative">
                      {isActive && (
                        <div className="absolute -inset-1 rounded-full bg-[#0B132B]/10 animate-ping"></div>
                      )}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-[3px] border-white relative z-10 shadow-sm ${
                        isCompleted ? 'bg-[#02006c] text-white' : 
                        isActive ? 'bg-[#0B132B] text-white shadow-md shadow-[#0B132B]/30' : 
                        'bg-surface text-slate-400 border border-slate-200'
                      }`}>
                        {isActive && exchange && step.status !== 'completed' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                    
                    {/* Details */}
                    <div className="pt-1.5 flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-xs md:text-sm font-black leading-tight ${
                          isActive ? 'text-[#0B132B]' : (isCompleted ? 'text-slate-800' : 'text-slate-400')
                        }`}>
                          {step.title}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                          {step.date}
                        </p>
                      </div>
                      <p className={`text-[10px] md:text-xs mt-1 ${
                        isActive ? 'text-slate-600 font-bold' : 'text-slate-400'
                      }`}>
                        {step.desc}
                      </p>

                      {/* Contextual Action Links (AWB tracking) */}
                      {exchange && idx === 2 && exchange.reverse?.awb && (isCompleted || isActive) && (
                        <a
                          href={exchange.reverse.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-black text-amber-600 underline hover:text-amber-700 font-sans"
                        >
                          Track Pickup ({exchange.reverse.awb})
                        </a>
                      )}
                      {exchange && idx === 3 && exchange.forward?.awb && (isCompleted || isActive) && (
                        <a
                          href={exchange.forward.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-black text-blue-600 underline hover:text-blue-700 font-sans"
                        >
                          Track Delivery ({exchange.forward.awb})
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
