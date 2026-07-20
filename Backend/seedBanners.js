require('dotenv').config();
const mongoose = require('mongoose');
const Banner = require('./Models/Banner');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aramish';

const seedBanners = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const banners = [
      {
        title: 'Premium Sneakers',
        subtitle: 'Step into Style',
        image: '/uploads/banners/footwear1.png',
        active: true
      },
      {
        title: 'Casual & Formal',
        subtitle: 'For Every Occasion',
        image: '/uploads/banners/footwear2.png',
        active: true
      }
    ];

    await Banner.deleteMany({});
    await Banner.insertMany(banners);
    console.log('Successfully seeded banners into the database.');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding banners:', error);
    process.exit(1);
  }
};

seedBanners();
