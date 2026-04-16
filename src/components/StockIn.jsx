import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, CheckCircle, Truck, Flame, MapPin, Printer
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

// --- HELPER: Date Formatter ---
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
                <button type="submit" disabled={loading || disableSubmit} className={`px-6 py-2 rounded-xl font-bold text-white shadow-md shadow-${submitColor}-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${submitColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
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

const InputClass = "w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block px-4 py-2.5 outline-none transition-all";
const LabelClass = "block text-xs font-black text-slate-700 mb-1.5";

export default function StockIn() {
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
  
  // Edit Form State
  const [editForm, setEditForm] = useState({ qty: '', invoice: '', date: '' });

  // --- BULK MODAL STATE ---
  const itemNameRef = useRef(null);
  
  // Global Headers for Session
  const [bulkLocation, setBulkLocation] = useState('مستودع الرياض');
  const [bulkDate, setBulkDate] = useState(formatDate(new Date()));
  
  // Draft Table
  const [modalDrafts, setModalDrafts] = useState([]);
  
  // Dynamic Row Inputs
  const [searchNameText, setSearchNameText] = useState('');
  const [selectedItemModel, setSelectedItemModel] = useState(null);
  const [draftQty, setDraftQty] = useState('');
  const [draftExpiryDate, setDraftExpiryDate] = useState('');
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

    const itemsChannel = supabase.channel('public:products:stockin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData)
      .subscribe();

    const transChannel = supabase.channel('public:transactions:stockin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData)
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(transChannel);
    };
  }, []);

  const stockInTransactions = useMemo(() => transactions.filter(t => t.type === 'وارد'), [transactions]);

  // Bulk Modal Autocomplete Logic
  const itemSuggestions = useMemo(() => {
    if (!searchNameText || selectedItemModel) return [];
    return items.filter(i => 
      i.name.toLowerCase().includes(searchNameText.toLowerCase()) || 
      (i.company || '').toLowerCase().includes(searchNameText.toLowerCase())
    );
  }, [items, searchNameText, selectedItemModel]);

  // Main Grid Filters
  const dynamicCompanies = ['الكل', ...new Set(items.map(i => i.company || 'بدون شركة'))].filter(Boolean);

  const hotItemsMap = useMemo(() => {
    const map = {};
    const now = new Date();
    stockInTransactions.forEach(tx => {
      const txDate = tx.date ? new Date(tx.date) : (tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date());
      const diffTime = Math.abs(now - txDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        if (!map[tx.itemId]) map[tx.itemId] = 0;
        map[tx.itemId] += Number(tx.qty);
      }
    });
    return map;
  }, [stockInTransactions]);

  const filteredTransactions = useMemo(() => {
    return stockInTransactions.map(tx => {
      const matchedItem = items.find(i => i.id === tx.itemId || (i.name === tx.item && (i.company || 'بدون شركة') === (tx.company || 'بدون شركة')));
      return { ...tx, cat: matchedItem ? matchedItem.cat : 'أخرى', _itemId: matchedItem ? matchedItem.id : tx.itemId };
    }).filter(tx => {
      const searchKey = `${tx.item} ${tx.company} ${tx.invoice}`.toLowerCase();
      const matchSearch = searchKey.includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'الكل' || tx.cat === categoryFilter;
      const matchComp = companyFilter === 'الكل' || (tx.company || 'بدون شركة') === companyFilter;
      const matchHot = showHotOnly ? ((hotItemsMap[tx._itemId] || 0) >= 50) : true;
      return matchSearch && matchCat && matchComp && matchHot;
    });
  }, [stockInTransactions, items, searchQuery, categoryFilter, companyFilter, showHotOnly, hotItemsMap]);

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
    return stockInTransactions.reduce((acc, tx) => {
      const txDate = tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '');
      if (txDate === todayStr) return acc + Number(tx.qty || 0);
      return acc;
    }, 0);
  }, [stockInTransactions]);

  // --- BULK MODAL ACTIONS ---

  const handleSelectSuggestion = (itemObj) => {
    setSelectedItemModel(itemObj);
    setSearchNameText(`${itemObj.name} - ${itemObj.company || 'بدون شركة'}`);
    setItemSearchActiveIndex(-1);
  };

  const handleClearDynamicRow = () => {
    setSelectedItemModel(null);
    setSearchNameText('');
    setDraftQty('');
    setDraftExpiryDate('');
    setTimeout(() => { itemNameRef.current?.focus(); }, 50);
  };

  const handlePushToDraft = () => {
    if (!selectedItemModel || !draftQty || Number(draftQty) <= 0) {
      toast.error('يرجى اختيار صنف صحيح وإدخال الكمية بصورة سليمة.');
      playWarning();
      return;
    }

    if (!draftExpiryDate && selectedItemModel.cat !== 'بلاستيك') {
      toast.error('يرجى إدخال تاريخ الصلاحية.');
      playWarning();
      return;
    }

    const newDraft = {
      draftId: crypto.randomUUID(),
      itemId: selectedItemModel.id,
      item: selectedItemModel.name,
      company: selectedItemModel.company || 'بدون شركة',
      cat: selectedItemModel.cat || 'أخرى',
      unit: selectedItemModel.unit || 'كرتونة',
      qty: Number(draftQty),
      expiryDate: draftExpiryDate || '',
    };

    setModalDrafts(prev => [newDraft, ...prev]);
    playSuccess();
    
    // Reset Row and Cursor Jump
    handleClearDynamicRow();
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (modalDrafts.length === 0) return;

    setLoading(true);
    try {
      // 1. تجهيز البيانات بشكل سليم تماماً حسب الـ Schema
      const itemsToInsert = modalDrafts.map(item => ({
        type: 'in',
        item_id: item.itemId,
        qty: parseInt(item.qty, 10) || 0,
        unit: item.unit || 'كرتونة',
        cat: item.cat || 'عام',
        date: new Date().toISOString().split('T')[0],
        location: bulkLocation.trim() || 'مستودع الرياض',
        expiry_date: item.expiryDate || null,
        invoiced: false
      }));

      // 2. إرسال البيانات لجدول الترانزكشن
      const { error: txError } = await supabase
        .from('transactions')
        .insert(itemsToInsert);

      if (txError) throw txError;

      // 3. تحديث كميات المخزن (Stock_qty) للأصناف
      for (const item of modalDrafts) {
        const { error: updateError } = await supabase.rpc('increment_stock', { 
          product_id: item.itemId, 
          amount: parseInt(item.qty, 10) 
        });
        if (updateError) console.error("Update stock error:", updateError);
      }

      toast.success(`تم حفظ ${modalDrafts.length} أصناف وتحديث الرصيد بنجاح ✅`);
      playSuccess();
      setModalDrafts([]); // تفريغ القائمة بعد الحفظ
      setIsAddModalOpen(false);
      handleClearDynamicRow();
    } catch (err) {
      console.error("Detailed Error:", err.message, err);
      toast.error(`خطأ في الحفظ: ${err.message || 'يرجى المحاولة مرة أخرى.'}`);
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  // --- ROW ACTIONS ---

  const openEditTx = (tx) => {
    setSelectedTx(tx);
    setEditForm({ qty: tx.qty, invoice: tx.invoice || '', date: tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : formatDate(new Date())) });
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
              const diff = Number(editForm.qty) - Number(selectedTx.qty);
              const currentBalance = Number(itemData.stock_qty || 0);
              await supabase.from('products').update({ stock_qty: currentBalance + diff }).eq('id', matchedItem.id);
          }
      }
      
      const { error } = await supabase.from('transactions').update({ qty: Number(editForm.qty), invoice: editForm.invoice, date: editForm.date }).eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم التعديل بنجاح ✅');
      playSuccess();
      setIsEditModalOpen(false);
    } catch (e) {
      toast.error('خطأ في عملية التعديل');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const openDeleteTx = (tx) => {
    setSelectedTx(tx);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const matchedItem = items.find(i => i.id === selectedTx.itemId || (i.name === selectedTx.item && (i.company || 'بدون شركة') === (selectedTx.company || 'بدون شركة')));
      
      if (matchedItem) {
          const { data: itemData } = await supabase.from('products').select('stock_qty').eq('id', matchedItem.id).single();
          if (itemData) {
              const currentBalance = Number(itemData.stock_qty || 0);
              await supabase.from('products').update({ stock_qty: Math.max(0, currentBalance - Number(selectedTx.qty)) }).eq('id', matchedItem.id);
          }
      }
      
      const { error } = await supabase.from('transactions').delete().eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم الحذف واسترجاع الرصيد 🗑️');
      playSuccess();
      setIsDeleteModalOpen(false);
    } catch (err) {
      toast.error('حدث خطأ أثناء الحذف والتسوية');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  // --- EXPORT logic ---
  const handleExportPDF = () => {
    try {
        const d = new jsPDF();
        const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'مدير النظام';
        d.setFontSize(22);
        d.text("Baraka Al Thimar PRO - Stock In Hub", 105, 15, { align: 'center' });
        d.setFontSize(10);
        d.text(`Date: ${new Date().toLocaleDateString('ar-SA')} | By: ${userName}`, 195, 25, { align: 'right' });
        d.autoTable({
            startY: 30,
            head: [['#', 'Date (التاريخ)', 'Location (الجهة)', 'Item (الصنف)', 'Company (الشركة)', 'Qty (العدد)', 'Invoice (الفاتورة)'] ],
            body: filteredTransactions.map((tx, idx) => [idx + 1, tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '-'), tx.location || 'مستودع الرياض', tx.item, tx.company || '-', `${tx.qty} ${tx.unit}`, tx.invoice || '-']),
            headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center' },
            styles: { halign: 'center' }
        });
        d.save(`StockIn_Hub_${Date.now()}.pdf`);
        toast.success("تم تصدير PDF بنجاح 📄");
    } catch (e) {
        toast.error("خطأ أثناء استخراج PDF");
    }
    setIsExportMenuOpen(false);
  };

  const handleExportPNG = () => {
    toast.info("جاري تجهيز الصفحة للطباعة أو الحفظ كصورة...");
    window.print();
    setIsExportMenuOpen(false);
  };

  // --- BLANK TEMPLATE PDF (30-Row A4-Optimised) ---
  const handleBlankTemplate = () => {
    try {
      const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageH = d.internal.pageSize.getHeight();
      const W = d.internal.pageSize.getWidth();
      const EMERALD = [16, 185, 129];
      const EMERALD_DARK = [5, 150, 105];
      const SLATE_DARK = [15, 23, 42];
      const SLATE_MID = [71, 85, 105];
      const SLATE_LIGHT = [241, 245, 249];
      const GRAY_BORDER = [203, 213, 225];

      // ── COMPACT HEADER (fits on one A4 page) ──────────────────────
      const drawHeader = () => {
        // Dark band: y=8, height=18mm (compact)
        d.setFillColor(...SLATE_DARK);
        d.roundedRect(10, 8, W - 20, 18, 2, 2, 'F');

        // Emerald accent bar
        d.setFillColor(...EMERALD);
        d.rect(10, 8, 3.5, 18, 'F');

        // Company name — slightly smaller
        d.setFontSize(11); d.setFont('helvetica', 'bold'); d.setTextColor(255, 255, 255);
        d.text('بركة الثمار  |  Barakat Al-Thimar', W / 2, 14.5, { align: 'center' });

        // Subtitle
        d.setFontSize(7); d.setTextColor(...EMERALD);
        d.text('إذن استلام بضاعة — Stock Inbound Voucher', W / 2, 21, { align: 'center' });

        // ── Meta band ──────────────
        d.setFillColor(...SLATE_LIGHT);
        d.roundedRect(10, 29, W - 20, 9, 1.5, 1.5, 'F');
        d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.25);
        d.roundedRect(10, 29, W - 20, 9, 1.5, 1.5, 'S');

        d.setFontSize(7.5); d.setFont('helvetica', 'normal'); d.setTextColor(...SLATE_MID);
        d.text('التاريخ:', W - 13, 35, { align: 'right' });
        d.setTextColor(...SLATE_DARK); d.setFont('helvetica', 'bold');
        d.text('___ / ___ / _______', W - 30, 35, { align: 'right' });

        d.setFont('helvetica', 'normal'); d.setTextColor(...SLATE_MID);
        d.text('المورد:', 13, 35);
        d.setFont('helvetica', 'bold'); d.setTextColor(...SLATE_DARK);
        d.text('_________________________________', 30, 35);

        // Print date tiny
        d.setFont('helvetica', 'normal'); d.setFontSize(6); d.setTextColor(170, 185, 200);
        d.text(`طُبع: ${new Date().toLocaleDateString('ar-SA')}`, W / 2, 36.5, { align: 'center' });
      };

      // ── TABLE HEADER ROW ──────────────────────────────────────────
      //  Columns: م | الصنف والشركة (wide) | الكمية | ملاحظات
      const SEP = [28, W - 48, W - 26]; // column separator X positions
      const drawTableHeader = (yPos) => {
        d.setFillColor(...EMERALD_DARK);
        d.rect(10, yPos, W - 20, 7, 'F');

        d.setFontSize(7.5); d.setFont('helvetica', 'bold'); d.setTextColor(255, 255, 255);
        d.text('م',              19,        yPos + 4.8, { align: 'center' });
        d.text('الصنف والشركة',  W / 2,     yPos + 4.8, { align: 'center' });
        d.text('الكمية',         W - 37,    yPos + 4.8, { align: 'center' });
        d.text('ملاحظات',        W - 13,    yPos + 4.8, { align: 'right'  });

        // Column separators (white)
        d.setDrawColor(255, 255, 255); d.setLineWidth(0.2);
        SEP.forEach(x => d.line(x, yPos, x, yPos + 7));
        return yPos + 7;
      };

      // ── 30 ROWS — single page layout ──────────────────────────────
      // A4 = 297mm. Header=8+18=26mm, meta=9mm, gap=1mm → table start Y=41mm
      // Table header=7mm. 30 rows × 5.8mm = 174mm. Sigs=22mm, footer=6mm.
      // Total ≈ 41+7+174+4+22+6 = 254mm < 297mm ✅ fits on one page
      const ROWS_TOTAL = 30;
      const ROW_H = 5.8;
      const TABLE_START_Y = 41;  // y immediately below meta band

      drawHeader();
      let y = drawTableHeader(TABLE_START_Y);

      for (let i = 1; i <= ROWS_TOTAL; i++) {
        // Alternating fill
        if (i % 2 === 0) {
          d.setFillColor(248, 250, 252);
          d.rect(10, y, W - 20, ROW_H, 'F');
        }

        // Row border
        d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.18);
        d.rect(10, y, W - 20, ROW_H, 'S');

        // Column separators
        SEP.forEach(x => {
          d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.18);
          d.line(x, y, x, y + ROW_H);
        });

        // Row number
        d.setFontSize(6.5); d.setFont('helvetica', 'bold');
        if (i % 5 === 0) { d.setTextColor(...EMERALD_DARK); } else { d.setTextColor(...SLATE_MID); }
        d.text(`${i}`, 19, y + 3.9, { align: 'center' });

        // Milestone dot every 10
        if (i % 10 === 0) {
          d.setFillColor(...EMERALD);
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
        // Emerald accent top
        d.setFillColor(...EMERALD);
        d.roundedRect(bx, y, sigBoxW, 2.5, 1.5, 1.5, 'F');
        d.rect(bx, y + 1.2, sigBoxW, 1.3, 'F');
        // Labels
        d.setFontSize(7); d.setFont('helvetica', 'bold'); d.setTextColor(...SLATE_DARK);
        d.text(label,    bx + sigBoxW / 2, y + 7.5,  { align: 'center' });
        d.setFontSize(6); d.setTextColor(...SLATE_MID); d.setFont('helvetica', 'normal');
        d.text(sublabel, bx + sigBoxW / 2, y + 11.5, { align: 'center' });
        // Signature line
        d.setDrawColor(...GRAY_BORDER); d.setLineWidth(0.35);
        d.line(bx + 6, y + 15.5, bx + sigBoxW - 6, y + 15.5);
      };

      drawSigBox(10,             'أمين المخزن', 'Warehouse Keeper');
      drawSigBox(W - 10 - sigBoxW, 'المستلم',     'Recipient');

      // ── FOOTER ────────────────────────────────────────────────────
      d.setFontSize(5.5); d.setTextColor(200, 210, 225);
      d.text('نظام بركة الثمار PRO  •  Barakat Al-Thimar Warehouse Management', W / 2, pageH - 4, { align: 'center' });

      d.save(`Blank_StockIn_30Rows_${Date.now()}.pdf`);
      toast.success('تم توليد سند وارد A4 جاهز للطباعة (30 صنف) 📋');
    } catch(e) {
      console.error(e);
      toast.error('خطأ أثناء توليد السند الفارغ');
    }
  };

  // --- ROW: Export single voucher as PDF ---
  const handleRowExportPDF = (tx) => {
    try {
      const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = d.internal.pageSize.getWidth();
      d.setFillColor(15, 23, 42); d.roundedRect(14, 10, W - 28, 28, 4, 4, 'F');
      d.setFontSize(17); d.setTextColor(255,255,255);
      d.text('بركة الثمار', W / 2, 22, { align: 'center' });
      d.setFontSize(9); d.setTextColor(148, 163, 184);
      d.text('Baraka Al Thimar — سند وارد رسمي / Official Stock-In Voucher', W / 2, 30, { align: 'center' });
      d.setFillColor(239,250,243); d.roundedRect(14, 44, W - 28, 12, 3, 3, 'F');
      d.setFontSize(9); d.setTextColor(22,163,74);
      d.text(`سند وارد | نوع الحركة: ${tx.type || 'وارد'}`, 20, 52);
      d.text(`التاريخ: ${tx.date || formatDate(new Date())}`, W - 20, 52, { align: 'right' });
      const rows = [
        ['الصنف', tx.item || '-'],
        ['الشركة', tx.company || '-'],
        ['القسم', tx.cat || '-'],
        ['الكمية', `${tx.qty} ${tx.unit || 'كرتونة'}`],
        ['الجهة', tx.location || 'مستودع الرياض'],
        ['رقم الفاتورة', tx.invoice || 'بدون فاتورة'],
        ['الرصيد بعد الحركة', `${tx.balanceAfter ?? '-'} ${tx.unit || 'كرتونة'}`],
      ];
      d.autoTable({
        startY: 62, head: [['البيان', 'القيمة']],
        body: rows,
        headStyles: { fillColor: [22,163,74], textColor: [255,255,255], halign: 'center' },
        styles: { halign: 'right', fontSize: 12, cellPadding: 5 },
        alternateRowStyles: { fillColor: [240,253,244] },
      });
      const finalY = d.lastAutoTable.finalY + 20;
      d.setFontSize(9); d.setTextColor(100,120,150);
      d.text('توقيع المستلم: ___________________________', 20, finalY);
      d.text('توقيع المدير: ___________________________', W - 20, finalY, { align: 'right' });
      d.setFontSize(7); d.setTextColor(148,163,184);
      d.text(`نظام بركة الثمار PRO — طُبع: ${new Date().toLocaleDateString('ar-SA')}`, W / 2, 287, { align: 'center' });
      d.save(`StockIn_Voucher_${tx.item}_${tx.date || Date.now()}.pdf`);
      toast.success('تم تصدير السند كـ PDF 📄');
    } catch(e) {
      toast.error('خطأ أثناء تصدير السند');
    }
  };

  // --- ROW: Save single voucher as PNG ---
  const handleRowSaveImage = async (tx) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:420px;background:#0f172a;border-radius:20px;padding:24px;font-family:Cairo,sans-serif;direction:rtl;color:white;';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e3a5f,#0f172a);border-radius:14px;padding:16px 20px;margin-bottom:16px;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:1px;">بركة الثمار</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">سند وارد رسمي — Stock-In Voucher</div>
      </div>
      <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#34d399;font-weight:900;font-size:13px;">سند وارد</span>
        <span style="color:#94a3b8;font-size:11px;">${tx.date || formatDate(new Date())}</span>
      </div>
      ${[['الصنف',tx.item||'-'],['الشركة',tx.company||'-'],['الكمية',`${tx.qty} ${tx.unit||'كرتونة'}`],['الجهة',tx.location||'مستودع الرياض'],['الرصيد بعد',`${tx.balanceAfter??'-'}`]].map(([k,v])=>`
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
      link.download = `StockIn_${tx.item}_${tx.date || Date.now()}.png`;
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
      
      {/* 1. Header & Quick Actions */}
      <div className="bg-white border-b border-slate-200 p-4 sm:p-6 shrink-0 z-20 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-14 h-14 bg-primary rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-primary/20 shrink-0">
               <Truck size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">أذونات الوارد</h2>
              <p className="text-sm font-bold text-slate-400 mt-1">تتبع وإدارة تدفق حركة المشتريات بدقة</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse self-end lg:self-auto relative pr-2">
            
            <div className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-primary/5 border border-primary/10 rounded-2xl mr-2">
               <span className="text-xs font-black text-primary uppercase tracking-wider">وارد اليوم:</span>
               <span className="text-xl font-black text-primary leading-none">{todayTotal} <span className="text-[11px] font-bold opacity-60">كرتونة</span></span>
            </div>

            <div className="relative">
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm transition-all shadow-sm">
                <Download size={18} />
                <span>تصدير </span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isExportMenuOpen ? 'rotate-180 text-primary' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                    className="absolute top-full mt-3 right-0 w-56 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-50 text-sm font-bold"
                  >
                    <button onClick={handleExportPDF} className="w-full flex items-center justify-between px-5 py-4 text-slate-600 hover:bg-slate-50 hover:text-primary transition-colors border-b border-slate-50">
                      <span className="flex items-center space-x-3 space-x-reverse"><FileText size={18} /> <span>تحميل PDF</span></span>
                    </button>
                    <button onClick={handleExportPNG} className="w-full flex items-center justify-between px-5 py-4 text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors">
                      <span className="flex items-center space-x-3 space-x-reverse"><Image size={18} /> <span>تحميل صورة PNG</span></span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-10 bg-slate-200 mx-2"></div>

            {!isViewer && (
              <button onClick={() => { setIsAddModalOpen(true); setTimeout(() => itemNameRef.current?.focus(), 100); }} className="flex items-center space-x-2 space-x-reverse px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm hover:shadow-2xl hover:shadow-primary/30 active:scale-95 transition-all shadow-xl shadow-primary/20">
                 <Plus size={20} />
                 <span>إضافة وارد جديد</span>
              </button>
            )}
          </div>

        </div>

        {/* Filter Bar */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="relative group flex-1 min-w-[300px]">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input type="text" placeholder="البحث باسم الصنف، الشركة أو الكود..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-100/50 border border-transparent focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 text-slate-800 text-sm font-bold rounded-2xl pr-11 pl-4 py-3 outline-none transition-all" />
          </div>
          <div className="flex items-center gap-3">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-100/50 border border-transparent text-slate-700 text-sm font-bold rounded-2xl px-5 py-3 cursor-pointer focus:bg-white focus:border-primary/20 outline-none transition-all appearance-none">
              <option>التصنيف: الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
            </select>
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="bg-slate-100/50 border border-transparent text-slate-700 text-sm font-bold rounded-2xl px-5 py-3 cursor-pointer focus:bg-white focus:border-primary/20 outline-none transition-all appearance-none">
              {dynamicCompanies.map(c => <option key={c}>{c === 'الكل' ? 'الشركة: الكل' : c}</option>)}
            </select>
            <button 
              onClick={() => setShowHotOnly(!showHotOnly)} 
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all border ${showHotOnly ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-lg shadow-amber-500/10' : 'bg-slate-100/50 border-transparent text-slate-600 hover:bg-slate-100'}`}
            >
              <Flame size={18} className={showHotOnly ? 'animate-pulse text-amber-500' : ''} />
              <span>نشاط عالي</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sectioned Content (Main View Grid) */}
      <div className="flex-1 overflow-y-auto px-6 pb-12 custom-scrollbar hide-print w-full bg-slate-50/30" id="printable-directory">
        {Object.keys(groupedTransactions).length === 0 ? (
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 mt-8 min-h-[50vh] shadow-sm">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                <Truck size={48} className="text-slate-300 animate-bounce" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3">لا توجد حركات وارد مطابقة</h3>
              <p className="text-slate-400 font-bold mb-10 max-w-sm">قم بإضافة حركات المشتريات والواردات للمخزن لتظهر مصنفة هنا بشكل آلي.</p>
              {!isViewer && (
                <button onClick={() => setIsAddModalOpen(true)} className="btn-primary px-8 py-3.5 shadow-primary/30">إضافة أول حركة وارد</button>
              )}
           </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10 mt-8">
            {Object.keys(groupedTransactions).sort().map(cat => (
              <div key={cat} className="space-y-6">
                
                {/* Category Header */}
                <div className="flex items-center space-x-4 space-x-reverse px-2 sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-3 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-primary">
                    {getCatIcon(cat)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">وارد {cat}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">تصنيف المنتجات</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent via-slate-200 to-transparent mx-4"></div>
                  <span className="text-xs font-black text-primary bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 shadow-sm">{groupedTransactions[cat].length} سند</span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {groupedTransactions[cat].map(tx => (
                     <motion.div 
                      key={tx.id} variants={cardVariants}
                      className="group relative flex flex-col justify-between p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-2xl hover:border-primary/20 transition-all duration-500"
                     >
                      <div className="flex flex-col h-full">
                         <div className="flex items-start justify-between w-full mb-4">
                            <div className="flex flex-col w-full overflow-hidden">
                              <div className="flex items-center justify-between mb-1">
                                 <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase truncate">{tx.company || 'بدون شركة'}</span>
                                 <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                   <Clock size={10} />
                                   {tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '')}
                                 </div>
                              </div>
                              <div className="flex items-center gap-2 w-full">
                                 <h4 className="text-lg font-black text-slate-800 leading-tight group-hover:text-primary transition-colors truncate tracking-tight" title={tx.item}>{tx.item}</h4>
                                 {(hotItemsMap[tx._itemId] || 0) >= 50 && (
                                     <Flame size={18} className="text-amber-500 animate-pulse shrink-0" />
                                 )}
                              </div>
                            </div>
                         </div>
                         
                         <div className="flex items-end justify-between mt-auto pt-4 border-t border-slate-50">
                            <div className="flex flex-col space-y-2">
                               <div className="flex items-center text-[10px] font-black text-slate-500 bg-slate-50 w-max px-2.5 py-1 rounded-lg border border-slate-100">
                                   <MapPin size={10} className="ml-1.5 opacity-60" /> {tx.location || 'مستودع الرياض'}
                               </div>
                               <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-sm font-black bg-emerald-50 text-emerald-600 border border-emerald-100 w-max shadow-sm">
                                 +{tx.qty} <span className="text-[10px] font-bold mr-1 opacity-70">{tx.unit}</span>
                               </span>
                            </div>

                            {/* Row Actions — always visible on hover, tabs visible */}
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                              {!isViewer && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); openEditTx(tx); }} title="تعديل" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:shadow-lg transition-all active:scale-90"><Pencil size={14} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); openDeleteTx(tx); }} title="حذف" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:shadow-lg transition-all active:scale-90"><Trash2 size={14} /></button>
                                </>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); handleRowExportPDF(tx); }} title="تصدير PDF" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/20 hover:shadow-lg transition-all active:scale-90"><FileText size={14} /></button>
                            </div>
                         </div>
                      </div>
                      <div className="absolute bottom-0 right-10 left-10 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out rounded-t-full"></div>
                    </motion.div>
                  ))}
                </div>

              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* --- BULK ADD MULTI-ITEM MODAL --- */}
      <ModalWrapper 
        title="إنشاء إذن وارد مجمع" 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSubmit={handleBulkSubmit}
        loading={loading}
        submitLabel={`تسجيل كافة الأصناف (عدد: ${modalDrafts.length})`}
        maxWidth="max-w-4xl"
        disableSubmit={modalDrafts.length === 0}
      >
        <div className="flex flex-col gap-6">

           {/* ── Row 1: Date + Location ── */}
           <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
              <div>
                <label className={LabelClass}>تاريخ الإذن</label>
                <input type="date" className={InputClass} value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
              </div>
              <div>
                <label className={LabelClass}>جهة الورود / المورد</label>
                <div className="relative">
                   <MapPin size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                   <input type="text" className={`${InputClass} pr-10`} value={bulkLocation} onChange={e => setBulkLocation(e.target.value)} />
                </div>
              </div>
           </div>

           {/* ── Row 2: Entry Grid (Item | Company | Unit | Qty) ── */}
           <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 relative z-30">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">إضافة صنف جديد للقائمة</p>

              {/* 4-col input row */}
              <div className="grid grid-cols-12 gap-3 items-end">

                {/* Item Search — spans 6 cols */}
                <div className="col-span-12 md:col-span-4 relative group/findItem">
                   <label className={LabelClass}>اسم الصنف</label>
                   <div className="relative">
                     <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                     {selectedItemModel ? (
                         <div className="flex items-center justify-between w-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold rounded-xl px-3 py-2.5">
                             <span className="truncate text-xs">{selectedItemModel.name}</span>
                             <button type="button" onClick={handleClearDynamicRow} className="text-emerald-400 hover:text-emerald-600 shrink-0"><X size={13}/></button>
                         </div>
                     ) : (
                         <input 
                           ref={itemNameRef}
                           type="text" 
                           className={`${InputClass} pr-9 text-sm`} 
                           placeholder="ابحث عن الصنف..." 
                           value={searchNameText} 
                           onChange={e => { setSearchNameText(e.target.value); setItemSearchActiveIndex(-1); }}
                           onKeyDown={(e) => {
                              if (e.key === 'ArrowDown') { e.preventDefault(); setItemSearchActiveIndex(prev => prev < itemSuggestions.length - 1 ? prev + 1 : prev); }
                              else if (e.key === 'ArrowUp') { e.preventDefault(); setItemSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                              else if (e.key === 'Enter') {
                                if (itemSearchActiveIndex >= 0 && itemSuggestions[itemSearchActiveIndex]) {
                                  e.preventDefault(); handleSelectSuggestion(itemSuggestions[itemSearchActiveIndex]);
                                } else if (selectedItemModel) {
                                  e.preventDefault(); document.getElementById('stockin-expiry-input')?.focus();
                                }
                              }
                           }}
                         />
                     )}
                   </div>
                   {/* Autocomplete dropdown */}
                   {!selectedItemModel && searchNameText && itemSuggestions.length > 0 && (
                     <div className="absolute top-full right-0 w-full max-h-48 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-1 mt-1">
                       {itemSuggestions.map((suggestion, idx) => (
                         <button key={idx} type="button"
                           className={`w-full text-right px-3 py-2 border-b border-slate-50 last:border-0 transition-colors text-sm flex flex-col items-start ${itemSearchActiveIndex === idx ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'}`}
                           onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(suggestion); }}>
                            <span className="font-black text-xs">{suggestion.name}</span>
                            <span className="text-[10px] opacity-70 font-bold">{suggestion.company || 'بدون شركة'} • قسم {suggestion.cat}</span>
                         </button>
                       ))}
                     </div>
                   )}
                </div>

                {/* Company — 2 cols (readonly) */}
                <div className="col-span-12 md:col-span-2">
                   <label className={LabelClass}>الشركة</label>
                   <input type="text" className="w-full bg-slate-100 border border-transparent text-slate-500 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed truncate" readOnly value={selectedItemModel?.company || '---'} />
                </div>

                {/* Expiry Date — 2 cols */}
                <div className="col-span-12 md:col-span-2">
                   <label className={LabelClass}>تاريخ الانتهاء</label>
                   <input 
                     id="stockin-expiry-input"
                     type="date"
                     className={`${InputClass} text-xs font-bold text-slate-600`} 
                     disabled={!selectedItemModel}
                     value={draftExpiryDate} 
                     onChange={e => setDraftExpiryDate(e.target.value)}
                     onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          document.getElementById('stockin-qty-input')?.focus();
                        }
                     }}
                   />
                   {!draftExpiryDate && selectedItemModel && <p className="text-[10px] text-rose-500 font-bold mt-1 animate-pulse">⚠ حقل إلزامي</p>}
                </div>

                {/* Unit — 2 cols (readonly) */}
                <div className="col-span-12 md:col-span-2">
                   <label className={LabelClass}>الوحدة</label>
                   <input type="text" className="w-full bg-slate-100 border border-transparent text-slate-500 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed text-center" readOnly value={selectedItemModel?.unit || 'كرتونة'} />
                </div>

                {/* Qty + Add — 2 cols */}
                <div className="col-span-12 md:col-span-2">
                   <label className={LabelClass}>الكمية <span className="text-emerald-500">↵</span></label>
                   <input 
                     type="number" min="1" 
                     className={`${InputClass} !border-emerald-500/60 focus:!ring-emerald-500/30 text-emerald-700 font-bold text-center`} 
                     placeholder="0" 
                     disabled={!selectedItemModel}
                     value={draftQty} 
                     onChange={e => setDraftQty(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePushToDraft(); } }}
                   />
                </div>

              </div>
           </div>



           {/* ── Row 3: Review Table ── */}
           <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col relative z-10 shadow-inner">
               <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h4 className="text-sm font-black text-slate-700">مراجعة الأسطر</h4>
                  <span className="text-xs font-bold bg-white px-3 py-1 rounded-full text-emerald-600 border border-slate-200 shadow-sm">{modalDrafts.length} أصناف جاهزة للإذن</span>
               </div>
               
               <div className="max-h-[260px] overflow-y-auto px-2 custom-scrollbar">
                 {modalDrafts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 opacity-60">
                       <CheckCircle size={32} className="mb-2" />
                       <span className="font-bold text-sm">ابحث عن الصنف بالأعلى ثم أدخل الكمية.</span>
                    </div>
                 ) : (
                    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 mt-2">
                      <table className="w-full min-w-[640px] text-right border-separate border-spacing-y-2">
                        <thead>
                       <tr className="text-slate-400 font-black text-xs text-center">
                         <th className="px-2 py-1">م</th>
                         <th className="px-3 py-1 text-right">الصنف</th>
                         <th className="px-3 py-1 text-right">الشركة</th>
                         <th className="px-2 py-1">القسم</th>
                         <th className="px-2 py-1">الصلاحية</th>
                         <th className="px-2 py-1 text-emerald-500">الكمية</th>
                         <th className="px-2 py-1">الوحدة</th>
                         <th className="px-2 py-1 text-center">حذف</th>
                       </tr>
                     </thead>
                     <tbody>
                       <AnimatePresence>
                         {modalDrafts.map((dr, index) => (
                           <motion.tr 
                             key={dr.draftId}
                             initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                             className="bg-slate-50 text-sm font-bold border border-slate-100 shadow-sm transition-all hover:bg-white"
                           >
                             <td className="px-2 py-3 text-center text-slate-400 rounded-r-xl border-y border-r border-slate-200">{index + 1}</td>
                             <td className="px-3 py-3 text-slate-800 border-y border-slate-200">{dr.item}</td>
                             <td className="px-3 py-3 text-slate-600 text-xs border-y border-slate-200">{dr.company}</td>
                             <td className="px-2 py-3 text-center text-indigo-500 text-xs border-y border-slate-200">{dr.cat}</td>
                             <td className="px-2 py-3 text-center border-y border-slate-200">
                                {dr.expiryDate ? <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">{dr.expiryDate}</span> : <span className="text-[10px] text-slate-400">—</span>}
                             </td>
                             <td className="px-2 py-3 text-center border-y border-slate-200"><span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded w-max inline-block shadow-sm">+{dr.qty}</span></td>
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

      {/* EDIT MODAL */}
      <ModalWrapper title="تعديل بيانات السند" isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} loading={loading}>
        <div className="space-y-4">
          <div>
            <label className={LabelClass}>الكمية</label>
            <input type="number" min="1" className={InputClass} value={editForm.qty} onChange={(e) => setEditForm({...editForm, qty: e.target.value})} required />
          </div>
          <div>
            <label className={LabelClass}>مرجع / الفاتورة</label>
            <input type="text" className={InputClass} value={editForm.invoice} onChange={(e) => setEditForm({...editForm, invoice: e.target.value})} />
          </div>
          <div>
            <label className={LabelClass}>التاريخ</label>
            <input type="date" className={InputClass} value={editForm.date} onChange={(e) => setEditForm({...editForm, date: e.target.value})} required />
          </div>
        </div>
      </ModalWrapper>

      {/* DELETE MODAL */}
      <ModalWrapper title="إلغاء سند وارد" isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onSubmit={handleDeleteSubmit} loading={loading} submitLabel="نعم، حذف السند" submitColor="rose">
        <div className="flex flex-col items-center text-center p-2">
           <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4 animate-pulse">
              <AlertTriangle size={32} />
           </div>
           <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">تأكيد حذف سند الوارد</h4>
           <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">
             سيتم إلغاء حركة الوارد واستقطاعها من رصيدها المتوفر الآن.
           </p>
        </div>
      </ModalWrapper>

    </div>
  );
}
