const CategoryChip = require('../Models/CategoryChip');
const { getImageUrl } = require('../utils/imageHelper');

// @desc    Get all Category Chips
// @route   GET /api/admin/catalog/chips
// @access  Public
const getCategoryChips = async (req, res) => {
  try {
    const chips = await CategoryChip.find({}).sort({ order: 1 });
    res.status(200).json({ success: true, chips });
  } catch (error) {
    console.error('Get Category Chips Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create a Category Chip
// @route   POST /api/admin/catalog/chips
// @access  Private (Admin)
const createCategoryChip = async (req, res) => {
  try {
    const { categoryName, active, order } = req.body;
    if (!categoryName) {
      return res.status(400).json({ success: false, message: 'Category Name is required' });
    }

    const id = categoryName.toLowerCase().replace(/\s+/g, '-');
    const existing = await CategoryChip.findOne({ id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category chip already exists' });
    }

    let image = null;
    if (req.file) {
      image = getImageUrl(req.file.url);
    }

    const newChip = new CategoryChip({
      id,
      categoryName,
      image,
      active: (active === false || active === 'false') ? false : true,
      order: order ? Number(order) : 1
    });

    await newChip.save();
    res.status(201).json({ success: true, message: 'Category chip created successfully', chip: newChip });
  } catch (error) {
    console.error('Create Category Chip Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update a Category Chip
// @route   PUT /api/admin/catalog/chips/:id
// @access  Private (Admin)
const updateCategoryChip = async (req, res) => {
  try {
    const { categoryName, active, order } = req.body;
    const chip = await CategoryChip.findOne({ id: req.params.id });

    if (!chip) {
      return res.status(404).json({ success: false, message: 'Category chip not found' });
    }

    if (categoryName !== undefined) chip.categoryName = categoryName;
    if (active !== undefined) chip.active = (active === false || active === 'false') ? false : true;
    if (order !== undefined) chip.order = Number(order);

    if (req.file) {
      chip.image = getImageUrl(req.file.url);
    }

    await chip.save();
    res.status(200).json({ success: true, message: 'Category chip updated successfully', chip });
  } catch (error) {
    console.error('Update Category Chip Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Delete a Category Chip
// @route   DELETE /api/admin/catalog/chips/:id
// @access  Private (Admin)
const deleteCategoryChip = async (req, res) => {
  try {
    const result = await CategoryChip.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Category chip not found' });
    }
    res.status(200).json({ success: true, message: 'Category chip deleted successfully' });
  } catch (error) {
    console.error('Delete Category Chip Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getCategoryChips,
  createCategoryChip,
  updateCategoryChip,
  deleteCategoryChip
};
