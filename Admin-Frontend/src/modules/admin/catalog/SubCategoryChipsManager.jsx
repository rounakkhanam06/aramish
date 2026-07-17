import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, GripVertical, Save, X,
  CheckCircle2, Layers, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../../utils/toast';
import ConfirmModal from '../../../components/ConfirmModal';
import OptimizedImage from '../../../components/common/OptimizedImage';
import { getImageUrl } from '../../../utils/imageHelper';

const EMPTY_SUB = { categoryId: '', subCategoryName: '', image: '', active: true };


// Form component defined outside to avoid input focus loss
const SubCategoryForm = ({ onSave, onCancel, label, formData, setFormData, imagePreview, setImageFile, setImagePreview, categories }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-3"
  >
    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{label}</p>
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Parent Category *</label>
        <select
          value={formData.categoryId}
          onChange={e => setFormData(p => ({ ...p, categoryId: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        >
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat._id} value={cat._id}>
              {cat.categoryName || cat.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subcategory Name *</label>
        <input
          value={formData.subCategoryName}
          onChange={e => setFormData(p => ({ ...p, subCategoryName: e.target.value }))}
          placeholder="e.g. Lipsticks"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
      </div>
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Image Upload *</label>
        <div className="flex items-center gap-2">
          <OptimizedImage src={imagePreview} className="w-9 h-9 rounded-lg object-contain bg-white border border-slate-200 p-0.5" alt="Preview" type="subcategory" objectFit="contain" />
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

const SubCategoryChipsManager = () => {
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [filterCategoryId, setFilterCategoryId] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SUB);
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

  const fetchCategories = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/chips`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(data.chips);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load categories');
    }
  };

  const fetchSubChips = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/subchips`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSubCategories(data.subchips);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load subcategory chips');
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSubChips();
  }, []);

  const handleToggle = async (id) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const sub = subCategories.find(c => c.id === id);
    if (!sub) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/subchips/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          active: !sub.active
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Visibility toggled!');
        fetchSubChips();
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
      'Delete Subcategory',
      'Are you sure you want to permanently delete this subcategory chip?',
      async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/admin/catalog/subchips/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            toast.success(data.message || 'Subcategory chip deleted!');
            fetchSubChips();
          } else {
            toast.error(data.message || 'Failed to delete subcategory chip');
          }
        } catch (err) {
          console.error(err);
          toast.error('Could not connect to backend server');
        }
      }
    );
  };

  const handleEdit = (sub) => {
    setEditingId(sub.id);
    setFormData({ categoryId: sub.categoryId, subCategoryName: sub.subCategoryName, image: sub.image, active: sub.active });
    setImagePreview(sub.image || '');
    setImageFile(null);
    setIsAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!formData.categoryId || !formData.subCategoryName) {
      toast.info('Category and Subcategory Name are required!');
      return;
    }
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const bodyFormData = new FormData();
      bodyFormData.append('categoryId', formData.categoryId);
      bodyFormData.append('subCategoryName', formData.subCategoryName);
      bodyFormData.append('active', formData.active);
      if (imageFile) {
        bodyFormData.append('image', imageFile);
      }

      const res = await fetch(`${apiBase}/admin/catalog/subchips/${editingId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Subcategory chip updated!');
        fetchSubChips();
        setEditingId(null);
        setFormData(EMPTY_SUB);
        setImageFile(null);
        setImagePreview('');
      } else {
        toast.error(data.message || 'Failed to update subcategory chip');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleAddNew = async () => {
    if (!formData.categoryId || !formData.subCategoryName) {
      toast.info('Category and Subcategory Name are required!');
      return;
    }
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const bodyFormData = new FormData();
      bodyFormData.append('categoryId', formData.categoryId);
      bodyFormData.append('subCategoryName', formData.subCategoryName);
      bodyFormData.append('active', formData.active);
      bodyFormData.append('order', subCategories.length + 1);
      if (imageFile) {
        bodyFormData.append('image', imageFile);
      }

      const res = await fetch(`${apiBase}/admin/catalog/subchips`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Subcategory chip added!');
        fetchSubChips();
        setIsAdding(false);
        setFormData(EMPTY_SUB);
        setImageFile(null);
        setImagePreview('');
      } else {
        toast.error(data.message || 'Failed to add subcategory chip');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleSaveAll = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const filteredSubCategories = filterCategoryId === 'all'
    ? subCategories
    : subCategories.filter(sub => sub.categoryId === filterCategoryId);

  const activeCount = filteredSubCategories.filter(c => c.active).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-montserrat uppercase">Subcategory Chips Manager</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 font-raleway">Create subcategory chips mapping to each main category</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); setFormData(EMPTY_SUB); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={13} /> Add Subcategory
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
          { label: 'Total Subcategories', value: filteredSubCategories.length, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Visible', value: activeCount, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Hidden', value: filteredSubCategories.length - activeCount, color: 'text-slate-400', bg: 'bg-slate-50' },
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

      {/* ─── Add/Edit Form ─── */}
      <AnimatePresence>
        {isAdding && (
          <SubCategoryForm
            label="Add new subcategory chip"
            onSave={handleAddNew}
            onCancel={() => { setIsAdding(false); setFormData(EMPTY_SUB); setImageFile(null); setImagePreview(''); }}
            formData={formData}
            setFormData={setFormData}
            imagePreview={imagePreview}
            setImageFile={setImageFile}
            setImagePreview={setImagePreview}
            categories={categories}
          />
        )}
      </AnimatePresence>

      {/* Subcategory List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest font-montserrat">Subcategory Nav Chips</h2>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by Category:</span>
            <select
              value={filterCategoryId}
              onChange={e => setFilterCategoryId(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1 text-[11px] font-bold outline-none bg-white cursor-pointer hover:border-slate-300"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat._id}>
                  {cat.categoryName || cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {filteredSubCategories.map((sub, index) => {
              const parentCat = categories.find(c => c._id === sub.categoryId);
              const parentName = parentCat ? (parentCat.categoryName || parentCat.name) : sub.categoryId;

              return (
                <motion.div
                  key={sub.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.02 }}
                >
                  {editingId === sub.id ? (
                    <SubCategoryForm
                      label={`Editing: "${sub.subCategoryName}"`}
                      onSave={handleSaveEdit}
                      onCancel={() => { setEditingId(null); setFormData(EMPTY_SUB); setImageFile(null); setImagePreview(''); }}
                      formData={formData}
                      setFormData={setFormData}
                      imagePreview={imagePreview}
                      setImageFile={setImageFile}
                      setImagePreview={setImagePreview}
                      categories={categories}
                    />
                  ) : (
                    <div className={`bg-white border rounded-xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group ${!sub.active ? 'opacity-50 border-slate-100' : 'border-slate-100'}`}>
                      <div className="text-slate-300 cursor-grab">
                        <GripVertical size={14} />
                      </div>
                      {/* Order */}
                      <span className="text-[10px] font-black text-slate-300 w-5 text-center font-roboto">#{index + 1}</span>
                      {/* Image */}
                      <div className="w-9 h-9 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 flex-shrink-0">
                        <OptimizedImage src={sub.image} className="w-full h-full object-contain p-0.5" alt="icon" type="subcategory" objectFit="contain" />
                      </div>
                      {/* Info */}
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-slate-900 font-montserrat leading-tight">{sub.subCategoryName}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter font-roboto">
                          Parent: <span className="text-blue-500">{parentName}</span>
                        </p>
                      </div>
                      {/* Status */}
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${sub.active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        {sub.active ? 'Visible' : 'Hidden'}
                      </span>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggle(sub.id)}
                          className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${
                            sub.active ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <motion.div
                            layout
                            className="w-3 h-3 rounded-full bg-white shadow-sm"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </button>
                        <button onClick={() => handleEdit(sub)} className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(sub.id)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
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

export default SubCategoryChipsManager;
