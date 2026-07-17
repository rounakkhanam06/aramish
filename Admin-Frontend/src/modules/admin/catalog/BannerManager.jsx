import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, GripVertical, Save, X,
  CheckCircle2, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../../utils/toast';
import ConfirmModal from '../../../components/ConfirmModal';
import OptimizedImage from '../../../components/common/OptimizedImage';

const EMPTY_BANNER = { title: '', subtitle: '', image: '', active: true };

// Define BannerForm OUTSIDE of BannerManager to prevent recreating the component on every state change.
const BannerForm = ({
  formData,
  setFormData,
  onSave,
  onCancel,
  label,
  imagePreview,
  setImageFile,
  setImagePreview
}) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-3 mb-4"
  >
    <div className="flex justify-between items-center border-b border-blue-100 pb-2">
      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{label}</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Banner Title *</label>
        <input
          value={formData.title}
          onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
          placeholder="e.g. Summer Sale"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
      </div>
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subtitle</label>
        <input
          value={formData.subtitle}
          onChange={e => setFormData(p => ({ ...p, subtitle: e.target.value }))}
          placeholder="e.g. Up to 70% Off"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
      </div>
      <div className="col-span-2">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1.5 flex-wrap">
          <span>Banner Image *</span>
          <span className="text-[11px] font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1 animate-pulse normal-case tracking-normal">
            ⚠️ Recommended: 1920 × 768 px (2.5:1 ratio)
          </span>
        </label>
        <div className="flex items-center gap-2">
          <OptimizedImage src={imagePreview} className="w-20 h-10 rounded-lg object-cover border border-slate-200" alt="Preview" type="banner" />
          <label className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-all select-none">
            Upload File
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 10 * 1024 * 1024) {
                    toast.error('Image size cannot exceed 10MB!');
                    return;
                  }
                  
                  // Validation warning for aspect ratio
                  const img = new window.Image();
                  img.src = URL.createObjectURL(file);
                  img.onload = () => {
                    const ratio = img.width / img.height;
                    if (ratio < 2.0) {
                      toast.info("Warning: For best display, please upload a landscape image (Recommended: 1920 × 768 px / 2.5:1 ratio).", {
                        duration: 6000
                      });
                    }
                  };

                  setImageFile(file);
                  setImagePreview(URL.createObjectURL(file));
                }
              }}
            />
          </label>
          <span className="text-[9px] text-slate-400 font-bold">Or URL:</span>
          <input
            value={formData.image || ''}
            onChange={e => {
              setFormData(p => ({ ...p, image: e.target.value }));
              setImagePreview(e.target.value);
              setImageFile(null);
            }}
            placeholder="https://..."
            className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold outline-none"
          />
        </div>
      </div>
      <div className="flex items-end gap-3 col-span-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.active}
            onChange={e => setFormData(p => ({ ...p, active: e.target.checked }))}
            className="accent-blue-500 w-4 h-4"
          />
          <span className="text-[11px] font-bold text-slate-600">Active on publish</span>
        </label>
      </div>
    </div>
    <div className="flex gap-2">
      <button onClick={onSave} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5">
        <Save size={12} /> Save Banner
      </button>
      <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-1.5">
        <X size={12} /> Cancel
      </button>
    </div>
  </motion.div>
);

