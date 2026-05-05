import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, 
  Snowflake, Package, Box, AlertTriangle, 
  Thermometer, LayoutGrid, Trash, 
  FileDown, Printer, LogOut, CheckCircle, CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { normalizeArabic } from '../lib/arabicTextUtils';

const CATS = ['مجمدات', 'بلاستيك', 'تبريد'];
const UNITS = ['كرتونة', 'قطعة', 'كيلو', 'لتر', 'طرد', 'علبة'];

export default function Items({ setActiveView }) {
  const { isViewer } = useAuth();
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [loading, setLoading] = useState(false);
  const [dynamicCats] = useState(CATS);
  const [dynamicUnits] = useState(UNITS);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formState, setFormState] = useState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });

  // --- LIVE SUPABASE SYNC ---
  const fetchInitialData = async () => {
    setLoading(true);
    const { data: itemsData } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty').order('name');
    if (itemsData) {
      setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInitialData();
    const itemsChannel = supabase.channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData)
      .subscribe();
    return () => supabase.removeChannel(itemsChannel);
  }, []);

  // --- FILTERING ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = normalizeArabic(searchQuery || '');
      const matchSearch = normalizeArabic(item.name || '').includes(q) || 
                          normalizeArabic(item.company || '').includes(q);
      const matchCat = activeCategory === 'الكل' || item.cat === activeCategory;
      return matchSearch && matchCat;
    }).sort((a, b) => {
      if (a.cat === 'مجمدات' && b.cat !== 'مجمدات') return -1;
      if (a.cat !== 'مجمدات' && b.cat === 'مجمدات') return 1;
      const catOrder = (a.cat || '').localeCompare(b.cat || '', 'ar');
      if (catOrder !== 0) return catOrder;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [items, searchQuery, activeCategory]);

  // --- GROUPING ---
  const groupedItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const cat = item.cat || 'أخرى';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  const openEditModal = (item) => {
    setSelectedItem(item);
    setFormState({ name: item.name, company: item.company, cat: item.cat, unit: item.unit });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.company.trim()) {
      return toast.error("يرجى إكمال البيانات المطلوبة (الاسم والشركة)");
    }
    try {
      const { error } = await supabase.from('products').update({
        name: formState.name.trim(),
        company: formState.company.trim(),
        cat: formState.cat,
        unit: formState.unit,
        search_key: normalizeArabic(`${formState.name} ${formState.company}`),
      }).eq('id', selectedItem.id);
      if (error) throw error;
      toast.success("تم التعديل بنجاح ✅");
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error("حدث خطأ أثناء التعديل.");
    }
  };

  const openDeleteModal = (item) => {
    if (item.stockQty > 0) {
      toast.error(`لا يمكن حذف المادة "${item.name}" لوجود رصيد حالي (${item.stockQty}) بالمخزن ⛔`);
      return;
    }
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('products').delete().eq('id', selectedItem.id);
      if (error) throw error;
      toast.success("تم الحذف بنجاح 🗑️");
      setIsDeleteModalOpen(false);
    } catch (err) {
      toast.error("حدث خطأ أثناء الحذف.");
    }
  };

  const handlePrintPDF = () => {
    const printContents = document.getElementById('a4-preview-content');
    if (!printContents) return;
    const printWindow = window.open('', 'PRINT', 'height=842,width=595');
    if (printWindow) {
      printWindow.document.write(`
        <html dir="rtl">
          <head>
            <title>دليل الأصناف</title>
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

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2 font-readex h-full overflow-hidden" dir="rtl">
      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 flex items-center gap-3 flex-wrap bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex items-center gap-2.5 shrink-0 px-2">
          <h1 className="text-2xl font-black font-tajawal tracking-tight text-slate-900 dark:text-white leading-none">دليل الأصناف</h1>
          <span className="rounded-full bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 text-[11px] font-black tabular-nums flex items-center gap-1">
            <Package size={11} />{filteredItems.length}
          </span>
        </div>

        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

        <div className="relative flex-1 min-w-[250px] group">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none" />
          <input
            type="text" dir="rtl"
            placeholder="ابحث عن اسم الصنف أو الشركة المنتجة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-bold rounded-2xl pr-12 pl-4 py-3 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all placeholder:text-slate-400 text-center"
          />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setActiveView && setActiveView('dashboard')} title="العودة للرئيسية" className="flex items-center justify-center w-11 h-11 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-2xl transition-all hover:bg-rose-100 hover:scale-105 active:scale-95"><LogOut size={20} strokeWidth={2.5} className="rotate-180" /></button>
          <button onClick={() => setIsPreviewModalOpen(true)} title="معاينة الدليل" className="flex items-center justify-center w-11 h-11 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-2xl transition-all hover:bg-emerald-100 hover:scale-105 active:scale-95"><FileDown size={20} strokeWidth={2.5} /></button>
        </div>
      </div>

      {/* ═══ CATEGORY HUB ═══ */}
      <div className="shrink-0 flex gap-2 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar no-scrollbar" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => setActiveCategory('الكل')} className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2.5 ${activeCategory === 'الكل' ? 'bg-[#0F2747] border-[#0F2747] shadow-lg shadow-[#0F2747]/20 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 hover:bg-slate-50 hover:border-slate-200'}`}>
          <LayoutGrid size={16} strokeWidth={activeCategory === 'الكل' ? 2.5 : 2} />
          <span className="font-tajawal font-bold text-xs pt-0.5">كل الأقسام</span>
        </button>
        {dynamicCats.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2.5 ${activeCategory === cat ? 'bg-primary border-primary shadow-lg shadow-primary/20 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 hover:bg-slate-50 hover:border-slate-200'}`}>
            {cat === 'مجمدات' ? <Snowflake size={16} strokeWidth={activeCategory === cat ? 2.5 : 2} /> : cat === 'تبريد' ? <Thermometer size={16} strokeWidth={activeCategory === cat ? 2.5 : 2} /> : <Box size={16} strokeWidth={activeCategory === cat ? 2.5 : 2} />}
            <span className="font-tajawal font-bold text-xs pt-0.5">{cat}</span>
          </button>
        ))}
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 w-12 border-x border-slate-100">م</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 border-x border-slate-100">اسم الصنف</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 w-48 border-x border-slate-100">الشركة</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 w-32 border-x border-slate-100">القسم</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 w-32 border-x border-slate-100">وحدة القياس</th>
                <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 w-28 border-x border-slate-100">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={item.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-100">
                  <td className="px-4 py-2.5 text-center align-middle"><span className="text-[11px] font-black text-slate-400">{idx + 1}</span></td>
                  <td className="px-4 py-2.5 text-center align-middle"><div className="font-tajawal font-bold text-sm text-slate-800 dark:text-white leading-none">{item.name}</div></td>
                  <td className="px-4 py-2.5 text-center align-middle"><div className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 inline-block">{item.company || 'بدون شركة'}</div></td>
                  <td className="px-4 py-2.5 text-center align-middle"><span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg border bg-slate-50 text-slate-600 border-slate-100">{item.cat}</span></td>
                  <td className="px-4 py-2.5 text-center align-middle"><div className="text-[11px] font-bold text-slate-600">{item.unit}</div></td>
                  <td className="px-4 py-2.5 text-center align-middle">
                    {!isViewer && (
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button onClick={() => openEditModal(item)} className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"><Pencil size={15} /></button>
                        <button onClick={() => openDeleteModal(item)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      <ModalWrapper 
        title="تعديل بيانات الصنف" 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSubmit={handleEditSubmit}
        maxWidth="max-w-lg"
        icon={<Pencil className="text-primary" size={24} />}
      >
        <div className="grid grid-cols-1 gap-6 py-2">
          {/* Item Name */}
          <div className="space-y-2 text-right">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">اسم الصنف الكامل</label>
            <div className="relative group">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                <Package size={18} />
              </div>
              <input 
                type="text" 
                className="w-full h-[42px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pr-10 pl-4 text-sm font-bold outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all text-right"
                placeholder="مثال: دجاج ساديا 800جم"
                value={formState.name} 
                onChange={e => setFormState({ ...formState, name: e.target.value })} 
              />
            </div>
          </div>

          {/* Company */}
          <div className="space-y-2 text-right">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">الشركة / المورد</label>
            <div className="relative group">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                <Box size={18} />
              </div>
              <input 
                type="text" 
                className="w-full h-[42px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pr-10 pl-4 text-sm font-bold outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all text-right"
                placeholder="اسم الشركة المنتجة..."
                value={formState.company} 
                onChange={e => setFormState({ ...formState, company: e.target.value })} 
              />
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 text-right">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">القسم</label>
              <div className="relative group">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none">
                  <LayoutGrid size={18} />
                </div>
                <select 
                  className="w-full h-[42px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pr-10 pl-4 text-xs font-black outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer text-center"
                  value={formState.cat} 
                  onChange={e => setFormState({ ...formState, cat: e.target.value })}
                >
                  {dynamicCats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-1">وحدة القياس</label>
              <div className="relative group">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none">
                  <FileText size={18} />
                </div>
                <select 
                  className="w-full h-[42px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pr-10 pl-4 text-xs font-black outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer text-center"
                  value={formState.unit} 
                  onChange={e => setFormState({ ...formState, unit: e.target.value })}
                >
                  {dynamicUnits.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* ═══ DELETE MODAL ═══ */}
      <ModalWrapper title="حذف صنف" isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onSubmit={handleDeleteSubmit} submitLabel="حذف الصنف" submitDisabled={false}>
        <div className="text-center py-4"><div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div><p className="text-sm font-bold text-slate-600 mb-2">هل أنت متأكد من حذف الصنف؟</p><p className="text-lg font-black text-slate-900">{selectedItem?.name}</p><p className="text-xs text-slate-400 mt-2">لا يمكن التراجع عن هذه العملية.</p></div>
      </ModalWrapper>

      {/* ═══ PREVIEW MODAL ═══ */}
      <AnimatePresence>
        {isPreviewModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex flex-col bg-slate-100" dir="rtl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><FileText size={20} /></div>
                <div><h3 className="text-lg font-black font-tajawal text-slate-800">معاينة دليل الأصناف</h3><p className="text-[11px] text-slate-500 mt-0.5">{Object.keys(groupedItems).length} قسم • {filteredItems.length} صنف</p></div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handlePrintPDF} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-primary/90"><Printer size={18} />طباعة PDF</button>
                <button onClick={() => setIsPreviewModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"><X size={22} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-slate-100">
              <div id="a4-preview-content" className="w-full max-w-[210mm] mx-auto bg-white shadow-2xl border border-slate-300" style={{ padding: '1.5cm', minHeight: '297mm' }}>
                <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-black relative">
                  <div className="text-right">
                    <h2 className="text-2xl font-black font-tajawal mb-0.5 text-slate-900">بركة الثمار</h2>
                    <p className="text-lg text-slate-500 font-tajawal">مستودع الأحساء</p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2"><h1 className="text-5xl font-black font-tajawal text-slate-900">دليل الأصناف</h1></div>
                  <div className="text-left font-bold">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                {Object.keys(groupedItems).sort((a, b) => {
                  if (a === 'مجمدات') return -1;
                  if (b === 'مجمدات') return 1;
                  return a.localeCompare(b);
                }).map(cat => (
                  <div key={cat} className="mb-8">
                    <h3 className="text-xl font-black font-tajawal mb-3 text-slate-900">{cat}</h3>
                    <table className="w-full">
                      <thead><tr className="bg-gray-100"><th className="border border-black py-2 px-3 text-sm font-bold w-16">م</th><th className="border border-black py-2 px-3 text-sm font-bold">اسم الصنف</th><th className="border border-black py-2 px-3 text-sm font-bold w-32">وحدة القياس</th></tr></thead>
                      <tbody>{groupedItems[cat].map((item, idx) => (<tr key={item.id}><td className="border border-black py-2 px-3 text-center text-sm">{idx + 1}</td><td className="border border-black py-2 px-3 text-right text-sm">{item.name} - {item.company}</td><td className="border border-black py-2 px-3 text-center text-sm">{item.unit}</td></tr>))}</tbody>
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

// --- SHARED MODAL COMPONENT ---
const ModalWrapper = ({ title, icon, isOpen, onClose, children, onSubmit, submitDisabled = false, maxWidth = "max-w-md", submitLabel = "حفظ التغييرات" }) => {
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all" 
          dir="rtl" 
          onClick={onClose}
        >
          <motion.div 
            onClick={(e) => e.stopPropagation()} 
            initial={{ opacity: 0, scale: 0.95, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 10 }} 
            className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 shrink-0">
              <div className="flex items-center gap-4">
                {icon && <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700">{icon}</div>}
                <div>
                  <h3 className="text-xl font-black font-tajawal text-slate-800 dark:text-white tracking-tight">{title}</h3>
                  <p className="text-[10px] text-slate-400 font-readex mt-1 font-bold uppercase tracking-widest">تحديث البيانات في النظام</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={onClose} 
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            {onSubmit ? (
              <form onSubmit={onSubmit} className="flex flex-col">
                <div className="p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
                  {children}
                </div>
                <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
                  <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-6 py-3 rounded-xl text-xs font-black text-slate-500 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                  >
                    إلغاء
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitDisabled} 
                    className="px-10 py-3 rounded-xl text-xs font-black text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
                  >
                    <CheckCircle size={16} />
                    {submitLabel}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-8 overflow-y-auto custom-scrollbar">
                {children}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
