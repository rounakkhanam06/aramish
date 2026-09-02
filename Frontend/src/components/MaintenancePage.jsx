import React from 'react';
import { Sparkles } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center select-none font-sans bg-surface animate-fade-in">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-[#0B132B] flex items-center justify-center shadow-lg">
          <Sparkles className="w-10 h-10 text-white animate-pulse" />
        </div>
      </div>

      <h1 className="text-2xl md:text-3xl font-black text-[#02006c] mb-3 nunito-heading">
        WE'RE PUTTING ON THE FINISHING TOUCHES
      </h1>
      <p className="text-sm text-slate-500 max-w-sm mb-2 leading-relaxed font-semibold">
        Our site is currently being upgraded to bring you a better experience.
      </p>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed font-semibold">
        Please check back soon. Thanks for your patience!
      </p>
    </div>
  );
}
