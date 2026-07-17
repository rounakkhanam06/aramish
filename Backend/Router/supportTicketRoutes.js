const express = require('express');
const router = express.Router();
const { createTicket, getUserTickets, getAllTickets, updateTicket } = require('../Controllers/supportTicketController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { protectAdmin } = require('../Middlewares/authMiddleware');

// User Routes
router.post('/', protectUser, createTicket);
router.get('/my-tickets', protectUser, getUserTickets);

// Admin Routes
router.get('/admin', protectAdmin, getAllTickets);
router.put('/admin/:id', protectAdmin, updateTicket);

module.exports = router;
