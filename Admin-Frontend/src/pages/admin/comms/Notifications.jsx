import React, { useState, useEffect } from 'react';
import { 
  Bell, Send, Search, Filter, 
  MoreVertical, CheckCircle2, Clock, 
  Users, Smartphone, Mail, MessageSquare,
  AlertCircle, X, Plus, Calendar, Star, Check, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../../utils/toast';

const Notifications = () => {
  const [history, setHistory] = useState([]);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    target: 'All Users',
    targetUserIds: [], // Array of user IDs
  });

  const fetchHistory = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHistory(data.notifications);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load notifications history');
    }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAllUsers(data.users || []);
      } else {
        toast.error(data.message || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Could not connect to backend to fetch users');
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleUserSelection = (userId) => {
    setFormData(prev => {
      const isSelected = prev.targetUserIds.includes(userId);
      const updatedUserIds = isSelected 
        ? prev.targetUserIds.filter(id => id !== userId)
        : [...prev.targetUserIds, userId];
      return { ...prev, targetUserIds: updatedUserIds };
    });
  };

  const removeUserSelection = (userId) => {
    setFormData(prev => ({
      ...prev,
      targetUserIds: prev.targetUserIds.filter(id => id !== userId)
    }));
  };

  const handleSend = async () => {
    if (!formData.title || !formData.body) {
      toast.info('Please enter title and body for the notification');
      return;
    }
    if (formData.target === 'Selected Users' && formData.targetUserIds.length === 0) {
      toast.info('Please select at least one user');
      return;
    }

    setIsSending(true);
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Notification broadcast sent successfully!');
        setIsComposeOpen(false);
        setFormData({ title: '', body: '', target: 'All Users', targetUserIds: [] });
        fetchHistory();
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteSingle = async (id) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Notification deleted successfully!');
        setSelectedIds(prev => prev.filter(item => item !== id));
        fetchHistory();
      } else {
        toast.error(data.message || 'Failed to delete notification');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error. Failed to delete.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected notification(s)?`)) return;
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/notifications/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Selected notifications deleted successfully!');
        setSelectedIds([]);
        fetchHistory();
      } else {
        toast.error(data.message || 'Failed to delete selected notifications');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error. Failed to delete.');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(history.map(n => n._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Stats calculation
  const totalSent = history.length;
  const delivered = history.filter(n => n.status === 'Delivered').length;

  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.body || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.target || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = allUsers.filter(user => 
    (user.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) || 
    (user.phone || '').includes(userSearchQuery)
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Notification Hub</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Broadcast push notifications to your users in real-time.</p>
        </div>
        <button 
          onClick={() => setIsComposeOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={16} />
          Compose Message
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {[
           { label: 'Total Broadcasts', value: totalSent, icon: Send, color: 'text-blue-500', bg: 'bg-blue-50' },
           { label: 'Delivered', value: delivered, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
           { label: 'Total Users', value: allUsers.length, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
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

      {/* History Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Broadcast History</h3>
            <div className="flex flex-wrap gap-3 items-center">
               <input 
                 type="text" 
                 placeholder="Search broadcasts..."
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold bg-slate-50 outline-none"
               />
               <select
                 value={statusFilter}
                 onChange={e => setStatusFilter(e.target.value)}
                 className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold bg-white outline-none cursor-pointer"
               >
                 <option value="All">All Statuses</option>
                 <option value="Delivered">Delivered</option>
                 <option value="Pending">Pending</option>
                 <option value="Failed">Failed</option>
               </select>
               {selectedIds.length > 0 && (
                  <button 
                     onClick={handleDeleteSelected}
                     className="px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-rose-100 flex items-center gap-1.5"
                  >
                     <Trash2 size={14} />
                     Delete Selected ({selectedIds.length})
                  </button>
               )}
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={filteredHistory.length > 0 && selectedIds.length === filteredHistory.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredHistory.map(n => n._id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">Notification Details</th>
                <th className="px-6 py-4">Target Audience</th>
                <th className="px-6 py-4">Sent At</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredHistory.length > 0 ? filteredHistory.map((item, i) => (
                <tr key={item._id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item._id)}
                      onChange={() => handleSelectRow(item._id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                          <MessageSquare size={18} />
                       </div>
                       <div className="max-w-xs">
                          <p className="font-black text-slate-900 font-montserrat uppercase tracking-tight leading-tight truncate">{item.title}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">{item.body}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-100">
                      {item.target}
                    </span>
                    {item.target === 'Selected Users' && (
                      <p className="text-[9px] text-slate-400 mt-1">{item.targetUserIds?.length || 0} users selected</p>
                    )}
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-500 font-roboto text-xs uppercase">
                    {new Date(item.createdAt || item.sentAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${item.status === 'Delivered' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => handleDeleteSingle(item._id)}
                      className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition-all active:scale-95"
                      title="Delete notification"
                    >
                       <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400 font-medium">No broadcast history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compose Notification Slide-over */}
      <AnimatePresence>
        {isComposeOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-lg bg-white h-full rounded-[32px] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-slate-900 font-montserrat uppercase">Compose Notification</h2>
                <button onClick={() => setIsComposeOpen(false)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10 pr-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Notification Title</label>
                  <input 
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    type="text" 
                    placeholder="e.g. Exclusive Weekend Sale!" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-black focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Message Body</label>
                  <textarea 
                    name="body"
                    value={formData.body}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Write your message content here..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-medium focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Target Audience</label>
                  <div className="grid grid-cols-2 gap-3">
                     {[
                       { label: 'All Users', icon: Users },
                       { label: 'Selected Users', icon: Smartphone },
                     ].map((target, i) => (
                       <div 
                         key={i} 
                         onClick={() => setFormData({...formData, target: target.label})}
                         className={`p-4 border rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${formData.target === target.label ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                       >
                          <target.icon size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{target.label}</span>
                       </div>
                     ))}
                  </div>

                  {/* Multi-Select User Dropdown */}
                  {formData.target === 'Selected Users' && (
                     <div className="mt-4 relative animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {formData.targetUserIds.map(id => {
                            const user = allUsers.find(u => u._id === id);
                            return (
                              <div key={id} className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100">
                                <span>{user?.name || user?.phone || 'Unknown User'}</span>
                                <X size={14} className="cursor-pointer hover:text-blue-800" onClick={() => removeUserSelection(id)} />
                              </div>
                            )
                          })}
                        </div>
                        
                        <div className="relative">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                           <input 
                             type="text"
                             placeholder="Search users by name or phone..."
                             value={userSearchQuery}
                             onChange={(e) => setUserSearchQuery(e.target.value)}
                             onFocus={() => setIsDropdownOpen(true)}
                             className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all shadow-sm"
                           />
                        </div>

                        <AnimatePresence>
                          {isDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-20 py-2"
                              >
                                {filteredUsers.length > 0 ? filteredUsers.map(user => {
                                  const isSelected = formData.targetUserIds.includes(user._id);
                                  return (
                                    <div 
                                      key={user._id} 
                                      onClick={() => toggleUserSelection(user._id)}
                                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                                    >
                                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-900">{user.name || 'Anonymous'}</p>
                                        <p className="text-[10px] font-medium text-slate-400">{user.phone || user.email}</p>
                                      </div>
                                    </div>
                                  )
                                }) : (
                                  <div className="px-4 py-3 text-sm text-slate-400 text-center font-medium">No users found</div>
                                )}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                     </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 flex gap-3">
                <button onClick={() => setIsComposeOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Discard</button>
                <button 
                  onClick={handleSend}
                  disabled={isSending}
                  className="flex-1 py-4 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                   <Send size={16} />
                   {isSending ? 'Sending...' : 'Send Now (Push Only)'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;
