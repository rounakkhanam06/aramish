const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const CategoryChip = require('./Models/CategoryChip');
const SubCategoryChip = require('./Models/SubCategoryChip');

const data = [
  {
    categoryName: 'Formal Shoes',
    id: 'formal-shoes',
    order: 1,
    subcategories: [
      { name: 'Lace-up', id: 'formal-shoes-lace-up', order: 1 },
      { name: 'Slip-on', id: 'formal-shoes-slip-on', order: 2 },
      { name: 'Oxford', id: 'formal-shoes-oxford', order: 3 },
      { name: 'Brogue', id: 'formal-shoes-brogue', order: 4 },
      { name: 'Corporate Casual', id: 'formal-shoes-corporate-casual', order: 5 },
      { name: 'Police Shoe', id: 'formal-shoes-police-shoe', order: 6 }
    ]
  },
  {
    categoryName: 'Casual Shoes',
    id: 'casual-shoes',
    order: 2,
    subcategories: [
      { name: 'Loafers', id: 'casual-shoes-loafers', order: 1 },
      { name: 'Back Open / Half Shoes', id: 'casual-shoes-back-open-half-shoes', order: 2 }
    ]
  },
  {
    categoryName: 'Boots',
    id: 'boots',
    order: 3,
    subcategories: [
      { name: 'Chukka', id: 'boots-chukka', order: 1 },
      { name: 'Chelsea', id: 'boots-chelsea', order: 2 },
      { name: 'Police Boot', id: 'boots-police-boot', order: 3 }
    ]
  },
  {
    categoryName: 'Sandals',
    id: 'sandals',
    order: 4,
    subcategories: [
      { name: 'Half Sandal', id: 'sandals-half-sandal', order: 1 },
      { name: 'Fisherman Sandal', id: 'sandals-fisherman-sandal', order: 2 }
    ]
  },
  {
    categoryName: 'Ethnic Footwear',
    id: 'ethnic-footwear',
    order: 5,
    subcategories: [
      { name: 'Juttis (Half)', id: 'ethnic-footwear-juttis-half', order: 1 },
      { name: 'Juttis (Full)', id: 'ethnic-footwear-juttis-full', order: 2 },
      { name: 'Sandals', id: 'ethnic-footwear-sandals', order: 3 }
    ]
  }
];

const seedCategories = async () => {
  try {
    const mongoUri = process.env.MONGODB_URL || 'mongodb+srv://aramishshoes_db_user:veNWqLILbVZBoUF2@cluster0.o1aejqd.mongodb.net/Aramish?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully.');

    console.log('Clearing old CategoryChips and SubCategoryChips...');
    await CategoryChip.deleteMany({});
    await SubCategoryChip.deleteMany({});

    for (const cat of data) {
      console.log(`Inserting Category: ${cat.categoryName} (${cat.id})`);
      const createdCat = await CategoryChip.create({
        id: cat.id,
        categoryName: cat.categoryName,
        active: true,
        order: cat.order,
        image: null
      });

      for (const sub of cat.subcategories) {
        console.log(`  - Inserting Subcategory: ${sub.name} (Parent: ${cat.id})`);
        await SubCategoryChip.create({
          id: sub.id,
          categoryId: cat.id,
          subCategoryName: sub.name,
          active: true,
          order: sub.order,
          image: null
        });
      }
    }

    console.log('Category and Subcategory seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories and subcategories:', error);
    process.exit(1);
  }
};

seedCategories();
