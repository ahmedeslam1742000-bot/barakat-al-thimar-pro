import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Search, RefreshCw, Image as ImageIcon, 
  Snowflake, Thermometer, Package, Timer, AlertTriangle, X, Pencil, Eye, CalendarDays, PackageX,
  BarChart3, ShieldAlert, CheckCircle2, Truck, Info, ToggleLeft, ToggleRight, ClipboardX,
  Plus, Minus, Zap, Camera, MessageCircle, Layers, TrendingDown, Ban, Heart
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

// --- Helpers ---
const getExpiryThresholds = (cat) => {
  if (cat === 'مجمدات') return { red: 30, orange: 90 };
  if (cat === 'تبريد') return { red: 2, orange: 7 };
  return { red: 30, orange: 150 };
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 28 } }
};
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [counts, setCounts] = useState({});
  const [exporting, setExporting] = useState(false);
  const [showOnlyMismatch, setShowOnlyMismatch] = useState(false);
  const tableRef = useRef(null);
  const { settings } = useSettings();
  const { isViewer } = useAuth();

  // Quick-Fix Expiry state
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [fixItem, setFixItem] = useState(null);
  const [fixBatches, setFixBatches] = useState([]);
  const [fixingId, setFixingId] = useState(null);
  const [fixNewDate, setFixNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Batch preview popover state
  const [previewItem, setPreviewItem] = useState(null);

  // Smart Batch Modal state
  const [batchModalItem, setBatchModalItem] = useState(null);

  // Evidence Camera state
  const [evidenceMap, setEvidenceMap] = useState({});
  const cameraInputRef = useRef(null);
  const [cameraTargetId, setCameraTargetId] = useState(null);

  // WhatsApp share state
  const [sharing, setSharing] = useState(false);

  // --- FIREBASE SYNC (simplified query - no compound index needed) ---
  useEffect(() => {
    const qItems = query(collection(db, 'items'));
    const unsub1 = onSnapshot(qItems, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const qTrans = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsub2 = onSnapshot(qTrans, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  // Expiry map
  const expiryMap = useMemo(() => {
    const map = {};
    transactions.forEach(tx => {
      if (tx.type !== 'وارد' || !tx.expiryDate || !tx.itemId) return;
      if (!map[tx.itemId]) map[tx.itemId] = [];
      map[tx.itemId].push({ id: tx.id, expiryDate: tx.expiryDate, inboundDate: tx.date || '', qty: tx.qty || 0, location: tx.location || '' });
    });
    Object.keys(map).forEach(id => {
      map[id].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    });
    return map;
  }, [transactions]);

  // Dead-stock detection (zero outbound in > 45 days)
  const deadStockSet = useMemo(() => {
    const hasOutbound = new Set();
    const now = new Date();
    transactions.forEach(tx => {
      if (tx.type !== 'Issue' && tx.type !== 'صادر') return;
      if (!tx.timestamp) return;
      const txDate = tx.timestamp.toDate ? tx.timestamp.toDate() : new Date();
      const diffDays = Math.ceil(Math.abs(now - txDate) / 86400000);
      if (diffDays <= 45) {
        if (tx.itemId) {
          hasOutbound.add(tx.itemId);
        } else {
          const matched = items.find(i => tx.item?.includes(i.name));
          if (matched) hasOutbound.add(matched.id);
        }
      }
    });
    return new Set(items.filter(i => (i.stockQty || 0) > 0 && !hasOutbound.has(i.id)).map(i => i.id));
  }, [transactions, items]);

  // Client-side sort (avoids compound index)
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const catOrder = (a.cat || '').localeCompare(b.cat || '', 'ar');
      if (catOrder !== 0) return catOrder;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = sortedItems.filter(i => {
      const q = searchTerm.toLowerCase();
      return (i.name || '').toLowerCase().includes(q) || 
             (i.company || '').toLowerCase().includes(q) || 
             (i.cat || '').toLowerCase().includes(q);
    });
    if (showOnlyMismatch) {
      result = result.filter(i => {
        const hasCount = counts[i.id] !== undefined && counts[i.id] !== '';
        return hasCount && Number(counts[i.id]) !== (Number(i.stockQty) || 0);
      });
    }
    return result;
  }, [sortedItems, searchTerm, showOnlyMismatch, counts]);

  // --- Summary Stats ---
  const totalItemsCount = items.length;
  const nearExpiryCount = useMemo(() => {
    return items.filter(item => {
      const batches = expiryMap[item.id];
      if (!batches?.length) return false;
      const daysLeft = Math.ceil((new Date(batches[0].expiryDate) - Date.now()) / 86400000);
      const t = getExpiryThresholds(item.cat);
      return daysLeft <= t.orange;
    }).length;
  }, [items, expiryMap]);

  const discrepancyCount = useMemo(() => {
    return Object.entries(counts).filter(([id, val]) => {
      if (val === '' || val === undefined) return false;
      const item = items.find(i => i.id === id);
      if (!item) return false;
      return Number(val) !== (Number(item.stockQty) || 0);
    }).length;
  }, [counts, items]);

  const handleCountChange = (id, val) => {
    setCounts(prev => ({ ...prev, [id]: val }));
  };

  const clearWorksheet = () => {
    if (window.confirm('هل أنت متأكد من تصفير جميع إدخالات الجرد الحالية للمقارنة؟')) {
      setCounts({});
      setEvidenceMap({});
      toast.success('تم تفريغ الجرد المؤقت');
    }
  };

  const exportReport = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    toast.info('جاري إعداد التقرير...');
    try {
      const canvas = await html2canvas(tableRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const link = document.createElement('a');
      link.download = `تقرير_جرد_مراقبة_${dateStr}.png`;
      link.href = canvas.toDataURL('image/png', 1);
      link.click();
      toast.success('تم تصدير تقرير المشاهدة كصورة بنجاح!');
    } catch (err) {
      toast.error('تعذر تصدير التقرير');
    } finally {
      setExporting(false);
    }
  };

  // Touch +/- handlers
  const incrementCount = (id, sysQty) => {
    setCounts(prev => {
      const cur = prev[id] !== undefined && prev[id] !== '' ? Number(prev[id]) : sysQty;
      return { ...prev, [id]: cur + 1 };
    });
  };
  const decrementCount = (id, sysQty) => {
    setCounts(prev => {
      const cur = prev[id] !== undefined && prev[id] !== '' ? Number(prev[id]) : sysQty;
      return { ...prev, [id]: Math.max(0, cur - 1) };
    });
  };
  // Quick Match: copy system qty to physical
  const quickMatch = (id, sysQty) => {
    setCounts(prev => ({ ...prev, [id]: sysQty }));
    toast.success('تم المطابقة السريعة ✔');
  };

  // Evidence Camera
  const handleEvidenceCapture = (e) => {
    const file = e.target.files[0];
    if (!file || !cameraTargetId) return;
    const url = URL.createObjectURL(file);
    setEvidenceMap(prev => ({ ...prev, [cameraTargetId]: url }));
    toast.success('تم رفع صورة الإثبات 📷');
    setCameraTargetId(null);
  };
  const openCamera = (id) => {
    setCameraTargetId(id);
    cameraInputRef.current?.click();
  };

  // WhatsApp Summary
  const generateWhatsAppSummary = useCallback(() => {
    setSharing(true);
    const dateStr = new Date().toLocaleDateString('ar-SA');
    const discrepancies = Object.entries(counts).filter(([id, val]) => {
      if (val === '' || val === undefined) return false;
      const item = items.find(i => i.id === id);
      if (!item) return false;
      return Number(val) !== (Number(item.stockQty) || 0);
    }).map(([id, val]) => {
      const item = items.find(i => i.id === id);
      const diff = Number(val) - (Number(item.stockQty) || 0);
      return `• ${item.name}: نظام=${item.stockQty} | فعلي=${val} | فارق=${diff > 0 ? '+' : ''}${diff}`;
    });
    const matched = Object.entries(counts).filter(([id, val]) => {
      if (val === '' || val === undefined) return false;
      const item = items.find(i => i.id === id);
      if (!item) return false;
      return Number(val) === (Number(item.stockQty) || 0);
    }).length;
    const total = Object.keys(counts).filter(id => counts[id] !== '').length;
    let msg = `📦 *تقرير جرد بركة الثمار*\n`;
    msg += `📅 التاريخ: ${dateStr}\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `✅ مجرود: ${total} صنف\n`;
    msg += `🟢 متطابق: ${matched} صنف\n`;
    msg += `🔴 فروقات: ${discrepancies.length} صنف\n`;
    if (discrepancies.length > 0) {
      msg += `\n*تفاصيل الفروقات:*\n`;
      msg += discrepancies.join('\n');
    } else {
      msg += `\n✅ لا توجد فروقات - الجرد سليم!`;
    }
    msg += `\n━━━━━━━━━━━━━━━━━━\n_نظام إدارة المستودع_`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setSharing(false);
  }, [counts, items]);

  // Quick-Fix Expiry
  const openFixModal = (item) => {
    const batches = expiryMap[item.id] || [];
    setFixItem(item);
    setFixBatches(batches);
    setFixingId(null);
    setFixNewDate('');
    setFixModalOpen(true);
  };

  const handleSaveExpiry = async () => {
    if (!fixingId || !fixNewDate) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'transactions', fixingId), { expiryDate: fixNewDate });
      toast.success('تم تحديث تاريخ الصلاحية بنجاح ✅');
      setFixingId(null);
      setFixNewDate('');
    } catch (err) {
      toast.error('حدث خطأ أثناء التحديث');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 animate-pulse">جاري تحميل بيانات الجرد...</p>
        </div>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="h-full flex flex-col font-['Cairo'] relative gap-4" dir="rtl">
      
      {/* ═══ HEADER ═══ */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-5 shrink-0 z-20 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0">
              <ClipboardList size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white">لوحة الجرد الاحترافية</h2>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">مراقبة الصلاحية • المخزون الراكد • المطابقة الفورية</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <button type="button" onClick={clearWorksheet} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-95">
              <RefreshCw size={15} /> تصفير
            </button>
            <button
              type="button"
              onClick={generateWhatsAppSummary}
              disabled={sharing || Object.keys(counts).length === 0}
              className="px-4 py-2.5 rounded-xl font-black text-sm text-white bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/25 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <MessageCircle size={15} /> واتساب
            </button>
            <button type="button" onClick={exportReport} disabled={exporting} className="px-5 py-2.5 rounded-xl font-black text-sm text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
              <ImageIcon size={16} /> تصدير
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SUMMARY CARDS ═══ */}
      <motion.div 
        variants={containerVariants} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0"
      >
        {/* Total Items */}
        <motion.div variants={cardVariants} className="relative overflow-hidden bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-wide mb-1">إجمالي الأصناف</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{totalItemsCount}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">مسجّل في النظام</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <BarChart3 size={24} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 w-full opacity-40 group-hover:opacity-80 transition-opacity" />
        </motion.div>

        {/* Near Expiry */}
        <motion.div variants={cardVariants} className="relative overflow-hidden bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-wide mb-1">قريب الانتهاء</p>
              <p className={`text-3xl font-black ${nearExpiryCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>{nearExpiryCount}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">صنف يحتاج متابعة</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${nearExpiryCount > 0 ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
              <ShieldAlert size={24} />
            </div>
          </div>
          <div className={`absolute bottom-0 left-0 h-1 w-full opacity-40 group-hover:opacity-80 transition-opacity ${nearExpiryCount > 0 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
        </motion.div>

        {/* Discrepancies */}
        <motion.div variants={cardVariants} className="relative overflow-hidden bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-wide mb-1">فروقات مكتشفة</p>
              <p className={`text-3xl font-black ${discrepancyCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>{discrepancyCount}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">صنف غير مطابق</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${discrepancyCount > 0 ? 'bg-gradient-to-br from-rose-500/10 to-pink-500/10 dark:from-rose-500/20 dark:to-pink-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className={`absolute bottom-0 left-0 h-1 w-full opacity-40 group-hover:opacity-80 transition-opacity ${discrepancyCount > 0 ? 'bg-gradient-to-r from-rose-500 to-pink-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
        </motion.div>
      </motion.div>

      {/* ═══ SEARCH + FILTER BAR ═══ */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-2xl p-4 shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="ابحث عن صنف، شركة، أو قسم..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm rounded-xl pr-10 pl-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
        {/* Mismatch toggle */}
        <button 
          onClick={() => setShowOnlyMismatch(prev => !prev)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all shrink-0 hover:scale-[1.02] active:scale-95 ${
            showOnlyMismatch 
              ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-sm' 
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          {showOnlyMismatch ? <ToggleRight size={18} className="text-rose-500" /> : <ToggleLeft size={18} />}
          الفروقات فقط
          {discrepancyCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{discrepancyCount}</span>
          )}
        </button>
      </div>

      {/* ═══ TABLE AREA ═══ */}
      <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar min-h-0 bg-white dark:bg-slate-800/90 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm relative z-10" ref={tableRef}>
        
        {/* Print Header */}
        <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-700/50">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-400">ورقة عمل جرد ومطابقة</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{currentDate}</p>
            </div>
            <div className="text-left font-black text-slate-400 dark:text-slate-500 text-[10px]">
              نظام بركة الثمار<br/>
              تقرير مقارنة أمان
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          /* ═══ EMPTY STATE ═══ */
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700/50 flex items-center justify-center mb-6 shadow-inner">
              <ClipboardX size={44} className="text-slate-300 dark:text-slate-600" />
            </div>
            <h4 className="text-lg font-black text-slate-500 dark:text-slate-400 mb-2">
              {showOnlyMismatch ? 'لا توجد فروقات حالياً' : 'لا توجد أصناف مطابقة للبحث'}
            </h4>
            <p className="text-sm font-bold text-slate-400 dark:text-slate-500 text-center max-w-sm leading-relaxed">
              {showOnlyMismatch 
                ? 'جميع الأصناف المجرودة متطابقة مع الرصيد. أو لم تدخل جرداً بعد. ابدأ بإدخال الكميات الفعلية.' 
                : 'حاول تغيير كلمة البحث أو مصطلح التصفية للعثور على الأصناف المطلوبة.'}
            </p>
            {showOnlyMismatch && (
              <button onClick={() => setShowOnlyMismatch(false)} className="mt-5 px-5 py-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-all">
                عرض جميع الأصناف
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-black border-y border-slate-200/80 dark:border-slate-700/80 text-[13px]">
                <th className="px-3 py-3.5 w-10 text-center">م</th>
                <th className="px-3 py-3.5">الصنف</th>
                <th className="px-3 py-3.5 w-24 text-center">التخزين</th>
                <th className="px-3 py-3.5 w-32 text-center">الحالة</th>
                <th className="px-3 py-3.5 w-24 text-center">الدفعات</th>
                <th className="px-3 py-3.5 w-28 text-center">رصيد النظام</th>
                <th className="px-3 py-3.5 w-44 text-center text-emerald-600 dark:text-emerald-400">الجرد الفعلي</th>
                <th className="px-3 py-3.5 w-24 text-center">الفارق</th>
                <th className="px-3 py-3.5 w-20 text-center">إثبات</th>
                {!isViewer && <th className="px-3 py-3.5 w-14 text-center">تصحيح</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => {
                const sysQty = Number(item.stockQty) || 0;
                const hasCount = counts[item.id] !== undefined && counts[item.id] !== '';
                const physQty = hasCount ? Number(counts[item.id]) : null;
                const diff = hasCount ? physQty - sysQty : null;
                
                // Expiry logic
                const batches = expiryMap[item.id];
                const earliestExpiry = batches?.[0]?.expiryDate;
                const daysLeft = earliestExpiry ? Math.ceil((new Date(earliestExpiry) - Date.now()) / 86400000) : null;
                const thresholds = getExpiryThresholds(item.cat);
                const isExpired = daysLeft !== null && daysLeft <= 0;
                const isUrgent = daysLeft !== null && daysLeft > 0 && daysLeft <= thresholds.red;
                const isWarning = daysLeft !== null && daysLeft > thresholds.red && daysLeft <= thresholds.orange;
                const isDead = deadStockSet.has(item.id);
                
                // Conditional row formatting
                let rowBg = '';
                let borderAccent = '';
                if (hasCount) {
                  if (diff === 0) {
                    rowBg = 'bg-emerald-50/60 dark:bg-emerald-500/[0.06]';
                    borderAccent = 'border-r-4 border-r-emerald-500';
                  } else {
                    rowBg = 'bg-rose-50/60 dark:bg-rose-500/[0.06]';
                    borderAccent = 'border-r-4 border-r-rose-500';
                  }
                }

                return (
                  <tr key={item.id} className={`border-b border-slate-100/80 dark:border-slate-700/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-all ${rowBg} ${borderAccent}`}>
                    {/* # */}
                    <td className="px-3 py-3.5 text-center text-xs font-bold text-slate-400">{index + 1}</td>
                    
                    {/* Item Info */}
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[13px] text-slate-800 dark:text-white leading-snug">{item.name}</span>
                        {isDead && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-md font-black bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300/50 dark:border-slate-600 shrink-0" title="لا يوجد صادر خلال 30 يوم">
                            <PackageX size={8} /> راكد
                          </span>
                        )}
                        {hasCount && diff === 0 && (
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{item.company || 'بدون'} • {item.cat} • {item.unit}</p>
                    </td>
                    
                    {/* Storage Type Badge */}
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border ${
                        item.cat === 'مجمدات' 
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                          : item.cat === 'تبريد' 
                          ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30'
                          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                      }`}>
                        {item.cat === 'مجمدات' ? <Snowflake size={10} /> : item.cat === 'تبريد' ? <Thermometer size={10} /> : <Package size={10} />}
                        {item.cat === 'مجمدات' ? 'مجمد' : item.cat === 'تبريد' ? 'مبرد' : 'عادي'}
                      </span>
                    </td>
                    
                    {/* Enhanced Status Badge */}
                    <td className="px-3 py-3.5 text-center">
                      {(() => {
                        // Understocked: sysQty > 0 but very low (< 5 units)
                        const isUnderstocked = sysQty > 0 && sysQty < 5 && !isExpired;
                        if (isExpired) return (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black border bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 expiry-blink">
                            <Ban size={9} className="animate-pulse" /> منتهي الصلاحية
                          </span>
                        );
                        if (isUrgent) return (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black border bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/25 expiry-blink">
                            <Timer size={9} className="animate-pulse" /> تحذير ({daysLeft}ي)
                          </span>
                        );
                        if (isWarning) return (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black border bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/25">
                            <AlertTriangle size={9} /> صلاحية قريبة
                          </span>
                        );
                        if (isUnderstocked) return (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black border bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/25">
                            <TrendingDown size={9} /> مخزون منخفض
                          </span>
                        );
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25">
                            <Heart size={9} /> سليم
                          </span>
                        );
                      })()}
                    </td>

                    {/* Smart Batch Modal Trigger */}
                    <td className="px-3 py-3.5 text-center">
                      {batches?.length > 0 ? (
                        <button
                          onClick={() => setBatchModalItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:scale-105 active:scale-95 transition-all shadow-sm"
                          title="عرض تفاصيل الدفعات"
                        >
                          <Layers size={12} />
                          {batches.length}
                        </button>
                      ) : <span className="text-[10px] text-slate-400">—</span>}
                    </td>
                    
                    {/* System Qty */}
                    <td className="px-3 py-3.5 text-center">
                      <span className="inline-flex items-center px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[13px] rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-inner">
                        {sysQty}
                      </span>
                    </td>
                    
                    {/* Physical Count Input with Touch Controls */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => decrementCount(item.id, sysQty)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center border border-slate-200 dark:border-slate-600 transition-all active:scale-90 shrink-0"
                        ><Minus size={12} /></button>
                        <input 
                          type="number"
                          placeholder="؟"
                          value={counts[item.id] !== undefined ? counts[item.id] : ''}
                          onChange={e => handleCountChange(item.id, e.target.value)}
                          className={`w-16 text-[13px] text-center font-black rounded-xl py-1.5 outline-none transition-all placeholder:opacity-30 ${
                            hasCount && diff === 0 
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-400 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
                              : hasCount && diff !== 0
                              ? 'bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-400 dark:border-rose-500/40 text-rose-700 dark:text-rose-400 focus:ring-2 focus:ring-rose-500/20'
                              : 'bg-white dark:bg-slate-900 border-2 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                          }`}
                        />
                        <button
                          onClick={() => incrementCount(item.id, sysQty)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center border border-slate-200 dark:border-slate-600 transition-all active:scale-90 shrink-0"
                        ><Plus size={12} /></button>
                        <button
                          onClick={() => quickMatch(item.id, sysQty)}
                          title="مطابقة سريعة مع النظام"
                          className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30 transition-all active:scale-90 shrink-0"
                        ><Zap size={11} /></button>
                      </div>
                    </td>
                    
                    {/* Diff */}
                    <td className="px-3 py-3.5 text-center">
                      {hasCount ? (
                        <span className={`inline-flex items-center gap-1 text-[12px] font-black px-2.5 py-1 rounded-lg ${
                          diff === 0 
                            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                        }`} dir="ltr">
                          {diff === 0 ? <><CheckCircle2 size={11} /> متطابق</> : diff > 0 ? `+${diff}` : `${diff}`}
                        </span>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    
                    {/* Evidence Camera (only on discrepancy) */}
                    <td className="px-3 py-3.5 text-center">
                      {hasCount && diff !== 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => openCamera(item.id)}
                            title="رفع صورة إثبات الفرق"
                            className={`p-1.5 rounded-lg border transition-all mx-auto block ${
                              evidenceMap[item.id]
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-500 dark:text-rose-400 animate-pulse hover:animate-none hover:bg-rose-100'
                            }`}
                          >
                            <Camera size={13} />
                          </button>
                          {evidenceMap[item.id] && (
                            <img src={evidenceMap[item.id]} alt="إثبات" className="w-8 h-8 rounded-md object-cover border-2 border-emerald-400 shadow cursor-pointer" onClick={() => window.open(evidenceMap[item.id], '_blank')} />
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Quick-Fix */}
                    {!isViewer && (
                      <td className="px-3 py-3.5 text-center">
                        {batches?.length > 0 && (
                          <button 
                            onClick={() => openFixModal(item)}
                            title="تصحيح صلاحية"
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all mx-auto block"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        
        {/* Print Footer */}
        {filteredItems.length > 0 && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-700/50 text-xs font-bold text-slate-400 text-center">
            هذا التقرير مخصص للمطابقة الجردية الداخلية ولا يمثل إثباتًا لتسوية الأرصدة في النظام المالي.
          </div>
        )}
      </div>

      {/* ═══ QUICK-FIX EXPIRY MODAL ═══ */}
      <AnimatePresence>
        {fixModalOpen && fixItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
            dir="rtl" onClick={() => setFixModalOpen(false)}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-l from-amber-50/50 to-white dark:from-amber-900/10 dark:to-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Pencil size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white">تصحيح تاريخ الصلاحية</h3>
                      <p className="text-xs font-bold text-slate-400">{fixItem.name} • {fixItem.company}</p>
                    </div>
                  </div>
                  <button onClick={() => setFixModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Batches */}
              <div className="p-5 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                {fixBatches.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 font-bold py-4">لا توجد دفعات صلاحية مسجلة</p>
                ) : fixBatches.map((b, idx) => {
                  const days = Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000);
                  const thresholds = getExpiryThresholds(fixItem.cat);
                  const expired = days <= 0;
                  const urgent = days > 0 && days <= thresholds.red;
                  const warn = days > thresholds.red && days <= thresholds.orange;
                  const isEditing = fixingId === b.id;

                  return (
                    <div key={b.id} className={`p-3.5 rounded-xl border-2 transition-all ${
                      isEditing ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/50 dark:bg-amber-500/5 shadow-lg'
                      : expired || urgent ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5'
                      : warn ? 'border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-black ${
                            expired ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                            : urgent ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                            : warn ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                          }`}>
                            <Timer size={9} />
                            {expired ? '⛔ منتهي' : `${days} يوم`}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">الكمية: {b.qty}</span>
                          {b.inboundDate && <span className="text-[10px] font-bold text-slate-400">وارد: {b.inboundDate}</span>}
                        </div>
                        {!isEditing && (
                          <button 
                            onClick={() => { setFixingId(b.id); setFixNewDate(b.expiryDate); }}
                            className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-1 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                          >
                            <Pencil size={10} /> تعديل
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-amber-700 dark:text-amber-400 mb-1 block">التاريخ الجديد:</label>
                            <input 
                              type="date" 
                              className="w-full bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-500/40 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                              value={fixNewDate}
                              onChange={e => setFixNewDate(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-1.5 pt-4">
                            <button 
                              onClick={handleSaveExpiry} 
                              disabled={saving || !fixNewDate}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-sm disabled:opacity-50 transition-all"
                            >
                              {saving ? '...' : '✓ حفظ'}
                            </button>
                            <button 
                              onClick={() => { setFixingId(null); setFixNewDate(''); }}
                              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors hover:bg-slate-300"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <CalendarDays size={11} className="opacity-50" />
                          <span>الصلاحية الحالية: <span className="font-black">{b.expiryDate}</span></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                <p className="text-[10px] text-slate-400 font-bold">✏️ اختر الدفعة المراد تصحيح صلاحيتها ثم احفظ التعديل مباشرةً</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleEvidenceCapture}
      />

      {/* ═══ SMART BATCH MODAL ═══ */}
      <AnimatePresence>
        {batchModalItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm"
            dir="rtl" onClick={() => setBatchModalItem(null)}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-l from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Layers size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white">تفاصيل الدفعات الواردة</h3>
                      <p className="text-xs font-bold text-slate-400">{batchModalItem.name} • {batchModalItem.company}</p>
                    </div>
                  </div>
                  <button onClick={() => setBatchModalItem(null)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Batch Table */}
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {(expiryMap[batchModalItem.id] || []).length === 0 ? (
                  <p className="text-center text-sm text-slate-400 font-bold py-6">لا توجد دفعات مسجلة</p>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="grid grid-cols-4 gap-2 px-2 pb-1">
                      {['تاريخ الوارد', 'الصلاحية', 'الكمية', 'الحالة'].map(h => (
                        <span key={h} className="text-[10px] font-black text-slate-400 dark:text-slate-500 text-center">{h}</span>
                      ))}
                    </div>
                    {(expiryMap[batchModalItem.id] || []).map((b, idx) => {
                      const d = Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000);
                      const thresholds = getExpiryThresholds(batchModalItem.cat);
                      const bExpired = d <= 0;
                      const bUrgent = d > 0 && d <= thresholds.red;
                      const bWarn = d > thresholds.red && d <= thresholds.orange;
                      return (
                        <div key={idx} className={`grid grid-cols-4 gap-2 items-center px-3 py-2.5 rounded-xl border-2 transition-all ${
                          bExpired ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5'
                          : bUrgent ? 'border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5'
                          : bWarn ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5'
                          : 'border-emerald-100 dark:border-emerald-500/10 bg-emerald-50/30 dark:bg-emerald-500/5'
                        }`}>
                          <div className="flex items-center gap-1 justify-center">
                            <Truck size={10} className="text-slate-400" />
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{b.inboundDate || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1 justify-center">
                            <CalendarDays size={10} className="text-slate-400" />
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{b.expiryDate}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">{b.qty}</span>
                          </div>
                          <div className="text-center">
                            <span className={`inline-flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded-full font-black ${
                              bExpired ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                              : bUrgent ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                              : bWarn ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                            }`}>
                              {bExpired ? '⛔ منتهي' : `${d}ي`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer summary */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">
                    إجمالي الدفعات: <span className="text-slate-700 dark:text-slate-200 font-black">{(expiryMap[batchModalItem.id] || []).length}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    إجمالي الكمية: <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      {(expiryMap[batchModalItem.id] || []).reduce((s, b) => s + (b.qty || 0), 0)}
                    </span>
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
