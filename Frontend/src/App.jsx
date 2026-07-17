import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/layout/Layout';

// Lazy-loaded pages — each becomes its own JS chunk (code splitting)
const Home               = lazy(() => import('./pages/Home'));
const CategoriesPage     = lazy(() => import('./pages/CategoriesPage'));
const StudioPage         = lazy(() => import('./pages/StudioPage'));
const GamesPage          = lazy(() => import('./pages/GamesPage'));
const CartPage           = lazy(() => import('./pages/CartPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const WishlistPage       = lazy(() => import('./pages/WishlistPage'));
const OrdersPage         = lazy(() => import('./pages/OrdersPage'));
const CrazyDealsPage     = lazy(() => import('./pages/CrazyDealsPage'));
const ReviewOrderPage    = lazy(() => import('./pages/ReviewOrderPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const TopSelectionPage   = lazy(() => import('./pages/TopSelectionPage'));
const SimilarProductsPage= lazy(() => import('./pages/SimilarProductsPage'));
const HelpSupportPage    = lazy(() => import('./pages/HelpSupportPage'));
const PrivacyPage        = lazy(() => import('./pages/PrivacyPage'));
const TermsPage          = lazy(() => import('./pages/TermsPage'));
const AccountInfoPage    = lazy(() => import('./pages/AccountInfoPage'));
const SecurityPage       = lazy(() => import('./pages/SecurityPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const WalletPage         = lazy(() => import('./pages/WalletPage'));
const CouponsPage        = lazy(() => import('./pages/CouponsPage'));
const ReferEarnPage      = lazy(() => import('./pages/ReferEarnPage'));
const SavedAddressesPage = lazy(() => import('./pages/SavedAddressesPage'));
const TrackOrderPage     = lazy(() => import('./pages/TrackOrderPage'));
const OrderDetailsPage   = lazy(() => import('./pages/OrderDetailsPage'));
const BrandPage          = lazy(() => import('./pages/BrandPage'));

// Minimal route-level loading skeleton (shown while a page chunk loads)
const PageSkeleton = () => (
  <div className="flex-grow flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-gold/20 border-t-[#0B132B] animate-spin" />
      <p className="text-[11px] text-slate-400 font-medium">Loading…</p>
    </div>
  </div>
);

import './App.css';
import analytics from './utils/analytics';


function AppContent() {
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize analytics on app mount
  useEffect(() => {
    analytics.init();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    analytics.track('page_view', 'engagement', {
      path: location.pathname,
      search: location.search
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const protectedRoutes = ['/cart', '/wishlist', '/orders', '/games', '/refer', '/saved-addresses', '/wallet'];
    const isProtectedRoute = protectedRoutes.some(route => location.pathname.startsWith(route));

    if (!user && isProtectedRoute) {
      navigate('/login');
    } else if (user && location.pathname === '/login') {
      navigate('/');
    }
  }, [user, location.pathname, navigate]);

  return (
    <>
      <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
      <Layout>
      <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/brand/:brandId" element={<BrandPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/crazy-deals" element={<CrazyDealsPage />} />
        <Route path="/review-order" element={<ReviewOrderPage />} />
        <Route path="/product/:id" element={<ProductDetailsPage />} />
        <Route path="/similar-products" element={<SimilarProductsPage />} />
        <Route path="/top-selection" element={<TopSelectionPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/help" element={<HelpSupportPage />} />
        <Route path="/support" element={<HelpSupportPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/account" element={<AccountInfoPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/coupons" element={<CouponsPage />} />
        <Route path="/refer" element={<ReferEarnPage />} />
        <Route path="/saved-addresses" element={<SavedAddressesPage />} />
        <Route path="/track-order/:orderId" element={<TrackOrderPage />} />
        <Route path="/order-details/:orderId" element={<OrderDetailsPage />} />
        <Route path="/brand/:brandId" element={<BrandPage />} />
      </Routes>
      </Suspense>
    </Layout>
    </>
  );
}


function App() {
  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
}

export default App;
