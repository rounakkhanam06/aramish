import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, HelpCircle, MessageCircle, 
  XCircle, Trash2, Edit2, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../../utils/toast';
import ConfirmModal from '../../../components/ConfirmModal';

const QnAModeration = () => {
  const [qnas, setQnas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);

  // Form State
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  // Confirm Modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  const triggerConfirm = (title, message, action) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const fetchQnAs = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/content/qna`);
      const data = await res.json();
      if (res.ok && data.success) {
        setQnas(data.qnas || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQnAs();
  }, []);

  const handleSaveFaq = async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.info('Please enter both question and answer.');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const url = editingFaq 
        ? `${apiBase}/admin/content/qna/${editingFaq._id}`
        : `${apiBase}/admin/content/qna`;
      const method = editingFaq ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question, answer })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editingFaq ? 'FAQ updated successfully' : 'FAQ published successfully');
        setIsAdding(false);
        setEditingFaq(null);
        setQuestion('');
        setAnswer('');
        fetchQnAs();
      } else {
        toast.error(data.message || 'Failed to save FAQ');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleDeleteFaq = (id) => {
    triggerConfirm(
      'Delete FAQ',
      'Are you sure you want to permanently delete this FAQ?',
      async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/admin/content/qna/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            toast.success('FAQ deleted successfully');
            fetchQnAs();
          } else {
            toast.error(data.message || 'Failed to delete FAQ');
          }
        } catch (err) {
          console.error(err);
          toast.error('Could not connect to backend server');
        }
      }
    );
  };

  const filteredFaqs = qnas.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">FAQs</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Directly create and manage Frequently Asked Questions (FAQs).</p>
        </div>
        <button 
          onClick={() => {
            setEditingFaq(null);
            setQuestion('');
            setAnswer('');
            setIsAdding(true);
          }}
          className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={14} />
          Create FAQ
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search FAQs by question or answer..." 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* FAQ Cards List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              Loading FAQs...
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              No FAQs found. Click "Create FAQ" to add one.
            </div>
          ) : (
            filteredFaqs.map((item) => (
              <motion.div 
                key={item._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start gap-6">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                     <HelpCircle size={24} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="text-base font-bold text-slate-900 leading-relaxed">
                          {item.question}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button 
                          onClick={() => {
                            setEditingFaq(item);
                            setQuestion(item.question);
                            setAnswer(item.answer);
                            setIsAdding(true);
                          }}
                          className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all"
                          title="Edit FAQ"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteFaq(item._id)}
                          className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
                          title="Delete FAQ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <MessageCircle size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Answer</p>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Drawer Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-md bg-white h-[calc(100vh-2rem)] rounded-[32px] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-slate-900 font-montserrat uppercase">
                  {editingFaq ? 'Edit FAQ' : 'Create FAQ'}
                </h2>
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingFaq(null);
                    setQuestion('');
                    setAnswer('');
                  }} 
                  className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveFaq} className="flex-1 flex flex-col justify-between min-h-0">
                <div className="space-y-6 overflow-y-auto no-scrollbar pb-6 flex-1 pr-1">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Question</label>
                    <textarea 
                      placeholder="e.g. How can I track my shipment?" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-medium focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none" 
                      rows={3}
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Answer</label>
                    <textarea 
                      placeholder="e.g. You can track your shipment using the link sent in the confirmation email." 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-medium focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none" 
                      rows={6}
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAdding(false);
                      setEditingFaq(null);
                      setQuestion('');
                      setAnswer('');
                    }} 
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
                  >
                    {editingFaq ? 'Save Changes' : 'Publish FAQ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction}
        title={confirmTitle}
        message={confirmMessage}
      />
    </div>
  );
};

export default QnAModeration;
