const Product = require('../Models/Product');
const Brand = require('../Models/Brand');
const { getImageUrl } = require('../utils/imageHelper');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const parseJsonField = (field, defaultVal = {}) => {
  if (!field) return defaultVal;
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch (err) {
    return defaultVal;
  }
};

const ensureProductFallbackImage = (product) => {
  if (!product) return product;
  const hasValidImages = product.images && product.images.filter(img => img && img.trim() !== '' && img !== 'undefined').length > 0;
  if (!hasValidImages && product.variations && product.variations.length > 0) {
    const firstVarWithImg = product.variations.find(v => v.images && v.images.length > 0);
    if (firstVarWithImg) {
      product.images = [firstVarWithImg.images[0]];
    }
  }
  if (product.variations) {
    delete product.variations;
  }
  return product;
};

const resolveCategoryAndSubcategory = async (categoryInput, subCategoryInput) => {
  if (!categoryInput) return { categoryId: categoryInput, subCategoryId: subCategoryInput };
  
  const CategoryChip = require('../Models/CategoryChip');
  const SubCategoryChip = require('../Models/SubCategoryChip');
  const mongoose = require('mongoose');

  let categoryId = categoryInput;
  let subCategoryId = subCategoryInput;

  // Resolve Category
  if (categoryInput && !mongoose.Types.ObjectId.isValid(categoryInput)) {
    const foundCat = await CategoryChip.findOne({
      $or: [
        { id: categoryInput.trim() },
        { categoryName: { $regex: new RegExp(`^${categoryInput.trim()}$`, 'i') } }
      ]
    });
    if (foundCat) {
      categoryId = foundCat._id.toString();
    } else {
      const generatedId = categoryInput.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const newCat = await CategoryChip.create({
        id: generatedId,
        categoryName: categoryInput.trim(),
        active: true
      });
      categoryId = newCat._id.toString();
    }
  }

  // Resolve Subcategory
  if (subCategoryInput && !mongoose.Types.ObjectId.isValid(subCategoryInput)) {
    // Find parent category slug/id
    let parentSlug = '';
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const parentCat = await CategoryChip.findById(categoryId);
      if (parentCat) {
        parentSlug = parentCat.id;
      }
    }

    const query = {
      $or: [
        { id: subCategoryInput.trim() },
        { subCategoryName: { $regex: new RegExp(`^${subCategoryInput.trim()}$`, 'i') } }
      ]
    };
    if (parentSlug) {
      query.categoryId = parentSlug;
    }

    const foundSub = await SubCategoryChip.findOne(query);
    if (foundSub) {
      subCategoryId = foundSub._id.toString();
    } else if (parentSlug) {
      const generatedSubId = `${parentSlug}-${subCategoryInput.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
      const newSub = await SubCategoryChip.create({
        id: generatedSubId,
        categoryId: parentSlug,
        subCategoryName: subCategoryInput.trim(),
        active: true
      });
      subCategoryId = newSub._id.toString();
    }
  }

  return { categoryId, subCategoryId };
};

// @desc    Get all Products
// @route   GET /api/admin/catalog/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const { category, status, search, full } = req.query;
    const filter = {};

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { $text: { $search: search } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    let query = Product.find(filter);
    query = query.select(full !== 'true' ? '-highlights -technicalSpecs -description -shippingSpecs -costPrice' : '-costPrice');
    const products = await query.sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create a Product
// @route   POST /api/admin/catalog/products
// @access  Private (Admin)
const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      sellingPrice,
      mrp,
      stock,
      discountLabel,
      sku,
      article,
      gstCategory,
      gstPercentage,
      hsnCode,
      brandName,
      brandId,
      isTrending,
      manufacturerInfo,
      status,
      subCategory
    } = req.body;

    if (!name || !category || sellingPrice === undefined || mrp === undefined) {
      return res.status(400).json({ success: false, message: 'Name, Category, MRP, and Selling Price are required' });
    }

    if (!article) {
      return res.status(400).json({ success: false, message: 'Article Number is required' });
    }

    if (Number(mrp) < Number(sellingPrice)) {
      return res.status(400).json({ success: false, message: 'Actual Price (MRP) cannot be less than Selling Price' });
    }

    const variations = parseJsonField(req.body.variations, []);
    if (!Array.isArray(variations) || variations.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one variant is required.' });
    }
    
    // Validate each variant
    for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        if ((!v.color && !v.size) || v.stock === undefined || v.stock === '' || !v.sku) {
            return res.status(400).json({ success: false, message: `At least Color or Size, plus Stock and SKU are required for variant ${i+1}.` });
        }
        if (!v.useDefaultPricing) {
            if (v.mrp === undefined || v.mrp === '' || v.sellingPrice === undefined || v.sellingPrice === '') {
                return res.status(400).json({ success: false, message: `Variant MRP and Selling Price are required for variant ${v.sku} if default pricing is disabled.` });
            }
            if (Number(v.mrp) < Number(v.sellingPrice)) {
                return res.status(400).json({ success: false, message: `Variant MRP cannot be less than Variant Selling Price for variant ${v.sku}.` });
            }
        }
    }

    if (stock !== undefined && Number(stock) < 0) {
      return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
    }

    let imageUrls = [];
    let descriptionImages = [];
    if (req.processedFiles && req.processedFiles.length > 0) {
      imageUrls = req.processedFiles
        .filter(f => f.fieldname === 'images' || !f.fieldname)
        .map(f => getImageUrl(f.url));
        
      descriptionImages = req.processedFiles
        .filter(f => f.fieldname === 'descriptionImages')
        .map(f => getImageUrl(f.url));
    }

    // Process variant images
    for (let i = 0; i < variations.length; i++) {
      const v = variations[i];
        let newVImages = [];
        if (req.processedFiles) {
          const vFiles = req.processedFiles.filter(f => f.fieldname === `variantImages_${i}`);
          if (vFiles.length > 0) {
             newVImages = vFiles.map(f => getImageUrl(f.url));
          }
        }
        const existingVariantImages = req.body[`variantImagesExisting_${i}`];
        const existingVImages = existingVariantImages ? parseJsonField(existingVariantImages, []) : [];
        v.images = [...existingVImages, ...newVImages];
      }

    // Check if additional image URLs were sent in body
    const bodyImages = parseJsonField(req.body.imageUrls, []);
    if (Array.isArray(bodyImages)) {
      imageUrls = [...imageUrls, ...bodyImages];
    }

    // Fallback: If global product has no images, but a variation does, use it
    const hasValidImages = imageUrls.filter(img => img && img.trim() !== '' && img !== 'undefined').length > 0;
    if (!hasValidImages && variations && variations.length > 0) {
      const firstVarWithImg = variations.find(v => v.images && v.images.length > 0);
      if (firstVarWithImg) {
        imageUrls = [firstVarWithImg.images[0]];
      }
    }

    const { categoryId, subCategoryId } = await resolveCategoryAndSubcategory(category, subCategory);

    let resolvedBrandName = brandName || 'Generic';
    if (brandId) {
      const brand = await Brand.findById(brandId);
      if (brand) {
        resolvedBrandName = brand.name;
      }
    }

    const newProduct = new Product({
      name,
      category: categoryId,
      subCategory: subCategoryId,
      description,
      sellingPrice: Number(sellingPrice),
      mrp: mrp ? Number(mrp) : undefined,
      costPrice: req.body.costPrice !== undefined && req.body.costPrice !== '' ? Number(req.body.costPrice) : undefined,
      stock: stock ? Number(stock) : 1,
      discountLabel,
      sku: sku || `SKU-${Date.now()}`,
      article,
      highlights: parseJsonField(req.body.highlights),
      technicalSpecs: parseJsonField(req.body.technicalSpecs),
      specifications: (() => {
        const specs = parseJsonField(req.body.specifications, []);
        if (!Array.isArray(specs)) return [];
        return specs.map(s => ({
          ...s,
          fields: (s.fields || []).filter(f => f.name && f.value && f.name.trim() !== '' && f.value.trim() !== '')
        })).filter(s => s.section && s.section.trim() !== '' && s.fields.length > 0);
      })(),
      descriptionImages,
      shippingSpecs: parseJsonField(req.body.shippingSpecs),
      flags: parseJsonField(req.body.flags, { topSection: false, crazyDeals: false, flashSale: false }),
      gstCategory,
      gstPercentage: Number(gstPercentage) || 0,
      hsnCode,
      images: imageUrls,
      brandId: brandId || undefined,
      brandName: resolvedBrandName,
      isTrending: isTrending === 'true' || isTrending === true,
      tags: parseJsonField(req.body.tags, []),
      manufacturerInfo,
      status: status || 'Pending',
      variations: variations
    });

    await newProduct.save();
    res.status(201).json({ success: true, message: 'Product created successfully', product: newProduct });
  } catch (error) {
    console.error('Create Product Error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      if (field === 'article') {
        return res.status(400).json({ success: false, message: 'Article Number must be unique' });
      }
      return res.status(400).json({ success: false, message: 'SKU must be unique' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update a Product
// @route   PUT /api/admin/catalog/products/:id
// @access  Private (Admin)
const updateProduct = async (req, res) => {
  try {
    console.log('[updateProduct] body keys:', Object.keys(req.body));
    console.log('[updateProduct] mrp:', req.body.mrp, 'sellingPrice:', req.body.sellingPrice);
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const finalSellingPrice = req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : product.sellingPrice;
    const finalMrp = req.body.mrp !== undefined ? (req.body.mrp ? Number(req.body.mrp) : undefined) : product.mrp;
    if (finalMrp !== undefined && finalMrp < finalSellingPrice) {
      return res.status(400).json({ success: false, message: 'Actual Price (MRP) cannot be less than Selling Price' });
    }

    if (req.body.stock !== undefined && Number(req.body.stock) < 0) {
      return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
    }

    if (req.body.category !== undefined || req.body.subCategory !== undefined) {
      const catVal = req.body.category !== undefined ? req.body.category : product.category;
      const subVal = req.body.subCategory !== undefined ? req.body.subCategory : product.subCategory;
      const { categoryId, subCategoryId } = await resolveCategoryAndSubcategory(catVal, subVal);
      if (req.body.category !== undefined) req.body.category = categoryId;
      if (req.body.subCategory !== undefined) req.body.subCategory = subCategoryId;
    }

    const fields = [
      'name', 'category', 'subCategory', 'description', 'sellingPrice',
      'mrp', 'costPrice', 'stock', 'discountLabel', 'sku', 'article', 'gstCategory', 'gstPercentage', 'hsnCode',
      'manufacturerInfo', 'status'
    ];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (['sellingPrice', 'mrp', 'costPrice', 'stock', 'gstPercentage'].includes(f)) {
          product[f] = req.body[f] === '' ? undefined : Number(req.body[f]);
        } else {
          product[f] = req.body[f];
        }
      }
    });

    if (req.body.brandId !== undefined) {
      if (req.body.brandId && req.body.brandId !== 'null' && req.body.brandId !== '' && req.body.brandId !== '[object Object]') {
        product.brandId = req.body.brandId;
        const brand = await Brand.findById(req.body.brandId);
        if (brand) {
          product.brandName = brand.name;
        }
      } else {
        product.brandId = undefined;
        product.brandName = req.body.brandName || 'Generic';
      }
    } else if (req.body.brandName !== undefined) {
      product.brandName = req.body.brandName;
    }

    if (req.body.isTrending !== undefined) {
      product.isTrending = req.body.isTrending === 'true' || req.body.isTrending === true;
    }

    // Handle parsed nested objects/arrays if present in req.body
    if (req.body.highlights !== undefined) product.highlights = parseJsonField(req.body.highlights);
    if (req.body.technicalSpecs !== undefined) product.technicalSpecs = parseJsonField(req.body.technicalSpecs);
    if (req.body.specifications !== undefined) {
      const parsedSpecs = parseJsonField(req.body.specifications, []);
      if (Array.isArray(parsedSpecs)) {
        product.specifications = parsedSpecs.map(s => ({
          ...s,
          fields: (s.fields || []).filter(f => f.name && f.value && f.name.trim() !== '' && f.value.trim() !== '')
        })).filter(s => s.section && s.section.trim() !== '' && s.fields.length > 0);
      } else {
        product.specifications = [];
      }
      product.markModified('specifications');
    }
    if (req.body.shippingSpecs !== undefined) product.shippingSpecs = parseJsonField(req.body.shippingSpecs);
    if (req.body.flags !== undefined) product.flags = parseJsonField(req.body.flags);
    if (req.body.tags !== undefined) product.tags = parseJsonField(req.body.tags);
    if (req.body.variations !== undefined) {
      const variations = parseJsonField(req.body.variations, []);
      if (!Array.isArray(variations) || variations.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one variant is required.' });
      }
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        if ((!v.color && !v.size) || v.stock === undefined || v.stock === '' || !v.sku) {
            return res.status(400).json({ success: false, message: `At least Color or Size, plus Stock and SKU are required for variant ${i+1}.` });
        }
        if (!v.useDefaultPricing) {
            if (v.mrp === undefined || v.mrp === '' || v.sellingPrice === undefined || v.sellingPrice === '') {
                return res.status(400).json({ success: false, message: `Variant MRP and Selling Price are required for variant ${v.sku} if default pricing is disabled.` });
            }
            if (Number(v.mrp) < Number(v.sellingPrice)) {
                return res.status(400).json({ success: false, message: `Variant MRP cannot be less than Variant Selling Price for variant ${v.sku}.` });
            }
        }
      }

      // Process variant images on the raw array before assigning to product.variations
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        let newVImages = [];
        if (req.processedFiles) {
          const vFiles = req.processedFiles.filter(f => f.fieldname === `variantImages_${i}`);
          if (vFiles.length > 0) {
             newVImages = vFiles.map(f => getImageUrl(f.url));
          }
        }
        const existingVariantImages = req.body[`variantImagesExisting_${i}`];
        const existingVImages = existingVariantImages ? parseJsonField(existingVariantImages, []) : [];
        v.images = [...existingVImages, ...newVImages];
      }

      product.variations = variations;
      product.markModified('variations');
    }

    // Process Images
    let updatedImages = product.images || [];
    if (req.body.imageUrls !== undefined) {
      updatedImages = parseJsonField(req.body.imageUrls);
    }

    if (req.processedFiles && req.processedFiles.length > 0) {
      const newUrls = req.processedFiles
        .filter(f => f.fieldname === 'images' || !f.fieldname)
        .map(f => getImageUrl(f.url));
      updatedImages = [...updatedImages, ...newUrls];
    }

    product.images = updatedImages;

    // Process Description Images
    let updatedDescImages = product.descriptionImages || [];
    if (req.body.descriptionImagesExisting !== undefined) {
      updatedDescImages = parseJsonField(req.body.descriptionImagesExisting);
    }
    if (req.processedFiles && req.processedFiles.length > 0) {
      const newDescUrls = req.processedFiles
        .filter(f => f.fieldname === 'descriptionImages')
        .map(f => getImageUrl(f.url));
      console.log('[updateProduct] newDescUrls:', newDescUrls);
      updatedDescImages = [...updatedDescImages, ...newDescUrls];
    }
    console.log('[updateProduct] Final descriptionImages:', updatedDescImages);
    product.descriptionImages = updatedDescImages;

    // Fallback: If global product has no images, but a variation does, use it
    const hasValidImages = product.images && product.images.filter(img => img && img.trim() !== '' && img !== 'undefined').length > 0;
    if (!hasValidImages && product.variations && product.variations.length > 0) {
      const firstVarWithImg = product.variations.find(v => v.images && v.images.length > 0);
      if (firstVarWithImg) {
        product.images = [firstVarWithImg.images[0]];
      }
    }

    await product.save();
    res.status(200).json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    console.error('Update Product Error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      if (field === 'article') {
        return res.status(400).json({ success: false, message: 'Article Number must be unique' });
      }
      return res.status(400).json({ success: false, message: 'SKU must be unique' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Delete a Product
// @route   DELETE /api/admin/catalog/products/:id
// @access  Private (Admin)
const deleteProduct = async (req, res) => {
  try {
    const result = await Product.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Bulk Delete Products
// @route   POST /api/admin/catalog/products/bulk-delete
// @access  Private (Admin)
const bulkDeleteProducts = async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No product IDs provided' });
    }

    const result = await Product.deleteMany({ _id: { $in: productIds } });

    res.status(200).json({ 
      success: true, 
      message: `Successfully deleted ${result.deletedCount} products`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Bulk Delete Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Product by ID
// @route   GET /api/admin/catalog/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID format' });
    }
    const product = await Product.findById(req.params.id).populate('brandId').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const CategoryChip = require('../Models/CategoryChip');
    const SubCategoryChip = require('../Models/SubCategoryChip');

    let categoryLabel = product.category;
    let cat = null;
    if (product.category) {
      const isObjectId = mongoose.isValidObjectId(product.category);
      cat = await CategoryChip.findOne({
        $or: [
          { id: product.category },
          ...(isObjectId ? [{ _id: product.category }] : [])
        ]
      });
      if (cat) {
        categoryLabel = cat.categoryName;
      }
    }

    let subCategoryLabel = product.subCategory;
    if (product.subCategory) {
      const isObjectId = mongoose.isValidObjectId(product.subCategory);
      const subcat = await SubCategoryChip.findOne({
        $or: [
          { id: product.subCategory },
          ...(isObjectId ? [{ _id: product.subCategory }] : [])
        ]
      });
      if (subcat) {
        subCategoryLabel = subcat.subCategoryName;
      }
    }

    const enrichedProduct = {
      ...product,
      categoryName: categoryLabel,
      subCategoryName: subCategoryLabel,
      brandName: product.brandId ? product.brandId.name : (product.brandName || 'Generic'),
      sizeChart: cat ? cat.sizeChart : null
    };

    if (!req.admin) {
      delete enrichedProduct.costPrice;
    }

    res.status(200).json({ success: true, product: enrichedProduct });
  } catch (error) {
    console.error('Get Product By ID Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Top 10 Buys (products sorted by sales)
// @route   GET /api/admin/catalog/products/top-buys
// @access  Public
const fetchDynamicTopBuys = async () => {
  const Order = require('../Models/Order');
  const Product = require('../Models/Product');
  
  const topBuyStats = await Order.aggregate([
    { 
      $match: { 
        status: 'Delivered', 
        paymentStatus: 'Paid' 
      } 
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        totalQuantity: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 }
  ]);

  const productIds = topBuyStats.map(stat => stat._id);
  
  let products = [];
  if (productIds.length > 0) {
    products = await Product.find({ 
      _id: { $in: productIds }, 
      status: 'Approved' 
    })
    .select('name brandName mrp sellingPrice discountLabel images rating sales category subCategory description flags stock variations')
    .lean();
    
    products.sort((a, b) => {
      const aIdx = productIds.findIndex(id => id.toString() === a._id.toString());
      const bIdx = productIds.findIndex(id => id.toString() === b._id.toString());
      return aIdx - bIdx;
    });
  }

  if (products.length < 10) {
    const existingIds = products.map(p => p._id.toString());
    const remainingCount = 10 - products.length;
    
    const fallbackProducts = await Product.find({
      status: 'Approved',
      _id: { $nin: existingIds }
    })
    .select('name brandName mrp sellingPrice discountLabel images rating sales category subCategory description flags stock variations')
    .sort({ sales: -1 })
    .limit(remainingCount)
    .lean();
    
    products = [...products, ...fallbackProducts];
  }

  return products.map(ensureProductFallbackImage);
};

const getTopBuys = async (req, res) => {
  try {
    const products = await fetchDynamicTopBuys();
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Get Top Buys Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Trending Brands (brands aggregated by product sales)
// @route   GET /api/admin/catalog/products/trending-brands
// @access  Public
const getTrendingBrands = async (req, res) => {
  try {
    const Brand = require('../Models/Brand');
    let brands = await Brand.find({ isTrending: true, status: 'Active' }).limit(6).lean();

    if (brands.length === 0) {
      const Product = require('../Models/Product');
      const aggregated = await Product.aggregate([
        { $match: { status: 'Approved' } },
        {
          $group: {
            _id: '$brandName',
            brand: { $first: '$brandName' },
            sales: { $sum: '$sales' },
            image: { $first: { $arrayElemAt: ['$images', 0] } }
          }
        },
        { $sort: { sales: -1 } },
        { $limit: 6 }
      ]);
      brands = aggregated.map(b => ({
        _id: b._id,
        brand: b.brand,
        sales: b.sales,
        image: b.image
      }));
    } else {
      // Map new model properties to properties expected by existing integrations
      brands = brands.map(b => ({
        _id: b._id,
        brand: b.name,
        image: b.logo
      }));
    }

    res.status(200).json({ success: true, brands });
  } catch (error) {
    console.error('Get Trending Brands Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const getHomepageData = async (req, res) => {
  try {
    const CategoryChip = require('../Models/CategoryChip');
    const SubCategoryChip = require('../Models/SubCategoryChip');
    const Banner = require('../Models/Banner');
    const Brand = require('../Models/Brand');

    const [chips, subchips, banners, products, topBuys, dbTrendingBrands] = await Promise.all([
      CategoryChip.find({}).sort({ order: 1 }).lean(),
      SubCategoryChip.find({}).lean(),
      Banner.find({}).sort({ createdAt: -1 }).lean(),
      Product.find({ status: 'Approved' })
        .select('-highlights -technicalSpecs -description -shippingSpecs -costPrice')
        .sort({ createdAt: -1 })
        .lean(),
      fetchDynamicTopBuys(),
      Brand.find({ isTrending: true, status: 'Active' }).lean()
    ]);

    const trendingBrands = dbTrendingBrands.map(b => ({
      _id: b._id,
      brand: b.name,
      logo: b.logo,
      image: b.logo
    }));

    const processedProducts = products.map(ensureProductFallbackImage);
    const processedTopBuys = topBuys.map(ensureProductFallbackImage);

    res.status(200).json({
      success: true,
      chips,
      subchips,
      banners,
      products: processedProducts,
      topBuys: processedTopBuys,
      trendingBrands
    });
  } catch (error) {
    console.error('Get Homepage Data Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};


const getCombinedCatalog = async (req, res) => {
  try {
    const CategoryChip = require('../Models/CategoryChip');
    const SubCategoryChip = require('../Models/SubCategoryChip');
    const mongoose = require('mongoose');

    // Extract query parameters
    const { 
      page = 1, 
      limit = 20, 
      category = 'for-you', 
      subCategory = 'all', 
      sortBy = 'none', 
      search = '' 
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (parsedPage - 1) * parsedLimit;

    // Base query: only approved products
    const andConditions = [{ status: 'Approved' }];

    // 1. Category filter
    if (category && category !== 'for-you') {
      const cleanCategory = String(category).trim();
      const catOrConditions = [
        { id: cleanCategory },
        { categoryName: { $regex: new RegExp(`^${cleanCategory}$`, 'i') } }
      ];
      if (mongoose.Types.ObjectId.isValid(cleanCategory)) {
        catOrConditions.push({ _id: cleanCategory });
      }

      const foundChip = await CategoryChip.findOne({
        $or: catOrConditions
      }).lean();

      if (foundChip) {
        andConditions.push({
          $or: [
            { category: foundChip._id.toString() },
            { category: foundChip.id },
            { category: { $regex: new RegExp(`^${foundChip.categoryName.trim()}$`, 'i') } },
            { category: cleanCategory }
          ]
        });
      } else {
        andConditions.push({
          category: { $regex: new RegExp(`^${cleanCategory}$`, 'i') }
        });
      }
    }

    // 2. Subcategory filter
    if (subCategory && subCategory !== 'all') {
      const cleanSubCategory = String(subCategory).trim();
      const subCatOrConditions = [
        { id: cleanSubCategory },
        { subCategoryName: { $regex: new RegExp(`^${cleanSubCategory}$`, 'i') } }
      ];
      if (mongoose.Types.ObjectId.isValid(cleanSubCategory)) {
        subCatOrConditions.push({ _id: cleanSubCategory });
      }

      const matchedChips = await SubCategoryChip.find({
        $or: subCatOrConditions
      }).lean();

      if (matchedChips && matchedChips.length > 0) {
        const subNames = matchedChips.map(c => c.subCategoryName);
        const allRelatedChips = await SubCategoryChip.find({
          subCategoryName: { $in: subNames }
        }).lean();

        const subCategoryIds = new Set();
        const subCategorySlugs = new Set();
        const subCategoryNames = new Set();

        allRelatedChips.forEach(c => {
          if (c._id) subCategoryIds.add(c._id.toString());
          if (c.id) subCategorySlugs.add(c.id);
          if (c.subCategoryName) subCategoryNames.add(c.subCategoryName);
        });

        // Add the query string itself just in case
        subCategoryIds.add(cleanSubCategory);

        const orList = [];
        subCategoryIds.forEach(id => {
          orList.push({ subCategory: id });
        });
        subCategorySlugs.forEach(slug => {
          orList.push({ subCategory: slug });
        });
        subCategoryNames.forEach(name => {
          orList.push({ subCategory: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        });

        andConditions.push({ $or: orList });
      } else {
        andConditions.push({
          subCategory: { $regex: new RegExp(`^${cleanSubCategory}$`, 'i') }
        });
      }
    }

    // 3. Search query
    let isTextSearch = false;
    if (search && search.trim() !== '') {
      andConditions.push({
        $text: { $search: search.trim() }
      });
      isTextSearch = true;
    }

    const finalQuery = { $and: andConditions };

    // 4. Sorting option & Projection
    let sortOption = { createdAt: -1 };
    let projection = { highlights: 0, technicalSpecs: 0, description: 0, variations: 0, shippingSpecs: 0, costPrice: 0 };
    
    if (isTextSearch) {
      projection.score = { $meta: 'textScore' };
      if (sortBy === 'none') {
        sortOption = { score: { $meta: 'textScore' } };
      }
    }

    if (sortBy === 'price-low') {
      sortOption = { sellingPrice: 1 };
    } else if (sortBy === 'price-high') {
      sortOption = { sellingPrice: -1 };
    } else if (sortBy === 'rating') {
      sortOption = { rating: -1 };
    }

    // Run queries in parallel
    const chipsPromise = (parsedPage === 1)
      ? CategoryChip.find({}).sort({ order: 1 }).lean()
      : Promise.resolve([]);

    const subchipsPromise = (parsedPage === 1)
      ? SubCategoryChip.find({}).lean()
      : Promise.resolve([]);

    const productsPromise = Product.find(finalQuery, projection)
      .sort(sortOption)
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const countPromise = Product.countDocuments(finalQuery);

    const [chips, subchips, products, totalProducts] = await Promise.all([
      chipsPromise,
      subchipsPromise,
      productsPromise,
      countPromise
    ]);

    const processedProducts = products.map(ensureProductFallbackImage);

    res.status(200).json({
      success: true,
      chips: parsedPage === 1 ? chips : undefined,
      subchips: parsedPage === 1 ? subchips : undefined,
      products: processedProducts,
      totalProducts,
      totalPages: Math.ceil(totalProducts / parsedLimit),
      currentPage: parsedPage,
      hasMore: skip + products.length < totalProducts
    });
  } catch (error) {
    console.error('Get Combined Catalog Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const processImageUrl = async (imageUrl) => {
  if (!imageUrl) return '';
  const url = String(imageUrl).trim();

  // If it's not an http/https URL, return as is
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }

  try {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      timeout: 15000
    });

    const buffer = Buffer.from(response.data);
    const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outputPath = path.join(uploadDir, filename);

    // Standardize to 1000x1000 WebP centered on a white square canvas
    await sharp(buffer)
      .resize(1000, 1000, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .sharpen({ sigma: 0.5 })
      .webp({ quality: 85, effort: 4 })
      .toFile(outputPath);

    return `/uploads/${filename}`;
  } catch (err) {
    console.error(`Failed to process remote image URL (${url}):`, err.message);
    return url;
  }
};

// Same standardization pipeline as processImageUrl, but for a raw buffer (e.g. extracted from a ZIP)
const processImageBuffer = async (buffer) => {
  try {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outputPath = path.join(uploadDir, filename);

    await sharp(buffer)
      .resize(1000, 1000, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .sharpen({ sigma: 0.5 })
      .webp({ quality: 85, effort: 4 })
      .toFile(outputPath);

    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Failed to process image extracted from ZIP:', err.message);
    return null;
  }
};

// Reads an optional images ZIP into a lowercased-filename -> Buffer map, ignoring folders and OS/junk entries
const buildZipImageMap = async (zipFile) => {
  const map = {};
  if (!zipFile) return map;
  try {
    const zip = await JSZip.loadAsync(zipFile.buffer);
    for (const entryPath of Object.keys(zip.files)) {
      const entry = zip.files[entryPath];
      if (entry.dir) continue;
      const baseName = entryPath.split('/').pop();
      if (!baseName || baseName.startsWith('.') || entryPath.startsWith('__MACOSX')) continue;
      map[baseName.toLowerCase()] = await entry.async('nodebuffer');
    }
  } catch (err) {
    console.error('Failed to read images ZIP:', err.message);
  }
  return map;
};

// Resolves one entry from an "Image URLs" style column: an http(s) URL is downloaded as before,
// anything else is looked up by filename inside the uploaded images ZIP.
const resolveImageEntry = async (rawValue, zipImageMap, warningsList, rowLabel) => {
  const value = (rawValue || '').toString().trim();
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return await processImageUrl(value);
  }

  const key = value.split('/').pop().toLowerCase();
  const buffer = zipImageMap[key];
  if (!buffer) {
    warningsList.push({ row: rowLabel, message: `Image "${value}" was not found in the uploaded ZIP.` });
    return null;
  }
  const processed = await processImageBuffer(buffer);
  if (!processed) {
    warningsList.push({ row: rowLabel, message: `Image "${value}" could not be processed (invalid or corrupt image file).` });
  }
  return processed;
};

const GST_PERCENTAGE_OPTIONS = [0, 5, 12, 18, 28];

const bulkUploadProducts = async (req, res) => {
  try {
    const excelFile = req.files && req.files.file && req.files.file[0];
    if (!excelFile) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Read the workbook using XLSX
    let workbook;
    try {
      workbook = XLSX.read(excelFile.buffer, { type: 'buffer' });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Failed to parse file. Make sure it is a valid Excel or CSV file.' });
    }

    // Optional ZIP of local image files, referenced by filename from the Image URL columns
    const zipFile = req.files && req.files.imagesZip && req.files.imagesZip[0];
    const zipImageMap = await buildZipImageMap(zipFile);

    const readSheetRows = (name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return null;
      return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        .filter(row => row.length > 0 && row.some(val => val !== undefined && val !== null && val.toString().trim() !== ''));
    };

    // The Products sheet is named 'Products' in our template, but fall back to the
    // first sheet so a plain CSV export (single sheet, no name) still works.
    const productsSheetName = workbook.SheetNames.includes('Products') ? 'Products' : workbook.SheetNames[0];
    const rows = readSheetRows(productsSheetName);

    if (!rows || rows.length < 2) {
      return res.status(400).json({ success: false, message: 'Excel/CSV file must contain headers and at least one product row.' });
    }

    const headers = rows[0].map(h => (h || '').toString().trim());

    // Support the 'Name'/'Product Name' and 'Selling Price'/'Price' aliases for convenience
    const hasNameCol = headers.includes('Name') || headers.includes('Product Name');
    const hasArticleCol = headers.includes('Article Number');
    const hasCategoryCol = headers.includes('Category');
    const hasMrpCol = headers.includes('MRP');
    const hasPriceCol = headers.includes('Selling Price') || headers.includes('Price');
    const hasWeightCol = headers.includes('Weight (kg)');

    if (!hasNameCol || !hasArticleCol || !hasCategoryCol || !hasMrpCol || !hasPriceCol || !hasWeightCol) {
      const missing = [];
      if (!hasNameCol) missing.push('Name');
      if (!hasArticleCol) missing.push('Article Number');
      if (!hasCategoryCol) missing.push('Category');
      if (!hasMrpCol) missing.push('MRP');
      if (!hasPriceCol) missing.push('Selling Price');
      if (!hasWeightCol) missing.push('Weight (kg)');
      return res.status(400).json({ success: false, message: `Missing required columns: ${missing.join(', ')}. Please download the latest template.` });
    }

    const CategoryChip = require('../Models/CategoryChip');
    const SubCategoryChip = require('../Models/SubCategoryChip');
    const mongoose = require('mongoose');

    // 1. Fetch all records from database for in-memory caching
    const dbCategories = await CategoryChip.find({});
    const dbSubCategories = await SubCategoryChip.find({});

    // 2. Build lookups (case-insensitive keys)
    const categoryMap = {}; // name.toLowerCase() -> category doc
    const categoryByIdMap = {}; // _id -> category doc
    const categoryBySlugMap = {}; // id (slug) -> category doc

    dbCategories.forEach(cat => {
      categoryMap[cat.categoryName.trim().toLowerCase()] = cat;
      categoryByIdMap[cat._id.toString()] = cat;
      categoryBySlugMap[cat.id.trim().toLowerCase()] = cat;
    });

    const subCategoryMap = {}; // "parentCatSlug:subName" -> subCategory doc
    const subCategoryByIdMap = {}; // _id -> subCategory doc

    dbSubCategories.forEach(sub => {
      subCategoryByIdMap[sub._id.toString()] = sub;
      const parentSlug = (sub.categoryId || '').trim().toLowerCase();
      const subName = sub.subCategoryName.trim().toLowerCase();
      subCategoryMap[`${parentSlug}:${subName}`] = sub;
    });

    const autoCreate = req.query.autoCreate === 'true' || req.body.autoCreate === 'true' || req.query.autoCreate === true || req.body.autoCreate === true;

    // Helper to resolve Category
    const resolveCategory = async (catInput) => {
      if (!catInput) return null;
      const cleanInput = catInput.toString().trim();
      const lowerInput = cleanInput.toLowerCase();

      if (mongoose.Types.ObjectId.isValid(cleanInput)) {
        if (categoryByIdMap[cleanInput]) return categoryByIdMap[cleanInput];
      }

      if (categoryMap[lowerInput]) return categoryMap[lowerInput];
      if (categoryBySlugMap[lowerInput]) return categoryBySlugMap[lowerInput];

      if (autoCreate) {
        const generatedId = cleanInput.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        let uniqueId = generatedId;
        let suffix = 1;
        while (await CategoryChip.findOne({ id: uniqueId })) {
          uniqueId = `${generatedId}-${suffix}`;
          suffix++;
        }

        const newCat = await CategoryChip.create({
          id: uniqueId,
          categoryName: cleanInput,
          active: true
        });

        categoryMap[lowerInput] = newCat;
        categoryByIdMap[newCat._id.toString()] = newCat;
        categoryBySlugMap[uniqueId] = newCat;
        return newCat;
      }

      return null;
    };

    // Helper to resolve Sub Category
    const resolveSubCategory = async (subInput, parentCategoryDoc) => {
      if (!subInput) return null;
      const cleanInput = subInput.toString().trim();
      const lowerInput = cleanInput.toLowerCase();

      if (mongoose.Types.ObjectId.isValid(cleanInput)) {
        if (subCategoryByIdMap[cleanInput]) return subCategoryByIdMap[cleanInput];
      }

      if (!parentCategoryDoc) return null;
      const parentSlug = parentCategoryDoc.id.trim().toLowerCase();
      const key = `${parentSlug}:${lowerInput}`;

      if (subCategoryMap[key]) return subCategoryMap[key];

      if (autoCreate) {
        const generatedSubId = `${parentCategoryDoc.id}-${cleanInput.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        let uniqueSubId = generatedSubId;
        let suffix = 1;
        while (await SubCategoryChip.findOne({ id: uniqueSubId })) {
          uniqueSubId = `${generatedSubId}-${suffix}`;
          suffix++;
        }

        const newSub = await SubCategoryChip.create({
          id: uniqueSubId,
          categoryId: parentCategoryDoc.id,
          subCategoryName: cleanInput,
          active: true
        });

        subCategoryMap[key] = newSub;
        subCategoryByIdMap[newSub._id.toString()] = newSub;
        return newSub;
      }
      return null;
    };

    const cleanNumber = (val, defaultVal = undefined) => {
      if (val === undefined || val === null || val === '') return defaultVal;
      const cleaned = val.toString().replace(/[^\d.]/g, '');
      const num = Number(cleaned);
      return isNaN(num) ? defaultVal : num;
    };

    const parseBoolValue = (val) => {
      if (val === true) return true;
      if (val === false || val === undefined || val === null || val === '') return false;
      const s = val.toString().trim().toLowerCase();
      return s === 'true' || s === 'yes' || s === '1';
    };

    let successCount = 0;
    let failedCount = 0;
    const errorsList = [];

    // ---- Parse the optional 'Variations' sheet, grouped by Article Number ----
    const variationsByArticle = {};
    const variationArticleDisplay = {}; // key (lowercase) -> Article Number as typed, for readable error messages
    if (workbook.SheetNames.includes('Variations')) {
      const varRows = readSheetRows('Variations');
      if (varRows && varRows.length > 1) {
        const varHeaders = varRows[0].map(h => (h || '').toString().trim());
        const getVarValue = (rowData, colName) => {
          const idx = varHeaders.indexOf(colName);
          return (idx !== -1 && idx < rowData.length) ? rowData[idx] : undefined;
        };

        for (let i = 1; i < varRows.length; i++) {
          const rowData = varRows[i];
          if (rowData.every(val => val === undefined || val === null || val === '')) continue;

          const articleKey = (getVarValue(rowData, 'Article Number') || '').toString().trim();
          const color = (getVarValue(rowData, 'Color') || '').toString().trim();
          const size = (getVarValue(rowData, 'Size') || '').toString().trim();

          if (!articleKey || !color || !size) {
            errorsList.push({ row: `Variations!${i + 1}`, message: 'Article Number, Color, and Size are required for each variant row.' });
            continue;
          }

          const useDefaultPricing = varHeaders.includes('Use Default Pricing')
            ? parseBoolValue(getVarValue(rowData, 'Use Default Pricing'))
            : true;

          const variant = {
            color,
            size,
            stock: cleanNumber(getVarValue(rowData, 'Stock'), 1),
            sku: (getVarValue(rowData, 'Variant SKU') || '').toString().trim() || `${articleKey}-${color}-${size}`.replace(/\s+/g, '-'),
            useDefaultPricing,
            mrp: useDefaultPricing ? undefined : cleanNumber(getVarValue(rowData, 'MRP')),
            sellingPrice: useDefaultPricing ? undefined : cleanNumber(getVarValue(rowData, 'Selling Price')),
            images: []
          };

          const varImageUrls = getVarValue(rowData, 'Image URLs');
          if (varImageUrls) {
            const entries = varImageUrls.toString().split(',').map(u => u.trim()).filter(Boolean);
            for (const entry of entries) {
              const resolved = await resolveImageEntry(entry, zipImageMap, errorsList, `Variations!${i + 1}`);
              if (resolved) variant.images.push(resolved);
            }
          }

          const key = articleKey.toLowerCase();
          if (!variationsByArticle[key]) variationsByArticle[key] = [];
          variationsByArticle[key].push(variant);
          if (!variationArticleDisplay[key]) variationArticleDisplay[key] = articleKey;
        }
      }
    }
    const consumedVariationArticles = new Set();

    // Existing article numbers in the DB, to catch duplicates before Mongo does
    const existingArticles = new Set(
      (await Product.find({}, 'article').lean()).map(p => (p.article || '').trim().toLowerCase()).filter(Boolean)
    );
    const seenArticlesInFile = new Set();

    for (let i = 1; i < rows.length; i++) {
      const rowData = rows[i];
      if (rowData.length === 0 || rowData.every(val => val === undefined || val === null || val === '')) {
        continue;
      }

      const getValue = (colName) => {
        const idx = headers.indexOf(colName);
        return (idx !== -1 && idx < rowData.length) ? rowData[idx] : undefined;
      };

      const name = getValue('Name') || getValue('Product Name');
      const article = (getValue('Article Number') || '').toString().trim();
      const rawCategory = getValue('Category');
      const rawSubCategory = getValue('Sub Category');
      const sellingPrice = getValue('Selling Price') || getValue('Price');
      const cleanSellingPrice = cleanNumber(sellingPrice);
      const cleanMrp = cleanNumber(getValue('MRP'));
      const cleanCostPrice = cleanNumber(getValue('Cost Price (₹)'));
      const weight = cleanNumber(getValue('Weight (kg)'));

      if (!name) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'Product Name is required.' });
        continue;
      }
      if (!article) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'Article Number is required.' });
        continue;
      }

      const articleLower = article.toLowerCase();
      if (variationsByArticle[articleLower]) consumedVariationArticles.add(articleLower);

      if (existingArticles.has(articleLower) || seenArticlesInFile.has(articleLower)) {
        failedCount++;
        errorsList.push({ row: i + 1, message: `Article Number "${article}" already exists.` });
        continue;
      }
      if (!rawCategory) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'Category is required.' });
        continue;
      }
      if (cleanMrp === undefined || cleanMrp <= 0) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'A valid MRP greater than zero is required.' });
        continue;
      }
      if (cleanSellingPrice === undefined || cleanSellingPrice <= 0) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'A valid Selling Price greater than zero is required.' });
        continue;
      }
      if (cleanMrp < cleanSellingPrice) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'MRP cannot be less than Selling Price.' });
        continue;
      }
      if (weight === undefined || weight <= 0) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'A valid Weight (kg) greater than zero is required.' });
        continue;
      }

      const gstPercentageRaw = getValue('GST Percentage');
      let gstPercentage = 0;
      if (gstPercentageRaw !== undefined && gstPercentageRaw !== '') {
        const parsedGst = cleanNumber(gstPercentageRaw, 0);
        if (!GST_PERCENTAGE_OPTIONS.includes(parsedGst)) {
          failedCount++;
          errorsList.push({ row: i + 1, message: `GST Percentage must be one of: ${GST_PERCENTAGE_OPTIONS.join(', ')}.` });
          continue;
        }
        gstPercentage = parsedGst;
      }

      // Resolve Category
      const categoryDoc = await resolveCategory(rawCategory);
      if (!categoryDoc) {
        failedCount++;
        errorsList.push({ row: i + 1, message: `Category "${rawCategory}" not found.` });
        continue;
      }

      // Resolve Subcategory
      let subCategoryDoc = null;
      if (rawSubCategory) {
        subCategoryDoc = await resolveSubCategory(rawSubCategory, categoryDoc);
        if (!subCategoryDoc) {
          failedCount++;
          errorsList.push({ row: i + 1, message: `Sub Category "${rawSubCategory}" not found under Category "${categoryDoc.categoryName}".` });
          continue;
        }
      }

      const discountLabelRaw = getValue('Discount Label (%)') || getValue('Discount Label');
      let discountLabel = '';
      if (discountLabelRaw !== undefined && discountLabelRaw !== '') {
        const parsedDiscount = parseFloat(discountLabelRaw);
        discountLabel = !isNaN(parsedDiscount) ? `-${Math.round(parsedDiscount)}% OFF` : String(discountLabelRaw).trim();
      }

      const productData = {
        name,
        article,
        category: categoryDoc._id.toString(),
        subCategory: subCategoryDoc ? subCategoryDoc._id.toString() : undefined,
        description: getValue('Description') || '',
        sellingPrice: cleanSellingPrice,
        mrp: cleanMrp,
        costPrice: cleanCostPrice,
        stock: cleanNumber(getValue('Stock'), 1),
        discountLabel,
        sku: (getValue('SKU') || '').toString().trim() || `SKU-${Date.now()}-${i}-${Math.random().toString().slice(2, 6)}`,
        highlights: {
          idealFor: getValue('Ideal For') || '',
          outerMaterial: getValue('Outer Material') || '',
          soleMaterial: getValue('Sole Material') || '',
          occasion: getValue('Occasion') || '',
          color: getValue('Color') || '',
          pattern: getValue('Pattern') || '',
          fastening: getValue('Fastening') || ''
        },
        technicalSpecs: {
          type: getValue('Type') || '',
          toeShape: getValue('Toe Shape') || '',
          careInstructions: getValue('Care Instructions') || '',
          fit: getValue('Fit') || '',
          warranty: getValue('Warranty') || ''
        },
        shippingSpecs: {
          weight,
          length: cleanNumber(getValue('Length (cm)')),
          width: cleanNumber(getValue('Width (cm)')),
          height: cleanNumber(getValue('Height (cm)'))
        },
        flags: {
          topSection: parseBoolValue(getValue('Featured Collection')),
          crazyDeals: parseBoolValue(getValue('Crazy Deals')),
          flashSale: parseBoolValue(getValue('New Arrivals'))
        },
        brandName: getValue('Brand Name') || 'Generic',
        tags: getValue('Tags') ? getValue('Tags').toString().split(',').map(t => t.trim()).filter(Boolean) : [],
        manufacturerInfo: getValue('Manufacturer Info') || '',
        hsnCode: getValue('HSN Code') || '',
        gstPercentage,
        isTrending: parseBoolValue(getValue('Is Trending')),
        status: 'Approved'
      };

      const specificationsRaw = getValue('Specifications (JSON)');
      if (specificationsRaw) {
        try {
          const parsedSpecs = JSON.parse(specificationsRaw);
          if (Array.isArray(parsedSpecs)) productData.specifications = parsedSpecs;
        } catch (e) {
          // Malformed JSON in the optional advanced column — ignore and keep default specifications
        }
      }

      const imageURLsStr = getValue('Image URLs');
      if (imageURLsStr) {
        const entries = imageURLsStr.toString().split(',').map(url => url.trim()).filter(Boolean);
        const processedUrls = [];
        for (const entry of entries) {
          const resolved = await resolveImageEntry(entry, zipImageMap, errorsList, i + 1);
          if (resolved) processedUrls.push(resolved);
        }
        productData.images = processedUrls;
      }

      const descImageURLsStr = getValue('Description Image URLs');
      if (descImageURLsStr) {
        const entries = descImageURLsStr.toString().split(',').map(url => url.trim()).filter(Boolean).slice(0, 5);
        const processedUrls = [];
        for (const entry of entries) {
          const resolved = await resolveImageEntry(entry, zipImageMap, errorsList, i + 1);
          if (resolved) processedUrls.push(resolved);
        }
        productData.descriptionImages = processedUrls;
      }

      const variants = variationsByArticle[articleLower];
      if (variants && variants.length > 0) {
        productData.variations = variants;
      }

      seenArticlesInFile.add(articleLower);

      try {
        const newProduct = new Product(productData);
        await newProduct.save();
        existingArticles.add(articleLower);
        successCount++;
      } catch (err) {
        if (err.code === 11000) {
          // Retry SKU uniqueness once
          productData.sku = `SKU-${Date.now()}-${i}-${Math.random().toString().slice(2, 6)}`;
          try {
            const retryProduct = new Product(productData);
            await retryProduct.save();
            existingArticles.add(articleLower);
            successCount++;
          } catch (retryErr) {
            console.error(`Bulk Upload row ${i + 1} save failed after SKU retry:`, retryErr);
            failedCount++;
            errorsList.push({ row: i + 1, message: 'Could not save this product because its SKU or Article Number conflicts with an existing product. Please use a different SKU and try again.' });
          }
        } else {
          console.error(`Bulk Upload row ${i + 1} save failed:`, err);
          failedCount++;
          errorsList.push({ row: i + 1, message: `Could not save this product: ${err.message.includes('validation failed') ? 'one or more fields have an invalid value. Please double-check this row.' : 'an unexpected error occurred. Please check this row and try again.'}` });
        }
      }
    }

    // Flag any Variations rows whose Article Number never matched a product row
    Object.keys(variationsByArticle).forEach(key => {
      if (!consumedVariationArticles.has(key)) {
        const displayArticle = variationArticleDisplay[key] || key;
        errorsList.push({
          row: 'Variations',
          message: `Variants for Article Number "${displayArticle}" were not added: no matching row was found on the Products sheet. Check that the Article Number is typed exactly the same (no extra spaces or typos) on both the Products and Variations sheets, then re-upload.`
        });
      }
    });

    res.status(200).json({
      success: true,
      message: `Processed ${successCount + failedCount} rows.`,
      report: {
        success: successCount,
        failed: failedCount,
        errors: errorsList
      }
    });
  } catch (error) {
    console.error('Bulk Upload Error:', error);
    res.status(500).json({ success: false, message: 'Server error during bulk upload', error: error.message });
  }
};

