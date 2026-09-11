const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { getImagePath } = require('../utils/imageHelper');
const Product = require('../Models/Product');
const Banner = require('../Models/Banner');
const CategoryChip = require('../Models/CategoryChip');
const SubCategoryChip = require('../Models/SubCategoryChip');
const Brand = require('../Models/Brand');
const User = require('../Models/User');
const Admin = require('../Models/Admin');
const Reel = require('../Models/Reel');
const ReturnRequest = require('../Models/ReturnRequest');

const cleanString = (val) => {
  if (!val || typeof val !== 'string') return val;
  return getImagePath(val);
};

const cleanArray = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map(cleanString).filter(Boolean);
};

const runMigration = async () => {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URL not found in environment!');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.\n');

  try {
    // 1. Clean Products
    console.log('--- Cleaning Products ---');
    const products = await Product.find({});
    let updatedProducts = 0;
    for (const prod of products) {
      let changed = false;

      if (Array.isArray(prod.images)) {
        const cleanedImages = cleanArray(prod.images);
        if (JSON.stringify(cleanedImages) !== JSON.stringify(prod.images)) {
          prod.images = cleanedImages;
          changed = true;
        }
      }

      if (Array.isArray(prod.descriptionImages)) {
        const cleanedDesc = cleanArray(prod.descriptionImages);
        if (JSON.stringify(cleanedDesc) !== JSON.stringify(prod.descriptionImages)) {
          prod.descriptionImages = cleanedDesc;
          changed = true;
        }
      }

      if (Array.isArray(prod.variations)) {
        for (const v of prod.variations) {
          if (Array.isArray(v.images)) {
            const cleanedVImgs = cleanArray(v.images);
            if (JSON.stringify(cleanedVImgs) !== JSON.stringify(v.images)) {
              v.images = cleanedVImgs;
              changed = true;
            }
          }
        }
      }

      if (changed) {
        prod.markModified('variations');
        await prod.save();
        updatedProducts++;
      }
    }
    console.log(`Products updated: ${updatedProducts} / ${products.length}`);

    // 2. Clean Banners
    console.log('\n--- Cleaning Banners ---');
    const banners = await Banner.find({});
    let updatedBanners = 0;
    for (const b of banners) {
      const cleaned = cleanString(b.image);
      if (cleaned !== b.image) {
        b.image = cleaned;
        await b.save();
        updatedBanners++;
      }
    }
    console.log(`Banners updated: ${updatedBanners} / ${banners.length}`);

    // 3. Clean CategoryChips
    console.log('\n--- Cleaning Category Chips ---');
    const chips = await CategoryChip.find({});
    let updatedChips = 0;
    for (const c of chips) {
      const cleaned = cleanString(c.image);
      if (cleaned !== c.image) {
        c.image = cleaned;
        await c.save();
        updatedChips++;
      }
    }
    console.log(`Category chips updated: ${updatedChips} / ${chips.length}`);

    // 4. Clean SubCategoryChips
    console.log('\n--- Cleaning SubCategory Chips ---');
    const subchips = await SubCategoryChip.find({});
    let updatedSubchips = 0;
    for (const sc of subchips) {
      const cleaned = cleanString(sc.image);
      if (cleaned !== sc.image) {
        sc.image = cleaned;
        await sc.save();
        updatedSubchips++;
      }
    }
    console.log(`SubCategory chips updated: ${updatedSubchips} / ${subchips.length}`);

    // 5. Clean Brands
    console.log('\n--- Cleaning Brands ---');
    const brands = await Brand.find({});
    let updatedBrands = 0;
    for (const br of brands) {
      const cleaned = cleanString(br.logo);
      if (cleaned !== br.logo) {
        br.logo = cleaned;
        await br.save();
        updatedBrands++;
      }
    }
    console.log(`Brands updated: ${updatedBrands} / ${brands.length}`);

    // 6. Clean Users
    console.log('\n--- Cleaning Users ---');
    const users = await User.find({ avatar: { $exists: true, $ne: '' } });
    let updatedUsers = 0;
    for (const u of users) {
      const cleaned = cleanString(u.avatar);
      if (cleaned !== u.avatar) {
        u.avatar = cleaned;
        await u.save();
        updatedUsers++;
      }
    }
    console.log(`Users updated: ${updatedUsers} / ${users.length}`);

    // 7. Clean Admins
    console.log('\n--- Cleaning Admins ---');
    const admins = await Admin.find({ avatar: { $exists: true, $ne: '' } });
    let updatedAdmins = 0;
    for (const a of admins) {
      const cleaned = cleanString(a.avatar);
      if (cleaned !== a.avatar) {
        a.avatar = cleaned;
        await a.save();
        updatedAdmins++;
      }
    }
    console.log(`Admins updated: ${updatedAdmins} / ${admins.length}`);

    // 8. Clean Reels
    console.log('\n--- Cleaning Reels ---');
    const reels = await Reel.find({});
    let updatedReels = 0;
    for (const r of reels) {
      let changed = false;
      const cleanedVideo = cleanString(r.video);
      const cleanedProfile = cleanString(r.profileImage);
      if (cleanedVideo !== r.video) {
        r.video = cleanedVideo;
        changed = true;
      }
      if (cleanedProfile !== r.profileImage) {
        r.profileImage = cleanedProfile;
        changed = true;
      }
      if (changed) {
        await r.save();
        updatedReels++;
      }
    }
    console.log(`Reels updated: ${updatedReels} / ${reels.length}`);

    // 9. Clean ReturnRequests
    console.log('\n--- Cleaning Return Requests ---');
    const returns = await ReturnRequest.find({ images: { $exists: true, $ne: [] } });
    let updatedReturns = 0;
    for (const ret of returns) {
      const cleanedImages = cleanArray(ret.images);
      if (JSON.stringify(cleanedImages) !== JSON.stringify(ret.images)) {
        ret.images = cleanedImages;
        await ret.save();
        updatedReturns++;
      }
    }
    console.log(`Return requests updated: ${updatedReturns} / ${returns.length}`);

    console.log('\nMigration completed successfully! All image URLs are now clean relative paths.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration };
