import React, { useState, useEffect } from 'react';
import { ChevronLeft, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Splits the admin-authored plain-text policy into blocks — a line like "1. USER ACCOUNTS"
// becomes a heading, everything else is rendered as a paragraph.
const parseContent = (raw) => {
  if (!raw) return [];
  const lines = raw.split('\n');
  const blocks = [];
  let currentParagraph = [];

  const flushParagraph = () => {
    const text = currentParagraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    currentParagraph = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      return;
    }
    if (/^\d+\.\s+\S+/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      flushParagraph();
      blocks.push({ type: 'heading', text: trimmed });
    } else {
      currentParagraph.push(trimmed);
    }
  });
  flushParagraph();

  return blocks;
};

export default function TermsPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/content/legal`);
        const data = await res.json();
        if (res.ok && data.success) {
          setContent(data.terms || '');
        }
      } catch (err) {
        console.error('Failed to load terms & conditions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  const blocks = parseContent(content);

  return (
    <div className="bg-surface min-h-[100dvh] font-sans animate-fade-in flex flex-col">

      {/* Header */}
      <div className="bg-surface px-4 py-4 shadow-sm z-50 sticky top-0 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-[#02006c] hover:bg-surface active:scale-95 transition-all cursor-pointer shadow-sm flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[#02006c] text-[20px] font-black tracking-tight">Terms & Conditions</h1>
      </div>

      <div className="p-5 flex-grow space-y-6">

        {/* Intro Banner */}
        <div className="bg-gradient-to-br from-indigo-50 to-[#e8e8ff] rounded-2xl p-5 border border-indigo-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-[#02006c] font-black text-lg mb-1">Our Terms of Service</h2>
            <p className="text-slate-600 text-xs font-medium max-w-[85%]">
              Please read these terms and conditions carefully before using our services.
            </p>
          </div>
          <Scale className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-200/50 rotate-12" />
        </div>

        {/* Content */}
        <div className="bg-surface rounded-2xl shadow-sm border border-white/10 p-5 space-y-4">
          {loading ? (
            <p className="text-[13px] text-slate-400 font-medium">Loading terms...</p>
          ) : blocks.length === 0 ? (
            <p className="text-[13px] text-slate-400 font-medium">Terms content is not available right now.</p>
          ) : (
            blocks.map((block, index) =>
              block.type === 'heading' ? (
                <h3 key={index} className="text-[13px] font-black text-[#02006c] pt-2">
                  {block.text}
                </h3>
              ) : (
                <p key={index} className="text-[13px] text-slate-600 font-medium leading-relaxed">
                  {block.text}
                </p>
              )
            )
          )}
        </div>

        {/* Contact Note */}
        <div className="bg-surface rounded-2xl p-4 border border-white/10 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 bg-indigo-50 text-[#02006c] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-[#02006c] mb-0.5">Questions about our Terms?</h4>
            <p className="text-[12px] text-slate-500 font-medium leading-snug">
              Reach out to us at{' '}
              <a href="mailto:support@aramish.com" className="text-[#0B132B] font-bold hover:underline">
                support@aramish.com
              </a>{' '}
              if you have any queries.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
