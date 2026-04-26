import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Pencil, Trash2, FileText, Snowflake, Package, Archive, Box, AlertTriangle,
  Download, ChevronDown, CheckCircle, RotateCcw, Flame, User, ShieldCheck, ShieldX, Thermometer,
  Calendar, Home, Layers, Printer, LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import { normalizeArabic } from '../lib/arabicTextUtils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { getItemName, getCompany, getCategory, getUnit } from '../lib/itemFields';

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const categoryIcons = {
  مجمدات: <Snowflake size={18} className="text-cyan-500" />,
  بلاستيك: <Archive size={18} className="text-amber-500" />,
  تبريد: <Thermometer size={18} className="text-blue-500" />,
};
const getCatIcon = (cat) => categoryIcons[cat] || <Package size={18} className="text-slate-400" />;

const StatusBadge = ({ status }) =>
  status === 'سليم' ? (
    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-tighter">
      سليم
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-tighter">
      تالف
    </span>
  );

const ModalWrapper = ({
  title,
  isOpen,
  onClose,
  children,
  onSubmit,
  maxWidth = 'max-w-md',
  submitLabel = 'حفظ',
  submitColor = 'blue',
  loading = false,
  disableSubmit = false,
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300"
        dir="rtl"
        onMouseDown={onClose}
      >
        <motion.div
          onMouseDown={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`w-full ${maxWidth} bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]`}
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <h3 className="text-xl font-black font-tajawal text-slate-800">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"
            >
              <X size={20} className="stroke-[3]" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">{children}</div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex space-x-3 space-x-reverse justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading || disableSubmit}
                className={`px-8 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  submitColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : 
                  submitColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 
                  'bg-primary hover:bg-primary-light shadow-primary/20'
                }`}
              >
                {loading && <Box className="animate-spin" size={16} />}
                {submitLabel}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const InputClass = 'w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 block px-4 py-2.5 outline-none transition-all';
const LabelClass = 'block text-xs font-black text-slate-700 mb-1.5 transition-colors duration-300';

export default function Returns({ setActiveView }) {
  const { playSuccess, playWarning } = useAudio();
  const { currentUser, isViewer } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [companyFilter, setCompanyFilter] = useState('الكل');
  const [showHotOnly, setShowHotOnly] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({ qty: '', date: '', rep: '', status: 'سليم' });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const itemNameRef = useRef(null);
  const [bulkRep, setBulkRep] = useState('');
  const [bulkDate, setBulkDate] = useState(formatDate(new Date()));
  const [modalDrafts, setModalDrafts] = useState([]);
  const [searchNameText, setSearchNameText] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [draftQty, setDraftQty] = useState('');
  const [draftStatus, setDraftStatus] = useState('سليم');
  const [searchIdx, setSearchIdx] = useState(-1);

  // Auto-focus on item search when modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      setTimeout(() => itemNameRef.current?.focus(), 150);
    }
  }, [isAddModalOpen]);

  // Global Keyboard Shortcuts for Modals
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setIsDeleteModalOpen(false);
        setIsDetailsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: itemsData } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty');
      if (itemsData) setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty, damagedQty: d.damaged_qty })));

      const { data: transData } = await supabase.from('transactions').select('id, type, timestamp, item_id, item, company, qty, unit, cat, status, rep, beneficiary, date, batch_id, is_summary, total_qty, balance_after').order('timestamp', { ascending: false });
      if (transData) setTransactions(transData.map(d => ({ ...d, itemId: d.item_id })));
    };

    fetchInitialData();

    const channels = [
      supabase.channel('public:products:returns').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData).subscribe(),
      supabase.channel('public:transactions:returns').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData).subscribe()
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  const returnTxs = useMemo(() => transactions.filter((t) => t.type === 'return'), [transactions]);

  const itemSuggestions = useMemo(() => {
    if (!searchNameText || selectedItem) return [];
    const q = normalizeArabic(searchNameText);
    return items.filter((i) => {
      const n = normalizeArabic(getItemName(i));
      const c = normalizeArabic(getCompany(i) || '');
      return n.includes(q) || c.includes(q);
    });
  }, [items, searchNameText, selectedItem]);

  const dynamicCompanies = ['الكل', ...new Set(items.map((i) => getCompany(i)))].filter(Boolean);

  const hotMap = useMemo(() => {
    const map = {};
    const now = new Date();
    transactions.forEach((tx) => {
      const d = tx.date ? new Date(tx.date) : (tx.timestamp ? new Date(tx.timestamp) : new Date());
      if (Math.ceil(Math.abs(now - d) / 86400000) <= 7) {
        map[tx.itemId] = (map[tx.itemId] || 0) + Number(tx.qty);
      }
    });
    return map;
  }, [transactions]);

  const filtered = useMemo(
    () =>
      returnTxs
        .map((tx) => {
          const mi = items.find((i) => i.id === tx.itemId);
          return { ...tx, cat: mi ? getCategory(mi) : 'أخرى', _iid: mi?.id || tx.itemId };
        })
        .filter((tx) => {
          const sk = normalizeArabic(`${tx.item} ${tx.company} ${tx.rep || ''}`);
          return (
            sk.includes(normalizeArabic(searchQuery)) &&
            (categoryFilter === 'الكل' || tx.cat === categoryFilter) &&
            (companyFilter === 'الكل' || (tx.company || 'بدون شركة') === companyFilter) &&
            (!showHotOnly || (hotMap[tx._iid] || 0) >= 50)
          );
        }),
    [returnTxs, items, searchQuery, categoryFilter, companyFilter, showHotOnly, hotMap]
  );

  const groupedVouchers = useMemo(() => {
    const groups = {};
    returnTxs.forEach(tx => {
      const bid = tx.batch_id || tx.id;
      if (!groups[bid]) {
        groups[bid] = {
          id: bid,
          batch_id: tx.batch_id,
          rep: tx.rep || '—',
          beneficiary: tx.beneficiary || 'غير محدد',
          date: tx.date || (tx.timestamp ? formatDate(tx.timestamp) : '-'),
          timestamp: tx.timestamp,
          items: []
        };
      }
      if (!tx.is_summary) {
        groups[bid].items.push(tx);
      }
    });

    const list = Object.values(groups);

    return list.filter(v => {
      const q = normalizeArabic(searchQuery);
      const searchStr = normalizeArabic(`${v.rep} ${v.id}`);
      const matchSearch = searchStr.includes(q);
      
      const invDate = v.date ? new Date(v.date) : null;
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      let matchDate = true;
      if (invDate && invDate.toString() !== 'Invalid Date') {
        if (start) {
          start.setHours(0,0,0,0);
          if (invDate < start) matchDate = false;
        }
        if (end) {
          end.setHours(23,59,59,999);
          if (invDate > end) matchDate = false;
        }
      } else if (start || end) {
        matchDate = false;
      }

      return matchSearch && matchDate;
    }).sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date);
      const dateB = new Date(b.timestamp || b.date);
      return dateB - dateA;
    });
  }, [returnTxs, searchQuery, startDate, endDate]);

  const todayTotal = useMemo(() => {
    const t = formatDate(new Date());
    return returnTxs.reduce(
      (a, tx) => ((tx.date || (tx.timestamp ? formatDate(tx.timestamp) : '')) === t ? a + Number(tx.qty || 0) : a),
      0
    );
  }, [returnTxs]);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setSearchNameText(`${getItemName(item)} — ${getCompany(item)}`);
    setSearchIdx(-1);
    setTimeout(() => document.getElementById('returns-qty-input')?.focus(), 50);
  };

  const clearRow = () => {
    setSelectedItem(null);
    setSearchNameText('');
    setDraftQty('');
    setDraftStatus('سليم');
    setTimeout(() => itemNameRef.current?.focus(), 50);
  };

  const pushDraft = () => {
    if (!selectedItem || !draftQty || Number(draftQty) <= 0) {
      toast.error('يرجى اختيار صنف وإدخال الكمية الراجعة.');
      playWarning();
      return;
    }
    setModalDrafts((p) => [
      {
        draftId: crypto.randomUUID(),
        itemId: selectedItem.id,
        item: getItemName(selectedItem),
        company: getCompany(selectedItem),
        cat: getCategory(selectedItem),
        unit: getUnit(selectedItem),
        qty: Number(draftQty),
        status: draftStatus,
      },
      ...p,
    ]);
    playSuccess();
    clearRow();
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!modalDrafts.length) return;
    if (!bulkRep.trim()) {
      toast.error('يرجى إدخال اسم المندوب قبل تأكيد الاستلام.');
      playWarning();
      return;
    }
    setLoading(true);
    try {
      // 1. Process Stock Adjustments
      for (const draft of modalDrafts) {
        const { data: item } = await supabase.from('products').select('stock_qty, damaged_qty').eq('id', draft.itemId).single();
        if (item) {
          if (draft.status === 'سليم') {
            await supabase.from('products').update({ stock_qty: (item.stock_qty || 0) + draft.qty }).eq('id', draft.itemId);
          } else {
            await supabase.from('products').update({ damaged_qty: (item.damaged_qty || 0) + draft.qty }).eq('id', draft.itemId);
          }
        }
      }

      // 2. Create Transactions
      const batchId = `RETURN-${Date.now()}`;
      const totalQty = modalDrafts.reduce((sum, d) => sum + d.qty, 0);
      const beneficiary = bulkRep.trim();
      const now = new Date();

      const txRows = modalDrafts.map((d) => ({
        type: 'return',
        item: d.item,
        item_id: d.itemId,
        company: d.company,
        qty: d.qty,
        unit: d.unit,
        cat: d.cat,
        status: d.status,
        rep: beneficiary,
        beneficiary: beneficiary,
        date: bulkDate || now.toISOString().split('T')[0],
        timestamp: now.toISOString(),
        batch_id: batchId,
        is_summary: false
      }));

      // Add Summary Row
      txRows.push({
        type: 'return',
        item: 'ملخص مرتجع بضاعة',
        qty: totalQty,
        total_qty: totalQty,
        date: bulkDate || now.toISOString().split('T')[0],
        timestamp: now.toISOString(),
        status: 'مكتمل',
        rep: beneficiary,
        beneficiary: beneficiary,
        batch_id: batchId,
        is_summary: true
      });

      const { error: insError } = await supabase.from('transactions').insert(txRows);
      if (insError) throw insError;

      toast.success(`✅ تم تأكيد استلام المرتجع وتسجيل ${modalDrafts.length} أصناف وتحديث المخزن`);
      playSuccess();
      setModalDrafts([]);
      setBulkRep('');
      setBulkDate(formatDate(new Date()));
      setIsAddModalOpen(false);
      clearRow();
    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء المزامنة. يرجى المحاولة مرة أخرى.');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (tx) => {
    setSelectedTx(tx);
    setEditForm({
      qty: tx.qty,
      date: tx.date || formatDate(new Date()),
      rep: tx.rep || '',
      status: tx.status || 'سليم',
    });
    setIsEditModalOpen(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: item } = await supabase.from('products').select('stock_qty, damaged_qty').eq('id', selectedTx.itemId).single();
      if (item) {
        const oldQ = Number(selectedTx.qty);
        const newQ = Number(editForm.qty);
        const oldS = selectedTx.status;
        const newS = editForm.status;
        
        let stockDelta = 0;
        let damagedDelta = 0;
        
        if (oldS === 'سليم') stockDelta -= oldQ;
        else damagedDelta -= oldQ;
        
        if (newS === 'سليم') stockDelta += newQ;
        else damagedDelta += newQ;
        
        const updates = {};
        if (stockDelta !== 0) updates.stock_qty = (item.stock_qty || 0) + stockDelta;
        if (damagedDelta !== 0) updates.damaged_qty = (item.damaged_qty || 0) + damagedDelta;
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('products').update(updates).eq('id', selectedTx.itemId);
        }
      }
      
      const { error } = await supabase.from('transactions').update({
        qty: Number(editForm.qty),
        date: editForm.date,
        rep: editForm.rep,
        status: editForm.status,
      }).eq('id', selectedTx.id);
      
      if (error) throw error;
      
      toast.success('تم تعديل سند المرتجع ✅');
      playSuccess();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('خطأ في التعديل');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const openDelete = (tx) => {
    setSelectedTx(tx);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: item } = await supabase.from('products').select('stock_qty, damaged_qty').eq('id', selectedTx.itemId).single();
      if (item) {
        if (selectedTx.status === 'سليم') {
          await supabase.from('products').update({ stock_qty: Math.max(0, (item.stock_qty || 0) - Number(selectedTx.qty)) }).eq('id', selectedTx.itemId);
        } else {
          await supabase.from('products').update({ damaged_qty: Math.max(0, (item.damaged_qty || 0) - Number(selectedTx.qty)) }).eq('id', selectedTx.itemId);
        }
      }
      const { error } = await supabase.from('transactions').delete().eq('id', selectedTx.id);
      if (error) throw error;
      
      toast.success('تم حذف سند المرتجع وعكس الأثر على المخزن 🗑️');
      playSuccess();
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء الحذف');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;background:white;padding:40px;font-family:Cairo,sans-serif;direction:rtl;color:#1e293b;';
    
    el.innerHTML = `
      <div style="border:2px solid #ef4444;border-radius:24px;padding:30px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;border-bottom:3px solid #ef4444;padding-bottom:20px;">
          <div>
            <div style="font-size:28px;font-weight:900;color:#ef4444;">بركة الثمار</div>
            <div style="font-size:12px;color:#64748b;font-weight:700;">سجل المرتجعات — Returns Registry</div>
          </div>
          <div style="text-align:left;direction:ltr;">
            <div style="font-size:14px;font-weight:800;">Date: ${new Date().toLocaleDateString('ar-SA')}</div>
            <div style="font-size:12px;color:#94a3b8;">User: ${currentUser?.email || 'System'}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:14px;">
          <thead>
            <tr style="background:#ef4444;color:white;">
              <th style="padding:12px;border:1px solid #dc2626;text-align:center;width:40px;">م</th>
              <th style="padding:12px;border:1px solid #dc2626;text-align:center;">التاريخ</th>
              <th style="padding:12px;border:1px solid #dc2626;text-align:right;">الصنف والشركة</th>
              <th style="padding:12px;border:1px solid #dc2626;text-align:center;width:80px;">الكمية</th>
              <th style="padding:12px;border:1px solid #dc2626;text-align:center;width:100px;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((tx, idx) => `
              <tr style="background:${idx % 2 === 0 ? '#fff' : '#fef2f2'};">
                <td style="padding:10px;border:1px solid #fecaca;text-align:center;font-weight:700;">${idx + 1}</td>
                <td style="padding:10px;border:1px solid #fecaca;text-align:center;">${tx.date || '-'}</td>
                <td style="padding:10px;border:1px solid #fecaca;text-align:right;">
                  <div style="font-weight:800;">${tx.item}</div>
                  <div style="font-size:11px;color:#94a3b8;">${tx.company || '—'}</div>
                </td>
                <td style="padding:10px;border:1px solid #fecaca;text-align:center;font-weight:900;color:#dc2626;">${tx.qty} ${tx.unit}</td>
                <td style="padding:10px;border:1px solid #fecaca;text-align:center;">
                   <span style="font-weight:900;color:${tx.status === 'سليم' ? '#059669' : '#e11d48'}">
                    ${tx.status === 'سليم' ? 'سليم ✅' : 'تالف ❌'}
                   </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:15px;">
          نظام بركة الثمار الإلكتروني PRO • سجل المرتجعات المستخرج
        </div>
      </div>
    `;
    
    document.body.appendChild(el);
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Returns_Report_${Date.now()}.pdf`);
      toast.success('تم تصدير سجل المرتجعات كـ PDF بنجاح 📄');
    } catch (e) {
      console.error(e);
      toast.error('خطأ أثناء تصدير PDF');
    } finally {
      document.body.removeChild(el);
      setIsExportMenuOpen(false);
    }
  };

  const cv = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const kv = {
    hidden: { opacity: 0, y: 15, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-readex text-slate-800 bg-slate-50/30 overflow-hidden" dir="rtl">
      
      {/* ─── PREMIUM HEADER ─── */}
      <div className="mx-6 mt-6 shrink-0 z-20">
        <div className="bg-white border border-slate-200 rounded-[1.5rem] p-3 flex flex-col lg:flex-row items-center justify-between shadow-sm gap-4 lg:gap-0">
          
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start lg:pl-4 lg:border-l border-slate-200 shrink-0">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                   <RotateCcw size={20} />
                </div>
                <div className="flex flex-col">
                   <h2 className="text-xl font-black text-[#0f2747] tracking-tight leading-none">أذونات المرتجعات</h2>
                   <p className="text-[10px] text-slate-400 font-bold mt-1">سجل استلام بضائع المرتجع</p>
                </div>
             </div>
          </div>

          <div className="flex-1 w-full lg:w-auto lg:px-4 relative group flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              <input 
                type="text" 
                placeholder="بحث باسم المندوب أو العميل..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#fcfdfc] border border-slate-100 text-[13px] font-bold rounded-[14px] pr-12 pl-4 h-11 outline-none transition-all placeholder:text-slate-400 text-slate-800 focus:bg-white focus:border-orange-500/20 shadow-inner" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => setActiveView('dashboard')}
               className="w-11 h-11 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 rounded-[14px] flex items-center justify-center transition-all border border-rose-100 group shadow-sm shadow-rose-500/10"
               title="العودة للرئيسية"
             >
                <LogOut size={22} className="group-hover:-translate-x-1 transition-transform rotate-180" />
             </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN TABLE AREA ─── */}
      <div className="flex-1 overflow-hidden p-6 pt-4 relative">
        
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin" />
                <p className="font-bold">جاري تحميل سجلات المرتجعات...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-400 opacity-60">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                   <RotateCcw size={40} className="text-slate-300" />
                </div>
                <p className="text-lg font-black">لا توجد سجلات مرتجع مطابقة</p>
              </div>
            ) : (
              <table className="w-full text-right border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="bg-slate-50 text-[#8ba3b5] font-black text-[9px] uppercase tracking-widest border-b border-slate-200">
                    <th className="px-6 py-5 text-center w-[5%]">م</th>
                    <th className="px-6 py-5 text-right w-[35%]">اسم العميل (المسترجع)</th>
                    <th className="px-6 py-5 text-center w-[25%]">اسم المندوب</th>
                    <th className="px-6 py-5 text-center w-[15%]">عدد الأصناف</th>
                    <th className="px-6 py-5 text-center w-[20%]">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedVouchers.map((v, idx) => (
                    <tr 
                      key={v.id} 
                      onClick={() => { setSelectedVoucher(v); setIsDetailsModalOpen(true); }}
                      className="group hover:bg-orange-50/20 transition-all border-b border-slate-100 cursor-pointer"
                    >
                      <td className="px-6 py-3 text-center align-middle">
                         <span className="text-xs font-black text-slate-300 group-hover:text-orange-500 transition-colors tabular-nums">{idx + 1}</span>
                      </td>
                      <td className="px-6 py-3 text-right align-middle">
                         <span className="text-sm font-black text-slate-700 tracking-tight leading-none">{v.beneficiary || 'غير محدد'}</span>
                      </td>
                      <td className="px-6 py-3 text-center align-middle">
                         <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 group-hover:bg-white text-slate-600 rounded-lg border border-slate-200/50 transition-all">
                            <User size={12} className="text-orange-500" />
                            <span className="text-[11px] font-black">{v.rep || '—'}</span>
                         </div>
                      </td>
                      <td className="px-6 py-3 text-center align-middle">
                         <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">{v.items.length} صنف</span>
                         </div>
                      </td>
                      <td className="px-6 py-3 text-center align-middle">
                         <span className="text-[12px] font-black text-slate-500 tabular-nums">{v.date}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="px-8 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-center items-center shrink-0">
             <p className="text-[10px] font-bold text-slate-300 italic">نظام بركة الثمار PRO - سجل المرتجعات الملخص</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isDetailsModalOpen && selectedVoucher && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            dir="rtl" onClick={() => setIsDetailsModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 pb-8 border-b border-slate-100 bg-white relative shrink-0">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                       <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                          <RotateCcw size={32} />
                       </div>
                       <div className="flex flex-col text-right">
                          <h3 className="text-2xl font-black text-slate-800 tracking-tight">تفاصيل إذن المرتجع</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">عرض قائمة الأصناف التي تم استلامها</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                       <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center min-w-[110px]">
                          <span className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1">تاريخ الإذن</span>
                          <span className="text-xs font-black text-slate-600 tabular-nums">{selectedVoucher.date}</span>
                       </div>
                       <button 
                         onClick={() => setIsDetailsModalOpen(false)}
                         className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-transparent hover:border-rose-100"
                       >
                          <X size={24} strokeWidth={3} />
                       </button>
                    </div>
                 </div>
              </div>

              <div className="p-8 flex-1 overflow-auto custom-scrollbar bg-slate-50/30">
                 <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="flex flex-col gap-1.5">
                       <span className="text-[10px] font-black text-slate-400 uppercase">اسم العميل (المسترجع)</span>
                       <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                          <User size={16} className="text-orange-500" />
                          <span className="text-sm font-black text-slate-700">{selectedVoucher.beneficiary || 'غير محدد'}</span>
                       </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                       <span className="text-[10px] font-black text-slate-400 uppercase">المندوب المستلم</span>
                       <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                          <Archive size={16} className="text-orange-500" />
                          <span className="text-sm font-black text-slate-700">{selectedVoucher.rep || '—'}</span>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-right border-separate border-spacing-0 text-[11px]">
                       <thead>
                          <tr className="bg-slate-50 text-[#8ba3b5] font-black uppercase tracking-widest">
                             <th className="px-5 py-4 text-center w-12">م</th>
                             <th className="px-5 py-4 text-right">اسم الصنف</th>
                             <th className="px-5 py-4 text-center">الشركة</th>
                             <th className="px-5 py-4 text-center">الكمية</th>
                             <th className="px-5 py-4 text-center">القسم</th>
                             <th className="px-5 py-4 text-center">وحدة القياس</th>
                             <th className="px-5 py-4 text-center">الحالة</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {selectedVoucher.items.map((it, i) => (
                             <tr key={it.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-5 py-3 text-center text-slate-300 font-bold tabular-nums">{i + 1}</td>
                                <td className="px-5 py-3 font-black text-slate-700">{it.item}</td>
                                <td className="px-5 py-3 text-center font-bold text-slate-400">{it.company || '—'}</td>
                                <td className="px-5 py-3 text-center font-black text-orange-600 tabular-nums text-sm">{it.qty}</td>
                                <td className="px-5 py-3 text-center">
                                   <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-bold">{it.cat}</span>
                                </td>
                                <td className="px-5 py-3 text-center font-bold text-slate-400 uppercase">{it.unit}</td>
                                <td className="px-5 py-3 text-center">
                                   <StatusBadge status={it.status === 'completed' ? 'سليم' : it.status} />
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="px-10 py-5 bg-white border-t border-slate-100 flex justify-center shrink-0">
                 <button 
                   onClick={() => setIsDetailsModalOpen(false)}
                   className="px-20 py-3 bg-slate-800 text-white rounded-2xl font-black text-xs hover:bg-black transition-all shadow-lg shadow-slate-200"
                 >
                    إغلاق النافذة
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BULK MODAL */}
      <ModalWrapper
        title="استلام مرتجع — جلسة إدخال سريع"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleBulkSubmit}
        loading={loading}
        submitLabel={`تأكيد استلام المرتجع${modalDrafts.length ? ` (${modalDrafts.length})` : ''}`}
        submitColor="orange"
        maxWidth="max-w-5xl"
        disableSubmit={modalDrafts.length === 0}
      >
        <div className="flex flex-col space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100 relative z-20">
            <div>
              <label className={LabelClass}>
                اسم المندوب <span className="text-rose-500">*</span>
              </label>
              <div className="relative group">
                <User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 z-10 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type="text"
                  className={`${InputClass} pr-12 h-11`}
                  placeholder="اسم المندوب الراجع بالبضاعة..."
                  value={bulkRep}
                  onChange={(e) => setBulkRep(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={LabelClass}>تاريخ الاستلام</label>
              <input type="date" className={`${InputClass} h-11`} value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} required />
            </div>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-6 flex flex-col lg:flex-row gap-6 items-end overflow-visible relative z-30">
            <div className="flex-1 min-w-[280px] relative group/fi">
              <label className={LabelClass}>اسم الصنف</label>
              {selectedItem ? (
                <div className="flex items-center justify-between w-full bg-white border border-orange-200 text-orange-700 text-sm font-black rounded-xl px-4 h-11 shadow-sm">
                  <span className="truncate">
                    {getItemName(selectedItem)} — {getCompany(selectedItem)}
                  </span>
                  <button type="button" onClick={clearRow} className="text-orange-400 hover:text-orange-600 transition-colors">
                    <X size={18} className="stroke-[3]" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <input
                    ref={itemNameRef}
                    type="text"
                    className={`${InputClass} pr-12 h-11`}
                    placeholder="ابحث من مجموعة الأصناف..."
                    value={searchNameText}
                    onChange={(e) => {
                      setSearchNameText(e.target.value);
                      setSearchIdx(-1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSearchIdx((p) => (p < itemSuggestions.length - 1 ? p + 1 : p));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSearchIdx((p) => (p > 0 ? p - 1 : 0));
                      } else if (e.key === 'Enter') {
                        if (searchIdx >= 0 && itemSuggestions[searchIdx]) {
                          e.preventDefault();
                          handleSelect(itemSuggestions[searchIdx]);
                        } else if (selectedItem) {
                          e.preventDefault();
                          document.getElementById('returns-qty-input')?.focus();
                        }
                      }
                    }}
                  />
                </div>
              )}
              {!selectedItem && searchNameText && itemSuggestions.length > 0 && (
                <div className="absolute top-[110%] right-0 w-full max-h-64 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-2 mt-1 custom-scrollbar">
                  {itemSuggestions.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-right px-4 py-3 border-b border-slate-50 last:border-0 text-sm flex flex-col transition-colors rounded-xl ${
                        searchIdx === idx
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(s);
                      }}
                    >
                      <span className="font-black text-sm">{getItemName(s)}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1">
                        {getCompany(s)} • {getCategory(s)} • رصيد: {s.stockQty ?? '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0">
              <label className={LabelClass}>الحالة التقنية</label>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm h-11">
                <button
                  type="button"
                  onClick={() => setDraftStatus('سليم')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all ${
                    draftStatus === 'سليم'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  <ShieldCheck size={14} /> سليم ✅
                </button>
                <button
                  type="button"
                  onClick={() => setDraftStatus('تالف')}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all ${
                    draftStatus === 'تالف'
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <ShieldX size={14} /> تالف ❌
                </button>
              </div>
            </div>

            <div className="w-32 shrink-0">
              <label className={LabelClass}>الكمية</label>
              <input
                id="returns-qty-input"
                type="number"
                min="1"
                disabled={!selectedItem}
                className={`${InputClass} h-11 !border-orange-200 focus:!border-orange-500 text-orange-600 font-black text-center text-lg`}
                placeholder="0"
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    pushDraft();
                  }
                }}
              />
            </div>
            
            <button
              type="button"
              onClick={pushDraft}
              disabled={!selectedItem || !draftQty}
              className="h-11 px-6 bg-[#0f2747] text-white rounded-xl font-black text-sm shadow-lg shadow-blue-900/10 hover:bg-black transition-all flex items-center gap-2 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              إضافة
            </button>
          </div>

          <div className="border border-slate-100 rounded-[2.5rem] overflow-hidden flex flex-col min-h-[350px] shadow-sm bg-white relative z-10">
            <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="text-sm font-black text-slate-700">قائمة الأصناف المراجعة</h4>
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-black text-slate-400 uppercase">إجمالي الأصناف:</span>
                 <span className="text-sm font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
                   {modalDrafts.length}
                 </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
              {modalDrafts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                     <Package size={32} className="opacity-20" />
                  </div>
                  <span className="font-bold text-sm">لم يتم إضافة أي أصناف بعد.. ابدأ بالبحث عن صنف أعلاه</span>
                </div>
              ) : (
                <div className="w-full">
                  <table className="w-full text-right border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-[#8ba3b5] font-black text-[9px] uppercase tracking-widest text-center">
                        <th className="px-4 py-2 w-16">م</th>
                        <th className="px-4 py-2 text-right">بيان الصنف</th>
                        <th className="px-4 py-2">وحدة القياس</th>
                        <th className="px-4 py-2">الكمية</th>
                        <th className="px-4 py-2">الحالة</th>
                        <th className="px-4 py-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {modalDrafts.map((dr, index) => (
                          <motion.tr
                            key={dr.draftId}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-50/30 hover:bg-slate-50 transition-all group"
                          >
                            <td className="px-4 py-3 text-center text-slate-300 font-bold tabular-nums rounded-r-2xl border-y border-r border-slate-100">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3 border-y border-slate-100">
                               <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-700 leading-tight">{dr.item}</span>
                                  <span className="text-[10px] font-bold text-slate-400 mt-1">{dr.company}</span>
                               </div>
                            </td>
                            <td className="px-4 py-3 text-center border-y border-slate-100 text-xs font-bold text-slate-400">
                              {dr.unit}
                            </td>
                            <td className="px-4 py-3 text-center border-y border-slate-100">
                              <span className="text-sm font-black text-slate-700 tabular-nums">{dr.qty}</span>
                            </td>
                            <td className="px-4 py-3 text-center border-y border-slate-100">
                              <StatusBadge status={dr.status} />
                            </td>
                            <td className="px-4 py-3 text-center rounded-l-2xl border-y border-l border-slate-100">
                              <button
                                type="button"
                                onClick={() => setModalDrafts((p) => p.filter((d) => d.draftId !== dr.draftId))}
                                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all mx-auto"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      </div>
    </ModalWrapper>

      <ModalWrapper title="تعديل سند المرتجع" isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEdit} loading={loading}>
        <div className="space-y-5">
          <div>
            <label className={LabelClass}>الكمية الراجعة</label>
            <input
              type="number"
              min="1"
              className={InputClass}
              value={editForm.qty}
              onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={LabelClass}>اسم المندوب</label>
            <input
              type="text"
              className={InputClass}
              value={editForm.rep}
              onChange={(e) => setEditForm({ ...editForm, rep: e.target.value })}
              placeholder="اسم المندوب..."
            />
          </div>
          <div>
            <label className={LabelClass}>التاريخ</label>
            <input
              type="date"
              className={InputClass}
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={LabelClass}>الحالة التقنية</label>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-inner w-max">
              {['سليم', 'تالف'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: s })}
                  className={`flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-lg transition-all ${
                    editForm.status === s
                      ? s === 'سليم'
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'bg-rose-500 text-white shadow-md'
                      : 'text-slate-400 hover:bg-white hover:text-slate-600'
                  }`}
                >
                  {s === 'سليم' ? <ShieldCheck size={14} /> : <ShieldX size={14} />} {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper
        title="إلغاء سند مرتجع"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSubmit={handleDelete}
        loading={loading}
        submitLabel="نعم، إلغاء السند"
        submitColor="rose"
      >
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4 animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <h4 className="text-lg font-black mb-2">تأكيد إلغاء سند المرتجع</h4>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">سيتم عكس أثر هذا الإذن على أرصدة المخزن تلقائياً.</p>
        </div>
      </ModalWrapper>
    </div>
  );
}
