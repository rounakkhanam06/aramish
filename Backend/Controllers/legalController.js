const LegalPolicy = require('../Models/LegalPolicy');

// Default initial content
const DEFAULT_PRIVACY = `Privacy Policy for Aramish

Last Updated: June 2026

At Aramish, we take your privacy seriously. This policy describes how we collect, use, and protect your personal data when you use our marketplace.

1. DATA COLLECTION
We collect information that you provide when creating an account, such as your business name, email address, and contact details.

2. HOW WE USE DATA
We use your information to facilitate transactions, provide customer support, and improve our services.

3. DATA PROTECTION
We implement industry-standard security measures to ensure the safety of your personal information.`;

const DEFAULT_TERMS = `Terms & Conditions for Aramish

1. ACCEPTANCE OF TERMS
By accessing and using the Aramish platform, you agree to comply with these terms.

2. VENDOR OBLIGATIONS
Vendors must provide accurate product information and maintain professional standards of service.

3. PAYMENTS & COMMISSIONS
All transactions are subject to platform commissions as defined in the Finance section.`;

// @desc Get all policies
// @route GET /api/admin/content/legal
// @access Public
exports.getPolicies = async (req, res) => {
  try {
    let privacy = await LegalPolicy.findOne({ type: 'privacy' });
    let terms = await LegalPolicy.findOne({ type: 'terms' });

    // Seed defaults if not exist
    if (!privacy) {
      privacy = await LegalPolicy.create({ type: 'privacy', content: DEFAULT_PRIVACY });
    }
    if (!terms) {
      terms = await LegalPolicy.create({ type: 'terms', content: DEFAULT_TERMS });
    }

    res.status(200).json({
      success: true,
      privacy: privacy.content,
      terms: terms.content
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to fetch policies'
    });
  }
};

// @desc Update a policy
// @route PUT /api/admin/content/legal
// @access Private (Admin only)
exports.updatePolicy = async (req, res) => {
  try {
    const { type, content } = req.body;
    if (!['privacy', 'terms'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid policy type. Must be privacy or terms.'
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Policy content is required.'
      });
    }

    const policy = await LegalPolicy.findOneAndUpdate(
      { type },
      { content },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: `${type === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'} updated successfully`,
      content: policy.content
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to update policy'
    });
  }
};
