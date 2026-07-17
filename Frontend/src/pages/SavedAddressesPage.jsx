import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, MapPin, MoreHorizontal, Plus, Edit2, Trash2, X, Briefcase, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';

export default function SavedAddressesPage() {
  const navigate = useNavigate();
  const { addresses, addressesLoading, addAddress, updateAddress, deleteAddress, user, fetchAddresses } = useApp();
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null); // full address object
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // id being deleted
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    pincode: '',
    type: 'Home',
    isDefault: false
  });

  const openAddModal = () => {
    setEditingAddress(null);
    setFormData({ name: '', phone: '', address: '', pincode: '', type: 'Home', isDefault: false });
    setIsModalOpen(true);
  };

  const openEditModal = (addr) => {
    setActiveMenuId(null);
    setEditingAddress(addr);
    setFormData({
      name: addr.name || '',
      phone: addr.phone || '',
      address: addr.address || '',
      pincode: addr.pincode || '',
      type: addr.type || 'Home',
      isDefault: addr.isDefault || false
    });
    setIsModalOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!formData.name.trim() || !formData.phone.trim() || !formData.address.trim() || !formData.pincode.trim()) {
      toast.info('Name, Phone, Address, and Pincode are required!');
      return;
    }
    if (/\d/.test(formData.name)) {
      toast.info('Receiver name cannot contain numerical digits!');
      return;
    }
    if (formData.pincode.trim().length !== 6) {
      toast.info('Pincode must be exactly 6 digits!');
      return;
    }
    let cleanedPhone = formData.phone.trim().replace(/\D/g, '');
    if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
      cleanedPhone = cleanedPhone.slice(2);
    } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('0')) {
      cleanedPhone = cleanedPhone.slice(1);
    }

    if (cleanedPhone.length !== 10) {
      toast.info('Phone number must be exactly 10 digits!');
      return;
    }

    setSaving(true);
    try {
      if (editingAddress) {
        const result = await updateAddress(editingAddress._id, {
          name: formData.name.trim(),
          phone: cleanedPhone,
          address: formData.address.trim(),
          pincode: formData.pincode.trim(),
          type: formData.type,
          isDefault: formData.isDefault || false
        });
        if (result.success) {
          toast.success('Address updated!');
          fetchAddresses();
          setIsModalOpen(false);
        } else {
          toast.error(result.message || 'Failed to update address');
        }
      } else {
        const result = await addAddress({
          name: formData.name.trim(),
          phone: cleanedPhone,
          address: formData.address.trim(),
          pincode: formData.pincode.trim(),
          type: formData.type,
          isDefault: formData.isDefault || false
        });
        if (result.success) {
          toast.success('Address added!');
          fetchAddresses();
          setIsModalOpen(false);
        } else {
          toast.error(result.message || 'Failed to add address');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    setActiveMenuId(null);
    setDeleting(id);
    try {
      const result = await deleteAddress(id);
      if (result.success) {
        toast.success('Address deleted');
      } else {
        toast.error(result.message || 'Failed to delete address');
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefaultAddress = async (addr) => {
    setActiveMenuId(null);
    try {
      const result = await updateAddress(addr._id, { ...addr, isDefault: true });
      if (result.success) {
        toast.success('Default address updated');
        fetchAddresses();
      } else {
        toast.error(result.message || 'Failed to set default');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  return (
    <div className="bg-surface min-h-[100dvh] font-sans pb-20 animate-fade-in relative">
      {/* Header */}
      <div className="bg-[#fff4f2] px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto px-0 md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface/50 rounded-full transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5 text-[#02006c]" />
            </button>
            <h1 className="text-[17px] font-bold text-[#02006c]">Saved Addresses</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-12 py-4">
        {/* Add New button */}
        {user && user.id && (
        <div className="px-4 py-3 flex justify-end">
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 text-[14px] font-bold text-[#0B132B] hover:text-gold cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New
          </button>
        </div>
      )}

      {/* Not logged in */}
      {!user || !user.id ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
          <h2 className="text-[16px] font-bold text-slate-700 mb-1">Please log in</h2>
          <p className="text-[13px] text-slate-400">Sign in to view and manage your saved addresses.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-5 bg-[#02006c] text-white font-bold text-[13px] px-6 py-2.5 rounded-lg hover:bg-[#02006c]/90 transition-all shadow-md active:scale-[0.98]"
          >
            Go to Login
          </button>
        </div>
      ) : addressesLoading ? (
        /* Loading state */
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-[#0B132B] animate-spin" />
          <p className="text-[13px] text-slate-400 font-medium">Loading addresses...</p>
        </div>
      ) : addresses.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-[16px] font-bold text-slate-700 mb-1">No saved addresses</h2>
          <p className="text-[13px] text-slate-400 mb-5">Add your delivery addresses for faster checkout.</p>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#0B132B] text-white font-bold text-[13px] px-6 py-2.5 rounded-lg hover:bg-gold transition-all shadow-md active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Add Address
          </button>
        </div>
      ) : (
        /* Address list */
        <div className="px-4 mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 space-y-6 md:space-y-0">
          {addresses.map((addr) => (
            <div key={addr._id} className="border-b border-white/10 pb-5 last:border-0 relative md:border md:border-white/10 md:rounded-2xl md:p-5 md:bg-surface md:shadow-3xs md:hover:border-[#0B132B] md:hover:shadow-sm transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="pt-0.5 text-slate-600">
                  {addr.type === 'Home' ? (
                    <Home className="w-5 h-5" />
                  ) : addr.type === 'Work' ? (
                    <Briefcase className="w-5 h-5" />
                  ) : (
                    <MapPin className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-bold text-slate-800">{addr.name}</h3>
                    <span className="text-[10px] font-semibold text-slate-400 bg-surface px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      {addr.type}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[9px] font-black text-white bg-emerald-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm ml-1">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-500 leading-relaxed mb-1.5">
                    {addr.address}
                    {addr.pincode && <span> - <span className="font-semibold text-slate-700">{addr.pincode}</span></span>}
                  </p>
                  <p className="text-[12px] font-bold text-slate-600">+91 {addr.phone}</p>
                </div>
              </div>

              {/* 3-dot menu button */}
              {deleting === addr._id ? (
                <div className="absolute top-1 right-2">
                  <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                </div>
              ) : (
                <button
                  onClick={() => setActiveMenuId(activeMenuId === addr._id ? null : addr._id)}
                  className="absolute top-0 right-0 p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              )}

              {/* Dropdown menu */}
              {activeMenuId === addr._id && (
                <div className="absolute top-8 right-2 bg-surface rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-white/10 py-1.5 min-w-[150px] z-10 animate-fade-in">
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefaultAddress(addr)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-surface hover:text-emerald-600 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Set as Default
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(addr)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-surface hover:text-[#02006c] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAddress(addr._id)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Click outside overlay to close menu */}
      {activeMenuId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveMenuId(null)}
        />
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0a0927]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-surface rounded-t-[32px] sm:rounded-[24px] w-full max-w-md shadow-2xl animate-slide-up sm:animate-fade-in overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-surface">
              <h3 className="text-lg font-black text-[#02006c]">
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-surface hover:bg-surface rounded-full transition-colors cursor-pointer"
                disabled={saving}
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value.replace(/\d/g, '') })}
                  className="w-full px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-[13px] focus:outline-none focus:border-[#0B132B] focus:ring-1 focus:ring-[#0B132B]/20 transition-all"
                  placeholder="Enter full name"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-[13px] focus:outline-none focus:border-[#0B132B] focus:ring-1 focus:ring-[#0B132B]/20 transition-all"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Address Details</label>
                <textarea
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-[13px] focus:outline-none focus:border-[#0B132B] focus:ring-1 focus:ring-[#0B132B]/20 transition-all resize-none"
                  placeholder="House No, Building, Street, City"
                />
              </div>

              {/* Pincode */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700">Pincode</label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={e => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-[13px] focus:outline-none focus:border-[#0B132B] focus:ring-1 focus:ring-[#0B132B]/20 transition-all"
                  placeholder="6-digit pincode"
                  maxLength={6}
                />
              </div>

              {/* Address Type */}
              <div className="space-y-2 pt-1">
                <label className="text-[13px] font-bold text-slate-700 block">Address Type</label>
                <div className="flex gap-4 mb-3">
                  {['Home', 'Work', 'Location'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="type"
                        value={type}
                        checked={formData.type === type}
                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                        className="w-4 h-4 text-[#0B132B] border-white/10 focus:ring-[#0B132B]"
                      />
                      <span className="text-[13px] text-slate-700 group-hover:text-slate-900 font-medium">
                        {type === 'Location' ? 'Other' : type}
                      </span>
                    </label>
                  ))}
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-[#0B132B] border-white/10 focus:ring-[#0B132B]"
                  />
                  <span className="text-[13px] text-slate-700 group-hover:text-slate-900 font-bold">
                    Set as default address
                  </span>
                </label>
              </div>
            </div>

            {/* Save button */}
            <div className="p-4 bg-surface border-t border-white/10 shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
              <button
                onClick={handleSaveAddress}
                disabled={saving}
                className="w-full bg-[#02006c] hover:bg-[#02006c]/90 text-white font-bold py-3.5 rounded-lg active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Address'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
