import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import Auth from '../pages/admin/Auth';
import Dashboard from '../pages/admin/Dashboard';
import ProductModeration from '../modules/admin/products/ProductModeration';
import CategoryManager from '../modules/admin/catalog/CategoryManager';
import BannerManager from '../modules/admin/catalog/BannerManager';
import CategoryChipsManager from '../modules/admin/catalog/CategoryChipsManager';
import SubCategoryChipsManager from '../modules/admin/catalog/SubCategoryChipsManager';
import HomeSectionsManager from '../modules/admin/catalog/HomeSectionsManager';
import InventoryList from '../pages/admin/inventory/InventoryList';
import ProductDetails from '../pages/admin/inventory/ProductDetails';

// New Admin Pages
import Analytics from '../pages/admin/Analytics';
import StockAlerts from '../pages/admin/inventory/StockAlerts';
import Orders from '../pages/admin/Orders';
import AddProduct from '../pages/admin/AddProduct';
import PlatformEarnings from '../pages/admin/finance/PlatformEarnings';
import Rules from '../pages/admin/Rules';
import TaxConfig from '../pages/admin/finance/TaxConfig';
import AllDeliveries from '../pages/admin/delivery/AllDeliveries';
import DeliveryApproval from '../pages/admin/delivery/DeliveryApproval';
import Settings from '../pages/admin/Settings';
import Users from '../pages/admin/Users';
import CustomerDetail from '../pages/admin/users/CustomerDetail';
import SubAdmins from '../pages/admin/system/SubAdmins';

// Promotions
import Coupons from '../pages/admin/promotions/Coupons';
import FlashSale from '../pages/admin/promotions/FlashSale';
import FeaturedProducts from '../pages/admin/promotions/FeaturedProducts';
import GameManager from '../pages/admin/promotions/GameManager';
import ReferralProgram from '../pages/admin/promotions/ReferralProgram';

// Comms
import Notifications from '../pages/admin/comms/Notifications';

// Content
import ReviewModeration from '../pages/admin/content/ReviewModeration';
import QnAModeration from '../pages/admin/content/QnAModeration';
import LegalPolicies from '../pages/admin/content/LegalPolicies';

// Operations
import Returns from '../pages/admin/operations/Returns';
import OrderDetail from '../pages/admin/operations/OrderDetail';

// Support
import Tickets from '../pages/admin/support/Tickets';

const AdminRoutes = () => {
  return (
    <Routes>
      <Route path="auth" element={<Auth />} />
      <Route path="login" element={<Navigate to="/admin/auth" replace />} />

      <Route element={<AdminLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:userId" element={<CustomerDetail />} />
        
        {/* Storefront & Catalog */}
        <Route path="products/moderation" element={<ProductModeration />} />
        <Route path="categories" element={<CategoryManager />} />
        <Route path="storefront/banners" element={<BannerManager />} />
        <Route path="storefront/chips" element={<CategoryChipsManager />} />
        <Route path="storefront/subchips" element={<SubCategoryChipsManager />} />
        <Route path="storefront/sections/:section" element={<HomeSectionsManager />} />
        
        {/* Business Ops */}
        <Route path="inventory/all" element={<InventoryList />} />
        <Route path="inventory/add" element={<AddProduct />} />
        <Route path="inventory/edit/:id" element={<AddProduct />} />
        <Route path="inventory/view/:id" element={<ProductDetails />} />
        <Route path="inventory/alerts" element={<StockAlerts />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:orderId" element={<OrderDetail />} />

        {/* Operations */}
        <Route path="operations/returns" element={<Returns />} />

        {/* Support */}
        <Route path="support/tickets" element={<Tickets />} />

        {/* Promotions */}
        <Route path="promotions/coupons" element={<Coupons />} />
        <Route path="promotions/flash-sale" element={<FlashSale />} />
        <Route path="promotions/featured" element={<FeaturedProducts />} />
        <Route path="promotions/games" element={<GameManager />} />
        <Route path="promotions/referrals" element={<ReferralProgram />} />

        {/* Comms */}
        <Route path="comms/notifications" element={<Notifications />} />

        {/* Content */}
        <Route path="content/reviews" element={<ReviewModeration />} />
        <Route path="content/qna" element={<QnAModeration />} />
        <Route path="content/legal" element={<LegalPolicies />} />
        
        {/* Delivery */}
        
        {/* Finance */}
        <Route path="finance/earnings" element={<PlatformEarnings />} />
        <Route path="finance/rules" element={<Rules />} />
        <Route path="finance/tax" element={<TaxConfig />} />
        
        {/* System */}
        <Route path="system/sub-admins" element={<SubAdmins />} />
        <Route path="settings" element={<Settings />} />
        
        <Route path="" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes;
