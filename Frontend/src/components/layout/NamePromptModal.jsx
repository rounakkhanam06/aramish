import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import toast from '../../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function NamePromptModal() {
  const { user, setUser } = useApp();
  const location = useLocation();

  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('name_prompt_dismissed') === 'true';
  });

  const isLoginPage = location.pathname.toLowerCase().startsWith('/login');

  // Determine if name is missing
  const isNameMissing = Boolean(
    user &&
    user.id &&
    (!user.name ||
      user.name.trim() === '' ||
      user.name.trim().toLowerCase() === 'user' ||
      user.name.trim().toLowerCase() === 'new user')
  );

  const shouldShow = !isLoginPage && isNameMissing && !isDismissed;

  // Lock body scroll when modal is active
  useEffect(() => {
    if (shouldShow) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      setError('Please enter your name');
      return;
    }
    if (cleanName.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: cleanName })
      });

      const data = await res.json();
      if (data.success) {
        // Update user state in AppContext
        if (setUser) {
          setUser(prev => ({
            ...prev,
            name: cleanName
          }));
        }

        // Update userInfo in localStorage
        try {
          const raw = localStorage.getItem('userInfo');
          const parsed = raw ? JSON.parse(raw) : {};
          parsed.name = cleanName;
          localStorage.setItem('userInfo', JSON.stringify(parsed));
        } catch { /* ignore */ }

        toast.success(`Welcome to Aramish, ${cleanName}! ✨`);
      } else {
        setError(data.message || 'Failed to update name');
      }
    } catch (err) {
      console.error('Error saving name:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    sessionStorage.setItem('name_prompt_dismissed', 'true');
    setIsDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-scale-in"
      >
        {/* Decorative Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-400 to-[#1A2542] flex items-center justify-center text-white shadow-lg shadow-orange-500/20 mb-4">
          <Sparkles className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-black text-[#02006c] nunito-heading">
          Welcome to Aramish!
        </h2>
        <p className="text-xs text-slate-500 font-semibold mt-1.5 leading-relaxed px-2">
          What should we call you? Enter your name so your orders and referrals display your identity.
        </p>

        <form onSubmit={handleSubmit} className="w-full mt-5 space-y-3">
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-syne font-black text-slate-700 uppercase tracking-widest block">
              Your Full Name
            </label>
            <div className="flex items-center gap-2 border-2 border-slate-200 focus-within:border-[#0B132B] rounded-xl px-3.5 py-2.5 transition-colors bg-slate-50/50">
              <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="e.g. Rahul Sharma"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setError('');
                }}
                maxLength={50}
                className="w-full bg-transparent text-sm font-bold text-[#02006c] outline-none placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            {error && (
              <p className="text-[10px] font-bold text-rose-500 pt-0.5 px-1">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-400 to-[#1A2542] hover:scale-[1.01] active:scale-95 disabled:opacity-60 text-white text-[11px] font-black py-3 rounded-xl tracking-wider shadow-md transition-all cursor-pointer uppercase flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <>Save &amp; Continue <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors pt-1 cursor-pointer"
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
