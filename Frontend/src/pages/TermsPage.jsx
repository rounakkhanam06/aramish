import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, Scale, BookOpen, ShieldCheck, ShoppingBag, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sections = [
  {
    icon: BookOpen,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-500',
    title: '1. Agreement to Terms',
    content:
      'By accessing or using Aramish, you agree to be bound by these Terms & Conditions and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.',
  },
  {
    icon: ShieldCheck,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
    title: '2. User Accounts',
    content:
      'When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.',
  },
  {
    icon: ShoppingBag,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    title: '3. Purchases & Payments',
    content:
      'If you wish to purchase any product made available through the Service, you may be asked to supply certain information relevant to your Purchase including, without limitation, your credit card number, expiration date, billing address, and shipping information.',
  },
  {
    icon: Scale,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    title: '4. Intellectual Property',
    content:
      'The Service and its original content, features, and functionality are and will remain the exclusive property of Aramish and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without prior written consent.',
  },
  {
    icon: AlertTriangle,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
    title: '5. Limitation of Liability',
    content:
      'In no event shall Aramish, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.',
  },
  {
    icon: FileText,
    iconBg: 'bg-gold/10',
    iconColor: 'text-[#0B132B]',
    title: '6. Changes to Terms',
    content:
      'We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.',
  },
];

export default function TermsPage() {
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

        {/* Last Updated Badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-surface rounded-full text-[11px] font-bold text-slate-500 tracking-wide">
            Last updated: June 2025
          </span>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Terms Details</h3>

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
