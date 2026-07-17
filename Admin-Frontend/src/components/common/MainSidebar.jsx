import React from 'react';
import { User, X, ChevronRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

const MainSidebar = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity" 
        onClick={onClose}
      />

      {/* Sidebar Content */}
      <div className="relative w-full max-w-[320px] bg-white h-full flex flex-col shadow-xl animate-in slide-in-from-left duration-300">
        {/* Header - Fixed at top */}
        <div className="bg-secondary text-white px-6 py-3 flex items-center gap-3 shrink-0 z-10 shadow-md">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <User size={24} className="text-white" />
          </div>
          <span className="text-lg font-bold">Hello, Shikha</span>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
          {/* Trending Section */}
          <div className="py-2.5 border-b border-gray-200">
            <h3 className="px-6 text-base font-bold text-gray-900 mb-1">Trending</h3>
            <ul className="space-y-0.5">
              {['Bestsellers', 'New Releases', 'Movers and Shakers'].map((item) => (
                <li key={item}>
                  <Link to="#" className="px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center justify-between group">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Digital Content Section */}
          <div className="py-2.5 border-b border-gray-200">
            <h3 className="px-6 text-base font-bold text-gray-900 mb-1">Digital Content and Devices</h3>
            <ul className="space-y-0.5">
              {[
                'Echo & Alexa', 
                'Fire TV', 
                'Kindle E-Readers & eBooks', 
                'Audible Audiobooks', 
                'Amazon Prime Video', 
                'Amazon Prime Music'
              ].map((item) => (
                <li key={item}>
                  <Link to="#" className="px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center justify-between group">
                    {item}
                    <ChevronRight size={18} className="text-gray-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Shop by Category Section */}
          <div className="py-2.5 border-b border-gray-200">
            <h3 className="px-6 text-base font-bold text-gray-900 mb-1">Shop by Category</h3>
            <ul className="space-y-0.5">
              {[
                'Mobiles, Computers', 
                'TV, Appliances, Electronics', 
                'Men\'s Fashion', 
                'Women\'s Fashion'
              ].map((item) => (
                <li key={item}>
                  <Link to="#" className="px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center justify-between group">
                    {item}
                    <ChevronRight size={18} className="text-gray-400" />
                  </Link>
                </li>
              ))}
              <li>
                <button className="w-full px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center gap-2">
                  See all <ChevronDown size={16} className="text-gray-500" />
                </button>
              </li>
            </ul>
          </div>

          {/* Programs & Features Section */}
          <div className="py-2.5 border-b border-gray-200">
            <h3 className="px-6 text-base font-bold text-gray-900 mb-1">Programs & Features</h3>
            <ul className="space-y-0.5">
              <li>
                <Link to="#" className="px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center justify-between group">
                  Gift Cards & Mobile Recharges
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>
              </li>
              {['Amazon Launchpad', 'Amazon Business', 'Handloom and Handicrafts'].map((item) => (
                <li key={item}>
                  <Link to="#" className="px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center justify-between group">
                    {item}
                  </Link>
                </li>
              ))}
              <li>
                <button className="w-full px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center gap-2">
                  See all <ChevronDown size={16} className="text-gray-500" />
                </button>
              </li>
            </ul>
          </div>

          {/* Help & Settings Section */}
          <div className="py-2.5">
            <h3 className="px-6 text-base font-bold text-gray-900 mb-1">Help & Settings</h3>
            <ul className="space-y-0.5">
              {['Your Account', 'Customer Service', 'Sign Out'].map((item) => (
                <li key={item}>
                  <Link to="#" className="px-6 py-2 text-[14px] text-gray-800 font-medium hover:bg-gray-100 flex items-center justify-between group">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="relative ml-2 mt-4 text-white hover:text-gray-200 h-fit"
      >
        <X size={36} strokeWidth={2} />
      </button>
    </div>
  );
};

export default MainSidebar;
