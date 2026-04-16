import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, CheckCircle, ArrowUpRight, Flame, User, Printer
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

// --- HELPERS ---
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const categoryIcons = {
  'مجمدات': <Snowflake size={18} className="text-cyan-500" />,
  'بلاستيك': <Archive size={18} className="text-amber-500" />,
  'تبريد': <Box size={18} className="text-blue-500" />
};
const getCatIcon = (catName) => categoryIcons[catName] || <Package size={18} className="text-slate-500" />;

// --- MODAL WRAPPER ---
const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-md", submitLabel = "حفظ", submitColor = "blue", loading = false, disableSubmit = false }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" 
        dir="rtl" onMouseDown={onClose}
      >
        <motion.div 
          onMouseDown={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <h3 className="text-lg font-black text-slate-800">{title}</h3>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
              <X size={20} className="stroke-[3]" />
            </button>
          </div>
          <form onSubmit={onSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex space-x-3 space-x-reverse justify-end shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">إلغاء</button>
              <button type="submit" disabled={loading || disableSubmit} className={`px-6 py-2 rounded-xl font-bold text-white flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${submitColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : submitColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
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

const InputClass = "w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 block px-4 py-2.5 outline-none transition-all";
const LabelClass = "block text-xs font-black text-slate-700 mb-1.5";

export default function StockOut() {
  const { playSuccess, playWarning } = useAudio();
  const { currentUser, isViewer } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [companyFilter, setCompanyFilter] = useState('الكل');
  const [showHotOnly, setShowHotOnly] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({ qty: '', date: '', recipient: '' });

  // Bulk Modal State
  const itemNameRef = useRef(null);
  const [bulkRecipient, setBulkRecipient] = useState('');
  const [bulkDate, setBulkDate] = useState(formatDate(new Date()));
  const [modalDrafts, setModalDrafts] = useState([]);
  const [searchNameText, setSearchNameText] = useState('');
  const [selectedItemModel, setSelectedItemModel] = useState(null);
  const [draftQty, setDraftQty] = useState('');
  const [itemSearchActiveIndex, setItemSearchActiveIndex] = useState(-1);

  // --- SUPABASE SYNC ---
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
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (isEditModalOpen) setIsEditModalOpen(false);
        if (isDeleteModalOpen) setIsDeleteModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isAddModalOpen, isEditModalOpen, isDeleteModalOpen]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: itemsData } = await supabase.from('products').select('*');
      if (itemsData) {
        setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty, searchKey: d.search_key, createdAt: d.created_at })));
      }
      
      const { data: transData } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
      if (transData) {
        setTransactions(transData.map(d => ({ ...d, itemId: d.item_id, balanceAfter: d.balance_after, expiryDate: d.expiry_date })));
      }
    };
    
    fetchInitialData();

    const itemsChannel = supabase.channel('public:products:stockout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData)
      .subscribe();

    const transChannel = supabase.channel('public:transactions:stockout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData)
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(transChannel);
    };
  }, []);

  const stockOutTransactions = useMemo(() => transactions.filter(t => t.type === 'صادر'), [transactions]);

  // Autocomplete suggestions (name + company pairing)
  const itemSuggestions = useMemo(() => {
    if (!searchNameText || selectedItemModel) return [];
    return items.filter(i =>
      i.name.toLowerCase().includes(searchNameText.toLowerCase()) ||
      (i.company || '').toLowerCase().includes(searchNameText.toLowerCase())
    );
  }, [items, searchNameText, selectedItemModel]);

  const dynamicCompanies = ['الكل', ...new Set(items.map(i => i.company || 'بدون شركة'))].filter(Boolean);

  // Hot items map (high velocity in last 7 days from BOTH in/out)
  const hotItemsMap = useMemo(() => {
    const map = {};
    const now = new Date();
    transactions.forEach(tx => {
      const txDate = tx.date ? new Date(tx.date) : (tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date());
      const diffDays = Math.ceil(Math.abs(now - txDate) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        if (!map[tx.itemId]) map[tx.itemId] = 0;
        map[tx.itemId] += Number(tx.qty);
      }
    });
    return map;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return stockOutTransactions.map(tx => {
      const matchedItem = items.find(i => i.id === tx.itemId || (i.name === tx.item && (i.company || 'بدون شركة') === (tx.company || 'بدون شركة')));
      return { ...tx, cat: matchedItem ? matchedItem.cat : 'أخرى', _itemId: matchedItem ? matchedItem.id : tx.itemId };
    }).filter(tx => {
      const searchKey = `${tx.item} ${tx.company} ${tx.recipient || ''}`.toLowerCase();
      const matchSearch = searchKey.includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'الكل' || tx.cat === categoryFilter;
      const matchComp = companyFilter === 'الكل' || (tx.company || 'بدون شركة') === companyFilter;
      const matchHot = showHotOnly ? ((hotItemsMap[tx._itemId] || 0) >= 50) : true;
      return matchSearch && matchCat && matchComp && matchHot;
    });
  }, [stockOutTransactions, items, searchQuery, categoryFilter, companyFilter, showHotOnly, hotItemsMap]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(tx => {
      const cat = tx.cat || 'أخرى';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const todayTotal = useMemo(() => {
    const todayStr = formatDate(new Date());
    return stockOutTransactions.reduce((acc, tx) => {
      const txDate = tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '');
      return txDate === todayStr ? acc + Number(tx.qty || 0) : acc;
    }, 0);
  }, [stockOutTransactions]);

  // --- BULK MODAL ACTIONS ---
  const handleSelectSuggestion = (itemObj) => {
    setSelectedItemModel(itemObj);
    setSearchNameText(`${itemObj.name} - ${itemObj.company || 'بدون شركة'}`);
    setItemSearchActiveIndex(-1);
    // Auto jump to qty
    setTimeout(() => document.getElementById('stock-out-qty-input')?.focus(), 50);
  };

  const handleClearDynamicRow = () => {
    setSelectedItemModel(null);
    setSearchNameText('');
    setDraftQty('');
    setTimeout(() => { itemNameRef.current?.focus(); }, 50);
  };

  const handlePushToDraft = () => {
    if (!selectedItemModel || !draftQty || Number(draftQty) <= 0) {
      toast.error('يرجى اختيار صنف وإدخال الكمية الصادرة.');
      playWarning();
      return;
    }

    // Stock guard — don't allow dispatching more than available
    const availableQty = Number(selectedItemModel.stockQty || 0);
    const alreadyInDraft = modalDrafts.filter(d => d.itemId === selectedItemModel.id).reduce((s, d) => s + d.qty, 0);
    if (Number(draftQty) + alreadyInDraft > availableQty) {
      toast.error(`الرصيد المتاح لـ "${selectedItemModel.name}" هو ${availableQty} فقط. الكمية المطلوبة تتجاوز المتاح.`);
      playWarning();
      return;
    }

    setModalDrafts(prev => [{
      draftId: crypto.randomUUID(),
      itemId: selectedItemModel.id,
      item: selectedItemModel.name,
      company: selectedItemModel.company || 'بدون شركة',
      cat: selectedItemModel.cat || 'أخرى',
      unit: selectedItemModel.unit || 'كرتونة',
      qty: Number(draftQty),
    }, ...prev]);

    playSuccess();
    handleClearDynamicRow();
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (modalDrafts.length === 0) {
      toast.error('أضف صنفاً واحداً على الأقل قبل الحفظ.');
      return;
    }
    if (!bulkRecipient.trim()) {
      toast.error('يرجى إدخال اسم المستلم قبل تأكيد الصرف.');
      playWarning();
      return;
    }
    setLoading(true);
    try {
      // Build aggregates map: itemId -> total qty requested
      const itemAggregates = {};
      for (const entry of modalDrafts) {
        if (!itemAggregates[entry.itemId]) itemAggregates[entry.itemId] = 0;
        itemAggregates[entry.itemId] += entry.qty;
      }

      // Validate stock and update products sequentially
      const runningBalances = {};
      for (const [id, aggQty] of Object.entries(itemAggregates)) {
        const { data: itemData, error: fetchErr } = await supabase
          .from('products')
          .select('stock_qty, name')
          .eq('id', id)
          .single();
        if (fetchErr || !itemData) throw new Error(`تعذّر جلب بيانات الصنف (${id})`);
        const currentStock = Number(itemData.stock_qty || 0);
        if (aggQty > currentStock) {
          throw new Error(`رصيد "${itemData.name}" غير كافٍ. المتاح: ${currentStock}، المطلوب: ${aggQty}`);
        }
        runningBalances[id] = currentStock;
        await supabase.from('products').update({ stock_qty: currentStock - aggQty }).eq('id', id);
      }

      // Build transaction rows — one row per draft line
      const now = new Date();
      const txsToInsert = modalDrafts.slice().reverse().map(entry => {
        if (runningBalances[entry.itemId] !== undefined) {
          runningBalances[entry.itemId] -= entry.qty;
        }
        return {
          type: 'out',
          item: entry.item,
          item_id: entry.itemId,
          company: entry.company,
          qty: Number(entry.qty),          // must be Number
          unit: entry.unit,
          cat: entry.cat,
          recipient: bulkRecipient.trim(),
          date: bulkDate || now.toISOString().split('T')[0],  // YYYY-MM-DD
          timestamp: now.toISOString(),    // required for ordering
          balance_after: runningBalances[entry.itemId] ?? 0,
          status: 'مكتمل',
        };
      });

      const { error: insertError } = await supabase.from('transactions').insert(txsToInsert);
      if (insertError) throw insertError;

      toast.success(`✅ تم صرف ${modalDrafts.length} أصناف لـ "${bulkRecipient}" وتحديث المخزن بنجاح`);
      playSuccess();
      setModalDrafts([]);
      setBulkRecipient('');
      setBulkDate(formatDate(new Date()));
      setIsAddModalOpen(false);
      handleClearDynamicRow();
    } catch (err) {
      const msg = err.message?.includes('رصيد') ? err.message : `حدث خطأ أثناء الحفظ: ${err.message}`;
      toast.error(msg);
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  // --- ROW EDIT / DELETE ---
  const openEditTx = (tx) => {
    setSelectedTx(tx);
    setEditForm({ qty: tx.qty, date: tx.date || formatDate(new Date()), recipient: tx.recipient || '' });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (Number(editForm.qty) <= 0) return;
    setLoading(true);
    try {
      const matchedItem = items.find(i => i.id === selectedTx.itemId || (i.name === selectedTx.item && (i.company || 'بدون شركة') === (selectedTx.company || 'بدون شركة')));
      
      if (matchedItem) {
          const { data: itemData } = await supabase.from('products').select('stock_qty').eq('id', matchedItem.id).single();
          if (itemData) {
              const diff = Number(selectedTx.qty) - Number(editForm.qty); 
              const currentBalance = Number(itemData.stock_qty || 0);
              await supabase.from('products').update({ stock_qty: currentBalance + diff }).eq('id', matchedItem.id);
          }
      }
      
      const { error } = await supabase.from('transactions').update({ qty: Number(editForm.qty), date: editForm.date, recipient: editForm.recipient }).eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم تعديل سند الصرف بنجاح ✅');
      playSuccess();
      setIsEditModalOpen(false);
    } catch {
      toast.error('خطأ في عملية التعديل');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const openDeleteTx = (tx) => { setSelectedTx(tx); setIsDeleteModalOpen(true); };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const matchedItem = items.find(i => i.id === selectedTx.itemId || (i.name === selectedTx.item && (i.company || 'بدون شركة') === (selectedTx.company || 'بدون شركة')));
      
      if (matchedItem) {
          const { data: itemData } = await supabase.from('products').select('stock_qty').eq('id', matchedItem.id).single();
          if (itemData) {
              const currentBalance = Number(itemData.stock_qty || 0);
              await supabase.from('products').update({ stock_qty: currentBalance + Number(selectedTx.qty) }).eq('id', matchedItem.id);
          }
      }
      
      const { error } = await supabase.from('transactions').delete().eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم حذف سند الصرف وإعادة الكمية للمخزن 🗑️');
      playSuccess();
      setIsDeleteModalOpen(false);
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  // --- EXPORT ---
  const handleExportPDF = () => {
    try {
      const d = new jsPDF();
      const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'مدير النظام';
      d.setFontSize(20);
      d.text("Baraka Al Thimar PRO — سجل الصادر", 105, 15, { align: 'center' });
      d.setFontSize(9);
      d.text(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} | بواسطة: ${userName}`, 195, 24, { align: 'right' });
      d.autoTable({
        startY: 30,
        head: [['#', 'التاريخ', 'المستلم', 'الصنف', 'الشركة', 'القسم', 'الكمية']],
        body: filteredTransactions.map((tx, idx) => [
          idx + 1,
          tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '-'),
          tx.recipient || '-',
          tx.item,
          tx.company || '-',
          tx.cat || '-',
          `${tx.qty} ${tx.unit}`,
        ]),
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { halign: 'center' },
      });
      d.save(`StockOut_Dispatch_${Date.now()}.pdf`);
      toast.success('تم تصدير PDF بنجاح 📄');
    } catch {
      toast.error('خطأ أثناء إنشاء PDF');
    }
    setIsExportMenuOpen(false);
  };

  // --- BLANK TEMPLATE PDF (30-Row A4-Optimised — Outbound) ---
  const handleBlankTemplate = () => {
    try {
      const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageH = d.internal.pageSize.getHeight();
      const W = d.internal.pageSize.getWidth();
      const BLUE = [59, 130, 246];
      const BLUE_DARK = [29, 78, 216];
      const BLUE_NEON = [96, 165, 250];
      const SLATE_DARK = [15, 23, 42];
      const SLATE_MID = [71, 85, 105];
      const SLATE_LIGHT = [241, 245, 249];
      const GRAY_BORDER = [203, 213, 225];

      // ── COMPACT HEADER (18mm band) ──────────────────────────────────
      const drawHeader = () => {
        d.setFillColor(...SLATE_DARK);
        d.roundedRect(10, 8, W - 20, 18, 2, 2, 'F');

        // Blue accent bar
        d.setFillColor(...BLUE);
        d.rect(10, 8, 3.5, 18, 'F');

        d.setFontSize(11); d.setFont('helvetica', 'bold'); d.setTextColor(255, 255, 255);
        d.text('بركة الثمار  |  Barakat Al-Thimar', W / 2, 14.5, { align: 'center' });

        d.setFontSize(7); d.setTextColor(...BLUE_NEON);
        d.text('إذن صرف بضاعة — Stock Outbound Voucher', W / 2, 21, { align: 'center' });

        // ── Meta band (9mm) ──────────────────────────────────────────
        d.setFillColor(...SLATE_LIGHT);
        d.roundedRect(10, 29, W - 20, 9, 1.5, 1.5, 'F');
        d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.25);
        d.roundedRect(10, 29, W - 20, 9, 1.5, 1.5, 'S');

        d.setFontSize(7.5); d.setFont('helvetica', 'normal'); d.setTextColor(...SLATE_MID);
        d.text('التاريخ:', W - 13, 35, { align: 'right' });
        d.setTextColor(...SLATE_DARK); d.setFont('helvetica', 'bold');
        d.text('___ / ___ / _______', W - 30, 35, { align: 'right' });

        d.setFont('helvetica', 'normal'); d.setTextColor(...SLATE_MID);
        d.text('المندوب:', 13, 35);
        d.setFont('helvetica', 'bold'); d.setTextColor(...SLATE_DARK);
        d.text('_________________________________', 30, 35);

        d.setFont('helvetica', 'normal'); d.setFontSize(6); d.setTextColor(170, 185, 200);
        d.text(`طُبع: ${new Date().toLocaleDateString('ar-SA')}`, W / 2, 36.5, { align: 'center' });
      };

      // ── TABLE HEADER ROW ──────────────────────────────────────────
      // Columns: م | كود الصنف | الصنف والشركة (large) | الكمية | ملاحظات
      // A4=297mm. Band=8+18=26, meta=9, gap=1 → table Y=41mm. Hdr=7mm.
      // 30×5.8=174mm. Sigs=22, footer=6 → total≈250mm < 297mm ✅
      const SEP = [28, 50, W - 48, W - 26]; // 5-col separators
      const drawTableHeader = (yPos) => {
        d.setFillColor(...BLUE_DARK);
        d.rect(10, yPos, W - 20, 7, 'F');

        d.setFontSize(7); d.setFont('helvetica', 'bold'); d.setTextColor(255, 255, 255);
        d.text('م',              19,        yPos + 4.8, { align: 'center' });
        d.text('كود الصنف',     39,        yPos + 4.8, { align: 'center' });
        d.text('الصنف والشركة', W / 2 + 5, yPos + 4.8, { align: 'center' });
        d.text('الكمية',        W - 37,    yPos + 4.8, { align: 'center' });
        d.text('ملاحظات',       W - 13,    yPos + 4.8, { align: 'right'  });

        d.setDrawColor(255, 255, 255); d.setLineWidth(0.2);
        SEP.forEach(x => d.line(x, yPos, x, yPos + 7));
        return yPos + 7;
      };

      const ROWS_TOTAL = 30;
      const ROW_H = 5.8;
      const TABLE_START_Y = 41;

      drawHeader();
      let y = drawTableHeader(TABLE_START_Y);

      for (let i = 1; i <= ROWS_TOTAL; i++) {
        if (i % 2 === 0) {
          d.setFillColor(248, 250, 252);
          d.rect(10, y, W - 20, ROW_H, 'F');
        }

        d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.18);
        d.rect(10, y, W - 20, ROW_H, 'S');

        SEP.forEach(x => {
          d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.18);
          d.line(x, y, x, y + ROW_H);
        });

        d.setFontSize(6.5); d.setFont('helvetica', 'bold');
        if (i % 5 === 0) { d.setTextColor(...BLUE_DARK); } else { d.setTextColor(...SLATE_MID); }
        d.text(`${i}`, 19, y + 3.9, { align: 'center' });

        if (i % 10 === 0) {
          d.setFillColor(...BLUE);
          d.circle(14, y + ROW_H / 2, 1, 'F');
        }

        y += ROW_H;
      }

      // ── SIGNATURE BOXES (compact 18mm) ────────────────────────────
      y += 4;
      const sigBoxW = (W - 28) / 2;

      const drawSigBox = (bx, label, sublabel) => {
        d.setFillColor(...SLATE_LIGHT);
        d.roundedRect(bx, y, sigBoxW, 18, 1.5, 1.5, 'F');
        d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.25);
        d.roundedRect(bx, y, sigBoxW, 18, 1.5, 1.5, 'S');
        d.setFillColor(...BLUE);
        d.roundedRect(bx, y, sigBoxW, 2.5, 1.5, 1.5, 'F');
        d.rect(bx, y + 1.2, sigBoxW, 1.3, 'F');
        d.setFontSize(7); d.setFont('helvetica', 'bold'); d.setTextColor(...SLATE_DARK);
        d.text(label,    bx + sigBoxW / 2, y + 7.5,  { align: 'center' });
        d.setFontSize(6); d.setTextColor(...SLATE_MID); d.setFont('helvetica', 'normal');
        d.text(sublabel, bx + sigBoxW / 2, y + 11.5, { align: 'center' });
        d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.35);
        d.line(bx + 6, y + 15.5, bx + sigBoxW - 6, y + 15.5);
      };

      drawSigBox(10,              'أمين المخزن', 'Warehouse Keeper');
      drawSigBox(W - 10 - sigBoxW, 'المستلم',     'Recipient');

      // ── FOOTER ────────────────────────────────────────────────────
      d.setFontSize(5.5); d.setTextColor(200, 210, 225);
      d.text('نظام بركة الثمار PRO  •  Barakat Al-Thimar Warehouse Management', W / 2, pageH - 4, { align: 'center' });

      d.save(`Blank_StockOut_30Rows_${Date.now()}.pdf`);
      toast.success('تم توليد سند صادر A4 جاهز للطباعة (30 صنف) 📋');
    } catch(e) {
      console.error(e);
      toast.error('خطأ أثناء توليد السند الفارغ');
    }
  };

  // --- ROW: Export single صادر voucher as PDF ---
  const handleRowExportPDF = (tx) => {
    try {
      const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = d.internal.pageSize.getWidth();
      d.setFillColor(15, 23, 42); d.roundedRect(14, 10, W - 28, 28, 4, 4, 'F');
      d.setFontSize(17); d.setTextColor(255, 255, 255);
      d.text('بركة الثمار', W / 2, 22, { align: 'center' });
      d.setFontSize(9); d.setTextColor(249, 115, 22);
      d.text('Baraka Al Thimar — سند صادر رسمي / Official Stock-Out Voucher', W / 2, 30, { align: 'center' });
      d.setFillColor(255, 247, 237); d.roundedRect(14, 44, W - 28, 12, 3, 3, 'F');
      d.setFontSize(9); d.setTextColor(249, 115, 22);
      d.text(`سند صادر | نوع الحركة: ${tx.type || 'صادر'}`, 20, 52);
      d.text(`التاريخ: ${tx.date || formatDate(new Date())}`, W - 20, 52, { align: 'right' });
      const rows = [
        ['الصنف', tx.item || '-'],
        ['الشركة', tx.company || '-'],
        ['القسم', tx.cat || '-'],
        ['الكمية', `${tx.qty} ${tx.unit || 'كرتونة'}`],
        ['المستلم', tx.recipient || '-'],
        ['الرصيد بعد الحركة', `${tx.balanceAfter ?? '-'} ${tx.unit || 'كرتونة'}`],
      ];
      d.autoTable({
        startY: 62, head: [['البيان', 'القيمة']],
        body: rows,
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], halign: 'center' },
        styles: { halign: 'right', fontSize: 12, cellPadding: 5 },
        alternateRowStyles: { fillColor: [255, 247, 237] },
      });
      const finalY = d.lastAutoTable.finalY + 20;
      d.setFontSize(9); d.setTextColor(100, 120, 150);
      d.text('توقيع المستلم: ___________________________', 20, finalY);
      d.text('توقيع المدير: ___________________________', W - 20, finalY, { align: 'right' });
      d.setFontSize(7); d.setTextColor(148, 163, 184);
      d.text(`نظام بركة الثمار PRO — طُبع: ${new Date().toLocaleDateString('ar-SA')}`, W / 2, 287, { align: 'center' });
      d.save(`StockOut_Voucher_${tx.item}_${tx.date || Date.now()}.pdf`);
      toast.success('تم تصدير السند كـ PDF 📄');
    } catch(e) {
      toast.error('خطأ أثناء تصدير السند');
    }
  };

  // --- ROW: Save single صادر voucher as PNG ---
  const handleRowSaveImage = async (tx) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:420px;background:#0f172a;border-radius:20px;padding:24px;font-family:Cairo,sans-serif;direction:rtl;color:white;';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#431407,#0f172a);border-radius:14px;padding:16px 20px;margin-bottom:16px;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:#fff;">بركة الثمار</div>
        <div style="font-size:10px;color:#f97316;margin-top:2px;">سند صادر رسمي — Stock-Out Voucher</div>
      </div>
      <div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:12px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#fb923c;font-weight:900;font-size:13px;">سند صادر</span>
        <span style="color:#94a3b8;font-size:11px;">${tx.date || formatDate(new Date())}</span>
      </div>
      ${[['الصنف',tx.item||'-'],['الشركة',tx.company||'-'],['الكمية',`${tx.qty} ${tx.unit||'كرتونة'}`],['المستلم',tx.recipient||'-'],['الرصيد بعد',`${tx.balanceAfter??'-'}`]].map(([k,v])=>`
        <div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <span style="color:#64748b;font-size:11px;">${k}</span>
          <span style="color:#f1f5f9;font-weight:800;font-size:12px;">${v}</span>
        </div>`).join('')}
      <div style="text-align:center;margin-top:16px;color:#334155;font-size:9px;">نظام بركة الثمار PRO • ${new Date().toLocaleDateString('ar-SA')}</div>
    `;
    document.body.appendChild(el);
    try {
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
      const link = document.createElement('a');
      link.download = `StockOut_${tx.item}_${tx.date || Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('تم حفظ السند كصورة PNG 🖼️');
    } catch(e) {
      toast.error('خطأ أثناء حفظ الصورة');
    } finally {
      document.body.removeChild(el);
    }
  };

  // --- ANIMATIONS ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const cardVariants = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } } };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-readex text-slate-800 overflow-hidden" dir="rtl">

      {/* ─── HEADER ─── */}
      <div className="bg-white border-b border-slate-200 p-4 sm:p-6 shrink-0 z-20 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-rose-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-orange-500/20 shrink-0">
              <ArrowUpRight size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">أذونات الصادر</h2>
              <p className="text-sm font-bold text-slate-400 mt-1">إدارة عمليات صرف وتوزيع البضاعة من المستودع بدقة</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse self-end lg:self-auto relative pr-2">
            
            <div className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-orange-50 border border-orange-100 rounded-2xl mr-2">
              <span className="text-xs font-black text-orange-500 uppercase tracking-wider">صادر اليوم:</span>
              <span className="text-xl font-black text-orange-600 leading-none">{todayTotal} <span className="text-[11px] font-bold opacity-60">كرتونة</span></span>
            </div>

            {/* Export dropdown */}
            <div className="relative">
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm transition-all shadow-sm">
                <Download size={18} />
                <span>تصدير </span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isExportMenuOpen ? 'rotate-180 text-orange-500' : ''}`} />
              </button>
              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                    className="absolute top-full mt-3 right-0 w-56 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-50 text-sm font-bold">
                    <button onClick={handleExportPDF} className="w-full flex items-center justify-between px-5 py-4 text-slate-600 hover:bg-slate-50 hover:text-orange-600 transition-colors border-b border-slate-50">
                      <span className="flex items-center space-x-3 space-x-reverse"><FileText size={18} /><span>تحميل PDF</span></span>
                    </button>
                    <button onClick={() => { toast.info('جاري تجهيز الصفحة للطباعة...'); window.print(); setIsExportMenuOpen(false); }} className="w-full flex items-center justify-between px-5 py-4 text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors">
                      <span className="flex items-center space-x-3 space-x-reverse"><Image size={18} /><span>تحميل صورة PNG</span></span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-10 bg-slate-200 mx-2"></div>

            {/* Blank Template Button — Professional */}
            <button
              onClick={handleBlankTemplate}
              className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm transition-all shadow-sm"
              title="طباعة سند إخراج فارغ للكتابة اليدوية"
            >
              <Printer size={18} />
              <span>طباعة سند فارغ</span>
            </button>

            {!isViewer && (
              <button
                onClick={() => { setModalDrafts([]); setBulkRecipient(''); setBulkDate(formatDate(new Date())); setIsAddModalOpen(true); setTimeout(() => itemNameRef.current?.focus(), 150); }}
                className="flex items-center space-x-2 space-x-reverse px-6 py-3 bg-gradient-to-br from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm hover:shadow-2xl hover:shadow-orange-500/30 active:scale-95 transition-all shadow-xl shadow-orange-500/20">
                <Plus size={20} /><span>إضافة صادر جديد</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="relative group flex-1 min-w-[300px]">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            <input type="text" placeholder="البحث بالصنف، الشركة، أو المستلم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-100/50 border border-transparent focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 text-slate-800 text-sm font-bold rounded-2xl pr-11 pl-4 py-3 outline-none transition-all" />
          </div>
          <div className="flex items-center gap-3">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-100/50 border border-transparent text-slate-700 text-sm font-bold rounded-2xl px-5 py-3 cursor-pointer focus:bg-white focus:border-orange-500/20 outline-none transition-all appearance-none">
              <option>التصنيف: الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
            </select>
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="bg-slate-100/50 border border-transparent text-slate-700 text-sm font-bold rounded-2xl px-5 py-3 cursor-pointer focus:bg-white focus:border-orange-500/20 outline-none transition-all appearance-none">
              {dynamicCompanies.map(c => <option key={c}>{c === 'الكل' ? 'الشركة: الكل' : c}</option>)}
            </select>
            <button onClick={() => setShowHotOnly(!showHotOnly)}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all border ${showHotOnly ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-lg shadow-orange-500/10' : 'bg-slate-100/50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
              <Flame size={18} className={showHotOnly ? 'animate-pulse text-orange-500' : ''} /><span>نشاط عالي</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── SECTIONED GRID ─── */}
      <div className="flex-1 overflow-y-auto px-6 pb-12 custom-scrollbar w-full bg-slate-50/30">
        {Object.keys(groupedTransactions).length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 mt-8 min-h-[50vh] shadow-sm">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
              <ArrowUpRight size={48} className="text-slate-300 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">لا توجد حركات صادر مطابقة</h3>
            <p className="text-slate-400 font-bold mb-10 max-w-sm">أضف أذونات الصرف والتوزيع من المستودع لتظهر هنا مصنفة بالأقسام.</p>
            {!isViewer && (
              <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-3.5 bg-gradient-to-br from-orange-500 to-rose-600 text-white rounded-2xl font-black shadow-lg shadow-orange-500/30">إضافة أول حركة صادر</button>
            )}
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10 mt-8">
            {Object.keys(groupedTransactions).sort().map(cat => (
              <div key={cat} className="space-y-6">
                
                {/* Category Header */}
                <div className="flex items-center space-x-4 space-x-reverse px-2 sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-3 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-orange-500">
                    {getCatIcon(cat)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">صادر {cat}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">تصنيف المنتجات</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent via-slate-200 to-transparent mx-4"></div>
                  <span className="text-xs font-black text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100 shadow-sm">{groupedTransactions[cat].length} سند</span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {groupedTransactions[cat].map(tx => (
                    <motion.div key={tx.id} variants={cardVariants}
                      className="group relative flex flex-col justify-between p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-2xl hover:border-orange-200 transition-all duration-500">
                      <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between w-full mb-4">
                          <div className="flex flex-col w-full overflow-hidden">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase truncate">{tx.company || 'بدون شركة'}</span>
                              <span className="text-[10px] font-bold text-slate-400">{tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '')}</span>
                            </div>
                            <div className="flex items-center gap-2 w-full">
                              <h4 className="text-lg font-black text-slate-800 leading-tight group-hover:text-orange-600 transition-colors truncate tracking-tight">{tx.item}</h4>
                              {(hotItemsMap[tx._itemId] || 0) >= 50 && (
                                <Flame size={18} className="text-orange-500 animate-pulse shrink-0" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-end justify-between mt-auto pt-4 border-t border-slate-50">
                          <div className="flex flex-col space-y-2">
                            {/* Recipient badge */}
                            {tx.recipient && (
                              <div className="flex items-center text-[10px] font-black text-slate-500 bg-slate-50 w-max px-2.5 py-1 rounded-lg border border-slate-100">
                                <User size={10} className="ml-1.5 opacity-60" /> {tx.recipient}
                              </div>
                            )}
                            {/* Qty badge — orange/rose for outgoing */}
                            <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-sm font-black bg-orange-50 text-orange-600 border border-orange-100 w-max shadow-sm">
                              -{tx.qty} <span className="text-[10px] font-bold mr-1 opacity-70">{tx.unit}</span>
                            </span>
                          </div>

                          {/* Actions Menu */}
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            {!isViewer && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); openEditTx(tx); }} title="تعديل" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:shadow-lg transition-all active:scale-90"><Pencil size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteTx(tx); }} title="حذف" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:shadow-lg transition-all active:scale-90"><Trash2 size={14} /></button>
                              </>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); handleRowExportPDF(tx); }} title="تصدير PDF" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:shadow-lg transition-all active:scale-90"><FileText size={14} /></button>
                          </div>
                        </div>
                      </div>
                      {/* Bottom accent — orange for outgoing */}
                      <div className="absolute bottom-0 right-10 left-10 h-1 bg-gradient-to-r from-orange-500 to-rose-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out rounded-t-full"></div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ─── BULK DISPATCH MODAL ─── */}
      <ModalWrapper
        title="إنشاء إذن صرف مجمع"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleBulkSubmit}
        loading={loading}
        submitLabel={`تأكيد خروج البضاعة (عدد: ${modalDrafts.length})`}
        submitColor="orange"
        maxWidth="max-w-4xl"
        disableSubmit={modalDrafts.length === 0}
      >
        <div className="flex flex-col gap-6">

          {/* Row 1: Date + Recipient */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
            <div>
              <label className={LabelClass}>تاريخ الإذن</label>
              <input type="date" className={InputClass} value={bulkDate} onChange={e => setBulkDate(e.target.value)} required />
            </div>
            <div>
              <label className={LabelClass}>اسم المستلم / المندوب <span className="text-rose-500">*</span></label>
              <div className="relative">
                <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input type="text" className={`${InputClass} pr-10`} placeholder="مثال: أحمد محمد..." value={bulkRecipient} onChange={e => setBulkRecipient(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Row 2: 4-col Entry Grid */}
          <div className="bg-orange-50/50 border border-orange-200/60 rounded-2xl p-4 flex flex-col gap-3 relative z-30">
            <p className="text-[11px] font-black text-orange-400 uppercase tracking-widest">إضافة صنف للصرف</p>
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-6 relative group/findItem">
                <label className={LabelClass}>اسم الصنف</label>
                <div className="relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  {selectedItemModel ? (
                    <div className="flex items-center justify-between w-full bg-orange-50 border border-orange-200 text-orange-800 text-sm font-bold rounded-xl px-3 py-2.5">
                      <span className="truncate text-xs">{selectedItemModel.name}</span>
                      <button type="button" onClick={handleClearDynamicRow} className="text-orange-400 hover:text-orange-600 shrink-0"><X size={13} /></button>
                    </div>
                  ) : (
                    <input ref={itemNameRef} type="text" className={`${InputClass} pr-9 text-sm`} placeholder="ابحث عن الصنف..."
                      value={searchNameText} onChange={e => { setSearchNameText(e.target.value); setItemSearchActiveIndex(-1); }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { 
                          e.preventDefault(); 
                          setItemSearchActiveIndex(p => p < itemSuggestions.length - 1 ? p + 1 : p); 
                        }
                        else if (e.key === 'ArrowUp') { 
                          e.preventDefault(); 
                          setItemSearchActiveIndex(p => p > 0 ? p - 1 : 0); 
                        }
                        else if (e.key === 'Enter') {
                          if (itemSearchActiveIndex >= 0 && itemSuggestions[itemSearchActiveIndex]) {
                            e.preventDefault(); 
                            handleSelectSuggestion(itemSuggestions[itemSearchActiveIndex]);
                          } else if (selectedItemModel) {
                            e.preventDefault();
                            document.getElementById('stock-out-qty-input')?.focus();
                          }
                        }
                      }} 
                    />
                  )}
                </div>
                {!selectedItemModel && searchNameText && itemSuggestions.length > 0 && (
                  <div className="absolute top-full right-0 w-full max-h-48 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-1 mt-1">
                    {itemSuggestions.map((s, idx) => (
                      <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                        className={`w-full text-right px-3 py-2 border-b border-slate-50 last:border-0 text-sm flex flex-col items-start transition-colors ${itemSearchActiveIndex === idx ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <span className="font-black text-xs">{s.name}</span>
                        <span className="text-[10px] opacity-70 font-bold">{s.company || 'بدون شركة'} • {s.cat} • رصيد: {s.stockQty ?? '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className={LabelClass}>الشركة</label>
                <input type="text" className="w-full bg-slate-100 border border-transparent text-slate-500 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed truncate" readOnly value={selectedItemModel?.company || '---'} />
              </div>
              <div className="col-span-2">
                <label className={LabelClass}>الوحدة</label>
                <input type="text" className="w-full bg-slate-100 border border-transparent text-slate-500 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed text-center" readOnly value={selectedItemModel?.unit || 'كرتونة'} />
              </div>
              <div className="col-span-2">
                <label className={LabelClass}>الكمية <span className="text-orange-500">↵</span></label>
                <input id="stock-out-qty-input" type="number" min="1"
                  className={`${InputClass} !border-orange-500/60 focus:!ring-orange-500/30 text-orange-700 font-bold text-center`}
                  placeholder="0" disabled={!selectedItemModel} value={draftQty}
                  onChange={e => setDraftQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePushToDraft(); } }} />
              </div>
            </div>
          </div>

          {/* Row 3: Review Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-inner">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="text-sm font-black text-slate-700">مراجعة الأسطر</h4>
              <span className="text-xs font-bold bg-white px-3 py-1 rounded-full text-orange-600 border border-slate-200 shadow-sm">{modalDrafts.length} أصناف مُعدّة للصرف</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto px-2 custom-scrollbar">
              {modalDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 opacity-60">
                  <CheckCircle size={32} className="mb-2" />
                  <span className="font-bold text-sm">ابحث عن صنف بالأعلى ثم أدخل الكمية المراد صرفها.</span>
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-lg border border-slate-200 mt-2">
                  <table className="w-full min-w-[640px] text-right border-separate border-spacing-y-2">
                    <thead>
                    <tr className="text-slate-400 font-black text-xs text-center">
                      <th className="px-2 py-1">م</th><th className="px-3 py-1 text-right">الصنف</th><th className="px-3 py-1 text-right">الشركة</th>
                      <th className="px-2 py-1">القسم</th><th className="px-2 py-1 text-orange-500">الكمية</th><th className="px-2 py-1">الوحدة</th><th className="px-2 py-1 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {modalDrafts.map((dr, index) => (
                        <motion.tr key={dr.draftId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-slate-50 text-sm font-bold hover:bg-white transition-all">
                          <td className="px-2 py-3 text-center text-slate-400 rounded-r-xl border-y border-r border-slate-200">{index + 1}</td>
                          <td className="px-3 py-3 text-slate-800 border-y border-slate-200">{dr.item}</td>
                          <td className="px-3 py-3 text-slate-600 text-xs border-y border-slate-200">{dr.company}</td>
                          <td className="px-2 py-3 text-center text-orange-500 text-xs border-y border-slate-200">{dr.cat}</td>
                          <td className="px-2 py-3 text-center border-y border-slate-200"><span className="bg-orange-100 text-orange-700 px-3 py-1 rounded inline-block">-{dr.qty}</span></td>
                          <td className="px-2 py-3 text-center text-slate-500 text-xs border-y border-slate-200">{dr.unit}</td>
                          <td className="px-2 py-3 text-center rounded-l-xl border-y border-l border-slate-200">
                            <button onClick={() => setModalDrafts(prev => prev.filter(d => d.draftId !== dr.draftId))} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mx-auto block">
                              <X size={16} className="stroke-[3]" />
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

      {/* ─── EDIT MODAL ─── */}
      <ModalWrapper title="تعديل سند الصرف" isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} loading={loading}>
        <div className="space-y-4">
          <div>
            <label className={LabelClass}>الكمية</label>
            <input type="number" min="1" className={InputClass} value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} required />
          </div>
          <div>
            <label className={LabelClass}>اسم المستلم</label>
            <input type="text" className={InputClass} value={editForm.recipient} onChange={e => setEditForm({ ...editForm, recipient: e.target.value })} />
          </div>
          <div>
            <label className={LabelClass}>التاريخ</label>
            <input type="date" className={InputClass} value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} required />
          </div>
        </div>
      </ModalWrapper>

      {/* ─── DELETE MODAL ─── */}
      <ModalWrapper title="إلغاء سند صرف" isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onSubmit={handleDeleteSubmit} loading={loading} submitLabel="نعم، إلغاء الصرف" submitColor="rose">
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4 animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">تأكيد إلغاء سند الصرف</h4>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">سيتم إعادة الكمية المصروفة إلى رصيد المخزن تلقائياً.</p>
        </div>
      </ModalWrapper>

    </div>
  );
}
