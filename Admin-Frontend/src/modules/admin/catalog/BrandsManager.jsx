import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit2, Save, X,
  CheckCircle2, Eye, EyeOff, Tag, Star, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ConfirmModal from '../../../components/ConfirmModal';
import OptimizedImage from '../../../components/common/OptimizedImage';
import { getImageUrl } from '../../../utils/imageHelper';

const EMPTY_BRAND = { name: '', description: '', isTrending: false, status: 'Active' };


const BrandForm = ({ onSave, onCancel, label, formData, setFormData, logoPreview, setLogoFile, setLogoPreview }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="bg-blue-50/60 border border-blue-100 rounded-xl p-5 space-y-4 shadow-sm"
  >
    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{label}</p>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Brand Name *</label>
        <input
          value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Nike, Puma"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
      </div>

      <div>
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
        <select
          value={formData.status}
          onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
    </div>

    <div>
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</label>
      <textarea
        value={formData.description}
        onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
        placeholder="Brief description of the brand..."
        rows={2}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-200 bg-white resize-none"
      />
    </div>

    <div className="border border-slate-200/60 bg-white rounded-lg p-3">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Logo Upload *</label>
      <div className="flex items-center gap-3">
        {logoPreview ? (
          <img src={getImageUrl(logoPreview)} className="w-12 h-12 rounded-lg object-contain border border-slate-100" alt="Logo Preview" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold">No Logo</div>
        )}
        <label htmlFor="brand-logo-input" className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-all select-none">
          Upload Logo
        </label>
        <input
          id="brand-logo-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              if (file.size > 10 * 1024 * 1024) {
                toast.error('Logo image size cannot exceed 10MB!');
                return;
              }
              setLogoFile(file);
              setLogoPreview(URL.createObjectURL(file));
            }
          }}
        />
      </div>
    </div>

    <label className="flex items-center gap-2 cursor-pointer pt-1 select-none">
      <input
        type="checkbox"
        checked={formData.isTrending}
        onChange={e => setFormData(p => ({ ...p, isTrending: e.target.checked }))}
        className="accent-blue-500 w-4 h-4 cursor-pointer"
      />
      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
        <Star size={12} className="text-amber-500 fill-amber-500" />
        Feature as Trending Brand on Homepage
      </span>
    </label>

    <div className="flex gap-2 pt-1">
      <button onClick={onSave} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm">
        <Save size={12} /> Save Brand
      </button>
      <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-1.5">
        <X size={12} /> Cancel
      </button>
    </div>
  </motion.div>
);

