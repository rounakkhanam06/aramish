import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center select-none font-sans bg-slate-50 animate-fade-in">
      <div className="relative mb-6">
        <div className="text-8xl md:text-9xl font-extrabold text-slate-200 tracking-wider">404</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <ShieldAlert className="w-16 h-16 text-rose-500 animate-pulse" />
        </div>
      </div>
      
      <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-wide">
        Administrative Page Not Found
      </h2>
      <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed font-semibold">
        The panel, setting, or resource page you are trying to access does not exist or has been relocated.
      </p>

      <button
        onClick={() => navigate('/admin/dashboard')}
        className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-sm font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </button>
    </div>
  );
}
