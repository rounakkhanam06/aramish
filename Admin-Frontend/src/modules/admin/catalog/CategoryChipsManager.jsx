import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, GripVertical, Save, X,
  CheckCircle2, Eye, EyeOff, Layers, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ConfirmModal from '../../../components/ConfirmModal';
import OptimizedImage from '../../../components/common/OptimizedImage';
import { getImageUrl } from '../../../utils/imageHelper';

const BANNER_TABS = ['Home', 'Fashion', 'Beauty', 'Toys', 'Electronics', 'Jewellery', 'Art. Jewellery', '1g Gold', 'Cosmetics'];

const EMPTY_CAT = { categoryName: '', image: '', active: true };


// Define CategoryForm OUTSIDE of CategoryChipsManager to prevent recreating the component on every state change (which causes loss of focus/keyboard re-rendering).
const CategoryForm = ({ onSave, onCancel, label, formData, setFormData, imagePreview, setImageFile, setImagePreview }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-3"
  >
    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{label}</p>
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category Name *</label>
        <input
          value={formData.categoryName}
          onChange={e => setFormData(p => ({ ...p, categoryName: e.target.value }))}
          placeholder="e.g. Home Decor"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
      </div>
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Image Upload *</label>
        <div className="flex items-center gap-2">
          <OptimizedImage src={imagePreview} className="w-9 h-9 rounded-lg object-contain bg-white border border-slate-200 p-0.5" alt="Preview" type="category" objectFit="contain" />
          <label className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-all select-none">
            Upload
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
                  setImageFile(file);
                  setImagePreview(URL.createObjectURL(file));
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={formData.active}
        onChange={e => setFormData(p => ({ ...p, active: e.target.checked }))}
        className="accent-blue-500 w-4 h-4"
      />
      <span className="text-[11px] font-bold text-slate-600">Visible in app</span>
    </label>
    <div className="flex gap-2">
      <button onClick={onSave} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5">
        <Save size={12} /> Save
      </button>
      <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-1.5">
        <X size={12} /> Cancel
      </button>
    </div>
  </motion.div>
);

