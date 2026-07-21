import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';
import avtarImage from '../assets/AvatarProfile-removebg-preview.webp';
import { 
  ChevronLeft, User, Lock, Settings, Phone, LogOut, Camera, 
  ChevronRight, Coins, Gift, ShoppingBag, Sparkles, X,
  CreditCard, Globe, Bell, Headphones, Store, FileText, HelpCircle,
  Heart, Package, Edit2, MapPin, Truck, RotateCcw, ShieldCheck, Tag, Trash2, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CRAZY_DEALS, VALUE_PROPS } from '../data/mockData';
import OptimizedImage from '../components/ui/OptimizedImage';
import sneakerHero from '../assets/new_sneaker.png';

// Dynamic SVG Avatar Component
function DynamicAvatar({ config, size = "w-20 h-20" }) {
  if (!config) return null;
  const { skinTone, hairStyle, hairColor, outfitColor, accessory } = config;

  return (
    <svg viewBox="0 0 100 100" className={`${size} rounded-full shadow-inner bg-surface`} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#F8FAFC" />

      {/* Back Hair */}
      {hairStyle === 'crop' && (
        <circle cx="50" cy="18" r="15" fill={hairColor} />
      )}
      {hairStyle === 'long' && (
        <path d="M 25 40 L 25 80 C 25 90 40 95 50 95 C 60 95 75 90 75 80 L 75 40 Z" fill={hairColor} />
      )}
      {hairStyle === 'curly' && (
        <path d="M 20 40 Q 15 60 25 70 Q 50 80 75 70 Q 85 60 80 40 Z" fill={hairColor} />
      )}

      {/* Neck */}
      <path d="M 42 65 L 42 85 L 58 85 L 58 65 Z" fill={skinTone} />
      
      {/* Outfit */}
      <path d="M 20 100 C 20 80 35 75 50 75 C 65 75 80 80 80 100 Z" fill={outfitColor} />
      <path d="M 38 75 C 45 82 55 82 62 75" fill="none" stroke="#E2E8F0" strokeWidth="2" />

      {/* Face Base */}
      <ellipse cx="50" cy="48" rx="22" ry="25" fill={skinTone} />
      
      {/* Ears */}
      <ellipse cx="27" cy="48" rx="3.5" ry="5.5" fill={skinTone} />
      <ellipse cx="73" cy="48" rx="3.5" ry="5.5" fill={skinTone} />

      {/* Eyes */}
      <circle cx="39" cy="45" r="5" fill="#FFFFFF" />
      <circle cx="39" cy="45" r="3.5" fill="#4A2F1D" />
      <circle cx="39" cy="45" r="1.5" fill="#000000" />
      <circle cx="37.5" cy="43.5" r="1.2" fill="#FFFFFF" />

      <circle cx="61" cy="45" r="5" fill="#FFFFFF" />
      <circle cx="61" cy="45" r="3.5" fill="#4A2F1D" />
      <circle cx="61" cy="45" r="1.5" fill="#000000" />
      <circle cx="62.5" cy="43.5" r="1.2" fill="#FFFFFF" />

      {/* Eyelashes / Eyebrows */}
      <path d="M 33 42 Q 39 37 45 42" fill="none" stroke="#2B1A10" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 55 42 Q 61 37 67 42" fill="none" stroke="#2B1A10" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 34 38 Q 39 36 44 38" fill="none" stroke={hairColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M 56 38 Q 61 36 66 38" fill="none" stroke={hairColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />

      {/* Cheek blush */}
      <ellipse cx="34" cy="52" rx="4" ry="2.5" fill="#FF8A8A" opacity="0.4" />
      <ellipse cx="66" cy="52" rx="4" ry="2.5" fill="#FF8A8A" opacity="0.4" />

      {/* Nose */}
      <path d="M 49 53 Q 50 55 51 53" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Mouth */}
      <path d="M 43 59 Q 50 64 57 59 Q 50 62 43 59 Z" fill="#FFFFFF" stroke="#D67575" strokeWidth="0.8" />

      {/* Front Hair */}
      {hairStyle === 'crop' && (
        <g fill={hairColor}>
          <path d="M 27 45 C 25 30 35 15 50 15 C 65 15 75 30 73 45 C 73 35 65 22 50 22 C 35 22 27 35 27 45 Z" />
          <path d="M 27 40 C 35 25 45 25 55 32 C 45 28 35 32 27 40 Z" />
          <path d="M 73 40 C 65 25 55 25 45 32 C 55 28 65 32 73 40 Z" />
          <path d="M 27 40 Q 22 55 25 65 Q 26 55 29 45 Z" />
          <path d="M 73 40 Q 78 55 75 65 Q 74 55 71 45 Z" />
        </g>
      )}
      {hairStyle === 'long' && (
        <g fill={hairColor}>
          <path d="M 27 45 C 25 30 35 15 50 15 C 65 15 75 30 73 45 C 73 35 65 22 50 22 C 35 22 27 35 27 45 Z" />
          <path d="M 27 40 Q 30 20 50 30 Q 40 25 27 40 Z" />
          <path d="M 73 40 Q 70 20 50 30 Q 60 25 73 40 Z" />
        </g>
      )}
      {hairStyle === 'curly' && (
        <g fill={hairColor}>
          <circle cx="35" cy="22" r="10" />
          <circle cx="50" cy="16" r="12" />
          <circle cx="65" cy="22" r="10" />
          <circle cx="27" cy="32" r="9" />
          <circle cx="73" cy="32" r="9" />
        </g>
      )}
      {hairStyle === 'spiky' && (
        <g fill={hairColor}>
          <path d="M 26 40 L 32 20 L 40 28 L 50 12 L 60 28 L 68 20 L 74 40 C 65 30 35 30 26 40 Z" />
        </g>
      )}

      {/* Accessories */}
      {accessory === 'glasses' && (
        <g stroke="#1E293B" strokeWidth="2.5" fill="none">
          <circle cx="39" cy="45" r="9" />
          <circle cx="61" cy="45" r="9" />
          <line x1="48" y1="45" x2="52" y2="45" />
          <line x1="30" y1="43" x2="25" y2="40" />
          <line x1="70" y1="43" x2="75" y2="40" />
        </g>
      )}
      {accessory === 'headphones' && (
        <g>
          <path d="M 24 45 A 28 28 0 0 1 76 45" stroke="#02006c" strokeWidth="4.5" fill="none" />
          <rect x="16" y="38" width="8" height="18" rx="4" fill="#02006c" />
          <rect x="76" y="38" width="8" height="18" rx="4" fill="#02006c" />
        </g>
      )}
      {accessory === 'crown' && (
        <path d="M 33 22 L 38 6 L 50 15 L 62 6 L 67 22 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
      )}
    </svg>
  );
}