const BrandsManager = () => {
  const [brands, setBrands] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_BRAND);
  
  // File Upload State
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
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

  const fetchBrands = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${apiBase}/admin/catalog/brands/all/admin`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBrands(data.brands);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load brands from server');
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleToggleStatus = async (brand) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const nextStatus = brand.status === 'Active' ? 'Inactive' : 'Active';

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const bodyFormData = new FormData();
      bodyFormData.append('status', nextStatus);

      const res = await fetch(`${apiBase}/admin/catalog/brands/${brand._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Brand status set to ${nextStatus}!`);
        fetchBrands();
      } else {
        toast.error(data.message || 'Failed to update brand status');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleDelete = async (id) => {
    triggerConfirm(
      'Delete Brand',
      'Are you sure you want to permanently delete this brand? This action cannot be undone and will fail if products are linked.',
      async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/admin/catalog/brands/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            toast.success(data.message || 'Brand deleted successfully!');
            fetchBrands();
          } else {
            toast.error(data.message || 'Failed to delete brand. Disable it instead.');
          }
        } catch (err) {
          console.error(err);
          toast.error('Could not connect to backend server');
        }
      }
    );
  };

  const handleEdit = (brand) => {
    setEditingId(brand._id);
    setFormData({
      name: brand.name,
      description: brand.description || '',
      isTrending: brand.isTrending || false,
      status: brand.status || 'Active'
    });
    setLogoPreview(brand.logo || '');
    setLogoFile(null);
    setIsAdding(false);
  };

  const handleSaveEdit = async () => {
    if (!formData.name) {
      toast.error('Brand name is required');
      return;
    }
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const bodyFormData = new FormData();
      bodyFormData.append('name', formData.name);
      bodyFormData.append('description', formData.description);
      bodyFormData.append('isTrending', formData.isTrending);
      bodyFormData.append('status', formData.status);
      
      if (logoFile) {
        bodyFormData.append('logo', logoFile);
      }

      const res = await fetch(`${apiBase}/admin/catalog/brands/${editingId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Brand updated successfully!');
        fetchBrands();
        setEditingId(null);
        setFormData(EMPTY_BRAND);
        setLogoFile(null);
        setLogoPreview('');
      } else {
        toast.error(data.message || 'Failed to update brand');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Brand name is required');
      return;
    }
    if (!logoPreview) {
      toast.error('Brand logo is required');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const bodyFormData = new FormData();
      bodyFormData.append('name', formData.name);
      bodyFormData.append('description', formData.description);
      bodyFormData.append('isTrending', formData.isTrending);
      bodyFormData.append('status', formData.status);

      if (logoFile) {
        bodyFormData.append('logo', logoFile);
      }

      const res = await fetch(`${apiBase}/admin/catalog/brands`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Brand created successfully!');
        fetchBrands();
        setIsAdding(false);
        setFormData(EMPTY_BRAND);
        setLogoFile(null);
        setLogoPreview('');
      } else {
        toast.error(data.message || 'Failed to create brand');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[22px] font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Tag className="text-orange-500" />
            Brands Manager
          </h2>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Configure manufacturer profiles, logos, store banners, and configure trending brands for homepage.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => {
              setIsAdding(true);
              setFormData(EMPTY_BRAND);
              setLogoFile(null);
              setLogoPreview('');
            }}
            className="px-4 py-2 bg-[#0B132B] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus size={14} /> Add Brand
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isAdding && (
          <BrandForm
            key="add-form"
            label="Create New Brand"
            formData={formData}
            setFormData={setFormData}
            logoPreview={logoPreview}
            setLogoFile={setLogoFile}
            setLogoPreview={setLogoPreview}
            onSave={handleCreate}
            onCancel={() => {
              setIsAdding(false);
              setFormData(EMPTY_BRAND);
            }}
          />
        )}

        {editingId && (
          <BrandForm
            key="edit-form"
            label="Edit Existing Brand"
            formData={formData}
            setFormData={setFormData}
            logoPreview={logoPreview}
            setLogoFile={setLogoFile}
            setLogoPreview={setLogoPreview}
            onSave={handleSaveEdit}
            onCancel={() => {
              setEditingId(null);
              setFormData(EMPTY_BRAND);
            }}
          />
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80">
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Logo</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Brand Name</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Trending</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brands.map((brand) => (
                <tr 
                  key={brand._id} 
                  className={`hover:bg-slate-50/40 transition-colors ${
                    brand.status === 'Inactive' ? 'opacity-70 bg-slate-50/20' : ''
                  }`}
                >
                  {/* Logo */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden">
                      <img
                        src={getImageUrl(brand.logo)}
                        alt={`${brand.name} Logo`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </td>

                  {/* Brand Name */}
                  <td className="px-6 py-4 whitespace-nowrap font-extrabold text-slate-800 text-sm">
                    {brand.name}
                  </td>

                  {/* Description */}
                  <td className="px-6 py-4 max-w-xs md:max-w-sm">
                    <p className="text-xs font-medium text-slate-500 truncate">
                      {brand.description || 'No description provided.'}
                    </p>
                  </td>

                  {/* Trending */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {brand.isTrending ? (
                      <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                        <Star size={8} className="fill-current animate-pulse" /> Trending
                      </span>
                    ) : (
                      <span className="text-xs font-black text-slate-300">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        brand.status === 'Active'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-400 text-white'
                      }`}
                    >
                      {brand.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleToggleStatus(brand)}
                        className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all ${
                          brand.status === 'Active'
                            ? 'border-slate-200 text-slate-500 hover:text-slate-750 hover:bg-slate-50'
                            : 'border-slate-200 text-slate-400 hover:text-slate-650 hover:bg-slate-50'
                        }`}
                        title={brand.status === 'Active' ? 'Deactivate Brand' : 'Activate Brand'}
                      >
                        {brand.status === 'Active' ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        onClick={() => handleEdit(brand)}
                        className="p-1.5 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg hover:scale-105 active:scale-95 transition-all"
                        title="Edit Brand details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(brand._id)}
                        className="p-1.5 border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg hover:scale-105 active:scale-95 transition-all"
                        title="Delete Brand"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {brands.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="space-y-2">
                      <AlertTriangle className="mx-auto text-slate-350" size={32} />
                      <h4 className="text-sm font-bold text-slate-700">No Brands Configured</h4>
                      <p className="text-xs text-slate-400">Add manufacturer and brand profiles using the button above.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
          setConfirmOpen(false);
        }}
        title={confirmTitle}
        message={confirmMessage}
      />
    </div>
  );
};

export default BrandsManager;
