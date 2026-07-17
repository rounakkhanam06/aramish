import React, { useState, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Edit2, Loader2 } from 'lucide-react';
import toast from '../utils/toast';
import analytics from '../utils/analytics';


const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth`;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  // Phone + OTP states
  const [phoneNumber, setPhoneNumber] = useState(() => {
    return sessionStorage.getItem('tempLoginPhone') || '';
  });
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // 6-digit OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = [
    useRef(null), useRef(null), useRef(null),
    useRef(null), useRef(null), useRef(null)
  ];

  const [signInError, setSignInError] = useState('');
  const [signInSuccess, setSignInSuccess] = useState('');

  // Autofocus the first digit input when OTP screen is loaded
  React.useEffect(() => {
    if (otpSent) {
      setTimeout(() => {
        otpRefs[0].current?.focus();
      }, 100);
    }
  }, [otpSent]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setSignInError('Please enter a valid 10-digit phone number');
      toast.info('Please enter a valid 10-digit phone number');
      return;
    }

    setSignInError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'Failed to send OTP';
        setSignInError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      setOtpSent(true);
      const successMsg = data.isNewUser
        ? '✨ New account created! Enter the OTP.'
        : '📱 OTP sent successfully!';
      setSignInSuccess(successMsg);
      toast.success(successMsg);
    } catch (err) {
      console.error(err);
      const errorMsg = 'Could not connect to server. Is backend running?';
      setSignInError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setSignInError('');

    // Move to next input if value is entered
    if (value !== '' && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleVerifyOtpAndLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    const fullOtp = otp.join('');

    if (fullOtp.length < 6) {
      setSignInError('Please enter the complete 6-digit OTP');
      toast.info('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setSignInError('');

    try {
      const res = await fetch(`${API_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, otp: fullOtp, referralCode: refCode })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'OTP verification failed';
        setSignInError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Store token and user info
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userInfo', JSON.stringify(data.user));
      localStorage.setItem('isLoggedIn', 'true');
      sessionStorage.removeItem('tempLoginPhone');

      // Track analytics signup/login
      if (data.isNewUser) {
        analytics.track('signup', 'auth', { method: 'phone' });
      } else {
        analytics.track('login', 'auth', { method: 'phone' });
      }

      // Update app context
      if (setUser) {
        setUser({
          id: data.user._id || data.user.id || null,
          name: data.user.name || null,
          phone: `+91 ${phoneNumber}`,
          email: data.user.email || null,
          gender: data.user.gender || null,
          dob: data.user.dob || null,
          joined: `Member since ${new Date(data.user.joinedAt).toLocaleString('default', { month: 'long', year: 'numeric' })}`
        });
      }

      toast.success(data.message || 'Login successful!');
      navigate('/');
    } catch (err) {
      console.error(err);
      const errorMsg = 'Could not connect to server. Is backend running?';
      setSignInError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp(['', '', '', '', '', '']);
    setSignInError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber })
      });
      const data = await res.json();
      setSignInSuccess(data.success ? '📱 New OTP sent!' : 'Failed to resend OTP');
    } catch {
      setSignInError('Server error. Try again.');
    } finally {
      setLoading(false);
      otpRefs[0].current?.focus();
    }
  };

  // SVG Leaf Overlay background
  const renderLeafOverlay = () => (
    <div className="absolute inset-0 opacity-15 pointer-events-none select-none z-0">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M10,20 Q20,5 40,20 Q60,35 45,60 Q30,85 10,20 Z" fill="rgba(255,255,255,0.3)" />
        <path d="M75,10 Q90,5 95,25 Q100,45 85,55 Q70,65 75,10 Z" fill="rgba(255,255,255,0.3)" />
        <path d="M5,70 Q25,65 30,80 Q35,95 15,98 Q-5,100 5,70 Z" fill="rgba(255,255,255,0.3)" />
        <path d="M80,75 Q95,70 98,85 Q100,100 85,98 Q70,95 80,75 Z" fill="rgba(255,255,255,0.3)" />
      </svg>
    </div>
  );



  return (
    <div className="h-[100dvh] w-full md:max-w-md md:mx-auto flex flex-col justify-between overflow-hidden relative bg-[#F8F9FD] md:shadow-2xl md:border-x md:border-white/10">

      {/* Curved Orange top banner */}
      <div className="relative h-[28%] bg-gradient-to-br from-orange-300 via-orange-400 to-[#1A2542] flex flex-col items-center justify-center pt-4">
        {renderLeafOverlay()}

        {/* Back to Home or Back to Phone Input */}
        <button
          onClick={() => {
            if (otpSent) {
              setOtpSent(false);
              setOtp(['', '', '', '', '', '']);
              setSignInError('');
              setSignInSuccess('');
            } else {
              navigate('/');
            }
          }}
          className="absolute top-6 left-4 w-9 h-9 bg-surface/20 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-all z-20 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Logo Container */}
        <div className="relative z-10 h-28 flex items-center justify-center mb-2 animate-fade-in drop-shadow-xl">
          <img
            src="/aramish-logo.png"
            alt="Aramish Logo"
            className="h-full w-auto object-contain drop-shadow-lg"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* Curved wave transition */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-12 fill-[#F8F9FD] pointer-events-none translate-y-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,192L80,181.3C160,171,320,149,480,165.3C640,181,800,235,960,240C1120,245,1280,203,1360,181.3L1440,160L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
        </svg>
      </div>

      {/* Main Content Area */}
      <div className="bg-[#F8F9FD] px-8 pb-16 pt-4 flex-grow flex flex-col justify-start z-10 space-y-6">

        {!otpSent ? (
          /* ================================ */
          /* PHONE NUMBER INPUT SCREEN        */
          /* ================================ */
          <div className="space-y-6 animate-fade-in">
            {/* Form Header */}
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[#02006c]">Sign In / Register</h2>
              <p className="text-[10px] text-slate-500 font-bold">Sign in to your Registered Account</p>
              <div className="w-6 h-0.75 bg-[#0B132B] rounded-full mt-1.5"></div>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4 pt-2">
              <div className="space-y-1 text-left">
                <label className="text-sm font-syne font-black text-slate-700 uppercase tracking-widest">Phone Number</label>
                <div className="flex gap-2 border-b-2 border-white/10 focus-within:border-[#0B132B] transition-colors py-2">
                  <span className="text-lg text-[#02006c] font-black pr-2 border-r-2 border-white/10 flex items-center select-none">+91</span>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit number"
                    value={phoneNumber}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhoneNumber(cleaned);
                      sessionStorage.setItem('tempLoginPhone', cleaned);
                      setSignInError('');
                    }}
                    className="w-full text-lg text-[#02006c] font-bold outline-none placeholder-slate-300 bg-transparent"
                  />
                </div>
              </div>

              {signInError && (
                <p className="text-[9px] text-rose-500 font-extrabold px-1 pt-1">{signInError}</p>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-400 to-[#1A2542] hover:scale-[1.01] active:scale-95 disabled:opacity-60 text-white text-[10px] font-black py-3.5 rounded-full tracking-wider shadow-md shadow-gold/10 transition-all cursor-pointer text-center uppercase flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : 'Send OTP'}
                </button>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500 font-bold leading-relaxed max-w-xs mx-auto">
                By continuing, you agree to our{' '}
                <Link to="/privacy" className="text-[#1A2542] hover:underline">Privacy Policy</Link>
                {' '}and{' '}
                <Link to="/terms" className="text-[#1A2542] hover:underline">Terms & Conditions</Link>.
              </div>
            </form>
          </div>
        ) : (
          /* ================================ */
          /* OTP VERIFICATION SCREEN (6-digit)*/
          /* ================================ */
          <div className="space-y-6 animate-fade-in">
            {/* Form Header */}
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[#02006c]">Verify OTP</h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-500 font-bold">Code sent to +91 {phoneNumber}</p>
                <button
                  onClick={() => {
                    setOtpSent(false);
                    setOtp(['', '', '', '', '', '']);
                    setSignInError('');
                  }}
                  className="p-1 rounded-full bg-surface hover:bg-surface transition-colors text-slate-500"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
              <div className="w-6 h-0.75 bg-[#0B132B] rounded-full mt-1.5"></div>
            </div>

            <form onSubmit={handleVerifyOtpAndLogin} className="flex flex-col gap-2 pt-4">
              <div className="space-y-3 text-left">
                <label className="text-sm font-syne font-black text-slate-700 uppercase tracking-widest text-center block">
                  Enter 6-Digit OTP
                </label>

                {/* 6 Box OTP Input */}
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={otpRefs[index]}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-10 h-13 rounded-xl border-2 border-white/10 bg-surface text-center text-xl font-black text-[#02006c] focus:border-[#0B132B] focus:ring-2 focus:ring-orange-100 outline-none transition-all shadow-sm"
                      style={{ height: '52px' }}
                    />
                  ))}
                </div>
              </div>

              {signInError && (
                <p className="text-[9px] text-rose-500 font-extrabold text-center px-1 pt-2">{signInError}</p>
              )}

              {signInSuccess && !signInError && (
                <p className="text-[9px] text-emerald-600 font-extrabold text-center px-1 pt-2">{signInSuccess}</p>
              )}

              <div className="mt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-400 to-[#1A2542] hover:scale-[1.01] active:scale-95 disabled:opacity-60 text-white text-[10px] font-black py-3.5 rounded-full tracking-wider shadow-md shadow-gold/10 transition-all cursor-pointer text-center uppercase flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying...</> : 'Verify & Sign In'}
                </button>
              </div>

              <div className="text-center mt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-[10px] font-extrabold text-[#1A2542] hover:underline cursor-pointer tracking-wide disabled:opacity-50"
                >
                  Resend Verification Code?
                </button>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-400 font-bold leading-relaxed max-w-xs mx-auto">
                By continuing, you agree to our{' '}
                <Link to="/privacy" className="text-[#1A2542] hover:underline">Privacy Policy</Link>
                {' '}and{' '}
                <Link to="/terms" className="text-[#1A2542] hover:underline">Terms & Conditions</Link>.
              </div>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
