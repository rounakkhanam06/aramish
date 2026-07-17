import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { approveProduct, deleteProduct } from '../../../store/slices/productSlice';
import { 
  CheckCircle2, XCircle, ShoppingBag, Eye, 
  Tag, Layers, ArrowRight, AlertCircle, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../../components/ConfirmModal';

const ProductModeration = () => {
  const { allProducts } = useSelector(state => state.products);
  const pendingProducts = allProducts.filter(p => p.status === 'Pending');
  const dispatch = useDispatch();

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [confirmTitle, setConfirmTitle] = React.useState('');
  const [confirmMessage, setConfirmMessage] = React.useState('');

  const triggerConfirm = (title, message, action) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Catalog Moderation</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Review new products before they go live on the marketplace.</p>
        </div>
        <div className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
           <Layers size={14} />
           {pendingProducts.length} Pending Products
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {pendingProducts.length > 0 ? (
            pendingProducts.map((product, index) => (
              <motion.div 
                key={product.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col group"
              >
                <div className="h-56 bg-slate-50 relative overflow-hidden flex items-center justify-center p-8">
                   <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                   <ShoppingBag size={64} className="text-slate-200 group-hover:scale-110 transition-transform" />
                   <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm">
                      {product.category}
                   </div>
                   <button className="absolute bottom-4 right-4 p-3 bg-white text-slate-900 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
                      <Eye size={20} />
                   </button>
                </div>

                <div className="p-6 space-y-4">
                   <div>
                      <h3 className="font-black text-slate-900 leading-tight line-clamp-1">{product.name}</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Vendor ID: {product.vendorId}</p>
                   </div>

                   <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div>
                         <p className="text-[10px] text-slate-400 font-bold uppercase">Price</p>
                         <p className="text-lg font-black text-slate-900">₹{product.price.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] text-slate-400 font-bold uppercase">Initial Stock</p>
                         <p className="text-lg font-black text-slate-900">{product.stock}</p>
                      </div>
                   </div>

                   <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => {
                          triggerConfirm(
                            'Delete Product',
                            'Are you sure you want to permanently delete this product from catalog?',
                            () => dispatch(deleteProduct(product.id))
                          );
                        }}
                        className="p-4 border border-red-100 text-red-500 rounded-2xl hover:bg-red-50 transition-all flex items-center justify-center flex-1"
                      >
                         <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => dispatch(approveProduct(product.id))}
                        className="flex-[3] py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                         <CheckCircle2 size={18} />
                         Approve Product
                      </button>
                   </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-24 bg-white rounded-[40px] border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
               <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-8 border border-green-100 shadow-inner">
                  <CheckCircle2 size={48} strokeWidth={3} />
               </div>
               <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Catalog is Clean</h3>
               <p className="text-slate-400 font-medium mt-3 max-w-sm px-8">Every product has been reviewed and verified. No pending moderation tasks.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction}
        title={confirmTitle}
        message={confirmMessage}
      />
    </div>
  );
};

export default ProductModeration;
