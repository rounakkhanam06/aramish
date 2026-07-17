import React, { useState, useEffect, useRef } from 'react';

/**
 * LazySection
 * Lightweight component that defers rendering of its children until they scroll
 * near the viewport, saving CPU cycles and DOM node overhead on mobile WebView.
 */
export default function LazySection({ children, placeholderHeight = '150px', className = '' }) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Load slightly ahead of scroll for smooth feel
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={!isIntersecting ? { minHeight: placeholderHeight } : undefined}>
      {isIntersecting ? children : null}
    </div>
  );
}
