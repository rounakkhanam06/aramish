const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { getImageUrl } = require('../utils/imageHelper');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper to check Cloudinary Credentials
const isCloudinaryConfigured = () => {
  return (
    Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME.trim()) &&
    Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY.trim()) &&
    Boolean(process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_API_SECRET.trim())
  );
};

// Initialize Cloudinary if configured
const initCloudinary = () => {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim()
    });
  }
};
initCloudinary();

// Save image buffer either to Cloudinary or to Local Uploads Folder
const saveImageBuffer = async (buffer, filename, folderName = 'aramish') => {
  if (isCloudinaryConfigured()) {
    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folderName,
            public_id: filename.replace(/\.[^/.]+$/, ''),
            resource_type: 'image'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      return {
        url: uploadResult.secure_url,
        filename,
        isCloudinary: true
      };
    } catch (err) {
      console.error('Cloudinary upload failed, falling back to local disk:', err.message);
    }
  }

  // Fallback to local storage
  const outputPath = path.join(uploadDir, filename);
  await fs.promises.writeFile(outputPath, buffer);
  return {
    url: `/uploads/${filename}`,
    filename,
    path: outputPath,
    isCloudinary: false
  };
};

// Multer memory storage (buffer is processed by sharp)
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  },
  fileFilter: fileFilter
});

// Middleware to process image: convert to webp and save to Cloudinary or uploads/
const processImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const isBanner = req.originalUrl && req.originalUrl.toLowerCase().includes('banner');

    let sharpInstance;
    if (isBanner) {
      // Standardize banners to 1920x768, covering the entire box (fit cover)
      sharpInstance = sharp(req.file.buffer)
        .resize(1920, 768, {
          fit: 'cover',
          position: 'center'
        });
    } else {
      // Products/Categories: Standardize to 1000x1000 WebP centered on a white square canvas
      sharpInstance = sharp(req.file.buffer)
        .resize(1000, 1000, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        });
    }

    const processedBuffer = await sharpInstance
      .sharpen({ sigma: 0.5 })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    const saved = await saveImageBuffer(processedBuffer, filename, isBanner ? 'aramish/banners' : 'aramish/products');

    req.file.filename = saved.filename;
    if (saved.path) req.file.path = saved.path;
    req.file.url = saved.url;
    next();
  } catch (err) {
    console.error('Sharp processing error:', err);
    return res.status(500).json({ success: false, message: 'Image conversion failed: ' + err.message });
  }
};

// Error handler for multer errors (e.g. file size exceeded)
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Image size cannot exceed 10MB!' });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

const processImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  try {
    req.processedFiles = [];
    for (const file of req.files) {
      const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;

      let sharpInstance = sharp(file.buffer);
      if (file.fieldname === 'descriptionImages') {
        // Preserve natural aspect ratio for description infographics/banners
        sharpInstance = sharpInstance.resize(1200, null, { withoutEnlargement: true });
      } else {
        // Product thumbnails: 1000x1000 square with white padding canvas
        sharpInstance = sharpInstance.resize(1000, 1000, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        });
      }

      const processedBuffer = await sharpInstance
        .sharpen({ sigma: 0.5 })
        .webp({ quality: 85, effort: 4 })
        .toBuffer();

      const saved = await saveImageBuffer(processedBuffer, filename, 'aramish/products');

      req.processedFiles.push({
        fieldname: file.fieldname,
        filename: saved.filename,
        path: saved.path,
        url: saved.url
      });
    }
    next();
  } catch (err) {
    console.error('Sharp multiple processing error:', err);
    return res.status(500).json({ success: false, message: 'Image conversion failed: ' + err.message });
  }
};

const uploadBrandFiles = upload.fields([
  { name: 'logo', maxCount: 1 }
]);

const processBrandFiles = async (req, res, next) => {
  if (!req.files) {
    return next();
  }

  try {
    if (req.files.logo && req.files.logo[0]) {
      const file = req.files.logo[0];
      const filename = `brand-logo-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;

      const processedBuffer = await sharp(file.buffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .sharpen({ sigma: 0.5 })
        .webp({ quality: 85 })
        .toBuffer();

      const saved = await saveImageBuffer(processedBuffer, filename, 'aramish/brands');
      req.logoUrl = getImageUrl(saved.url);
    }

    next();
  } catch (err) {
    console.error('Sharp brand files processing error:', err);
    return res.status(500).json({ success: false, message: 'Image conversion failed: ' + err.message });
  }
};

module.exports = {
  uploadImage: upload.single('image'),
  uploadImages: upload.array('images', 5),
  uploadImagesAny: upload.any(),
  uploadBrandFiles,
  processImage,
  processImages,
  processBrandFiles,
  handleUploadError
};
