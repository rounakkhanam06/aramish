const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Product = require('./Models/Product');

async function run() {
  try {
    if (!process.env.MONGODB_URL) {
      throw new Error('MONGODB_URL env variable is not defined');
    }
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to DB successfully.');

    const productsWithoutArticle = await Product.find({ article: { $exists: false } });
    console.log(`Found ${productsWithoutArticle.length} products without the article field.`);

    let updatedCount = 0;
    for (const prod of productsWithoutArticle) {
      prod.article = prod.sku || `ART-${prod._id.toString().substring(0, 8).toUpperCase()}`;
      await prod.save({ validateBeforeSave: false }); // skip validations since schema is changing
      updatedCount++;
    }

    console.log(`Successfully migrated ${updatedCount} products by setting their article field.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
}

run();
