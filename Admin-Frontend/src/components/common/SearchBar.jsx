import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Camera, ScanLine, X, MapPin, ChevronDown } from 'lucide-react';

/**
 * SearchBar — Address selector (top) + Search input (bottom)
 * Both fields have the same rounded design
 */
const SearchBar = ({ selectedAddress }) => {
  const navigate = useNavigate();
  const [query,   setQuery]   = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (query.trim()) navigate(`/vendor/search?q=${encodeURIComponent(query.trim())}`);
  };

  const shortAddress = selectedAddress?.address
    ? selectedAddress.address.slice(0, 40) + '...'
    : 'Select delivery address...';

  return (
    <div className="px-3 pb-2 flex flex-col gap-1.5">

      {/* ── Delivery Address Field (Compact) ── */}
      <motion.div whileTap={{ scale: 0.98 }} className="w-full">
        <Link
          to="/vendor/profile/addresses"
          className="flex items-center gap-2 bg-[#2874F0] rounded-xl px-3 py-1.5 w-full"
        >
          <MapPin size={14} strokeWidth={2.5} className="text-white flex-shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">HOME</span>
            <span className="text-[12px] text-white font-medium truncate opacity-90">
              {shortAddress}
            </span>
          </div>
          <ChevronDown size={14} strokeWidth={3} className="text-white flex-shrink-0" />
        </Link>
      </motion.div>

      {/* ── Search + Scan Field ── */}
      <div className="flex items-center gap-2">
        <motion.form
          onSubmit={handleSubmit}
          animate={{ scale: searchFocused ? 1.002 : 1 }}
          className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200"
          style={{
            borderColor: searchFocused ? '#2874F0' : '#e5e7eb',
          }}
        >
          <Search size={16} strokeWidth={2.5} className="text-gray-400 flex-shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search products..."
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-gray-400 text-gray-800 font-medium min-w-0"
          />
          <Camera size={18} strokeWidth={2} className="text-gray-400" />
        </motion.form>

        <motion.button
          whileTap={{ scale: 0.92 }}
          className="p-2.5 bg-white rounded-xl border border-gray-200 flex-shrink-0"
        >
          <ScanLine size={18} strokeWidth={2} className="text-[#2874F0]" />
        </motion.button>
      </div>
    </div>
  );
};

export default SearchBar;
