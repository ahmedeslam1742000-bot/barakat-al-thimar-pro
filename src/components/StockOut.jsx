import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, CheckCircle, ArrowUpRight, Flame, User, Printer, Calendar, Layers, LogOut,
  Sparkles, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { normalizeArabic } from '../lib/arabicTextUtils';
import { formatDate } from '../lib/dateUtils';

const categoryIcons = {
  'مجمدات': <Snowflake size={18} className="text-cyan-500" />,
  'بلاستيك': <Archive size={18} className="text-amber-500" />,
  'تبريد': <Box size={18} className="text-blue-500" />
};
const getCatIcon = (catName) => categoryIcons[catName] || <Package size={18} className="text-slate-500" />;

export default function StockOut({ setActiveView }) {
  const { playSuccess } = useAudio();
  const { currentUser } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const { data: itemsData } = await supabase.from('products').select('*');
      if (itemsData) setItems(itemsData);
      
      const { data: transData } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
      if (transData) setTransactions(transData);
      setLoading(false);
    };
    fetchInitialData();
    const channel = supabase.channel('stock-out-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [previewInv, setPreviewInv] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // --- ESC KEY LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDetailsModalOpen(false);
        setPreviewInv(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset page when preview changes
  useEffect(() => {
    if (previewInv) setPreviewPage(1);
  }, [previewInv]);

  const stockOutTransactions = useMemo(() => 
    transactions.filter(t => t.type === 'out' || t.type === 'Issue' || t.type === 'outward' || t.type === 'سند إخراج' || t.status === 'مفوتر'), 
  [transactions]);

  const groupedInvoices = useMemo(() => {
    const groups = {};
    stockOutTransactions.forEach(tx => {
      const bid = tx.batch_id || tx.id;
      if (!groups[bid]) {
        groups[bid] = {
          id: bid,
          batch_id: tx.batch_id,
          rep: tx.rep || tx.recipient || tx.beneficiary || 'غير محدد',
          date: tx.date || (tx.timestamp ? formatDate(new Date(tx.timestamp)) : '-'),
          timestamp: tx.timestamp,
          items: [],
          receipt_image: tx.receipt_image,
          kind: (tx.type === 'outward' || tx.type === 'سند إخراج') ? 'سند' : 'مبيعات'
        };
      }
      
      const lookupItem = (id, name, company) => {
        const found = items.find(i => i.id === id || (normalizeArabic(i.name) === normalizeArabic(name) && normalizeArabic(i.company || '') === normalizeArabic(company || '')));
        return found || {};
      };

      if (tx.items_summary && Array.isArray(tx.items_summary) && groups[bid].items.length === 0) {
        groups[bid].items = tx.items_summary.map(it => {
          const info = lookupItem(it.id, it.item, it.company);
          return { ...it, cat: it.cat || info.cat || 'أخرى', unit: it.unit || info.unit || 'وحدة' };
        });
      } else if (!tx.items_summary) {
        if (tx.is_summary || (tx.item && tx.item.includes('ملخص'))) return;
        
        const info = lookupItem(tx.item_id, tx.item, tx.company);
        const alreadyHas = groups[bid].items.find(it => it.item === tx.item && it.qty === tx.qty);
        if (!alreadyHas) {
          groups[bid].items.push({
            id: tx.item_id,
            item: tx.item,
            company: tx.company,
            qty: tx.qty,
            unit: tx.unit || info.unit || 'وحدة',
            cat: tx.cat || info.cat || 'أخرى'
          });
        }
      }
    });
    return Object.values(groups).filter(inv => {
      const q = normalizeArabic(searchQuery);
      return normalizeArabic(`${inv.rep}`).includes(q);
    }).sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
  }, [stockOutTransactions, searchQuery, items]);

  const openInvoiceDetails = (inv) => {
    setSelectedInvoice(inv);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-readex text-slate-800 bg-slate-50/30 overflow-hidden" dir="rtl">
      <div className="mx-6 mt-6 shrink-0 z-20">
        <div className="bg-white border border-slate-200 rounded-[1.5rem] p-3 flex flex-col lg:flex-row items-center justify-between shadow-sm gap-4 lg:gap-0">
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start lg:pl-4 lg:border-l border-slate-200 shrink-0">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                   <ArrowUpRight size={20} />
                </div>
                 <div className="flex flex-col">
                    <h2 className="text-xl font-black text-[#0f2747] tracking-tight leading-none">سجل الفواتير</h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">عرض وإدارة كافة الفواتير المصدرة</p>
                 </div>
             </div>
          </div>
          <div className="flex-1 w-full lg:w-auto lg:px-4 relative group flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input type="text" placeholder="ابحث باسم المندوب..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#fcfdfc] border border-slate-100 text-[13px] font-bold rounded-[14px] pr-12 pl-4 h-11 outline-none transition-all placeholder:text-slate-400 text-slate-800 focus:bg-white focus:border-indigo-500/20 shadow-inner" />
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setActiveView('dashboard')} className="w-11 h-11 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 rounded-[14px] flex items-center justify-center transition-all border border-rose-100 group shadow-sm shadow-rose-500/10">
                <LogOut size={22} className="group-hover:-translate-x-1 transition-transform rotate-180" />
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6 pt-4">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin" />
                <p className="font-bold">جاري تحميل سجلات الفواتير...</p>
              </div>
            ) : groupedInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-400 opacity-60">
                <ArrowUpRight size={40} className="text-slate-200" />
                <p className="text-lg font-black">لا توجد سجلات</p>
              </div>
            ) : (
              <table className="w-full text-right border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <tr className="bg-slate-50 text-slate-400 font-black text-[11px] uppercase tracking-widest border-b border-slate-200">
                    <th className="px-4 py-3 text-center w-16">م</th>
                    <th className="px-4 py-3 text-right w-1/4">اسم المندوب / المستلم</th>
                    <th className="px-4 py-3 text-center w-56">نوع الفاتورة</th>
                    <th className="px-4 py-3 text-center w-56">عدد الأصناف</th>
                    <th className="px-4 py-3 text-center w-64">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedInvoices.map((inv, idx) => (
                    <tr key={inv.id} onClick={() => setPreviewInv(inv)} className="group hover:bg-indigo-50/10 transition-all border-b border-slate-100 cursor-pointer">
                      <td className="px-4 py-2 text-center align-middle">
                         <span className="text-[13px] font-bold text-slate-400 tabular-nums">{idx + 1}</span>
                      </td>
                      <td className="px-4 py-2 text-right align-middle">
                         <span className="text-[15px] font-black text-slate-700 tracking-tight">{inv.rep}</span>
                      </td>
                      <td className="px-4 py-2 text-center align-middle">
                         <span className={`px-2 py-0.5 rounded text-[12px] font-black border ${inv.kind === 'سند' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                             {inv.kind === 'سند' ? 'فاتورة سند' : 'فاتورة مبيعات'}
                         </span>
                      </td>
                      <td className="px-4 py-2 text-center align-middle">
                         <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100 text-[12px] font-black">
                            <Layers size={11} />
                            <span>{inv.items.length} صنف</span>
                         </div>
                      </td>
                       <td className="px-4 py-2 text-center align-middle">
                          <span className="text-[13px] font-bold text-slate-500 tabular-nums">{inv.date}</span>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isDetailsModalOpen && selectedInvoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl" onClick={() => setIsDetailsModalOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white" onClick={e => e.stopPropagation()}>
              
              {/* Lighter Premium Header */}
              <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 p-8 relative shrink-0">
                 <div className="absolute top-0 right-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                 <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                       <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/30 shadow-xl">
                          <User size={32} />
                       </div>
                       <div className="flex flex-col text-right">
                          <h3 className="text-2xl font-black text-white tracking-tight">{selectedInvoice.rep}</h3>
                          <div className="flex items-center gap-3 mt-2">
                             <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-lg border border-white/20">
                                <Calendar size={12} className="text-white" />
                                <span className="text-[11px] font-bold text-white tabular-nums">{selectedInvoice.date}</span>
                             </div>
                             <div className={`px-3 py-1 rounded-lg text-[10px] font-black border ${selectedInvoice.kind === 'سند' ? 'bg-indigo-700/40 text-white border-white/20' : 'bg-emerald-500 text-white border-emerald-400'}`}>
                                 {selectedInvoice.kind === 'سند' ? 'فاتورة سند' : 'فاتورة مبيعات'}
                             </div>
                          </div>
                       </div>
                    </div>
                    <button onClick={() => setIsDetailsModalOpen(false)} className="p-3 text-white/60 hover:text-white hover:bg-white/20 rounded-2xl transition-all">
                       <X size={24} strokeWidth={3} />
                    </button>
                 </div>
              </div>

              <div className="p-8 flex-1 overflow-auto custom-scrollbar bg-slate-50/50">
                 <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <table className="w-full text-right border-separate border-spacing-0">
                       <thead>
                          <tr className="bg-slate-50/80 text-slate-500 font-black text-[10px] uppercase tracking-widest border-b border-slate-200">
                             <th className="px-6 py-4 text-center w-12">م</th>
                             <th className="px-6 py-4">اسم الصنف</th>
                             <th className="px-6 py-4 text-center w-32">القسم</th>
                             <th className="px-6 py-4 text-center w-28 whitespace-nowrap">وحدة القياس</th>
                             <th className="px-6 py-4 text-center w-24">الكمية</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {selectedInvoice.items.map((it, i) => (
                             <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-3.5 text-center text-[11px] font-bold text-slate-300 tabular-nums">{i + 1}</td>
                                <td className="px-6 py-3.5">
                                   <span className="text-[13px] font-black text-slate-700 whitespace-nowrap">{it.item} - {it.company || 'بدون شركة'}</span>
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                   <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                                      it.cat === 'مجمدات' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                                      it.cat === 'تبريد' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                      it.cat === 'بلاستيك' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                      'bg-slate-100 text-slate-600 border-slate-200'
                                   }`}>
                                      {it.cat || 'أخرى'}
                                   </span>
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                   <span className="text-[11px] font-black text-slate-500 whitespace-nowrap">{it.unit || 'وحدة'}</span>
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                   <span className="text-[15px] font-black text-indigo-600 tabular-nums">{it.qty}</span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="px-10 py-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                 <div className="text-[11px] font-black text-slate-400">إجمالي الأصناف: {selectedInvoice.items.length} صنف</div>
                 <button onClick={() => setIsDetailsModalOpen(false)} className="px-12 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">إغلاق</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewInv && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setPreviewInv(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200"><Sparkles size={16} /></div>
                  <div>
                    <h3 className="text-md font-black text-slate-800 font-tajawal">معاينة الفاتورة</h3>
                    <p className="text-[9px] text-slate-400 font-bold">توليد تلقائي من السجلات</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => setPreviewInv(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><X size={18} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 bg-slate-100/50 custom-scrollbar flex justify-center items-start">
                <div 
                  className="bg-white border-2 border-slate-200 shadow-2xl rounded-3xl p-10 print:shadow-none print:p-0 print:border-none relative mx-auto origin-top" 
                  style={{ 
                    width: '210mm', 
                    minHeight: '297mm', 
                    direction: 'rtl', 
                    fontFamily: "'Tajawal', sans-serif", 
                    color: '#0f172a', 
                    display: 'flex', 
                    flexDirection: 'column',
                    transform: 'scale(0.7)', /* Set to exactly 70% */
                    marginBottom: '-30%' /* Adjusted for 70% scale */
                  }}
                >
                  
                  {/* Header Section */}
                  <div className="flex justify-between items-start mb-14 relative pt-2">
                    {/* Right: Logo */}
                    <div className="w-1/3 flex justify-start">
                      <img src="/src/logo.jpg" alt="بركة الثمار" className="h-24 w-auto object-contain mix-blend-multiply" style={{ filter: 'contrast(1.1) brightness(1.05)', marginLeft: 'auto' }} onError={(e) => e.target.style.display='none'} />
                    </div>

                    {/* Center: Title */}
                    <div className="w-1/3 flex justify-center mt-4">
                      <h1 className="text-5xl font-black text-slate-900 relative" style={{ fontFamily: "'Reem Kufi', 'Changa', sans-serif", letterSpacing: '-2px' }}>
                        فاتورة
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-indigo-600 rounded-full"></div>
                      </h1>
                    </div>

                    {/* Left: Invoice Info */}
                    <div className="w-1/3 flex flex-col items-end text-right mt-1">
                      <div className="flex flex-col gap-2 text-[14px] font-bold text-slate-600">
                        {previewInv.batchId && (
                           <div className="flex items-center justify-end gap-3 mb-1">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">رقم المرجع:</span>
                              <span className="text-[11px] text-slate-900 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md tabular-nums">#{previewInv.batchId.slice(-8).toUpperCase()}</span>
                           </div>
                        )}
                        <div className="flex items-center justify-end gap-3">
                           <span className="text-slate-400">التاريخ:</span>
                           <span className="text-slate-900 tabular-nums">{previewInv.date}</span>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                           <span className="text-slate-400">النوع:</span>
                           <span className="text-slate-900">{previewInv.kind === 'سند' ? 'فاتورة سند' : 'فاتورة مبيعات'}</span>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                           <span className="text-slate-400">المستفيد:</span>
                           <span className="text-slate-900 font-black text-[16px]">{previewInv.recipient || previewInv.beneficiary || previewInv.rep || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table Section */}
                  <div className="flex-1 mt-4">
                    <table className="w-full border-separate border-spacing-0">
                      <thead className="bg-slate-100/80">
                        <tr>
                          <th className="py-4 px-3 text-center text-[12px] font-black text-slate-600 w-12 rounded-r-xl">م</th>
                          <th className="py-4 px-4 text-right text-[12px] font-black text-slate-600">اسم الصنف</th>
                          <th className="py-4 px-4 text-center text-[12px] font-black text-slate-600 w-32">التصنيف</th>
                          <th className="py-4 px-4 text-center text-[12px] font-black text-slate-600 w-28">الكمية</th>
                          <th className="py-4 px-3 text-center text-[12px] font-black text-slate-600 w-24 rounded-l-xl">الوحدة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewInv.items.slice((previewPage - 1) * ITEMS_PER_PAGE, previewPage * ITEMS_PER_PAGE).map((it, i) => (
                          <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-6 px-3 text-center text-[13px] font-bold text-slate-400">{(previewPage - 1) * ITEMS_PER_PAGE + i + 1}</td>
                            <td className="py-6 px-4">
                                <span className="text-[16px] font-black text-slate-800">
                                  {it.item} {it.company && it.company !== 'بدون شركة' ? <span className="text-slate-400 font-bold text-[14px]"> - {it.company}</span> : ''}
                                </span>
                            </td>
                            <td className="py-6 px-4 text-center">
                              <span className="text-[13px] font-bold text-slate-500">{it.cat || '—'}</span>
                            </td>
                            <td className="py-6 px-4 text-center">
                               <span className="text-[18px] font-black text-slate-900 tabular-nums">{it.qty}</span>
                            </td>
                            <td className="py-6 px-3 text-center">
                               <span className="text-[13px] font-bold text-slate-500">{it.unit || 'كرتونة'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {Math.ceil(previewInv.items.length / ITEMS_PER_PAGE) > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6 print:hidden">
                      {Array.from({ length: Math.ceil(previewInv.items.length / ITEMS_PER_PAGE) }).map((_, idx) => (
                        <button 
                          key={idx}
                          onClick={() => setPreviewPage(idx + 1)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black transition-all ${previewPage === idx + 1 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Footer Section */}
                  <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                       <p className="text-[11px] font-black text-slate-400">ملاحظات</p>
                       <p className="text-[12px] font-bold text-slate-500">هذه الفاتورة صدرت إلكترونياً ولا تحتاج إلى توقيع.</p>
                    </div>
                    
                    <div className="flex items-center gap-6">
                       <div className="flex flex-col items-end">
                          <span className="text-[11px] font-black text-slate-400 mb-1">إجمالي الأصناف</span>
                          <span className="text-[24px] font-black text-indigo-600 tabular-nums leading-none">{previewInv.items.length}</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 text-center">
                     <p className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">Baraket Althemar System • {new Date().getFullYear()}</p>
                  </div>
                </div>
              </div>
              <div className="px-8 py-5 bg-white border-t border-slate-100 flex items-center justify-center shrink-0">
                 <button onClick={() => setPreviewInv(null)} className="px-16 py-3 bg-indigo-600 text-white rounded-2xl text-[14px] font-black shadow-xl shadow-indigo-200 hover:scale-105 transition-all active:scale-95">إغلاق المعاينة</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
