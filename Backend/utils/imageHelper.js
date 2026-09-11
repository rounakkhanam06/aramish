const getImagePath = (imagePath) => {
  if (!imagePath) return '';

  const path = String(imagePath).trim();

  // If the path contains 'uploads', extract the clean relative path starting from /uploads/
  const uploadsIdx = path.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    return path.substring(uploadsIdx);
  }
  const altUploadsIdx = path.indexOf('uploads/');
  if (altUploadsIdx !== -1) {
    return '/' + path.substring(altUploadsIdx);
  }

  // If it's an onrender URL (even without /uploads/), strip render domain
  if (path.includes('onrender.com') || path.includes('render.com')) {
    try {
      const urlObj = new URL(path);
      return urlObj.pathname + urlObj.search;
    } catch {
      return path.replace(/^https?:\/\/[^/]+/, '');
    }
  }

  // External complete URLs (Cloudinary, Unsplash, external CDNs, data URIs, blob URIs)
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }

  if (path.startsWith('www.')) {
    return `https://${path}`;
  }

  return path.startsWith('/') ? path : `/${path}`;
};

// getImageUrl returns clean relative path (or external CDN URL)
const getImageUrl = (imagePath) => {
  return getImagePath(imagePath);
};

module.exports = { getImagePath, getImageUrl };

