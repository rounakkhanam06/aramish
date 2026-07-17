import React, { useState, useEffect } from 'react';
import { FileText, Save, RotateCcw, AlertCircle, CheckCircle2, Edit3, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const LegalPolicies = () => {
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' or 'terms'
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [termsConditions, setTermsConditions] = useState('');

  // Keep original copies to discard changes correctly
  const [originalPrivacy, setOriginalPrivacy] = useState('');
  const [originalTerms, setOriginalTerms] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const fetchPolicies = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/content/legal`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPrivacyPolicy(data.privacy || '');
        setTermsConditions(data.terms || '');
        setOriginalPrivacy(data.privacy || '');
        setOriginalTerms(data.terms || '');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load legal policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleSave = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    setIsSaving(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const content = activeTab === 'privacy' ? privacyPolicy : termsConditions;
      const res = await fetch(`${apiBase}/admin/content/legal`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: activeTab,
          content
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (activeTab === 'privacy') {
          setOriginalPrivacy(privacyPolicy);
        } else {
          setOriginalTerms(termsConditions);
        }
        setIsEditing(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        toast.error(data.message || 'Failed to save policy');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setIsEditing(false);
    // Reset to the original fetched data
    setPrivacyPolicy(originalPrivacy);
    setTermsConditions(originalTerms);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Legal & Policies</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your platform's Privacy Policy and Terms of Use</p>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm font-semibold text-slate-400">Loading...</span>
          ) : !isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-100 text-sm font-semibold"
            >
              <Edit3 size={18} />
              <span>Edit Content</span>
            </button>
          ) : (
            <>
              <button 
                onClick={handleDiscard}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all text-sm font-semibold"
              >
                <XCircle size={18} />
                <span>Discard</span>
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-green-100 text-sm font-semibold disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                <span>{isSaving ? 'Saving...' : 'Publish Changes'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-50">
          <button 
            disabled={isEditing || loading}
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-5 text-sm font-bold transition-all relative ${activeTab === 'privacy' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'} ${isEditing || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Privacy Policy
            {activeTab === 'privacy' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button 
            disabled={isEditing || loading}
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-5 text-sm font-bold transition-all relative ${activeTab === 'terms' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'} ${isEditing || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Terms & Conditions
            {activeTab === 'terms' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
        </div>

        <div className="p-8">
          <AnimatePresence>
            {isEditing && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Editor Mode Active</p>
                    <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                      You are currently editing the <strong>{activeTab === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}</strong>. 
                      Remember to save your changes to push them live to the platform.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                {activeTab === 'privacy' ? 'Privacy Policy Content' : 'Terms & Conditions Content'}
              </label>
              {!isEditing && (
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Read-Only Mode</span>
              )}
            </div>
            {loading ? (
              <div className="w-full h-[500px] bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-semibold">
                Loading content...
              </div>
            ) : (
              <textarea
                readOnly={!isEditing}
                value={activeTab === 'privacy' ? privacyPolicy : termsConditions}
                onChange={(e) => activeTab === 'privacy' ? setPrivacyPolicy(e.target.value) : setTermsConditions(e.target.value)}
                className={`w-full h-[500px] border rounded-2xl p-8 text-slate-700 font-medium leading-relaxed transition-all resize-none outline-none ${isEditing 
                  ? 'bg-slate-50 border-blue-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-400' 
                  : 'bg-slate-50/30 border-slate-100 cursor-not-allowed'}`}
                placeholder="Start typing your policy content..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-10 right-10 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[60]"
        >
          <CheckCircle2 className="text-green-400" size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">Changes Published Successfully</span>
        </motion.div>
      )}
    </div>
  );
};

export default LegalPolicies;

