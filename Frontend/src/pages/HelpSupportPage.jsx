import React, { useState, useEffect } from 'react';
import { ChevronLeft, PhoneCall, Mail, MessageSquare, Clock, ChevronDown, Send, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from '../utils/toast';

export default function HelpSupportPage() {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [supportEmail, setSupportEmail] = useState('support@aramish.com');
  const [supportPhone, setSupportPhone] = useState('+1 (800) 123-4567');

  // Ticket Form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fallbackFaqs = [
    {
      question: "How do I track my order?",
      answer: "You can track your order by going to the 'Orders' section in your profile and clicking on the 'Track Order' button next to your recent purchase."
    },
    {
      question: "What is your return policy?",
      answer: "We offer a 30-day hassle-free return policy. If you're not satisfied with your purchase, you can return it within 30 days of delivery for a full refund."
    },
    {
      question: "How do I use Aramish Coins?",
      answer: "Aramish Coins can be applied at checkout. 100 Aramish Coins equals $1. You can select the option to 'Use Aramish Coins' during the payment process."
    },
    {
      question: "Can I change my shipping address?",
      answer: "You can update your shipping address in the 'Saved Addresses' section of your Account Information. For active orders, please contact support immediately."
    }
  ];

  const fetchMyTickets = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/support-tickets/my-tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyTickets(data.tickets);
      }
    } catch (err) {
      console.error("Error fetching user tickets:", err);
    }
  };

  useEffect(() => {
    const fetchFaqsAndSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/content/qna`);
        const data = await res.json();
        if (data.success && data.qnas && data.qnas.length > 0) {
          setFaqs(data.qnas);
        } else {
          setFaqs(fallbackFaqs);
        }
      } catch (err) {
        console.error("Error fetching FAQs:", err);
        setFaqs(fallbackFaqs);
      }

      try {
        const resSettings = await fetch(`${API_BASE}/admin/settings`);
        const dataSettings = await resSettings.json();
        if (dataSettings.success && dataSettings.settings) {
          if (dataSettings.settings.supportEmail) {
            setSupportEmail(dataSettings.settings.supportEmail);
          }
          if (dataSettings.settings.helpline) {
            setSupportPhone(dataSettings.settings.helpline);
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    
    fetchFaqsAndSettings();
    fetchMyTickets();
  }, []);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('userToken');
    if (!token) {
      toast.info('Please login first to submit a ticket.');
      return;
    }
    if (!subject.trim() || !description.trim()) {
      toast.info('Please fill in all ticket details.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/support-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subject, category, description })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Support ticket raised successfully!');
        setSubject('');
        setDescription('');
        setCategory('General');
        fetchMyTickets();
      } else {
        toast.error(data.message || 'Failed to raise ticket');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error connecting to server');
    } finally {
      setSubmitting(false);
    }
  };

  const isUserLoggedIn = !!localStorage.getItem('userToken');

  return (
    <div className="bg-surface min-h-screen font-sans pb-20 select-none">
      {/* Header (Mobile Only) */}
      <div className="bg-surface px-4 py-4 shadow-sm z-50 sticky top-0 flex items-center gap-3 md:hidden">
        <button 
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-slate-55 flex items-center justify-center text-[#02006c] hover:bg-surface active:scale-95 transition-all cursor-pointer shadow-sm flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[#02006c] text-[20px] font-black tracking-tight">Support Helpdesk</h1>
      </div>

      {/* Main Content Wrapper */}
      <div className="max-w-5xl mx-auto w-full px-0 md:px-6 py-4 md:py-8 space-y-6">
        
        <div className="hidden md:flex justify-between items-center border-b border-white/10 pb-3">
          <h2 className="text-xl font-black text-[#02006c] uppercase tracking-wide">
            Support Helpdesk & FAQs
          </h2>
          <button 
            onClick={() => navigate(-1)}
            className="px-3.5 py-1.5 bg-surface hover:bg-surface border border-white/10 rounded-lg text-slate-650 text-xs font-bold transition-all shadow-3xs cursor-pointer"
          >
            Go Back
          </button>
        </div>

        {/* Intro Banner */}
        <div className="bg-gradient-to-br from-orange-50 to-[#FFE4D6] rounded-2xl p-5 border border-gold/20 shadow-3xs relative overflow-hidden mx-3 md:mx-0">
          <div className="relative z-10">
            <h2 className="text-[#02006c] font-black text-lg mb-1">How can we help?</h2>
            <p className="text-slate-600 text-xs font-bold max-w-[80%]">Raise a support ticket for order, payment or technical issues, or get in touch with our support crew directly.</p>
          </div>
          <MessageSquare className="absolute -bottom-4 -right-4 w-24 h-24 text-orange-200/50 rotate-12" />
        </div>

        {/* Side-by-Side Content on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start px-3 md:px-0">
          
          {/* Left Side: Raise Support Ticket Form (Spans 7 cols on desktop) */}
          <div className="md:col-span-7 bg-surface p-5 rounded-2xl border border-white/10 shadow-3xs space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <FileText className="w-5 h-5 text-[#0B132B]" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Raise a Support Ticket</h3>
            </div>

            {isUserLoggedIn ? (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-slate-705 outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="General">General / Other Queries</option>
                    <option value="Payments">Payments & Wallet</option>
                    <option value="Returns">Returns & Exchanges</option>
                    <option value="Refunds">Refund Status</option>
                    <option value="Technical">App Technical Issue</option>
                    <option value="Promotions">Promotions & Coupons</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject</label>
                  <input 
                    type="text"
                    placeholder="Summarize your issue..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Detailed Description</label>
                  <textarea 
                    rows="4"
                    placeholder="Provide full description of the problem..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none focus:border-orange-500 transition-all resize-none"
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-[#0B132B] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-100 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Raising Ticket...' : 'Submit Support Ticket'}
                </button>
              </form>
            ) : (
              <div className="py-6 text-center space-y-3">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Please log in to raise support tickets online.</p>
                <button 
                  onClick={() => navigate('/login')} 
                  className="px-6 py-2.5 bg-[#02006c] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#02006c]/90 transition-all cursor-pointer"
                >
                  Go to Login
                </button>
              </div>
            )}
          </div>

          {/* Right Side: Direct Assistance channels (Spans 5 cols on desktop) */}
          <div className="md:col-span-5 space-y-5">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Direct Assistance</h3>
            
            <a href={`tel:${supportPhone}`} className="flex items-center gap-4 bg-surface p-4 rounded-2xl shadow-3xs border border-white/10 hover:border-[#0B132B] hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#02006c]">Call Helpline</h4>
                <p className="text-xs text-slate-550 font-bold mt-0.5 truncate">{supportPhone}</p>
              </div>
              <div className="px-3 py-1 bg-surface rounded-full text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 24/7
              </div>
            </a>

            <a href={`mailto:${supportEmail}`} className="flex items-center gap-4 bg-surface p-4 rounded-2xl shadow-3xs border border-white/10 hover:border-[#0B132B] hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#02006c]">Email Us</h4>
                <p className="text-xs text-slate-550 font-bold mt-0.5 truncate">{supportEmail}</p>
              </div>
              <div className="px-3 py-1 bg-surface rounded-full text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Fast
              </div>
            </a>
          </div>

        </div>

        {/* Bottom Section: Active tickets & FAQ list (Spans full width) */}
        <div className="grid grid-cols-1 gap-6 px-3 md:px-0">
          
          {/* User's Current Tickets Log */}
          {isUserLoggedIn && myTickets.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">My Active Tickets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myTickets.map((ticket) => (
                  <div 
                    key={ticket._id} 
                    onClick={() => setSelectedTicket(ticket)}
                    className="bg-surface p-4 rounded-2xl border border-white/10 shadow-3xs flex items-start justify-between gap-3 cursor-pointer hover:border-orange-500 hover:shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black text-blue-600 font-roboto">{ticket.ticketId}</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase">{new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          ticket.priority === 'High' ? 'bg-red-50 text-red-650' : 'bg-surface text-slate-500'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">{ticket.subject}</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 line-clamp-2">{ticket.description}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider border ${
                      ticket.status === 'Open' ? 'bg-red-50 text-red-600 border-red-100' :
                      ticket.status === 'In-Progress' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQs Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Frequently Asked Questions</h3>
            
            <div className="bg-surface rounded-2xl shadow-3xs border border-white/10 overflow-hidden">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className={`border-b border-white/10 last:border-0 ${
                    openFaqIndex === index ? 'bg-gold/10' : 'hover:bg-surface'
                  } transition-colors`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className={`text-xs md:text-sm font-black ${openFaqIndex === index ? 'text-[#0B132B]' : 'text-[#02006c]'}`}>
                      {faq.question}
                    </span>
                    <ChevronDown 
                      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ${
                        openFaqIndex === index ? 'rotate-180 text-[#0B132B]' : ''
                      }`}
                    />
                  </button>
                  
                  {/* Expandable Answer */}
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openFaqIndex === index ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="px-5 pb-4 text-xs text-slate-500 font-semibold leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

        {/* Ticket Details Modal Overlay */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
            <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4 border border-white/10 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div>
                  <span className="text-[10px] font-black text-blue-600 font-roboto">{selectedTicket.ticketId}</span>
                  <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide mt-0.5">Ticket Details</h3>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-surface active:scale-90 transition-all cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-surface p-4 rounded-xl border border-white/10">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider border mt-1 ${
                      selectedTicket.status === 'Open' ? 'bg-red-50 text-red-600 border-red-100' :
                      selectedTicket.status === 'In-Progress' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'
                    }`}>
                      {selectedTicket.status}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Priority</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider mt-1 ${
                      selectedTicket.priority === 'High' ? 'bg-red-50 text-red-650' : 'bg-slate-150 text-slate-500'
                    }`}>
                      {selectedTicket.priority} Priority
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Category</span>
                    <span className="font-bold text-[#02006c] mt-1 block uppercase">{selectedTicket.category}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Date Raised</span>
                    <span className="font-bold text-slate-700 mt-1 block">
                      {new Date(selectedTicket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Subject</span>
                  <p className="font-black text-slate-800 text-sm leading-tight uppercase">{selectedTicket.subject}</p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Description</span>
                  <p className="text-slate-600 font-medium leading-relaxed bg-surface p-4 rounded-xl border border-white/10 whitespace-pre-line text-[11px]">{selectedTicket.description}</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedTicket(null)}
                className="w-full py-3 bg-[#02006c] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#02006c]/90 transition-all active:scale-95 cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </div>
  );
}
