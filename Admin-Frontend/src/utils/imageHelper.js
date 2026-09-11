export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';

  let path = String(imagePath).trim();

  // If the path contains 'uploads', extract and normalize the relative uploads path
  if (path.includes('uploads')) {
    let relativePath = path;
    const uploadsIdx = path.indexOf('/uploads/');
    if (uploadsIdx !== -1) {
      relativePath = path.substring(uploadsIdx);
    } else {
      const uploadsIdxAlt = path.indexOf('uploads/');
      if (uploadsIdxAlt !== -1) {
        relativePath = '/' + path.substring(uploadsIdxAlt);
      }
    }

    const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    // Optional custom image base URL (NEVER use Render URL or VITE_API_URL fallback)
    const customBase = import.meta.env.VITE_IMAGE_BASE_URL;
    if (customBase && typeof customBase === 'string' && !customBase.includes('onrender.com') && !customBase.includes('render.com')) {
      const cleanBase = customBase.endsWith('/') ? customBase.slice(0, -1) : customBase;
      return `${cleanBase}${cleanPath}`;
    }

    // In production or local (with dev proxy), use clean relative image path directly
    return cleanPath;
  }

  // Strip any Render domain URL if present
  if (path.includes('onrender.com') || path.includes('render.com')) {
    try {
      const parsed = new URL(path);
      return parsed.pathname + parsed.search;
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

  // If it starts with www.
  if (path.startsWith('www.')) {
    return `https://${path}`;
  }

  // Local frontend assets
  if (
    path.startsWith('/src/') ||
    path.startsWith('/assets/') ||
    path.startsWith('src/') ||
    path.startsWith('assets/') ||
    path.startsWith('/aramish-logo.png') ||
    path.includes('categoryForU') ||
    path.includes('Category')
  ) {
    return path;
  }

  return path.startsWith('/') ? path : `/${path}`;
};
