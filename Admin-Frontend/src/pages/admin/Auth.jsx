import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/admin/auth`;

const Auth = () => {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null); // 'privacy' | 'terms' | null
  const [modalContent, setModalContent] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const navigate = useNavigate();

  const openModal = async (type) => {
    setModalType(type);
    setModalLoading(true);
    setModalContent('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/content/legal`);
      const data = await res.json();
      if (res.ok && data.success) {
        setModalContent(type === 'privacy' ? (data.privacy || 'Privacy Policy has not been published yet.') : (data.terms || 'Terms & Conditions have not been published yet.'));
      } else {
        setModalContent('Failed to load policy content from the server.');
      }
    } catch (err) {
      console.error(err);
      setModalContent('Failed to connect to server to fetch policy.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Login failed');
        setLoading(false);
        return;
      }

      // Store token and admin info in localStorage
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminInfo', JSON.stringify(data.admin));

      navigate('/admin/dashboard');
    } catch (err) {
      setError('Unable to connect to the server. Please check if the backend is running.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 font-nunito relative">
      <div className="w-full max-w-lg">
        {/* Admin Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-5">
            <img 
              src="/aramish-logo.png" 
              alt="Aramish Logo" 
              className="h-16 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="hidden w-16 h-16 bg-blue-600 rounded-xl items-center justify-center shadow-lg shadow-blue-100">
               <ShieldCheck size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">
            Aramish<span className="text-[#0B132B]">.</span> Admin
          </h1>
          <p className="text-slate-600 font-black uppercase tracking-[2px] text-[11px] mt-1.5">Verified Management Session</p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-100 p-10 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-500 text-xs font-bold p-4 rounded-xl text-center uppercase tracking-widest animate-pulse">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-1">Admin Email</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-14 pr-6 text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-1">Secure Password</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-14 pr-14 text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all text-base"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>



            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs uppercase tracking-[2px] py-4.5 rounded-xl shadow-lg shadow-blue-100 active:scale-[0.98] transition-all mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <button className="hover:text-blue-500 transition-colors">Recover Access</button>
            <span>v2.4.0-Stable</span>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs font-bold mt-8 uppercase tracking-widest">
          Not an admin? <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">Back to Storefront</button>
        </p>
      </div>

      {/* Policy Modal Overlay */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] max-w-2xl w-full max-h-[80vh] flex flex-col border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-montserrat uppercase tracking-tight">
                {modalType === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
              </h3>
              <button 
                type="button"
                onClick={() => setModalType(null)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-950 transition-all font-bold"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Policy Content...</span>
                </div>
              ) : (
                modalContent
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-50 flex justify-end">
              <button 
                type="button"
                onClick={() => {
                  setModalType(null);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] uppercase tracking-[1.5px] px-6 py-3 rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
