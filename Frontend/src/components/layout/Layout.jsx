import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import MobileNav from './MobileNav';
import { useApp } from '../../context/AppContext';
import { useDeviceType } from '../../utils/useDeviceType';

import { clearAllCache } from '../../utils/apiCache';

export default function Layout({ children }) {
  const location = useLocation();
  const { globalToast } = useApp();
  const { isMobile } = useDeviceType();

  // Detect when mobile virtual keyboard is open (viewport height shrinks)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  useEffect(() => {
    let initialHeight = window.innerHeight;
    let initialWidth = window.innerWidth;

    const checkKeyboard = () => {
      // If width changed, it's likely an orientation change, so reset initial height
      if (window.innerWidth !== initialWidth) {
        initialWidth = window.innerWidth;
        initialHeight = window.innerHeight;
      }
      const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setIsKeyboardOpen(initialHeight - currentHeight > 150);
    };

    window.addEventListener('resize', checkKeyboard);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkKeyboard);
    }

    return () => {
      window.removeEventListener('resize', checkKeyboard);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkKeyboard);
      }
    };
  }, []);

  // Disable browser native scroll restoration so back/forward never restores old position
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // NOTE: scroll-to-top is handled via key={location.pathname} on <main> below,
  // which forces React to unmount+remount the scroll container on every route change.

  const isLoginPage = location.pathname.toLowerCase().startsWith('/login');
  const isSearchPage = location.pathname.toLowerCase().startsWith('/search');
  
  // Mobile-specific visibility logic
  const hideNavbarMobile = isLoginPage || 
                           isSearchPage ||
                           location.pathname.toLowerCase().startsWith('/studio') ||
                           location.pathname.toLowerCase().startsWith('/profile') || 
                           location.pathname.toLowerCase().startsWith('/categories') || 
                           location.pathname.toLowerCase().startsWith('/wishlist') ||
                           location.pathname.toLowerCase().startsWith('/orders') ||
                           location.pathname.toLowerCase().startsWith('/cart') ||
                           location.pathname.toLowerCase().startsWith('/games') ||
                           location.pathname.toLowerCase().startsWith('/crazy-deals') ||
                           location.pathname.toLowerCase().startsWith('/product') ||
                           location.pathname.toLowerCase().startsWith('/similar-products') ||
                           location.pathname.toLowerCase().startsWith('/top-selection') ||
                           location.pathname.toLowerCase().startsWith('/help') ||
                           location.pathname.toLowerCase().startsWith('/support') ||
                           location.pathname.toLowerCase().startsWith('/privacy') ||
                           location.pathname.toLowerCase().startsWith('/account') ||
                           location.pathname.toLowerCase().startsWith('/security') ||
                           location.pathname.toLowerCase().startsWith('/settings') ||
                           location.pathname.toLowerCase().startsWith('/wallet') ||
                           location.pathname.toLowerCase().startsWith('/coupons') ||
                           location.pathname.toLowerCase().startsWith('/refer') ||
                           location.pathname.toLowerCase().startsWith('/track-order') ||
                           location.pathname.toLowerCase().startsWith('/order-details') ||
                           location.pathname.toLowerCase().startsWith('/saved-addresses') ||
                           location.pathname.toLowerCase().startsWith('/review-order');

  const hideMobileNavMobile = isLoginPage || 
                              isSearchPage ||
                              location.pathname.toLowerCase().startsWith('/studio') || 
                              location.pathname.toLowerCase().startsWith('/profile') || 
                              location.pathname.toLowerCase().startsWith('/review-order') || 
                              location.pathname.toLowerCase().startsWith('/product') || 
                              location.pathname.toLowerCase().startsWith('/account') || 
                              location.pathname.toLowerCase().startsWith('/security') || 
                              location.pathname.toLowerCase().startsWith('/settings') || 
                              location.pathname.toLowerCase().startsWith('/wallet') || 
                              location.pathname.toLowerCase().startsWith('/coupons') || 
                              location.pathname.toLowerCase().startsWith('/refer') || 
                              location.pathname.toLowerCase().startsWith('/track-order') || 
                              location.pathname.toLowerCase().startsWith('/order-details') || 
                              location.pathname.toLowerCase().startsWith('/saved-addresses') || 
                              location.pathname.toLowerCase().startsWith('/cart') || 
                              location.pathname.toLowerCase().startsWith('/support') || 
                              location.pathname.toLowerCase().startsWith('/privacy');

  // Desktop/Tablet overrides:
  // - Show Top Navbar on all pages except login, studio, and search
  // - Hide Bottom MobileNav on all pages
  const isStudioPage = location.pathname.toLowerCase().startsWith('/studio');
  const hideNavbar = isMobile ? hideNavbarMobile : (isLoginPage || isStudioPage || isSearchPage);
  const hideMobileNav = isMobile ? hideMobileNavMobile : true;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    setPullDistance(0);
    setIsRefreshing(false);
    setIsPulling(false);
  }, [location.pathname]);

  const isFixedLayoutPage = isStudioPage || location.pathname.toLowerCase().startsWith('/categories');

  const getActiveScrollTop = (target) => {
    let el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight) {
        const overflow = window.getComputedStyle(el).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
          return el.scrollTop;
        }
      }
      el = el.parentElement;
    }
    const container = document.getElementById('main-scroll-container');
    return container ? container.scrollTop : window.scrollY;
  };

  const handleTouchStart = (e) => {
    if (isRefreshing || isStudioPage) return;
    
    // Disable web-side pull-to-refresh if running inside a WebView or standalone PWA app.
    // This allows the native Flutter RefreshIndicator to handle refreshing without double-trigger conflicts.
    const isAppShell = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone ||
      /wv|WebView|InAppWebView|Flutter/i.test(window.navigator.userAgent)
    );
    if (isAppShell) return;

    const scrollTop = getActiveScrollTop(e.target);
    if (scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diffY = currentY - startY;

    if (diffY > 0) {
      const distance = Math.min(diffY * 0.4, 70); // Max 70px pull
      setPullDistance(distance);
      
      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling || isRefreshing) return;
    
    setIsPulling(false);
    if (pullDistance >= 50) {
      setIsRefreshing(true);
      setPullDistance(50);
      
      // Clear all cached responses so page reload fetches fresh data
      clearAllCache();
      
      setTimeout(() => {
        // Use a cache-busting search parameter to force a full reload and bypass service worker cache
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('refresh', Date.now().toString());
          window.location.href = url.toString();
        } catch (err) {
          window.location.reload();
        }
      }, 700);

      // Safety fallback to clear the loading spinner if reload hangs
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 2500);
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div className="min-h-screen md:h-auto bg-surface text-slate-800 antialiased font-sans overflow-x-hidden">
      <div className={`w-full ${isFixedLayoutPage ? 'h-[100dvh] md:h-[100dvh]' : 'h-[100dvh] md:h-auto md:min-h-screen'} bg-surface md:bg-transparent flex flex-col relative ${(hideMobileNav || isKeyboardOpen) ? 'pb-0' : 'pb-16 md:pb-0'}`}>
        <main 
          key={location.pathname}
          id="main-scroll-container" 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`flex-grow flex flex-col bg-surface md:bg-transparent relative scrollbar-none ${isFixedLayoutPage ? 'overflow-hidden' : 'overflow-y-auto md:overflow-y-visible overflow-x-hidden'}`}
        >
          {pullDistance > 0 && (
            <div 
              style={{ 
                transform: `translate(-50%, ${pullDistance - 15}px)`, 
                opacity: Math.min(pullDistance / 40, 1) 
              }} 
              className="absolute left-1/2 bg-surface rounded-full shadow-md border border-white/10 w-10 h-10 flex items-center justify-center z-[100] transition-transform duration-75"
            >
              <div 
                className={`w-5 h-5 rounded-full border-2 border-[#0B132B] border-t-transparent ${isRefreshing ? 'animate-spin' : ''}`} 
                style={{ transform: isRefreshing ? 'none' : `rotate(${pullDistance * 5}deg)` }}
              />
            </div>
          )}
          {!hideNavbar && (
            <div className="hidden md:block w-full bg-[#0B132B] border-b border-white/5 py-2 overflow-hidden select-none marquee-container relative z-40">
              <div className="animate-marquee flex items-center gap-8 text-[11px] font-bold text-amber-400 tracking-wider uppercase font-sans">
                <span>Download the Aramish App, Login & Get 1000 Welcome Coins. Use up to 250 Coins per order and earn 100 Coins on every successful order.</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/50 flex-shrink-0" />
                <span>Download the Aramish App, Login & Get 1000 Welcome Coins. Use up to 250 Coins per order and earn 100 Coins on every successful order.</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/50 flex-shrink-0" />
              </div>
            </div>
          )}
          {!hideNavbar && <Navbar />}
          {children}
        </main>
        {!hideMobileNav && !isKeyboardOpen && <MobileNav />}

        {/* Global Toast Message */}
        {globalToast && (
          <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] font-bold px-4 py-2 rounded-full shadow-lg z-[100] animate-fade-in whitespace-nowrap">
            {globalToast}
          </div>
        )}
      </div>
    </div>
  );
}
