const Reel = require('../Models/Reel');
const Product = require('../Models/Product');

// @desc    Create user review reel
// @route   POST /api/reels
// @access  Private
exports.createReel = async (req, res) => {
  try {
    const { productId, rating, caption } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    // Verify if user is a verified buyer
    const Order = require('../Models/Order');
    const hasPurchased = await Order.exists({
      userId: req.user._id,
      "items.productId": productId,
      status: { $ne: 'Cancelled' }
    });

    if (!hasPurchased) {
      return res.status(403).json({ success: false, message: 'You can only review products that you have purchased.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a video review' });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;

    const reel = await Reel.create({
      productId,
      uploadedBy: req.user._id,
      userModel: 'User',
      userType: 'user',
      username: req.user.name || 'Anonymous User',
      profileImage: req.user.profileImage || '',
      video: videoUrl,
      rating: rating || 5,
      caption: caption || '',
      status: 'pending',
      section: 'following'
    });

    res.status(201).json({ success: true, message: 'Reel review uploaded successfully, awaiting moderation.', reel });
  } catch (error) {
    console.error('Error creating reel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if user is eligible to write a review for a product
// @route   GET /api/reels/check-eligibility
// @access  Private
exports.checkEligibility = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const Order = require('../Models/Order');
    const hasPurchased = await Order.exists({
      userId: req.user._id,
      "items.productId": productId,
      status: { $ne: 'Cancelled' }
    });

    res.status(200).json({ success: true, eligible: !!hasPurchased });
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create admin promotional reel
// @route   POST /api/reels/admin/upload
// @access  Private/Admin
exports.createAdminReel = async (req, res) => {
  try {
    const { productId, caption, rating, featured, section } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a video file' });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;

    const reel = await Reel.create({
      productId,
      uploadedBy: req.admin._id,
      userModel: 'Admin',
      userType: 'admin',
      username: req.admin.username || 'Admin',
      profileImage: '/uploads/admin-avatar.png',
      video: videoUrl,
      rating: rating || 5,
      caption: caption || '',
      status: 'approved',
      section: section || 'forYou'
    });

    res.status(201).json({ success: true, message: 'Admin reel published successfully.', reel });
  } catch (error) {
    console.error('Error creating admin reel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get approved reels for feed
// @route   GET /api/reels
// @access  Public
exports.getReels = async (req, res) => {
  try {
    const { section } = req.query; // 'forYou' or 'following'
    const query = { status: 'approved' };
    if (section) {
      query.section = section;
    }

    const reels = await Reel.find(query)
      .populate('productId', 'name sellingPrice mrp images brandName discountLabel')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: reels.length, reels });
  } catch (error) {
    console.error('Error fetching reels:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reels (Admin moderation)
// @route   GET /api/reels/admin/all
// @access  Private/Admin
exports.adminGetReels = async (req, res) => {
  try {
    const reels = await Reel.find({})
      .populate('productId', 'name images')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: reels.length, reels });
  } catch (error) {
    console.error('Error fetching admin reels:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update reel approval status
// @route   PUT /api/reels/admin/:id/status
// @access  Private/Admin
exports.adminUpdateReelStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected' or 'pending'
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    reel.status = status;
    await reel.save();

    res.status(200).json({ success: true, message: `Reel status updated to ${status}`, reel });
  } catch (error) {
    console.error('Error updating reel status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete reel
// @route   DELETE /api/reels/admin/:id
// @access  Private/Admin
exports.adminDeleteReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    await reel.deleteOne();
    res.status(200).json({ success: true, message: 'Reel deleted successfully' });
  } catch (error) {
    console.error('Error deleting reel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Like / Unlike a reel
// @route   POST /api/reels/:id/like
// @access  Private
exports.likeReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const index = reel.likes.indexOf(req.user._id);
    let isLiked = false;

    if (index === -1) {
      reel.likes.push(req.user._id);
      isLiked = true;
    } else {
      reel.likes.splice(index, 1);
    }

    await reel.save();
    res.status(200).json({ success: true, isLiked, likesCount: reel.likes.length });
  } catch (error) {
    console.error('Error liking reel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add comment to reel
// @route   POST /api/reels/:id/comment
// @access  Private
exports.commentReel = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const comment = {
      userId: req.user._id,
      username: req.user.name || 'Anonymous User',
      profileImage: req.user.profileImage || '',
      text,
      createdAt: new Date()
    };

    reel.comments.push(comment);
    await reel.save();

    res.status(201).json({ success: true, message: 'Comment added successfully', comment: reel.comments[reel.comments.length - 1], commentsCount: reel.comments.length });
  } catch (error) {
    console.error('Error commenting reel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Increment view count
// @route   POST /api/reels/:id/view
// @access  Public
exports.incrementViews = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    reel.views += 1;
    await reel.save();

    res.status(200).json({ success: true, views: reel.views });
  } catch (error) {
    console.error('Error incrementing views:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update comment in reel
// @route   PUT /api/reels/:id/comment/:commentId
// @access  Private
exports.updateReelComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const comment = reel.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Check ownership
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this comment' });
    }

    comment.text = text;
    await reel.save();

    res.status(200).json({ success: true, message: 'Comment updated successfully', comment, commentsCount: reel.comments.length });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete comment in reel
// @route   DELETE /api/reels/:id/comment/:commentId
// @access  Private
exports.deleteReelComment = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    const comment = reel.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Check ownership
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    comment.deleteOne();
    await reel.save();

    res.status(200).json({ success: true, message: 'Comment deleted successfully', commentsCount: reel.comments.length });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

