import React from 'react';
import { Gift, ShieldCheck, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0F172A] text-slate-400 py-12 px-6 mt-16 border-t border-slate-800 text-sm mb-16 md:mb-0 select-none">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-8">
          {/* Brand Block */}
          <div className="space-y-4 md:col-span-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0B132B] rounded-full flex items-center justify-center text-white">
                <Gift className="w-4 h-4" />
              </div>
              <span className="text-white font-extrabold text-lg tracking-tight">Aramish <span className="text-[#0B132B]">World</span></span>
            </div>
            <p className="text-xs leading-relaxed max-w-sm">
              Aramish is your premium online gifting destination, offering beautifully curated teddy bears, RC cars, pendants, and customized gift bundles that surprise, delight, and express your deepest feelings.
            </p>
          </div>

          {/* Quick links Grid */}
          <div className="grid grid-cols-2 gap-6 text-xs md:col-span-4">
            <div className="space-y-3">
              <h4 className="text-white font-bold uppercase tracking-wider text-[10px]">Categories</h4>
              <ul className="space-y-2 text-slate-400 font-medium">
                <li><a href="#/categories?cat=gifting" className="hover:text-[#0B132B] transition-colors">Gift Hampers</a></li>
                <li><a href="#/categories?cat=toys" className="hover:text-[#0B132B] transition-colors">Teddy Bears & Plush</a></li>
                <li><a href="#/categories?cat=electronics" className="hover:text-[#0B132B] transition-colors">RC Toys & Gadgets</a></li>
                <li><a href="#/categories?cat=jewellery" className="hover:text-[#0B132B] transition-colors">Sterling Pendants</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-white font-bold uppercase tracking-wider text-[10px]">Company</h4>
              <ul className="space-y-2 text-slate-400 font-medium">
                <li><a href="#" className="hover:text-[#0B132B] transition-colors">About Aramish</a></li>
                <li><a href="#/privacy" className="hover:text-[#0B132B] transition-colors">Privacy Policy</a></li>
                <li><a href="#/terms" className="hover:text-[#0B132B] transition-colors">Terms of Service</a></li>
                <li><a href="#/support" className="hover:text-[#0B132B] transition-colors">Support Center</a></li>
              </ul>
            </div>
          </div>

          {/* Trust Stamp */}
          <div className="md:col-span-3 space-y-3 flex flex-col justify-center">
            <div className="flex items-start gap-2.5 bg-slate-800/30 p-4 rounded-xl border border-slate-800/80">
              <ShieldCheck className="w-5 h-5 text-[#0B132B] flex-shrink-0 mt-0.5" />
              <span className="text-[11px] leading-snug">
                100% Buyer Protection Guarantee. Payments processed using grade-A secure transaction gateways.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-slate-800/80 pt-6 text-center text-[10px] space-y-1.5 text-slate-500">
          <p>© {new Date().getFullYear()} Aramish Private Limited. All rights reserved.</p>
          <p className="flex items-center justify-center gap-1 font-medium">
            Made with <Heart className="w-3 h-3 text-rose-500 fill-current animate-pulse" /> for special moments.
          </p>
        </div>
      </div>
    </footer>
  );
}

