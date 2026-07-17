import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Shield, Lock, Save, CheckCircle2, ChevronRight, AlertCircle, Camera, Eye, EyeOff, Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../utils/toast';
import OptimizedImage from '../../components/common/OptimizedImage';

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
  const [gstNo, setGstNo] = useState('');
  const [commission, setCommission] = useState(10);
  const [gstPercentage, setGstPercentage] = useState(18);

  // Coins settings states
  const [coinConversionEnabled, setCoinConversionEnabled] = useState(true);
  const [coinsPerRupee, setCoinsPerRupee] = useState(100);
  const [minimumRedeemCoins, setMinimumRedeemCoins] = useState(500);
  const [maximumRedeemPerOrder, setMaximumRedeemPerOrder] = useState(10000);

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
        setGstNo(s.gstNo || '');
        setCommission(s.commission ?? 10);
        setGstPercentage(s.gstPercentage ?? 18);
        setCoinConversionEnabled(s.coinConversionEnabled ?? true);
        setCoinsPerRupee(s.coinsPerRupee ?? 100);
        setMinimumRedeemCoins(s.minimumRedeemCoins ?? 500);
        setMaximumRedeemPerOrder(s.maximumRedeemPerOrder ?? 10000);
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
            gstNo,
            commission,
            gstPercentage
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
        // Save Platform commission & GST rate
        const settingsRes = await fetch(`${apiBase}/admin/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            helpline,
            gstNo,
            commission,
            gstPercentage
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
            coinConversionEnabled,
            coinsPerRupee: Number(coinsPerRupee),
            minimumRedeemCoins: Number(minimumRedeemCoins),
            maximumRedeemPerOrder: Number(maximumRedeemPerOrder)
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
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Tax Registration Number (GSTIN)</label>
                        <input 
                          type="text" 
                          value={gstNo} 
                          onChange={e => setGstNo(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'Business' && (
                  <div className="space-y-8">
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Global GST Percentage (%)</label>
                        <input 
                          type="number" 
                          value={gstPercentage}
                          onChange={e => setGstPercentage(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                          required 
                        />
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                      <AlertCircle size={20} className="text-blue-500 mt-1" />
                      <div>
                        <p className="text-[10px] font-semibold text-slate-900 uppercase tracking-widest">Global Logic Policy</p>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                          Commission rates and Global GST percentage are applied automatically platform-wide.
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Coins Per Rupee (e.g. 100)</label>
                        <input 
                          type="number" 
                          value={coinsPerRupee}
                          onChange={e => setCoinsPerRupee(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-semibold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Minimum Redeem Coins</label>
                        <input 
                          type="number" 
                          value={minimumRedeemCoins}
                          onChange={e => setMinimumRedeemCoins(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                          required 
                        />
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
