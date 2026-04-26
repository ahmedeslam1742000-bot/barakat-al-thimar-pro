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
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Use a separate effect to handle ESC with correct state access
  useEffect(() => {
    if (!isDetailsOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isImageZoomed) {
          setIsImageZoomed(false);
        } else {
          setIsDetailsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailsOpen, isImageZoomed]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, batch_id, beneficiary, date, timestamp, receipt_type, reference_number, receipt_image, is_summary, item, qty, unit, cat, balance_after, company')
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
        if (current.is_summary === true) {
          acc[id].summaryRow = current;
          return acc;
        }
        
        acc[id].items.push(current);
        if (current.cat) acc[id].categories.add(current.cat);
        return acc;
      }, {});

      setRecords(Object.values(grouped).filter(r => r.items.length > 0));
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('فشل في تحميل السجلات');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Exclude unspecified suppliers
      if (r.supplier === 'غير محدد') return false;

      const q = normalizeArabic(searchQuery);
      const searchKey = normalizeArabic(`${r.supplier || ''} ${r.receiptNumber || ''} ${r.items.map(i => i.item).join(' ')}`);
      const matchesSearch = searchKey.includes(q);
      const matchesCat = categoryFilter === 'الكل' || Array.from(r.categories).includes(categoryFilter);
      
      let matchesDate = true;
      if (dateRange.from && dateRange.to) {
        matchesDate = r.date >= dateRange.from && r.date <= dateRange.to;
      } else if (dateRange.from) {
        matchesDate = r.date >= dateRange.from;
      } else if (dateRange.to) {
        matchesDate = r.date <= dateRange.to;
      }
      
      return matchesSearch && matchesCat && matchesDate;
    });
  }, [records, searchQuery, categoryFilter, dateRange]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 dark:bg-slate-900 font-tajawal" dir="rtl">
      {/* ═══ PREMIUM HEADER ═══ */}
      <div className="mx-6 mt-2 shrink-0 z-30">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-3 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0">
            
            <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start lg:pl-4 lg:border-l border-slate-200 dark:border-slate-700 shrink-0">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                     <FileText size={20} />
                  </div>
                  <div className="flex flex-col">
                     <h2 className="text-xl font-black text-[#0f2747] dark:text-white tracking-tight leading-none">أذونات الواردات</h2>
                     <p className="text-[10px] text-slate-400 font-bold mt-1">الأرشيف التاريخي لعمليات التوريد</p>
                  </div>
               </div>
            </div>

            <div className="flex-1 w-full lg:w-auto lg:px-4 relative group flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="ابحث باسم المورد أو رقم المستند..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#fcfdfc] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[13px] font-bold rounded-[14px] pr-12 pl-4 h-11 outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-teal-500/20 shadow-inner" 
                />
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                  className={`h-11 px-4 rounded-[14px] border transition-all flex items-center gap-2 ${isDateFilterOpen || dateRange.from || dateRange.to ? 'bg-teal-50 border-teal-200 text-teal-600 shadow-sm' : 'bg-[#fcfdfc] border-slate-100 text-slate-400 hover:border-slate-200'}`}
                >
                  <Calendar size={18} />
                  <span className="text-[10px] font-black">التاريخ</span>
                </button>

                {isDateFilterOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase mr-1">من تاريخ</label>
                        <input 
                          type="date" 
                          className="w-full h-9 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-bold outline-none focus:border-teal-500"
                          value={dateRange.from}
                          onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase mr-1">إلى تاريخ</label>
                        <input 
                          type="date" 
                          className="w-full h-9 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-bold outline-none focus:border-teal-500"
                          value={dateRange.to}
                          onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        />
                      </div>
                      <button 
                        onClick={() => { setDateRange({ from: '', to: '' }); setIsDateFilterOpen(false); }}
                        className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black hover:bg-rose-50 hover:text-rose-600 transition-colors mt-1"
                      >
                        إعادة تعيين
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
               <button 
                 onClick={() => setActiveView('dashboard')}
                 className="w-11 h-11 bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-[14px] flex items-center justify-center transition-all border border-rose-100 dark:border-rose-500/20 group shadow-sm shadow-rose-500/10"
                 title="العودة للرئيسية"
               >
                  <LogOut size={22} className="group-hover:-translate-x-1 transition-transform rotate-180" />
               </button>
            </div>
          </div>

          <div className="flex items-center justify-start gap-2 overflow-x-auto no-scrollbar pt-1">
             {CATS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all border whitespace-nowrap ${
                    categoryFilter === cat 
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/10' 
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:border-teal-200'
                  }`}
                >
                  {categoryIcons[cat]}
                  {cat}
                </button>
             ))}
          </div>
        </div>
      </div>

      {/* ═══ TABLE SECTION ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30 dark:bg-slate-900/50 p-6 pt-2">
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
           <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                 <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-4 text-center w-12 border-x border-slate-100">م</th>
                    <th className="px-6 py-4 text-right border-x border-slate-100">المورد</th>
                    <th className="px-6 py-4 text-center w-48 border-x border-slate-100">التاريخ</th>
                    <th className="px-6 py-4 text-center w-32 border-x border-slate-100">نوع المستند</th>
                    <th className="px-6 py-4 text-center w-40 border-x border-slate-100">رقم المستند</th>
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
                       <td colSpan="6" className="py-24 text-center text-slate-400 font-bold">لا توجد سجلات مطابقة</td>
                    </tr>
                 ) : (
                    filteredRecords.map((record, idx) => (
                       <tr 
                         key={record.id}
                         onClick={() => { setSelectedRecord(record); setIsDetailsOpen(true); }}
                         className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors h-[48px]"
                       >
                          <td className="px-4 text-center">
                             <span className="text-[11px] font-black text-slate-400 group-hover:text-teal-600 transition-colors">{idx + 1}</span>
                          </td>
                          <td className="px-6 text-right">
                             <span className={`text-sm font-black transition-colors ${
                                record.supplier === 'غير محدد' 
                                  ? 'text-slate-300 dark:text-slate-600 font-bold' 
                                  : 'text-slate-800 dark:text-white group-hover:text-teal-600'
                             }`}>
                                {record.supplier === 'غير محدد' ? 'بدون مورد' : record.supplier}
                             </span>
                          </td>
                          <td className="px-6 text-center">
                             <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md">{record.date}</span>
                          </td>
                          <td className="px-6 text-center">
                             <span className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all ${
                                record.receiptType === 'فاتورة' 
                                  ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20' 
                                  : record.receiptType === 'سند'
                                    ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20'
                                    : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800/50 dark:border-slate-700'
                             }`}>
                                {record.receiptType === 'بدون' ? 'بدون سند' : record.receiptType}
                             </span>
                          </td>
                          <td className="px-6 text-center">
                             <span className={`text-xs tabular-nums ${
                                record.receiptNumber === 'N/A' 
                                  ? 'text-slate-300 dark:text-slate-600 font-medium' 
                                  : 'text-slate-600 dark:text-slate-400 font-black'
                             }`}>
                                {record.receiptNumber === 'N/A' ? 'بدون' : record.receiptNumber}
                             </span>
                          </td>
                          <td className="px-6 text-center">
                             {record.receiptImage ? (
                                <div className="flex items-center justify-center">
                                   <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-100 transition-all shadow-sm">
                                      <ImageIcon size={14} />
                                   </div>
                                </div>
                             ) : (
                                <span className="text-[9px] font-bold text-slate-200 dark:text-slate-700 uppercase tracking-tighter">لا يوجد</span>
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
              className="w-full max-w-6xl bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-700"
            >
               <div className="px-8 py-6 bg-teal-600 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                        <FileText size={24} strokeWidth={2.5} />
                     </div>
                      <div>
                         <h3 className="text-xl font-black">تفاصيل سند إدخال - المورد: {selectedRecord.supplier || '—'}</h3>
                     </div>
                  </div>
                  <button onClick={() => setIsDetailsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                     <X size={24} />
                  </button>
               </div>

                <div className="flex-1 overflow-hidden flex">
                  {/* Left Side: Image */}
                  <div className="w-[45%] p-8 border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col order-last">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <ImageIcon size={14} className="text-teal-600" />
                        مستند الإثبات المرفق
                    </h4>
                    {selectedRecord.receiptImage ? (
                      <div className="flex-1 relative group rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl cursor-zoom-in" onClick={() => setIsImageZoomed(true)}>
                         <img 
                           src={selectedRecord.receiptImage} 
                           alt="Receipt" 
                           className="w-full h-full object-contain"
                         />
                         <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-slate-800 text-xs font-black shadow-lg">
                               انقر للتكبير
                            </div>
                         </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-slate-400">
                         <ImageIcon size={48} strokeWidth={1} className="mb-4 opacity-20" />
                         <span className="text-sm font-bold">لا يوجد مستند مرفق</span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Data */}
                  <div className="w-[55%] overflow-y-auto p-8 custom-scrollbar space-y-8">
                     <div className="grid grid-cols-4 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                           <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">المورد</span>
                           <span className="text-xs font-black text-slate-800 dark:text-white truncate block">{selectedRecord.supplier}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                           <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">التاريخ</span>
                           <span className="text-xs font-black text-slate-800 dark:text-white block">{selectedRecord.date}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                           <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">نوع المستند</span>
                           <span className="text-xs font-black text-slate-800 dark:text-white block">{selectedRecord.receiptType || 'بدون'}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                           <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">رقم المستند</span>
                           <span className="text-xs font-black text-slate-800 dark:text-white block">{selectedRecord.receiptNumber && selectedRecord.receiptNumber !== 'N/A' ? selectedRecord.receiptNumber : 'بدون'}</span>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                           <Package size={14} className="text-teal-600" />
                           قائمة الأصناف المستلمة
                        </h4>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                           <table className="w-full text-right text-[11px]">
                              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase text-[9px] tracking-widest">
                                 <tr>
                                    <th className="px-3 py-3 border-x border-slate-100 text-center w-8">م</th>
                                    <th className="px-3 py-3 border-x border-slate-100">اسم الصنف</th>
                                    <th className="px-3 py-3 border-x border-slate-100">الشركة</th>
                                    <th className="px-3 py-3 text-center border-x border-slate-100 w-16">الكمية</th>
                                    <th className="px-3 py-3 text-center border-x border-slate-100">القسم</th>
                                    <th className="px-3 py-3 text-center border-x border-slate-100">الوحدة</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                 {selectedRecord.items.map((it, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                       <td className="px-3 py-2 text-center text-slate-400 font-bold border-x border-slate-100">{idx + 1}</td>
                                       <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300 border-x border-slate-100">{it.item}</td>
                                       <td className="px-3 py-2 text-slate-500 border-x border-slate-100">{it.company || '-'}</td>
                                       <td className="px-3 py-2 text-center font-black text-teal-600 tabular-nums border-x border-slate-100">{it.qty}</td>
                                       <td className="px-3 py-2 text-center border-x border-slate-100">
                                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md text-[9px] font-black">{it.cat}</span>
                                       </td>
                                       <td className="px-3 py-2 text-center text-slate-500 border-x border-slate-100">{it.unit}</td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Zoom Overlay */}
                <AnimatePresence>
                  {isImageZoomed && selectedRecord.receiptImage && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[110] bg-slate-900/95 flex items-center justify-center p-4 cursor-zoom-out"
                      onClick={() => setIsImageZoomed(false)}
                    >
                      <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
                        <X size={32} />
                      </button>
                      <motion.img 
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        src={selectedRecord.receiptImage} 
                        alt="Zoomed Receipt" 
                        className="max-w-full max-h-full object-contain shadow-2xl"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

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