const downloadTemplate = async (req, res) => {
  try {
    const CategoryChip = require('../Models/CategoryChip');
    const SubCategoryChip = require('../Models/SubCategoryChip');

    const categories = await CategoryChip.find({ active: { $ne: false } }).sort({ categoryName: 1 });
    const subcategories = await SubCategoryChip.find({ active: { $ne: false } }).sort({ subCategoryName: 1 });

    const workbook = new ExcelJS.Workbook();
    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    const HEADER_FONT = { name: 'Arial', family: 4, size: 10, bold: true, color: { argb: 'FFFFFF' } };
    const BOOL_LIST = '"TRUE,FALSE"';

    // 1. Products Sheet — mirrors the fields on the Add Product page
    const sheet = workbook.addWorksheet('Products');

    const headers = [
      'Name', 'Article Number', 'Category', 'Sub Category', 'Description',
      'MRP', 'Cost Price (₹)', 'Selling Price', 'Discount Label (%)', 'Stock', 'SKU',
      'Ideal For', 'Outer Material', 'Sole Material', 'Occasion', 'Color', 'Pattern', 'Fastening',
      'Type', 'Toe Shape', 'Care Instructions', 'Fit', 'Warranty',
      'Weight (kg)', 'Length (cm)', 'Width (cm)', 'Height (cm)',
      'Featured Collection', 'Crazy Deals', 'New Arrivals', 'Is Trending',
      'HSN Code', 'GST Percentage', 'Brand Name', 'Tags', 'Manufacturer Info',
      'Image URLs', 'Description Image URLs', 'Specifications (JSON)'
    ];

    const headerRow = sheet.getRow(1);
    headerRow.values = headers;
    headerRow.font = HEADER_FONT;
    headerRow.fill = HEADER_FILL;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const wideCols = ['Description', 'Image URLs', 'Description Image URLs', 'Specifications (JSON)'];
    sheet.columns = headers.map(h => ({
      header: h,
      width: wideCols.includes(h) ? 34 : 16
    }));

    const sampleRow = [
      'Men\'s Formal Oxford Shoes', 'FSH-OXF-001', 'Formal Shoes', 'Oxford', 'Premium leather Oxford shoes crafted for a sharp, formal look.',
      4999, 1800, 2999, 40, 100, '',
      'Men', 'Leather', 'Rubber', 'Formal', 'Brown', 'Solid', 'Lace-Up',
      'Oxford', 'Round Toe', 'Wipe with a damp cloth', 'Regular', '6 Months',
      0.8, 30, 20, 10,
      'FALSE', 'TRUE', 'FALSE', 'TRUE',
      '6403', 5, 'Generic', 'shoes, leather, formal', 'FootCraft Mfg.',
      'https://example.com/img1.jpg, https://example.com/img2.jpg', '', ''
    ];
    sheet.addRow(sampleRow);
    sheet.getRow(2).font = { italic: true, color: { argb: '94A3B8' } };

    // 2. Variations Sheet — optional, one row per color/size combination
    const varSheet = workbook.addWorksheet('Variations');
    const varHeaders = ['Article Number', 'Color', 'Size', 'Stock', 'Variant SKU', 'Use Default Pricing', 'MRP', 'Selling Price', 'Image URLs'];
    const varHeaderRow = varSheet.getRow(1);
    varHeaderRow.values = varHeaders;
    varHeaderRow.font = HEADER_FONT;
    varHeaderRow.fill = HEADER_FILL;
    varHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    varSheet.views = [{ state: 'frozen', ySplit: 1 }];
    varSheet.columns = varHeaders.map(h => ({ header: h, width: h === 'Image URLs' ? 34 : 18 }));

    const varSampleRows = [
      ['FSH-OXF-001', 'Brown', '8', 10, '', 'TRUE', '', '', ''],
      ['FSH-OXF-001', 'Brown', '9', 10, '', 'TRUE', '', '', ''],
      ['FSH-OXF-001', 'Black', '8', 10, '', 'TRUE', '', '', '']
    ];
    varSampleRows.forEach(r => varSheet.addRow(r));
    [2, 3, 4].forEach(r => { varSheet.getRow(r).font = { italic: true, color: { argb: '94A3B8' } }; });

    // 3. Instructions Sheet
    const infoSheet = workbook.addWorksheet('Instructions');
    infoSheet.columns = [{ width: 26 }, { width: 90 }];
    const infoRows = [
      ['Sheet', 'Purpose'],
      ['Products', 'One row per product. Article Number must be unique — it links a product to its rows on the Variations sheet.'],
      ['Variations', "Optional. Add one row per color/size combination. Leave 'Use Default Pricing' as TRUE to inherit the product's MRP/Selling Price, or FALSE plus your own MRP/Selling Price to override it for that variant."],
      ['', ''],
      ['Required columns', 'Name, Article Number, Category, MRP, Selling Price, Weight (kg)'],
      ['Cost Price (₹)', 'Optional. What the item costs you to source — used only to show your profit margin in the admin panel. Never shown to customers.'],
      ['Category / Sub Category', "Pick a value from the dropdown (see the 'Lists' sheet) or check 'Auto-Create Missing' in the admin panel to create new ones automatically on upload."],
      ['GST Percentage', `Must be one of: ${GST_PERCENTAGE_OPTIONS.join(', ')}.`],
      ['TRUE/FALSE columns', 'Featured Collection, Crazy Deals, New Arrivals, Is Trending, Use Default Pricing — pick TRUE or FALSE from the dropdown.'],
      ['Image URLs', "Comma-separate multiple entries, e.g. https://.../a.jpg, https://.../b.jpg. Description Image URLs supports up to 5."],
      ['Local image files', "Instead of a URL, you can put a bare filename here (e.g. satchel-1.jpg) if you also attach a ZIP of your images when uploading (use the 'Attach Images (ZIP)' button next to Upload Excel). Filenames are matched inside the ZIP regardless of folder — just make sure each name is unique across the ZIP. URLs and local filenames can be mixed in the same cell."],
      ['Specifications (JSON)', 'Advanced/optional. Paste an array like [{"section":"Style","fields":[{"name":"Color","value":"Brown"}]}]. Leave blank to skip.'],
      ['SKU / Variant SKU', 'Leave blank to auto-generate.']
    ];
    infoRows.forEach((r, idx) => {
      const row = infoSheet.addRow(r);
      if (idx === 0) row.font = { bold: true };
    });

    // 4. Lists Sheet — backs the dropdowns above
    const listsSheet = workbook.addWorksheet('Lists');
    listsSheet.getCell('A1').value = 'Categories';
    listsSheet.getCell('B1').value = 'Sub Categories';
    listsSheet.getCell('C1').value = 'GST Percentage';
    listsSheet.getRow(1).font = { bold: true };

    categories.forEach((cat, idx) => {
      listsSheet.getCell(`A${idx + 2}`).value = cat.categoryName;
    });
    subcategories.forEach((sub, idx) => {
      listsSheet.getCell(`B${idx + 2}`).value = sub.subCategoryName;
    });
    GST_PERCENTAGE_OPTIONS.forEach((pct, idx) => {
      listsSheet.getCell(`C${idx + 2}`).value = pct;
    });

    const categoryFormula = `Lists!$A$2:$A$${Math.max(2, categories.length + 1)}`;
    const subCategoryFormula = `Lists!$B$2:$B$${Math.max(2, subcategories.length + 1)}`;
    const gstFormula = `Lists!$C$2:$C$${GST_PERCENTAGE_OPTIONS.length + 1}`;

    const categoryColIndex = headers.indexOf('Category') + 1;
    const subCategoryColIndex = headers.indexOf('Sub Category') + 1;
    const gstColIndex = headers.indexOf('GST Percentage') + 1;
    const boolColIndexes = ['Featured Collection', 'Crazy Deals', 'New Arrivals', 'Is Trending'].map(h => headers.indexOf(h) + 1);

    for (let r = 2; r <= 1000; r++) {
      const row = sheet.getRow(r);
      row.getCell(categoryColIndex).dataValidation = {
        type: 'list', allowBlank: true, formulae: [categoryFormula],
        showErrorMessage: true, errorTitle: 'Invalid Category', error: 'Please select a Category from the dropdown.'
      };
      row.getCell(subCategoryColIndex).dataValidation = {
        type: 'list', allowBlank: true, formulae: [subCategoryFormula],
        showErrorMessage: true, errorTitle: 'Invalid Sub Category', error: 'Please select a Sub Category from the dropdown.'
      };
      row.getCell(gstColIndex).dataValidation = {
        type: 'list', allowBlank: true, formulae: [gstFormula],
        showErrorMessage: true, errorTitle: 'Invalid GST Percentage', error: `GST Percentage must be one of: ${GST_PERCENTAGE_OPTIONS.join(', ')}.`
      };
      boolColIndexes.forEach(colIdx => {
        row.getCell(colIdx).dataValidation = {
          type: 'list', allowBlank: true, formulae: [BOOL_LIST],
          showErrorMessage: true, errorTitle: 'Invalid Value', error: 'Please select TRUE or FALSE.'
        };
      });
    }

    const useDefaultPricingColIndex = varHeaders.indexOf('Use Default Pricing') + 1;
    for (let r = 2; r <= 1000; r++) {
      varSheet.getRow(r).getCell(useDefaultPricingColIndex).dataValidation = {
        type: 'list', allowBlank: true, formulae: [BOOL_LIST],
        showErrorMessage: true, errorTitle: 'Invalid Value', error: 'Please select TRUE or FALSE.'
      };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=product_upload_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Download Template Error:', error);
    res.status(500).json({ success: false, message: 'Server error generating template', error: error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  getTopBuys,
  getTrendingBrands,
  getCombinedCatalog,
  bulkUploadProducts,
  getHomepageData,
  downloadTemplate
};
