import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Heart, ShoppingCart } from 'lucide-react';

const HeaderTop = ({ cartCount = 0 }) => {
  return (
    <div className="px-3 py-1 flex items-center justify-between">
      {/* ── Logo ── */}
      <Link to="/vendor/home" className="flex items-center flex-shrink-0">
        <motion.img
          src="/HopeFinal.webp"
          alt="Cocia"
          className="h-10 w-28 object-contain object-left"
          whileTap={{ scale: 0.95 }}
        />
      </Link>

      {/* ── Action Icons ── */}
      <div className="flex items-center gap-0 flex-shrink-0">
        <motion.div whileTap={{ scale: 0.82 }}>
          <Link to="/vendor/notifications" aria-label="Notifications" className="p-1.5 block">
            <Bell size={20} strokeWidth={1.8} className="text-gray-700" />
          </Link>
        </motion.div>

        <motion.div whileTap={{ scale: 0.82 }}>
          <Link to="/vendor/wishlist" aria-label="Wishlist" className="p-1.5 block">
            <Heart size={20} strokeWidth={1.8} className="text-gray-700" />
          </Link>
        </motion.div>

        <motion.div whileTap={{ scale: 0.82 }}>
          <Link to="/vendor/cart" aria-label="Cart" className="relative p-1.5 block">
            <ShoppingCart size={20} strokeWidth={1.8} className="text-gray-700" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 text-[8px] font-black min-w-[14px] h-3.5 rounded-full bg-[#2874F0] text-white flex items-center justify-center shadow-sm">
                {cartCount}
              </span>
            )}
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default HeaderTop;
