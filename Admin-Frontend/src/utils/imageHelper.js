export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';

  let path = String(imagePath).trim();

  // If the path contains 'uploads', normalize it to the current environment's API base URL
  if (path.includes('uploads')) {
    const isLocal = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('gitpod') ||
        window.location.hostname.includes('devtunnels.ms') ||
        /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname));

    let baseUrl = '';
    if (isLocal) {
      baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    } else {
      baseUrl = import.meta.env.VITE_IMAGE_BASE_URL || import.meta.env.VITE_API_URL || 'https://aramishworld.com';
    }

    // Extract the relative uploads path from any absolute URL
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
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${cleanPath}`;
  }

  // If it is already a complete URL, return as is
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

  // Local frontend assets should not be prepended with base URL
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

  return path;
};
