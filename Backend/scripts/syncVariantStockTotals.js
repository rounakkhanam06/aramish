// One-time fix: sets each variant product's top-level `stock` to the total of its variants.
// Orders, cancellations, returns and exchanges used to change only the variant stock, so the
// total shown in the admin inventory list / stock alerts drifted. They now keep it in sync.
//
// Usage: node scripts/syncVariantStockTotals.js            (report only)
//        node scripts/syncVariantStockTotals.js --apply    (write the corrected totals)
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Product = require('../Models/Product');

const run = async () => {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGODB_URL is not set.');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  await mongoose.connect(mongoUri);

  const products = await Product.find({ 'variations.0': { $exists: true } }, 'name stock variations.stock').lean();
  let drifted = 0;
  for (const p of products) {
    const total = p.variations.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    if (p.stock === total) continue;
    drifted += 1;
    console.log(`${p._id}  ${p.name}: stock ${p.stock} -> ${total}`);
    if (apply) {
      // Pipeline update computes the total from the live variants, so an order placed while
      // this runs can't be lost.
      await Product.updateOne({ _id: p._id }, [{ $set: { stock: { $sum: '$variations.stock' } } }], { updatePipeline: true });
    }
  }

  console.log(`${drifted} of ${products.length} variant products had a wrong total.${apply ? ' Fixed.' : ' Run with --apply to fix.'}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
