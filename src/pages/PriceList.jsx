import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Pencil, X, CheckCircle, Tags,
  TrendingUp, TrendingDown, DollarSign, LogOut,
  AlertCircle, LayoutGrid, Snowflake, Box, Thermometer, Package
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { normalizeArabic } from '../lib/arabicTextUtils';
import { useAuth } from '../contexts/AuthContext';

export default function PriceList({ setActiveView }) {
  const { isViewer } = useAuth();
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [selectedCat, setSelectedCat] = useState('الكل');
  const inputRef = useRef(null);

  // Refs for current state to avoid closure issues in event listener
  const stateRef = useRef({ isEditModalOpen, isSaveConfirmOpen, isExitConfirmOpen, newPrice, selectedItem });
  useEffect(() => {
    stateRef.current = { isEditModalOpen, isSaveConfirmOpen, isExitConfirmOpen, newPrice, selectedItem };
  }, [isEditModalOpen, isSaveConfirmOpen, isExitConfirmOpen, newPrice, selectedItem]);

  const categories = useMemo(() => {
    const cats = ['الكل', ...new Set(items.map(item => item.cat).filter(Boolean))];
    return cats;
  }, [items]);

  // --- FETCH DATA ---
  const fetchPrices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, company, price, old_price, cat, unit')
        .order('name');
      
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching prices:', err);
      toast.error('حدث خطأ أثناء تحميل الأسعار');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const channel = supabase.channel('price-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchPrices)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // --- FILTERING ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = normalizeArabic(searchQuery);
      const matchesSearch = normalizeArabic(item.name).includes(q) || 
                            normalizeArabic(item.company || '').includes(q);
      const matchesCat = selectedCat === 'الكل' || item.cat === selectedCat;
      return matchesSearch && matchesCat;
    });
  }, [items, searchQuery, selectedCat]);

  // --- EDIT LOGIC ---
  const openEditModal = (item) => {
    if (isViewer) return;
    setSelectedItem(item);
    setNewPrice('');
    setIsEditModalOpen(true);
  };

  const handleUpdatePrice = () => {
    const { newPrice } = stateRef.current;
    if (newPrice === '' || isNaN(newPrice) || Number(newPrice) < 0) {
      toast.error('يرجى إدخال سعر صحيح');
      return;
    }
    setIsSaveConfirmOpen(true);
  };

  const performActualUpdate = async () => {
    const { selectedItem, newPrice } = stateRef.current;
    
    if (!selectedItem) {
      toast.error('لم يتم اختيار صنف');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          old_price: selectedItem.price || 0, 
          price: Number(newPrice) 
        })
        .eq('id', selectedItem.id);

      if (error) {
        toast.error(`خطأ من قاعدة البيانات: ${error.message}`);
        return;
      }
      
      toast.success(`تم تحديث سعر "${selectedItem.name}" بنجاح`);
      setIsSaveConfirmOpen(false);
      setIsEditModalOpen(false);
      fetchPrices();
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.message || 'حدث خطأ غير متوقع أثناء تحديث السعر');
    }
  };

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const { isEditModalOpen, isSaveConfirmOpen, isExitConfirmOpen, newPrice, selectedItem } = stateRef.current;
      
      if (!isEditModalOpen) return;

      if (isSaveConfirmOpen) {
        if (e.key === 'Enter') {
          e.preventDefault();
          performActualUpdate();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setIsSaveConfirmOpen(false);
        }
        return;
      }

      if (isExitConfirmOpen) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setIsExitConfirmOpen(false);
          setIsEditModalOpen(false);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setIsExitConfirmOpen(false);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleUpdatePrice();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (newPrice && newPrice !== String(selectedItem?.price)) {
          setIsExitConfirmOpen(true);
        } else {
          setIsEditModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array, uses stateRef

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6 font-readex h-full overflow-hidden relative" dir="rtl">
      
      {/* ═══ HEADER SECTION ═══ */}
      <div className="shrink-0 flex items-center gap-4 bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Tags size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black font-tajawal tracking-tight text-slate-900 leading-none">قائمة الأسعار</h1>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">إدارة وتسعير المنتجات</p>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-100 mx-2" />

        <div className="relative flex-1 group">
          <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="ابحث عن صنف لتعديل سعره..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 text-slate-800 text-sm font-bold rounded-2xl pr-12 pl-4 py-3.5 outline-none focus:bg-white focus:border-indigo-500/20 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-400"
          />
        </div>

        <button 
          onClick={() => setActiveView('dashboard')}
          className="flex items-center justify-center w-12 h-12 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all active:scale-95 shadow-sm"
        >
          <LogOut size={22} className="rotate-180" />
        </button>
      </div>

      {/* ═══ CATEGORY FILTER ═══ */}
      <div className="shrink-0 flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar px-2" dir="rtl">
        {categories.map(cat => {
          const isActive = selectedCat === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap transition-all font-black text-sm
                ${isActive 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                  : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}
              `}
            >
              <div className={isActive ? 'text-white' : 'text-slate-300'}>
                {cat === 'الكل' && <LayoutGrid size={18} />}
                {cat === 'مجمدات' && <Snowflake size={18} />}
                {cat === 'بلاستيك' && <Box size={18} />}
                {cat === 'تبريد' && <Thermometer size={18} />}
                {cat !== 'الكل' && cat !== 'مجمدات' && cat !== 'بلاستيك' && cat !== 'تبريد' && <Package size={18} />}
              </div>
              {cat}
            </button>
          );
        })}
      </div>

      {/* ═══ PRICES TABLE ═══ */}
      <div className="flex-1 overflow-hidden bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin" />
              <p className="font-bold">جاري تحميل الأسعار...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
              <AlertCircle size={48} strokeWidth={1.5} />
              <p className="text-lg font-black">لا توجد أصناف تطابق بحثك</p>
            </div>
          ) : (
            <table className="w-full text-right border-separate border-spacing-0">
              <thead className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md">
                <tr className="text-slate-400 font-black text-[11px] uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4 text-center w-16">م</th>
                  <th className="px-6 py-4">اسم الصنف</th>
                  <th className="px-6 py-4 text-center w-32">القسم</th>
                  <th className="px-6 py-4 text-center w-32">الوحدة</th>
                  <th className="px-6 py-4 text-center w-40">السعر السابق</th>
                  <th className="px-6 py-4 text-center w-40">السعر الحالي</th>
                  <th className="px-6 py-4 text-center w-28">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map((item, idx) => (
                  <tr key={item.id} className="group hover:bg-indigo-50/10 transition-colors">
                    <td className="px-6 py-4 text-center align-middle">
                      <span className="text-[13px] font-bold text-slate-300 tabular-nums">{idx + 1}</span>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span className="text-[15px] font-black text-slate-800 tracking-tight whitespace-nowrap">{item.name} - {item.company || 'بدون شركة'}</span>
                    </td>
                    <td className="px-6 py-4 text-center align-middle">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-lg border bg-slate-50 text-slate-500 border-slate-100">{item.cat || 'أخرى'}</span>
                    </td>
                    <td className="px-6 py-4 text-center align-middle">
                      <span className="text-[11px] font-bold text-slate-400">{item.unit || 'وحدة'}</span>
                    </td>
                    <td className="px-6 py-4 text-center align-middle">
                      <div className="flex items-center justify-center text-slate-400 font-bold tabular-nums">
                        <span className="text-lg">{item.old_price || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center align-middle">
                      <div className="flex items-center justify-center gap-2 text-emerald-600 font-black tabular-nums bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 inline-flex mx-auto">
                        <span className="text-xl">{item.price || 0}</span>
                        {item.price > (item.old_price || 0) ? <TrendingUp size={14} /> : item.price < (item.old_price || 0) ? <TrendingDown size={14} /> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center align-middle">
                      {!isViewer && (
                        <button 
                          onClick={() => openEditModal(item)}
                          className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm group/btn"
                        >
                          <Pencil size={18} className="group-hover/btn:scale-110 transition-transform" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ═══ EDIT PRICE MODAL ═══ */}
      <AnimatePresence>
        {isEditModalOpen && selectedItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-white relative"
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 font-tajawal">تحديث السعر</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">تعديل قيمة الصنف في المتجر</p>
                  </div>
                </div>
                <button onClick={() => {
                  if (newPrice && newPrice !== String(selectedItem.price)) setIsExitConfirmOpen(true);
                  else setIsEditModalOpen(false);
                }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Item Info Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">الصنف المختار</p>
                  <p className="text-lg font-black text-slate-800 tracking-tight">{selectedItem.name}</p>
                  <p className="text-sm text-slate-500 font-bold mt-0.5">{selectedItem.company}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-black mb-1">السعر الحالي</span>
                    <span className="text-2xl font-black text-slate-400 tabular-nums">{selectedItem.price || 0}</span>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-100 flex flex-col items-center">
                    <span className="text-[10px] text-emerald-600 font-black mb-1">السعر الجديد</span>
                    <span className="text-2xl font-black text-emerald-600 tabular-nums">{newPrice || selectedItem.price || '0'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">أدخل السعر الحديث</label>
                  <div className="relative group">
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                      <DollarSign size={20} />
                    </div>
                    <input 
                      autoFocus
                      type="number"
                      placeholder="0.00"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pr-12 pl-4 text-xl font-black outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all text-center placeholder:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <button 
                  onClick={() => {
                    if (newPrice && newPrice !== String(selectedItem.price)) setIsExitConfirmOpen(true);
                    else setIsEditModalOpen(false);
                  }}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-white hover:text-slate-600 transition-all border border-transparent hover:border-slate-200"
                >
                  إلغاء (Esc)
                </button>
                <button 
                  onClick={handleUpdatePrice}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
                >
                  <CheckCircle size={18} />
                  حفظ السعر (Enter)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ GLOBAL OVERLAYS (MODALS ON TOP) ═══ */}
      <AnimatePresence>
        {isSaveConfirmOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-sm p-8 text-center border border-white relative"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2 font-tajawal">تأكيد السعر الجديد</h3>
              <p className="text-sm text-slate-500 font-bold mb-8">أنت على وشك تغيير السعر إلى <span className="text-emerald-600 font-black text-lg mx-1">{newPrice}</span>. هل أنت متأكد؟</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsSaveConfirmOpen(false)}
                  className="py-4 rounded-2xl text-sm font-black text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  تراجع
                </button>
                <button 
                  onClick={performActualUpdate}
                  className="py-4 rounded-2xl text-sm font-black text-white bg-emerald-500 shadow-xl shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  تأكيد الحفظ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExitConfirmOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-sm p-8 text-center border border-white relative"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-rose-100">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2 font-tajawal">تجاهل التغييرات؟</h3>
              <p className="text-sm text-slate-500 font-bold mb-8">لقد قمت بتعديل السعر ولم يتم الحفظ بعد. هل تريد الخروج فعلاً؟</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsExitConfirmOpen(false)}
                  className="py-4 rounded-2xl text-sm font-black text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  البقاء
                </button>
                <button 
                  onClick={() => { setIsExitConfirmOpen(false); setIsEditModalOpen(false); }}
                  className="py-4 rounded-2xl text-sm font-black text-white bg-rose-500 shadow-xl shadow-rose-200 hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} />
                  تجاهل الخروج
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
