import React, { useState, useEffect } from 'react';
import { 
  Package, Upload, Plus, X, 
  Save, CheckCircle2,
  Info, Image as ImageIcon, Layers,
  DollarSign, Tag, FileText, 
  Truck, ShieldCheck, ToggleLeft, ToggleRight,
  ArrowLeft, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from '../../utils/toast';
import { useParams, useNavigate } from 'react-router-dom';
import OptimizedImage from '../../components/common/OptimizedImage';

// generateCombinations removed for new Variant system

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
const tableInputCls = "w-full min-w-[80px] bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all outline-none placeholder:text-slate-400";

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
  const [article, setArticle] = useState('');
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

  // Highlights
  const [highlights, setHighlights] = useState({
    idealFor: '',
    outerMaterial: '',
    soleMaterial: '',
    occasion: '',
    color: '',
    pattern: '',
    fastening: ''
  });

  // Technical specs
  const [techSpecs, setTechSpecs] = useState({
    type: '',
    toeShape: '',
    careInstructions: '',
    fit: '',
    warranty: ''
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
  const [systemSettings, setSystemSettings] = useState(null);

  // Organization state
  const [brandName, setBrandName] = useState('Generic');
  const [brandId, setBrandId] = useState('');
  const [isTrending, setIsTrending] = useState(false);
  const [brands, setBrands] = useState([]);
  const [tags, setTags] = useState('');
  const [manufacturerInfo, setManufacturerInfo] = useState('');

  // Tax compliance
  const [hsnCode, setHsnCode] = useState('');

  // Variations state
  const [variations, setVariations] = useState([]);
  
  // Generator state
  const [generatorColors, setGeneratorColors] = useState('');
  const [generatorSizes, setGeneratorSizes] = useState('');
  const [generatorColorImages, setGeneratorColorImages] = useState({});

  // Visuals State
  const [images, setImages] = useState([]); // holds urls or previews
  const [imageFiles, setImageFiles] = useState([]); // holds files for multipart uploading

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
            setArticle(p.article || p.sku || '');
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
          setVariations(p.variations || []);
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

    const fetchSettings = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/admin/settings`);
        const data = await res.json();
        if (res.ok && data.success && data.settings) {
          setSystemSettings(data.settings);
        }
      } catch (err) {
        console.error('Failed to fetch system settings:', err);
      }
    };
    fetchSettings();
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

  const generateSku = (colorStr, sizeStr) => {
    if (!article) return '';
    const parts = [article.trim(), colorStr ? colorStr.trim() : '', sizeStr ? sizeStr.trim() : ''].filter(Boolean);
    return parts.join('-');
  };

  const handleGenerateVariants = () => {
    if (!article) {
      toast.info('Please enter the Article Number first before generating variants.');
      return;
    }
    const colors = generatorColors.split(',').map(c => c.trim()).filter(Boolean);
    const sizes = generatorSizes.split(',').map(s => s.trim()).filter(Boolean);

    if (colors.length === 0 || sizes.length === 0) {
      toast.info('Please enter at least one color and one size to generate.');
      return;
    }

    const generated = [];
    colors.forEach(color => {
      const colorKey = color.toLowerCase();
      const colorFiles = generatorColorImages[colorKey] || [];
      const imagesUrls = colorFiles.map(f => f.previewUrl);

      sizes.forEach(size => {
        generated.push({
          color,
          size,
          stock: 1,
          sku: generateSku(color, size),
          useDefaultPricing: true,
          mrp: '',
          sellingPrice: '',
          images: [...imagesUrls],
          newImageFiles: [...colorFiles]
        });
      });
    });

    // Replace or Append? Let's ask the user via a prompt or just replace.
    // Based on requirements, typically it just populates it. We'll append to be safe.
    setVariations(prev => [...prev, ...generated]);
    toast.success(`Generated ${generated.length} variants!`);
    
    // Clear inputs
    setGeneratorColors('');
    setGeneratorSizes('');
    setGeneratorColorImages({});
  };

  const handleAddVariation = () => {
    setVariations([...variations, {
      color: '',
      size: '',
      stock: 1,
      sku: '',
      useDefaultPricing: true,
      mrp: '',
      sellingPrice: '',
      images: []
    }]);
  };

  const handleRemoveVariation = (index) => {
    const updated = [...variations];
    updated.splice(index, 1);
    setVariations(updated);
  };

  const handleVariationChange = (index, field, value) => {
    const updated = [...variations];
    if (field === 'useDefaultPricing') {
      updated[index][field] = value;
      if (value) {
          updated[index].mrp = '';
          updated[index].sellingPrice = '';
      }
    } else {
      updated[index][field] = value;
    }
    setVariations(updated);
  };

  const handleAddVariantImageFile = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.info('Image size cannot exceed 10MB!');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const updated = [...variations];
      if (!updated[index].images) updated[index].images = [];
      if (!updated[index].newImageFiles) updated[index].newImageFiles = [];
      
      updated[index].images.push(previewUrl);
      updated[index].newImageFiles.push({ previewUrl, file });
      setVariations(updated);
    }
  };

  const handleRemoveVariantImage = (varIndex, imgIndex) => {
    const updated = [...variations];
    const target = updated[varIndex].images[imgIndex];
    updated[varIndex].images = updated[varIndex].images.filter((_, i) => i !== imgIndex);
    if (updated[varIndex].newImageFiles) {
        updated[varIndex].newImageFiles = updated[varIndex].newImageFiles.filter(item => item.previewUrl !== target);
    }
    setVariations(updated);
  };

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
    if (!name || !category || !sellingPrice || !article) {
      toast.info('Product Name, Category, Article Number, and Selling Price are required!');
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

    if (!variations || variations.length === 0) {
      toast.info('At least one variant is required!');
      return;
    }

    for (let i = 0; i < variations.length; i++) {
      const v = variations[i];
      if (!v.color || !v.size || !v.sku) {
        toast.info(`Color, Size, and SKU are required for Variation ${i + 1}!`);
        return;
      }
      if (Number(v.stock) < 0) {
        toast.info(`Variation ${i + 1} stock cannot be negative!`);
        return;
      }
      if (!v.useDefaultPricing) {
        if (!v.mrp || !v.sellingPrice) {
          toast.info(`Variant MRP and Selling Price are required for Variation ${i + 1} if default pricing is disabled!`);
          return;
        }
        if (Number(v.mrp) < Number(v.sellingPrice)) {
          toast.info(`Variant MRP cannot be less than Selling Price for Variation ${i + 1}!`);
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
      bodyFormData.append('article', article);
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
      bodyFormData.append('imageUrls', JSON.stringify(rawImageUrls));

      imageFiles.forEach(fileObj => {
        bodyFormData.append('images', fileObj.file);
      });

      variations.forEach((v, i) => {
          if (v.newImageFiles && v.newImageFiles.length > 0) {
              v.newImageFiles.forEach(fileObj => {
                  bodyFormData.append(`variantImages_${i}`, fileObj.file);
              });
          }
          const existingImages = (v.images || []).filter(img => typeof img === 'string' && !img.startsWith('blob:'));
          bodyFormData.append(`variantImagesExisting_${i}`, JSON.stringify(existingImages));
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
                <Label required>Article Number</Label>
                <input 
                  type="text" 
                  value={article}
                  onChange={e => setArticle(e.target.value)}
                  placeholder="e.g. RF-101" 
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
                    { key: 'idealFor', label: 'Ideal For (Men/Women)' },
                    { key: 'outerMaterial', label: 'Outer Material' },
                    { key: 'soleMaterial', label: 'Sole Material' },
                    { key: 'occasion', label: 'Occasion' },
                    { key: 'color', label: 'Color' },
                    { key: 'pattern', label: 'Pattern' },
                    { key: 'fastening', label: 'Fastening (Lace-Up etc)' }
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
                    { key: 'type', label: 'Type (Sneakers etc)' },
                    { key: 'toeShape', label: 'Toe Shape' },
                    { key: 'careInstructions', label: 'Care Instructions' },
                    { key: 'fit', label: 'Fit (Regular/Wide)' },
                    { key: 'warranty', label: 'Warranty' }
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
                <h3 className="text-base font-semibold text-slate-700">Variations</h3>
              </div>
              <button 
                onClick={handleAddVariation}
                className="text-sm font-semibold text-blue-500 hover:underline flex items-center gap-1"
              >
                <Plus size={16} /> Add Variant
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Variant Generator</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <Label>Colors</Label>
                  <input 
                    type="text" 
                    value={generatorColors}
                    onChange={e => setGeneratorColors(e.target.value)}
                    placeholder="e.g. Black, White" 
                    className={inputCls} 
                  />
                </div>
                <div>
                  <Label>Sizes (comma separated)</Label>
                  <input 
                    type="text" 
                    value={generatorSizes}
                    onChange={e => setGeneratorSizes(e.target.value)}
                    placeholder="e.g. UK 7, UK 8, UK 9" 
                    className={inputCls} 
                  />
                </div>
              </div>

              {generatorColors.split(',').map(c => c.trim()).filter(Boolean).length > 0 && (
                <div className="mb-4 space-y-3">
                  <Label>Color Images (Up to 3 per color)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {generatorColors.split(',').map(c => c.trim()).filter(Boolean).map((color, idx) => {
                      const colorKey = color.toLowerCase();
                      const uploadedFiles = generatorColorImages[colorKey] || [];
                      
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <span className="font-semibold text-sm text-slate-700 min-w-[60px]">{color}</span>
                          <div className="flex gap-2">
                            {uploadedFiles.map((fileObj, fIdx) => (
                              <div key={fIdx} className="relative w-10 h-10 border border-slate-200 rounded overflow-hidden group">
                                <img src={fileObj.previewUrl} alt="preview" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => {
                                    setGeneratorColorImages(prev => ({
                                      ...prev,
                                      [colorKey]: prev[colorKey].filter((_, i) => i !== fIdx)
                                    }));
                                  }}
                                  className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            {uploadedFiles.length < 3 && (
                              <label className="w-10 h-10 rounded border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-50 bg-white">
                                <Plus size={14} className="text-slate-400" />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    if (file.size > 10 * 1024 * 1024) {
                                      toast.info('Image size cannot exceed 10MB!');
                                      return;
                                    }
                                    const previewUrl = URL.createObjectURL(file);
                                    setGeneratorColorImages(prev => ({
                                      ...prev,
                                      [colorKey]: [...(prev[colorKey] || []), { previewUrl, file }]
                                    }));
                                  }} 
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button 
                onClick={handleGenerateVariants}
                className="px-4 py-2 bg-blue-50 text-blue-600 font-semibold text-sm rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
              >
                Generate Combinations
              </button>
            </div>

            {variations.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 min-w-[120px]">Color / Size</th>
                      <th className="px-4 py-3 min-w-[140px]">Default Price?</th>
                      <th className="px-4 py-3 min-w-[120px]">MRP (₹)</th>
                      <th className="px-4 py-3 min-w-[120px]">Selling (₹)</th>
                      <th className="px-4 py-3 min-w-[100px]">Stock</th>
                      <th className="px-4 py-3 min-w-[180px]">SKU</th>
                      <th className="px-4 py-3 min-w-[150px]">Images</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(() => {
                      const renderedColors = new Set();
                      return variations.map((v, i) => {
                        // Treat empty color string as unique so it always gets an upload button
                        const colorKey = v.color ? v.color.toLowerCase().trim() : `empty-${i}`;
                        const isFirstOfColor = !renderedColors.has(colorKey);
                        if (isFirstOfColor) {
                          renderedColors.add(colorKey);
                        }

                        return (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 align-top">
                              <input type="text" value={v.color} onChange={e => handleVariationChange(i, 'color', e.target.value)} placeholder="Color" className={`${tableInputCls} mb-2`} />
                              <input type="text" value={v.size} onChange={e => handleVariationChange(i, 'size', e.target.value)} placeholder="Size" className={tableInputCls} />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <button 
                                onClick={() => handleVariationChange(i, 'useDefaultPricing', !v.useDefaultPricing)}
                                className="flex items-center gap-2 mt-2"
                              >
                                 {v.useDefaultPricing ? <ToggleRight size={24} className="text-blue-500" /> : <ToggleLeft size={24} className="text-slate-400" />}
                                 <span className="text-xs font-medium text-slate-600 whitespace-nowrap">{v.useDefaultPricing ? 'Yes' : 'No'}</span>
                              </button>
                            </td>
                            <td className="px-4 py-3 align-top">
                              {v.useDefaultPricing ? (
                                <div className="text-xs text-slate-400 mt-3 font-medium text-center">Auto</div>
                              ) : (
                                <input type="number" value={v.mrp} onChange={e => handleVariationChange(i, 'mrp', e.target.value)} placeholder="MRP" className={tableInputCls} />
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {v.useDefaultPricing ? (
                                <div className="text-xs text-slate-400 mt-3 font-medium text-center">Auto</div>
                              ) : (
                                <input type="number" value={v.sellingPrice} onChange={e => handleVariationChange(i, 'sellingPrice', e.target.value)} placeholder="Selling" className={tableInputCls} />
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input type="number" value={v.stock} onChange={e => handleVariationChange(i, 'stock', e.target.value)} placeholder="Stock" className={tableInputCls} />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center gap-1">
                                 <input type="text" value={v.sku} onChange={e => handleVariationChange(i, 'sku', e.target.value)} placeholder="SKU" className={tableInputCls} />
                                 <button 
                                   onClick={() => handleVariationChange(i, 'sku', generateSku(v.color, v.size))}
                                   title="Generate SKU"
                                   className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-colors"
                                 >
                                   <RefreshCw size={14} />
                                 </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              {isFirstOfColor ? (
                                <div className="flex gap-1.5 flex-wrap items-center">
                                  {v.images && v.images.map((img, imgIdx) => (
                                    <div key={imgIdx} className="w-10 h-10 rounded border border-slate-200 relative group bg-white">
                                      <OptimizedImage src={img} alt="Variant" type="product" className="w-full h-full object-contain p-0.5 rounded" />
                                      <button 
                                        onClick={() => handleRemoveVariantImage(i, imgIdx)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                      >
                                        <X size={8} />
                                      </button>
                                    </div>
                                  ))}
                                  {(!v.images || v.images.length < 3) && (
                                    <label className="w-10 h-10 rounded border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-100 bg-white group">
                                      <Plus size={12} className="text-slate-400 group-hover:text-slate-600" />
                                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAddVariantImageFile(i, e)} />
                                    </label>
                                  )}
                                </div>
                              ) : (
                                <div className="h-full flex items-center justify-center pt-3">
                                   <span className="text-[10px] text-slate-400 font-medium italic">Same as above</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle text-center">
                              <button onClick={() => handleRemoveVariation(i)} title="Remove Variant" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <X size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3">
                <Layers size={32} />
                <p className="text-sm font-medium text-center text-slate-400">No variations defined.<br />Use the generator above or click Add Variant.</p>
              </div>
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
              {
                key: 'topSection',
                label: systemSettings?.featuredCollectionHeaderName || 'Featured Collection',
                desc: `Show in the ${systemSettings?.featuredCollectionHeaderName || 'Featured Collection'} grid`
              },
              {
                key: 'crazyDeals',
                label: systemSettings?.crazyDealsHeaderName || 'Crazy Deals',
                desc: `Feature in the ${systemSettings?.crazyDealsHeaderName || 'Crazy Deals'} list`
              },
              {
                key: 'flashSale',
                label: systemSettings?.newArrivalsHeaderName || 'New Arrivals',
                desc: `Include in the ${systemSettings?.newArrivalsHeaderName || 'New Arrivals'} active list`
              },
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