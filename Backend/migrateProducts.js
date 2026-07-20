require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./Models/Product'); // Adjust path as needed

async function migrateProducts() {
  try {
    const uri = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('No MongoDB URI found in environment variables.');
        process.exit(1);
    }
    
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const products = await Product.find({});
    console.log(`Found ${products.length} products to check/migrate.`);

    for (let product of products) {
      let isModified = false;

      // Ensure mrp exists
      if (!product.mrp) {
        product.mrp = product.sellingPrice ? Math.floor(product.sellingPrice * 1.2) : 1000;
        isModified = true;
      }
      
      if (!product.sellingPrice) {
          product.sellingPrice = product.mrp;
          isModified = true;
      }

      // Handle variations
      if (!product.variations || product.variations.length === 0) {
        // Create a default variant
        product.variations = [{
          color: "N/A",
          size: "N/A",
          stock: product.stock || 0,
          sku: product.sku || `SKU-${product._id}-1`,
          useDefaultPricing: true
        }];
        isModified = true;
      } else {
        // Migrate existing variations
        const newVariations = product.variations.map((v, index) => {
          let color = "N/A";
          let size = "N/A";
          
          if (v.attributes) {
            // Try to extract color and size from existing attributes map if it exists
            const attrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : v.attributes;
            const keys = Object.keys(attrs || {});
            
            for (let k of keys) {
                if (k.toLowerCase().includes('color')) color = attrs[k];
                if (k.toLowerCase().includes('size')) size = attrs[k];
            }
          }
          
          return {
            color,
            size,
            stock: v.stock || 0,
            sku: v.sku || `${product.sku || product._id}-V${index+1}`,
            useDefaultPricing: true,
            images: []
          };
        });
        
        product.variations = newVariations;
        isModified = true;
      }

      if (isModified) {
        await product.save();
        console.log(`Migrated product: ${product.name}`);
      }
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateProducts();
