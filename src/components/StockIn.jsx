import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, CheckCircle, Truck, Flame, MapPin, Printer
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, runTransaction, doc, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

// --- HELPER: Date Formatter ---
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

const InputClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block px-4 py-2.5 outline-none transition-all";
const LabelClass = "block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5";

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

  // --- FIREBASE SYNC ---
  useEffect(() => {
    const qItems = query(collection(db, 'items'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTrans = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeItems();
      unsubscribeTrans();
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
    if (!selectedItemModel || !draftQty || Number(draftQty) <= 0 || !draftExpiryDate) {
      toast.error('يرجى اختيار صنف صحيح، إدخال الكمية بصورة سليمة، وتحديد تاريخ الصلاحية.');
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
      await runTransaction(db, async (transaction) => {
        // Accumulate exactly identical item drops
        const itemAggregates = {};
        modalDrafts.forEach(entry => {
          if (!itemAggregates[entry.itemId]) itemAggregates[entry.itemId] = 0;
          itemAggregates[entry.itemId] += entry.qty;
        });

        // Pre-read
        const itemDocs = [];
        for (const [id, aggQty] of Object.entries(itemAggregates)) {
          const ref = doc(db, 'items', id);
          const docSnap = await transaction.get(ref);
          if (docSnap.exists()) {
            itemDocs.push({ ref, data: docSnap.data(), aggregateQty: aggQty });
          }
        }

        // Writes
        const runningBalances = {};
        for (const { ref, data, aggregateQty } of itemDocs) {
          const newStock = Number(data.stockQty || 0) + aggregateQty;
          runningBalances[ref.id] = Number(data.stockQty || 0);
          transaction.update(ref, { stockQty: newStock });
        }

        modalDrafts.slice().reverse().forEach(entry => {
           const txRef = doc(collection(db, 'transactions'));
           if(runningBalances[entry.itemId] !== undefined) {
             runningBalances[entry.itemId] += entry.qty;
           }

           transaction.set(txRef, {
             type: 'وارد',
             item: entry.item,
             itemId: entry.itemId,
             company: entry.company,
             qty: entry.qty,
             unit: entry.unit,
             cat: entry.cat,
             invoice: 'بدون فاتورة', // Removed per instructions
             location: bulkLocation.trim() || 'مستودع الرياض',
             date: bulkDate,
             timestamp: serverTimestamp(),
             expiryDate: entry.expiryDate || '',
             balanceAfter: runningBalances[entry.itemId] || entry.qty
           });
        });
      });

      toast.success(`تم حفظ ${modalDrafts.length} أصناف وتحديث الرصيد بنجاح ✅`);
      playSuccess();
      setModalDrafts([]);
      setIsAddModalOpen(false);
      handleClearDynamicRow();

    } catch (err) {
      toast.error('حدث خطأ أثناء المزامنة الجماعية. يرجى المحاولة مرة أخرى.');
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
      const txRef = doc(db, 'transactions', selectedTx.id);
      const matchedItem = items.find(i => i.id === selectedTx.itemId || (i.name === selectedTx.item && (i.company || 'بدون شركة') === (selectedTx.company || 'بدون شركة')));
      
      await runTransaction(db, async (transaction) => {
        if (matchedItem) {
            const itemRef = doc(db, 'items', matchedItem.id);
            const itemDoc = await transaction.get(itemRef);
            if (itemDoc.exists()) {
                const diff = Number(editForm.qty) - Number(selectedTx.qty);
                const currentBalance = Number(itemDoc.data().stockQty || 0);
                transaction.update(itemRef, { stockQty: currentBalance + diff });
            }
        }
        transaction.update(txRef, { qty: Number(editForm.qty), invoice: editForm.invoice, date: editForm.date });
      });
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
      const txRef = doc(db, 'transactions', selectedTx.id);
      const matchedItem = items.find(i => i.id === selectedTx.itemId || (i.name === selectedTx.item && (i.company || 'بدون شركة') === (selectedTx.company || 'بدون شركة')));
      
      await runTransaction(db, async (transaction) => {
        if (matchedItem) {
            const itemRef = doc(db, 'items', matchedItem.id);
            const itemDoc = await transaction.get(itemRef);
            if (itemDoc.exists()) {
                const currentBalance = Number(itemDoc.data().stockQty || 0);
                transaction.update(itemRef, { stockQty: Math.max(0, currentBalance - Number(selectedTx.qty)) });
            }
        }
        transaction.delete(txRef);
      });
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
    <div className="h-full w-full flex flex-col font-['Cairo'] text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">
      
      {/* 1. Header & Quick Actions */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 mb-6 shrink-0 z-20 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
               <Truck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">أذونات الوارد</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">تتبع وإدارة تدفق حركة المشتريات بدقة</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse self-end lg:self-auto relative pr-2">
            
            <div className="flex items-center space-x-2 space-x-reverse px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl mr-2">
               <span className="text-xs font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">وارد اليوم:</span>
               <span className="text-lg font-black text-indigo-700 dark:text-indigo-300 leading-none">{todayTotal} <span className="text-[10px]">كرتونة</span></span>
            </div>

            <div className="relative">
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center space-x-2 space-x-reverse px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all shadow-sm shadow-slate-200/50 dark:shadow-none">
                <Download size={16} />
                <span>تصدير </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180 text-blue-500' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-[120%] right-0 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl rounded-2xl overflow-hidden z-50 text-sm font-bold"
                  >
                    <button onClick={handleExportPDF} className="w-full flex items-center justify-between px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <span className="flex items-center space-x-2 space-x-reverse"><FileText size={16} /> <span>تحميل PDF</span></span>
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700/50 w-full"></div>
                    <button onClick={handleExportPNG} className="w-full flex items-center justify-between px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                      <span className="flex items-center space-x-2 space-x-reverse"><Image size={16} /> <span>تحميل صورة PNG</span></span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <button
              onClick={handleBlankTemplate}
              className="flex items-center space-x-2 space-x-reverse px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/30 bg-white/10 backdrop-blur-md text-slate-700 dark:text-white hover:bg-white/20 hover:border-white/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
              title="طباعة سند وارد فارغ للكتابة اليدوية"
            >
              <Printer size={16} className="opacity-80" />
              <span>طباعة سند فارغ</span>
            </button>

            {!isViewer && (
              <button onClick={() => { setIsAddModalOpen(true); setTimeout(() => itemNameRef.current?.focus(), 100); }} className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg hover:shadow-slate-500/20">
                 <Plus size={18} />
                 <span>إضافة وارد</span>
              </button>
            )}
          </div>

        </div>

        {/* Filter Bar */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative group lg:col-span-2 flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-inner">
            <Search size={16} className="text-slate-400 group-focus-within:text-blue-500 transition-colors ml-3" />
            <input type="text" placeholder="البحث باسم الصنف، الشركة..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent text-slate-800 dark:text-slate-100 text-sm font-bold focus:outline-none" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors shadow-inner appearance-none">
            <option>الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
          </select>
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors shadow-inner appearance-none">
            {dynamicCompanies.map(c => <option key={c}>{c}</option>)}
          </select>
          <button 
            onClick={() => setShowHotOnly(!showHotOnly)} 
            className={`w-full flex items-center justify-center space-x-2 space-x-reverse rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-inner border truncate ${showHotOnly ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 shadow-[inset_0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Flame size={18} className={showHotOnly ? 'animate-pulse' : ''} />
            <span>نشاط عالي</span>
          </button>
        </div>
      </div>

      {/* 2. Sectioned Content (Main View Grid) */}
      <div className="flex-1 overflow-y-auto px-1 pb-10 custom-scrollbar hide-print w-full" id="printable-directory">
        {Object.keys(groupedTransactions).length === 0 ? (
           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center p-12 text-center bg-white/40 dark:bg-slate-800/20 backdrop-blur-md rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 mt-4 h-[50vh] shadow-sm">
              <Truck size={56} className="text-slate-300 dark:text-slate-600 mb-6 animate-bounce" />
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">لا توجد حركات وارد مطابقة</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold mb-8 max-w-sm text-center">قم بإضافة حركات المشتريات والواردات للمخزن لتظهر مصنفة هنا.</p>
           </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8">
            {Object.keys(groupedTransactions).sort().map(cat => (
              <div key={cat} className="space-y-4">
                
                {/* Category Header */}
                <div className="flex items-center space-x-3 space-x-reverse px-2 sticky top-0 z-10 bg-slate-50/90 dark:bg-[#080d17]/90 backdrop-blur-md py-2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700/60 flex items-center justify-center">
                    {getCatIcon(cat)}
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">وارد {cat}</h3>
                  <div className="flex-1 h-px bg-gradient-to-l from-slate-200/0 via-slate-200 dark:via-slate-700 to-slate-200/0"></div>
                  <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">{groupedTransactions[cat].length} سند</span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 px-1">
                  {groupedTransactions[cat].map(tx => (
                     <motion.div 
                      key={tx.id} variants={cardVariants}
                      className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-slate-100 dark:border-slate-700/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300"
                     >
                      <div className="flex flex-col h-full">
                         <div className="flex items-start justify-between w-full mb-3">
                            <div className="flex flex-col w-full overflow-hidden">
                              <div className="flex items-center justify-between mb-0.5">
                                 <span className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase truncate">{tx.company || 'بدون شركة'}</span>
                                 <span className="text-[10px] font-bold text-slate-400">{tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '')}</span>
                              </div>
                              <div className="flex items-center gap-1.5 w-full">
                                 <h4 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate" title={tx.item}>{tx.item}</h4>
                                 {(hotItemsMap[tx._itemId] || 0) >= 50 && (
                                     <Flame size={16} className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-[pulse_2s_ease-in-out_infinite] shrink-0" />
                                 )}
                              </div>
                            </div>
                         </div>
                         
                         <div className="flex items-end justify-between mt-auto pt-2">
                            <div className="flex flex-col space-y-1.5">
                               <div className="flex items-center text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 w-max px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                                   <MapPin size={10} className="mr-1 opacity-70" /> {tx.location || 'مستودع الرياض'}
                               </div>
                               <span className="inline-flex items-center px-2 py-1 rounded-lg text-sm font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 w-max">
                                 +{tx.qty} <span className="text-[10px] mr-1">{tx.unit}</span>
                               </span>
                            </div>

                            {/* Row Actions — always visible on hover, tabs visible */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                              {!isViewer && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); openEditTx(tx); }} title="تعديل" className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-400/50 hover:shadow-[0_0_10px_rgba(52,211,153,0.3)] transition-all"><Pencil size={13} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); openDeleteTx(tx); }} title="حذف" className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-400/50 hover:shadow-[0_0_10px_rgba(251,113,133,0.3)] transition-all"><Trash2 size={13} /></button>
                                </>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); handleRowExportPDF(tx); }} title="تصدير PDF" className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-400 hover:border-blue-400/50 hover:shadow-[0_0_10px_rgba(96,165,250,0.3)] transition-all"><FileText size={13} /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleRowSaveImage(tx); }} title="حفظ صورة" className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-violet-400 hover:border-violet-400/50 hover:shadow-[0_0_10px_rgba(167,139,250,0.3)] transition-all"><Image size={13} /></button>
                            </div>
                         </div>
                      </div>
                      <div className="absolute bottom-0 right-0 w-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 group-hover:w-full transition-all duration-500 ease-out"></div>
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
           <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <label className={LabelClass}>تاريخ الإذن</label>
                <input type="date" className={InputClass} value={bulkDate} onChange={e => setBulkDate(e.target.value)} required />
              </div>
              <div>
                <label className={LabelClass}>جهة الورود / المورد</label>
                <div className="relative">
                   <MapPin size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                   <input type="text" className={`${InputClass} pr-10`} value={bulkLocation} onChange={e => setBulkLocation(e.target.value)} required />
                </div>
              </div>
           </div>

           {/* ── Row 2: Entry Grid (Item | Company | Unit | Qty) ── */}
           <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col gap-3 relative z-30">
              <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">إضافة صنف جديد للقائمة</p>

              {/* 4-col input row */}
              <div className="grid grid-cols-12 gap-3 items-end">

                {/* Item Search — spans 6 cols */}
                <div className="col-span-12 md:col-span-4 relative group/findItem">
                   <label className={LabelClass}>اسم الصنف</label>
                   <div className="relative">
                     <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                     {selectedItemModel ? (
                         <div className="flex items-center justify-between w-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-bold rounded-xl px-3 py-2.5">
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
                              else if (e.key === 'Enter' && itemSearchActiveIndex >= 0 && itemSuggestions[itemSearchActiveIndex]) {
                                e.preventDefault(); handleSelectSuggestion(itemSuggestions[itemSearchActiveIndex]);
                              }
                           }}
                         />
                     )}
                   </div>
                   {/* Autocomplete dropdown */}
                   {!selectedItemModel && searchNameText && itemSuggestions.length > 0 && (
                     <div className="absolute top-full right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 p-1 mt-1">
                       {itemSuggestions.map((suggestion, idx) => (
                         <button key={idx} type="button"
                           className={`w-full text-right px-3 py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0 transition-colors text-sm flex flex-col items-start ${itemSearchActiveIndex === idx ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
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
                   <input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed truncate" readOnly value={selectedItemModel?.company || '---'} />
                </div>

                {/* Expiry Date (Required) — 2 cols */}
                <div className="col-span-12 md:col-span-2">
                   <label className={LabelClass}>تاريخ الانتهاء <span className="text-rose-500">*</span></label>
                   <input 
                     type="date" 
                     className={`${InputClass} text-xs font-bold ${!draftExpiryDate && selectedItemModel ? 'border-rose-400 dark:border-rose-500/60 ring-2 ring-rose-500/20' : 'text-slate-600 dark:text-slate-400'}`} 
                     disabled={!selectedItemModel}
                     value={draftExpiryDate} 
                     onChange={e => setDraftExpiryDate(e.target.value)}
                     required
                   />
                   {!draftExpiryDate && selectedItemModel && <p className="text-[10px] text-rose-500 font-bold mt-1 animate-pulse">⚠ حقل إلزامي</p>}
                </div>

                {/* Unit — 2 cols (readonly) */}
                <div className="col-span-12 md:col-span-2">
                   <label className={LabelClass}>الوحدة</label>
                   <input type="text" className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed text-center" readOnly value={selectedItemModel?.unit || 'كرتونة'} />
                </div>

                {/* Qty + Add — 2 cols */}
                <div className="col-span-12 md:col-span-2">
                   <label className={LabelClass}>الكمية <span className="text-emerald-500">↵</span></label>
                   <input 
                     type="number" min="1" 
                     className={`${InputClass} !border-emerald-500/60 focus:!ring-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-center`} 
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
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col relative z-10 shadow-inner">
               <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between shrink-0">
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">مراجعة الأسطر</h4>
                  <span className="text-xs font-bold bg-white dark:bg-slate-700 px-3 py-1 rounded-full text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-600 shadow-sm">{modalDrafts.length} أصناف جاهزة للإذن</span>
               </div>
               
               <div className="max-h-[260px] overflow-y-auto px-2 custom-scrollbar">
                 {modalDrafts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 py-10 opacity-60">
                       <CheckCircle size={32} className="mb-2" />
                       <span className="font-bold text-sm">ابحث عن الصنف بالأعلى ثم أدخل الكمية.</span>
                    </div>
                 ) : (
                    <table className="w-full text-right border-separate border-spacing-y-2 mt-2">
                     <thead>
                       <tr className="text-slate-400 dark:text-slate-500 font-black text-xs text-center">
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
                             className="bg-slate-50 dark:bg-slate-800/40 text-sm font-bold border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-800"
                           >
                             <td className="px-2 py-3 text-center text-slate-400 rounded-r-xl border-y border-r border-slate-200 dark:border-slate-700">{index + 1}</td>
                             <td className="px-3 py-3 text-slate-800 dark:text-slate-200 border-y border-slate-200 dark:border-slate-700">{dr.item}</td>
                             <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs border-y border-slate-200 dark:border-slate-700">{dr.company}</td>
                             <td className="px-2 py-3 text-center text-indigo-500 dark:text-indigo-400 text-xs border-y border-slate-200 dark:border-slate-700">{dr.cat}</td>
                             <td className="px-2 py-3 text-center border-y border-slate-200 dark:border-slate-700">
                                {dr.expiryDate ? <span className="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">{dr.expiryDate}</span> : <span className="text-[10px] text-slate-400">—</span>}
                             </td>
                             <td className="px-2 py-3 text-center border-y border-slate-200 dark:border-slate-700"><span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded w-max inline-block shadow-sm">+{dr.qty}</span></td>
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
