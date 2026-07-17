import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, Edit2, GripVertical, Save, X,
  CheckCircle2, Image as ImageIcon, Layout,
  Smartphone, Monitor, Sparkles, Star, Tag,
  ChevronRight, ChevronDown, List, Info, ThumbsUp, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useVendorStore from '../../../store/useVendorStore';
import OptimizedImage from '../../../components/common/OptimizedImage';

const SectionHeader = ({ title, icon: Icon, count }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shadow-inner">
      <Icon size={20} />
    </div>
    <div>
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight font-montserrat">{title}</h3>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{count} Items configured</p>
    </div>
    <div className="flex-1 h-px bg-slate-100 mx-4" />
  </div>
);

const HomeSectionsManager = () => {
  const { section } = useParams();
  const navigate = useNavigate();
  const { homeSections, setHomeSections } = useVendorStore();
  
  // Map URL param to store keys
  const viewMap = {
    'still-looking': 'stillLooking',
    'top-selection': 'topSelection',
    'spotlight': 'brandsSpotlight',
    'best-quality': 'bestQuality',
    'keep-shopping': 'keepShopping'
  };

  const activeView = viewMap[section] || 'stillLooking';
  
  const [sections, setSections] = useState(homeSections);
  const [isAdding, setIsAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({ label: '', name: '', tag: '', title: '', sub: '', img: '', link: '#' });

  // Sync local state when store changes
  useEffect(() => {
    setSections(homeSections);
  }, [homeSections]);

  const handleSaveAll = () => {
    setHomeSections(sections);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addItem = () => {
    if (!formData.img) return;
    setSections(prev => ({
      ...prev,
      [activeView]: [...(prev[activeView] || []), { ...formData }]
    }));
    setIsAdding(false);
    setFormData({ label: '', name: '', tag: '', title: '', sub: '', img: '', link: '#' });
  };

  const removeItem = (index) => {
    setSections(prev => ({
      ...prev,
      [activeView]: prev[activeView].filter((_, i) => i !== index)
    }));
  };

  const getTitle = () => {
    const titles = {
      'stillLooking': 'Still Looking For These?',
      'topSelection': 'Top Selection',
      'brandsSpotlight': 'Brands in Spotlight',
      'bestQuality': 'Best Quality',
      'keepShopping': 'Keep Shopping'
    };
    return titles[activeView] || 'Section Manager';
  };

  const getIcon = () => {
    const icons = {
      'stillLooking': List,
      'topSelection': Star,
      'brandsSpotlight': Sparkles,
      'bestQuality': ThumbsUp,
      'keepShopping': ShoppingBag
    };
    return icons[activeView] || Info;
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">
            {getTitle()}
          </h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">
            Manage items for the <span className="font-bold text-blue-500">{getTitle()}</span> section on the home page.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/admin/inventory/add')}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <Plus size={16} />
            Create Product
          </button>
          <button 
            onClick={handleSaveAll}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white shadow-blue-100 hover:scale-105'}`}
          >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? 'Changes Published!' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Configuration */}
        <div className="space-y-6">
           <SectionHeader 
             title="Configuration" 
             icon={getIcon()}
             count={sections[activeView]?.length || 0}
           />

           <div className="space-y-4">
              <AnimatePresence>
                {sections[activeView]?.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 group hover:shadow-md transition-all"
                  >
                    <div className="w-8 flex items-center justify-center text-slate-300 cursor-grab">
                      <GripVertical size={16} />
                    </div>
                    <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                      <OptimizedImage src={item.img} alt="" type="product" className="w-full h-full" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-900 font-montserrat leading-tight">
                        {item.label || item.name || item.title}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {item.tag || item.sub || 'Main Section Item'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                       <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition-all">
                          <Edit2 size={14} />
                       </button>
                       <button onClick={() => removeItem(index)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                          <Trash2 size={14} />
                       </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {!isAdding ? (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50/20 transition-all"
                >
                   <Plus size={16} /> Add New {section?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Item
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      {(activeView === 'stillLooking' || activeView === 'keepShopping') && (
                        <div className="col-span-2">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Card Label</label>
                           <input value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} type="text" placeholder="e.g. Co-ords" className="w-full bg-white border border-blue-100 rounded-xl py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-200" />
                        </div>
                      )}
                      {(activeView === 'topSelection' || activeView === 'bestQuality') && (
                        <>
                          <div>
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Product Name</label>
                             <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" placeholder="e.g. Face Wash" className="w-full bg-white border border-blue-100 rounded-xl py-3 px-4 text-xs font-bold outline-none" />
                          </div>
                          <div>
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tag</label>
                             <input value={formData.tag} onChange={e => setFormData({...formData, tag: e.target.value})} type="text" placeholder="e.g. Best Picks" className="w-full bg-white border border-blue-100 rounded-xl py-3 px-4 text-xs font-bold outline-none" />
                          </div>
                        </>
                      )}
                      {activeView === 'brandsSpotlight' && (
                        <>
                          <div>
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Main Title</label>
                             <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} type="text" placeholder="e.g. 50% Off" className="w-full bg-white border border-blue-100 rounded-xl py-3 px-4 text-xs font-bold outline-none" />
                          </div>
                          <div>
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Subtitle</label>
                             <input value={formData.sub} onChange={e => setFormData({...formData, sub: e.target.value})} type="text" placeholder="e.g. Limited Deal" className="w-full bg-white border border-blue-100 rounded-xl py-3 px-4 text-xs font-bold outline-none" />
                          </div>
                        </>
                      )}
                      <div className="col-span-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Image URL</label>
                         <input value={formData.img} onChange={e => setFormData({...formData, img: e.target.value})} type="text" placeholder="https://..." className="w-full bg-white border border-blue-100 rounded-xl py-3 px-4 text-xs font-bold outline-none" />
                      </div>
                      <div className="col-span-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Link Destination</label>
                         <input value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} type="text" placeholder="/vendor/product-detail" className="w-full bg-white border border-blue-100 rounded-xl py-3 px-4 text-xs font-bold outline-none" />
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={addItem} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">Add Item</button>
                      <button onClick={() => setIsAdding(false)} className="px-6 py-2.5 bg-white text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100">Cancel</button>
                   </div>
                </motion.div>
              )}
           </div>
        </div>

        {/* Right: Preview & Guide */}
        <div className="space-y-6 max-w-sm mx-auto lg:mx-0">
           <div className="bg-slate-900 rounded-[28px] p-5 text-white relative overflow-hidden border-[5px] border-slate-800 shadow-xl">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-6 bg-slate-800 rounded-full" />
              
              <div className="mt-8 space-y-4">
                 <div className="flex justify-between items-center px-1">
                    <h4 className="text-lg font-black font-montserrat uppercase tracking-tight">App Preview</h4>
                    <div className="flex gap-1.5">
                       <Smartphone size={14} className="text-blue-400" />
                       <Monitor size={14} className="opacity-20" />
                    </div>
                 </div>

                 {/* Real-time Dynamic Preview */}
                 <div className="bg-slate-800/50 rounded-2xl p-3 border border-white/5 space-y-3">
                    {(activeView === 'stillLooking' || activeView === 'keepShopping') && (
                       <div className="space-y-3">
                          <p className="text-[14px] font-black text-white/90">{getTitle()}</p>
                          <div className="flex gap-1.5 overflow-x-hidden">
                             {sections[activeView]?.slice(0, 4).map((item, i) => (
                                <div key={i} className="w-16 h-20 bg-white rounded-lg p-1 flex-shrink-0">
                                   <div className="aspect-square bg-slate-100 rounded-md overflow-hidden mb-1">
                                      <OptimizedImage src={item.img} className="w-full h-full" type="product" />
                                   </div>
                                   <p className="text-[6px] font-black text-slate-900 truncate leading-tight">{item.label}</p>
                                </div>
                             ))}
                          </div>
                       </div>
                    )}

                    {(activeView === 'topSelection' || activeView === 'bestQuality') && (
                       <div className="space-y-3">
                          <div className="flex justify-between items-center">
                             <p className="text-[14px] font-black text-white/90">{getTitle()}</p>
                             <ChevronRight size={14} className="opacity-50" />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                             {sections[activeView]?.slice(0, 4).map((item, i) => (
                                <div key={i} className="bg-white rounded-lg p-1 aspect-[3/4] flex flex-col gap-0.5">
                                   <div className="flex-1 bg-slate-100 rounded overflow-hidden">
                                      <OptimizedImage src={item.img} className="w-full h-full" type="product" />
                                   </div>
                                   <p className="text-[5px] font-black text-slate-400 truncate leading-none">{item.name}</p>
                                   <p className="text-[7px] font-black text-slate-900 truncate leading-none">{item.tag}</p>
                                </div>
                             ))}
                          </div>
                       </div>
                    )}

                    {activeView === 'brandsSpotlight' && (
                       <div className="space-y-3">
                          <p className="text-[14px] font-black text-white/90">Brands in Spotlight</p>
                          <div className="grid grid-cols-3 gap-1.5">
                             {sections.brandsSpotlight?.slice(0, 6).map((item, i) => (
                                <div key={i} className="flex flex-col gap-0.5">
                                   <div className="aspect-square bg-white rounded-lg overflow-hidden relative border border-white/10">
                                      <OptimizedImage src={item.img} className="w-full h-full" type="product" />
                                      <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[5px] font-black py-0.5 text-center leading-none">
                                         {item.title}
                                      </div>
                                   </div>
                                   <p className="text-[6px] font-black text-center text-white/80 truncate px-0.5">{item.sub}</p>
                                </div>
                             ))}
                          </div>
                       </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="bg-blue-50 border border-blue-100 rounded-[32px] p-8 space-y-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Info size={18} />
                 </div>
                 <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest">Management Guide</h4>
              </div>
              <ul className="space-y-3">
                 {[
                   'Changes take effect on the **User Home Page** instantly.',
                   'Use high-quality **vertical aspect ratio** for Top Selection.',
                   'Keep labels short (1-2 words) for best mobile rendering.',
                   'Links should point to internal routes like **/vendor/products**.'
                 ].map((text, i) => (
                    <li key={i} className="flex gap-3 text-[11px] text-blue-600/70 font-medium leading-relaxed">
                       <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                       <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-900">$1</strong>') }} />
                    </li>
                 ))}
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
};

export default HomeSectionsManager;
