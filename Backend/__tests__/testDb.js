const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let replSet;

// MongoDB transactions require a replica set. A single-node repl set is sufficient to
// exercise real transaction commit/abort semantics identically to production.
const startTestDb = async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  // Pre-create every collection touched inside a transaction. The very first write to a
  // brand-new collection made *inside* a transaction can throw a transient
  // "already in use"/WriteConflict error on some server versions — creating collections
  // up front avoids that test-environment quirk entirely.
  const models = [
    require('../Models/Order'),
    require('../Models/User'),
    require('../Models/Product'),
    require('../Models/Coupon'),
    require('../Models/CouponUsage'),
    require('../Models/WalletTransaction'),
    require('../Models/CoinTransaction'),
    require('../Models/SystemConfig'),
    require('../Models/Referral')
  ];
  for (const model of models) {
    await model.createCollection();
  }
};

const stopTestDb = async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
};

const clearTestDb = async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

module.exports = { startTestDb, stopTestDb, clearTestDb };
