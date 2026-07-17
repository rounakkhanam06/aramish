const QnA = require('../Models/QnA');

const DEFAULT_FAQS = [
  {
    question: 'How do I track my order?',
    answer: 'Once your order is shipped, you will receive a tracking link via email and SMS. You can also track it directly from your profile dashboard.'
  },
  {
    question: 'What is the return policy?',
    answer: 'We offer a 7-day hassle-free return policy for all unused products in their original packaging. Returns can be initiated from the orders page.'
  },
  {
    question: 'How does vendor shipping work?',
    answer: 'Vendors pack and prepare products according to our shipping specifications. The platform-assigned logistics service then collects and delivers the order.'
  }
];

// @desc Get all FAQs
// @route GET /api/admin/content/qna
// @access Public
exports.getQnAs = async (req, res) => {
  try {
    let faqs = await QnA.find().sort({ createdAt: -1 });
    
    // Seed defaults if empty
    if (faqs.length === 0) {
      await QnA.insertMany(DEFAULT_FAQS);
      faqs = await QnA.find().sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      count: faqs.length,
      qnas: faqs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to fetch FAQs'
    });
  }
};

// @desc Create a new FAQ
// @route POST /api/admin/content/qna
// @access Private (Admin only)
exports.createQnA = async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both question and answer.'
      });
    }

    const faq = await QnA.create({ question, answer });
    res.status(201).json({
      success: true,
      message: 'FAQ published successfully',
      qna: faq
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to publish FAQ'
    });
  }
};

// @desc Update an FAQ
// @route PUT /api/admin/content/qna/:id
// @access Private (Admin only)
exports.updateQnA = async (req, res) => {
  try {
    const { question, answer } = req.body;

    const faq = await QnA.findByIdAndUpdate(
      req.params.id,
      { question, answer },
      { new: true, runValidators: true }
    );

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      qna: faq
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to update FAQ'
    });
  }
};

// @desc Delete an FAQ
// @route DELETE /api/admin/content/qna/:id
// @access Private (Admin only)
exports.deleteQnA = async (req, res) => {
  try {
    const faq = await QnA.findByIdAndDelete(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to delete FAQ'
    });
  }
};
