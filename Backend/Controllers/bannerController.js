const Banner = require('../Models/Banner');
const { getImageUrl } = require('../utils/imageHelper');

// @desc    Get all Banners
// @route   GET /api/admin/catalog/banners
// @access  Public
const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, banners });
  } catch (error) {
    console.error('Get Banners Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Create a Banner
// @route   POST /api/admin/catalog/banners
// @access  Private (Admin)
const createBanner = async (req, res) => {
  try {
    const { title, subtitle, active } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    let image = null;
    if (req.file) {
      image = getImageUrl(req.file.url);
    } else if (req.body.image) {
      image = req.body.image;
    }

    if (!image) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    const newBanner = new Banner({
      title,
      subtitle,
      image,
      active: (active === false || active === 'false') ? false : true
    });

    await newBanner.save();
    res.status(201).json({ success: true, message: 'Banner created successfully', banner: newBanner });
  } catch (error) {
    console.error('Create Banner Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update a Banner
// @route   PUT /api/admin/catalog/banners/:id
// @access  Private (Admin)
const updateBanner = async (req, res) => {
  try {
    const { title, subtitle, active } = req.body;
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (title !== undefined) banner.title = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (active !== undefined) banner.active = (active === false || active === 'false') ? false : true;

    if (req.file) {
      banner.image = getImageUrl(req.file.url);
    } else if (req.body.image !== undefined) {
      banner.image = req.body.image;
    }

    await banner.save();
    res.status(200).json({ success: true, message: 'Banner updated successfully', banner });
  } catch (error) {
    console.error('Update Banner Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Delete a Banner
// @route   DELETE /api/admin/catalog/banners/:id
// @access  Private (Admin)
const deleteBanner = async (req, res) => {
  try {
    const result = await Banner.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete Banner Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const publishBanners = async (req, res) => {
  try {
    const { banners } = req.body;
    if (!Array.isArray(banners)) {
      return res.status(400).json({ success: false, message: 'Banners array is required' });
    }

    const validated = banners.map(b => ({
      title: b.title,
      subtitle: b.subtitle || '',
      image: b.image,
      active: b.active !== false
    }));

    await Banner.deleteMany({});
    await Banner.insertMany(validated);

    res.status(200).json({ success: true, message: 'Banners published successfully!' });
  } catch (error) {
    console.error('Publish Banners Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  publishBanners
};
