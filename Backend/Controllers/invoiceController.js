const mongoose = require('mongoose');
const Order = require('../Models/Order');
const SystemConfig = require('../Models/SystemConfig');
const {
  issueInvoice, renderInvoicePdf, isDeliveredForInvoice, isIssuableStatus, sellerDetailsProblems
} = require('../utils/invoiceService');

const sendPdf = async (res, order) => {
  const pdf = await renderInvoicePdf(order);
  const fileName = `Invoice_${order.invoice.number.replace(/\//g, '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).end(pdf);
};

const sendError = (res, error, fallback) => {
  if (error && error.status && error.code) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: 'Could not generate the invoice. Please try again later.' });
};

// @desc    Download the GST invoice of my order (only after it is delivered)
// @route   GET /api/orders/:id/invoice
// @access  Private (User)
exports.downloadMyInvoice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    let order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this invoice' });
    }
    if (!isDeliveredForInvoice(order.status)) {
      return res.status(403).json({ success: false, code: 'NOT_DELIVERED', message: 'The invoice can be downloaded once your order is delivered.' });
    }
    if (!order.invoice || !order.invoice.number) {
      if (!order.taxDataCapturedAt) {
        return res.status(409).json({ success: false, code: 'HISTORICAL_ORDER', message: 'The invoice for this order is not available online yet. Please contact support.' });
      }
      // Normally issued at dispatch; issue now if that was missed (e.g. settings were incomplete).
      try {
        order = (await issueInvoice(order._id)).order;
      } catch (err) {
        console.error(`Invoice issue on customer download failed for ${order._id}:`, err.message);
        return res.status(503).json({ success: false, code: 'INVOICE_NOT_READY', message: 'Your invoice is being prepared. Please try again later or contact support.' });
      }
    }
    await sendPdf(res, order);
  } catch (error) {
    sendError(res, error, 'Customer invoice download failed:');
  }
};

// @desc    Download an order's GST invoice
// @route   GET /api/orders/admin/:id/invoice
// @access  Private/Admin
exports.adminDownloadInvoice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!order.invoice || !order.invoice.number) {
      return res.status(404).json({ success: false, code: 'NOT_ISSUED', message: 'No invoice has been issued for this order yet.' });
    }
    await sendPdf(res, order);
  } catch (error) {
    sendError(res, error, 'Admin invoice download failed:');
  }
};

// @desc    Issue an order's GST invoice now (at dispatch). Idempotent: an issued invoice is returned unchanged.
// @route   POST /api/orders/admin/:id/invoice
// @access  Private/Admin
exports.adminIssueInvoice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    // The admin issues it while handing the parcel over, so 'Processing' is allowed here.
    const { order, created } = await issueInvoice(req.params.id, { allowProcessing: true });
    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? `Invoice ${order.invoice.number} issued` : `Invoice ${order.invoice.number} was already issued`,
      invoice: { number: order.invoice.number, date: order.invoice.date }
    });
  } catch (error) {
    sendError(res, error, 'Admin invoice issue failed:');
  }
};

// @desc    Invoice state of an order for the admin panel
// @route   GET /api/orders/admin/:id/invoice-status
// @access  Private/Admin
exports.adminInvoiceStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const order = await Order.findById(req.params.id).select('status invoice.number invoice.date taxDataCapturedAt deliveryAddress').lean();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const config = await SystemConfig.findOne({}).lean();
    const problems = sellerDetailsProblems(config || {});
    let state;
    if (order.invoice && order.invoice.number) state = order.status === 'Cancelled' ? 'issued_cancelled' : 'issued';
    else if (!order.taxDataCapturedAt) state = 'historical';
    else if (isIssuableStatus(order.status, { allowProcessing: true })) state = 'due';
    else state = 'not_due';
    res.status(200).json({
      success: true,
      state,
      invoice: order.invoice && order.invoice.number ? { number: order.invoice.number, date: order.invoice.date } : null,
      placeOfSupplySource: order.deliveryAddress && order.deliveryAddress.stateSource,
      settingsProblems: problems
    });
  } catch (error) {
    sendError(res, error, 'Admin invoice status failed:');
  }
};
