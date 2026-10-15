import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Shield, Lock, Save, CheckCircle2, ChevronRight, AlertCircle, Camera, Eye, EyeOff, Coins, Tag, Plus, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../utils/toast';
import OptimizedImage from '../../components/common/OptimizedImage';
import { GST_STATES, GST_RATE_OPTIONS } from '../../utils/gstStates';

// GST rate rule dates are IST calendar days (the backend stores them as IST midnight).
const IST_MS = 330 * 60 * 1000;
const toIstDay = (date) => (date ? new Date(new Date(date).getTime() + IST_MS).toISOString().slice(0, 10) : '');

const Settings = () => {
  const [activeSection, setActiveSection] = useState('Profile');
  const [saved, setSaved] = useState(false);

  // Profile Form States
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [hasRemovedAvatar, setHasRemovedAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // System Config States (from Settings DB)
  const [helpline, setHelpline] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [gstNo, setGstNo] = useState('');
  // GST invoice (seller) details
  const [businessLegalName, setBusinessLegalName] = useState('');
  const [businessTradeName, setBusinessTradeName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessStateCode, setBusinessStateCode] = useState('');
  const [businessPan, setBusinessPan] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('ARM');
  const [defaultHsnCode, setDefaultHsnCode] = useState('');
  const [gstRateRules, setGstRateRules] = useState([]);
  const [commission, setCommission] = useState(10);
  const [codChargeEnabled, setCodChargeEnabled] = useState(true);
  const [codChargeAmount, setCodChargeAmount] = useState(150);
  const [prepaidDiscountEnabled, setPrepaidDiscountEnabled] = useState(true);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(true);
  const [prepaidDiscountAmount, setPrepaidDiscountAmount] = useState(100);

  // Coins settings states
  // Wallet / reward rules — loaded from and validated by the backend (no hardcoded business values)
  const [welcomeBonusEnabled, setWelcomeBonusEnabled] = useState(true);
  const [welcomeBonusCoins, setWelcomeBonusCoins] = useState('');
  const [rewardCoinsEnabled, setRewardCoinsEnabled] = useState(true);
  const [orderRewardPercentage, setOrderRewardPercentage] = useState('');
  const [orderRewardMaxCap, setOrderRewardMaxCap] = useState('');
  const [walletRedemptionPercentage, setWalletRedemptionPercentage] = useState('');
  const [returnWindowDays, setReturnWindowDays] = useState(2);
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [walletEnabled, setWalletEnabled] = useState(true);

  // Homepage Deals states
  const [crazyDealsHeaderName, setCrazyDealsHeaderName] = useState('Crazy Deals');
  const [showCrazyDealsTimer, setShowCrazyDealsTimer] = useState(true);
  const [crazyDealsDuration, setCrazyDealsDuration] = useState(9930);

  const [featuredCollectionHeaderName, setFeaturedCollectionHeaderName] = useState('Featured Collection');
  const [showFeaturedCollectionTimer, setShowFeaturedCollectionTimer] = useState(false);
  const [featuredCollectionDuration, setFeaturedCollectionDuration] = useState(7200);

  const [newArrivalsHeaderName, setNewArrivalsHeaderName] = useState('New Arrivals');
  const [showNewArrivalsTimer, setShowNewArrivalsTimer] = useState(true);
  const [newArrivalsDuration, setNewArrivalsDuration] = useState(9930);

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility states
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const sections = [
    { id: 'Profile', icon: User, label: 'My Profile' },
    { id: 'Business', icon: Shield, label: 'Business & Tax' },
    { id: 'Coins', icon: Coins, label: 'Coins & Wallet' },
    { id: 'Deals', icon: Tag, label: 'Homepage Sections' },
    { id: 'Security', icon: Lock, label: 'Login & Security' },
  ];

  // Fetch admin profile and settings config
  const fetchData = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Get Admin Profile
      const profileRes = await fetch(`${apiBase}/admin/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.success && profileData.admin) {
        setAdminName(profileData.admin.name || '');
        setAdminEmail(profileData.admin.email || '');
        setAdminPhone(profileData.admin.phone || '');
        setAvatar(profileData.admin.avatar || '');
        // Sync local storage in case it got updated
        localStorage.setItem('adminInfo', JSON.stringify(profileData.admin));
        window.dispatchEvent(new Event('adminInfoUpdated'));
      }

      // Get System Config Settings
      const settingsRes = await fetch(`${apiBase}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData.success && settingsData.settings) {
        const s = settingsData.settings;
        setHelpline(s.helpline || '');
        setSupportEmail(s.supportEmail || '');
        setGstNo(s.gstNo || '');
        setBusinessLegalName(s.businessLegalName || '');
        setBusinessTradeName(s.businessTradeName || '');
        setBusinessAddress(s.businessAddress || '');
        setBusinessStateCode(s.businessStateCode || '');
        setBusinessPan(s.businessPan || '');
        setInvoicePrefix(s.invoicePrefix || 'ARM');
        setDefaultHsnCode(s.defaultHsnCode || '');
        setGstRateRules((s.gstRateRules || []).map(r => ({
          effectiveFrom: toIstDay(r.effectiveFrom),
          threshold: r.threshold ?? 0,
          rateUpToThreshold: r.rateUpToThreshold,
          rateAboveThreshold: r.rateAboveThreshold
        })));
        setCommission(s.commission ?? 10);
        setCodChargeEnabled(s.codChargeEnabled ?? true);
        setCodChargeAmount(s.codChargeAmount ?? 150);
        setPrepaidDiscountEnabled(s.prepaidDiscountEnabled ?? true);
        setFreeShippingEnabled(s.freeShippingEnabled ?? true);
        setPrepaidDiscountAmount(s.prepaidDiscountAmount ?? 100);
        setWelcomeBonusEnabled(s.welcomeBonusEnabled ?? true);
        setWelcomeBonusCoins(s.welcomeBonusCoins ?? '');
        setRewardCoinsEnabled(s.rewardCoinsEnabled ?? true);
        setOrderRewardPercentage(s.orderRewardPercentage ?? '');
        setOrderRewardMaxCap(s.orderRewardMaxCap ?? '');
        setWalletRedemptionPercentage(s.walletRedemptionPercentage ?? '');
        setReturnWindowDays(s.returnWindowDays ?? 2);
        setMarqueeEnabled(s.marqueeEnabled ?? true);
        setWalletEnabled(s.walletEnabled ?? true);

        setCrazyDealsHeaderName(s.crazyDealsHeaderName ?? 'Crazy Deals');
        setShowCrazyDealsTimer(s.showCrazyDealsTimer ?? true);
        setCrazyDealsDuration(s.crazyDealsDuration ?? 9930);
        setFeaturedCollectionHeaderName(s.featuredCollectionHeaderName ?? 'Featured Collection');
        setShowFeaturedCollectionTimer(s.showFeaturedCollectionTimer ?? false);
        setFeaturedCollectionDuration(s.featuredCollectionDuration ?? 7200);
        setNewArrivalsHeaderName(s.newArrivalsHeaderName ?? 'New Arrivals');
        setShowNewArrivalsTimer(s.showNewArrivalsTimer ?? true);
        setNewArrivalsDuration(s.newArrivalsDuration ?? 9930);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile and settings');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.info('Image size cannot exceed 10MB!');
        return;
      }
      setImageFile(file);
      setHasRemovedAvatar(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      if (activeSection === 'Profile') {
        // Prepare FormData
        const formData = new FormData();
        formData.append('name', adminName);
        formData.append('email', adminEmail);
        formData.append('phone', adminPhone);
        if (imageFile) {
          formData.append('image', imageFile);
        } else if (hasRemovedAvatar) {
          formData.append('avatar', '');
        }

        // Save Admin Info
        const profileRes = await fetch(`${apiBase}/admin/auth/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        const profileData = await profileRes.json();

        // Save Helpline & GST registration to settings
        const settingsRes = await fetch(`${apiBase}/admin/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            helpline,
            supportEmail,
            commission
          })
        });
        const settingsData = await settingsRes.json();

        if (profileRes.ok && settingsRes.ok && profileData.success && settingsData.success) {
          toast.success('Profile settings updated successfully!');
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          
          if (profileData.admin) {
            localStorage.setItem('adminInfo', JSON.stringify(profileData.admin));
            window.dispatchEvent(new Event('adminInfoUpdated'));
          }
          fetchData();
        } else {
          toast.error(profileData.message || settingsData.message || 'Failed to update settings');
        }
      } else if (activeSection === 'Business') {
        // Save Platform commission & payment pricing
        const settingsRes = await fetch(`${apiBase}/admin/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            helpline,
            gstNo: gstNo.trim().toUpperCase(),
            businessLegalName,
            businessTradeName,
            businessAddress,
            businessStateCode,
            businessPan: businessPan.trim().toUpperCase(),
            invoicePrefix: invoicePrefix.trim().toUpperCase(),
            defaultHsnCode: defaultHsnCode.trim(),
            gstRateRules: gstRateRules.map(r => ({
              effectiveFrom: `${r.effectiveFrom}T00:00:00+05:30`,
              threshold: Number(r.threshold) || 0,
              rateUpToThreshold: Number(r.rateUpToThreshold),
              rateAboveThreshold: Number(r.rateAboveThreshold)
            })),
            commission,
            codChargeEnabled,
            codChargeAmount: Number(codChargeAmount),
            prepaidDiscountEnabled,
            freeShippingEnabled,
            prepaidDiscountAmount: Number(prepaidDiscountAmount)
          })
        });
        const settingsData = await settingsRes.json();

        if (settingsRes.ok && settingsData.success) {
          toast.success('Business & Tax settings updated successfully!');
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          fetchData();
        } else {
          toast.error(settingsData.message || 'Failed to update settings');
        }
      } else if (activeSection === 'Coins') {
        // Save Coins config
        const settingsRes = await fetch(`${apiBase}/admin/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            welcomeBonusEnabled: Boolean(welcomeBonusEnabled),
            welcomeBonusCoins: welcomeBonusCoins === '' ? '' : Number(welcomeBonusCoins),
            rewardCoinsEnabled: Boolean(rewardCoinsEnabled),
            orderRewardPercentage: orderRewardPercentage === '' ? '' : Number(orderRewardPercentage),
            orderRewardMaxCap: orderRewardMaxCap === '' ? '' : Number(orderRewardMaxCap),
            walletRedemptionPercentage: walletRedemptionPercentage === '' ? '' : Number(walletRedemptionPercentage),
            returnWindowDays: Number(returnWindowDays),
            marqueeEnabled: Boolean(marqueeEnabled),
            walletEnabled: Boolean(walletEnabled)
          })
        });
        const settingsData = await settingsRes.json();

        if (settingsRes.ok && settingsData.success) {
          toast.success('Coin & Wallet settings updated successfully!');
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          fetchData();
        } else {
          toast.error(settingsData.message || 'Failed to update settings');
        }
      } else if (activeSection === 'Deals') {
        // Save Homepage Deals Config
        const settingsRes = await fetch(`${apiBase}/admin/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            crazyDealsHeaderName,
            showCrazyDealsTimer,
            crazyDealsDuration: Number(crazyDealsDuration),
            featuredCollectionHeaderName,
            showFeaturedCollectionTimer,
            featuredCollectionDuration: Number(featuredCollectionDuration),
            newArrivalsHeaderName,
            showNewArrivalsTimer,
            newArrivalsDuration: Number(newArrivalsDuration)
          })
        });
        const settingsData = await settingsRes.json();

        if (settingsRes.ok && settingsData.success) {
          toast.success('Homepage Sections settings updated successfully!');
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          fetchData();
        } else {
          toast.error(settingsData.message || 'Failed to update settings');
        }
      } else if (activeSection === 'Security') {
        // Save Password Change
        if (newPassword !== confirmPassword) {
          toast.info('New passwords do not match');
          return;
        }

        const securityRes = await fetch(`${apiBase}/admin/auth/change-password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        });
        const securityData = await securityRes.json();

        if (securityRes.ok && securityData.success) {
          toast.success('Password changed successfully!');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        } else {
          toast.error(securityData.message || 'Failed to change password');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Platform Settings</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage admin profile, business models, and secure credentials.</p>
        </div>
        <button 
          onClick={handleSave}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all shadow-lg ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white shadow-blue-100 hover:scale-105'}`}
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? 'Updated!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:w-72 flex-shrink-0 space-y-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-semibold uppercase tracking-widest transition-all ${
                activeSection === section.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white text-slate-400 hover:bg-slate-50 border border-transparent hover:border-slate-100'
              }`}
            >
              <section.icon size={18} />
              {section.label}
              {activeSection === section.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 space-y-8"
            >
              <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                  {React.createElement(sections.find(s => s.id === activeSection).icon, { size: 24 })}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 font-montserrat uppercase tracking-tight">{activeSection === 'Profile' ? 'My Profile' : activeSection === 'Business' ? 'Business & Tax' : 'Login Security'} Configuration</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Manage your platform's {activeSection.toLowerCase()} settings.</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {activeSection === 'Profile' && (
                  <div className="space-y-10">
                    <div className="flex items-center gap-8">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black font-montserrat shadow-xl shadow-blue-100 overflow-hidden relative">
                          {avatar ? (
                            <OptimizedImage src={avatar} alt="Avatar" type="default" className="w-full h-full" />
                          ) : (
                            adminName ? adminName.charAt(0).toUpperCase() : 'A'
                          )}
                          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white" size={24} />
                          </div>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleImageChange} 
                          accept="image/*" 
                          className="hidden" 
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900 font-montserrat uppercase tracking-tight">{adminName || 'Administrator'}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Super Admin • Full Access</p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className="px-3 py-1 bg-green-50 text-green-600 text-[9px] font-semibold uppercase tracking-widest rounded-lg border border-green-100">Verified</span>
                          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-semibold uppercase tracking-widest rounded-lg border border-blue-100">Primary Account</span>
                          {avatar && (
                            <button
                              type="button"
                              onClick={() => {
                                setAvatar('');
                                setImageFile(null);
                                setHasRemovedAvatar(true);
                              }}
                              className="px-3 py-1 bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              Remove Photo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Full Name</label>
                        <input 
                          type="text" 
                          value={adminName} 
                          onChange={e => setAdminName(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Login Email</label>
                        <input 
                          type="email" 
                          value={adminEmail} 
                          onChange={e => setAdminEmail(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Phone Number</label>
                        <input 
                          type="text" 
                          value={adminPhone} 
                          onChange={e => setAdminPhone(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Helpline Number</label>
                        <input 
                          type="text" 
                          value={helpline} 
                          onChange={e => setHelpline(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Support Email</label>
                        <input 
                          type="email" 
                          value={supportEmail} 
                          onChange={e => setSupportEmail(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'Business' && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-montserrat uppercase mb-1">GST Invoice Details</h3>
                      <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                        Printed on every tax invoice. Invoices are issued at dispatch and only when these details are complete and valid.
                        An issued invoice keeps the details it was issued with.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Legal Business Name</label>
                          <input type="text" value={businessLegalName} onChange={e => setBusinessLegalName(e.target.value)} placeholder="As registered under GST" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Trade Name (optional)</label>
                          <input type="text" value={businessTradeName} onChange={e => setBusinessTradeName(e.target.value)} placeholder="e.g. Aramish Shoes" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Registered Address</label>
                          <textarea rows={2} value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Principal place of business, as on the GST certificate" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">State</label>
                          <select value={businessStateCode} onChange={e => setBusinessStateCode(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none">
                            <option value="">Select state</option>
                            {GST_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">State Code</label>
                          <select value={businessStateCode} onChange={e => setBusinessStateCode(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none">
                            <option value="">--</option>
                            {GST_STATES.map(([code]) => <option key={code} value={code}>{code}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">GSTIN</label>
                          <input type="text" value={gstNo} maxLength={15} onChange={e => setGstNo(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="15-character GSTIN" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none uppercase" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">PAN</label>
                          <input type="text" value={businessPan} maxLength={10} onChange={e => setBusinessPan(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="Must match GSTIN characters 3-12" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none uppercase" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Invoice Number Prefix</label>
                          <input type="text" value={invoicePrefix} maxLength={10} onChange={e => setInvoicePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none uppercase" />
                          <p className="text-[10px] text-slate-400">Numbers look like {invoicePrefix || 'ARM'}/26-27/000001 and restart each financial year. Changing the prefix starts a new series.</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Default HSN Code</label>
                          <input type="text" value={defaultHsnCode} maxLength={8} onChange={e => setDefaultHsnCode(e.target.value.replace(/\D/g, ''))} placeholder="Used when a product has no HSN, e.g. 6403" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50">
                      <h3 className="text-sm font-bold text-slate-900 font-montserrat uppercase mb-1">Footwear GST Rates</h3>
                      <p className="text-[10px] text-slate-500 mb-4 leading-relaxed max-w-2xl">
                        Prices are GST-inclusive; tax is calculated out of the selling price. The rule in force on the invoice date applies:
                        a pair whose sale value (taxable value after discounts) is up to the threshold is taxed at the first rate, above it at the second.
                        A threshold of 0 applies the first rate to all values. A product-level GST rate (Add/Edit Product) overrides these rules.
                      </p>
                      <div className="space-y-2">
                        <div className="hidden md:grid grid-cols-[1.2fr_1fr_1fr_1fr_40px] gap-3 px-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                          <span>Effective From</span><span>Threshold per pair (₹)</span><span>Rate up to threshold</span><span>Rate above</span><span></span>
                        </div>
                        {gstRateRules.map((rule, idx) => (
                          <div key={idx} className="grid grid-cols-2 md:grid-cols-[1.2fr_1fr_1fr_1fr_40px] gap-3 items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <input type="date" value={rule.effectiveFrom} onChange={e => setGstRateRules(rules => rules.map((r, i) => i === idx ? { ...r, effectiveFrom: e.target.value } : r))} className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-50" />
                            <input type="number" min="0" value={rule.threshold} onChange={e => setGstRateRules(rules => rules.map((r, i) => i === idx ? { ...r, threshold: e.target.value } : r))} className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-50" />
                            <select value={rule.rateUpToThreshold} onChange={e => setGstRateRules(rules => rules.map((r, i) => i === idx ? { ...r, rateUpToThreshold: e.target.value } : r))} className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-50">
                              {GST_RATE_OPTIONS.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                            </select>
                            <select value={rule.rateAboveThreshold} onChange={e => setGstRateRules(rules => rules.map((r, i) => i === idx ? { ...r, rateAboveThreshold: e.target.value } : r))} className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-50">
                              {GST_RATE_OPTIONS.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                            </select>
                            <button type="button" title="Remove rule" disabled={gstRateRules.length <= 1} onClick={() => setGstRateRules(rules => rules.filter((_, i) => i !== idx))} className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setGstRateRules(rules => [...rules, { effectiveFrom: '', threshold: 0, rateUpToThreshold: 5, rateAboveThreshold: 18 }])} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 px-1 py-1">
                          <Plus size={14} /> Add rate rule
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Platform Commission (₹)</label>
                        <input 
                          type="number" 
                          value={commission}
                          onChange={e => setCommission(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                          required 
                        />
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50">
                      <h3 className="text-sm font-bold text-slate-900 font-montserrat uppercase mb-4">Shipping</h3>
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-start justify-between gap-6">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Free Shipping for Customers</h4>
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed max-w-xl">
                            {freeShippingEnabled
                              ? 'On: customers pay ₹0 delivery everywhere (product page, cart, checkout). Shiprocket freight is paid from your Shiprocket account and tracked as an expense under Finance → Earnings.'
                              : 'Off: customers are charged the live Shiprocket delivery charge at checkout.'}
                            {' '}Pincode serviceability is checked either way. Applies to new orders only.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input type="checkbox" className="sr-only peer" checked={freeShippingEnabled} onChange={(e) => setFreeShippingEnabled(e.target.checked)} />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50">
                      <h3 className="text-sm font-bold text-slate-900 font-montserrat uppercase mb-4">Payment Methods & Pricing</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">COD Extra Charge</h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">Apply extra fee on Cash on Delivery orders</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={codChargeEnabled} onChange={(e) => setCodChargeEnabled(e.target.checked)} />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                          {codChargeEnabled && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Charge Amount (₹)</label>
                              <input 
                                type="number" 
                                value={codChargeAmount}
                                onChange={e => setCodChargeAmount(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                              />
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Prepaid Discount</h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">Offer discount for online paid orders</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={prepaidDiscountEnabled} onChange={(e) => setPrepaidDiscountEnabled(e.target.checked)} />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>
                          {prepaidDiscountEnabled && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Discount Amount (₹)</label>
                              <input 
                                type="number" 
                                value={prepaidDiscountAmount}
                                onChange={e => setPrepaidDiscountAmount(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold focus:ring-4 focus:ring-emerald-50 transition-all outline-none" 
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                      <AlertCircle size={20} className="text-blue-500 mt-1" />
                      <div>
                        <p className="text-[10px] font-semibold text-slate-900 uppercase tracking-widest">Global Logic Policy</p>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                          Commission rates are applied automatically platform-wide. Selling prices include GST: no GST is added at checkout,
                          and each invoice shows the GST contained in the price.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'Security' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Current Password */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Current Password</label>
                        <div className="relative flex items-center">
                          <input 
                            type={showCurrent ? "text" : "password"} 
                            placeholder="••••••••" 
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-6 pr-12 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-4 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">New Password</label>
                        <div className="relative flex items-center">
                          <input 
                            type={showNew ? "text" : "password"} 
                            placeholder="••••••••" 
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-6 pr-12 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-4 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Confirm New Password</label>
                        <div className="relative flex items-center">
                          <input 
                            type={showConfirm ? "text" : "password"} 
                            placeholder="••••••••" 
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-6 pr-12 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-4 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'Coins' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Welcome Bonus Coins</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={welcomeBonusCoins}
                          onChange={e => setWelcomeBonusCoins(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Order Reward (% of Selling Price)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={orderRewardPercentage}
                          onChange={e => setOrderRewardPercentage(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Order Reward Max Cap (Coins / Order, 0 = No Cap)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={orderRewardMaxCap}
                          onChange={e => setOrderRewardMaxCap(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Wallet Redemption (% of Product Value / Order)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={walletRedemptionPercentage}
                          onChange={e => setWalletRedemptionPercentage(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Return Window Duration (Days)</label>
                        <input 
                          type="number" 
                          value={returnWindowDays}
                          onChange={e => setReturnWindowDays(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                          min="1"
                          required 
                        />
                      </div>
                    </div>

                    {/* Features Toggle Panel */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-5">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Features Control</h3>
                      
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="welcomeBonusEnabled" 
                            checked={welcomeBonusEnabled}
                            onChange={e => setWelcomeBonusEnabled(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-50 cursor-pointer"
                          />
                          <label htmlFor="welcomeBonusEnabled" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                            Enable Welcome Bonus Coins Feature for New Users
                          </label>
                        </div>

                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="rewardCoinsEnabled" 
                            checked={rewardCoinsEnabled}
                            onChange={e => setRewardCoinsEnabled(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-50 cursor-pointer"
                          />
                          <label htmlFor="rewardCoinsEnabled" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                            Enable Order Reward Coins Feature for Delivered Orders
                          </label>
                        </div>

                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="marqueeEnabled" 
                            checked={marqueeEnabled}
                            onChange={e => setMarqueeEnabled(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-50 cursor-pointer"
                          />
                          <label htmlFor="marqueeEnabled" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                            Show Scrolling Marquee Banner on Website
                          </label>
                        </div>

                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="walletEnabled" 
                            checked={walletEnabled}
                            onChange={e => setWalletEnabled(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-50 cursor-pointer"
                          />
                          <label htmlFor="walletEnabled" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                            Enable Wallet Feature on Checkout Screen
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'Deals' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Crazy Deals */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Crazy Deals Config</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Header Name</label>
                          <input 
                            type="text" 
                            value={crazyDealsHeaderName}
                            onChange={e => setCrazyDealsHeaderName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Timer Duration (Seconds)</label>
                          <input 
                            type="number" 
                            value={crazyDealsDuration}
                            onChange={e => setCrazyDealsDuration(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                        </div>
                        <div className="flex items-center gap-3 col-span-2 pt-2">
                          <input 
                            type="checkbox" 
                            id="showCrazyDealsTimer" 
                            checked={showCrazyDealsTimer}
                            onChange={e => setShowCrazyDealsTimer(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-50"
                          />
                          <label htmlFor="showCrazyDealsTimer" className="text-xs font-bold text-slate-700 select-none">Show Countdown Timer</label>
                        </div>
                      </div>
                    </div>

                    {/* Featured Collection */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Featured Collection Config</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Header Name</label>
                          <input 
                            type="text" 
                            value={featuredCollectionHeaderName}
                            onChange={e => setFeaturedCollectionHeaderName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Timer Duration (Seconds)</label>
                          <input 
                            type="number" 
                            value={featuredCollectionDuration}
                            onChange={e => setFeaturedCollectionDuration(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                        </div>
                        <div className="flex items-center gap-3 col-span-2 pt-2">
                          <input 
                            type="checkbox" 
                            id="showFeaturedCollectionTimer" 
                            checked={showFeaturedCollectionTimer}
                            onChange={e => setShowFeaturedCollectionTimer(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-50"
                          />
                          <label htmlFor="showFeaturedCollectionTimer" className="text-xs font-bold text-slate-700 select-none">Show Countdown Timer</label>
                        </div>
                      </div>
                    </div>

                    {/* New Arrivals */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">New Arrivals Config</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Header Name</label>
                          <input 
                            type="text" 
                            value={newArrivalsHeaderName}
                            onChange={e => setNewArrivalsHeaderName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Timer Duration (Seconds)</label>
                          <input 
                            type="number" 
                            value={newArrivalsDuration}
                            onChange={e => setNewArrivalsDuration(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3.5 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                            required 
                          />
                        </div>
                        <div className="flex items-center gap-3 col-span-2 pt-2">
                          <input 
                            type="checkbox" 
                            id="showNewArrivalsTimer" 
                            checked={showNewArrivalsTimer}
                            onChange={e => setShowNewArrivalsTimer(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-50"
                          />
                          <label htmlFor="showNewArrivalsTimer" className="text-xs font-bold text-slate-700 select-none">Show Countdown Timer</label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Settings;
