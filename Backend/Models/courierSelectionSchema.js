const mongoose = require('mongoose');

// The courier an admin chose for a shipment (order, return, or exchange leg) and what
// Shiprocket actually booked. `source`: 'admin' (chosen in our admin panel) or
// 'shiprocket_panel' (AWB assigned directly in Shiprocket, learnt from its webhook).
const courierSelectionSchema = new mongoose.Schema({
  courierId: { type: Number, default: null },
  courierName: { type: String, default: null },
  freight: { type: Number, default: null },
  codCharges: { type: Number, default: null },
  etd: { type: String, default: null },
  estimatedDays: { type: Number, default: null },
  rating: { type: Number, default: null },
  isSurface: { type: Boolean, default: null },
  source: { type: String, enum: ['admin', 'shiprocket_panel'], default: 'admin' },
  selectedAt: { type: Date, default: null },
  selectedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  selectedByName: { type: String, default: null },
  // What Shiprocket booked. A different courier than the one chosen is flagged, never hidden.
  assignedCourierId: { type: Number, default: null },
  assignedCourierName: { type: String, default: null },
  mismatch: { type: Boolean, default: false },
  // Set when the courier was changed in the Shiprocket panel after an earlier booking
  reassignedFrom: { type: String, default: null },
  reassignedAt: { type: Date, default: null }
}, { _id: false });

module.exports = courierSelectionSchema;
