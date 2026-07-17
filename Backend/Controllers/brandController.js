const Brand = require('../Models/Brand');
const Product = require('../Models/Product');

// @desc    Get all active brands (Public)
// @route   GET /catalog/brands
// @access  Public
const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ status: 'Active' }).sort({ name: 1 });
    res.status(200).json({ success: true, brands });
  } catch (error) {
    console.error('Get Brands Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all brands (Admin)
// @route   GET /admin/catalog/brands/all
// @access  Private (Admin)
const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find({}).sort({ name: 1 });
    res.status(200).json({ success: true, brands });
  } catch (error) {
    console.error('Get All Brands Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Brand by ID
// @route   GET /catalog/brands/:id
// @access  Public
const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }
    res.status(200).json({ success: true, brand });
  } catch (error) {
    console.error('Get Brand By ID Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create a Brand
// @route   POST /admin/catalog/brands
// @access  Private (Admin)
const createBrand = async (req, res) => {
  try {
    const { name, description, isTrending, status } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }

    const existing = await Brand.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Brand already exists with this name' });
    }

    if (!req.logoUrl) {
      return res.status(400).json({ success: false, message: 'Brand logo image is required' });
    }

    const newBrand = new Brand({
      name: name.trim(),
      description,
      logo: req.logoUrl,
      isTrending: isTrending === 'true' || isTrending === true,
      status: status || 'Active'
    });

    await newBrand.save();
    res.status(201).json({ success: true, message: 'Brand created successfully', brand: newBrand });
  } catch (error) {
    console.error('Create Brand Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update a Brand
// @route   PUT /admin/catalog/brands/:id
// @access  Private (Admin)
const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const { name, description, isTrending, status } = req.body;

    if (name) {
      const existing = await Brand.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: brand._id }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Another brand already exists with this name' });
      }
      brand.name = name.trim();
    }

    if (description !== undefined) brand.description = description;
    if (isTrending !== undefined) brand.isTrending = isTrending === 'true' || isTrending === true;
    if (status !== undefined) brand.status = status;

    if (req.logoUrl) {
      brand.logo = req.logoUrl;
    }

    await brand.save();

    // Sync brandName inside products when brand name changes
    if (name) {
      await Product.updateMany({ brandId: brand._id }, { brandName: brand.name });
    }

    res.status(200).json({ success: true, message: 'Brand updated successfully', brand });
  } catch (error) {
    console.error('Update Brand Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Delete a Brand
// @route   DELETE /admin/catalog/brands/:id
// @access  Private (Admin)
const deleteBrand = async (req, res) => {
  try {
    const brandId = req.params.id;
    
    // Check if brand is referenced by any products
    const productCount = await Product.countDocuments({ brandId });
    if (productCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete brand. It is linked to ${productCount} products. Set status to Inactive instead.` 
      });
    }

    const result = await Brand.findByIdAndDelete(brandId);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    res.status(200).json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Delete Brand Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get Brand Details and Products (Popular vs All)
// @route   GET /catalog/brands/:brandId/products
// @access  Public
const getBrandDetailsAndProducts = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.brandId);
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const products = await Product.find({ brandId: brand._id, status: 'Approved' })
      .select('name brandName mrp sellingPrice discountLabel images rating sales category subCategory description flags stock isTrending')
      .sort({ createdAt: -1 })
      .lean();

    const popularProducts = products.filter(p => p.isTrending);

    res.status(200).json({
      success: true,
      brand,
      popularProducts,
      allProducts: products
    });
  } catch (error) {
    console.error('Get Brand Details and Products Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getBrands,
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  getBrandDetailsAndProducts
};
