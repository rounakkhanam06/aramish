import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getImageUrl } from '../../utils/imageHelper';
import { Image } from 'lucide-react';

/**
 * OptimizedImage – A reusable image component with:
 *   • Native lazy loading (loading="lazy")
 *   • Skeleton shimmer or gradient pulse placeholder while loading
 *   • Error fallback (per image type, showing a clean placeholder for products)
 *   • Auto URL resolution for relative uploads paths
 */

// Category-specific gradient fallbacks (colourful so nothing looks blank)
const FALLBACK_GRADIENTS = {
  banner:     'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  category:   'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  product:    '#f8fafc',
  subcategory:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  default:    'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
};

// Max display width per image type; Cloudinary resizes to this (2x for retina screens)
const CLOUDINARY_WIDTHS = {
  banner:      1600,
  category:    300,
  product:     500,
  subcategory: 300,
  default:     800,
};

const isCloudinaryUrl = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/image/upload/');

// Inserts f_auto,q_auto,w_<n> so Cloudinary serves a smaller, modern-format image.
// Cloudinary URLs are versioned (/v123/), so no cache-busting is needed.
const optimizeCloudinaryUrl = (url, type) => {
  const [base, rest] = url.split('/image/upload/');
  const firstSegment = rest.split('/')[0];
  // Leave URLs that already carry a transformation (e.g. w_300,c_fill) untouched
  if (/^[a-z]{1,3}_[^/]*/.test(firstSegment)) return url;
  const width = CLOUDINARY_WIDTHS[type] || CLOUDINARY_WIDTHS.default;
  return `${base}/image/upload/f_auto,q_auto,w_${width},c_limit/${rest}`;
};

export default function OptimizedImage({
  src,
  alt = '',
  className = '',
  style = {},
  type = 'default',  // 'banner' | 'category' | 'product' | 'subcategory'
  objectFit,
  onLoad,
  onError,
  fetchPriority, // 'high' | 'low' | 'auto'
  ...props
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  const resolvedSrc = useMemo(() => {
    let url = getImageUrl(src);
    if (isCloudinaryUrl(url)) return optimizeCloudinaryUrl(url, type);
    if (url && type === 'banner' && !url.startsWith('data:') && !url.startsWith('blob:')) {
      const hasQuery = url.includes('?');
      return `${url}${hasQuery ? '&' : '?'}v=${Date.now()}`;
    }
    return url;
  }, [src, type]);

  // A src that changes after a prior load failure (e.g. a freshly uploaded profile
  // photo replacing a broken/missing one) must clear the stale error/loaded state,
  // otherwise this component keeps rendering the old fallback forever.
  // Done during render (not in an effect) so it can never run after the new image's
  // load event and hide an image that has already loaded.
  const [prevSrc, setPrevSrc] = useState(resolvedSrc);
  if (prevSrc !== resolvedSrc) {
    setPrevSrc(resolvedSrc);
    setLoaded(false);
    setError(false);
  }

  // Cached images can finish loading before React attaches onLoad, so the event
  // is never delivered. Read the element's state directly to catch that case.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth > 0) setLoaded(true);
    else setError(true);
  }, [resolvedSrc]);

  const fallback = FALLBACK_GRADIENTS[type] || FALLBACK_GRADIENTS.default;
  const finalObjectFit = objectFit || (type === 'product' ? 'contain' : 'cover');

  if (error || !resolvedSrc) {
    if (type === 'product') {
      return (
        <div
          className={`flex flex-col items-center justify-center text-slate-350 bg-surface border border-white/10 rounded-xl ${className}`}
          style={{
            width: '100%',
            height: '100%',
            aspectRatio: '1/1',
            ...style,
          }}
          aria-label={alt}
          {...props}
        >
          <Image className="w-6 h-6 stroke-[1.5]" />
          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-1">No Image</span>
        </div>
      );
    }

    return (
      <div
        className={className}
        style={{
          background: fallback,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
        aria-label={alt}
        {...props}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={style}
      {...props}
    >
      {/* Skeleton Shimmer / Gradient pulse placeholder shown while loading */}
      {!loaded && (
        <div
          className="absolute inset-0 skeleton-shimmer z-10"
        />
      )}

      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        loading={fetchPriority === 'high' ? 'eager' : 'lazy'}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setError(true);
          onError?.(e);
        }}
        className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ objectFit: finalObjectFit, objectPosition: 'center' }}
      />
    </div>
  );
}


