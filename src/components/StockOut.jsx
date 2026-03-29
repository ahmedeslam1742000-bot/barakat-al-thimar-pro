import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, CheckCircle, ArrowUpRight, Flame, User, Printer
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, runTransaction, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

// --- HELPERS ---
const formatDate = (date) => {
  if (!date) return '';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" 
        dir="rtl" onMouseDown={onClose}
      >
        <motion.div 
          onMouseDown={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
            <h3 className="text-lg font-black text-slate-800 dark:text-white">{title}</h3>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white rounded-full transition-colors">
              <X size={20} className="stroke-[3]" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex space-x-3 space-x-reverse justify-end shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
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

const InputClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 block px-4 py-2.5 outline-none transition-all";
const LabelClass = "block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5";

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

  // --- FIREBASE SYNC ---
  useEffect(() => {
    const unsubItems = onSnapshot(query(collection(db, 'items')), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTrans = onSnapshot(query(collection(db, 'transactions'), orderBy('timestamp', 'desc')), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubItems(); unsubTrans(); };
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
    if (modalDrafts.length === 0) return;
    if (!bulkRecipient.trim()) {
      toast.error('يرجى إدخال اسم المستلم قبل تأكيد الصرف.');
      playWarning();
      return;
    }
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // Aggregate duplicates
        const itemAggregates = {};
        modalDrafts.forEach(entry => {
          if (!itemAggregates[entry.itemId]) itemAggregates[entry.itemId] = 0;
          itemAggregates[entry.itemId] += entry.qty;
        });

        // Pre-read all affected items
        const itemDocs = [];
        for (const [id, aggQty] of Object.entries(itemAggregates)) {
          const ref = doc(db, 'items', id);
          const snap = await transaction.get(ref);
          if (snap.exists()) {
            itemDocs.push({ ref, data: snap.data(), aggregateQty: aggQty });
          }
        }

        // Validate stock (server-side check)
        for (const { data, aggregateQty, ref } of itemDocs) {
          const currentStock = Number(data.stockQty || 0);
          if (aggregateQty > currentStock) {
            throw new Error(`رصيد "${data.name}" غير كافٍ. المتاح: ${currentStock}، المطلوب: ${aggregateQty}`);
          }
        }

        // Write: update items stock
        const runningBalances = {};
        for (const { ref, data, aggregateQty } of itemDocs) {
          const newStock = Number(data.stockQty || 0) - aggregateQty;
          runningBalances[ref.id] = Number(data.stockQty || 0);
          transaction.update(ref, { stockQty: newStock });
        }

        // Write: transaction documents
        modalDrafts.slice().reverse().forEach(entry => {
          const txRef = doc(collection(db, 'transactions'));
          if (runningBalances[entry.itemId] !== undefined) {
            runningBalances[entry.itemId] -= entry.qty;
          }
          transaction.set(txRef, {
            type: 'صادر',
            item: entry.item,
            itemId: entry.itemId,
            company: entry.company,
            qty: entry.qty,
            unit: entry.unit,
            cat: entry.cat,
            recipient: bulkRecipient.trim(),
            date: bulkDate,
            timestamp: serverTimestamp(),
            balanceAfter: runningBalances[entry.itemId] ?? 0,
          });
        });
      });

      toast.success(`✅ تم صرف ${modalDrafts.length} أصناف لـ "${bulkRecipient}" وتحديث المخزن بنجاح`);
      playSuccess();
      setModalDrafts([]);
      setBulkRecipient('');
      setBulkDate(formatDate(new Date()));
      setIsAddModalOpen(false);
      handleClearDynamicRow();
    } catch (err) {
      const msg = err.message?.includes('رصيد') ? err.message : 'حدث خطأ أثناء المزامنة. يرجى المحاولة.';
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
      const txRef = doc(db, 'transactions', selectedTx.id);
      const matchedItem = items.find(i => i.id === selectedTx.itemId);
      await runTransaction(db, async (transaction) => {
        if (matchedItem) {
          const itemRef = doc(db, 'items', matchedItem.id);
          const itemDoc = await transaction.get(itemRef);
          if (itemDoc.exists()) {
            const diff = Number(selectedTx.qty) - Number(editForm.qty); // positive = returning stock
            transaction.update(itemRef, { stockQty: Number(itemDoc.data().stockQty || 0) + diff });
          }
        }
        transaction.update(txRef, { qty: Number(editForm.qty), date: editForm.date, recipient: editForm.recipient });
      });
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
      const txRef = doc(db, 'transactions', selectedTx.id);
      const matchedItem = items.find(i => i.id === selectedTx.itemId);
      await runTransaction(db, async (transaction) => {
        if (matchedItem) {
          const itemRef = doc(db, 'items', matchedItem.id);
          const itemDoc = await transaction.get(itemRef);
          if (itemDoc.exists()) {
            transaction.update(itemRef, { stockQty: Number(itemDoc.data().stockQty || 0) + Number(selectedTx.qty) });
          }
        }
        transaction.delete(txRef);
      });
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
    <div className="h-full w-full flex flex-col font-['Cairo'] text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">

      {/* ─── HEADER ─── */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 mb-6 shrink-0 z-20 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0">
              <ArrowUpRight size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">أذونات الصادر</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">إدارة عمليات صرف وتوزيع البضاعة من المستودع</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse self-end lg:self-auto relative pr-2">
            {/* Today badge */}
            <div className="flex items-center space-x-2 space-x-reverse px-4 py-2 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl mr-2">
              <span className="text-xs font-black text-orange-500 dark:text-orange-400 uppercase tracking-wider">صادر اليوم:</span>
              <span className="text-lg font-black text-orange-700 dark:text-orange-300 leading-none">{todayTotal} <span className="text-[10px]">كرتونة</span></span>
            </div>

            {/* Export dropdown */}
            <div className="relative">
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center space-x-2 space-x-reverse px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all shadow-sm">
                <Download size={16} /><span>تصدير</span>
                <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180 text-orange-500' : ''}`} />
              </button>
              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.15 }}
                    className="absolute top-[120%] right-0 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl rounded-2xl overflow-hidden z-50 text-sm font-bold">
                    <button onClick={handleExportPDF} className="w-full flex items-center space-x-2 space-x-reverse px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-orange-600 transition-colors">
                      <FileText size={16} /><span>تحميل PDF</span>
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
                    <button onClick={() => { toast.info('جاري تجهيز الصفحة للطباعة...'); window.print(); setIsExportMenuOpen(false); }} className="w-full flex items-center space-x-2 space-x-reverse px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-emerald-600 transition-colors">
                      <Image size={16} /><span>تحميل صورة PNG</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

            {/* Blank Template Button — Glassmorphism */}
            <button
              onClick={handleBlankTemplate}
              className="flex items-center space-x-2 space-x-reverse px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/30 bg-white/10 backdrop-blur-md text-slate-700 dark:text-white hover:bg-white/20 hover:border-white/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
              title="طباعة سند إخراج فارغ للكتابة اليدوية"
            >
              <Printer size={16} className="opacity-80" />
              <span>طباعة سند فارغ</span>
            </button>

            {!isViewer && (
              <button
                onClick={() => { setModalDrafts([]); setBulkRecipient(''); setBulkDate(formatDate(new Date())); setIsAddModalOpen(true); setTimeout(() => itemNameRef.current?.focus(), 150); }}
                className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-br from-orange-500 to-rose-600 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-orange-500/25">
                <Plus size={18} /><span>إضافة صادر</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative group lg:col-span-2 flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all shadow-inner">
            <Search size={16} className="text-slate-400 group-focus-within:text-orange-500 transition-colors ml-3" />
            <input type="text" placeholder="البحث بالصنف، الشركة، أو المستلم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent text-slate-800 dark:text-slate-100 text-sm font-bold focus:outline-none" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-orange-500 transition-colors shadow-inner appearance-none">
            <option>الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
          </select>
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-orange-500 transition-colors shadow-inner appearance-none">
            {dynamicCompanies.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowHotOnly(!showHotOnly)}
            className={`w-full flex items-center justify-center space-x-2 space-x-reverse rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-inner border ${showHotOnly ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Flame size={18} className={showHotOnly ? 'animate-pulse' : ''} /><span>نشاط عالي</span>
          </button>
        </div>
      </div>

      {/* ─── SECTIONED GRID ─── */}
      <div className="flex-1 overflow-y-auto px-1 pb-10 custom-scrollbar w-full">
        {Object.keys(groupedTransactions).length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-12 text-center bg-white/40 dark:bg-slate-800/20 backdrop-blur-md rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 mt-4 h-[50vh]">
            <ArrowUpRight size={56} className="text-slate-300 dark:text-slate-600 mb-6 animate-bounce" />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">لا توجد حركات صادر مطابقة</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold max-w-sm text-center">أضف أذونات الصرف والتوزيع من المستودع لتظهر هنا مصنفة بالأقسام.</p>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8">
            {Object.keys(groupedTransactions).sort().map(cat => (
              <div key={cat} className="space-y-4">
                {/* Section Header */}
                <div className="flex items-center space-x-3 space-x-reverse px-2 sticky top-0 z-10 bg-slate-50/90 dark:bg-[#080d17]/90 backdrop-blur-md py-2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700/60 flex items-center justify-center">
                    {getCatIcon(cat)}
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">صادر {cat}</h3>
                  <div className="flex-1 h-px bg-gradient-to-l from-slate-200/0 via-slate-200 dark:via-slate-700 to-slate-200/0"></div>
                  <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">{groupedTransactions[cat].length} سند</span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 px-1">
                  {groupedTransactions[cat].map(tx => (
                    <motion.div key={tx.id} variants={cardVariants}
                      className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-slate-100 dark:border-slate-700/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 overflow-hidden">
                      <div className="flex flex-col h-full">
                        <div className="flex flex-col mb-3">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase truncate">{tx.company || 'بدون شركة'}</span>
                            <span className="text-[10px] font-bold text-slate-400">{tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '')}</span>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <h4 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">{tx.item}</h4>
                            {(hotItemsMap[tx._itemId] || 0) >= 50 && (
                              <Flame size={16} className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-[pulse_2s_ease-in-out_infinite] shrink-0" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-end justify-between mt-auto">
                          <div className="flex flex-col space-y-2">
                            {/* Recipient badge */}
                            {tx.recipient && (
                              <div className="flex items-center text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 w-max px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                                <User size={10} className="mr-1 opacity-70" /> {tx.recipient}
                              </div>
                            )}
                            {/* Qty badge — orange/rose for outgoing */}
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-sm font-black bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20 w-max">
                              -{tx.qty} <span className="text-[10px] mr-1">{tx.unit}</span>
                            </span>
                          </div>

                          {/* Actions Menu */}
                          <div className="opacity-0 group-hover:opacity-100 flex space-x-1.5 space-x-reverse transition-opacity duration-300">
                            {!isViewer && (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); openEditTx(tx); }} title="تعديل" className="p-1.5 bg-white dark:bg-slate-900 rounded-lg text-slate-400 hover:text-emerald-400 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-emerald-400/40 hover:shadow-[0_0_12px_rgba(52,211,153,0.35)] transition-all duration-200"><Pencil size={15} /></button>
                                <button onClick={(e) => { e.stopPropagation(); openDeleteTx(tx); }} title="حذف" className="p-1.5 bg-white dark:bg-slate-900 rounded-lg text-slate-400 hover:text-rose-400 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-rose-400/40 hover:shadow-[0_0_12px_rgba(251,113,133,0.35)] transition-all duration-200"><Trash2 size={15} /></button>
                              </>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); handleRowExportPDF(tx); }} title="تصدير PDF" className="p-1.5 bg-white dark:bg-slate-900 rounded-lg text-slate-400 hover:text-blue-400 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-blue-400/40 hover:shadow-[0_0_12px_rgba(96,165,250,0.35)] transition-all duration-200"><FileText size={15} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleRowSaveImage(tx); }} title="حفظ صورة" className="p-1.5 bg-white dark:bg-slate-900 rounded-lg text-slate-400 hover:text-violet-400 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-violet-400/40 hover:shadow-[0_0_12px_rgba(167,139,250,0.35)] transition-all duration-200"><Image size={15} /></button>
                          </div>
                        </div>
                      </div>
                      {/* Bottom accent — orange for outgoing */}
                      <div className="absolute bottom-0 right-0 w-0 h-1 bg-gradient-to-r from-orange-500 to-rose-500 group-hover:w-full transition-all duration-500 ease-out"></div>
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
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <label className={LabelClass}>\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0630\u0646</label>
              <input type="date" className={InputClass} value={bulkDate} onChange={e => setBulkDate(e.target.value)} required />
            </div>
            <div>
              <label className={LabelClass}>\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0644\u0645 / \u0627\u0644\u0645\u0646\u062f\u0648\u0628 <span className="text-rose-500">*</span></label>
              <div className="relative">
                <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input type="text" className={`${InputClass} pr-10`} placeholder="\u0645\u062b\u0627\u0644: \u0623\u062d\u0645\u062f \u0645\u062d\u0645\u062f..." value={bulkRecipient} onChange={e => setBulkRecipient(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Row 2: 4-col Entry Grid */}
          <div className="bg-orange-50/50 dark:bg-slate-800/40 border border-orange-200/60 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col gap-3 relative z-30">
            <p className="text-[11px] font-black text-orange-400 dark:text-orange-500/70 uppercase tracking-widest">\u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u0644\u0644\u0635\u0631\u0641</p>
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-6 relative group/findItem">
                <label className={LabelClass}>\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641</label>
                <div className="relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  {selectedItemModel ? (
                    <div className="flex items-center justify-between w-full bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-800 dark:text-orange-300 text-sm font-bold rounded-xl px-3 py-2.5">
                      <span className="truncate text-xs">{selectedItemModel.name}</span>
                      <button type="button" onClick={handleClearDynamicRow} className="text-orange-400 hover:text-orange-600 shrink-0"><X size={13} /></button>
                    </div>
                  ) : (
                    <input ref={itemNameRef} type="text" className={`${InputClass} pr-9 text-sm`} placeholder="\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u0635\u0646\u0641..."
                      value={searchNameText} onChange={e => { setSearchNameText(e.target.value); setItemSearchActiveIndex(-1); }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setItemSearchActiveIndex(p => p < itemSuggestions.length - 1 ? p + 1 : p); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setItemSearchActiveIndex(p => p > 0 ? p - 1 : 0); }
                        else if (e.key === 'Enter' && itemSearchActiveIndex >= 0 && itemSuggestions[itemSearchActiveIndex]) { e.preventDefault(); handleSelectSuggestion(itemSuggestions[itemSearchActiveIndex]); }
                      }} />
                  )}
                </div>
                {!selectedItemModel && searchNameText && itemSuggestions.length > 0 && (
                  <div className="absolute top-full right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 p-1 mt-1">
                    {itemSuggestions.map((s, idx) => (
                      <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                        className={`w-full text-right px-3 py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0 text-sm flex flex-col items-start transition-colors ${itemSearchActiveIndex === idx ? 'bg-orange-50 dark:bg-orange-500/20 text-orange-700' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <span className="font-black text-xs">{s.name}</span>
                        <span className="text-[10px] opacity-70 font-bold">{s.company || '\u0628\u062f\u0648\u0646 \u0634\u0631\u0643\u0629'} \u2022 {s.cat} \u2022 \u0631\u0635\u064a\u062f: {s.stockQty ?? '\u2014'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className={LabelClass}>\u0627\u0644\u0634\u0631\u0643\u0629</label>
                <input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed truncate" readOnly value={selectedItemModel?.company || '---'} />
              </div>
              <div className="col-span-2">
                <label className={LabelClass}>\u0627\u0644\u0648\u062d\u062f\u0629</label>
                <input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed text-center" readOnly value={selectedItemModel?.unit || '\u0643\u0631\u062a\u0648\u0646\u0629'} />
              </div>
              <div className="col-span-2">
                <label className={LabelClass}>\u0627\u0644\u0643\u0645\u064a\u0629 <span className="text-orange-500">\u21b5</span></label>
                <input id="stock-out-qty-input" type="number" min="1"
                  className={`${InputClass} !border-orange-500/60 focus:!ring-orange-500/30 text-orange-700 dark:text-orange-400 font-bold text-center`}
                  placeholder="0" disabled={!selectedItemModel} value={draftQty}
                  onChange={e => setDraftQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePushToDraft(); } }} />
              </div>
            </div>
          </div>

          {/* Row 3: Review Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-inner">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0623\u0633\u0637\u0631</h4>
              <span className="text-xs font-bold bg-white dark:bg-slate-700 px-3 py-1 rounded-full text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-slate-600 shadow-sm">{modalDrafts.length} \u0623\u0635\u0646\u0627\u0641 \u0645\u064f\u0639\u062f\u0651\u0629 \u0644\u0644\u0635\u0631\u0641</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto px-2 custom-scrollbar">
              {modalDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600 opacity-60">
                  <CheckCircle size={32} className="mb-2" />
                  <span className="font-bold text-sm">\u0627\u0628\u062d\u062b \u0639\u0646 \u0635\u0646\u0641 \u0628\u0627\u0644\u0623\u0639\u0644\u0649 \u062b\u0645 \u0623\u062f\u062e\u0644 \u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0631\u0627\u062f \u0635\u0631\u0641\u0647\u0627.</span>
                </div>
              ) : (
                <table className="w-full text-right border-separate border-spacing-y-2 mt-2">
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 font-black text-xs text-center">
                      <th className="px-2 py-1">\u0645</th><th className="px-3 py-1 text-right">\u0627\u0644\u0635\u0646\u0641</th><th className="px-3 py-1 text-right">\u0627\u0644\u0634\u0631\u0643\u0629</th>
                      <th className="px-2 py-1">\u0627\u0644\u0642\u0633\u0645</th><th className="px-2 py-1 text-orange-500">\u0627\u0644\u0643\u0645\u064a\u0629</th><th className="px-2 py-1">\u0627\u0644\u0648\u062d\u062f\u0629</th><th className="px-2 py-1 text-center">\u062d\u0630\u0641</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {modalDrafts.map((dr, index) => (
                        <motion.tr key={dr.draftId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-slate-50 dark:bg-slate-800/40 text-sm font-bold hover:bg-white dark:hover:bg-slate-800 transition-all">
                          <td className="px-2 py-3 text-center text-slate-400 rounded-r-xl border-y border-r border-slate-200 dark:border-slate-700">{index + 1}</td>
                          <td className="px-3 py-3 text-slate-800 dark:text-slate-200 border-y border-slate-200 dark:border-slate-700">{dr.item}</td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs border-y border-slate-200 dark:border-slate-700">{dr.company}</td>
                          <td className="px-2 py-3 text-center text-orange-500 dark:text-orange-400 text-xs border-y border-slate-200 dark:border-slate-700">{dr.cat}</td>
                          <td className="px-2 py-3 text-center border-y border-slate-200 dark:border-slate-700"><span className="bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-3 py-1 rounded inline-block">-{dr.qty}</span></td>
                          <td className="px-2 py-3 text-center text-slate-500 text-xs border-y border-slate-200 dark:border-slate-700">{dr.unit}</td>
                          <td className="px-2 py-3 text-center rounded-l-xl border-y border-l border-slate-200 dark:border-slate-700">
                            <button onClick={() => setModalDrafts(prev => prev.filter(d => d.draftId !== dr.draftId))} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors mx-auto block">
                              <X size={16} className="stroke-[3]" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
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
