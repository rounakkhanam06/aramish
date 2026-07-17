const Admin = require('../Models/Admin');
const connectDB = require('../Config/db');
require('dotenv').config();

const seedAdmin = async () => {
  await connectDB();

  const email = 'admin@gmail.com';
  const password = '123';

  try {
    const existing = await Admin.findOne({ email });

    if (existing) {
      console.log(`✅ Admin already exists: ${email}`);
      process.exit(0);
    }

    const admin = await Admin.create({
      name: 'Super Admin',
      email,
      password,
      role: 'super_admin'
    });

    console.log(`✅ Admin created successfully!`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
