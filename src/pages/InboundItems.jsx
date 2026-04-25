import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, Search, Filter, Calendar, Package, 
  TrendingUp, ArrowLeft, Download, FileText, 
  ChevronDown, Layers, Box, Snowflake, Archive,
  LogOut, FileDown, X, Printer
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

export default function InboundItems({ setActiveView }) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    fetchInboundItems();
  }, []);

  const fetchInboundItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, item, qty, company, cat, unit, date, beneficiary, timestamp, reference_number')
        .eq('type', 'in')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching inbound items:', err);
      toast.error('حدث خطأ أثناء تحميل سجلات الوارد');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    const allItems = transactions.filter(t => !t.is_summary);
    const groups = {};
    
    allItems.forEach(it => {
      const key = `${it.item}-${it.cat}-${it.unit}`;
      if (!groups[key]) {
        groups[key] = { 
          item: it.item,
          company: it.company || 'بدون شركة',
          qty: 0,
          cat: it.cat,
          unit: it.unit,
          uniqueId: key
        };
      }
      groups[key].qty += Number(it.qty) || 0;
    });

    return Object.values(groups).filter(it => {
      const q = normalizeArabic(searchQuery);
      const matchSearch = normalizeArabic(it.item).includes(q) ||
                          normalizeArabic(it.company || '').includes(q);
      const matchCat = categoryFilter === 'الكل' || it.cat === categoryFilter;
      return matchSearch && matchCat;
    }).sort((a, b) => {
      if (a.cat === 'مجمدات' && b.cat !== 'مجمدات') return -1;
      if (a.cat !== 'مجمدات' && b.cat === 'مجمدات') return 1;
      const catOrder = (a.cat || '').localeCompare(b.cat || '', 'ar');
      if (catOrder !== 0) return catOrder;
      return a.item.localeCompare(b.item, 'ar');
    });
  }, [transactions, searchQuery, categoryFilter]);

  const groupedItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const cat = item.cat || 'أخرى';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  const handlePrintPDF = () => {
    const printContents = document.getElementById('inbound-print-content');
    if (!printContents) return;
    const printWindow = window.open('', 'PRINT', 'height=842,width=595');
    if (printWindow) {
      printWindow.document.write(`
        <html dir="rtl">
          <head>
            <title>تقرير الوارد التفصيلي</title>
            <style>
              * { box-sizing: border-box; margin:0; padding:0; }
              body { font-family: 'Tajawal', 'Arial', sans-serif; font-size: 12pt; color: #000; background: #fff; padding: 0; }
              @page { size: A4; margin: 1.5cm; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 0.75cm; }
              th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; }
              th { background: #f3f4f6; font-weight: bold; }
            </style>
          </head>
          <body>${printContents.innerHTML}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const stats = useMemo(() => {
    const totalQty = filteredItems.reduce((sum, it) => sum + Number(it.qty || 0), 0);
    const distinctItems = new Set(filteredItems.map(it => it.item)).size;
    return { totalQty, distinctItems, count: filteredItems.length };
  }, [filteredItems]);

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-readex text-slate-800 bg-slate-50/30 overflow-hidden" dir="rtl">
      
      <div className="mx-6 mt-6 shrink-0 z-20">
        <div className="bg-white border border-slate-200 rounded-[1.5rem] p-3 flex flex-col lg:flex-row items-center justify-between shadow-sm gap-4 lg:gap-0">
          
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start lg:pl-4 lg:border-l border-slate-200 shrink-0">
            <h2 className="text-xl font-black text-[#0f2747] tracking-tight">سجل الوارد</h2>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-[10px] text-slate-600 shadow-sm">
              <Package size={14} />
              <span className="text-[11px] font-black">{filteredItems.length}</span>
            </div>
          </div>

          <div className="flex-1 w-full lg:w-auto lg:px-4 relative group flex items-center">
            <Search size={18} className="absolute right-6 lg:right-8 text-slate-400 group-focus-within:text-[#0f2747] transition-colors" />
            <input 
              type="text" 
              placeholder="ابحث عن اسم الصنف أو القسم..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#f8fbf9] border border-slate-100 text-[13px] font-bold rounded-[14px] pr-12 pl-4 h-11 outline-none transition-all placeholder:text-slate-400 text-slate-800 focus:bg-slate-50 focus:border-[#0f2747]/20 shadow-inner" 
            />
          </div>

          <div className="flex items-center gap-2 pl-4 border-l border-slate-200 shrink-0">
             <button onClick={() => setIsPreviewModalOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100/50">
                <FileDown size={18} />
             </button>
             <button onClick={() => setActiveView('dashboard')} className="w-10 h-10 flex items-center justify-center rounded-[12px] bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all active:scale-95 border border-rose-100/50">
                <LogOut size={18} className="rotate-180" />
             </button>
          </div>
          
        </div>

        {/* Category Pills Row */}
        <div className="flex items-center gap-2 mt-4 justify-start overflow-x-auto pb-2 custom-scrollbar">
           <button onClick={() => setCategoryFilter('الكل')} className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[12px] font-bold transition-all shadow-sm shrink-0 ${categoryFilter === 'الكل' ? 'bg-[#0f2747] text-white border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Layers size={14} /> كل الأقسام
           </button>
           <button onClick={() => setCategoryFilter('مجمدات')} className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[12px] font-bold transition-all shadow-sm shrink-0 ${categoryFilter === 'مجمدات' ? 'bg-[#0f2747] text-white border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Snowflake size={14} /> مجمدات
           </button>
           <button onClick={() => setCategoryFilter('بلاستيك')} className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[12px] font-bold transition-all shadow-sm shrink-0 ${categoryFilter === 'بلاستيك' ? 'bg-[#0f2747] text-white border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Archive size={14} /> بلاستيك
           </button>
           <button onClick={() => setCategoryFilter('تبريد')} className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[12px] font-bold transition-all shadow-sm shrink-0 ${categoryFilter === 'تبريد' ? 'bg-[#0f2747] text-white border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Box size={14} /> تبريد
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
                <p className="font-bold">جاري تحميل السجلات...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-400 opacity-60">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                   <Package size={40} className="text-slate-300" />
                </div>
                <p className="text-lg font-black">لا توجد سجلات مطابقة</p>
              </div>
            ) : (
              <table className="w-full text-right border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="bg-slate-50 text-[#8ba3b5] font-black text-[10px] uppercase tracking-widest border-b border-slate-200">
                    <th className="px-4 py-3 text-center w-14 border-x border-slate-100">م</th>
                    <th className="px-4 py-3 text-center border-x border-slate-100">اسم الصنف الوارد</th>
                    <th className="px-4 py-3 text-center w-64 border-x border-slate-100">الشركة</th>
                    <th className="px-4 py-3 text-center w-32 border-x border-slate-100">الكمية</th>
                    <th className="px-4 py-3 text-center w-48 border-x border-slate-100">القسم</th>
                    <th className="px-4 py-3 text-center w-48 border-x border-slate-100">وحدة القياس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map((it, idx) => (
                    <tr key={it.uniqueId} className="group hover:bg-slate-50 transition-colors border-b border-slate-100">
                      <td className="px-4 py-2.5 text-center align-middle">
                         <span className="text-[11px] font-black text-slate-400">{idx + 1}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle">
                         <div className="font-bold text-sm text-slate-800 leading-none">{it.item}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle">
                         <div className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 inline-block">{it.company}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle">
                         <span className="inline-flex items-center px-3 py-1 bg-[#10b981]/5 text-[#10b981] rounded-lg text-[12px] font-black border border-[#10b981]/10 shadow-sm">
                            {it.qty}
                         </span>
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle">
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border bg-slate-50 text-slate-600 border-slate-100 text-[10px] font-black transition-all">
                            {getCatIcon(it.cat)}
                            {it.cat}
                         </span>
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle">
                         <div className="text-[11px] font-bold text-slate-600">{it.unit || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PREVIEW MODAL ═══ */}
      <AnimatePresence>
        {isPreviewModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex flex-col bg-slate-100" dir="rtl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><FileText size={20} /></div>
                <div><h3 className="text-lg font-black text-slate-800">معاينة تقرير الوارد</h3><p className="text-[11px] text-slate-500 mt-0.5">{Object.keys(groupedItems).length} قسم • {filteredItems.length} صنف</p></div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handlePrintPDF} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all active:scale-95"><Printer size={18} />طباعة التقرير</button>
                <button onClick={() => setIsPreviewModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"><X size={22} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-slate-100">
              <div id="inbound-print-content" className="w-full max-w-[210mm] mx-auto bg-white shadow-2xl border border-slate-300" style={{ padding: '1.5cm', minHeight: '297mm' }}>
                <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-black relative">
                  <div className="text-right">
                    <h2 className="text-2xl font-black font-tajawal mb-0.5 text-slate-900">بركة الثمار</h2>
                    <p className="text-lg text-slate-500 font-tajawal">مستودع الأحساء</p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2"><h1 className="text-5xl font-black font-tajawal text-slate-900">تقرير الوارد</h1></div>
                  <div className="text-left font-bold">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                {Object.keys(groupedItems).sort((a, b) => {
                  if (a === 'مجمدات') return -1;
                  if (b === 'مجمدات') return 1;
                  return a.localeCompare(b);
                }).map(cat => (
                  <div key={cat} className="mb-8">
                    <h3 className="text-xl font-black font-tajawal mb-3 text-slate-900">{cat}</h3>
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-black py-2 px-3 text-sm font-bold text-center" style={{ width: '40px' }}>م</th>
                          <th className="border border-black py-2 px-3 text-sm font-bold text-right" style={{ width: '35%' }}>اسم الصنف</th>
                          <th className="border border-black py-2 px-3 text-sm font-bold text-right" style={{ width: '25%' }}>الشركة</th>
                          <th className="border border-black py-2 px-3 text-sm font-bold text-center" style={{ width: '15%' }}>الكمية</th>
                          <th className="border border-black py-2 px-3 text-sm font-bold text-center" style={{ width: '20%' }}>وحدة القياس</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedItems[cat].map((item, idx) => (
                          <tr key={item.uniqueId}>
                            <td className="border border-black py-2 px-3 text-center text-sm">{idx + 1}</td>
                            <td className="border border-black py-2 px-3 text-right text-sm">{item.item}</td>
                            <td className="border border-black py-2 px-3 text-right text-sm">{item.company}</td>
                            <td className="border border-black py-2 px-3 text-center text-sm">{item.qty}</td>
                            <td className="border border-black py-2 px-3 text-center text-sm">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
