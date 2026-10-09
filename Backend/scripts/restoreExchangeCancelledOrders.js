// One-off: orders whose exchange was cancelled used to be left at 'Exchange Cancelled', which
// blocks any later return or exchange. A cancelled exchange never moved either item, so these
// orders go back to 'Delivered'. Stock and price-difference refunds were already handled when the
// exchange was cancelled; this only fixes the order status.
// Dry run by default; pass --apply to write.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Order = require('../Models/Order');

const run = async () => {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGODB_URL / MONGO_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);

  const orders = await Order.find({ status: 'Exchange Cancelled' }).select('_id').lean();
  console.log(`${orders.length} order(s) at 'Exchange Cancelled':`, orders.map(o => String(o._id)).join(', ') || '-');

  if (process.argv.includes('--apply') && orders.length) {
    const result = await Order.updateMany({ status: 'Exchange Cancelled' }, { $set: { status: 'Delivered' } });
    console.log(`Updated ${result.modifiedCount} order(s) to 'Delivered'.`);
  } else if (orders.length) {
    console.log('Dry run — re-run with --apply to update them.');
  }

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
