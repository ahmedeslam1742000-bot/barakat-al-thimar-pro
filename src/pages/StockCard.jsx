import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, Search, Filter, Calendar, History, 
  ArrowUpRight, ArrowDownLeft, ArrowRightLeft,
  ChevronLeft, Layers, Box, Snowflake, Archive,
  LogOut, FileDown, X, Printer, TrendingUp,
  Clock, User, Hash, Info, ChevronRight,
  Database
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { normalizeArabic } from '../lib/arabicTextUtils';

const categoryIcons = {
  'مجمدات': <Snowflake size={16} className="text-blue-500" />,
  'بلاستيك': <Archive size={16} className="text-amber-500" />,
  'تبريد': <Box size={16} className="text-cyan-500" />
};

const getCatIcon = (cat) => categoryIcons[cat] || <Package size={16} className="text-slate-400" />;

export default function StockCard({ setActiveView }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemHistory, setItemHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching items:', err);
      toast.error('حدث خطأ أثناء تحميل الأصناف');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemHistory = async (item) => {
    setHistoryLoading(true);
    try {
      // Fetch all transactions for this item
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`item_id.eq.${item.id},item.ilike.%${item.name}%`)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Type mapping for translation
      const typeMap = {
        'in': 'وارد',
        'out': 'صادر',
        'return': 'مرتجع',
        'Return': 'مرتجع',
        'Restock': 'إمداد مخزني',
        'Issue': 'صرف مخزني',
        'adjust_in': 'تسوية (إدخال)',
        'adjust_out': 'تسوية (إخراج)',
        'سند إدخال': 'سند إدخال',
        'سند إخراج': 'سند إخراج',
        'سند إخراج صوري': 'سند إخراج (صوري)'
      };

      // Process history to calculate running balance
      let currentBalance = 0;
      const processed = data.map(tx => {
        const qtyChange = Number(tx.qty || 0);
        const rawType = tx.type || '';
        
        const isAddition = ['in', 'Restock', 'return', 'Return', 'adjust_in', 'سند إدخال'].includes(rawType);
        const isDeduction = ['out', 'Issue', 'adjust_out', 'سند إخراج', 'سند إخراج صوري'].includes(rawType) || tx.status === 'مرتجع تالف';
        
        const balanceBefore = currentBalance;
        let change = 0;
        
        if (isAddition) {
          change = qtyChange;
        } else if (isDeduction) {
          change = -qtyChange;
        }

        currentBalance += change;
        
        return {
          ...tx,
          displayType: typeMap[rawType] || rawType,
          balanceBefore,
          change,
          balanceAfter: currentBalance,
          isAddition,
          isDeduction
        };
      }).reverse(); // Show latest first in table

      setItemHistory(processed);
    } catch (err) {
      console.error('Error fetching item history:', err);
      toast.error('حدث خطأ أثناء تحميل حركة الصنف');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
    fetchItemHistory(item);
  };

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const q = normalizeArabic(searchQuery);
      const matchSearch = normalizeArabic(it.name).includes(q) ||
                          normalizeArabic(it.company || '').includes(q);
      const matchCat = categoryFilter === 'الكل' || it.cat === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [items, searchQuery, categoryFilter]);

  const groupedItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const cat = item.cat || 'أخرى';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  const categoriesList = ['الكل', 'مجمدات', 'بلاستيك', 'تبريد'];

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-readex text-slate-800 bg-slate-50/30 overflow-hidden" dir="rtl">
      
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 1cm; size: auto; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          .custom-scrollbar { overflow: visible !important; }
          /* Ensure colors and backgrounds print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />
      
      {/* Header Area */}
      <div className="mx-6 mt-6 shrink-0 z-20">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-4 flex flex-col lg:flex-row items-center justify-between shadow-sm gap-4">
          
          <div className="flex items-center gap-4 w-full lg:w-auto">
             <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                <Database size={24} strokeWidth={2.5} />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">الرصيد التراكمي</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">متابعة حركة الأرصدة والتدقيق</p>
             </div>
          </div>

          <div className="flex-1 w-full lg:w-auto relative group">
            <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="ابحث عن صنف لمعاينة رصيده التراكمي..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 text-sm font-bold rounded-2xl pr-14 pl-6 h-12 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 shadow-inner" 
            />
          </div>

          <button onClick={() => setActiveView('dashboard')} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all active:scale-95 border border-rose-100/50">
             <LogOut size={20} className="rotate-180" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
           {categoriesList.map(cat => (
              <button 
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm shrink-0 border ${
                  categoryFilter === cat 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat === 'الكل' ? <Layers size={14} /> : getCatIcon(cat)}
                {cat}
              </button>
           ))}
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
             <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
             <p className="text-slate-400 font-bold">جاري تحميل الأصناف...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-40">
             <Package size={64} className="text-slate-300 mb-4" />
             <p className="text-lg font-black text-slate-400">لا توجد أصناف تطابق بحثك</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
             {filteredItems.map(item => (
                <motion.div
                  layoutId={`item-${item.id}`}
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  className="bg-white rounded-[2rem] border border-slate-100 p-5 cursor-pointer transition-all hover:border-indigo-200 group flex flex-col shadow-sm relative"
                >
                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                         <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            {getCatIcon(item.cat)}
                         </div>
                         <div className="bg-slate-50 group-hover:bg-indigo-50 px-3 py-1 rounded-full border border-slate-100 group-hover:border-indigo-100 transition-all">
                            <span className="text-[9px] font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-tighter">{item.cat}</span>
                         </div>
                      </div>
                      
                      <div className="space-y-1 mb-5">
                         <h3 className="text-[16px] font-black text-slate-800 leading-tight group-hover:text-indigo-700 transition-colors line-clamp-2">
                            {item.name}
                         </h3>
                         <p className="text-[11px] font-bold text-slate-400 group-hover:text-slate-500 truncate">
                            {item.company || 'بدون شركة'}
                         </p>
                      </div>
                   </div>

                   <div className="mt-auto pt-4 flex items-center justify-between relative z-10">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">سجل الحركة</span>
                      </div>
                      <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-indigo-200 group-hover:-translate-x-1">
                         <History size={18} className="group-hover:rotate-[-45deg] transition-transform duration-500" />
                      </div>
                   </div>
                </motion.div>
             ))}
          </div>
        )}
      </div>

      {/* Stock Card Detail Modal */}
      <AnimatePresence>
        {isModalOpen && selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
            dir="rtl"
          >
              <motion.div
                id="print-area"
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 40 }}
                className="w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
                onClick={e => e.stopPropagation()}
              >
                 {/* Modal Header */}
                 <div className="bg-indigo-600 p-8 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-5">
                       <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-inner">
                          <History size={28} strokeWidth={2.5} />
                       </div>
                       <div>
                          <h3 className="text-2xl font-black leading-tight">كارت حركة الصنف</h3>
                          <p className="text-indigo-100 text-xs font-bold mt-1 opacity-80">{selectedItem.name} — {selectedItem.company}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3 no-print">
                       <button 
                         onClick={() => window.print()} 
                         className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black transition-all border border-white/10"
                       >
                          <Printer size={16} />
                          طباعة الكشف
                       </button>
                       <button 
                         onClick={() => setIsModalOpen(false)} 
                         className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90"
                       >
                          <X size={24} />
                       </button>
                    </div>
                 </div>

               {/* Modal Content */}
               <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Item Summary Bar */}
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 grid grid-cols-5 gap-6">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">الرصيد الحالي</span>
                        <div className="flex items-baseline gap-2">
                           <span className="text-2xl font-black text-indigo-600 tabular-nums">{selectedItem.stock_qty}</span>
                           <span className="text-xs font-bold text-slate-400">{selectedItem.unit}</span>
                        </div>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-emerald-500 uppercase mb-1">إجمالي الوارد</span>
                        <div className="flex items-baseline gap-1">
                           <span className="text-lg font-black text-emerald-600 tabular-nums">
                              {itemHistory.filter(h => h.isAddition).reduce((s, h) => s + Math.abs(h.change), 0)}
                           </span>
                           <ArrowDownLeft size={12} className="text-emerald-500" />
                        </div>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-rose-500 uppercase mb-1">إجمالي الصادر</span>
                        <div className="flex items-baseline gap-1">
                           <span className="text-lg font-black text-rose-600 tabular-nums">
                              {itemHistory.filter(h => h.isDeduction).reduce((s, h) => s + Math.abs(h.change), 0)}
                           </span>
                           <ArrowUpRight size={12} className="text-rose-500" />
                        </div>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">القسم / الشركة</span>
                        <span className="text-xs font-black text-slate-700 truncate">{selectedItem.cat} - {selectedItem.company}</span>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1">عدد الحركات</span>
                        <span className="text-sm font-black text-slate-700">{itemHistory.length} حركة</span>
                     </div>
                  </div>

                  {/* History Table */}
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                     {historyLoading ? (
                       <div className="flex flex-col items-center justify-center h-64 gap-4">
                          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                          <p className="text-slate-400 font-bold">جاري تحميل التاريخ التقني...</p>
                       </div>
                     ) : itemHistory.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-64 opacity-20">
                          <Clock size={64} className="text-slate-300" />
                          <p className="text-lg font-black text-slate-400 mt-4">لا توجد حركات مسجلة لهذا الصنف</p>
                       </div>
                     ) : (
                       <table className="w-full text-right border-separate border-spacing-y-2">
                          <thead>
                             <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                                <th className="pb-4 pr-6">التاريخ</th>
                                <th className="pb-4">البيان / الجهة</th>
                                <th className="pb-4 text-center">الرصيد قبل</th>
                                <th className="pb-4 text-center">الحركة</th>
                                <th className="pb-4 text-center rounded-l-3xl">الرصيد بعد</th>
                             </tr>
                          </thead>
                          <tbody>
                             {itemHistory.map((tx, idx) => (
                                <tr key={idx} className="bg-white border border-slate-100 hover:bg-slate-50/50 transition-colors group">
                                   <td className="py-4 pr-6 rounded-r-3xl">
                                      <div className="flex flex-col">
                                         <span className="text-xs font-black text-slate-700">{new Date(tx.timestamp).toLocaleDateString('ar-EG')}</span>
                                         <span className="text-[9px] font-bold text-slate-400">{new Date(tx.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                   </td>
                                   <td className="py-4">
                                      <div className="flex items-center gap-3">
                                         <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                           tx.isAddition ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                         }`}>
                                            {tx.isAddition ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800">{tx.beneficiary || tx.loc || tx.recipient || tx.rep || tx.supplier || 'بدون اسم'}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{tx.displayType}</span>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="py-4 text-center font-black text-slate-400 tabular-nums text-xs">
                                      {tx.balanceBefore}
                                   </td>
                                   <td className="py-4 text-center">
                                      <span className={`text-sm font-black tabular-nums ${
                                        tx.change > 0 ? 'text-emerald-600' : 'text-rose-600'
                                      }`}>
                                         {tx.change > 0 ? `+${tx.change}` : tx.change}
                                      </span>
                                   </td>
                                   <td className="py-4 text-center rounded-l-3xl">
                                      <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black border border-indigo-100 tabular-nums">
                                         {tx.balanceAfter}
                                      </div>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                     )}
                  </div>
               </div>

               {/* Modal Footer */}
               <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between no-print">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">نظام التدقيق المخزني — بركة الثمار PRO</p>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl text-sm font-black hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                  >
                     إغلاق النافذة
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
