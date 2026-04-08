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
      <div className="h-full flex items-center justify-center font-readex">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-400 animate-pulse">جاري تحميل بيانات الجرد...</p>
        </div>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6 animate-in fade-in duration-500 font-readex" dir="rtl">
      
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 shrink-0">
            <ClipboardList size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">لوحة الجرد الاحترافية</h1>
            <p className="text-slate-400 mt-1 font-bold text-sm">مراقبة الصلاحية • المخزون الراكد • المطابقة الفورية</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={clearWorksheet} 
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-sm text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all"
          >
            <RefreshCw size={18} /> تصفير الجرد
          </button>
          <button
            type="button"
            onClick={generateWhatsAppSummary}
            disabled={sharing || Object.keys(counts).length === 0}
            className="px-6 py-3 rounded-2xl font-black text-sm text-white bg-[#25D366] hover:bg-[#20ba59] shadow-xl shadow-green-500/20 transition-all flex items-center gap-2.5 disabled:opacity-40"
          >
            <MessageCircle size={18} /> مشاركة واتساب
          </button>
          <button 
            type="button" 
            onClick={exportReport} 
            disabled={exporting} 
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-sm text-white bg-gradient-to-br from-emerald-600 to-teal-700 shadow-xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <ImageIcon size={18} /> تصدير التقرير
          </button>
        </div>
      </div>

      {/* ═══ SUMMARY CARDS ═══ */}
      <motion.div 
        variants={containerVariants} initial="hidden" animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {/* Total Items */}
        <motion.div variants={cardVariants} className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">إجمالي الأصناف</p>
            <p className="text-3xl font-black text-slate-800 tracking-tight group-hover:translate-x-1 transition-transform duration-500">{totalItemsCount}</p>
            <div className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> مسجّل في النظام
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:scale-110 transition-all duration-500">
            <BarChart3 size={28} />
          </div>
        </motion.div>

        {/* Near Expiry */}
        <motion.div variants={cardVariants} className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">قريب الانتهاء</p>
            <p className={`text-3xl font-black tracking-tight group-hover:translate-x-1 transition-transform duration-500 ${nearExpiryCount > 0 ? 'text-orange-500' : 'text-slate-800'}`}>{nearExpiryCount}</p>
            <div className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${nearExpiryCount > 0 ? 'bg-orange-500' : 'bg-slate-300'}`} /> يحتاج متابعة فورية
            </div>
          </div>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-500 ${nearExpiryCount > 0 ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-400'}`}>
            <ShieldAlert size={28} />
          </div>
        </motion.div>

        {/* Discrepancies */}
        <motion.div variants={cardVariants} className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center justify-between shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">فروقات مكتشفة</p>
            <p className={`text-3xl font-black tracking-tight group-hover:translate-x-1 transition-transform duration-500 ${discrepancyCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{discrepancyCount}</p>
            <div className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${discrepancyCount > 0 ? 'bg-rose-600' : 'bg-slate-300'}`} /> صنف غير مطابق
            </div>
          </div>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-500 ${discrepancyCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle size={28} />
          </div>
        </motion.div>
      </motion.div>

      {/* ═══ SEARCH + FILTER BAR ═══ */}
      <div className="bg-white border border-slate-100 p-5 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
        <div className="relative flex-1 group">
          <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
          <input 
            type="text" 
            placeholder="ابحث عن صنف، شركة، أو قسم..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 font-black text-base rounded-2xl pr-12 pl-4 py-3.5 outline-none focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-inner"
          />
        </div>
        {/* Mismatch toggle */}
        <button 
          onClick={() => setShowOnlyMismatch(prev => !prev)}
          className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-sm border transition-all shrink-0 shadow-sm ${
            showOnlyMismatch 
              ? 'bg-rose-50 border-rose-200 text-rose-600' 
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {showOnlyMismatch ? <ToggleRight size={22} className="text-rose-600" /> : <ToggleLeft size={22} />}
          الفروقات المكتشفة فقط
          {discrepancyCount > 0 && (
            <span className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full min-w-[24px] text-center shadow-lg shadow-rose-500/20">{discrepancyCount}</span>
          )}
        </button>
      </div>

      {/* ═══ TABLE AREA ═══ */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden flex flex-col shadow-sm" ref={tableRef}>
        
        {/* Print Header */}
        <div className="p-8 border-b border-slate-50 flex justify-between items-end bg-slate-50/30">
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">ورقة عمل جرد ومطابقة المخزون</h3>
            <p className="text-sm font-bold text-slate-400 mt-1.5">{currentDate}</p>
          </div>
          <div className="text-left font-black text-slate-300 text-[10px] uppercase tracking-widest leading-relaxed">
            بركة الثمار للتجارة والمقاولات<br/>
            نظام إدارة المستودعات الذكي
          </div>
        </div>

        {filteredItems.length === 0 ? (
          /* ═══ EMPTY STATE ═══ */
          <div className="flex flex-col items-center justify-center py-28 px-6 text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
              <ClipboardX size={48} className="text-slate-200" />
            </div>
            <h4 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">
              {showOnlyMismatch ? 'لا توجد فروقات حالياً' : 'لا توجد نتائج للبحث'}
            </h4>
            <p className="text-slate-400 text-center max-w-sm font-bold text-sm leading-relaxed">
              {showOnlyMismatch 
                ? 'جميع الأصناف المجرودة متطابقة مع أرصدة النظام. ابدأ بإدخال الكميات الفعلية للمقارنة.' 
                : 'لم نجد أي صنف يطابق معايير البحث الحالية. حاول استخدام كلمات بحث مختلفة.'}
            </p>
            {showOnlyMismatch && (
              <button onClick={() => setShowOnlyMismatch(false)} className="mt-8 px-8 py-3.5 rounded-2xl font-black text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all">
                عرض جميع الأصناف
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-separate border-spacing-0 whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/95 backdrop-blur-md text-slate-500 font-black uppercase tracking-wider text-[11px] border-b border-slate-100">
                  <th className="px-6 py-5 w-12 text-center rounded-tr-[2rem]">#</th>
                  <th className="px-6 py-5">الصنف والمواصفات</th>
                  <th className="px-6 py-5 text-center">نوع التخزين</th>
                  <th className="px-6 py-5 text-center">حالة الصنف</th>
                  <th className="px-6 py-5 text-center">دفعات الوارد</th>
                  <th className="px-6 py-5 text-center">رصيد النظام</th>
                  <th className="px-6 py-5 text-center">الكمية الفعلية</th>
                  <th className="px-6 py-5 text-center">فارق الجرد</th>
                  <th className="px-6 py-5 text-center">إثبات</th>
                  {!isViewer && <th className="px-6 py-5 text-center rounded-tl-[2rem]">إجراء</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
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
                  
                  // Row formatting
                  const isMatched = hasCount && diff === 0;
                  const hasDiff = hasCount && diff !== 0;

                  return (
                    <tr key={item.id} className={`group transition-all duration-300 ${
                      isMatched ? 'bg-emerald-50/30' : 
                      hasDiff ? 'bg-rose-50/30' : 
                      'hover:bg-slate-50/80'
                    }`}>
                      <td className="px-6 py-5 text-center text-[10px] font-black text-slate-300 group-hover:text-slate-400 transition-colors">{index + 1}</td>
                      
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-slate-800 group-hover:text-emerald-600 transition-colors text-base tracking-tight">{item.name}</span>
                            {isDead && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-100 text-slate-400 border border-slate-200 uppercase tracking-widest">
                                راكد
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-70 group-hover:opacity-100 transition-opacity">{item.company || 'بدون شركة'} • {item.cat} • {item.unit}</span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black border shadow-sm ${
                          item.cat === 'مجمدات' 
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : item.cat === 'تبريد' 
                            ? 'bg-cyan-50 text-cyan-600 border-cyan-100'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {item.cat === 'مجمدات' ? <Snowflake size={12} /> : item.cat === 'تبريد' ? <Thermometer size={12} /> : <Package size={12} />}
                          {item.cat === 'مجمدات' ? 'مجمد' : item.cat === 'تبريد' ? 'مبرد' : 'عادي'}
                        </span>
                      </td>
                      
                      <td className="px-6 py-5 text-center">
                        {(() => {
                          const isUnderstocked = sysQty > 0 && sysQty < 5 && !isExpired;
                          if (isExpired) return (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200 shadow-sm animate-pulse">
                              <Ban size={12} /> منتهي
                            </span>
                          );
                          if (isUrgent) return (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100 shadow-sm">
                              <Timer size={12} /> حرج ({daysLeft}ي)
                            </span>
                          );
                          if (isWarning) return (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black bg-orange-50 text-orange-600 border border-orange-100 shadow-sm">
                              <AlertTriangle size={12} /> قريب ({daysLeft}ي)
                            </span>
                          );
                          if (isUnderstocked) return (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
                              <TrendingDown size={12} /> منخفض
                            </span>
                          );
                          return (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                              <Heart size={12} /> سليم
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {batches?.length > 0 ? (
                          <button
                            onClick={() => setBatchModalItem(item)}
                            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl font-black text-[11px] bg-slate-50 text-slate-600 hover:bg-white hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-500/10 border border-slate-200 transition-all"
                          >
                            <Layers size={14} className="opacity-70" />
                            {batches.length} دفعات
                          </button>
                        ) : <span className="text-slate-300 font-bold">—</span>}
                      </td>
                      
                      <td className="px-6 py-5 text-center">
                        <span className="font-black text-slate-800 text-base tracking-tight">{sysQty}</span>
                      </td>
                      
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={() => decrementCount(item.id, sysQty)}
                            className="w-9 h-9 rounded-xl bg-white text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 shadow-sm transition-all active:scale-90 flex items-center justify-center"
                          ><Minus size={16} /></button>
                          <input 
                            type="number"
                            placeholder="؟"
                            value={counts[item.id] !== undefined ? counts[item.id] : ''}
                            onChange={e => handleCountChange(item.id, e.target.value)}
                            className={`w-24 text-center font-black rounded-xl py-2.5 outline-none transition-all border-2 text-base ${
                              isMatched 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : hasDiff
                                ? 'bg-rose-50 border-rose-300 text-rose-700'
                                : 'bg-slate-100/50 border-slate-200 text-slate-800 focus:bg-white focus:border-emerald-500'
                            }`}
                          />
                          <button
                            onClick={() => incrementCount(item.id, sysQty)}
                            className="w-9 h-9 rounded-xl bg-white text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 shadow-sm transition-all active:scale-90 flex items-center justify-center"
                          ><Plus size={16} /></button>
                          <button
                            onClick={() => quickMatch(item.id, sysQty)}
                            className="w-9 h-9 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:scale-110 transition-all active:scale-90 flex items-center justify-center mr-1"
                            title="مطابقة فورية"
                          ><Zap size={16} /></button>
                        </div>
                      </td>
                      
                      <td className="px-6 py-5 text-center">
                        {hasCount ? (
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black shadow-sm ${
                            isMatched 
                              ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                              : 'bg-rose-50 text-rose-600 border border-rose-200'
                          }`} dir="ltr">
                            {isMatched ? <CheckCircle2 size={16} /> : (diff > 0 ? `+${diff}` : diff)}
                            {isMatched && 'متطابق'}
                          </div>
                        ) : <span className="text-slate-300 font-bold">—</span>}
                      </td>
                      
                      <td className="px-6 py-5 text-center">
                        {hasDiff ? (
                          <div className="flex flex-col items-center gap-2">
                            <button
                              onClick={() => openCamera(item.id)}
                              className={`p-2.5 rounded-xl border transition-all shadow-sm ${
                                evidenceMap[item.id]
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : 'bg-rose-50 border-rose-100 text-rose-500 animate-pulse'
                              }`}
                            >
                              <Camera size={18} />
                            </button>
                            {evidenceMap[item.id] && (
                              <img 
                                src={evidenceMap[item.id]} 
                                alt="إثبات" 
                                className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform z-10" 
                                onClick={() => window.open(evidenceMap[item.id], '_blank')} 
                              />
                            )}
                          </div>
                        ) : <span className="text-slate-300 font-bold">—</span>}
                      </td>

                      {!isViewer && (
                        <td className="px-6 py-5 text-center">
                          {batches?.length > 0 && (
                            <button 
                              onClick={() => openFixModal(item)}
                              className="p-2.5 rounded-xl bg-white text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 shadow-sm transition-all"
                            >
                              <Pencil size={16} />
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
          <div className="p-8 border-t border-slate-50 text-[10px] font-black text-slate-300 text-center bg-slate-50/20 uppercase tracking-[0.2em]">
            تقرير جرد ومطابقة داخلي • يتم استخدامه لأغراض التدقيق والمراقبة • بركة الثمار للتجارة والمقاولات
          </div>
        )}
      </div>

      {/* ═══ QUICK-FIX EXPIRY MODAL ═══ */}
      <AnimatePresence>
        {fixModalOpen && fixItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setFixModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
              dir="rtl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/10">
                    <Pencil size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">تصحيح تاريخ الصلاحية</h3>
                    <p className="text-sm font-bold text-slate-400 mt-1">{fixItem.name}</p>
                  </div>
                </div>
                <button onClick={() => setFixModalOpen(false)} className="p-2.5 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} className="stroke-[3]" />
                </button>
              </div>

              <div className="p-8 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {fixBatches.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 font-black">لا توجد دفعات صلاحية مسجلة</p>
                ) : fixBatches.map((b) => {
                  const days = Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000);
                  const thresholds = getExpiryThresholds(fixItem.cat);
                  const expired = days <= 0;
                  const urgent = days > 0 && days <= thresholds.red;
                  const isEditing = fixingId === b.id;

                  return (
                    <div key={b.id} className={`p-6 rounded-[2rem] border-2 transition-all duration-300 ${
                      isEditing ? 'border-emerald-500 bg-emerald-50/50 shadow-xl shadow-emerald-500/10' : 
                      'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1.5 rounded-full text-[10px] font-black border shadow-sm ${
                            expired ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                            urgent ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                            'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>
                            {expired ? 'منتهي' : `${days} يوم`}
                          </span>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">الكمية: {b.qty}</span>
                        </div>
                        {!isEditing && (
                          <button 
                            onClick={() => { setFixingId(b.id); setFixNewDate(b.expiryDate); }}
                            className="text-xs font-black text-emerald-600 hover:underline underline-offset-4"
                          >
                            تعديل التاريخ
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-black text-slate-700 mb-2 mr-1 block">التاريخ الجديد:</label>
                            <input 
                              type="date" 
                              className="w-full bg-white border-2 border-emerald-500/20 text-slate-800 text-base font-black rounded-2xl px-5 py-3.5 outline-none focus:border-emerald-500 transition-all shadow-inner"
                              value={fixNewDate}
                              onChange={e => setFixNewDate(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-3 justify-end">
                            <button 
                              onClick={() => { setFixingId(null); setFixNewDate(''); }}
                              className="px-6 py-3 text-xs font-black text-slate-500 hover:bg-white rounded-xl transition-all"
                            >
                              إلغاء
                            </button>
                            <button 
                              onClick={handleSaveExpiry} 
                              disabled={saving || !fixNewDate}
                              className="px-8 py-3 rounded-xl font-black text-white text-xs bg-emerald-600 shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                              {saving ? 'جاري الحفظ...' : 'حفظ التعديل'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-sm font-black text-slate-600 tracking-tight">
                          <CalendarDays size={18} className="text-slate-300" />
                          <span>الصلاحية الحالية: <span className="font-black text-slate-800">{b.expiryDate}</span></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ SMART BATCH MODAL ═══ */}
      <AnimatePresence>
        {batchModalItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setBatchModalItem(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
              dir="rtl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <Layers size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">تفاصيل الدفعات الواردة</h3>
                    <p className="text-sm font-bold text-slate-400 mt-1">{batchModalItem.name}</p>
                  </div>
                </div>
                <button onClick={() => setBatchModalItem(null)} className="p-2.5 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} className="stroke-[3]" />
                </button>
              </div>

              <div className="p-8">
                <div className="overflow-hidden rounded-[2rem] border border-slate-100">
                  <table className="w-full text-right border-separate border-spacing-0">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">تاريخ التوريد</th>
                        <th className="px-6 py-4">تاريخ الصلاحية</th>
                        <th className="px-6 py-4 text-center">الكمية</th>
                        <th className="px-6 py-4 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(expiryMap[batchModalItem.id] || []).map((b, idx) => {
                        const d = Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000);
                        const expired = d <= 0;
                        const urgent = d > 0 && d <= 30;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                            <td className="px-6 py-4 text-sm font-black text-slate-600 group-hover:text-slate-800 transition-colors">
                              <div className="flex items-center gap-2.5">
                                <Truck size={16} className="text-slate-300" />
                                {b.inboundDate || '—'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-black text-slate-800 tracking-tight">
                              <div className="flex items-center gap-2.5">
                                <CalendarDays size={16} className="text-slate-300" />
                                {b.expiryDate}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-black text-slate-800 text-base">{b.qty}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm ${
                                expired ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                                urgent ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                                'bg-emerald-50 text-emerald-600 border-emerald-200'
                              }`}>
                                {expired ? 'منتهي' : `${d}ي`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي الدفعات المسجلة: <span className="text-slate-800 font-black text-xs ml-1">{(expiryMap[batchModalItem.id] || []).length}</span></span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الرصيد الكلي: <span className="text-emerald-600 font-black text-xs ml-1">{(expiryMap[batchModalItem.id] || []).reduce((s, b) => s + (b.qty || 0), 0)}</span></span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
