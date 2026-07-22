const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  actor:     { type: String, enum: ['customer', 'admin', 'system', 'webhook'], default: 'system' },
  actorId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  remarks:   { type: String, default: '' }
}, { _id: false });

const webhookHistorySchema = new mongoose.Schema({
  leg:       { type: String, enum: ['reverse', 'forward'], required: true },
  rawStatus: { type: String, default: '' },
  mapped:    { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  location:  { type: String, default: '' },
  remarks:   { type: String, default: '' }
}, { _id: false });

const auditLogSchema = new mongoose.Schema({
  action:     { type: String, required: true },
  adminId:    { type: mongoose.Schema.Types.ObjectId, default: null },
  adminName:  { type: String, default: '' },
  timestamp:  { type: Date, default: Date.now },
  fromStatus: { type: String, default: '' },
  toStatus:   { type: String, default: '' },
  notes:      { type: String, default: '' }
}, { _id: false });

const shipmentLegSchema = new mongoose.Schema({
  orderId:     { type: String, default: null },
  shipmentId:  { type: String, default: null },
  awb:         { type: String, default: null },
  trackingUrl: { type: String, default: null },
  response:    { type: mongoose.Schema.Types.Mixed, default: null },
  status:      { type: String, enum: ['Pending', 'Created', 'AWB Assigned', 'Failed'], default: 'Pending' },
  failed:      { type: Boolean, default: false }
}, { _id: false });

const exchangeRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalItem: {
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variationSku: { type: String, default: null },
    name:         { type: String, required: true },
    price:        { type: Number, required: true },
    quantity:     { type: Number, default: 1 },
    image:        { type: String, default: '' },
    color:        { type: String, default: '' },
    size:         { type: String, default: '' }
  },
  requestedVariant: {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    color:     { type: String, required: true },
    size:      { type: String, required: true },
    sku:       { type: String, required: true },
    image:     { type: String, default: '' },
    price:     { type: Number, default: 0 }
  },
  priceDifference:  { type: Number, default: 0 },
  additionalAmount: { type: Number, default: 0 },
  refundAmount:     { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['Not Required', 'Pending', 'Collected', 'Refunded'],
    default: 'Not Required'
  },
  reason: {
    type: String,
    enum: ['Size Issue', 'Color Issue', 'Wrong Item Received', 'Defective Product', 'Changed Mind', 'Other'],
    required: true
  },
  comments: { type: String, default: '' },
  images:   { type: [String], default: [] },
  status: {
    type: String,
    enum: ['Requested','Approved','Rejected','Pickup Scheduled','Old Item Picked Up','Replacement Dispatched','Completed','Cancelled','Failed','Manual Review'],
    default: 'Requested'
  },
  adminNotes:      { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  shipmentRetryInProgress: { type: Boolean, default: false },
  retryCount:      { type: Number, default: 0 },
  lastRetryAt:     { type: Date, default: null },
  lastError:       { type: String, default: '' },
  shipmentErrors: [{
    leg:       { type: String, enum: ['reverse', 'forward'], required: true },
    error:     { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  inventoryReservation: {
    variantSku:  { type: String, default: null },
    productId:   { type: mongoose.Schema.Types.ObjectId, default: null },
    quantity:    { type: Number, default: 1 },
    reservedAt:  { type: Date, default: null },
    released:    { type: Boolean, default: false },
    releasedAt:  { type: Date, default: null }
  },
  reverse:    { type: shipmentLegSchema, default: () => ({}) },
  forward:    { type: shipmentLegSchema, default: () => ({}) },
  courierName: { type: String, default: null },
  timeline:       { type: [timelineEntrySchema], default: [] },
  webhookHistory: { type: [webhookHistorySchema], default: [] },
  auditLog:       { type: [auditLogSchema], default: [] }
}, { timestamps: true });

exchangeRequestSchema.index({ orderId: 1 });
exchangeRequestSchema.index({ userId: 1, createdAt: -1 });
exchangeRequestSchema.index({ status: 1, createdAt: -1 });
exchangeRequestSchema.index({ 'reverse.orderId': 1 }, { sparse: true });
exchangeRequestSchema.index({ 'forward.orderId': 1 }, { sparse: true });

module.exports = mongoose.model('ExchangeRequest', exchangeRequestSchema);
