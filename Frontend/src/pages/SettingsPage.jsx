import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col font-sans pb-20">
      {/* Header */}
      <div className="bg-[#fff4f2] px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-surface rounded-full transition-colors active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 text-[#02006c]" />
        </button>
        <h1 className="text-lg font-bold text-[#02006c]">System Settings</h1>
      </div>
      
      <div className="p-4 flex flex-col items-center justify-center flex-1 text-slate-500">
        <p>System settings coming soon...</p>
      </div>
    </div>
  );
}
