const express = require('express');
const router = express.Router();
const Product = require('../Models/Product');
const { getImagePath } = require('../utils/imageHelper');

const SITE_URL = 'https://aramishshoes.com';
const FALLBACK_IMAGE = `${SITE_URL}/aramish-logo.png`;

const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

const toAbsoluteImageUrl = (raw) => {
  const rel = getImagePath(raw);
  if (!rel) return null;
  if (/^https?:\/\//i.test(rel)) return rel;
  return `${SITE_URL}${rel.startsWith('/') ? '' : '/'}${rel}`;
};

const renderMetaPage = ({ title, description, image, url }) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:type" content="product" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
</head>
<body>Redirecting to <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>...</body>
</html>`;

router.get('/product/:id', async (req, res) => {
  const productUrl = `${SITE_URL}/product/${req.params.id}`;

  try {
    const product = await Product.findById(req.params.id).select('name description sellingPrice images');

    if (!product) {
      res.set('Content-Type', 'text/html');
      return res.status(404).send(renderMetaPage({
        title: 'Aramish – Shop Smarter',
        description: '100% Genuine Footwear',
        image: FALLBACK_IMAGE,
        url: productUrl
      }));
    }

    const image = toAbsoluteImageUrl(product.images && product.images[0]) || FALLBACK_IMAGE;
    const description = product.description
      ? String(product.description).slice(0, 200)
      : `Buy ${product.name} at ₹${product.sellingPrice} on Aramish`;

    res.set('Content-Type', 'text/html');
    res.send(renderMetaPage({
      title: `${product.name} | Aramish`,
      description,
      image,
      url: productUrl
    }));
  } catch (err) {
    res.set('Content-Type', 'text/html');
    res.status(500).send(renderMetaPage({
      title: 'Aramish – Shop Smarter',
      description: '100% Genuine Footwear',
      image: FALLBACK_IMAGE,
      url: productUrl
    }));
  }
});

module.exports = router;
