import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Package, User, MapPin, 
  CreditCard, Truck, Calendar, Clock,
  Download, Printer, AlertCircle, ChevronRight,
  ShieldCheck, Smartphone, Mail, RefreshCw, XCircle,
  RotateCcw, DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import OptimizedImage from '../../../components/common/OptimizedImage';

const StatusBadge = ({ status }) => {
  const styles = {
    'Pending': 'bg-amber-50 text-amber-600 border-amber-100',
    'Processing': 'bg-blue-50 text-blue-600 border-blue-100',
    'Shipped': 'bg-violet-50 text-violet-600 border-violet-100',
    'Out for Delivery': 'bg-sky-50 text-sky-600 border-sky-100',
    'Delivered': 'bg-green-50 text-green-600 border-green-100',
    'Cancelled': 'bg-red-50 text-red-600 border-red-100',
    'Return Requested': 'bg-amber-50 text-amber-600 border-amber-100',
    'Refunded': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      {status}
    </span>
  );
};

const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [creatingShiprocket, setCreatingShiprocket] = useState(false);

  const tabs = ['All', 'Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested'];

  const [returnInfo, setReturnInfo] = useState(null);

  const fetchReturnInfo = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/returns/admin/all?search=&status=All&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Find return for this order
        const match = data.returns?.find(r => {
          const rid = r.orderId?._id || r.orderId;
          return rid && rid.toString() === orderId;
        });
        if (match) setReturnInfo(match);
      }
    } catch (err) {
      console.error('Fetch return info error:', err);
    }
  };

  const fetchOrderDetail = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Admin authentication missing');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      setLoading(true);
      const res = await fetch(`${apiBase}/orders/admin/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrder(data.order);
      } else {
        toast.error(data.message || 'Failed to fetch order details');
      }
    } catch (err) {
      console.error('Fetch order details error:', err);
      toast.error('Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
    fetchReturnInfo();
  }, [orderId]);

  const handleUpdateStatus = async (newStatus) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/admin/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Order status updated to ${newStatus}`);
        setOrder(prev => ({ ...prev, status: newStatus }));
      } else {
        toast.error(data.message || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Could not update order status');
    }
  };

  const handleUpdatePaymentStatus = async (newPaymentStatus) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/admin/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paymentStatus: newPaymentStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Payment status updated to ${newPaymentStatus}`);
        setOrder(prev => ({ ...prev, paymentStatus: newPaymentStatus }));
      } else {
        toast.error(data.message || 'Failed to update payment status');
      }
    } catch (err) {
      console.error('Update payment status error:', err);
      toast.error('Could not update payment status');
    }
  };

  const handleAssignAWB = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/assign-awb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('AWB Assigned Successfully');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Failed to assign AWB');
      }
    } catch (err) {
      toast.error('Error assigning AWB');
    }
  };

  const handleGenerateLabel = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/generate-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success && data.data.label_created) {
        window.open(data.data.label_url, '_blank');
        toast.success('Label generated!');
      } else {
        toast.error('Label not ready or failed to generate');
      }
    } catch (err) {
      toast.error('Error generating label');
    }
  };

  const handleRequestPickup = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/request-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Pickup requested successfully');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Failed to request pickup');
      }
    } catch (err) {
      toast.error('Error requesting pickup');
    }
  };

  const handleCreateShiprocketOrder = async () => {
    const token = localStorage.getItem('adminToken');
    setCreatingShiprocket(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Shiprocket order created successfully!');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Failed to create Shiprocket order');
      }
    } catch (err) {
      toast.error('Error creating Shiprocket order');
    } finally {
      setCreatingShiprocket(false);
    }
  };

  const handleProcessOrder = async () => {
    const token = localStorage.getItem('adminToken');
    setProcessingOrder(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/process-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order processed! AWB + Pickup + Label done.');
        fetchOrderDetail();
        if (data.results?.label?.label_url) {
          window.open(data.results.label.label_url, '_blank');
        }
      } else {
        toast.error(data.message || 'Failed to process order');
      }
    } catch (err) {
      toast.error('Error processing order');
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order? Stock will be restored.')) return;
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/cancel-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order cancelled successfully');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Failed to cancel order');
      }
    } catch (err) {
      toast.error('Error cancelling order');
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    if (!window.confirm('Are you sure you want to delete this order? It will be cancelled in Shiprocket and completely removed from the database.')) return;
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/admin/${order._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order deleted successfully');
        navigate('/admin/orders');
      } else {
        toast.error(data.message || 'Failed to delete order');
      }
    } catch (err) {
      toast.error('Error deleting order');
    }
  };

  const handleSyncStatus = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/sync-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order synced with Shiprocket');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Sync failed');
      }
    } catch (err) {
      toast.error('Error syncing order status');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <XCircle className="text-red-500" size={40} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Order not found</p>
        <button onClick={() => navigate(-1)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Go Back</button>
      </div>
    );
  }

  // Generate a fallback timeline based on order status if no shiprocket/custom trackingHistory exists
  const getTimeline = () => {
    if (order.trackingHistory && order.trackingHistory.length > 0) {
      return order.trackingHistory.map(entry => ({
        status: entry.activity || entry.status,
        date: new Date(entry.timestamp).toLocaleString(),
        desc: entry.location || 'Activity tracked',
        completed: true
      }));
    }

    const steps = [
      { status: 'Pending', date: new Date(order.createdAt).toLocaleString(), desc: 'Order placed by customer', completed: true },
      { status: 'Processing', date: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'Updated' : 'Pending', desc: 'Order confirmed & is being prepared', completed: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) },
      { status: 'Shipped', date: ['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'Updated' : 'Pending', desc: 'Awaiting courier scan or shipped', completed: ['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) },
      { status: 'Out for Delivery', date: ['Out for Delivery', 'Delivered'].includes(order.status) ? 'Updated' : 'Pending', desc: 'Delivery partner is on the way', completed: ['Out for Delivery', 'Delivered'].includes(order.status) },
      { status: 'Delivered', date: order.status === 'Delivered' ? 'Completed' : 'Pending', desc: 'Package delivered to address', completed: order.status === 'Delivered' }
    ];

    if (order.status === 'Cancelled') {
      steps.push({ status: 'Cancelled', date: 'Order Voided', desc: 'This order has been cancelled', completed: true });
    }

    return steps;
  };

  const orderTimeline = getTimeline();

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-wrap gap-4">
        <div className="flex items-center gap-4">
           <button onClick={() => navigate(-1)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">
              <ArrowLeft size={20} />
           </button>
           <div>
              <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-black text-slate-900 font-montserrat uppercase tracking-tight">Order #{order._id.substring(order._id.length - 8).toUpperCase()}</h1>
                 <StatusBadge status={order.status} />
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Placed on {new Date(order.createdAt).toLocaleString()}</p>
           </div>
        </div>
        <div className="flex gap-3">
           <button onClick={() => window.print()} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">
              <Printer size={20} />
           </button>
           {order.awbCode && (
             <button 
               onClick={handleGenerateLabel}
               className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all"
             >
                <Download size={18} />
                Download Label
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Side: Items & Summary */}
         <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                  <Package size={18} className="text-blue-500" />
                  <h3 className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Order Items ({order.items?.length || 0})</h3>
               </div>
               <div className="divide-y divide-slate-50">
                  {order.items?.map((item, index) => (
                    <div key={index} className="p-6 flex items-center gap-6">
                       <div className="w-20 h-20 bg-slate-50 rounded-2xl border border-slate-100 flex-shrink-0 overflow-hidden">
                          <OptimizedImage src={item.image} alt={item.name} type="product" className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1">
                          <h4 className="font-black text-slate-900 font-montserrat uppercase tracking-tight text-sm">{item.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Product ID: {item.productId?.substring(item.productId.length - 8).toUpperCase() || 'N/A'}</p>
                          <div className="flex items-center gap-6 mt-4">
                             <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price</p>
                                <p className="text-sm font-black text-slate-900 font-roboto">₹{item.price.toLocaleString()}</p>
                             </div>
                             <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                                <p className="text-sm font-black text-slate-900 font-roboto">× {item.quantity}</p>
                             </div>
                             <div className="ml-auto text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                <p className="text-sm font-black text-blue-600 font-roboto">₹{(item.price * item.quantity).toLocaleString()}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
               <div className="p-8 bg-slate-50/50 border-t border-slate-100 space-y-3">
                  <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                     <span>Payment Mode</span>
                     <span className="text-slate-900 uppercase">{order.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                     <span>Payment Status</span>
                     <div className="flex items-center gap-2">
                        <span className="text-slate-900 uppercase font-black">{order.paymentStatus}</span>
                        <select
                          value={order.paymentStatus}
                          onChange={(e) => handleUpdatePaymentStatus(e.target.value)}
                          className="bg-white border border-slate-200 text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg focus:outline-none"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Paid">Paid</option>
                          <option value="Failed">Failed</option>
                        </select>
                     </div>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                     <span>Delivery Charges</span>
                     <span className="text-slate-900">₹{(order.deliveryCharge || 0).toLocaleString()}</span>
                  </div>
                  {order.couponCode && (
                    <div className="flex justify-between text-xs font-bold text-indigo-500 bg-indigo-50/50 px-3 py-2 rounded-xl border border-indigo-100/50">
                       <span className="uppercase">Coupon Used</span>
                       <span className="font-black">{order.couponCode}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                     <p className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Order Total</p>
                     <p className="text-2xl font-black text-blue-600 font-roboto">₹{order.total.toLocaleString()}</p>
                  </div>
               </div>
            </div>

            {/* Logistics Actions (Shiprocket) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                 <Truck size={18} className="text-blue-500" />
                 <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Shiprocket Logistics Integration</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">SR Order ID</span> 
                  <p className="text-slate-900">{order.shiprocketOrderId || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Shipment ID</span> 
                  <p className="text-slate-900">{order.shipmentId || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">AWB Code</span> 
                  <p className="text-blue-600">{order.awbCode || 'Pending'}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Courier</span> 
                  <p className="text-slate-900">{order.courierName || 'Unassigned'}</p>
                </div>
                <div className="col-span-2 md:col-span-4 mt-2 pt-2 border-t border-slate-200/50 flex flex-wrap gap-4 justify-between">
                  <div>
                    <span className="text-slate-400 uppercase text-[9px]">Shipment Status</span> 
                    <p className="text-indigo-600">{order.shipmentStatus || 'N/A'}</p>
                  </div>
                  {order.etd && (
                    <div>
                      <span className="text-slate-400 uppercase text-[9px]">Est. Delivery</span> 
                      <p className="text-green-600">{order.etd}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {!order.shipmentId && !['Delivered', 'Cancelled'].includes(order.status) && (
                  <button 
                    onClick={handleCreateShiprocketOrder}
                    disabled={creatingShiprocket}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {creatingShiprocket ? '⏳ Creating...' : '📦 Create Shiprocket Order'}
                  </button>
                )}

                {order.shipmentId && !['Delivered', 'Cancelled'].includes(order.status) && (
                  <>
                    {!order.awbCode && (
                      <button 
                        onClick={handleProcessOrder}
                        disabled={processingOrder}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs font-bold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm disabled:opacity-50"
                      >
                        {processingOrder ? '⏳ Processing...' : '🚀 Process Order (AWB + Pickup + Label)'}
                      </button>
                    )}

                    {!order.awbCode && (
                      <button 
                        onClick={handleAssignAWB}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors shadow-sm"
                      >
                        Assign AWB
                      </button>
                    )}

                    {order.awbCode && (
                      <>
                        <button 
                          onClick={handleGenerateLabel}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm"
                        >
                          Download Label
                        </button>
                        <button 
                          onClick={handleRequestPickup}
                          className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors shadow-sm"
                        >
                          Request Pickup
                        </button>
                        <button 
                          onClick={handleSyncStatus}
                          className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors shadow-sm"
                        >
                          🔄 Sync Status
                        </button>
                      </>
                    )}

                    <button 
                      onClick={handleCancelOrder}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors shadow-sm"
                    >
                      ✕ Cancel Order
                    </button>
                  </>
                )}

                {/* Delete Order - Always available */}
                <button 
                  onClick={handleDeleteOrder}
                  className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors shadow-sm active:scale-95"
                >
                  🗑️ Delete Order
                </button>
              </div>
            </div>
         </div>

         {/* Right Side: Customer & Timeline */}
         <div className="space-y-6">
            {/* Return & Refund Info */}
            {(returnInfo || order.status === 'Return Requested') && (
              <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <RotateCcw size={18} className="text-amber-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Return & Refund</h3>
                </div>
                {returnInfo ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Return ID</p>
                        <p className="font-bold text-blue-600 font-roboto mt-0.5">RET-{returnInfo._id.substring(returnInfo._id.length - 6).toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                          returnInfo.status === 'Refunded' ? 'bg-green-50 text-green-600 border-green-100' :
                          returnInfo.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                          returnInfo.status === 'Requested' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>{returnInfo.status}</span>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reason</p>
                        <p className="font-bold text-slate-900 mt-0.5">{returnInfo.reason}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Refund Amount</p>
                        <p className="font-black text-green-600 font-roboto mt-0.5">₹{returnInfo.refundAmount?.toLocaleString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/admin/operations/returns')}
                      className="w-full px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={14} />
                      Manage Return
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 font-medium">A return has been requested for this order. Check the Returns page for details.</p>
                )}
              </div>
            )}

            {/* Customer Info */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center gap-3">
                  <User size={18} className="text-blue-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Customer Profile</h3>
               </div>
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl font-black border border-blue-100 shadow-inner uppercase">
                     {order.userId?.name ? order.userId.name.substring(0, 1) : 'G'}
                  </div>
                  <div>
                     <h4 className="text-lg font-black text-slate-900 font-montserrat uppercase tracking-tight">{order.userId?.name || 'Guest User'}</h4>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Lifecycle: Registered Buyer</p>
                  </div>
               </div>
               <div className="space-y-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest break-all">
                     <Mail size={14} className="text-slate-300 flex-shrink-0" />
                     {order.userId?.email || 'N/A'}
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest">
                     <Smartphone size={14} className="text-slate-300 flex-shrink-0" />
                     {order.userId?.phone || 'N/A'}
                  </div>
                  <div className="flex items-start gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed">
                     <MapPin size={14} className="text-slate-300 mt-0.5 flex-shrink-0" />
                     <div>
                       <p className="text-slate-800 font-bold mb-1">{order.deliveryAddress?.name}</p>
                       <p className="text-slate-500 leading-normal lowercase font-medium">{order.deliveryAddress?.address}</p>
                       <p className="text-[10px] font-black text-slate-400 mt-1.5 uppercase">PINCODE: {order.deliveryAddress?.pincode} | TYPE: {order.deliveryAddress?.type || 'WORK'}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center gap-3">
                  <Clock size={18} className="text-blue-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Order Timeline</h3>
               </div>
               <div className="space-y-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {orderTimeline.map((step, i) => (
                    <div key={i} className="flex gap-6 relative">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${step.completed ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                          {step.completed ? <ShieldCheck size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                       </div>
                       <div>
                          <p className={`text-xs font-black uppercase tracking-widest ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>{step.status}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{step.date}</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">{step.desc}</p>
                       </div>
                    </div>
                  ))}
               </div>
               
               <div className="space-y-2 pt-4 border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Lifecycle Operations</p>
                  <div className="flex gap-2">
                    <select
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      className="w-full bg-slate-900 text-white py-3.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none shadow-xl cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      {tabs.slice(1).map(opt => (
                        <option key={opt} value={opt} className="bg-white text-slate-950 font-bold">{opt}</option>
                      ))}
                    </select>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default OrderDetail;