const CategoryChipsManager = () => {
  const [categories, setCategories] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_CAT);
  const [saved, setSaved] = useState(false);

  // File Upload State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  // Banner tabs section
  const [bannerTabs, setBannerTabs] = useState(BANNER_TABS);
  const [newTabName, setNewTabName] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);

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

  const fetchChips = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/chips`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(data.chips);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load category chips from server');
    }
  };

  useEffect(() => {
    fetchChips();
  }, []);

  const handleToggle = async (id) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/chips/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          active: !cat.active
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Visibility toggled!');
        fetchChips();
      } else {
        toast.error(data.message || 'Failed to toggle visibility');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleDelete = async (id) => {
    triggerConfirm(
      'Delete Category',
      'Are you sure you want to permanently delete this category chip?',
      async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/admin/catalog/chips/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            toast.success(data.message || 'Category chip deleted!');
            fetchChips();
          } else {
            toast.error(data.message || 'Failed to delete category chip');
          }
        } catch (err) {
          console.error(err);
          toast.error('Could not connect to backend server');
        }
      }
    );
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setFormData({ categoryName: cat.categoryName, image: cat.image, active: cat.active });
    setImagePreview(cat.image || '');
    setImageFile(null);
    setIsAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!formData.categoryName) return;
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const bodyFormData = new FormData();
      bodyFormData.append('categoryName', formData.categoryName);
      bodyFormData.append('active', formData.active);
      if (imageFile) {
        bodyFormData.append('image', imageFile);
      }

      const res = await fetch(`${apiBase}/admin/catalog/chips/${editingId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Category chip updated!');
        fetchChips();
        setEditingId(null);
        setFormData(EMPTY_CAT);
        setImageFile(null);
        setImagePreview('');
      } else {
        toast.error(data.message || 'Failed to update category chip');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleAddNew = async () => {
    if (!formData.categoryName) return;
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const bodyFormData = new FormData();
      bodyFormData.append('categoryName', formData.categoryName);
      bodyFormData.append('active', formData.active);
      bodyFormData.append('order', categories.length + 1);
      if (imageFile) {
        bodyFormData.append('image', imageFile);
      }

      const res = await fetch(`${apiBase}/admin/catalog/chips`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Category chip added!');
        fetchChips();
        setIsAdding(false);
        setFormData(EMPTY_CAT);
        setImageFile(null);
        setImagePreview('');
      } else {
        toast.error(data.message || 'Failed to add category chip');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleAddTab = () => {
    if (!newTabName.trim()) return;
    setBannerTabs(prev => [...prev, newTabName.trim()]);
    setNewTabName('');
    setIsAddingTab(false);
  };

  const handleSaveAll = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const activeCount = categories.filter(c => c.active).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-montserrat uppercase">Category & Tab Manager</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 font-raleway">Control the category chips & banner tabs shown in the user app</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); setFormData(EMPTY_CAT); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={13} /> Add Category
          </button>
          <button
            onClick={handleSaveAll}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${saved ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saved ? 'Saved!' : 'Publish Changes'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        {[
          { label: 'Total', value: categories.length, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Visible', value: activeCount, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Hidden', value: categories.length - activeCount, color: 'text-slate-400', bg: 'bg-slate-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
              <LayoutGrid size={16} />
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-lg font-black text-slate-900 font-roboto leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── SECTION 1: Category Chips (CategoryNavbar) ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest font-montserrat">Category Nav Chips</h2>
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Appears in top scrollable nav bar</span>
        </div>

        {/* Live Preview */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 overflow-x-auto no-scrollbar shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Preview</p>
          <div className="flex gap-2.5 flex-nowrap">
            {categories.filter(c => c.active).map((cat) => (
              <div key={cat.id} className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/30 border border-slate-100 flex-shrink-0 transition-all cursor-pointer hover:scale-[1.03]">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200/50 shadow-inner">
                  <OptimizedImage src={cat.image} className="w-full h-full" alt="" type="category" />
                </div>
                <span className="text-[9px] font-bold text-slate-700 whitespace-nowrap">{cat.categoryName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {isAdding && (
            <CategoryForm
              label="Add new category chip"
              onSave={handleAddNew}
              onCancel={() => { setIsAdding(false); setFormData(EMPTY_CAT); setImageFile(null); setImagePreview(''); }}
              formData={formData}
              setFormData={setFormData}
              imagePreview={imagePreview}
              setImageFile={setImageFile}
              setImagePreview={setImagePreview}
            />
          )}
        </AnimatePresence>

        {/* Category List */}
        <div className="space-y-2">
          <AnimatePresence>
            {categories.map((cat, index) => (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.02 }}
              >
                {editingId === cat.id ? (
                  <CategoryForm
                    label={`Editing: "${cat.categoryName}"`}
                    onSave={handleSaveEdit}
                    onCancel={() => { setEditingId(null); setFormData(EMPTY_CAT); setImageFile(null); setImagePreview(''); }}
                    formData={formData}
                    setFormData={setFormData}
                    imagePreview={imagePreview}
                    setImageFile={setImageFile}
                    setImagePreview={setImagePreview}
                  />
                ) : (
                  <div className={`bg-white border rounded-xl p-3.5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group ${!cat.active ? 'opacity-60 border-slate-100' : 'border-slate-100'}`}>
                    <div className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1 transition-colors">
                      <GripVertical size={15} />
                    </div>
                    {/* Order */}
                    <span className="text-[11px] font-black text-slate-300 w-6 text-center font-roboto">#{index + 1}</span>
                    {/* Image */}
                    <div className="w-10 h-10 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 flex-shrink-0 shadow-sm">
                      <OptimizedImage src={cat.image} className="w-full h-full object-contain p-0.5" alt="icon" type="category" objectFit="contain" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 font-montserrat leading-tight truncate">{cat.categoryName}</p>
                    </div>
                    {/* Status */}
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${cat.active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      {cat.active ? 'Visible' : 'Hidden'}
                    </span>
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Toggle Switch */}
                      <button
                        onClick={() => handleToggle(cat.id)}
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${
                          cat.active ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <motion.div
                          layout
                          className="w-3 h-3 rounded-full bg-white shadow-sm"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                      <button onClick={() => handleEdit(cat)} className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Layers size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">How it works</p>
          <p className="text-[11px] text-blue-400 font-medium mt-1 leading-relaxed">
            <strong>Category Chips</strong> appear in the scrollable navigation bar at the top of the user home page.
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

export default CategoryChipsManager;
