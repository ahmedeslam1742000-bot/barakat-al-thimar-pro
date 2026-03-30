import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Pencil, Trash2, FileText, Snowflake, Package, Archive, Box, AlertTriangle,
  Download, ChevronDown, CheckCircle, RotateCcw, Flame, User, ShieldCheck, ShieldX,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection, onSnapshot, query, orderBy, runTransaction, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getItemName, getCompany, getCategory, getUnit } from '../lib/itemFields';

const formatDate = (date) => {
  if (!date) return '';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  return d.toISOString().split('T')[0];
};

const categoryIcons = {
  مجمدات: <Snowflake size={18} className="text-cyan-500" />,
  بلاستيك: <Archive size={18} className="text-amber-500" />,
  تبريد: <Box size={18} className="text-blue-500" />,
};
const getCatIcon = (cat) => categoryIcons[cat] || <Package size={18} className="text-slate-500" />;

const StatusBadge = ({ status }) =>
  status === 'سليم' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      <ShieldCheck size={12} /> سليم ✅
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black bg-rose-500/15 text-rose-400 border border-rose-500/25">
      <ShieldX size={12} /> تالف ❌
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
        dir="rtl"
        onMouseDown={onClose}
      >
        <motion.div
          onMouseDown={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
            <h3 className="text-lg font-black text-slate-800 dark:text-white">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white rounded-full transition-colors"
            >
              <X size={20} className="stroke-[3]" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex space-x-3 space-x-reverse justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading || disableSubmit}
                className={`px-6 py-2 rounded-xl font-bold text-white flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                  submitColor === 'rose'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    : 'bg-gradient-to-br from-orange-500 to-rose-600 hover:opacity-95 shadow-orange-500/25'
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

// Match Stock Out input / label tokens (night + glass-friendly)
const InputClass =
  'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 block px-4 py-2.5 outline-none transition-all';
const LabelClass = 'block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5';

export default function Returns() {
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

  const itemNameRef = useRef(null);
  const [bulkRep, setBulkRep] = useState('');
  const [bulkDate, setBulkDate] = useState(formatDate(new Date()));
  const [modalDrafts, setModalDrafts] = useState([]);
  const [searchNameText, setSearchNameText] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [draftQty, setDraftQty] = useState('');
  const [draftStatus, setDraftStatus] = useState('سليم');
  const [searchIdx, setSearchIdx] = useState(-1);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'items')), (s) =>
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(query(collection(db, 'transactions'), orderBy('timestamp', 'desc')), (s) =>
      setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  const returnTxs = useMemo(() => transactions.filter((t) => t.type === 'مرتجع'), [transactions]);

  const itemSuggestions = useMemo(() => {
    if (!searchNameText || selectedItem) return [];
    const q = searchNameText.toLowerCase();
    return items.filter((i) => {
      const n = getItemName(i).toLowerCase();
      const c = (getCompany(i) || '').toLowerCase();
      return n.includes(q) || c.includes(q);
    });
  }, [items, searchNameText, selectedItem]);

  const dynamicCompanies = ['الكل', ...new Set(items.map((i) => getCompany(i)))].filter(Boolean);

  const hotMap = useMemo(() => {
    const map = {};
    const now = new Date();
    transactions.forEach((tx) => {
      const d = tx.date ? new Date(tx.date) : tx.timestamp?.toDate?.() || new Date();
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
          const sk = `${tx.item} ${tx.company} ${tx.rep || ''}`.toLowerCase();
          return (
            sk.includes(searchQuery.toLowerCase()) &&
            (categoryFilter === 'الكل' || tx.cat === categoryFilter) &&
            (companyFilter === 'الكل' || (tx.company || 'بدون شركة') === companyFilter) &&
            (!showHotOnly || (hotMap[tx._iid] || 0) >= 50)
          );
        }),
    [returnTxs, items, searchQuery, categoryFilter, companyFilter, showHotOnly, hotMap]
  );

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach((tx) => {
      const c = tx.cat || 'أخرى';
      if (!g[c]) g[c] = [];
      g[c].push(tx);
    });
    return g;
  }, [filtered]);

  const todayTotal = useMemo(() => {
    const t = formatDate(new Date());
    return returnTxs.reduce(
      (a, tx) => ((tx.date || formatDate(tx.timestamp?.toDate?.())) === t ? a + Number(tx.qty || 0) : a),
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
      await runTransaction(db, async (transaction) => {
        const agg = {};
        modalDrafts.filter((d) => d.status === 'سليم').forEach((d) => {
          agg[d.itemId] = (agg[d.itemId] || 0) + d.qty;
        });

        const docs = [];
        for (const [id, qty] of Object.entries(agg)) {
          const ref = doc(db, 'items', id);
          const snap = await transaction.get(ref);
          if (snap.exists()) docs.push({ ref, data: snap.data(), qty });
        }

        for (const { ref, data, qty } of docs) {
          transaction.update(ref, { stockQty: Number(data.stockQty || 0) + qty });
        }

        const damaged = {};
        modalDrafts.filter((d) => d.status === 'تالف').forEach((d) => {
          damaged[d.itemId] = (damaged[d.itemId] || 0) + d.qty;
        });
        for (const [id, qty] of Object.entries(damaged)) {
          const ref = doc(db, 'items', id);
          const snap = await transaction.get(ref);
          if (snap.exists()) {
            transaction.update(ref, { damagedQty: Number(snap.data().damagedQty || 0) + qty });
          }
        }

        modalDrafts
          .slice()
          .reverse()
          .forEach((d) => {
            transaction.set(doc(collection(db, 'transactions')), {
              type: 'مرتجع',
              item: d.item,
              itemId: d.itemId,
              company: d.company,
              qty: d.qty,
              unit: d.unit,
              cat: d.cat,
              status: d.status,
              rep: bulkRep.trim(),
              date: bulkDate,
              timestamp: serverTimestamp(),
            });
          });
      });
      toast.success(`✅ تم تأكيد استلام المرتجع وتسجيل ${modalDrafts.length} أصناف وتحديث المخزن`);
      playSuccess();
      setModalDrafts([]);
      setBulkRep('');
      setBulkDate(formatDate(new Date()));
      setIsAddModalOpen(false);
      clearRow();
    } catch {
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
      const txRef = doc(db, 'transactions', selectedTx.id);
      const mi = items.find((i) => i.id === selectedTx.itemId);
      await runTransaction(db, async (t) => {
        if (mi) {
          const ir = doc(db, 'items', mi.id);
          const id = await t.get(ir);
          if (id.exists()) {
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
            if (stockDelta !== 0) updates.stockQty = Number(id.data().stockQty || 0) + stockDelta;
            if (damagedDelta !== 0) updates.damagedQty = Number(id.data().damagedQty || 0) + damagedDelta;
            if (Object.keys(updates).length) t.update(ir, updates);
          }
        }
        t.update(txRef, {
          qty: Number(editForm.qty),
          date: editForm.date,
          rep: editForm.rep,
          status: editForm.status,
        });
      });
      toast.success('تم تعديل سند المرتجع ✅');
      playSuccess();
      setIsEditModalOpen(false);
    } catch {
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
      const txRef = doc(db, 'transactions', selectedTx.id);
      const mi = items.find((i) => i.id === selectedTx.itemId);
      await runTransaction(db, async (t) => {
        if (mi) {
          const ir = doc(db, 'items', mi.id);
          const id = await t.get(ir);
          if (id.exists()) {
            if (selectedTx.status === 'سليم')
              t.update(ir, { stockQty: Math.max(0, Number(id.data().stockQty || 0) - Number(selectedTx.qty)) });
            else
              t.update(ir, {
                damagedQty: Math.max(0, Number(id.data().damagedQty || 0) - Number(selectedTx.qty)),
              });
          }
        }
        t.delete(txRef);
      });
      toast.success('تم حذف سند المرتجع وعكس الأثر على المخزن 🗑️');
      playSuccess();
      setIsDeleteModalOpen(false);
    } catch {
      toast.error('خطأ أثناء الحذف');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    try {
      const d = new jsPDF();
      d.setFontSize(20);
      d.text('Baraka Al Thimar PRO — سجل المرتجعات', 105, 15, { align: 'center' });
      d.setFontSize(9);
      d.text(`${new Date().toLocaleDateString('ar-SA')} | ${currentUser?.email || ''}`, 195, 24, { align: 'right' });
      d.autoTable({
        startY: 30,
        head: [['#', 'التاريخ', 'المندوب', 'الصنف', 'الشركة', 'الكمية', 'الحالة']],
        body: filtered.map((tx, i) => [
          i + 1,
          tx.date || '-',
          tx.rep || '-',
          tx.item,
          tx.company || '-',
          `${tx.qty} ${tx.unit}`,
          tx.status || '-',
        ]),
        headStyles: {
          fillColor: [249, 115, 22],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        styles: { halign: 'center' },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            data.cell.styles.textColor = data.cell.raw === 'سليم' ? [5, 150, 105] : [225, 29, 72];
          }
        },
      });
      d.save(`Returns_Note_${Date.now()}.pdf`);
      toast.success('تم تصدير PDF 📄');
    } catch {
      toast.error('خطأ أثناء إنشاء PDF');
    }
    setIsExportMenuOpen(false);
  };

  const cv = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const kv = {
    hidden: { opacity: 0, y: 15, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  };

  return (
    <div className="h-full w-full flex flex-col font-['Cairo'] text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">
      {/* HEADER — Stock Out glass + orange accent */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 mb-6 shrink-0 z-20 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0">
              <RotateCcw size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">أذونات المرتجعات</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                تسجيل ومتابعة البضائع الراجعة من المناديب — نفس أسلوب صفحة الصادر
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 space-x-reverse self-end lg:self-auto relative pr-2">
            <div className="flex items-center space-x-2 space-x-reverse px-4 py-2 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl mr-2">
              <span className="text-xs font-black text-orange-500 dark:text-orange-400 tracking-wider">مرتجع اليوم:</span>
              <span className="text-lg font-black text-orange-700 dark:text-orange-300 leading-none">
                {todayTotal} <span className="text-[10px]">كرتونة</span>
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center space-x-2 space-x-reverse px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all shadow-sm"
              >
                <Download size={16} />
                <span>تصدير</span>
                <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180 text-orange-500' : ''}`} />
              </button>
              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-[120%] right-0 w-44 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl rounded-2xl overflow-hidden z-50 text-sm font-bold"
                  >
                    <button
                      onClick={exportPDF}
                      className="w-full flex items-center space-x-2 space-x-reverse px-4 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-orange-600 transition-colors"
                    >
                      <FileText size={16} />
                      <span>تحميل PDF</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />
            {!isViewer && (
              <button
                onClick={() => {
                  setModalDrafts([]);
                  setBulkRep('');
                  setBulkDate(formatDate(new Date()));
                  setIsAddModalOpen(true);
                  setTimeout(() => itemNameRef.current?.focus(), 150);
                }}
                className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-br from-orange-500 to-rose-600 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-orange-500/25"
              >
                <Plus size={18} />
                <span>إضافة مرتجع</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all shadow-inner group">
            <Search size={16} className="text-slate-400 group-focus-within:text-orange-500 transition-colors ml-3" />
            <input
              type="text"
              placeholder="البحث بالصنف أو الشركة أو المندوب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm font-bold focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-orange-500 transition-colors shadow-inner appearance-none"
          >
            <option>الكل</option>
            <option>مجمدات</option>
            <option>بلاستيك</option>
            <option>تبريد</option>
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-orange-500 transition-colors shadow-inner appearance-none"
          >
            {dynamicCompanies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => setShowHotOnly(!showHotOnly)}
            className={`w-full flex items-center justify-center space-x-2 space-x-reverse rounded-xl px-4 py-2.5 text-sm font-bold transition-all border shadow-inner ${
              showHotOnly
                ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Flame size={18} className={showHotOnly ? 'animate-pulse' : ''} />
            <span>نشاط عالي</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-10 custom-scrollbar w-full">
        {Object.keys(grouped).length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-12 text-center bg-white/40 dark:bg-slate-800/20 backdrop-blur-md rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 mt-4 min-h-[24rem] sm:h-[50vh]"
          >
            <RotateCcw size={56} className="text-slate-300 dark:text-slate-600 mb-6 animate-spin [animation-duration:4s]" />
            <h3 className="text-xl font-black mb-2">لا توجد حركات مرتجع مطابقة</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold max-w-sm">
              سجّل إذن المرتجع من خلال زر &quot;إضافة مرتجع&quot; ليظهر هنا مصنفاً.
            </p>
          </motion.div>
        ) : (
          <motion.div variants={cv} initial="hidden" animate="show" className="space-y-8">
            {Object.keys(grouped)
              .sort()
              .map((cat) => (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center space-x-3 space-x-reverse px-2 sticky top-0 z-10 bg-slate-50/90 dark:bg-[#080d17]/90 backdrop-blur-md py-2 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700/60 flex items-center justify-center">
                      {getCatIcon(cat)}
                    </div>
                    <h3 className="text-lg font-black">مرتجع {cat}</h3>
                    <div className="flex-1 h-px bg-gradient-to-l from-slate-200/0 via-slate-200 dark:via-slate-700 to-slate-200/0" />
                    <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                      {grouped[cat].length} سند
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 px-1">
                    {grouped[cat].map((tx) => (
                      <motion.div
                        key={tx.id}
                        variants={kv}
                        className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-slate-100 dark:border-slate-700/50 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 overflow-hidden"
                      >
                        <div className="flex flex-col h-full">
                          <div className="flex flex-col mb-3">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase truncate">
                                {tx.company || 'بدون شركة'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {tx.date || formatDate(tx.timestamp?.toDate?.())}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <h4 className="text-base font-black leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                                {tx.item}
                              </h4>
                              {(hotMap[tx._iid] || 0) >= 50 && (
                                <Flame
                                  size={16}
                                  className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse shrink-0"
                                />
                              )}
                            </div>
                          </div>
                          <div className="flex items-end justify-between mt-auto">
                            <div className="flex flex-col space-y-1.5">
                              {tx.rep && (
                                <div className="flex items-center text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/50 w-max px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                                  <User size={10} className="mr-1 opacity-70" />
                                  {tx.rep}
                                </div>
                              )}
                              <StatusBadge status={tx.status || 'سليم'} />
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-sm font-black bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20 w-max">
                                ↩ {tx.qty} <span className="text-[10px] mr-1">{tx.unit}</span>
                              </span>
                            </div>
                            {!isViewer && (
                              <div className="opacity-0 group-hover:opacity-100 flex space-x-1.5 space-x-reverse transition-opacity duration-300">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(tx);
                                  }}
                                  className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDelete(tx);
                                  }}
                                  className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)] transition-all"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="absolute bottom-0 right-0 w-0 h-1 bg-gradient-to-r from-orange-500 to-rose-500 group-hover:w-full transition-all duration-500 ease-out" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
          </motion.div>
        )}
      </div>

      {/* BULK MODAL */}
      <ModalWrapper
        title="استلام مرتجع — جلسة إدخال سريع"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleBulkSubmit}
        loading={loading}
        submitLabel={`تأكيد استلام المرتجع${modalDrafts.length ? ` (${modalDrafts.length})` : ''}`}
        submitColor="orange"
        maxWidth="max-w-4xl"
        disableSubmit={modalDrafts.length === 0}
      >
        <div className="flex flex-col space-y-5">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 relative z-20">
            <div>
              <label className={LabelClass}>
                اسم المندوب <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input
                  type="text"
                  className={`${InputClass} pr-10`}
                  placeholder="اسم المندوب الراجع بالبضاعة..."
                  value={bulkRep}
                  onChange={(e) => setBulkRep(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={LabelClass}>التاريخ</label>
              <input type="date" className={InputClass} value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} required />
            </div>
          </div>

          <div className="bg-orange-50/50 dark:bg-slate-800/30 border border-orange-200/60 dark:border-slate-700 rounded-[1.2rem] p-4 flex flex-col lg:flex-row gap-3 items-end overflow-visible relative z-30">
            <div className="flex-1 min-w-[180px] relative group/fi">
              <label className={LabelClass}>اسم الصنف</label>
              {selectedItem ? (
                <div className="flex items-center justify-between w-full bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-300 text-sm font-bold rounded-xl px-4 py-2.5">
                  <span className="truncate">
                    {getItemName(selectedItem)} — {getCompany(selectedItem)}
                  </span>
                  <button type="button" onClick={clearRow} className="text-orange-400 hover:text-orange-600 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <input
                    ref={itemNameRef}
                    type="text"
                    className={`${InputClass} pr-10`}
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
                      } else if (e.key === 'Enter' && searchIdx >= 0 && itemSuggestions[searchIdx]) {
                        e.preventDefault();
                        handleSelect(itemSuggestions[searchIdx]);
                      }
                    }}
                  />
                </div>
              )}
              {!selectedItem && searchNameText && itemSuggestions.length > 0 && (
                <div className="invisible group-focus-within/fi:visible absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 p-1 mt-1">
                  {itemSuggestions.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-right px-3 py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0 text-sm flex flex-col transition-colors ${
                        searchIdx === idx
                          ? 'bg-orange-50 dark:bg-orange-500/20 text-orange-700'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(s);
                      }}
                    >
                      <span className="font-black">{getItemName(s)}</span>
                      <span className="text-[10px] opacity-70 font-bold">
                        {getCompany(s)} • {getCategory(s)} • رصيد: {s.stockQty ?? '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0 flex-wrap">
              <div className="w-24">
                <label className={LabelClass}>الشركة</label>
                <input
                  type="text"
                  readOnly
                  value={selectedItem ? getCompany(selectedItem) : '---'}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-transparent text-slate-500 dark:text-slate-400 text-sm font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed"
                />
              </div>
              <div className="w-24">
                <label className={LabelClass}>القسم</label>
                <input
                  type="text"
                  readOnly
                  value={selectedItem ? getCategory(selectedItem) : '---'}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-transparent text-slate-500 dark:text-slate-400 text-sm font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed"
                />
              </div>
              <div className="w-20">
                <label className={LabelClass}>وحدة القياس</label>
                <input
                  type="text"
                  readOnly
                  value={selectedItem ? getUnit(selectedItem) : 'كرتونة'}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-transparent text-slate-500 dark:text-slate-400 text-sm font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed text-center"
                />
              </div>
            </div>

            <div className="shrink-0">
              <label className={LabelClass}>الحالة التقنية</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
                <button
                  type="button"
                  onClick={() => setDraftStatus('سليم')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-black transition-colors ${
                    draftStatus === 'سليم'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                  }`}
                >
                  <ShieldCheck size={15} /> سليم ✅
                </button>
                <button
                  type="button"
                  onClick={() => setDraftStatus('تالف')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-black transition-colors ${
                    draftStatus === 'تالف'
                      ? 'bg-rose-500 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                  }`}
                >
                  <ShieldX size={15} /> تالف ❌
                </button>
              </div>
            </div>

            <div className="w-24 shrink-0">
              <label className={LabelClass}>
                الكمية الراجعة <span className="text-orange-500">↵</span>
              </label>
              <input
                id="returns-qty-input"
                type="number"
                min="1"
                disabled={!selectedItem}
                className={`${InputClass} !border-orange-500/50 focus:!ring-orange-500/30 text-orange-700 dark:text-orange-400 font-bold`}
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
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[220px] shadow-inner bg-white/90 dark:bg-slate-900/80 backdrop-blur-md relative z-10">
            <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0 backdrop-blur-sm">
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">جدول المراجعة</h4>
              <span className="text-xs font-bold bg-white dark:bg-slate-700 px-3 py-1 rounded-full text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-slate-600 shadow-sm">
                {modalDrafts.length} صنف
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              {modalDrafts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 py-8 opacity-60">
                  <CheckCircle size={32} className="mb-2" />
                  <span className="font-bold text-sm">اختر صنفاً ثم أدخل الكمية واضغط Enter للإضافة.</span>
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 mt-2">
                  <table className="w-full min-w-[640px] text-right border-separate border-spacing-y-2">
                    <thead>
                    <tr className="text-slate-400 dark:text-slate-500 font-black text-xs text-center">
                      <th className="px-2 py-1">م</th>
                      <th className="px-3 py-1 text-right">الصنف</th>
                      <th className="px-3 py-1 text-right">الشركة</th>
                      <th className="px-2 py-1 text-orange-500">الكمية</th>
                      <th className="px-2 py-1">الحالة</th>
                      <th className="px-2 py-1 text-center">حذف</th>
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
                          className="bg-slate-50 dark:bg-slate-800/40 text-sm font-bold hover:bg-white dark:hover:bg-slate-800 transition-all"
                        >
                          <td className="px-2 py-3 text-center text-slate-400 rounded-r-xl border-y border-r border-slate-200 dark:border-slate-700">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3 text-slate-800 dark:text-slate-200 border-y border-slate-200 dark:border-slate-700">{dr.item}</td>
                          <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-xs border-y border-slate-200 dark:border-slate-700">
                            {dr.company}
                          </td>
                          <td className="px-2 py-3 text-center border-y border-slate-200 dark:border-slate-700">
                            <span className="bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-3 py-1 rounded inline-block">
                              ↩{dr.qty}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center border-y border-slate-200 dark:border-slate-700">
                            <StatusBadge status={dr.status} />
                          </td>
                          <td className="px-2 py-3 text-center rounded-l-xl border-y border-l border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => setModalDrafts((p) => p.filter((d) => d.draftId !== dr.draftId))}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors mx-auto block"
                            >
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

      <ModalWrapper title="تعديل سند المرتجع" isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEdit} loading={loading}>
        <div className="space-y-4">
          <div>
            <label className={LabelClass}>الكمية</label>
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
            <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 w-max">
              {['سليم', 'تالف'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: s })}
                  className={`flex items-center gap-1 px-4 py-2 text-sm font-black transition-colors ${
                    editForm.status === s
                      ? s === 'سليم'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-500 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {s === 'سليم' ? <ShieldCheck size={15} /> : <ShieldX size={15} />} {s}
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
