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

    try {
      const { sendNotificationToAdmins } = require('../Router/firebaseAdmin');
      sendNotificationToAdmins({
        title: '🎫 New Support Ticket',
        body: `${ticket.userName} raised: ${ticket.subject}`,
        data: { url: '/admin/support', ticketId: ticket._id.toString(), type: 'NEW_TICKET' }
      }).catch(e => console.error('Failed to notify admins of new ticket:', e.message));
    } catch (notifErr) {
      console.error('Failed to notify admins of new ticket:', notifErr.message);
    }

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
const STATUS_RANK = { 'Open': 0, 'In-Progress': 1, 'Closed': 2 };

const updateTicket = async (req, res) => {
  try {
    const { status, priority } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (status && status !== ticket.status) {
      if (!(status in STATUS_RANK)) {
        return res.status(400).json({ success: false, message: `Invalid status '${status}'.` });
      }
      if (STATUS_RANK[status] < STATUS_RANK[ticket.status]) {
        return res.status(400).json({ success: false, message: `Cannot move ticket status backward from '${ticket.status}' to '${status}'.` });
      }
      ticket.status = status;

      try {
        const { sendNotificationToUser } = require('../Router/firebaseAdmin');
        sendNotificationToUser(ticket.userId, {
          title: `Support Ticket ${status}`,
          body: `Your ticket "${ticket.subject}" is now ${status}.`,
          data: { url: '/help-support', ticketId: ticket._id.toString(), type: 'TICKET_STATUS' }
        }).catch(e => console.error('Failed to notify user of ticket status change:', e.message));
      } catch (notifErr) {
        console.error('Failed to notify user of ticket status change:', notifErr.message);
      }
    }
    if (priority) ticket.priority = priority;

    await ticket.save();

    res.status(200).json({ success: true, message: 'Ticket updated successfully', ticket });
  } catch (error) {
    console.error('Update Ticket Error:', error);
    res.status(550).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Admin replies to a ticket
// @route   POST /support-tickets/admin/:id/reply
// @access  Private (Admin)
const replyToTicket = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.replies.push({ message: message.trim(), repliedBy: req.admin?.name || 'Admin' });
    await ticket.save();

    try {
      const { sendNotificationToUser } = require('../Router/firebaseAdmin');
      sendNotificationToUser(ticket.userId, {
        title: `New reply on your ticket`,
        body: message.trim().slice(0, 100),
        data: { url: '/help-support', ticketId: ticket._id.toString(), type: 'TICKET_REPLY' }
      }).catch(e => console.error('Failed to notify user of ticket reply:', e.message));
    } catch (notifErr) {
      console.error('Failed to notify user of ticket reply:', notifErr.message);
    }

    res.status(200).json({ success: true, message: 'Reply sent successfully', ticket });
  } catch (error) {
    console.error('Reply Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  createTicket,
  getUserTickets,
  getAllTickets,
  updateTicket,
  replyToTicket
};