const BannerManager = () => {
  const [banners, setBanners] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_BANNER);
  const [saved, setSaved] = useState(false);

  // File Upload State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

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

  const fetchBanners = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/banners`);
      const data = await res.json();
      if (res.ok && data.success) {
        setBanners(data.banners.map(b => ({
          id: b._id,
          title: b.title,
          subtitle: b.subtitle,
          image: b.image,
          active: b.active
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load banners from server');
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const uploadBannerImage = async (file) => {
    const token = localStorage.getItem('adminToken');
    if (!token) throw new Error('Unauthorized');
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const bodyFormData = new FormData();
    bodyFormData.append('image', file);
    const res = await fetch(`${apiBase}/admin/catalog/banners/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: bodyFormData
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Image upload failed');
    }
    return data.url;
  };

  const handleToggle = async (id) => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Unauthorized');
      return;
    }

    const banner = banners.find(b => b.id === id);
    if (!banner) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/banners/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !banner.active })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBanners(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
        toast.success('Banner visibility updated successfully!');
      } else {
        toast.error(data.message || 'Failed to update visibility');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleDelete = (id) => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Unauthorized');
      return;
    }

    triggerConfirm(
      'Delete Banner',
      'Are you sure you want to permanently delete this banner?',
      async () => {
        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/admin/catalog/banners/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setBanners(prev => prev.filter(b => b.id !== id));
            toast.success('Banner deleted successfully!');
          } else {
            toast.error(data.message || 'Failed to delete banner');
          }
        } catch (err) {
          console.error(err);
          toast.error('Could not connect to backend server');
        }
      }
    );
  };

  const handleEdit = (banner) => {
    setEditingId(banner.id);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle,
      image: banner.image,
      active: banner.active
    });
    setImagePreview(banner.image || '');
    setImageFile(null);
    setIsAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!formData.title) return;
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Unauthorized');
      return;
    }

    try {
      let imageUrl = formData.image;
      if (imageFile) {
        toast.loading('Uploading banner image...', { id: 'upload' });
        imageUrl = await uploadBannerImage(imageFile);
        toast.dismiss('upload');
      }

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/banners/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          subtitle: formData.subtitle || '',
          image: imageUrl,
          active: formData.active
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingId(null);
        setFormData(EMPTY_BANNER);
        setImageFile(null);
        setImagePreview('');
        toast.success('Banner updated successfully!');
        fetchBanners();
      } else {
        toast.error(data.message || 'Failed to update banner');
      }
    } catch (err) {
      console.error(err);
      toast.dismiss('upload');
      toast.error(err.message || 'Failed to update banner');
    }
  };

  const handleAddNew = async () => {
    if (!formData.title) return;
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Unauthorized');
      return;
    }

    try {
      let imageUrl = formData.image;
      if (imageFile) {
        toast.loading('Uploading banner image...', { id: 'upload' });
        imageUrl = await uploadBannerImage(imageFile);
        toast.dismiss('upload');
      }

      if (!imageUrl) {
        toast.info('Image is required');
        return;
      }

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/banners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          subtitle: formData.subtitle || '',
          image: imageUrl,
          active: formData.active
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdding(false);
        setFormData(EMPTY_BANNER);
        setImageFile(null);
        setImagePreview('');
        toast.success('Banner created successfully!');
        fetchBanners();
      } else {
        toast.error(data.message || 'Failed to create banner');
      }
    } catch (err) {
      console.error(err);
      toast.dismiss('upload');
      toast.error(err.message || 'Failed to add banner');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Banner Manager</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 font-raleway">Control banners shown in the user home carousel</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); setFormData(EMPTY_BANNER); setImagePreview(''); setImageFile(null); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={13} /> Add Banner
          </button>
        </div>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <BannerForm
            label={`Creating new banner`}
            formData={formData}
            setFormData={setFormData}
            imagePreview={imagePreview}
            setImageFile={setImageFile}
            setImagePreview={setImagePreview}
            onSave={handleAddNew}
            onCancel={() => { setIsAdding(false); setFormData(EMPTY_BANNER); setImagePreview(''); setImageFile(null); }}
          />
        )}
      </AnimatePresence>

      {/* Banner List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {banners.map((banner, index) => (
            <motion.div
              key={banner.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.03 }}
            >
              {editingId === banner.id ? (
                <BannerForm
                  label={`Editing banner`}
                  formData={formData}
                  setFormData={setFormData}
                  imagePreview={imagePreview}
                  setImageFile={setImageFile}
                  setImagePreview={setImagePreview}
                  onSave={handleSaveEdit}
                  onCancel={() => { setEditingId(null); setFormData(EMPTY_BANNER); setImagePreview(''); setImageFile(null); }}
                />
              ) : (
                <div className={`bg-white border rounded-xl overflow-hidden flex items-stretch gap-0 shadow-sm hover:shadow-md transition-all group ${!banner.active ? 'opacity-50' : 'border-slate-100'}`}>
                  {/* Drag Handle */}
                  <div className="w-8 flex items-center justify-center bg-slate-50 border-r border-slate-100 text-slate-300 cursor-grab">
                    <GripVertical size={16} />
                  </div>
                  {/* Image Preview */}
                  <div className="w-32 h-20 bg-slate-100 flex-shrink-0 overflow-hidden relative">
                    <OptimizedImage src={banner.image} alt={banner.title} type="banner" className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <span className={`absolute bottom-1.5 left-2 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${banner.active ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'}`}>
                      {banner.active ? 'Live' : 'Hidden'}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 px-4 py-3 flex flex-col justify-center">
                    <h3 className="text-[13px] font-bold text-slate-900 font-montserrat">{banner.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{banner.subtitle || '—'}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 px-4">
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggle(banner.id)}
                      className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${
                        banner.active ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <motion.div
                        layout
                        className="w-3 h-3 rounded-full bg-white shadow-sm"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                    <button onClick={() => handleEdit(banner)} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(banner.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {banners.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-100 rounded-xl py-16 flex flex-col items-center gap-3 text-slate-300">
            <ImageIcon size={36} />
            <p className="text-[11px] font-black uppercase tracking-widest">No banners created yet</p>
            <button onClick={() => { setIsAdding(true); setFormData(EMPTY_BANNER); setImagePreview(''); setImageFile(null); }} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-1.5">
              <Plus size={12} /> Add First Banner
            </button>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <ImageIcon size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">How it works</p>
          <p className="text-[11px] text-blue-400 font-medium mt-1 leading-relaxed">
            Banners are shown in the carousel on the <strong>user home page</strong>. All actions (adding, editing, toggling visibility, or deleting) are saved live immediately to the database.
          </p>
        </div>
      </div>
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

export default BannerManager;
