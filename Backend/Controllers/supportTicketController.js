const SupportTicket = require('../Models/SupportTicket');

// @desc    Create a Support Ticket
// @route   POST /support-tickets
// @access  Private (User)
const createTicket = async (req, res) => {
  try {
    const { subject, category, description, priority } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }

    // Generate unique Ticket ID
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `TIC-${randomNum}`;

    const ticket = new SupportTicket({
      ticketId,
      userId: req.user._id,
      userName: req.user.name || 'Anonymous User',
      subject,
      category: category || 'General',
      priority: priority || 'Medium',
      description
    });

    await ticket.save();

    res.status(201).json({ success: true, message: 'Support ticket raised successfully', ticket });
  } catch (error) {
    console.error('Create Ticket Error:', error);
    res.status(550).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get user's own tickets
// @route   GET /support-tickets/my-tickets
// @access  Private (User)
const getUserTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error('Get User Tickets Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Get all tickets (Admin)
// @route   GET /admin/support-tickets
// @access  Private (Admin)
const getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({}).sort({ createdAt: -1 });
    res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error('Get All Tickets Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update ticket status/priority (Admin)
// @route   PUT /admin/support-tickets/:id
// @access  Private (Admin)
const updateTicket = async (req, res) => {
  try {
    const { status, priority } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;

    await ticket.save();

    res.status(200).json({ success: true, message: 'Ticket updated successfully', ticket });
  } catch (error) {
    console.error('Update Ticket Error:', error);
    res.status(550).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  createTicket,
  getUserTickets,
  getAllTickets,
  updateTicket
};
