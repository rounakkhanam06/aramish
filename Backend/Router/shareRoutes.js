const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../Models/Product');
const { getImageUrl } = require('../utils/imageHelper');

router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send('Invalid Product ID');
    }

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).send('Product Not Found');
    }

    const title = `${product.name} | Aramish`;
    const description = product.description
      ? String(product.description).slice(0, 160)
      : `Buy ${product.name} for ₹${product.sellingPrice} on Aramish. Premium quality footwear.`;
    
    let rawImg = (product.images && product.images.length > 0) ? product.images[0] : '';
    if (!rawImg && product.variations && product.variations.length > 0) {
      const vWithImg = product.variations.find(v => v.images && v.images.length > 0);
      if (vWithImg) rawImg = vWithImg.images[0];
    }

    const imageUrl = getImageUrl(rawImg) || 'https://aramish.in/aramish-logo.png';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl.replace(/\/$/, '')}/product/${product._id}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>

  <!-- Primary Meta Tags -->
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook / WhatsApp Meta Tags -->
  <meta property="og:type" content="product">
  <meta property="og:url" content="${escapeHtml(redirectUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Aramish">

  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(redirectUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

  <script>
    // Seamless redirect for human users
    window.location.replace("${escapeHtml(redirectUrl)}");
  </script>
</head>
<body style="font-family: sans-serif; text-align: center; padding: 40px; color: #333;">
  <h2>${escapeHtml(product.name)}</h2>
  <p>Price: ₹${product.sellingPrice}</p>
  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" style="max-width: 300px; border-radius: 12px; margin: 20px 0;" />
  <p>Redirecting to product page...</p>
  <p><a href="${escapeHtml(redirectUrl)}" style="color: #02006c; font-weight: bold;">Click here if you are not redirected automatically.</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Share Route Error:', error);
    return res.status(500).send('Server Error');
  }
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = router;
