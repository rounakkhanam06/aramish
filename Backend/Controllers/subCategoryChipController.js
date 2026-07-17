const SubCategoryChip = require('../Models/SubCategoryChip');
const { getImageUrl } = require('../utils/imageHelper');

// @desc    Get all Sub Category Chips
// @route   GET /api/admin/catalog/subchips
// @access  Public
const getSubCategoryChips = async (req, res) => {
  try {
    const subchips = await SubCategoryChip.find({}).sort({ order: 1 });
    res.status(200).json({ success: true, subchips });
  } catch (error) {
    console.error('Get Sub Category Chips Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create a Sub Category Chip
// @route   POST /api/admin/catalog/subchips
// @access  Private (Admin)
const createSubCategoryChip = async (req, res) => {
  try {
    const { categoryId, subCategoryName, active, order } = req.body;
    if (!categoryId || !subCategoryName) {
      return res.status(400).json({ success: false, message: 'Category ID and Subcategory Name are required' });
    }

    const id = `${categoryId}-${subCategoryName.toLowerCase().replace(/\s+/g, '-')}`;
    const existing = await SubCategoryChip.findOne({ id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Subcategory chip already exists' });
    }

    let image = null;
    if (req.file) {
      image = getImageUrl(req.file.url);
    }

    const newSubChip = new SubCategoryChip({
      id,
      categoryId,
      subCategoryName,
      image,
      active: (active === false || active === 'false') ? false : true,
      order: order ? Number(order) : 1
    });

    await newSubChip.save();
    res.status(201).json({ success: true, message: 'Subcategory chip created successfully', chip: newSubChip });
  } catch (error) {
    console.error('Create Sub Category Chip Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update a Sub Category Chip
// @route   PUT /api/admin/catalog/subchips/:id
// @access  Private (Admin)
const updateSubCategoryChip = async (req, res) => {
  try {
    const { categoryId, subCategoryName, active, order } = req.body;
    const chip = await SubCategoryChip.findOne({ id: req.params.id });

    if (!chip) {
      return res.status(404).json({ success: false, message: 'Subcategory chip not found' });
    }

    if (categoryId !== undefined) chip.categoryId = categoryId;
    if (subCategoryName !== undefined) {
      chip.subCategoryName = subCategoryName;
      chip.id = `${chip.categoryId}-${subCategoryName.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (active !== undefined) chip.active = (active === false || active === 'false') ? false : true;
    if (order !== undefined) chip.order = Number(order);

    if (req.file) {
      chip.image = getImageUrl(req.file.url);
    }

    await chip.save();
    res.status(200).json({ success: true, message: 'Subcategory chip updated successfully', chip });
  } catch (error) {
    console.error('Update Sub Category Chip Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Delete a Sub Category Chip
// @route   DELETE /api/admin/catalog/subchips/:id
// @access  Private (Admin)
const deleteSubCategoryChip = async (req, res) => {
  try {
    const result = await SubCategoryChip.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Subcategory chip not found' });
    }
    res.status(200).json({ success: true, message: 'Subcategory chip deleted successfully' });
  } catch (error) {
    console.error('Delete Sub Category Chip Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSubCategoryChips,
  createSubCategoryChip,
  updateSubCategoryChip,
  deleteSubCategoryChip
};
