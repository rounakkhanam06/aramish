import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Eye, EyeOff, Lock, Shield, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Password strength calculator
function getStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f97316' };
  if (score <= 3) return { score, label: 'Good', color: '#eab308' };
  if (score <= 4) return { score, label: 'Strong', color: '#22c55e' };
  return { score, label: 'Very Strong', color: '#10b981' };
}

function PasswordInput({ label, value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700 block">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0B132B] focus:ring-2 focus:ring-[#0B132B]/10 transition-all pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const strength = getStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = newPassword && confirmPassword && newPassword !== confirmPassword;

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!user || !user.id) {
      toast.error('Please log in first');
      navigate('/login');
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast.info('Please fill in all required fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.info('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.info('Passwords do not match');
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success(data.message || 'Password updated successfully!');
      } else {
        toast.error(data.message || 'Failed to update password');
      }
    } catch (err) {
      console.error('Change password error:', err);
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col font-sans pb-20">
      {/* Header */}
      <div className="bg-[#fff4f2] px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 text-[#02006c]" />
        </button>
        <h1 className="text-[17px] font-bold text-[#02006c]">Security &amp; Password</h1>
      </div>

      <div className="p-4 space-y-6">

        {/* Change Password Section */}
        <div>
          <h2 className="text-[15px] font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#0B132B]" />
            Change Password
          </h2>

          <form
            onSubmit={handleChangePassword}
            className="bg-surface rounded-xl p-4 shadow-sm border border-white/10 space-y-4"
          >
            {/* Success banner */}
            {success && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] font-semibold px-3 py-2.5 rounded-lg animate-fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Password updated successfully!
              </div>
            )}

            {/* Current Password — only show if user might already have a password */}
            <PasswordInput
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Leave blank if you have no password set"
            />

            {/* New Password */}
            <div className="space-y-2">
              <PasswordInput
                id="new-password"
                label="New Password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
              />
              {/* Strength meter */}
              {newPassword.length > 0 && (
                <div className="space-y-1.5 animate-fade-in">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: i <= strength.score ? strength.color : '#e2e8f0',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <PasswordInput
                id="confirm-password"
                label="Confirm Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
              {passwordsMismatch && (
                <p className="text-[11px] text-rose-500 font-semibold animate-fade-in">
                  Passwords do not match
                </p>
              )}
              {passwordsMatch && (
                <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 animate-fade-in">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Password rules hint */}
            <div className="bg-surface rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Password tips</p>
              {[
                'At least 6 characters long',
                'Mix uppercase and lowercase letters',
                'Include numbers and symbols for strength',
              ].map(tip => (
                <p key={tip} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                  <span className="mt-0.5 text-[#0B132B]">•</span> {tip}
                </p>
              ))}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || passwordsMismatch}
              className="w-full bg-[#02006c] text-white font-bold text-[14px] py-3 rounded-lg mt-2 hover:bg-[#02006c]/90 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>

        {/* Two-Factor Authentication Section */}
        <div>
          <h2 className="text-[15px] font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0B132B]" />
            Two-Factor Authentication
          </h2>
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-white/10 flex items-center justify-between">
            <div className="pr-4">
              <p className="text-[14px] font-bold text-slate-800 mb-0.5">Enable 2FA</p>
              <p className="text-[12px] text-slate-500 leading-tight">Add an extra layer of security to your account.</p>
            </div>
            {/* Custom Toggle Switch */}
            <button
              onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${twoFactorEnabled ? 'bg-[#0B132B]' : 'bg-surface'}`}
            >
              <div className={`absolute top-1 left-1 bg-surface w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ${twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {twoFactorEnabled && (
            <p className="text-[11px] text-slate-400 px-1 mt-1.5 animate-fade-in">
              🔒 2FA is coming soon. You'll be notified when it's available.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
