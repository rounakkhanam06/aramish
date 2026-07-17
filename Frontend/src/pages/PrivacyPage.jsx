import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ShieldCheck, Eye, Lock, Database, Share2, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sections = [
  {
    icon: Eye,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-500',
    title: 'Information We Collect',
    content:
      'We collect information you provide directly to us — such as your name, email address, phone number, delivery address, and payment details when you register, place an order, or contact us. We also automatically collect certain usage data like device type, browser, IP address, and pages visited to improve your experience.',
  },
  {
    icon: Database,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    title: 'How We Use Your Data',
    content:
      'Your data is used to process and fulfil your orders, personalise your shopping experience, send order confirmations and delivery updates, improve our platform, and provide customer support. We may also use anonymised data for analytics and to develop new features.',
  },
  {
    icon: Share2,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    title: 'Sharing of Information',
    content:
      'We do not sell or rent your personal information to third parties. We share your data only with trusted service providers (such as payment processors and logistics partners) who need it to deliver services on our behalf, and only under strict confidentiality agreements.',
  },
  {
    icon: Lock,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    title: 'Data Security',
    content:
      'We implement industry-standard security measures including SSL encryption, secure servers, and regular audits to protect your personal information from unauthorised access, disclosure, alteration, or destruction. However, no method of transmission over the internet is 100% secure.',
  },
  {
    icon: ShieldCheck,
    iconBg: 'bg-gold/10',
    iconColor: 'text-[#0B132B]',
    title: 'Cookies & Tracking',
    content:
      'We use cookies and similar technologies to remember your preferences, keep you logged in, and analyse how our platform is used. You can control cookies through your browser settings, though disabling them may affect some features of the app.',
  },
  {
    icon: UserX,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
    title: 'Your Rights',
    content:
      'You have the right to access, correct, or delete the personal data we hold about you. You may also opt out of marketing communications at any time. To exercise any of these rights, please contact us at privacy@aramish.com and we will respond within 30 days.',
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
        <h1 className="text-[#02006c] text-[20px] font-black tracking-tight">Privacy Policy</h1>
      </div>

      <div className="p-5 flex-grow space-y-6">

        {/* Intro Banner */}
        <div className="bg-gradient-to-br from-indigo-50 to-[#e8e8ff] rounded-2xl p-5 border border-indigo-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-[#02006c] font-black text-lg mb-1">Your Privacy Matters</h2>
            <p className="text-slate-600 text-xs font-medium max-w-[80%]">
              We are committed to protecting your personal data and being transparent about how we use it.
            </p>
          </div>
          <ShieldCheck className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-200/50 rotate-12" />
        </div>

        {/* Last Updated Badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-surface rounded-full text-[11px] font-bold text-slate-500 tracking-wide">
            Last updated: June 2025
          </span>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Policy Details</h3>

          <div className="bg-surface rounded-2xl shadow-sm border border-white/10 overflow-hidden">
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isOpen = openIndex === index;
              return (
                <div
                  key={index}
                  className={`border-b border-white/10 last:border-0 ${
                    isOpen ? 'bg-indigo-50/30' : 'hover:bg-surface'
                  } transition-colors`}
                >
                  <button
                    onClick={() => toggle(index)}
                    className="w-full text-left px-4 py-4 flex items-center gap-3 cursor-pointer"
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${section.iconBg} ${section.iconColor} transition-transform duration-300 ${isOpen ? 'scale-110' : ''}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Title */}
                    <span className={`flex-1 text-[13px] font-bold ${isOpen ? 'text-[#0B132B]' : 'text-[#02006c]'}`}>
                      {section.title}
                    </span>

                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-[#0B132B]' : ''
                      }`}
                    />
                  </button>

                  {/* Expandable Content */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="px-5 pb-4 text-[13px] text-slate-600 font-medium leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Note */}
        <div className="bg-surface rounded-2xl p-4 border border-white/10 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 bg-indigo-50 text-[#02006c] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-[#02006c] mb-0.5">Questions about privacy?</h4>
            <p className="text-[12px] text-slate-500 font-medium leading-snug">
              Reach out to us at{' '}
              <a href="mailto:privacy@aramish.com" className="text-[#0B132B] font-bold hover:underline">
                privacy@aramish.com
              </a>{' '}
              and our team will get back to you within 30 days.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
