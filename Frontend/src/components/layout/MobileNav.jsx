import React from 'react';
import { Home, LayoutGrid, Camera, Gamepad2, ShoppingCart, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { motion } from 'framer-motion';

export default function MobileNav() {
  const { totalCartItems, user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/categories')) return 'categories';
    if (path.startsWith('/studio')) return 'studio';
    if (path.startsWith('/games')) return 'games';
    if (path.startsWith('/cart')) return 'cart';
    if (path.startsWith('/profile') || path.startsWith('/login')) return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'categories', label: 'Categories', icon: LayoutGrid, path: '/categories' },
    // { id: 'games', label: 'Fun', icon: Gamepad2, path: '/games' },
    // { id: 'studio', label: 'Studio', icon: Camera, path: '/studio' },
    { id: 'cart', label: 'Cart', icon: ShoppingCart, path: '/cart', badge: true },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' }
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 w-full bg-surface/90 backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] border-t border-white/60 rounded-t-[2rem] md:hidden">
      <nav className="flex items-center justify-between px-2 py-2.5 w-full mx-auto pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center flex-1 max-w-[64px] h-[54px] rounded-2xl outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] active:scale-95 transition-transform duration-200"
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav-pill"
                  className="absolute inset-0 bg-[#FFF0ED] border border-[#0B132B]/20 shadow-[0_4px_12px_rgba(238,73,35,0.08)] rounded-2xl -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <div className={`transition-all duration-300 ${
                isActive 
                  ? 'text-[#0B132B] -translate-y-0.5 scale-110' 
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}>
                <Icon className={`w-5.5 h-5.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
              </div>

              <span className={`text-[10px] tracking-wide transition-all duration-300 ${
                isActive 
                  ? 'text-[#0B132B] font-black mt-0.5' 
                  : 'text-[#64748B] font-semibold mt-1'
              }`}>
                {item.label}
              </span>

              {/* Red Badge for Cart */}
              {item.badge && totalCartItems > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#0B132B] text-[9px] font-bold text-white ring-2 ring-white shadow-sm">
                  {totalCartItems}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

