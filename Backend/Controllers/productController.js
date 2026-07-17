const Product = require('../Models/Product');
const Brand = require('../Models/Brand');
const { getImageUrl } = require('../utils/imageHelper');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
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
    if (full !== 'true') {
      query = query.select('-highlights -technicalSpecs -description -variations -shippingSpecs');
    }
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
      gstCategory,
      hsnCode,
      brandName,
      brandId,
      isTrending,
      manufacturerInfo,
      status,
      subCategory
    } = req.body;

    if (!name || !category || !sellingPrice) {
      return res.status(400).json({ success: false, message: 'Name, Category, and Selling Price are required' });
    }

    if (mrp && Number(mrp) < Number(sellingPrice)) {
      return res.status(400).json({ success: false, message: 'Actual Price (MRP) cannot be less than Selling Price' });
    }

    if (stock !== undefined && Number(stock) < 0) {
      return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
    }

    let imageUrls = [];
    if (req.processedFiles && req.processedFiles.length > 0) {
      imageUrls = req.processedFiles.map(f => getImageUrl(f.url));
    }

    // Check if additional image URLs were sent in body
    const bodyImages = parseJsonField(req.body.images, []);
    if (Array.isArray(bodyImages)) {
      imageUrls = [...imageUrls, ...bodyImages];
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
      stock: stock ? Number(stock) : 1,
      discountLabel,
      sku: sku || `SKU-${Date.now()}`,
      highlights: parseJsonField(req.body.highlights),
      technicalSpecs: parseJsonField(req.body.technicalSpecs),
      shippingSpecs: parseJsonField(req.body.shippingSpecs),
      flags: parseJsonField(req.body.flags, { topSection: false, crazyDeals: false, flashSale: false }),
      gstCategory,
      hsnCode,
      images: imageUrls,
      brandId: brandId || undefined,
      brandName: resolvedBrandName,
      isTrending: isTrending === 'true' || isTrending === true,
      tags: parseJsonField(req.body.tags, []),
      manufacturerInfo,
      status: status || 'Pending',
      variations: parseJsonField(req.body.variations, [])
    });

    await newProduct.save();
    res.status(201).json({ success: true, message: 'Product created successfully', product: newProduct });
  } catch (error) {
    console.error('Create Product Error:', error);
    if (error.code === 11000) {
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
      'mrp', 'stock', 'discountLabel', 'sku', 'gstCategory', 'hsnCode',
      'manufacturerInfo', 'status'
    ];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (['sellingPrice', 'mrp', 'stock'].includes(f)) {
          product[f] = Number(req.body[f]);
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
    if (req.body.shippingSpecs !== undefined) product.shippingSpecs = parseJsonField(req.body.shippingSpecs);
    if (req.body.flags !== undefined) product.flags = parseJsonField(req.body.flags);
    if (req.body.tags !== undefined) product.tags = parseJsonField(req.body.tags);
    if (req.body.variations !== undefined) product.variations = parseJsonField(req.body.variations, []);

    // Process Images
    let updatedImages = product.images || [];
    if (req.body.images !== undefined) {
      updatedImages = parseJsonField(req.body.images);
    }

    if (req.processedFiles && req.processedFiles.length > 0) {
      const newUrls = req.processedFiles.map(f => getImageUrl(f.url));
      updatedImages = [...updatedImages, ...newUrls];
    }

    product.images = updatedImages;

    await product.save();
    res.status(200).json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    console.error('Update Product Error:', error);
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
    const product = await Product.findById(req.params.id).populate('brandId').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const CategoryChip = require('../Models/CategoryChip');
    const SubCategoryChip = require('../Models/SubCategoryChip');

    let categoryLabel = product.category;
    if (product.category) {
      const isObjectId = mongoose.isValidObjectId(product.category);
      const cat = await CategoryChip.findOne({
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
      brandName: product.brandId ? product.brandId.name : (product.brandName || 'Generic')
    };

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
    .select('name brandName mrp sellingPrice discountLabel images rating sales category subCategory description flags stock')
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
    .select('name brandName mrp sellingPrice discountLabel images rating sales category subCategory description flags stock')
    .sort({ sales: -1 })
    .limit(remainingCount)
    .lean();
    
    products = [...products, ...fallbackProducts];
  }

  return products;
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
        .select('-highlights -technicalSpecs -description -variations -shippingSpecs')
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

    res.status(200).json({
      success: true,
      chips,
      subchips,
      banners,
      products,
      topBuys,
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
    if (search && search.trim() !== '') {
      const escapedSearch = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      andConditions.push({
        $or: [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } }
        ]
      });
    }

    const finalQuery = { $and: andConditions };

    // 4. Sorting option
    let sortOption = { createdAt: -1 };
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

    const productsPromise = Product.find(finalQuery)
      .select('-highlights -technicalSpecs -description -variations -shippingSpecs')
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

    res.status(200).json({
      success: true,
      chips: parsedPage === 1 ? chips : undefined,
      subchips: parsedPage === 1 ? subchips : undefined,
      products,
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

const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Read the sheet using XLSX
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Failed to parse file. Make sure it is a valid Excel or CSV file.' });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Convert sheet to a 2D array of rows
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      .filter(row => row.length > 0 && row.some(val => val !== undefined && val !== null && val.toString().trim() !== ''));

    if (rows.length < 2) {
      return res.status(400).json({ success: false, message: 'Excel/CSV file must contain headers and at least one product row.' });
    }

    const headers = rows[0].map(h => (h || '').toString().trim());
    const requiredFields = ['Name', 'Category', 'Selling Price'];
    
    // Support aliases like 'Product Name' and 'Price'
    const hasNameCol = headers.includes('Name') || headers.includes('Product Name');
    const hasCategoryCol = headers.includes('Category');
    const hasPriceCol = headers.includes('Selling Price') || headers.includes('Price');

    if (!hasNameCol || !hasCategoryCol || !hasPriceCol) {
      const missing = [];
      if (!hasNameCol) missing.push('Name/Product Name');
      if (!hasCategoryCol) missing.push('Category');
      if (!hasPriceCol) missing.push('Selling Price/Price');
      return res.status(400).json({ success: false, message: `Missing required columns: ${missing.join(', ')}` });
    }

    const CategoryChip = require('../Models/CategoryChip');
    const SubCategoryChip = require('../Models/SubCategoryChip');
    const Brand = require('../Models/Brand');
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

    let successCount = 0;
    let failedCount = 0;
    const errorsList = [];

    const cleanNumber = (val, defaultVal = undefined) => {
      if (val === undefined || val === null || val === '') return defaultVal;
      const cleaned = val.toString().replace(/[^\d.]/g, '');
      const num = Number(cleaned);
      return isNaN(num) ? defaultVal : num;
    };

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
      const rawCategory = getValue('Category');
      const rawSubCategory = getValue('Sub Category');
      const sellingPrice = getValue('Selling Price') || getValue('Price');
      const cleanSellingPrice = cleanNumber(sellingPrice);

      if (!name) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'Product Name is required.' });
        continue;
      }
      if (!rawCategory) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'Category is required.' });
        continue;
      }
      if (cleanSellingPrice === undefined) {
        failedCount++;
        errorsList.push({ row: i + 1, message: 'Valid Price/Selling Price is required.' });
        continue;
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

      const productData = {
        name,
        category: categoryDoc._id.toString(),
        subCategory: subCategoryDoc ? subCategoryDoc._id.toString() : undefined,
        description: getValue('Description') || '',
        sellingPrice: cleanSellingPrice,
        mrp: cleanNumber(getValue('MRP')),
        stock: cleanNumber(getValue('Stock'), 1),
        discountLabel: (() => {
          let rawDiscount = getValue('Discount Label') || '';
          if (rawDiscount) {
            const parsed = parseFloat(rawDiscount);
            if (!isNaN(parsed) && parsed > 0 && parsed < 1) {
              return `${Math.round(parsed * 100)}%`;
            }
            return String(rawDiscount).trim();
          }
          return '';
        })(),
        sku: getValue('SKU') || `SKU-${Date.now()}-${i}-${Math.random().toString().slice(2, 6)}`,
        highlights: {
          packOf: getValue('Pack Of') || '',
          fabric: getValue('Fabric') || '',
          material: getValue('Material') || '',
          sleeve: getValue('Sleeve') || '',
          pattern: getValue('Pattern') || '',
          collar: getValue('Collar') || '',
          color: getValue('Color') || ''
        },
        technicalSpecs: {
          fit: getValue('Fit') || '',
          fabricCare: getValue('Fabric Care') || '',
          suitableFor: getValue('Suitable For') || '',
          hem: getValue('Hem') || ''
        },
        shippingSpecs: {
          weight: cleanNumber(getValue('Weight (kg)'), 0),
          length: cleanNumber(getValue('Length (cm)')),
          width: cleanNumber(getValue('Width (cm)')),
          height: cleanNumber(getValue('Height (cm)'))
        },
        flags: {
          topSection: getValue('Top Section') === 'true' || getValue('Top Section') === true,
          crazyDeals: getValue('Crazy Deals') === 'true' || getValue('Crazy Deals') === true,
          flashSale: getValue('Flash Sale') === 'true' || getValue('Flash Sale') === true
        },
        brandName: 'Generic',
        brandId: undefined,
        tags: getValue('Tags') ? getValue('Tags').split(',').map(t => t.trim()).filter(Boolean) : [],
        manufacturerInfo: getValue('Manufacturer Info') || '',
        hsnCode: getValue('HSN Code') || '',
        gstCategory: getValue('GST Category') || '',
        isTrending: getValue('Is Trending') === 'true' || getValue('Is Trending') === true,
        status: 'Approved'
      };

      const imageURLsStr = getValue('Image URLs');
      if (imageURLsStr) {
        const urls = imageURLsStr.toString().split(',').map(url => url.trim()).filter(Boolean);
        const processedUrls = [];
        for (const url of urls) {
          const processed = await processImageUrl(url);
          processedUrls.push(processed);
        }
        productData.images = processedUrls;
      }

      try {
        const newProduct = new Product(productData);
        await newProduct.save();
        successCount++;
      } catch (err) {
        if (err.code === 11000) {
          // Retry SKU uniqueness once
          productData.sku = `SKU-${Date.now()}-${i}-${Math.random().toString().slice(2, 6)}`;
          try {
            const retryProduct = new Product(productData);
            await retryProduct.save();
            successCount++;
          } catch (retryErr) {
            failedCount++;
            errorsList.push({ row: i + 1, message: `Database error (SKU retry failed): ${retryErr.message}` });
          }
        } else {
          failedCount++;
          errorsList.push({ row: i + 1, message: `Database error: ${err.message}` });
        }
      }
    }

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
    
    // 1. Products Sheet
    const sheet = workbook.addWorksheet('Products');
    
    const headers = [
      'Name', 'Category', 'Sub Category', 'Description', 'Selling Price', 'MRP', 'Stock', 'Discount Label', 'SKU',
      'Pack Of', 'Fabric', 'Material', 'Sleeve', 'Pattern', 'Collar', 'Color',
      'Fit', 'Fabric Care', 'Suitable For', 'Hem',
      'Weight (kg)', 'Length (cm)', 'Width (cm)', 'Height (cm)',
      'Top Section', 'Crazy Deals', 'Flash Sale',
      'Tags', 'Manufacturer Info', 'HSN Code', 'GST Category', 'Is Trending', 'Image URLs'
    ];

    const headerRow = sheet.getRow(1);
    headerRow.values = headers;
    headerRow.font = { name: 'Arial', family: 4, size: 10, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' } // Professional Dark Blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    sheet.columns = headers.map(h => ({
      header: h,
      width: h === 'Description' || h === 'Image URLs' ? 30 : 15
    }));

    const sampleRow = [
      'Premium Leather Satchel', 'Fashion', 'Accessories', 'A high-quality leather satchel for everyday use.', 2999, 4999, 100, '-40% OFF', 'FSH-SAT-001',
      '1', 'Leather', 'Pure Leather', '', 'Solid', '', 'Brown',
      'Regular', 'Wipe with damp cloth', 'Casual', '',
      0.8, 30, 20, 10,
      'false', 'true', 'false',
      'bags, leather, premium', 'LeatherCraft Mfg.', '4202', 'Standard GST', 'true', 'https://example.com/img1.jpg, https://example.com/img2.jpg'
    ];
    sheet.addRow(sampleRow);

    // 2. Lists Sheet
    const listsSheet = workbook.addWorksheet('Lists');
    listsSheet.getCell('A1').value = 'Categories';
    listsSheet.getCell('B1').value = 'Sub Categories';
    listsSheet.getRow(1).font = { bold: true };

    categories.forEach((cat, idx) => {
      listsSheet.getCell(`A${idx + 2}`).value = cat.categoryName;
    });
    subcategories.forEach((sub, idx) => {
      listsSheet.getCell(`B${idx + 2}`).value = sub.subCategoryName;
    });

    const categoryFormula = `Lists!$A$2:$A$${Math.max(2, categories.length + 1)}`;
    const subCategoryFormula = `Lists!$B$2:$B$${Math.max(2, subcategories.length + 1)}`;

    const categoryColIndex = headers.indexOf('Category') + 1;
    const subCategoryColIndex = headers.indexOf('Sub Category') + 1;

    for (let r = 2; r <= 1000; r++) {
      sheet.getRow(r).getCell(categoryColIndex).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [categoryFormula],
        showErrorMessage: true,
        errorTitle: 'Invalid Category',
        error: 'Please select a Category from the dropdown.'
      };

      sheet.getRow(r).getCell(subCategoryColIndex).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [subCategoryFormula],
        showErrorMessage: true,
        errorTitle: 'Invalid Sub Category',
        error: 'Please select a Sub Category from the dropdown.'
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
