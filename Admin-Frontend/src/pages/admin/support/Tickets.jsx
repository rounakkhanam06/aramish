import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, Search, Filter, MoreVertical, 
  CheckCircle2, Clock, AlertCircle, MessageSquare,
  User, Send, Paperclip, ChevronRight, Inbox, HelpCircle as HelpIcon, ShieldAlert, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const token = localStorage.getItem('adminToken');

  const fetchTickets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/support-tickets/admin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTickets(data.tickets);
        // Default select the first ticket if available and none selected yet
        if (data.tickets.length > 0 && !selectedTicket) {
          setSelectedTicket(data.tickets[0]);
        }
      } else {
        toast.error(data.message || 'Failed to fetch support tickets');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleStatusChange = async (ticketId, newStatus) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/support-tickets/admin/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Ticket status updated to ${newStatus}`);
        
        // Update local tickets state
        const updatedTickets = tickets.map(t => t._id === ticketId ? { ...t, status: newStatus } : t);
        setTickets(updatedTickets);
        
        if (selectedTicket && selectedTicket._id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status: newStatus });
        }
      } else {
        toast.error(data.message || 'Failed to update ticket');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error updating ticket');
    }
  };

  const handlePriorityChange = async (ticketId, newPriority) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/support-tickets/admin/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ priority: newPriority })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Ticket priority changed to ${newPriority}`);
        
        // Update local tickets state
        const updatedTickets = tickets.map(t => t._id === ticketId ? { ...t, priority: newPriority } : t);
        setTickets(updatedTickets);
        
        if (selectedTicket && selectedTicket._id === ticketId) {
          setSelectedTicket({ ...selectedTicket, priority: newPriority });
        }
      } else {
        toast.error(data.message || 'Failed to update ticket');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error updating ticket');
    }
  };



  const filteredTickets = tickets.filter(ticket => {
    const matchesTab = activeTab === 'All' || ticket.status === activeTab;
    const matchesSearch = 
      ticket.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const openCount = tickets.filter(t => t.status === 'Open').length;
  const progressCount = tickets.filter(t => t.status === 'In-Progress').length;
  const closedCount = tickets.filter(t => t.status === 'Closed').length;

  const StatusBadge = ({ status }) => {
    const styles = {
      'Open': 'bg-red-50 text-red-600 border-red-100',
      'In-Progress': 'bg-blue-50 text-blue-600 border-blue-100',
      'Closed': 'bg-green-50 text-green-600 border-green-100',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[status] || 'bg-slate-100 text-slate-500'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Support Helpdesk</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage customer inquiries, disputes and platform support tickets in real-time.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Unassigned/Open', value: openCount.toString().padStart(2, '0'), icon: Inbox, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'In Progress', value: progressCount.toString().padStart(2, '0'), icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Resolved Tickets', value: closedCount.toString().padStart(2, '0'), icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Total Tickets', value: tickets.length.toString().padStart(2, '0'), icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 animate-in fade-in duration-500" style={{ animationDelay: `${i * 100}ms` }}>
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

      {/* Main Inbox View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticket List (Left Panel) */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-50 space-y-3">
            <div className="flex gap-1">
              {['All', 'Open', 'In-Progress', 'Closed'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search tickets..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-lg py-2.5 pl-10 pr-4 text-[11px] font-bold outline-none" 
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-slate-50">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-350 space-y-2">
                <Clock className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">Loading tickets...</span>
              </div>
            ) : filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <div 
                  key={ticket._id} 
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-5 cursor-pointer transition-all border-l-4 ${
                    selectedTicket && selectedTicket._id === ticket._id 
                      ? 'bg-blue-50/40 border-blue-600' 
                      : 'border-transparent hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-black text-blue-600 font-roboto">{ticket.ticketId}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase">{ticket.date}</span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 font-montserrat truncate uppercase tracking-tight">{ticket.subject}</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">{ticket.userName} • {ticket.category}</p>
                  <div className="mt-3 flex justify-between items-center">
                    <StatusBadge status={ticket.status} />
                    <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider ${
                      ticket.priority === 'High' ? 'bg-red-50 text-red-650' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4 py-20 opacity-60">
                <Inbox size={48} className="opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-center">No tickets found</p>
              </div>
            )}
          </div>
        </div>

        {/* Conversation & Action View (Right Panel) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[600px] relative overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Header Info */}
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white z-10 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md shadow-blue-100">
                    {selectedTicket.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 font-montserrat uppercase tracking-tight">{selectedTicket.userName}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Ticket ID: {selectedTicket.ticketId} • Raised on {selectedTicket.date}
                    </p>
                  </div>
                </div>
                
                {/* Actions: Priority & Status Selectors */}
                <div className="flex items-center gap-3">
                  <div>
                    <select
                      value={selectedTicket.priority}
                      onChange={(e) => handlePriorityChange(selectedTicket._id, e.target.value)}
                      className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    >
                      <option value="Low">Low Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="High">High Priority</option>
                    </select>
                  </div>
                  <div>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handleStatusChange(selectedTicket._id, e.target.value)}
                      className="bg-slate-900 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer"
                    >
                      <option value="Open">Open</option>
                      <option value="In-Progress">In-Progress</option>
                      <option value="Closed">Closed / Resolved</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Ticket Details Panel */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-6 bg-slate-50/30">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-in fade-in duration-300">
                  {/* Meta details */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100/50 text-xs">
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</span>
                      <span className="font-extrabold text-[#02006c] text-sm mt-1 block uppercase">{selectedTicket.category}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Date Raised</span>
                      <span className="font-extrabold text-slate-700 text-sm mt-1 block">{selectedTicket.date}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority Status</span>
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider mt-1.5 ${
                        selectedTicket.priority === 'High' ? 'bg-red-50 text-red-655' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedTicket.priority} Priority
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Ticket Status</span>
                      <div className="mt-1">
                        <StatusBadge status={selectedTicket.status} />
                      </div>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Issue Subject</span>
                    <p className="text-base font-black text-slate-900 uppercase tracking-tight leading-snug">{selectedTicket.subject}</p>
                  </div>

                  {/* Description */}
                  <div className="space-y-2 pt-4 border-t border-slate-50">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Detailed Description</span>
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/50 text-slate-700 font-medium text-xs leading-relaxed whitespace-pre-line">
                      {selectedTicket.description}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4 py-20 opacity-60">
              <HelpIcon size={56} className="opacity-25" />
              <p className="text-xs font-black uppercase tracking-widest text-center">Select a ticket to view conversation</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Tickets;
