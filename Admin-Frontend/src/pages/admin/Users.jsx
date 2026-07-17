import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users as UsersIcon, Search, Filter, Mail, 
  Phone, MapPin, Calendar, MoreVertical,
  CheckCircle2, XCircle, Clock, ShieldCheck,
  Download, UserPlus, Star, Edit2, ShieldAlert, Eye, LogOut,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../utils/toast';

const MOCK_USERS = [
  { id: 'USR001', name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 98765 43210', joined: '2026-05-01', totalSpent: '₹45,200', orders: 12, status: 'Active' },
  { id: 'USR002', name: 'Priyanka Das', email: 'priyanka@example.com', phone: '+91 98765 43211', joined: '2026-04-28', totalSpent: '₹12,500', orders: 4, status: 'Active' },
  { id: 'USR003', name: 'Amit Verma', email: 'amit@example.com', phone: '+91 98765 43212', joined: '2026-04-20', totalSpent: '₹89,400', orders: 28, status: 'VIP' },
  { id: 'USR004', name: 'Sneha Kapur', email: 'sneha@example.com', phone: '+91 98765 43213', joined: '2026-04-15', totalSpent: '₹0', orders: 0, status: 'Inactive' },
  { id: 'USR005', name: 'Vikram Singh', email: 'vikram@example.com', phone: '+91 98765 43214', joined: '2026-04-10', totalSpent: '₹1,56,000', orders: 45, status: 'VIP' },
];

const Users = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'Active'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeNow: 0,
    avgLtv: 0,
    newUsersThisWeek: 0
  });
  const [editingUser, setEditingUser] = useState(null);
  const limit = 10;

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingUser(null);
    setFormData({ name: '', email: '', phone: '', status: 'Active' });
  };

  const fetchUsers = async (page = 1, search = '', status = 'All') => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search,
        status: status
      });
      const res = await fetch(`${apiBase}/admin/auth/users?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const formattedUsers = data.users.map((u) => ({
          id: u._id,
          name: u.name || 'Anonymous User',
          email: u.email || 'N/A',
          phone: u.phone || 'N/A',
          joined: new Date(u.createdAt).toISOString().split('T')[0],
          totalSpent: `₹${(u.totalSpent || 0).toLocaleString('en-IN')}`,
          orders: u.ordersCount || 0,
          status: u.derivedStatus || 'Active'
        }));
        setUsersList(formattedUsers);
        setTotalPages(data.pages || 1);
        setTotalUsers(data.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        toast.error(data.message || 'Failed to load users');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  // Fetch data when page, search, or filter status changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers(currentPage, searchQuery, filterStatus);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [currentPage, searchQuery, filterStatus]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveCustomer = async () => {
    if (!formData.name || !formData.phone) {
      toast.info('Name and Phone number are required');
      return;
    }

    const trimmedName = formData.name.trim().replace(/\s+/g, ' ');
    const nameRegex = /^[a-zA-Z]+(?:\s+[a-zA-Z]+)+$/;
    if (!nameRegex.test(trimmedName)) {
      toast.info('Please enter a valid full name (e.g., John Doe) containing only letters');
      return;
    }

    const formattedName = trimmedName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.info('Phone number must be exactly 10 digits');
      return;
    }

    if (formData.email) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
      if (!emailRegex.test(formData.email)) {
        toast.info('Please enter a valid email address (e.g., user@example.com)');
        return;
      }
    }

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const isEditing = !!editingUser;
      const url = isEditing 
        ? `${apiBase}/admin/auth/users/${editingUser.id}` 
        : `${apiBase}/admin/auth/users`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formattedName,
          email: formData.email || '',
          phone: formData.phone
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || (isEditing ? 'Customer updated successfully' : 'Customer added successfully'));
        setCurrentPage(1);
        setSearchQuery('');
        setFilterStatus('All');
        fetchUsers(1, '', 'All');
        handleCloseModal();
      } else {
        toast.error(data.message || 'Failed to save customer');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const [activeMenu, setActiveMenu] = useState(null);

  const toggleMenu = (e, userId) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === userId ? null : userId);
  };

  const handleAction = async (e, action, user) => {
    e.stopPropagation();
    setActiveMenu(null);
    if (action === 'view') navigate(`/admin/users/${user.id}`);
    if (action === 'edit') {
      setEditingUser(user);
      setFormData({
        name: user.name || '',
        email: user.email === 'N/A' ? '' : (user.email || ''),
        phone: user.phone === 'N/A' ? '' : (user.phone || ''),
        status: user.status || 'Active'
      });
      setIsAddModalOpen(true);
    }
    if (action === 'force-logout') {
      const confirmLogout = window.confirm(`Are you sure you want to FORCE LOGOUT ${user.name}? This will clear their session on all devices immediately.`);
      if (!confirmLogout) return;

      const token = localStorage.getItem('adminToken');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${apiBase}/admin/auth/users/${user.id}/force-logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success(data.message || 'User forced logged out successfully');
        } else {
          toast.error(data.message || 'Failed to force logout user');
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not connect to backend server');
      }
    }
    if (action === 'suspend') {
      const confirmSuspend = window.confirm(`Are you sure you want to SUSPEND/DEACTIVATE ${user.name}? They will be forced logged out and blocked from logging back in.`);
      if (!confirmSuspend) return;

      const token = localStorage.getItem('adminToken');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${apiBase}/admin/auth/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'Inactive' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success('Customer suspended successfully');
          await fetch(`${apiBase}/admin/auth/users/${user.id}/force-logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          fetchUsers(currentPage, searchQuery, filterStatus);
        } else {
          toast.error(data.message || 'Failed to suspend user');
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not connect to backend server');
      }
    }
    if (action === 'activate') {
      const confirmActivate = window.confirm(`Are you sure you want to ACTIVATE ${user.name}?`);
      if (!confirmActivate) return;

      const token = localStorage.getItem('adminToken');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${apiBase}/admin/auth/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'Active' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success('Customer activated successfully');
          fetchUsers(currentPage, searchQuery, filterStatus);
        } else {
          toast.error(data.message || 'Failed to activate user');
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not connect to backend server');
      }
    }
  };

  const handleExport = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const toastId = toast.loading('Preparing export...');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '100000',
        search: searchQuery,
        status: filterStatus
      });
      const res = await fetch(`${apiBase}/admin/auth/users?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const headers = ['ID', 'Name', 'Email', 'Phone', 'Joined', 'Spent Amount', 'Orders', 'Status'];
        const csvContent = [
          headers.join(','),
          ...data.users.map(u => {
            const joined = new Date(u.createdAt).toISOString().split('T')[0];
            const spent = u.totalSpent || 0;
            const orders = u.ordersCount || 0;
            const status = u.derivedStatus || 'Active';
            return `${u._id},"${u.name || 'Anonymous'}",${u.email || 'N/A'},${u.phone || 'N/A'},${joined},${spent},${orders},${status}`;
          })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Export downloaded successfully', { id: toastId });
      } else {
        toast.error('Failed to export data', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server', { id: toastId });
    }
  };

  const handleForceLogoutAll = async () => {
    const confirmLogout = window.confirm(`⚠️ WARNING: Are you sure you want to FORCE LOGOUT ALL ${totalUsers} CUSTOMERS? This will invalidate every user session across the platform immediately.`);
    if (!confirmLogout) return;

    const token = localStorage.getItem('adminToken');
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${apiBase}/admin/auth/users/force-logout-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'All users forced logged out successfully');
      } else {
        toast.error(data.message || 'Failed to force logout all users');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700 relative">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Customer Database</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage platform buyers, review their spending history and account status.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleForceLogoutAll}
            className="flex items-center gap-2 px-6 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-all shadow-sm active:scale-95"
          >
            <LogOut size={16} />
            Logout All
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <Download size={16} />
            Export
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-8 py-3 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <UserPlus size={16} />
            Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Buyers', value: stats.totalUsers > 0 ? stats.totalUsers.toLocaleString() : '00', icon: UsersIcon, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active Now', value: stats.activeNow > 0 ? stats.activeNow.toLocaleString() : '00', icon: Clock, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Avg LTV', value: stats.avgLtv > 0 ? `₹${stats.avgLtv.toLocaleString('en-IN')}` : '00', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'New This Week', value: stats.newUsersThisWeek > 0 ? `+${stats.newUsersThisWeek}` : '00', icon: UserPlus, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center shadow-inner`}>
              <stat.icon size={22} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-6 border-b border-slate-50">
          <div className="flex gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search by Name, Email or Phone..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-12 pr-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none text-slate-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`px-6 h-[52px] border rounded-xl transition-all shadow-sm flex items-center gap-2 ${isFilterOpen || filterStatus !== 'All' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-900'}`}
              >
                <Filter size={18} />
                {filterStatus !== 'All' && <span className="text-[10px] font-black uppercase tracking-widest">{filterStatus}</span>}
              </button>

              <AnimatePresence>
                {isFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-16 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 py-3 overflow-hidden"
                    >
                       <p className="px-4 pb-2 mb-2 border-b border-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">Filter by Status</p>
                       {['All', 'Active', 'Inactive'].map((status) => (
                         <button 
                            key={status}
                            onClick={() => {
                              setFilterStatus(status);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between ${filterStatus === status ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                         >
                            {status}
                            {filterStatus === status && <CheckCircle2 size={12} />}
                         </button>
                       ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Customer Details</th>
                <th className="px-6 py-4">Total Spent</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Member Since</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-slate-200 rounded-full border border-slate-100"></div>
                         <div className="space-y-2">
                            <div className="w-32 h-4 bg-slate-200 rounded"></div>
                            <div className="w-48 h-3 bg-slate-200 rounded"></div>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-5"><div className="w-16 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-5"><div className="w-20 h-6 bg-slate-200 rounded-lg"></div></td>
                    <td className="px-6 py-5"><div className="w-24 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-5"><div className="w-16 h-6 bg-slate-200 rounded-full"></div></td>
                    <td className="px-6 py-5"><div className="w-8 h-8 bg-slate-200 rounded-lg ml-auto"></div></td>
                  </tr>
                ))) : usersList.length > 0 ? usersList.map((user, i) => (
                <tr 
                  key={user.id} 
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                  className="group hover:bg-blue-50/30 cursor-pointer transition-all border-l-4 border-transparent hover:border-blue-500 animate-in fade-in slide-in-from-left-2 duration-300"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 border border-slate-100">
                          {user.name.charAt(0)}
                       </div>
                       <div>
                          <p className="font-bold text-slate-900 font-montserrat leading-tight">{user.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">{user.email}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-black text-slate-900 font-roboto">{user.totalSpent}</td>
                  <td className="px-6 py-5">
                     <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black border border-slate-100">
                        {user.orders} Orders
                     </span>
                  </td>
                  <td className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{user.joined}</td>
                  <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        user.status === 'Active' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-rose-50 text-rose-500 border border-rose-100'
                      }`}>
                         {user.status}
                      </span>
                  </td>
                  <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                       <button 
                         onClick={(e) => handleAction(e, 'view', user)}
                         title="View Profile"
                         className="p-2 bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-all"
                       >
                          <Eye size={14} />
                       </button>
                       <button 
                         onClick={(e) => handleAction(e, 'edit', user)}
                         title="Edit Details"
                         className="p-2 bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-lg transition-all"
                       >
                          <Edit2 size={14} />
                       </button>
                       <button 
                         onClick={(e) => handleAction(e, 'force-logout', user)}
                         title="Force Logout"
                         className="p-2 bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white rounded-lg transition-all"
                       >
                          <LogOut size={14} />
                       </button>
                       {user.status === 'Inactive' ? (
                          <button 
                            onClick={(e) => handleAction(e, 'activate', user)}
                            title="Activate Customer"
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                          >
                             <ShieldCheck size={14} />
                          </button>
                       ) : (
                          <button 
                            onClick={(e) => handleAction(e, 'suspend', user)}
                            title="Suspend Customer"
                            className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all"
                          >
                             <ShieldAlert size={14} />
                          </button>
                       )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                      <UsersIcon size={48} className="opacity-20" />
                      <p className="text-sm font-bold uppercase tracking-widest">No customers found matching your search</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-3xl">
            <p className="text-xs font-bold text-slate-500 font-raleway uppercase tracking-wider">
              Showing <span className="text-slate-900 font-extrabold">{Math.min(totalUsers, (currentPage - 1) * limit + 1)}</span> to{' '}
              <span className="text-slate-900 font-extrabold">{Math.min(totalUsers, currentPage * limit)}</span> of{' '}
              <span className="text-slate-900 font-extrabold">{totalUsers}</span> Customers
            </p>
            
            <div className="flex items-center gap-2">
              {/* Previous Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2.5 rounded-xl border border-slate-100 transition-all flex items-center justify-center ${
                  currentPage === 1 
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' 
                    : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm active:scale-95'
                }`}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page Numbers */}
              {(() => {
                const pages = [];
                const maxVisiblePages = 5;

                if (totalPages <= maxVisiblePages) {
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  pages.push(1);

                  if (currentPage > 3) {
                    pages.push('ellipsis-prev');
                  }

                  const start = Math.max(2, currentPage - 1);
                  const end = Math.min(totalPages - 1, currentPage + 1);
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }

                  if (currentPage < totalPages - 2) {
                    pages.push('ellipsis-next');
                  }

                  pages.push(totalPages);
                }

                return pages.map((page, idx) => {
                  if (page === 'ellipsis-prev' || page === 'ellipsis-next') {
                    return (
                      <span key={`ellipsis-${idx}`} className="text-slate-400 px-2 font-bold select-none">
                        ...
                      </span>
                    );
                  }

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center ${
                        currentPage === page
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-100'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100 hover:text-slate-900 active:scale-95'
                      }`}
                    >
                      {page}
                    </button>
                  );
                });
              })()}

              {/* Next Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`p-2.5 rounded-xl border border-slate-100 transition-all flex items-center justify-center ${
                  currentPage === totalPages 
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' 
                    : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm active:scale-95'
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Slide-over */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-lg bg-white h-full rounded-[32px] shadow-2xl p-10 flex flex-col"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black text-slate-900 font-montserrat uppercase tracking-tight">
                  {editingUser ? 'Edit Customer Info' : 'Add New Customer'}
                </h2>
                <button 
                  onClick={handleCloseModal} 
                  className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90 shadow-sm"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar pb-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Full Name</label>
                  <input 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    type="text" 
                    placeholder="e.g. Rahul Sharma" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email Address</label>
                  <input 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    type="email" 
                    placeholder="rahul@example.com" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Phone Number</label>
                  <input 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    type="tel" 
                    placeholder="+91 00000 00000" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Initial Status</label>
                  <select 
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                
                <div className="bg-blue-50 p-6 rounded-[24px] border border-blue-100 flex gap-4 items-start">
                   <div className="p-2 bg-white rounded-xl text-blue-500 shadow-sm">
                      <ShieldCheck size={20} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Platform Sync</p>
                      <p className="text-[11px] text-blue-400 font-bold mt-1 leading-relaxed uppercase">Adding a customer will automatically trigger a welcome email and sync profile across all storefronts.</p>
                   </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50 flex gap-4">
                <button onClick={handleCloseModal} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
                <button 
                  onClick={handleSaveCustomer}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                   <CheckCircle2 size={16} />
                   {editingUser ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;
