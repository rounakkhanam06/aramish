import React, { useState, useEffect } from 'react';
import { 
  Package, Upload, Plus, X, 
  Save, CheckCircle2,
  Info, Image as ImageIcon, Layers,
  DollarSign, Tag, FileText, 
  Truck, ShieldCheck, ToggleLeft, ToggleRight,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../utils/toast';
import { useParams, useNavigate } from 'react-router-dom';
import OptimizedImage from '../../components/common/OptimizedImage';

const generateCombinations = (attrs) => {
  if (attrs.length === 0) return [];
  const helper = (acc, index) => {
    if (index === attrs.length) return acc;
    const currentAttr = attrs[index];
    const currentValues = currentAttr.values || [];
    if (currentValues.length === 0) return helper(acc, index + 1);
    if (acc.length === 0) {
      const newAcc = currentValues.map(val => ({
        [currentAttr.name]: val
      }));
      return helper(newAcc, index + 1);
    }
    const newAcc = [];
    acc.forEach(combo => {
      currentValues.forEach(val => {
        newAcc.push({
          ...combo,
          [currentAttr.name]: val
        });
      });
    });
    return helper(newAcc, index + 1);
  };
  return helper([], 0);
};

const Label = ({ children, required }) => (
  <label className="block text-sm font-semibold text-slate-600 mb-2">
    {children}{required && <span className="text-red-400 ml-1">*</span>}
  </label>
);

const SectionTitle = ({ icon: Icon, color, children }) => (
  <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-100">
    <div className={`p-2 rounded-xl ${color}`}>
      <Icon size={17} />
    </div>
    <h3 className="text-base font-semibold text-slate-700">{children}</h3>
  </div>
);

const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-800 focus:ring-4 focus:ring-orange-50 focus:border-orange-300 transition-all outline-none placeholder:text-slate-400";

const AddProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  const [saved, setSaved] = useState(false);
  
  // State variables for form inputs
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [description, setDescription] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [stock, setStock] = useState(1);
  const [discountLabel, setDiscountLabel] = useState('');
  const [sku, setSku] = useState('');
  const [categories, setCategories] = useState([]);
  const [subCategoriesMap, setSubCategoriesMap] = useState({});

  useEffect(() => {
    if (mrp && discountPercent) {
      const discount = Number(discountPercent);
      if (!isNaN(discount) && discount >= 0 && discount <= 100) {
        const calculatedPrice = Math.round(Number(mrp) * (1 - discount / 100));
        setSellingPrice(calculatedPrice);
        setDiscountLabel(String(discount));
      }
    }
  }, [mrp, discountPercent]);

  // Key Highlights specs
  const [highlights, setHighlights] = useState({
    packOf: '',
    fabric: '',
    material: '',
    sleeve: '',
    pattern: '',
    collar: '',
    color: ''
  });

  // Technical specs
  const [techSpecs, setTechSpecs] = useState({
    fit: '',
    fabricCare: '',
    suitableFor: '',
    hem: ''
  });

  // Shipping specs
  const [shippingSpecs, setShippingSpecs] = useState({
    weight: '',
    length: '',
    width: '',
    height: ''
  });

  // Flags state
  const [flags, setFlags] = useState({ topSection: false, crazyDeals: false, flashSale: false });

  // Organization state
  const [brandName, setBrandName] = useState('Generic');
  const [brandId, setBrandId] = useState('');
  const [isTrending, setIsTrending] = useState(false);
  const [brands, setBrands] = useState([]);
  const [tags, setTags] = useState('');
  const [manufacturerInfo, setManufacturerInfo] = useState('');

  // Tax compliance
  const [hsnCode, setHsnCode] = useState('');

  useEffect(() => {
    if (!isEditMode) return;
    const fetchProduct = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/admin/catalog/products/${id}`);
        const data = await res.json();
        if (res.ok && data.success && data.product) {
          const p = data.product;
          setName(p.name || '');
          setCategory(p.category || '');
          setSubCategory(p.subCategory || '');
          setDescription(p.description || '');
          setSellingPrice(p.sellingPrice || '');
          setMrp(p.mrp || '');
          setStock(p.stock || 1);
          if (p.discountLabel) {
             const parsed = parseFloat(p.discountLabel);
             if (!isNaN(parsed) && parsed > 0 && parsed < 1) {
               setDiscountLabel(String(Math.round(parsed * 100)));
             } else {
               const match = String(p.discountLabel).match(/\d+/);
               setDiscountLabel(match ? match[0] : '');
             }
           } else {
             setDiscountLabel('');
           }
           setSku(p.sku || '');
          setBrandName(p.brandName || '');
          setBrandId(p.brandId && typeof p.brandId === 'object' ? p.brandId._id : (p.brandId || ''));
          setIsTrending(p.isTrending || false);
          setTags(Array.isArray(p.tags) ? p.tags.join(', ') : '');
          setManufacturerInfo(p.manufacturerInfo || '');
          setHsnCode(p.hsnCode || '');
          setImages(p.images || []);
          
          if (p.highlights) {
            const h = {};
            Object.keys(p.highlights).forEach(k => {
              h[k] = p.highlights[k];
            });
            setHighlights(prev => ({ ...prev, ...h }));
          }
          if (p.technicalSpecs) {
            const ts = {};
            Object.keys(p.technicalSpecs).forEach(k => {
              ts[k] = p.technicalSpecs[k];
            });
            setTechSpecs(prev => ({ ...prev, ...ts }));
          }
          if (p.shippingSpecs) {
            setShippingSpecs(prev => ({ ...prev, ...p.shippingSpecs }));
          }
          if (p.flags) {
            setFlags(prev => ({ ...prev, ...p.flags }));
          }
          if (Array.isArray(p.variations) && p.variations.length > 0) {
            setVariations(p.variations);
            const attrMap = {};
            p.variations.forEach(v => {
              if (v.attributes) {
                Object.entries(v.attributes).forEach(([key, val]) => {
                  if (!attrMap[key]) attrMap[key] = new Set();
                  attrMap[key].add(val);
                });
              }
            });
            const attrs = Object.entries(attrMap).map(([name, set]) => ({
              name,
              values: Array.from(set)
            }));
            setAttributes(attrs);
          }
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
        toast.error('Failed to load product details for editing');
      }
    };
    fetchProduct();
  }, [id, isEditMode]);

  useEffect(() => {
    const fetchCategoriesAndSubcategories = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        // Fetch Categories
        const catRes = await fetch(`${apiBase}/admin/catalog/chips`);
        const catData = await catRes.json();
        
        // Fetch Subcategories
        const subRes = await fetch(`${apiBase}/admin/catalog/subchips`);
        const subData = await subRes.json();

        if (catRes.ok && catData.success && subRes.ok && subData.success) {
          const catsList = (catData.chips || [])
            .filter(c => c.active !== false && c.id !== 'for-you' && c._id !== 'for-you')
            .map(c => ({
              id: c._id,
              slug: c.id,
              name: c.categoryName
            }));
          setCategories(catsList);
          
          const map = {};
          (subData.subchips || []).filter(s => s.active !== false).forEach(s => {
            // Find parent category to map by both slug and _id keys
            const parentCat = (catData.chips || []).find(c => c._id === s.categoryId || c.id === s.categoryId);
            const parentId = parentCat ? parentCat._id : s.categoryId;
            const parentSlug = parentCat ? parentCat.id : s.categoryId;

            const subItem = {
              id: s._id,
              slug: s.id,
              name: s.subCategoryName
            };

            if (parentId) {
              if (!map[parentId]) map[parentId] = [];
              map[parentId].push(subItem);
            }
            if (parentSlug && parentSlug !== parentId) {
              if (!map[parentSlug]) map[parentSlug] = [];
              map[parentSlug].push(subItem);
            }
          });
          setSubCategoriesMap(map);
        }

      } catch (err) {
        console.error('Failed to fetch categories/subcategories/brands:', err);
      }
    };
    fetchCategoriesAndSubcategories();
  }, []);

  // Resolve category slug to _id if needed once categories list is loaded
  useEffect(() => {
    if (category && categories.length > 0) {
      const found = categories.find(c => c.id === category || c.slug === category);
      if (found && found.id !== category) {
        setCategory(found.id);
      }
    }
  }, [categories, category]);

  // Resolve subcategory slug to _id if needed
  useEffect(() => {
    if (subCategory && category && subCategoriesMap[category]) {
      const subCats = subCategoriesMap[category] || [];
      const found = subCats.find(sc => sc.id === subCategory || sc.slug === subCategory);
      if (found && found.id !== subCategory) {
        setSubCategory(found.id);
      }
    }
  }, [subCategoriesMap, subCategory, category]);

  // Variations state
  const [attributes, setAttributes] = useState([]);
  const [isAddingAttr, setIsAddingAttr] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');
  const [variations, setVariations] = useState([]);

  useEffect(() => {
    const combos = generateCombinations(attributes);
    const newVariations = combos.map(combo => {
      const attrString = Object.values(combo).join('-');
      const computedSku = sku ? `${sku}-${attrString}` : `SKU-${attrString}`;
      
      const existing = variations.find(v => {
        if (!v.attributes) return false;
        return Object.entries(combo).every(([k, val]) => v.attributes[k] === val);
      });
      
      return {
        sku: existing?.sku || computedSku,
        price: existing?.price !== undefined ? existing.price : (Number(sellingPrice) || 0),
        stock: existing?.stock !== undefined ? existing.stock : (Number(stock) || 1),
        attributes: combo
      };
    });
    setVariations(newVariations);
  }, [attributes, sku, sellingPrice, stock]);

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) {
      toast.info('Attribute name is required!');
      return;
    }
    if (attributes.some(attr => attr.name.toLowerCase() === newAttrName.trim().toLowerCase())) {
      toast.info('Attribute already exists!');
      return;
    }
    const parsedValues = newAttrVal
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    setAttributes([...attributes, { name: newAttrName.trim(), values: parsedValues }]);
    setNewAttrName('');
    setNewAttrVal('');
    setIsAddingAttr(false);
  };

  const handleAddValueToAttribute = (attrIndex, val) => {
    if (!val.trim()) return;
    const updated = [...attributes];
    if (updated[attrIndex].values.includes(val.trim())) {
      toast.info('Value already exists!');
      return;
    }
    updated[attrIndex].values.push(val.trim());
    setAttributes(updated);
  };

  const handleRemoveValueFromAttribute = (attrIndex, valIndex) => {
    const updated = [...attributes];
    updated[attrIndex].values.splice(valIndex, 1);
    setAttributes(updated);
  };

  const handleRemoveAttribute = (attrIndex) => {
    setAttributes(attributes.filter((_, i) => i !== attrIndex));
  };

  const handleVariationChange = (index, field, value) => {
    const updated = [...variations];
    if (field === 'price' || field === 'stock') {
      updated[index][field] = Number(value);
    } else {
      updated[index][field] = value;
    }
    setVariations(updated);
  };

  // Visuals State
  const [images, setImages] = useState([]); // holds urls or previews
  const [imageFiles, setImageFiles] = useState([]); // holds files for multipart uploading



  const handleAddImageUrl = () => {
    const url = prompt('Enter Image URL');
    if (url) {
      setImages([...images, url]);
    }
  };

  const handleAddImageFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.info('Image size cannot exceed 10MB!');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setImages([...images, previewUrl]);
      setImageFiles([...imageFiles, { previewUrl, file }]);
    }
  };

  const handleRemoveImage = (index) => {
    const target = images[index];
    setImages(images.filter((_, i) => i !== index));
    setImageFiles(imageFiles.filter(item => item.previewUrl !== target));
  };

  const handleSave = async () => {
    if (!name || !category || !sellingPrice) {
      toast.info('Product Name, Category, and Selling Price are required!');
      return;
    }
    
    if (Number(sellingPrice) <= 0) {
      toast.info('Selling Price must be greater than zero!');
      return;
    }
    
    if (mrp && Number(mrp) <= 0) {
      toast.info('Actual Price (MRP) must be greater than zero!');
      return;
    }

    if (mrp && Number(mrp) < Number(sellingPrice)) {
      toast.info('Actual Price (MRP) cannot be less than Selling Price!');
      return;
    }

    if (discountPercent !== '' && (Number(discountPercent) < 0 || Number(discountPercent) > 100)) {
      toast.info('Discount percentage must be between 0 and 100!');
      return;
    }

    if (stock !== undefined && Number(stock) < 0) {
      toast.info('Stock cannot be negative!');
      return;
    }

    if (discountLabel !== '' && (Number(discountLabel) < 0 || Number(discountLabel) > 100)) {
      toast.info('Discount label percentage must be between 0 and 100!');
      return;
    }
    
    if (!shippingSpecs.weight) {
      toast.info('Product Weight is mandatory for shipping calculation!');
      return;
    }

    if (Number(shippingSpecs.weight) <= 0) {
      toast.info('Weight must be greater than zero!');
      return;
    }

    if (shippingSpecs.length && Number(shippingSpecs.length) < 0) {
      toast.info('Length cannot be negative!');
      return;
    }

    if (shippingSpecs.width && Number(shippingSpecs.width) < 0) {
      toast.info('Width cannot be negative!');
      return;
    }

    if (shippingSpecs.height && Number(shippingSpecs.height) < 0) {
      toast.info('Height cannot be negative!');
      return;
    }

    if (variations && variations.length > 0) {
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        if (Number(v.price) <= 0) {
          toast.info(`Variation ${i + 1} price must be greater than zero!`);
          return;
        }
        if (Number(v.stock) < 0) {
          toast.info(`Variation ${i + 1} stock cannot be negative!`);
          return;
        }
      }
    }

    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Please login as admin first');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const bodyFormData = new FormData();

      bodyFormData.append('name', name);
      bodyFormData.append('category', category);
      if (subCategory) bodyFormData.append('subCategory', subCategory);
      bodyFormData.append('description', description);
      bodyFormData.append('sellingPrice', sellingPrice);
      if (mrp) bodyFormData.append('mrp', mrp);
      bodyFormData.append('stock', stock);
      bodyFormData.append('discountLabel', discountLabel ? `-${discountLabel}% OFF` : '');
      bodyFormData.append('sku', sku);
      bodyFormData.append('hsnCode', hsnCode);
      bodyFormData.append('brandName', brandName || 'Generic');
      bodyFormData.append('brandId', brandId || '');
      bodyFormData.append('isTrending', isTrending);
      bodyFormData.append('manufacturerInfo', manufacturerInfo);

      bodyFormData.append('highlights', JSON.stringify(highlights));
      bodyFormData.append('technicalSpecs', JSON.stringify(techSpecs));
      bodyFormData.append('shippingSpecs', JSON.stringify(shippingSpecs));
      bodyFormData.append('flags', JSON.stringify(flags));

      const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
      bodyFormData.append('tags', JSON.stringify(parsedTags));
      bodyFormData.append('variations', JSON.stringify(variations));

      // Append files and standard image URL strings
      const rawImageUrls = [];
      images.forEach(img => {
        if (typeof img === 'string' && !img.startsWith('blob:')) {
          rawImageUrls.push(img);
        }
      });
      bodyFormData.append('images', JSON.stringify(rawImageUrls));

      imageFiles.forEach(fileObj => {
        bodyFormData.append('images', fileObj.file);
      });

      toast.loading(isEditMode ? 'Updating product...' : 'Publishing product to catalog...', { id: 'publish' });
      const saveUrl = isEditMode ? `${apiBase}/admin/catalog/products/${id}` : `${apiBase}/admin/catalog/products`;
      const res = await fetch(saveUrl, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: bodyFormData
      });

      const data = await res.json();
      toast.dismiss('publish');

      if (res.ok && data.success) {
        toast.success(data.message || (isEditMode ? 'Product updated successfully!' : 'Product published successfully!'));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);

        setTimeout(() => navigate('/admin/inventory/all'), 1000);
      } else {
        toast.error(data.message || 'Failed to publish product');
      }
    } catch (err) {
      console.error(err);
      toast.dismiss('publish');
      toast.error('Could not connect to backend server');
    }
  };

  const toggleFlag = (key) => setFlags(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-6 pb-20 max-w-[1200px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/inventory/all')}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shrink-0 shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight font-montserrat">{isEditMode ? 'Edit Product' : 'Add New Product'}</h1>
            <p className="text-slate-500 mt-1">{isEditMode ? 'Modify the product details and save changes.' : 'Fill in the details below to publish a product to the catalog.'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm">
            Save as Draft
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${saved ? 'bg-green-500 text-white' : 'bg-[#0B132B] text-white hover:scale-105'}`}
          >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? (isEditMode ? 'Product Updated!' : 'Product Published!') : (isEditMode ? 'Save Changes' : 'Publish to Catalog')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Main Form ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Product Specification */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 space-y-5">
            <SectionTitle icon={FileText} color="bg-orange-50 text-[#0B132B]">Product Specification</SectionTitle>

            <div>
              <Label required>Product Name</Label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Premium Leather Satchel" 
                className={inputCls} 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label required>Category</Label>
                <select 
                  value={category}
                  onChange={e => {
                    setCategory(e.target.value);
                    setSubCategory('');
                  }}
                  className={inputCls}
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Sub Category</Label>
                <select 
                  value={subCategory}
                  onChange={e => setSubCategory(e.target.value)}
                  className={inputCls}
                  disabled={!category}
                >
                  <option value="">Select Sub Category</option>
                  {category && subCategoriesMap[category]?.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Detailed Description</Label>
              <textarea
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell customers about the product features, materials, and unique selling points..."
                className={`${inputCls} resize-none`}
              />
            </div>
          </section>

          {/* 2. Pricing & Stocks */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 space-y-5">
            <SectionTitle icon={DollarSign} color="bg-green-50 text-green-600">Pricing & Stocks</SectionTitle>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>MRP / Strike-off (₹)</Label>
                <input 
                  type="number" 
                  value={mrp}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) setMrp(val);
                  }}
                  placeholder="0.00" 
                  className={inputCls} 
                />
              </div>
              <div>
                <Label>Discount (%)</Label>
                <input 
                  type="number" 
                  value={discountPercent}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || (Number(val) >= 0 && Number(val) <= 100)) setDiscountPercent(val);
                  }}
                  placeholder="e.g. 20" 
                  className={inputCls} 
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <Label required>Selling Price (₹)</Label>
                <input 
                  type="number" 
                  value={sellingPrice}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) setSellingPrice(val);
                  }}
                  placeholder="0.00" 
                  className={inputCls} 
                />
              </div>
              <div>
                <Label required>Initial Stock</Label>
                <input 
                  type="number" 
                  value={stock}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) setStock(val);
                  }}
                  placeholder="1" 
                  className={inputCls} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Label (Percentage)</Label>
                <input 
                  type="number" 
                  value={discountLabel}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) {
                      const numVal = Number(val);
                      if (numVal <= 100) {
                        setDiscountLabel(val);
                      }
                    }
                  }}
                  placeholder="e.g. 40" 
                  min="0"
                  max="100"
                  className={inputCls} 
                />
              </div>
              <div>
                <Label>SKU / Product Code</Label>
                <input 
                  type="text" 
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                  placeholder="e.g. FSH-001" 
                  className={inputCls} 
                />
              </div>
            </div>
          </section>

          {/* 3. Highlights & Specs */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 space-y-5">
            <SectionTitle icon={Info} color="bg-indigo-50 text-indigo-500">Highlights & Specs</SectionTitle>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-indigo-500">Key Highlights</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'packOf', label: 'Pack Of' },
                    { key: 'fabric', label: 'Fabric' },
                    { key: 'material', label: 'Material' },
                    { key: 'sleeve', label: 'Sleeve' },
                    { key: 'pattern', label: 'Pattern' },
                    { key: 'collar', label: 'Collar' },
                    { key: 'color', label: 'Color' }
                  ].map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input 
                        type="text" 
                        value={highlights[f.key]}
                        onChange={e => setHighlights(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={`e.g. ${f.label}`} 
                        className={inputCls} 
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm font-semibold text-indigo-500">Technical Specs</p>
                <div className="space-y-3">
                  {[
                    { key: 'fit', label: 'Fit' },
                    { key: 'fabricCare', label: 'Fabric Care' },
                    { key: 'suitableFor', label: 'Suitable For' },
                    { key: 'hem', label: 'Hem' }
                  ].map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input 
                        type="text" 
                        value={techSpecs[f.key]}
                        onChange={e => setTechSpecs(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={`e.g. ${f.label}`} 
                        className={inputCls} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 4. Variations */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 text-purple-500 rounded-xl"><Layers size={17} /></div>
                <h3 className="text-base font-semibold text-slate-700">Variations (SKUs)</h3>
              </div>
              {!isAddingAttr && (
                <button 
                  onClick={() => setIsAddingAttr(true)}
                  className="text-sm font-semibold text-blue-500 hover:underline flex items-center gap-1"
                >
                  <Plus size={16} /> Add Attribute
                </button>
              )}
            </div>

            {/* Inline form to add a new Attribute */}
            {isAddingAttr && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h4 className="text-sm font-semibold text-slate-700">New Attribute</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label required>Attribute Name</Label>
                    <input 
                      type="text"
                      value={newAttrName}
                      onChange={e => setNewAttrName(e.target.value)}
                      placeholder="e.g. Size, Color, Material"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Values (Comma Separated)</Label>
                    <input 
                      type="text"
                      value={newAttrVal}
                      onChange={e => setNewAttrVal(e.target.value)}
                      placeholder="e.g. S, M, L or Red, Blue"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      setIsAddingAttr(false);
                      setNewAttrName('');
                      setNewAttrVal('');
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddAttribute}
                    className="px-4 py-2 bg-[#0B132B] text-white rounded-lg text-xs font-semibold hover:bg-orange-600"
                  >
                    Add Attribute
                  </button>
                </div>
              </div>
            )}

            {/* List of currently defined attributes */}
            {attributes.length > 0 && (
              <div className="space-y-4">
                {attributes.map((attr, attrIndex) => {
                  return (
                    <div key={attrIndex} className="p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <span className="text-sm font-bold text-slate-700">{attr.name}</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {attr.values.map((val, valIndex) => (
                            <span key={valIndex} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200">
                              {val}
                              <button 
                                onClick={() => handleRemoveValueFromAttribute(attrIndex, valIndex)}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          {/* Inline tag input */}
                          <input 
                            type="text"
                            placeholder="+ Add value"
                            className="bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-xs px-1 py-0.5 w-20"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddValueToAttribute(attrIndex, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            onBlur={e => {
                              handleAddValueToAttribute(attrIndex, e.target.value);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveAttribute(attrIndex)}
                        className="text-xs text-red-500 hover:underline flex items-center gap-1 self-start md:self-center"
                      >
                        Remove Attribute
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Combinations list */}
            {variations.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Generated SKUs / Combinations</p>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="p-3">Combination</th>
                        <th className="p-3">SKU Code</th>
                        <th className="p-3">Price (₹)</th>
                        <th className="p-3">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {variations.map((v, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3 font-medium">
                            {Object.entries(v.attributes).map(([key, val]) => `${key}: ${val}`).join(', ')}
                          </td>
                          <td className="p-3">
                            <input 
                              type="text" 
                              value={v.sku} 
                              onChange={e => handleVariationChange(i, 'sku', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="number" 
                              value={v.price} 
                              onChange={e => handleVariationChange(i, 'price', e.target.value)}
                              className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="number" 
                              value={v.stock} 
                              onChange={e => handleVariationChange(i, 'stock', e.target.value)}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              !isAddingAttr && (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Layers size={32} />
                  <p className="text-sm font-medium text-center text-slate-400">No variations defined.<br />Add Size, Color or Material to create SKUs.</p>
                </div>
              )
            )}
          </section>

          {/* 5. Shipping & Logistics */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 space-y-5">
            <SectionTitle icon={Truck} color="bg-blue-50 text-blue-500">Shipping & Logistics</SectionTitle>

            <div className="grid grid-cols-4 gap-4">
              {[
                { key: 'weight', label: 'Weight (kg)', def: '0.5' },
                { key: 'length', label: 'Length (cm)', def: '10' },
                { key: 'width', label: 'Width (cm)', def: '10' },
                { key: 'height', label: 'Height (cm)', def: '5' }
              ].map((f) => (
                <div key={f.key}>
                  <Label required={f.key === 'weight'}>{f.label}</Label>
                  <input 
                    type="number" 
                    value={shippingSpecs[f.key]}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || Number(val) >= 0) {
                        setShippingSpecs(p => ({ ...p, [f.key]: val }));
                      }
                    }}
                    placeholder={f.def} 
                    className={inputCls} 
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-6">

          {/* Product Flags */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <SectionTitle icon={Tag} color="bg-orange-50 text-orange-500">Product Flags</SectionTitle>

            {[
              { key: 'topSection', label: 'Top Section', desc: 'Show in the top hero grid' },
              { key: 'crazyDeals', label: 'Crazy Deals', desc: 'Feature in the crazy deals list' },
              { key: 'flashSale', label: 'Flash Sale', desc: 'Include in the active flash sale' },
            ].map(flag => (
              <div key={flag.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{flag.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{flag.desc}</p>
                </div>
                <button onClick={() => toggleFlag(flag.key)}>
                  {flags[flag.key]
                    ? <ToggleRight size={28} className="text-blue-500" />
                    : <ToggleLeft size={28} className="text-slate-300" />
                  }
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-800">Is Trending Product</p>
                <p className="text-xs text-slate-500 mt-0.5">Feature as a Popular Product in its Brand page</p>
              </div>
              <button onClick={() => setIsTrending(!isTrending)}>
                {isTrending
                  ? <ToggleRight size={28} className="text-blue-500" />
                  : <ToggleLeft size={28} className="text-slate-300" />
                }
              </button>
            </div>
          </section>

          {/* Tax & Compliance */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <SectionTitle icon={ShieldCheck} color="bg-green-50 text-green-600">Tax & Compliance</SectionTitle>

            <div>
              <Label>HSN Code</Label>
              <input 
                type="text" 
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
                placeholder="e.g. 4202" 
                className={inputCls} 
              />
            </div>
          </section>

          {/* Image Gallery */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl"><ImageIcon size={17} /></div>
                <h3 className="text-base font-semibold text-slate-700">Visuals</h3>
              </div>
              <span className="text-sm font-semibold text-blue-500">{images.length}/5</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square bg-slate-50 rounded-xl border border-slate-200 overflow-hidden group">
                  <OptimizedImage src={img} alt="Product" type="product" className="w-full h-full" />
                  <button
                    onClick={() => handleRemoveImage(i)}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <div className="flex gap-2 col-span-2">
                  <label
                    className="flex-1 aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/20 transition-all text-slate-400 cursor-pointer"
                  >
                    <Upload size={22} />
                    <span className="text-xs font-semibold">Upload File</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAddImageFile} 
                    />
                  </label>
                  <button
                    onClick={handleAddImageUrl}
                    className="flex-1 aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/20 transition-all text-slate-400"
                  >
                    <Plus size={22} />
                    <span className="text-xs font-semibold">Add URL</span>
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              Recommended: <strong className="text-slate-700">1080×1080 px</strong>. High-quality images increase conversion by up to <strong className="text-slate-700">40%</strong>.
            </p>
          </section>

          {/* Organization */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <SectionTitle icon={Tag} color="bg-amber-50 text-amber-500">Organization</SectionTitle>



            <div>
              <Label>Tags (Comma Separated)</Label>
              <input 
                type="text" 
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="new, trending, summer" 
                className={inputCls} 
              />
            </div>
            <div>
              <Label>Manufacturer Info</Label>
              <textarea 
                rows={3} 
                value={manufacturerInfo}
                onChange={e => setManufacturerInfo(e.target.value)}
                placeholder="Manufacturer details, origin, etc." 
                className={`${inputCls} resize-none`} 
              />
            </div>
          </section>

          {/* Status */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Package size={100} />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Publish Status</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <h4 className="text-lg font-semibold text-white">Ready to Publish</h4>
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                This product will be immediately visible across all platform storefronts upon publishing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
