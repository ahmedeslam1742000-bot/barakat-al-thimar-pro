import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Printer, Eye, Calendar, FileText, Package, 
  Image as ImageIcon, ChevronLeft, X, LogOut, LayoutGrid, 
  Filter, CheckCircle, ArrowRight, ExternalLink, Snowflake, 
  Archive, Box, Thermometer
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { normalizeArabic } from '../lib/arabicTextUtils';
import { formatDate } from '../lib/dateUtils';

const CATS = ['الكل', 'مجمدات', 'بلاستيك', 'تبريد'];

const categoryIcons = {
  'مجمدات': <Snowflake size={14} className="text-cyan-500" />,
  'بلاستيك': <Archive size={14} className="text-amber-500" />,
  'تبريد': <Thermometer size={14} className="text-blue-500" />,
  'الكل': <LayoutGrid size={14} className="text-slate-400" />
};

export default function InboundRecords({ setActiveView }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, batch_id, beneficiary, date, timestamp, receipt_type, reference_number, receipt_image, is_summary, item, qty, unit, cat, balance_after')
        .eq('type', 'in')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Group by batch_id
      const grouped = data.reduce((acc, current) => {
        const id = current.batch_id || `SINGLE-${current.id}`;
        if (!acc[id]) {
          acc[id] = {
            id: id,
            supplier: current.beneficiary || 'غير محدد',
            date: current.date,
            timestamp: current.timestamp,
            receiptType: current.receipt_type || 'بدون',
            receiptNumber: current.reference_number || 'N/A',
            receiptImage: current.receipt_image || current.receipt_url,
            items: [],
            categories: new Set()
          };
        }
        if (!current.is_summary) {
          acc[id].items.push(current);
          if (current.cat) acc[id].categories.add(current.cat);
        }
        return acc;
      }, {});

      setRecords(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('فشل في تحميل السجلات');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const q = normalizeArabic(searchQuery);
      const searchKey = normalizeArabic(`${r.supplier || ''} ${r.receiptNumber || ''} ${r.items.map(i => i.item).join(' ')}`);
      const matchesSearch = searchKey.includes(q);
      const matchesCat = categoryFilter === 'الكل' || Array.from(r.categories).includes(categoryFilter);
      return matchesSearch && matchesCat;
    });
  }, [records, searchQuery, categoryFilter]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 font-tajawal" dir="rtl">
      {/* ═══ CONTROL BAR ═══ */}
      <div className="shrink-0 px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-teal-50 dark:bg-teal-500/10 rounded-[1.25rem] flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm border border-teal-100 dark:border-teal-500/20">
                <FileText size={24} strokeWidth={2.5} />
             </div>
             <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">أذونات الواردات</h1>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-1">الأرشيف التاريخي لجميع عمليات التوريد</p>
             </div>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black transition-all border border-slate-200 dark:border-slate-700 active:scale-95">
                <Printer size={16} />
                <span>طباعة</span>
             </button>
             <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black transition-all border border-slate-200 dark:border-slate-700 active:scale-95">
                <Eye size={16} />
                <span>معاينة</span>
             </button>
             <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 mx-1"></div>
             <button onClick={() => setActiveView('dashboard')} className="flex items-center gap-2 px-6 py-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-black transition-all border border-rose-100 dark:border-rose-500/20 active:scale-95">
                <LogOut size={16} />
                <span>خروج للرئيسية</span>
             </button>
          </div>
        </div>

        {/* ═══ FILTER BAR (Search + Categories) ═══ */}
        <div className="mt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
           <div className="relative group max-w-md w-full">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-600 transition-colors">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="ابحث باسم المورد أو رقم الفاتورة..."
                className="w-full h-[46px] bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent text-slate-800 dark:text-white text-sm rounded-2xl focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-teal-500/5 focus:border-teal-600/20 block pr-12 pl-4 outline-none transition-all duration-300 font-bold placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>

           <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
              {CATS.map(cat => (
                 <button
                   key={cat}
                   onClick={() => setCategoryFilter(cat)}
                   className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap border ${
                     categoryFilter === cat 
                       ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-600/20 scale-105' 
                       : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:border-teal-200 hover:bg-teal-50/30'
                   }`}
                 >
                   {categoryIcons[cat]}
                   {cat}
                 </button>
              ))}
           </div>
        </div>
      </div>

      {/* ═══ TABLE SECTION (ItemsDirectory Style) ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30 dark:bg-slate-900/50 p-6">
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
           <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                 <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-4 text-center w-12 border-x border-slate-100">#</th>
                    <th className="px-6 py-4 text-right border-x border-slate-100">المورد</th>
                    <th className="px-6 py-4 text-center w-48 border-x border-slate-100">التاريخ والوقت</th>
                    <th className="px-6 py-4 text-center w-32 border-x border-slate-100">نوع المستند</th>
                    <th className="px-6 py-4 text-center w-40 border-x border-slate-100">رقم المرجع</th>
                    <th className="px-6 py-4 text-center w-28 border-x border-slate-100">الأصناف</th>
                    <th className="px-6 py-4 text-center w-32 border-x border-slate-100">المرفق</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                 {loading ? (
                    <tr>
                       <td colSpan="7" className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4">
                             <div className="w-10 h-10 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin"></div>
                             <span className="text-slate-400 font-bold text-sm">جاري تحميل الأرشيف...</span>
                          </div>
                       </td>
                    </tr>
                 ) : filteredRecords.length === 0 ? (
                    <tr>
                       <td colSpan="7" className="py-24 text-center text-slate-400 font-bold">لا توجد سجلات مطابقة</td>
                    </tr>
                 ) : (
                    filteredRecords.map((record, idx) => (
                       <tr 
                         key={record.id}
                         onClick={() => { setSelectedRecord(record); setIsDetailsOpen(true); }}
                         className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors h-[60px]"
                       >
                          <td className="px-4 text-center">
                             <span className="text-[11px] font-black text-slate-400 group-hover:text-teal-600 transition-colors">{idx + 1}</span>
                          </td>
                          <td className="px-6 text-right">
                             <span className="text-sm font-black text-slate-800 dark:text-white group-hover:text-teal-600 transition-colors">{record.supplier}</span>
                          </td>
                          <td className="px-6 text-center">
                             <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">{record.date}</span>
                                <span className="text-[9px] font-bold text-slate-400 tabular-nums">{record.timestamp ? new Date(record.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                             </div>
                          </td>
                          <td className="px-6 text-center">
                             <span className={`px-3 py-1 rounded-lg text-[10px] font-black border ${
                                record.receiptType === 'فاتورة' 
                                  ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                  : record.receiptType === 'سند'
                                    ? 'bg-amber-50 text-amber-600 border-amber-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                             }`}>
                                {record.receiptType}
                             </span>
                          </td>
                          <td className="px-6 text-center">
                             <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">{record.receiptNumber}</span>
                          </td>
                          <td className="px-6 text-center">
                             <span className="px-3 py-1 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 rounded-lg text-[10px] font-black border border-teal-100 dark:border-teal-500/20 tabular-nums">
                                {record.items.length} صنف
                             </span>
                          </td>
                          <td className="px-6 text-center">
                             {record.receiptImage ? (
                                <div className="flex items-center justify-center">
                                   <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 group-hover:scale-110 transition-transform">
                                      <ImageIcon size={14} />
                                   </div>
                                </div>
                             ) : (
                                <span className="text-[10px] font-bold text-slate-300">بدون مرفق</span>
                             )}
                          </td>
                       </tr>
                    ))
                 )}
              </tbody>
           </table>
        </div>
      </div>

      {/* ═══ READ-ONLY DETAILS MODAL ═══ */}
      <AnimatePresence>
        {isDetailsOpen && selectedRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-700"
            >
               <div className="px-8 py-6 bg-teal-600 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                        <FileText size={24} strokeWidth={2.5} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black">تفاصيل إذن التوريد</h3>
                        <p className="text-teal-50 text-[10px] font-bold mt-0.5 uppercase tracking-wider">رقم المرجع: {selectedRecord.receiptNumber}</p>
                     </div>
                  </div>
                  <button onClick={() => setIsDetailsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                     <X size={24} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] font-black text-slate-400 block mb-2 uppercase">المورد</span>
                        <span className="text-sm font-black text-slate-800 dark:text-white">{selectedRecord.supplier}</span>
                     </div>
                     <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] font-black text-slate-400 block mb-2 uppercase">التاريخ</span>
                        <span className="text-sm font-black text-slate-800 dark:text-white">{selectedRecord.date}</span>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Package size={14} className="text-teal-600" />
                        قائمة الأصناف المستلمة
                     </h4>
                     <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                        <table className="w-full text-right text-xs">
                           <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest">
                              <tr>
                                 <th className="px-5 py-3 border-x border-slate-100">الصنف</th>
                                 <th className="px-5 py-3 text-center border-x border-slate-100">القسم</th>
                                 <th className="px-5 py-3 text-center border-x border-slate-100">الكمية</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {selectedRecord.items.map((it, idx) => (
                                 <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-300 border-x border-slate-100">{it.item}</td>
                                    <td className="px-5 py-3 text-center border-x border-slate-100">
                                       <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md text-[9px] font-black">{it.cat}</span>
                                    </td>
                                    <td className="px-5 py-3 text-center font-black text-teal-600 tabular-nums border-x border-slate-100">
                                       {it.qty} {it.unit}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  {selectedRecord.receiptImage && (
                    <div className="space-y-4">
                       <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <ImageIcon size={14} className="text-teal-600" />
                          مستند الإثبات المرفق
                       </h4>
                       <div className="relative group rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
                          <img 
                            src={selectedRecord.receiptImage} 
                            alt="Receipt" 
                            className="w-full h-48 object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <a 
                               href={selectedRecord.receiptImage} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white border border-white/30 hover:scale-110 transition-transform"
                               title="عرض بالكامل"
                             >
                                <Eye size={24} />
                             </a>
                          </div>
                       </div>
                    </div>
                  )}
               </div>

               <div className="px-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
                  <button 
                    onClick={() => setIsDetailsOpen(false)}
                    className="px-8 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl text-xs font-black transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
                  >
                    إغلاق النافذة
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