export default function ProfilePage() {
  const { coins, user, setUser, logout } = useApp();
  const navigate = useNavigate();

  // Load avatar config from sessionStorage
  const [avatarConfig, setAvatarConfig] = useState(() => {
    const saved = sessionStorage.getItem('userAvatar');
    return saved ? JSON.parse(saved) : {
      skinTone: "#FFDBB5",
      hairStyle: "crop",
      hairColor: "#3E2723",
      outfitColor: "#F8FAFC",
      accessory: "none"
    };
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [infoModalType, setInfoModalType] = useState(null); // 'terms', 'faq', or null
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [showWalletBalance, setShowWalletBalance] = useState(false);
  const [modalStep, setModalStep] = useState(0); // 0 = Welcome onboarding, 1 = Creator editor
  const [tempConfig, setTempConfig] = useState({ ...avatarConfig });
  const [newName, setNewName] = useState(user?.name || '');

  useEffect(() => {
    if (user?.name && infoModalType !== 'editProfile') {
      setNewName(user.name);
    }
  }, [user?.name, infoModalType]);

  // Prevent background scrolling when modals are open
  useEffect(() => {
    const isAnyModalActive = isModalOpen || !!infoModalType || showDeleteModal;
    if (isAnyModalActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, infoModalType, showDeleteModal]);

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim() === user?.name) {
      setInfoModalType(null);
      return;
    }
    const toastId = toast.loading('Updating name...');
    try {
      const token = localStorage.getItem('userToken');
      if (token) {
        const apiBase = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth`;
        const res = await fetch(`${apiBase}/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newName.trim() })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to update name');
        }
      }

      // Update local storage and context
      const currentInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const updatedInfo = { ...currentInfo, name: newName.trim() };
      localStorage.setItem('userInfo', JSON.stringify(updatedInfo));
      if (setUser) setUser({ ...user, name: newName.trim() });
      
      toast.success('Name updated successfully!', { id: toastId });
      setInfoModalType(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update name.', { id: toastId });
    }
  };


  // Custom Image Upload State
  const [uploadedImage, setUploadedImage] = useState(() => {
    return user?.avatar || sessionStorage.getItem('userUploadedImage') || null;
  });
  const fileInputRef = useRef(null);

  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    const fallbackFaqs = [
      {
        question: "How do I track my order?",
        answer: "You can track your order status in the \"My Orders\" section if you are logged in, or using the tracking link in your email."
      },
      {
        question: "What are Aramish Coins?",
        answer: "Aramish Coins are our loyalty currency. You earn them on every purchase and can use them for discounts on future orders."
      },
      {
        question: "Can I change my avatar later?",
        answer: "Yes! You can edit your avatar at any time by clicking on it in your profile page."
      },
      {
        question: "Do you ship internationally?",
        answer: "Currently, we only ship within select regions. Please check our delivery coverage during checkout."
      }
    ];

    const fetchFaqs = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/admin/content/qna`);
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
    };
    fetchFaqs();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const toastId = toast.loading('Processing image...');

    try {
      // Client-side image compression to handle high-res camera photos
      const compressedFile = await new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_DIM = 1200;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Image processing failed'));
              return;
            }
            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(newFile);
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => reject(new Error('Failed to read image file'));
      });

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(compressedFile);

      const token = localStorage.getItem('userToken');
      if (token) {
        toast.loading('Uploading photo...', { id: toastId });
        const formData = new FormData();
        formData.append('image', compressedFile);
        const apiBase = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth`;
        const res = await fetch(`${apiBase}/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to upload profile photo');
        }

        const currentInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const updatedInfo = {
          ...currentInfo,
          avatar: data.user.avatar
        };
        localStorage.setItem('userInfo', JSON.stringify(updatedInfo));

        if (setUser) {
          setUser({
            ...user,
            avatar: data.user.avatar
          });
        }
        toast.success('Profile photo updated successfully!', { id: toastId });
      } else {
        toast.success('Photo preview updated! (Offline mode)', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to upload photo.', { id: toastId });
    }
  };

  if (!user) {
    return (
      <div className="bg-surface min-h-screen pb-24 font-sans animate-fade-in flex flex-col items-center justify-center select-none">
        
        {/* Sticky App Header (Mobile Only) */}
        <div className="bg-[#FFE4D6] w-full px-4 py-4 shadow-sm z-50 sticky top-0 flex items-center gap-3 md:hidden">
          <button 
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-surface/50 flex items-center justify-center text-[#02006c] hover:bg-surface active:scale-95 transition-all cursor-pointer shadow-sm flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[#02006c] text-[20px] font-black tracking-tight">Profile</h1>
        </div>

        {/* Centered card wrapper */}
        <div className="w-full max-w-md px-4 py-8 space-y-6">
          {/* Login Section Card */}
          <div className="bg-surface border border-white/10 rounded-2xl p-6 shadow-3xs relative overflow-hidden flex flex-col justify-between min-h-[200px]">
            {/* Blue Gradient Circle Background */}
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-gradient-to-br from-[#02006c] via-[#0B132B] to-[#1a2542] rounded-full opacity-90"></div>
            
            {/* Sneaker Image Overlaid on Circle */}
            <div className="absolute -top-4 -right-6 w-48 h-48 z-10 flex items-center justify-center">
              <img src={sneakerHero} alt="Sneaker" className="w-[120%] h-auto object-contain transform -rotate-[10deg] drop-shadow-2xl" />
            </div>

            <div className="relative z-20 w-[60%] space-y-1.5 mt-2">
              <h2 className="text-xl font-black text-[#02006c] leading-tight">
                Welcome to<br/>
                <span className="text-[#F59E0B] font-logo text-3xl font-normal tracking-wide drop-shadow-sm">Aramish</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-bold leading-relaxed pr-2">
                Step into style! Log in to track orders, save your favorite kicks, and unlock exclusive rewards.
              </p>
            </div>

            <button 
              onClick={() => navigate('/login')}
              className="relative z-20 w-full bg-[#0B132B] hover:bg-[#1a2542] text-white font-black text-xs uppercase tracking-wider py-3.5 mt-6 rounded-xl shadow-lg shadow-[#0B132B]/20 transition-all cursor-pointer"
            >
              Log In / Sign Up
            </button>
          </div>

          {/* Feedback & Information */}
          <div className="bg-surface border border-white/10 rounded-2xl shadow-3xs overflow-hidden">
            <h3 className="text-xs font-black text-[#02006c] uppercase tracking-wider px-5 pt-4 pb-2 border-b border-white/10">Feedback & Information</h3>
            <div className="flex flex-col">
              {[
                { icon: FileText, label: 'Terms, Policies and Licenses', id: 'terms' },
                { icon: HelpCircle, label: 'Browse FAQs', id: 'faq' },
                { icon: Phone, label: 'Help & Support', path: '/help' }
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => {
                    if (item.path) {
                      navigate(item.path);
                    } else {
                      setInfoModalType(item.id);
                    }
                  }}
                  className="flex items-center gap-4 px-5 py-4 border-b border-white/10 last:border-0 cursor-pointer hover:bg-surface group transition-colors"
                >
                  <item.icon className="w-5 h-5 text-[#02006c] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-700 flex-1 group-hover:text-[#02006c] transition-colors">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B132B] group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Modals */}
        <AnimatePresence>
          {infoModalType === 'terms' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#0a0927]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md overflow-hidden flex flex-col h-[85vh] shadow-2xl border-t border-white/10"
              >
                <div className="w-full flex justify-center pt-4 pb-2 bg-surface relative z-20">
                  <div className="w-12 h-1.5 bg-surface rounded-full"></div>
                </div>
                <div className="px-6 pb-4 pt-1 flex items-center justify-between border-b border-white/10">
                  <h3 className="text-lg font-black text-[#02006c]">Terms & Policies</h3>
                  <button onClick={() => setInfoModalType(null)} className="p-2 bg-surface rounded-full hover:bg-surface transition-colors cursor-pointer"><X className="w-4.5 h-4.5 text-slate-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600">
                  <h4 className="font-bold text-slate-800">1. Acceptance of Terms</h4>
                  <p>By using Aramish, you agree to these conditions. Please read them carefully.</p>
                  <h4 className="font-bold text-slate-800">2. Privacy Policy</h4>
                  <p>Your privacy is important to us. We only collect information necessary to provide you with our services.</p>
                  <h4 className="font-bold text-slate-800">3. Return & Refund</h4>
                  <p>Items can be returned within 14 days of delivery. Custom avatars and digital goods are non-refundable.</p>
                  <h4 className="font-bold text-slate-800">4. Intellectual Property</h4>
                  <p>All content included in or made available through Aramish, such as text, graphics, logos, and avatars is the property of Aramish.</p>
                  <h4 className="font-bold text-slate-800">5. User Conduct</h4>
                  <p>Users must not engage in any activity that disrupts or interferes with Aramish services.</p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {infoModalType === 'faq' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#0a0927]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md overflow-hidden flex flex-col h-[85vh] shadow-2xl border-t border-white/10"
              >
                <div className="w-full flex justify-center pt-4 pb-2 bg-surface relative z-20">
                  <div className="w-12 h-1.5 bg-surface rounded-full"></div>
                </div>
                <div className="px-6 pb-4 pt-1 flex items-center justify-between border-b border-white/10">
                  <h3 className="text-lg font-black text-[#02006c]">Frequently Asked Questions</h3>
                  <button onClick={() => setInfoModalType(null)} className="p-2 bg-surface rounded-full hover:bg-surface transition-colors cursor-pointer"><X className="w-4.5 h-4.5 text-slate-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                  {faqs.map((faq, idx) => (
                    <div key={faq._id || idx}>
                      <h4 className="font-bold text-slate-800 mb-1">{faq.question}</h4>
                      <p className="text-sm text-slate-600">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  const mockUser = user;

  const menuOptions = [
    { id: 'wallet', label: "My Wallet", desc: "View your current Aramish coin balance", icon: Coins, color: "bg-indigo-100/60 text-[#02006c]", path: "/wallet" },
    { label: "Account Information", desc: "Manage your email, phone, and profile settings", icon: User, color: "bg-gold/10 text-[#0B132B]", path: "/account" },
    { label: "Saved Addresses", desc: "Manage your delivery addresses", icon: MapPin, color: "bg-rose-100/60 text-rose-500", path: "/saved-addresses" },
    { label: "Security & Password", desc: "Change password and secure credentials", icon: Lock, color: "bg-amber-100/60 text-amber-600", path: "/security" },
    { label: "Refer & Earn", desc: "Invite friends and earn Aramish Coins", icon: Gift, color: "bg-emerald-100/60 text-emerald-600", path: "/refer" }
  ];

  // Options configuration pools
  const optionsPool = {
    skinTones: [
      { name: "Fair", value: "#FFDBB5" },
      { name: "Tan", value: "#E0A96D" },
      { name: "Warm", value: "#AE7A48" },
      { name: "Rich", value: "#5C3E21" }
    ],
    hairStyles: [
      { id: "crop", label: "Crop" },
      { id: "curly", label: "Curly" },
      { id: "long", label: "Long" },
      { id: "spiky", label: "Spiky" }
    ],
    hairColors: [
      { name: "Dark", value: "#3E2723" },
      { name: "Blonde", value: "#E6C15C" },
      { name: "Coral", value: "#0B132B" },
      { name: "Teal", value: "#2DD4BF" }
    ],
    outfitColors: [
      { name: "Coral", value: "#0B132B" },
      { name: "Navy", value: "#02006c" },
      { name: "Emerald", value: "#10B981" },
      { name: "Amber", value: "#F59E0B" }
    ],
    accessories: [
      { id: "none", label: "None" },
      { id: "glasses", label: "Glasses" },
      { id: "headphones", label: "Gaming" },
      { id: "crown", label: "Crown" }
    ]
  };

  const handleOpenCreator = () => {
    const defaultConfig = {
      skinTone: "#FFDBB5",
      hairStyle: "crop",
      hairColor: "#3E2723",
      outfitColor: "#F8FAFC",
      accessory: "none"
    };
    setTempConfig(avatarConfig || defaultConfig);
    setModalStep(0);
    setIsModalOpen(true);
  };

  const handleSaveAvatar = () => {
    setAvatarConfig(tempConfig);
    sessionStorage.setItem('userAvatar', JSON.stringify(tempConfig));
    // Clear uploaded image so the created avatar is visible
    setUploadedImage(null);
    sessionStorage.removeItem('userUploadedImage');
    setIsModalOpen(false);
  };

  return (
    <div className="bg-surface md:bg-surface min-h-screen relative pb-24 w-full font-sans overflow-x-hidden selection:bg-gold/10 animate-fade-in select-none">
      
      {/* 1. Light Header Background (Mobile Only) */}
      <div 
        className="absolute top-0 left-0 right-0 h-[230px] z-0 pointer-events-none bg-gradient-to-br from-blue-50 via-indigo-50/80 to-blue-100 md:hidden shadow-sm border-b border-white/50" 
        style={{ borderBottomLeftRadius: '50% 15%', borderBottomRightRadius: '50% 15%' }}
      >
      </div>

      {/* 2. Page Content Overlaid */}
      <div className="relative z-10 pt-4 px-4 space-y-4 max-w-7xl mx-auto w-full md:px-6 lg:px-8 md:py-8">
        
        {/* Navigation Bar (Mobile Only) */}
        <div className="flex justify-between items-center md:hidden pt-2 px-2 pb-8 relative z-20">
          <button 
            onClick={() => navigate(-1)}
            className="text-[#02006c] hover:text-[#0B132B] active:scale-95 transition-all cursor-pointer p-2 bg-white/40 rounded-full shadow-sm backdrop-blur-sm mt-2 ml-2 border border-white/50"
          >
             <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setInfoModalType('editProfile')}
            className="text-[#02006c] hover:text-[#0B132B] active:scale-95 transition-all cursor-pointer p-2 bg-white/40 rounded-full shadow-sm backdrop-blur-sm mt-2 mr-2 border border-white/50"
          >
             <Edit2 className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop title header */}
        <div className="hidden md:flex items-center gap-3 border-b border-slate-200 pb-3 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-[#02006c]"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-black text-[#02006c] uppercase tracking-wide">
            My Account Dashboard
          </h2>
        </div>

        {/* Responsive Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: User Card, Avatar creation banner & Log out controls (Mobile-first, 4 cols on desktop) */}
          <div className="md:col-span-5 lg:col-span-4 bg-transparent md:bg-surface md:border md:border-slate-150/50 md:rounded-2xl md:p-6 md:shadow-3xs space-y-6">
            
            {/* Desktop orange card background banner overlay */}
            <div className="hidden md:block relative bg-[#0B132B] rounded-2xl p-6 text-center text-white overflow-hidden shadow-sm">
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-surface/10 rounded-full blur-xl"></div>
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-yellow-400/10 rounded-full blur-xl"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                {/* Avatar */}
                <div 
                  onClick={handleOpenCreator}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute -inset-1 rounded-full bg-surface/20 animate-ping opacity-60 blur-xs"></div>
                  <div className="relative p-1 bg-surface rounded-full shadow-md">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-surface flex items-center justify-center relative">
                      {uploadedImage ? (
                        <OptimizedImage src={uploadedImage} alt="Uploaded Profile" type="default" className="w-full h-full" />
                      ) : avatarConfig ? (
                        <DynamicAvatar config={avatarConfig} size="w-full h-full object-cover" />
                      ) : (
                        <OptimizedImage src={avtarImage} alt="Profile Avatar" type="default" className="w-full h-full" />
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-black mt-3 font-syne tracking-wide drop-shadow-md">
                  {mockUser.name}
                </h3>
              </div>
            </div>

            {/* Mobile User Card (Only on mobile) */}
            <div className="flex flex-col items-center text-center -mt-16 mb-4 relative md:hidden">
              <div 
                onClick={handleOpenCreator}
                className="relative group cursor-pointer z-10"
              >
                <div className="relative p-1 bg-white rounded-full shadow-xl transition-transform duration-300 group-hover:scale-105">
                  <div className="w-[110px] h-[110px] rounded-full overflow-hidden bg-surface flex items-center justify-center relative">
                    {uploadedImage ? (
                      <OptimizedImage src={uploadedImage} alt="Uploaded Profile" type="default" className="w-full h-full object-cover" />
                    ) : avatarConfig ? (
                      <DynamicAvatar config={avatarConfig} size="w-full h-full object-cover" />
                    ) : (
                      <OptimizedImage src={avtarImage} alt="Profile Avatar" type="default" className="w-full h-full object-cover" />
                    )}
                  </div>
                  
                </div>
              </div>
              <h3 className="text-2xl font-black text-[#02006c] mt-3 font-syne tracking-wide">
                {mockUser.name}
              </h3>
            </div>

            {/* Logout and Delete Actions on Desktop Left Column */}
            <div className="hidden md:flex flex-col gap-2 pt-2 border-t border-white/10">
              <button 
                onClick={() => { logout(); navigate('/login'); }}
                className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-rose-50/50 text-left cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center shadow-3xs">
                    <LogOut className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-rose-500 block leading-tight">Log Out</span>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5 leading-none">Safely terminate session</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-400 transition-colors" />
              </button>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-red-50/50 text-left cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-50 text-red-500 rounded-lg flex items-center justify-center shadow-3xs">
                    <Trash2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-red-500 block leading-tight">Delete Account</span>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5 leading-none">Remove account permanently</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-400 transition-colors" />
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: Settings Options & feedback info list (Mobile-first, 8 cols on desktop) */}
          <div className="md:col-span-7 lg:col-span-8 space-y-6">
            
            {/* My Activity Box */}
            <div className="bg-surface rounded-2xl p-4 md:p-6 shadow-3xs border border-white/10">
              <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide px-1 mb-4 border-b border-white/10 pb-2">
                My Activity
              </h3>
              
              <div className="space-y-1.5">
                {[
                  { label: "Orders", desc: "Track, return, or buy things again", icon: Package, color: "bg-blue-100/60 text-blue-600", path: "/orders" },
                  { label: "My Picks", desc: "View your saved items and wishlist", icon: Heart, color: "bg-pink-100/60 text-pink-500", path: "/wishlist" },
                  { label: "Coupons", desc: "Manage your discounts and offers", icon: Gift, color: "bg-purple-100/60 text-purple-600", path: "/coupons" }
                ].map((opt, idx) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => { if (opt.path) navigate(opt.path); }}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all duration-300 text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-11 h-11 ${opt.color} rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105 shadow-3xs`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-black text-[#02006c] block leading-tight">{opt.label}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block truncate mt-1 leading-none tracking-wide">{opt.desc}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0B132B] group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Account settings options box */}
            <div className="bg-surface rounded-2xl p-4 md:p-6 shadow-3xs border border-white/10">
              <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide px-1 mb-4 border-b border-white/10 pb-2">
                Account Settings
              </h3>
              
              <div className="space-y-1.5">
                {menuOptions.map((opt, idx) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => { if (opt.path) navigate(opt.path); }}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-surface active:scale-[0.98] transition-all duration-300 text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-11 h-11 ${opt.color} rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105 shadow-3xs`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-black text-[#02006c] block leading-tight">{opt.label}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block truncate mt-1 leading-none tracking-wide">{opt.desc}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0B132B] group-hover:translate-x-1 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>



            {/* Feedback & Info links */}
            <div className="bg-surface rounded-2xl shadow-3xs border border-white/10 overflow-hidden">
              <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wide px-5 pt-4 pb-2 border-b border-white/10">
                Feedback & Information
              </h3>
              <div className="flex flex-col">
                {[
                  { icon: FileText, label: 'Terms, Policies and Licenses', id: 'terms' },
                  { icon: HelpCircle, label: 'Browse FAQs', id: 'faq' },
                  { icon: Phone, label: 'Help & Support', path: '/help' }
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      if (item.path) navigate(item.path);
                      else setInfoModalType(item.id);
                    }}
                    className="flex items-center gap-4 px-5 py-4 border-b border-white/10 last:border-0 cursor-pointer hover:bg-surface group transition-colors"
                  >
                    <item.icon className="w-5 h-5 text-[#02006c] group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-700 flex-1 group-hover:text-[#02006c] transition-colors">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B132B] group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>

            {/* Log out controls on mobile view (Hidden on desktop) */}
            <div className="space-y-3.5 md:hidden">
              <div className="bg-surface rounded p-2 shadow-sm border border-white/10">
                <button 
                  onClick={() => { logout(); navigate('/login'); }}
                  className="w-full flex items-center justify-between p-3.5 rounded hover:bg-rose-50/60 active:scale-[0.98] transition-all duration-300 text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-rose-50 text-rose-500 rounded flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 shadow-inner">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-rose-500 font-sans tracking-wide block leading-tight">Log Out</span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-1 leading-none tracking-wide">Safely terminate session</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-400 transition-colors" />
                </button>

                <div className="h-[1px] w-full bg-surface my-1"></div>

                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full flex items-center justify-between p-3.5 rounded hover:bg-red-50/80 active:scale-[0.98] transition-all duration-300 text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-red-50 text-red-500 rounded flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-inner">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-red-500 font-sans tracking-wide block leading-tight">Delete Account</span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-1 leading-none tracking-wide">Permanently remove your account</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-400 transition-colors" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Modals */}
      <AnimatePresence>
        {infoModalType === 'terms' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a0927]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md overflow-hidden flex flex-col h-[85vh] shadow-2xl border-t border-white/10"
            >
              <div className="w-full flex justify-center pt-4 pb-2 bg-surface relative z-20">
                <div className="w-12 h-1.5 bg-surface rounded-full"></div>
              </div>
              <div className="px-6 pb-4 pt-1 flex items-center justify-between border-b border-white/10">
                <h3 className="text-lg font-black text-[#02006c]">Terms & Policies</h3>
                <button onClick={() => setInfoModalType(null)} className="p-2 bg-surface rounded-full hover:bg-surface transition-colors cursor-pointer"><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 text-left">
                <h4 className="font-bold text-slate-800">1. Acceptance of Terms</h4>
                <p>By using Aramish, you agree to these conditions. Please read them carefully.</p>
                <h4 className="font-bold text-slate-800">2. Privacy Policy</h4>
                <p>Your privacy is important to us. We only collect information necessary to provide you with our services.</p>
                <h4 className="font-bold text-slate-800">3. Return & Refund</h4>
                <p>Items can be returned within 14 days of delivery. Custom avatars and digital goods are non-refundable.</p>
                <h4 className="font-bold text-slate-800">4. Intellectual Property</h4>
                <p>All content included in or made available through Aramish, such as text, graphics, logos, and avatars is the property of Aramish.</p>
                <h4 className="font-bold text-slate-800">5. User Conduct</h4>
                <p>Users must not engage in any activity that disrupts or interferes with Aramish services.</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {infoModalType === 'faq' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a0927]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md overflow-hidden flex flex-col h-[85vh] shadow-2xl border-t border-white/10"
            >
              <div className="w-full flex justify-center pt-4 pb-2 bg-surface relative z-20">
                <div className="w-12 h-1.5 bg-surface rounded-full"></div>
              </div>
              <div className="px-6 pb-4 pt-1 flex items-center justify-between border-b border-white/10">
                <h3 className="text-lg font-black text-[#02006c]">Frequently Asked Questions</h3>
                <button onClick={() => setInfoModalType(null)} className="p-2 bg-surface rounded-full hover:bg-surface transition-colors cursor-pointer"><X className="w-4.5 h-4.5 text-slate-500" /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 text-left">
                {faqs.map((faq, idx) => (
                  <div key={faq._id || idx}>
                    <h4 className="font-bold text-slate-800 mb-1">{faq.question}</h4>
                    <p className="text-sm text-slate-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#0a0927]/70 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={{ type: 'spring', damping: 22, stiffness: 220 }}
              className="bg-surface rounded-[28px] w-full max-w-sm p-6 shadow-2xl border border-white/10 relative overflow-hidden"
            >
              {!deleteSuccess ? (
                <>
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center shadow-inner">
                      <Trash2 className="w-7 h-7 text-red-500" />
                    </div>
                  </div>

                  {/* Text */}
                  <h3 className="text-[18px] font-black text-[#02006c] text-center mb-1">Delete Account?</h3>
                  <p className="text-[12px] text-slate-500 font-medium text-center leading-relaxed mb-6">
                    Are you sure you want to permanently delete your account? This action <span className="text-red-500 font-bold">cannot be undone</span> and all your data will be lost.
                  </p>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 py-3 rounded-2xl border border-white/10 bg-surface text-slate-700 text-[14px] font-bold hover:bg-surface active:scale-95 transition-all cursor-pointer"
                    >
                      No, Keep It
                    </button>
                    <button
                      onClick={() => {
                        setDeleteSuccess(true);
                        setTimeout(() => {
                          setShowDeleteModal(false);
                          setDeleteSuccess(false);
                          setUser(null);
                          navigate('/login');
                        }, 2000);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-bold active:scale-95 transition-all cursor-pointer shadow-md shadow-red-200"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </>
              ) : (
                /* Success State */
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-4"
                >
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner mb-4">
                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-[17px] font-black text-[#02006c] text-center mb-1">Account Deleted</h3>
                  <p className="text-[12px] text-slate-500 font-medium text-center leading-relaxed">
                    Your account has been successfully deleted. Redirecting you now…
                  </p>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Snapchat-Style Interactive Avatar Creator Modal (BottomSheet) */}
      <AnimatePresence>
      {isModalOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#0a0927]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
        >
          {modalStep === 0 ? (
            /* Onboarding Screen (Centered) */
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface rounded-[32px] w-[90%] sm:w-full max-w-sm overflow-hidden flex flex-col shadow-2xl border border-white/10 p-6 space-y-5 text-center relative mb-8 sm:mb-0 mx-auto"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-surface hover:bg-surface rounded-full transition-colors cursor-pointer z-10"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>

              <div className="w-full pt-3 flex justify-center">
                <div className="relative w-full rounded-[24px] overflow-hidden shadow-inner bg-surface aspect-[4/3] flex items-center justify-center">
                  <OptimizedImage src={avtarImage} alt="Style Model" type="default" className="w-full h-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                </div>
              </div>

              <div className="space-y-2 px-2">
                <h3 className="text-xl font-black text-[#02006c] font-syne leading-tight uppercase tracking-wider">
                  Create your<br/><span className="text-[#0B132B]">Perfect style</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed max-w-[260px] mx-auto uppercase tracking-widest">
                  Every person has a unique style. We can help create your perfect 3D character.
                </p>
              </div>

              <div className="flex justify-center items-center gap-1.5 py-1">
                <span className="w-6 h-1.5 bg-surface rounded-full"></span>
                <span className="w-6 h-1.5 bg-[#0B132B] rounded-full"></span>
                <span className="w-6 h-1.5 bg-surface rounded-full"></span>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => setModalStep(1)}
                  className="w-full py-4 bg-[#0B132B] hover:bg-gold text-white text-[11px] font-black rounded-[20px] active:scale-[0.98] transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-[#0B132B]/30"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          ) : (
            /* Creator Editor Screen (Bottom Sheet) */
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-surface rounded-t-[40px] sm:rounded-[40px] w-full max-w-md overflow-hidden flex flex-col h-[90vh] sm:h-[85vh] shadow-[0_-10px_40px_rgb(0,0,0,0.15)] border-t border-x border-white/10"
            >
              {/* Drag Handle (Visual) */}
              <div className="w-full flex justify-center pt-4 pb-2 bg-surface relative z-20">
                <div className="w-12 h-1.5 bg-surface rounded-full"></div>
              </div>

              {/* Modal Header */}
              <div className="px-6 pb-4 pt-1 flex items-center justify-between bg-surface z-20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20">
                    <Sparkles className="w-4 h-4 text-[#0B132B]" />
                  </div>
                  <h3 className="text-sm font-black text-[#02006c] uppercase tracking-wider font-syne">
                    Avatar Editor
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 bg-surface hover:bg-surface rounded-full transition-colors cursor-pointer border border-white/10"
                >
                  <X className="w-4.5 h-4.5 text-slate-500" />
                </button>
              </div>

              {/* Live Character Preview Window (Sticky) */}
              <div className="flex justify-center items-center py-6 bg-surface border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl">
                <div className="p-2.5 border border-white/10 rounded-full bg-surface shadow-xl shadow-[#0B132B]/5 relative group">
                  <div className="absolute inset-0 rounded-full bg-[#0B132B]/10 blur-xl group-hover:bg-[#0B132B]/20 transition-colors"></div>
                  <DynamicAvatar config={tempConfig} size="w-32 h-32 relative z-10" />
                </div>
              </div>

              {/* Customization Options Panels */}
              <div className="flex-grow overflow-y-auto p-6 space-y-7 text-left bg-surface pb-32">
                
                {/* Category: Skin Tone */}
                <div className="space-y-3.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0B132B]"></span> Skin Tone
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    {optionsPool.skinTones.map((skin) => (
                      <button
                        key={skin.value}
                        onClick={() => setTempConfig(prev => ({ ...prev, skinTone: skin.value }))}
                        className={`w-11 h-11 rounded-full transition-all active:scale-90 cursor-pointer relative ${
                          tempConfig.skinTone === skin.value ? 'scale-110 shadow-md ring-2 ring-offset-2 ring-[#0B132B]' : 'ring-1 ring-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: skin.value }}
                      >
                         {tempConfig.skinTone === skin.value && (
                           <div className="absolute inset-0 flex items-center justify-center">
                             <div className="w-2.5 h-2.5 bg-surface rounded-full shadow-sm"></div>
                           </div>
                         )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category: Hairstyle */}
                <div className="space-y-3.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#02006c]"></span> Hairstyle
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {optionsPool.hairStyles.map((hair) => (
                      <button
                        key={hair.id}
                        onClick={() => setTempConfig(prev => ({ ...prev, hairStyle: hair.id }))}
                        className={`py-3 text-[10px] font-bold uppercase tracking-widest rounded-[16px] transition-all active:scale-95 cursor-pointer text-center ${
                          tempConfig.hairStyle === hair.id 
                            ? 'bg-[#02006c] text-white shadow-lg shadow-[#02006c]/20 border-none' 
                            : 'bg-surface text-slate-600 border border-white/10 hover:bg-surface hover:border-white/10'
                        }`}
                      >
                        {hair.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category: Hair Color */}
                <div className="space-y-3.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Hair Color
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    {optionsPool.hairColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setTempConfig(prev => ({ ...prev, hairColor: color.value }))}
                        className={`w-11 h-11 rounded-full transition-all active:scale-90 cursor-pointer relative ${
                          tempConfig.hairColor === color.value ? 'scale-110 shadow-md ring-2 ring-offset-2 ring-slate-800' : 'ring-1 ring-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                      >
                        {tempConfig.hairColor === color.value && (
                           <div className="absolute inset-0 flex items-center justify-center">
                             <div className="w-2.5 h-2.5 bg-surface rounded-full shadow-sm"></div>
                           </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category: Outfit Color */}
                <div className="space-y-3.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Outfit Color
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    {optionsPool.outfitColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setTempConfig(prev => ({ ...prev, outfitColor: color.value }))}
                        className={`w-11 h-11 rounded-full transition-all active:scale-90 cursor-pointer relative ${
                          tempConfig.outfitColor === color.value ? 'scale-110 shadow-md ring-2 ring-offset-2 ring-emerald-500' : 'ring-1 ring-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                      >
                        {tempConfig.outfitColor === color.value && (
                           <div className="absolute inset-0 flex items-center justify-center">
                             <div className="w-2.5 h-2.5 bg-surface rounded-full opacity-90 shadow-sm"></div>
                           </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category: Accessories */}
                <div className="space-y-3.5">
                  <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Accessories
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {optionsPool.accessories.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => setTempConfig(prev => ({ ...prev, accessory: acc.id }))}
                        className={`py-3 text-[10px] font-bold uppercase tracking-widest rounded-[16px] transition-all active:scale-95 cursor-pointer text-center ${
                          tempConfig.accessory === acc.id 
                            ? 'bg-[#0B132B] text-white shadow-lg shadow-[#0B132B]/20 border-none' 
                            : 'bg-surface text-slate-600 border border-white/10 hover:bg-surface hover:border-white/10'
                        }`}
                      >
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Footer (Sticky Bottom) */}
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-surface border-t border-white/10 shadow-[0_-15px_30px_rgba(0,0,0,0.03)] flex gap-3 z-20">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 py-4 bg-surface hover:bg-surface border border-white/10 text-slate-500 text-[11px] font-black rounded-[20px] active:scale-95 transition-all cursor-pointer text-center uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAvatar}
                  className="flex-grow py-4 bg-gradient-to-r from-[#0B132B] to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white text-[11px] font-black rounded-[20px] active:scale-[0.98] transition-all cursor-pointer text-center uppercase tracking-wider shadow-xl shadow-[#0B132B]/25 flex justify-center items-center gap-2"
                >
                  Save & Equip <Sparkles className="w-4 h-4 fill-white" />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {infoModalType === 'editProfile' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a0927]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md overflow-hidden flex flex-col shadow-2xl border-t border-white/10"
            >
              <div className="px-6 py-4 flex items-center justify-between border-b border-black/5 bg-[#f0f4ff]">
                <h3 className="text-lg font-black text-[#02006c]">Edit Profile</h3>
                <button onClick={() => setInfoModalType(null)} className="p-2 bg-white rounded-full shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"><X className="w-4 h-4 text-slate-500" /></button>
              </div>
              
              <div className="p-6 space-y-6 bg-white">
                <div className="flex flex-col items-center gap-4 border-b border-black/5 pb-6">
                  <div className="relative p-1 bg-white rounded-full shadow-md">
                    <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-surface flex items-center justify-center relative">
                      {uploadedImage ? (
                        <OptimizedImage src={uploadedImage} alt="Uploaded" type="default" className="w-full h-full object-cover" />
                      ) : avatarConfig ? (
                        <DynamicAvatar config={avatarConfig} size="w-full h-full object-cover" />
                      ) : (
                        <OptimizedImage src={avtarImage} alt="Avatar" type="default" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current.click();
                      }}
                      className="absolute bottom-0 right-0 p-2.5 bg-[#02006c] border-2 border-white rounded-full shadow-md text-white hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Camera className="w-4 h-4 fill-current" />
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      onClick={(e) => e.stopPropagation()}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  
                  <div 
                    onClick={() => { setInfoModalType(null); handleOpenCreator(); }}
                    className="w-full max-w-[200px] py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm text-center cursor-pointer active:scale-95 transition-all text-white font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Sparkles className="w-4 h-4" /> Customize Avatar
                  </div>
                </div>

                <div className="space-y-3 pb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                  <div className="flex gap-2">
                    <input 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)} 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#02006c] focus:outline-none focus:border-[#02006c] focus:bg-white transition-all"
                      placeholder="Enter username"
                    />
                    <button 
                      onClick={handleSaveName}
                      className="bg-[#02006c] hover:bg-[#0B132B] text-white rounded-xl px-5 font-bold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
