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

const DEFAULT_RETURN_EXCHANGE = `Return & Exchange Policy for Aramish

1. RETURNS & REFUNDS
Any delivered item can be returned within 2 days of delivery, provided it is unused, unworn, and returned in its original box with all tags intact. Once the returned item passes quality inspection, the refund is credited to your original payment method, bank account, UPI, or wallet as chosen at the time of the request.

2. EXCHANGES
Exchange requests must be raised within 2 days of delivery. You can exchange the same product for a different size or colour at no extra cost, or exchange it for any other product in our catalogue — in that case, the new product must be of equal or higher value than the original, and any price difference must be paid upfront via UPI (online) or Cash on Delivery before the exchange is approved.`;

// @desc Get all policies
// @route GET /api/admin/content/legal
// @access Public
exports.getPolicies = async (req, res) => {
  try {
    let privacy = await LegalPolicy.findOne({ type: 'privacy' });
    let terms = await LegalPolicy.findOne({ type: 'terms' });
    let returnExchange = await LegalPolicy.findOne({ type: 'returnExchange' });

    // Seed defaults if not exist
    if (!privacy) {
      privacy = await LegalPolicy.create({ type: 'privacy', content: DEFAULT_PRIVACY });
    }
    if (!terms) {
      terms = await LegalPolicy.create({ type: 'terms', content: DEFAULT_TERMS });
    }
    if (!returnExchange) {
      returnExchange = await LegalPolicy.create({ type: 'returnExchange', content: DEFAULT_RETURN_EXCHANGE });
    }

    res.status(200).json({
      success: true,
      privacy: privacy.content,
      terms: terms.content,
      returnExchange: returnExchange.content
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
    if (!['privacy', 'terms', 'returnExchange'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid policy type. Must be privacy, terms, or returnExchange.'
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
      message: `${type === 'privacy' ? 'Privacy Policy' : type === 'terms' ? 'Terms & Conditions' : 'Return & Exchange Policy'} updated successfully`,
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
