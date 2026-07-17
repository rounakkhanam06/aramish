import React, { useState } from 'react';
import {
  Truck, Plus, CheckCircle2, XCircle, Settings, Zap, Globe,
  Shield, Clock, Package, ArrowUpRight, ExternalLink, ToggleLeft,
  ToggleRight, Copy, Eye, EyeOff, RefreshCw, AlertCircle, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DELIVERY_SERVICES = [
  {
    id: 'shiprocket',
    name: 'Shiprocket',
    logo: '🚀',
    description: 'India\'s #1 e-commerce shipping solution. Covers 24,000+ pincodes across India.',
    features: ['24K+ Pincodes', 'Multi-carrier', 'Real-time tracking', 'COD support', 'Returns management'],
    pricing: 'Starting ₹25/500g',
    website: 'https://shiprocket.in',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    badge: 'Most Popular',
    badgeColor: 'bg-blue-500',
    avgDelivery: '2-5 days',
    connected: true,
    apiKey: 'sr_live_••••••••••••3f8a',
    status: 'Active',
  },
  {
    id: 'delhivery',
    name: 'Delhivery',
    logo: '📦',
    description: 'India\'s leading fully-integrated logistics company with express and surface delivery.',
    features: ['18K+ Pincodes', 'Same-day delivery', 'Warehousing', 'Weight-based pricing', 'API integration'],
    pricing: 'Starting ₹30/500g',
    website: 'https://delhivery.com',
    color: 'from-red-500 to-pink-500',
    bg: 'bg-red-50',
    border: 'border-red-100',
    badge: 'Fast Delivery',
    badgeColor: 'bg-green-500',
    avgDelivery: '1-3 days',
    connected: false,
    apiKey: '',
    status: 'Not Connected',
  },
  {
    id: 'bluedart',
    name: 'Blue Dart',
    logo: '💙',
    description: 'South Asia\'s premier express air and integrated transportation & distribution.',
    features: ['Air express', 'Doorstep delivery', 'Time-definite', 'Heavy shipments', 'Premium service'],
    pricing: 'Starting ₹45/500g',
    website: 'https://bluedart.com',
    color: 'from-blue-600 to-indigo-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    badge: 'Premium',
    badgeColor: 'bg-indigo-500',
    avgDelivery: '1-2 days',
    connected: false,
    apiKey: '',
    status: 'Not Connected',
  },
  {
    id: 'ecomexpress',
    name: 'Ecom Express',
    logo: '⚡',
    description: 'Technology-enabled end-to-end logistics solutions for e-commerce businesses.',
    features: ['25K+ Pincodes', 'Sunday delivery', 'Reverse logistics', 'Bulk shipping', 'API support'],
    pricing: 'Starting ₹28/500g',
    website: 'https://ecomexpress.in',
    color: 'from-yellow-500 to-orange-400',
    bg: 'bg-yellow-50',
    border: 'border-yellow-100',
    badge: 'Wide Coverage',
    badgeColor: 'bg-amber-500',
    avgDelivery: '2-4 days',
    connected: false,
    apiKey: '',
    status: 'Not Connected',
  },
  {
    id: 'xpressbees',
    name: 'Xpressbees',
    logo: '🐝',
    description: 'Next-gen logistics company offering hyperlocal, inter-city, and cross-border delivery.',
    features: ['20K+ Pincodes', 'COD facility', 'Reverse pickup', 'NDR management', 'Hyperlocal'],
    pricing: 'Starting ₹27/500g',
    website: 'https://xpressbees.com',
    color: 'from-amber-500 to-yellow-400',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    badge: 'Hyperlocal',
    badgeColor: 'bg-orange-500',
    avgDelivery: '2-5 days',
    connected: false,
    apiKey: '',
    status: 'Not Connected',
  },
  {
    id: 'dunzo',
    name: 'Dunzo for Business',
    logo: '🏃',
    description: 'Hyperlocal delivery solution for same-day and scheduled last-mile deliveries.',
    features: ['Same-day', 'Scheduled slots', 'Local delivery', 'Real-time tracking', 'API integration'],
    pricing: 'Starting ₹50/delivery',
    website: 'https://business.dunzo.com',
    color: 'from-green-500 to-teal-500',
    bg: 'bg-green-50',
    border: 'border-green-100',
    badge: 'Same Day',
    badgeColor: 'bg-teal-500',
    avgDelivery: 'Same day',
    connected: false,
    apiKey: '',
    status: 'Not Connected',
  },
];

const CONFIG = {
  defaultProvider: 'shiprocket',
  autoSelectCheapest: true,
  freeShippingAbove: 499,
  defaultWeight: 500,
  cod: true,
  codCharge: 50,
  packagingCharge: 20,
};

export default function ThirdPartyDelivery() {
  const [services, setServices] = useState(DELIVERY_SERVICES);
  const [selectedService, setSelectedService] = useState(null);
  const [showApiKey, setShowApiKey] = useState({});
  const [connectingId, setConnectingId] = useState(null);
  const [apiInput, setApiInput] = useState('');
  const [config, setConfig] = useState(CONFIG);
  const [activeTab, setActiveTab] = useState('services'); // services | settings | rates

  const connectedCount = services.filter(s => s.connected).length;

  const handleConnect = (service) => {
    setConnectingId(service.id);
    setApiInput('');
    setSelectedService(service);
  };

  const handleSaveConnection = () => {
    if (!apiInput.trim()) return;
    setServices(prev => prev.map(s =>
      s.id === connectingId
        ? { ...s, connected: true, apiKey: apiInput.substring(0, 6) + '••••••••••' + apiInput.slice(-4), status: 'Active' }
        : s
    ));
    setConnectingId(null);
    setApiInput('');
  };

  const handleDisconnect = (id) => {
    setServices(prev => prev.map(s =>
      s.id === id ? { ...s, connected: false, apiKey: '', status: 'Not Connected' } : s
    ));
  };

  const toggleService = (id) => {
    setServices(prev => prev.map(s =>
      s.id === id ? { ...s, status: s.status === 'Active' ? 'Paused' : 'Active' } : s
    ));
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat">Delivery Services</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Connect third-party delivery partners to manage your shipments.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Settings size={15} />
            Shipping Settings
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Truck size={20} /></div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Available</p>
            <h3 className="text-2xl font-black text-slate-900">{services.length}</h3>
            <p className="text-[10px] text-slate-400">Providers</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center"><CheckCircle2 size={20} /></div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Connected</p>
            <h3 className="text-2xl font-black text-slate-900">{connectedCount}</h3>
            <p className="text-[10px] text-slate-400">Active partners</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Globe size={20} /></div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Coverage</p>
            <h3 className="text-2xl font-black text-slate-900">24K+</h3>
            <p className="text-[10px] text-slate-400">Pincodes covered</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center"><Zap size={20} /></div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Free Ship Above</p>
            <h3 className="text-2xl font-black text-slate-900">₹{config.freeShippingAbove}</h3>
            <p className="text-[10px] text-slate-400">Order value</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'services', label: 'Delivery Partners' },
          { id: 'settings', label: 'Shipping Config' },
          { id: 'rates', label: 'Rate Comparison' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Services */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {services.map(service => (
            <motion.div
              key={service.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border ${service.connected ? 'border-blue-100 shadow-md shadow-blue-50' : 'border-slate-100 shadow-sm'} overflow-hidden flex flex-col`}
            >
              {/* Card Header */}
              <div className={`p-5 ${service.bg} border-b ${service.border} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{service.logo}</span>
                  <div>
                    <h3 className="font-black text-slate-900 text-[15px]">{service.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] font-black text-white px-2 py-0.5 rounded-full ${service.badgeColor}`}>{service.badge}</span>
                      <span className="text-[10px] font-bold text-slate-500">⏱ {service.avgDelivery}</span>
                    </div>
                  </div>
                </div>
                {service.connected && (
                  <button onClick={() => toggleService(service.id)}>
                    {service.status === 'Active'
                      ? <ToggleRight size={28} className="text-blue-500" />
                      : <ToggleLeft size={28} className="text-slate-300" />
                    }
                  </button>
                )}
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 space-y-4">
                <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{service.description}</p>

                <div className="flex flex-wrap gap-1.5">
                  {service.features.map(f => (
                    <span key={f} className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-wide">
                      {f}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-black text-slate-700">{service.pricing}</span>
                  <a
                    href={service.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-black text-blue-500 hover:underline"
                  >
                    Website <ExternalLink size={10} />
                  </a>
                </div>

                {/* Connected state: show API Key */}
                {service.connected && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API Key</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowApiKey(p => ({ ...p, [service.id]: !p[service.id] }))}
                          className="p-1 hover:bg-slate-200 rounded-md transition-all text-slate-400"
                        >
                          {showApiKey[service.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button className="p-1 hover:bg-slate-200 rounded-md transition-all text-slate-400">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-black text-slate-700 mt-1 font-roboto">
                      {showApiKey[service.id] ? service.apiKey : '••••••••••••••••••••'}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-5 pb-5">
                {service.connected ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedService(service)}
                      className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black border border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-1"
                    >
                      <Settings size={13} /> Configure
                    </button>
                    <button
                      onClick={() => handleDisconnect(service.id)}
                      className="flex-1 py-2.5 bg-red-50 text-red-500 rounded-xl text-xs font-black border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-1"
                    >
                      <XCircle size={13} /> Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(service)}
                    className="w-full py-3 bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Connect {service.name}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">
            <h3 className="font-black text-slate-900 text-lg font-montserrat">Shipping Configuration</h3>

            <div className="space-y-5">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Default Delivery Provider</label>
                <select
                  value={config.defaultProvider}
                  onChange={e => setConfig(p => ({ ...p, defaultProvider: e.target.value }))}
                  className="mt-2 w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                >
                  {services.filter(s => s.connected).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Free Shipping Above (₹)</label>
                <input
                  type="number"
                  value={config.freeShippingAbove}
                  onChange={e => setConfig(p => ({ ...p, freeShippingAbove: Number(e.target.value) }))}
                  className="mt-2 w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Default Package Weight (grams)</label>
                <input
                  type="number"
                  value={config.defaultWeight}
                  onChange={e => setConfig(p => ({ ...p, defaultWeight: Number(e.target.value) }))}
                  className="mt-2 w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Packaging Charge (₹)</label>
                <input
                  type="number"
                  value={config.packagingCharge}
                  onChange={e => setConfig(p => ({ ...p, packagingCharge: Number(e.target.value) }))}
                  className="mt-2 w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                />
              </div>

              {/* Toggle: COD */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-800">Cash on Delivery (COD)</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Allow customers to pay on delivery</p>
                </div>
                <button onClick={() => setConfig(p => ({ ...p, cod: !p.cod }))}>
                  {config.cod
                    ? <ToggleRight size={30} className="text-blue-500" />
                    : <ToggleLeft size={30} className="text-slate-300" />
                  }
                </button>
              </div>

              {config.cod && (
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">COD Charge (₹)</label>
                  <input
                    type="number"
                    value={config.codCharge}
                    onChange={e => setConfig(p => ({ ...p, codCharge: Number(e.target.value) }))}
                    className="mt-2 w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                  />
                </div>
              )}

              {/* Toggle: Auto-select cheapest */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-800">Auto-select Cheapest Carrier</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Automatically pick the lowest-cost option per order</p>
                </div>
                <button onClick={() => setConfig(p => ({ ...p, autoSelectCheapest: !p.autoSelectCheapest }))}>
                  {config.autoSelectCheapest
                    ? <ToggleRight size={30} className="text-blue-500" />
                    : <ToggleLeft size={30} className="text-slate-300" />
                  }
                </button>
              </div>
            </div>

            <button className="w-full py-4 bg-blue-500 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all">
              Save Shipping Settings
            </button>
          </div>

          {/* Preview Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-5">
            <h3 className="font-black text-slate-900 text-lg font-montserrat">Shipping Preview</h3>
            <div className="space-y-3">
              {[
                { label: 'Default Provider', value: services.find(s => s.id === config.defaultProvider)?.name || 'None' },
                { label: 'Free Shipping Threshold', value: `₹${config.freeShippingAbove}` },
                { label: 'Standard Packaging', value: `₹${config.packagingCharge}` },
                { label: 'COD Available', value: config.cod ? `Yes (+₹${config.codCharge})` : 'No' },
                { label: 'Auto Carrier Selection', value: config.autoSelectCheapest ? 'Enabled' : 'Disabled' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-500">{item.label}</span>
                  <span className="text-xs font-black text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex gap-3">
              <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                When multiple carriers are connected, the system will automatically compare rates and pick the best carrier for each order based on pincode, weight, and delivery speed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Rate Comparison */}
      {activeTab === 'rates' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="font-black text-slate-900 font-montserrat">Rate Comparison</h3>
            <p className="text-sm text-slate-400 font-medium mt-1">Estimated rates for a 500g standard package</p>
          </div>
          <div className="divide-y divide-slate-50">
            {[...services].sort((a, b) => {
              const getPrice = s => parseInt(s.pricing.match(/\d+/)?.[0] || 999);
              return getPrice(a) - getPrice(b);
            }).map((service, i) => (
              <div key={service.id} className="flex items-center gap-5 p-5 hover:bg-slate-50/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-sm">{i + 1}</div>
                <span className="text-2xl">{service.logo}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-900">{service.name}</p>
                    {service.connected && (
                      <span className="text-[9px] font-black text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">CONNECTED</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Avg delivery: {service.avgDelivery}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900 text-sm">{service.pricing}</p>
                  {i === 0 && <span className="text-[9px] font-black text-blue-500 mt-0.5 block">Cheapest</span>}
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect Modal */}
      <AnimatePresence>
        {connectingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConnectingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[28px] shadow-2xl w-full max-w-md p-8 space-y-6"
            >
              <div className="text-center">
                <span className="text-4xl">{selectedService?.logo}</span>
                <h3 className="text-xl font-black text-slate-900 mt-3">Connect {selectedService?.name}</h3>
                <p className="text-sm text-slate-400 font-medium mt-1">Enter your API credentials to integrate</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">API Key / Token</label>
                  <input
                    type="text"
                    value={apiInput}
                    onChange={e => setApiInput(e.target.value)}
                    placeholder={`Enter your ${selectedService?.name} API key`}
                    className="mt-2 w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                  />
                </div>

                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3">
                  <Shield size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                    Your API key is encrypted and stored securely. It is never shared with third parties.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConnectingId(null)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConnection}
                  disabled={!apiInput.trim()}
                  className="flex-[2] py-3.5 bg-blue-500 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  Save & Connect
                </button>
              </div>

              <a
                href={selectedService?.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-black text-blue-500 hover:underline"
              >
                Get API Key from {selectedService?.name} <ExternalLink size={11} />
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
