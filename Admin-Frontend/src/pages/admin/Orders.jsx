import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Filter, ChevronRight, Eye, 
  Package, Truck, CheckCircle2, Clock, 
  XCircle, AlertCircle, MoreVertical,
  Download, Calendar, User, ShoppingBag, CreditCard, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import OptimizedImage from '../../components/common/OptimizedImage';

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

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(null);

  const tabs = ['All', 'Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested'];

  const fetchOrders = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Admin authentication missing');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      setLoading(true);
      const res = await fetch(`${apiBase}/orders/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(data.orders || []);
      } else {
        toast.error(data.message || 'Failed to fetch orders');
      }
    } catch (err) {
      console.error('Fetch orders error:', err);
      toast.error('Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
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
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        }
      } else {
        toast.error(data.message || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Could not update order status');
    } finally {
      setStatusMenuOpen(null);
    }
  };

  const handleUpdatePaymentStatus = async (orderId, newPaymentStatus) => {
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
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o));
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(prev => ({ ...prev, paymentStatus: newPaymentStatus }));
        }
      } else {
        toast.error(data.message || 'Failed to update payment status');
      }
    } catch (err) {
      console.error('Update payment status error:', err);
      toast.error('Could not update payment status');
    }
  };

  const handleAssignAWB = async (orderId) => {
    if (!orderId) return toast.error('No order ID available');
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
        fetchOrders();
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(prev => ({ ...prev, awbCode: data.order?.awbCode, courierName: data.order?.courierName, shipmentStatus: 'AWB Assigned' }));
        }
      } else {
        toast.error(data.message || 'Failed to assign AWB');
      }
    } catch (err) {
      toast.error('Error assigning AWB');
    }
  };

  const handleGenerateLabel = async (orderId) => {
    if (!orderId) return toast.error('No order ID available');
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

  const handleRequestPickup = async (orderId) => {
    if (!orderId) return toast.error('No order ID available');
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
        fetchOrders();
      } else {
        toast.error(data.message || 'Failed to request pickup');
      }
    } catch (err) {
      toast.error('Error requesting pickup');
    }
  };

  const [processingOrder, setProcessingOrder] = useState(null);
  const [creatingShiprocket, setCreatingShiprocket] = useState(null);

  const handleCreateShiprocketOrder = async (orderId) => {
    if (!orderId) return toast.error('No order ID available');
    const token = localStorage.getItem('adminToken');
    setCreatingShiprocket(orderId);
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
        fetchOrders();
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(data.order);
        }
      } else {
        toast.error(data.message || 'Failed to create Shiprocket order');
      }
    } catch (err) {
      toast.error('Error creating Shiprocket order');
    } finally {
      setCreatingShiprocket(null);
    }
  };

  const handleProcessOrder = async (orderId) => {
    if (!orderId) return toast.error('No order ID available');
    const token = localStorage.getItem('adminToken');
    setProcessingOrder(orderId);
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
        fetchOrders();
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(prev => ({
            ...prev,
            awbCode: data.order?.awbCode,
            courierName: data.order?.courierName,
            shipmentStatus: data.order?.shipmentStatus,
            pickupScheduled: data.order?.pickupScheduled
          }));
        }
        // Auto-open label if available
        if (data.results?.label?.label_url) {
          window.open(data.results.label.label_url, '_blank');
        }
      } else {
        toast.error(data.message || 'Failed to process order');
      }
    } catch (err) {
      toast.error('Error processing order');
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!orderId) return;
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
        fetchOrders();
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(prev => ({ ...prev, status: 'Cancelled', shipmentStatus: 'Cancelled' }));
        }
      } else {
        toast.error(data.message || 'Failed to cancel order');
      }
    } catch (err) {
      toast.error('Error cancelling order');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!orderId) return;
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/admin/${orderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order deleted successfully');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        toast.error(data.message || 'Failed to delete order');
      }
    } catch (err) {
      toast.error('Error deleting order');
    }
  };

  const handleSyncStatus = async (orderId) => {
    if (!orderId) return;
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
        fetchOrders();
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(data.order);
        }
      } else {
        toast.error(data.message || 'Sync failed');
      }
    } catch (err) {
      toast.error('Error syncing order status');
    }
  };

  const handleExport = () => {
    const headers = ['Order ID', 'Customer', 'Email', 'Total Amount', 'Status', 'Payment Method', 'Payment Status', 'Date'];
    const csvContent = [
      headers.join(','),
      ...orders.map(o => `"${o._id}","${o.userId?.name || 'Guest'}","${o.userId?.email || ''}",${o.total},"${o.status}","${o.paymentMethod}","${o.paymentStatus}","${new Date(o.createdAt).toLocaleString()}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and search logic
  const filteredOrders = orders.filter(order => {
    const matchesTab = activeTab === 'All' || order.status === activeTab;
    const matchesSearch = 
      order._id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (order.userId?.name && order.userId.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.userId?.email && order.userId.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  // Calculate stats based on loaded orders
  const totalSales = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0);
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const transitCount = orders.filter(o => ['Shipped', 'Out for Delivery'].includes(o.status)).length;
  const cancelledCount = orders.filter(o => o.status === 'Cancelled').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Orders Hub</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Centralized tracking and lifecycle management for platform sales.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: `₹${totalSales.toLocaleString()}`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Orders', value: pendingCount.toString(), icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'In Transit', value: transitCount.toString(), icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Cancelled', value: cancelledCount.toString(), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 font-roboto">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 space-y-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-100' 
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search by Order ID or Customer Name / Email..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-12 pr-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-900 placeholder:text-slate-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse hover:bg-transparent">
                    <td className="px-6 py-5"><div className="w-16 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="w-24 h-4 bg-slate-200 rounded"></div>
                        <div className="w-32 h-3 bg-slate-200 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="w-16 h-4 bg-slate-200 rounded"></div>
                        <div className="w-10 h-3 bg-slate-200 rounded"></div>
                      </div>
                    </td>
                    <td className="px-6 py-5"><div className="w-20 h-6 bg-slate-200 rounded-full"></div></td>
                    <td className="px-6 py-5"><div className="w-24 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-5"><div className="w-32 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-5"><div className="w-20 h-8 bg-slate-200 rounded-lg ml-auto"></div></td>
                  </tr>
                ))
              ) : (
                <AnimatePresence>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order, i) => (
                      <motion.tr 
                        key={order._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="group hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-5 cursor-pointer" onClick={() => navigate(`/admin/orders/${order._id}`)}>
                          <span className="text-xs font-black text-blue-600 font-roboto hover:underline">#{order._id.substring(order._id.length - 8).toUpperCase()}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{order.userId?.name || 'Guest User'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{order.userId?.email || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-slate-900 font-roboto">₹{order.total.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{order.items?.length || 0} Items</p>
                        </td>
                        <td className="px-6 py-5">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${order.paymentStatus === 'Paid' ? 'text-green-500' : 'text-slate-400'}`}>
                            {order.paymentMethod} ({order.paymentStatus})
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                            <Calendar size={12} className="text-slate-300" />
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right relative">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => navigate(`/admin/orders/${order._id}`)}
                              className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteOrder(order._id)}
                              className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
                              title="Delete Order"
                            >
                              <Trash2 size={16} />
                            </button>
                            <div className="relative">
                              <button 
                                onClick={() => setStatusMenuOpen(statusMenuOpen === order._id ? null : order._id)}
                                className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-all"
                              >
                                <MoreVertical size={16} />
                              </button>
                              
                              <AnimatePresence>
                                {statusMenuOpen === order._id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(null)} />
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 py-2"
                                    >
                                      <p className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Update Status</p>
                                      {tabs.slice(1).map(statusOpt => (
                                        <button
                                          key={statusOpt}
                                          onClick={() => handleUpdateStatus(order._id, statusOpt)}
                                          className={`w-full px-4 py-2 text-left text-xs font-bold transition-colors ${
                                            order.status === statusOpt ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                                          }`}
                                        >
                                          {statusOpt}
                                        </button>
                                      ))}
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                        No orders found.
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-xl bg-white h-full rounded-[32px] shadow-2xl p-8 flex flex-col overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-montserrat uppercase tracking-tight">Order Details</h2>
                  <p className="text-xs font-black text-blue-600 mt-1 font-roboto uppercase">ID: #{selectedOrder._id}</p>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Status and Actions */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-wrap gap-4 items-center justify-between mb-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Lifecycle Status</p>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                
                <div className="flex gap-2">
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateStatus(selectedOrder._id, e.target.value)}
                    className="bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none shadow-sm"
                  >
                    {tabs.slice(1).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-4 mb-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Customer & Shipping</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><User size={12}/> Buyer Profile</p>
                    <p className="text-sm font-bold text-slate-900">{selectedOrder.userId?.name || 'Guest'}</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">{selectedOrder.userId?.email || 'N/A'}</p>
                    <p className="text-xs text-slate-500 font-medium">{selectedOrder.userId?.phone || 'N/A'}</p>
                  </div>
                  
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Truck size={12}/> Delivery Address</p>
                    <p className="text-xs font-bold text-slate-800 leading-tight">{selectedOrder.deliveryAddress?.name}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-normal font-medium">{selectedOrder.deliveryAddress?.address}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase">PINCODE: {selectedOrder.deliveryAddress?.pincode} | Type: {selectedOrder.deliveryAddress?.type}</p>
                  </div>
                </div>
              </div>

              {/* Shiprocket Logistics Info */}
              <div className="space-y-4 mb-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Logistics (Shiprocket)</h3>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50 space-y-3">
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-slate-400 uppercase text-[10px]">Shiprocket Order ID:</span> 
                      <p>{selectedOrder.shiprocketOrderId || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase text-[10px]">Shipment ID:</span> 
                      <p>{selectedOrder.shipmentId || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase text-[10px]">AWB Code:</span> 
                      <p className={selectedOrder.awbCode ? 'text-blue-600' : ''}>{selectedOrder.awbCode || 'Pending'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase text-[10px]">Courier:</span> 
                      <p>{selectedOrder.courierName || 'Unassigned'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase text-[10px]">Shipment Status:</span> 
                      <p className="text-indigo-600">{selectedOrder.shipmentStatus || 'N/A'}</p>
                    </div>
                    {selectedOrder.etd && (
                      <div>
                        <span className="text-slate-400 uppercase text-[10px]">Est. Delivery:</span> 
                        <p className="text-green-600">{selectedOrder.etd}</p>
                      </div>
                    )}
                  </div>

                  {!selectedOrder.shipmentId && !['Delivered', 'Cancelled'].includes(selectedOrder.status) && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                      <button 
                        onClick={() => handleCreateShiprocketOrder(selectedOrder._id)}
                        disabled={creatingShiprocket === selectedOrder._id}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm disabled:opacity-50 active:scale-95"
                      >
                        {creatingShiprocket === selectedOrder._id ? '⏳ Creating...' : '📦 Create Shiprocket Order'}
                      </button>
                    </div>
                  )}

                  {selectedOrder.shipmentId && !['Delivered', 'Cancelled'].includes(selectedOrder.status) && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                      {/* One-Click Process (AWB + Pickup + Label) */}
                      {!selectedOrder.awbCode && (
                        <button 
                          onClick={() => handleProcessOrder(selectedOrder._id)}
                          disabled={processingOrder === selectedOrder._id}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs font-bold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm disabled:opacity-50"
                        >
                          {processingOrder === selectedOrder._id ? '⏳ Processing...' : '🚀 Process Order (AWB + Pickup + Label)'}
                        </button>
                      )}

                      {/* Individual Steps */}
                      {!selectedOrder.awbCode && (
                        <button 
                          onClick={() => handleAssignAWB(selectedOrder._id)}
                          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors shadow-sm"
                        >
                          Assign AWB
                        </button>
                      )}
                      {selectedOrder.awbCode && (
                        <>
                          <button 
                            onClick={() => handleGenerateLabel(selectedOrder._id)}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm"
                          >
                            Download Label
                          </button>
                          <button 
                            onClick={() => handleRequestPickup(selectedOrder._id)}
                            className="px-4 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors shadow-sm"
                          >
                            Request Pickup
                          </button>
                          <button 
                            onClick={() => handleSyncStatus(selectedOrder._id)}
                            className="px-4 py-2 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors shadow-sm"
                          >
                            🔄 Sync Status
                          </button>
                        </>
                      )}

                      {/* Cancel Order */}
                      <button 
                        onClick={() => handleCancelOrder(selectedOrder._id)}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors shadow-sm"
                      >
                        ✕ Cancel Order
                      </button>
                    </div>
                  )}

                  {/* Delete Order - Always available for any selected order */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 mt-2">
                    <button 
                      onClick={() => handleDeleteOrder(selectedOrder._id)}
                      className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors shadow-sm active:scale-95"
                    >
                      🗑️ Delete Order
                    </button>
                  </div>

                  {/* Show tracking history if available */}
                  {selectedOrder.trackingHistory && selectedOrder.trackingHistory.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tracking History</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedOrder.trackingHistory.slice().reverse().map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-[11px]">
                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 flex-shrink-0"></div>
                            <div className="flex-1">
                              <p className="font-bold text-slate-700">{entry.activity || entry.status}</p>
                              <p className="text-slate-400 text-[10px]">
                                {entry.location && `${entry.location} · `}
                                {new Date(entry.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4 mb-6 flex-1 overflow-y-auto pr-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cart Items</h3>
                <div className="divide-y divide-slate-100">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="py-3 flex items-center gap-4">
                      <OptimizedImage 
                        src={item.image} 
                        alt={item.name} 
                        type="product"
                        className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-100 shadow-sm"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">₹{item.price.toLocaleString()} x {item.quantity}</p>
                      </div>
                      <p className="text-sm font-black text-slate-900 font-roboto">₹{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order financial Summary */}
              <div className="border-t border-slate-100 pt-6 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>Payment Mode:</span>
                  <span className="uppercase tracking-widest text-slate-900">{selectedOrder.paymentMethod}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>Payment Status:</span>
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-widest text-slate-900">{selectedOrder.paymentStatus}</span>
                    <select
                      value={selectedOrder.paymentStatus}
                      onChange={(e) => handleUpdatePaymentStatus(selectedOrder._id, e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg focus:outline-none"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>Est. Delivery Charge:</span>
                  <span className="font-black text-slate-900">₹{(selectedOrder.deliveryCharge || 0).toLocaleString()}</span>
                </div>

                {selectedOrder.couponCode && (
                  <div className="flex justify-between items-center text-xs font-bold text-indigo-500 bg-indigo-50/50 px-3 py-2 rounded-xl border border-indigo-100/50">
                    <span className="uppercase">Coupon Used:</span>
                    <span className="font-black font-roboto">{selectedOrder.couponCode}</span>
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Total Paid:</span>
                  <span className="text-xl font-black text-slate-900 font-roboto">₹{selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Dollar Sign SVG
const DollarSign = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;

export default Orders;
