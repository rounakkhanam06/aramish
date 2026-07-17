import { useState, useEffect } from 'react';

export function useDeviceType() {
  const [device, setDevice] = useState({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isWebView: false
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      
      // Detect webview
      const isWebView = /FBAN|FBAV|Instagram|LinkedInApp|Twitter|MicroMessenger|WebView|wv/i.test(ua) || 
        (window.android) || 
        (window.webkit && window.webkit.messageHandlers && Object.keys(window.webkit.messageHandlers).length > 0);

      setDevice({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        isWebView: !!isWebView
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return device;
}
