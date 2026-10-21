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

// Product data feed for Meta Commerce Manager (Catalog → Data sources → Data feed → scheduled URL).
// `id` is the product _id, matching the content_ids the Meta Pixel sends.
const csvCell = (val = '') => `"${String(val ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

router.get('/catalog-feed.csv', async (req, res) => {
  try {
    const products = await Product.find({ status: { $in: ['Approved', 'Out of Stock'] } })
      .select('name description sellingPrice mrp stock status images brandName category')
      .lean();

    const header = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type'];
    const rows = [header.join(',')];

    for (const p of products) {
      const images = (p.images || []).map(toAbsoluteImageUrl).filter(Boolean);
      if (!images.length) continue; // Meta rejects items without an image
      const mrp = Number(p.mrp) || Number(p.sellingPrice);
      const selling = Number(p.sellingPrice) || mrp;
      const inStock = p.status !== 'Out of Stock' && Number(p.stock) > 0;

      rows.push([
        p._id,
        String(p.name).slice(0, 150),
        String(p.description || p.name).slice(0, 5000),
        inStock ? 'in stock' : 'out of stock',
        'new',
        `${mrp.toFixed(2)} INR`,
        selling < mrp ? `${selling.toFixed(2)} INR` : '',
        `${SITE_URL}/product/${p._id}`,
        images[0],
        images.slice(1, 10).join(','),
        p.brandName || 'Aramish',
        p.category || ''
      ].map(csvCell).join(','));
    }

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(rows.join('\n'));
  } catch (err) {
    res.status(500).send('Failed to build catalog feed');
  }
});

module.exports = router;
