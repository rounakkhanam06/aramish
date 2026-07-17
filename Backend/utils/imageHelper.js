const getImageUrl = (imagePath) => {
  if (!imagePath) return '';

  const path = String(imagePath).trim();

  // If it's already a complete URL, return as is
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

  const baseUrl = process.env.IMAGE_BASE_URL || process.env.BACKEND_URL || 'http://localhost:5000';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  return `${cleanBaseUrl}${cleanPath}`;
};

module.exports = { getImageUrl };
