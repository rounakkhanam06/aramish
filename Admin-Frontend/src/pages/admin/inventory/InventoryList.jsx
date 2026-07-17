import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Package, Edit3, Trash2,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown,
  ArrowUpDown, Download, RefreshCw, Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../../utils/toast';
import ConfirmModal from '../../../components/ConfirmModal';
import OptimizedImage from '../../../components/common/OptimizedImage';
import { getImageUrl } from '../../../utils/imageHelper';

const STATUSES = ['All', 'Approved', 'Pending', 'Out of Stock'];

const statusConfig = {
  Approved: { label: 'Approved', color: 'bg-green-50 text-green-600 border-green-100' },
  Pending: { label: 'Pending', color: 'bg-amber-50 text-amber-600 border-amber-100' },
  'Out of Stock': { label: 'Out of Stock', color: 'bg-red-50 text-red-500 border-red-100' },
};

// Rich mock product data based on Frontend's CRAZY_DEALS data structure
const MOCK_PRODUCTS = [
  { id: 'P001', name: 'Oversized Tee', category: 'Fashion', price: 599, originalPrice: 999, stock: 120, sales: 245, status: 'Approved', discount: '-40%', sku: 'FSH-001' },
  { id: 'P002', name: 'Layered Necklace', category: 'Jewellery', price: 699, originalPrice: 999, stock: 85, sales: 130, status: 'Approved', discount: '-30%', sku: 'JWL-001' },
  { id: 'P003', name: 'Vintage Watch', category: 'Jewellery', price: 1499, originalPrice: 2999, stock: 40, sales: 97, status: 'Approved', discount: '-50%', sku: 'JWL-002' },
  { id: 'P004', name: 'Benetint Lip Tint', category: 'Beauty', price: 1299, originalPrice: 1999, stock: 200, sales: 312, status: 'Approved', discount: '-35%', sku: 'BTY-001' },
  { id: 'P005', name: 'Pink Lip Gloss', category: 'Beauty', price: 899, originalPrice: 1199, stock: 180, sales: 210, status: 'Approved', discount: '-20%', sku: 'BTY-002' },
  { id: 'P006', name: 'Peptide Serum', category: 'Beauty', price: 2499, originalPrice: 2999, stock: 60, sales: 88, status: 'Approved', discount: '-15%', sku: 'BTY-003' },
  { id: 'P007', name: 'Sunscreen SPF 50', category: 'Beauty', price: 599, originalPrice: 799, stock: 150, sales: 175, status: 'Approved', discount: '-25%', sku: 'BTY-004' }
];

const StatCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={22} />
    </div>
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
      <h3 className="text-2xl font-black text-slate-900 leading-tight">{value}</h3>
      {sub && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default function InventoryList() {
  const navigate = useNavigate();
  const [dbProducts, setDbProducts] = useState([]);
  const [categories, setCategories] = useState([{ id: 'All', name: 'All' }]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [flagFilter, setFlagFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [editingStock, setEditingStock] = useState(null);
  const [stockValue, setStockValue] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [autoCreate, setAutoCreate] = useState(true);
  const [uploadReport, setUploadReport] = useState(null);


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

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/products`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDbProducts(data.products.map(p => ({
          id: p._id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          price: p.sellingPrice,
          originalPrice: p.mrp,
          stock: p.stock,
          sales: p.sales,
          status: p.status,
          discount: p.discountLabel,
          image: p.images && p.images[0] ? p.images[0] : '',
          flags: p.flags || { topSection: false, crazyDeals: false, flashSale: false }
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load products from server');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (allProductsCombined.length === 0) {
      toast.error('No products to export');
      return;
    }
    const headers = ['ID', 'SKU', 'Name', 'Category', 'Price (INR)', 'Original Price (INR)', 'Stock', 'Sales', 'Status', 'Discount'];
    const rows = allProductsCombined.map(p => [
      p.id || '',
      p.sku || '',
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.category || '',
      p.price || 0,
      p.originalPrice || 0,
      p.stock || 0,
      p.sales || 0,
      p.status || '',
      p.discount || ''
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Inventory exported successfully!');
  };

  const handleDownloadSample = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      toast.loading('Downloading template...', { id: 'prep-template' });
      
      const res = await fetch(`${apiBase}/admin/catalog/products/download-template`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast.dismiss('prep-template');
      
      if (!res.ok) {
        throw new Error('Failed to generate template');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'product_upload_template.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Excel template downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.dismiss('prep-template');
      toast.error('Failed to download template: ' + err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileExt)) {
      toast.info('Please upload a valid Excel or CSV file');
      e.target.value = '';
      return;
    }

    toast.loading('Uploading products...', { id: 'upload-excel' });
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('adminToken');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const res = await fetch(`${apiBase}/admin/catalog/products/bulk-upload?autoCreate=${autoCreate}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      toast.dismiss('upload-excel');
      
      if (res.ok && data.success) {
        if (data.report) {
          setUploadReport(data.report);
          if (data.report.failed > 0) {
            toast.warning(`Uploaded ${data.report.success} products. ${data.report.failed} rows failed validation. See report.`);
          } else {
            toast.success(`Successfully uploaded all ${data.report.success} products.`);
          }
        } else {
          toast.success(data.message || 'Products uploaded successfully');
        }
        fetchProducts();
      } else {
        toast.error(data.message || 'Failed to upload products');
      }
    } catch (err) {
      console.error(err);
      toast.dismiss('upload-excel');
      toast.error('Failed to connect to server for upload.');
    } finally {
      e.target.value = ''; // Reset file input
    }
  };

  useEffect(() => {
    fetchProducts();

    const fetchCategories = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/admin/catalog/chips`);
        const data = await res.json();
        if (res.ok && data.success && data.chips) {
          const fetchedCats = data.chips
            .filter(c => c.active !== false)
            .map(c => ({ id: c._id, slug: c.id, name: c.categoryName }));
          setCategories([{ id: 'All', name: 'All' }, ...fetchedCats]);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Show only database products
  const allProductsCombined = dbProducts;

  // Stats
  const totalProducts = allProductsCombined.length;
  const approvedCount = allProductsCombined.filter(p => p.status === 'Approved').length;
  const pendingCount = allProductsCombined.filter(p => p.status === 'Pending').length;
  const outOfStockCount = allProductsCombined.filter(p => p.stock === 0 || p.status === 'Out of Stock').length;

  const getCategoryName = (catId) => {
    if (!catId) return 'N/A';
    const found = categories.find(c => c.id === catId || c.slug === catId);
    return found ? found.name : catId;
  };

  // Filter
  const filtered = allProductsCombined
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'All' || 
                       p.category === categoryFilter ||
                       (p.category && p.category.toLowerCase() === categoryFilter.toLowerCase());
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      
      let matchFlag = true;
      if (flagFilter === 'Top Selection') {
        matchFlag = p.flags?.topSection === true;
      } else if (flagFilter === 'Crazy Deals') {
        matchFlag = p.flags?.crazyDeals === true;
      } else if (flagFilter === 'Flash Sale') {
        matchFlag = p.flags?.flashSale === true;
      }
      
      return matchSearch && matchCat && matchStatus && matchFlag;
    })
    .sort((a, b) => {
      let valA = a[sortBy], valB = b[sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, flagFilter, sortBy, sortDir]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    const currentIds = currentData.map(p => p.id);
    const allSelected = currentIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter(id => !currentIds.includes(id)));
    } else {
      const newSelections = new Set([...selectedIds, ...currentIds]);
      setSelectedIds(Array.from(newSelections));
    }
  };

  const handleDeleteProduct = async (id) => {
    triggerConfirm(
      'Delete Product',
      'Are you sure you want to permanently delete this product from your inventory?',
      async () => {
        if (String(id).startsWith('P0')) {
          toast.success('Mock product removed');
          return;
        }
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${apiBase}/admin/catalog/products/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            toast.success('Product deleted successfully');
            fetchProducts();
          } else {
            toast.error(data.message || 'Failed to delete product');
          }
        } catch (err) {
          console.error(err);
          toast.error('Could not connect to backend server');
        }
      }
    );
  };

  const handleApproveProduct = async (id) => {
    if (String(id).startsWith('P0')) {
      toast.success('Mock product approved');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Approved' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Product approved successfully');
        fetchProducts();
      } else {
        toast.error(data.message || 'Failed to approve product');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleUnpublishProduct = async (id) => {
    if (String(id).startsWith('P0')) {
      toast.success('Mock product unpublished');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Pending' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Product unpublished successfully');
        fetchProducts();
      } else {
        toast.error(data.message || 'Failed to unpublish product');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    toast.loading('Approving selected products...', { id: 'bulk-action' });
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const promises = selectedIds.map(id => {
        if (String(id).startsWith('P0')) return Promise.resolve();
        return fetch(`${apiBase}/admin/catalog/products/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'Approved' })
        });
      });
      await Promise.all(promises);
      toast.dismiss('bulk-action');
      toast.success('Selected products approved successfully');
      setSelectedIds([]);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.dismiss('bulk-action');
      toast.error('Bulk approval failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    triggerConfirm(
      'Delete Selected Products',
      `Are you sure you want to permanently delete all ${selectedIds.length} selected products?`,
      async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        toast.loading('Deleting selected products...', { id: 'bulk-action' });
        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const validIds = selectedIds.filter(id => !String(id).startsWith('P0'));
          if (validIds.length > 0) {
            const response = await fetch(`${apiBase}/admin/catalog/products/bulk-delete`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ productIds: validIds })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Bulk delete failed');
          }
          toast.dismiss('bulk-action');
          toast.success('Selected products deleted successfully');
          setSelectedIds([]);
          fetchProducts();
        } catch (err) {
          console.error(err);
          toast.dismiss('bulk-action');
          toast.error('Bulk deletion failed');
        }
      }
    );
  };

  const handleSaveStock = async (id, newStock) => {
    if (String(id).startsWith('P0')) {
      toast.success('Mock product stock updated');
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/catalog/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stock: newStock })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Stock updated successfully');
        fetchProducts();
      } else {
        toast.error(data.message || 'Failed to update stock');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to backend server');
    }
  };


  const SortIcon = ({ col }) => (
    <ArrowUpDown size={13} className={`ml-1 inline ${sortBy === col ? 'text-[#0B132B]' : 'text-slate-300'}`} />
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat">Products</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Manage all inventory, stock levels and product status.</p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
           <button 
            onClick={handleDownloadSample}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
          >
            <FileSpreadsheet size={15} />
            Download Template
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-green-600 hover:bg-green-50 transition-all shadow-sm cursor-pointer">
            <Upload size={15} />
            Upload Excel
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={autoCreate} 
              onChange={(e) => setAutoCreate(e.target.checked)} 
              className="rounded text-[#0B132B] focus:ring-[#0B132B] w-4 h-4 cursor-pointer accent-[#0B132B]"
            />
            <span>Auto-Create Missing</span>
          </label>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={15} />
            Export
          </button>
          <button
            onClick={() => navigate('/admin/inventory/add')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0B132B] text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Add Product
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Products" value={totalProducts} sub="In Inventory" icon={Package} color="bg-orange-50 text-[#0B132B]" />
        <StatCard label="Live / Approved" value={approvedCount} sub="Currently active" icon={CheckCircle2} color="bg-green-50 text-green-500" />
        <StatCard label="Pending Review" value={pendingCount} sub="Awaiting approval" icon={AlertTriangle} color="bg-amber-50 text-amber-500" />
        <StatCard label="Out of Stock" value={outOfStockCount} sub="Needs restock" icon={XCircle} color="bg-red-50 text-red-400" />
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0B132B] transition-colors" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-11 pr-5 text-sm font-bold focus:ring-4 focus:ring-orange-50 outline-none transition-all text-slate-900 placeholder:text-slate-300"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-100 rounded-xl py-3 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 transition-all cursor-pointer"
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-100 rounded-xl py-3 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 transition-all cursor-pointer"
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Deal / Section Filter */}
          <div className="relative">
            <select
              value={flagFilter}
              onChange={e => setFlagFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-100 rounded-xl py-3 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-50 transition-all cursor-pointer"
            >
              {['All Deals', 'Top Selection', 'Crazy Deals', 'Flash Sale'].map(f => <option key={f}>{f}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => { setSearch(''); setCategoryFilter('All'); setStatusFilter('All'); setFlagFilter('All'); }}
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>


      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <p className="text-sm font-black text-slate-900">
            {filtered.length} <span className="font-medium text-slate-400">results</span>
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Inventory</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <th className="px-5 py-3.5 text-left">
                  <input
                    type="checkbox"
                    checked={currentData.length > 0 && currentData.every(p => selectedIds.includes(p.id))}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                  />
                </th>
                <th onClick={() => toggleSort('sku')} className="px-3 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                  SKU <SortIcon col="sku" />
                </th>
                <th onClick={() => toggleSort('name')} className="px-3 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none min-w-[180px]">
                  Product <SortIcon col="name" />
                </th>
                <th onClick={() => toggleSort('category')} className="px-3 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                  Category <SortIcon col="category" />
                </th>
                <th onClick={() => toggleSort('price')} className="px-3 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                  Price <SortIcon col="price" />
                </th>
                <th onClick={() => toggleSort('stock')} className="px-3 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                  Stock <SortIcon col="stock" />
                </th>
                <th onClick={() => toggleSort('sales')} className="px-3 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                  Sales <SortIcon col="sales" />
                </th>
                <th onClick={() => toggleSort('status')} className="px-3 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none">
                  Status <SortIcon col="status" />
                </th>
                <th className="px-3 py-3.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest pr-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse hover:bg-transparent">
                    <td className="px-5 py-4"><div className="w-4 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="w-16 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-slate-200 rounded-xl"></div>
                        <div className="space-y-2">
                          <div className="w-32 h-4 bg-slate-200 rounded"></div>
                          <div className="w-16 h-3 bg-slate-200 rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4"><div className="w-20 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="w-16 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="w-10 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="w-12 h-4 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4 pr-5"><div className="w-16 h-6 bg-slate-200 rounded-lg ml-auto"></div></td>
                  </tr>
                ))
              ) : (
                <AnimatePresence>
                {currentData.map((product) => {
                  const isLowStock = product.stock > 0 && product.stock <= 20;
                  const isOutOfStock = product.stock === 0 || product.status === 'Out of Stock';
                  const statusInfo = statusConfig[isOutOfStock ? 'Out of Stock' : product.status] || statusConfig['Pending'];

                  return (
                    <motion.tr
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      {/* Checkbox */}
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                        />
                      </td>

                      {/* SKU */}
                      <td className="px-3 py-4">
                        <span className="text-[11px] font-black text-slate-400 font-roboto">{product.sku || product.id}</span>
                      </td>

                      {/* Product */}
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                            <OptimizedImage src={product.image} alt={product.name} type="product" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 leading-none">{product.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                              {product.discount && (() => {
                                const raw = product.discount;
                                const parsed = parseFloat(raw);
                                if (!isNaN(parsed) && parsed > 0 && parsed < 1) {
                                  return <span className="text-[9px] font-black text-[#0B132B]">{`-${Math.round(parsed * 100)}% OFF`}</span>;
                                }
                                const cleanStr = String(raw).replace('-', '').replace('%', '').trim();
                                const cleanNum = parseFloat(cleanStr);
                                if (!isNaN(cleanNum)) {
                                  return <span className="text-[9px] font-black text-[#0B132B]">{`-${Math.round(cleanNum)}% OFF`}</span>;
                                }
                                return <span className="text-[9px] font-black text-[#0B132B]">{raw.includes('%') ? `-${raw.replace('-', '')} OFF` : `${raw} OFF`}</span>;
                              })()}
                              {product.flags?.topSection && (
                                <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-1 py-0.5 rounded border border-blue-100 uppercase tracking-tight scale-95 origin-left">Top</span>
                              )}
                              {product.flags?.crazyDeals && (
                                <span className="text-[8px] font-black bg-purple-50 text-purple-600 px-1 py-0.5 rounded border border-purple-100 uppercase tracking-tight scale-95 origin-left">Crazy</span>
                              )}
                              {product.flags?.flashSale && (
                                <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-1 py-0.5 rounded border border-rose-100 uppercase tracking-tight scale-95 origin-left">Flash</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-3 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                          {getCategoryName(product.category)}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-3 py-4">
                        <div>
                          <p className="text-sm font-black text-slate-900">₹{product.price?.toLocaleString()}</p>
                          {product.originalPrice && (
                            <p className="text-[10px] text-slate-400 font-medium line-through">₹{product.originalPrice?.toLocaleString()}</p>
                          )}
                        </div>
                      </td>

                      {/* Stock */}
                      <td className="px-3 py-4">
                        {editingStock === product.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={stockValue}
                              onChange={e => setStockValue(e.target.value)}
                              className="w-16 border border-orange-200 rounded-lg py-1 px-2 text-xs font-black outline-none focus:ring-2 focus:ring-orange-100"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                handleSaveStock(product.id, Number(stockValue));
                                setEditingStock(null);
                              }}
                              className="p-1 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-all"
                            >
                              <CheckCircle2 size={12} />
                            </button>
                            <button
                              onClick={() => setEditingStock(null)}
                              className="p-1 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-all"
                            >
                              <XCircle size={12} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => { setEditingStock(product.id); setStockValue(product.stock || 0); }}
                            className="flex items-center gap-1.5 cursor-pointer group/stock"
                          >
                            <span className={`text-sm font-black ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-slate-900'}`}>
                              {product.stock ?? 0}
                            </span>
                            {isLowStock && !isOutOfStock && (
                              <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                            )}
                            <Edit3 size={10} className="text-slate-300 opacity-0 group-hover/stock:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* Sales */}
                      <td className="px-3 py-4">
                        <span className="text-sm font-black text-slate-700">{product.sales ?? 0}</span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${statusInfo.color}`}>
                          {isOutOfStock ? 'Out of Stock' : product.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-4 pr-5">
                        <div className="flex items-center justify-end gap-1 transition-opacity">
                          <button
                            onClick={() => navigate(`/admin/inventory/view/${product.id}`)}
                            className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-emerald-50 hover:text-emerald-500 transition-all"
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/inventory/edit/${product.id}`)}
                            className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all"
                            title="Edit Product"
                          >
                            <Edit3 size={14} />
                          </button>
                          {product.status === 'Pending' && (
                            <button
                              onClick={() => handleApproveProduct(product.id)}
                              className="p-2 bg-green-50 text-green-500 rounded-lg hover:bg-green-100 transition-all"
                              title="Approve"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {product.status === 'Approved' && (
                            <button
                              onClick={() => handleUnpublishProduct(product.id)}
                              className="p-2 bg-amber-50 text-amber-500 rounded-lg hover:bg-amber-100 transition-all"
                              title="Unpublish"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              )}
            </tbody>
          </table>

          {!loading && filtered.length === 0 && (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-5">
                <Package size={36} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-900">No Products Found</h3>
              <p className="text-slate-400 text-sm font-medium mt-2">Try adjusting your filters or search term</p>
            </div>
          )}
        </div>

        {/* Table Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/30">
            <p className="text-xs font-bold text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} products
            </p>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-50 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center transition-all ${
                          currentPage === pageNum 
                            ? 'bg-[#0B132B] text-white shadow-sm' 
                            : 'text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-50 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Total Stock Value: <span className="text-slate-700">₹{filtered.reduce((acc, p) => acc + (p.price * (p.stock || 0)), 0).toLocaleString()}</span>
              </span>
            </div>
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction}
        title={confirmTitle}
        message={confirmMessage}
      />
      <AnimatePresence>
        {uploadReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col font-sans"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Bulk Upload Report</h2>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Summary of the imported products and any validation failures.</p>
                </div>
                <button 
                  onClick={() => setUploadReport(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 border-b border-slate-100 bg-white">
                <div className="p-5 text-center border-r border-slate-100 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Successfully Uploaded</span>
                  <span className="text-3xl font-black text-green-500 mt-1">{uploadReport.success}</span>
                </div>
                <div className="p-5 text-center flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Failed / Skipped</span>
                  <span className="text-3xl font-black text-red-500 mt-1">{uploadReport.failed}</span>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 bg-white space-y-4">
                {uploadReport.errors && uploadReport.errors.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-red-500 uppercase tracking-widest">Validation Errors ({uploadReport.errors.length})</p>
                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <div className="w-16">Row</div>
                        <div className="flex-1">Error Message</div>
                      </div>
                      <div className="max-h-[35vh] overflow-y-auto divide-y divide-slate-100">
                        {uploadReport.errors.map((err, idx) => (
                          <div key={idx} className="px-4 py-3 flex text-sm text-slate-600 bg-white hover:bg-slate-50/50 transition-all">
                            <div className="w-16 font-bold text-slate-400">#{err.row}</div>
                            <div className="flex-1 font-medium text-slate-700">{err.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 italic font-medium">Please fix these errors in your spreadsheet and try uploading those rows again.</p>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 size={32} className="text-green-500" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">All Rows Processed Successfully!</h3>
                    <p className="text-slate-500 text-sm font-medium mt-1">There were no validation errors. All products were imported.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setUploadReport(null)}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white rounded-full shadow-2xl border border-slate-200 px-6 py-4 flex items-center gap-6"
          >
            <div className="flex flex-col items-center justify-center">
              <span className="text-[13px] font-black text-slate-800 uppercase tracking-widest leading-none">{selectedIds.length}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Selected</span>
            </div>
            
            <div className="w-[1px] h-8 bg-slate-200"></div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleBulkApprove}
                className="px-5 py-2.5 bg-green-50 text-green-700 rounded-full text-xs font-black border border-green-200 hover:bg-green-100 hover:scale-105 active:scale-95 transition-all shadow-sm"
              >
                Approve All Selected
              </button>
              <button 
                onClick={handleBulkDelete}
                className="px-5 py-2.5 bg-red-50 text-red-600 rounded-full text-xs font-black border border-red-200 hover:bg-red-100 hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete All Selected
              </button>
            </div>
            
            <button 
              onClick={() => setSelectedIds([])}
              className="ml-2 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 hover:text-slate-800 transition-colors"
              title="Clear Selection"
            >
              <XCircle size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
