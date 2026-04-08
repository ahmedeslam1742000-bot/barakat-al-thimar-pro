import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, Flame, Thermometer, Eye, Timer,
  CalendarDays, Truck, PackageX
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// --- HELPER: Normalize Text Logic ---
const normalizeText = (text) => {
  if (!text) return '';
  return text.toString()
    .replace(/[\u064B-\u065F]/g, '') 
    .replace(/[أإآ]/g, 'ا') 
    .replace(/ة/g, 'ه') 
    .replace(/ى/g, 'ي') 
    .replace(/\s+/g, ' ') 
    .trim();
};

const categoryIcons = {
  'مجمدات': <Snowflake size={18} className="text-primary dark:text-accent-light" />,
  'بلاستيك': <Archive size={18} className="text-status-warning" />,
  'تبريد': <Thermometer size={18} className="text-primary dark:text-accent-light" />
};

const getCatIcon = (catName) => {
  return categoryIcons[catName] || <Package size={18} className="text-text-muted-light" />;
};

// --- SHARED MODAL COMPONENT ---
const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-md", submitLabel = "حفظ واعتماد" }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-all duration-500" 
        dir="rtl" onClick={onClose} 
      >
        <motion.div 
          onClick={(e) => e.stopPropagation()} 
          initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} 
          transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white dark:bg-surface-dark rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-border-light dark:border-border-dark flex flex-col overflow-hidden`}
        >
          <div className="flex items-center justify-between p-8 border-b border-border-light dark:border-border-dark bg-slate-50/30 dark:bg-slate-800/30 shrink-0">
            <h3 className="text-2xl font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark tracking-tight">{title}</h3>
            <button type="button" onClick={onClose} className="p-2.5 text-text-muted-light hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-text-primary-light dark:hover:text-white rounded-2xl transition-all active:scale-90">
              <X size={22} />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col">
            <div className="p-8 overflow-y-auto custom-scrollbar">{children}</div>
            <div className="p-8 border-t border-border-light dark:border-border-dark bg-slate-50/30 dark:bg-slate-800/30 flex space-x-4 space-x-reverse justify-end shrink-0">
                <button type="button" onClick={onClose} className="btn-outline px-6 py-3">إلغاء</button>
                <button type="submit" className="btn-primary px-8 py-3 shadow-primary/30">{submitLabel}</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const InputClass = "w-full bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-text-primary-light dark:text-text-primary-dark text-sm rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 block px-5 py-4 outline-none transition-all duration-300 placeholder:text-text-muted-light/40";
const LabelClass = "block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2.5 mr-1 uppercase tracking-wider transition-colors duration-300";

export default function Items() {
  const { playSuccess, playWarning } = useAudio();
  const { isDarkMode } = useTheme();
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
  
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [formState, setFormState] = useState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [nameSearchActiveIndex, setNameSearchActiveIndex] = useState(-1);
  const [companySearchActiveIndex, setCompanySearchActiveIndex] = useState(-1);

  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [sortByExpiry, setSortByExpiry] = useState(false);
  const [batchEyeItem, setBatchEyeItem] = useState(null);

  // --- LIVE FIREBASE SYNC ---
  useEffect(() => {
    if (!db) return;
    const qItems = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
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

  // --- FILTERING & GROUPING ---
  const dynamicCompanies = ['الكل', ...new Set(items.map(i => i.company || 'بدون شركة'))].filter(Boolean);
  const uniqueItemNames = [...new Set(items.map(i => i.name))].filter(Boolean);
  const uniqueCompanies = [...new Set(items.map(i => i.company || 'بدون شركة'))].filter(Boolean);
  const uniqueUnits = ['كرتونة'];
  
  const itemSuggestions = formState.name ? uniqueItemNames.filter(n => n.includes(formState.name)) : [];
  const companySuggestions = formState.company ? uniqueCompanies.filter(c => c.includes(formState.company)) : [];

  const hotItemsMap = useMemo(() => {
    const map = {};
    const now = new Date();
    transactions.forEach(tx => {
      if (tx.type !== 'Issue') return;
      if (!tx.timestamp) return;
      const txDate = tx.timestamp.toDate ? tx.timestamp.toDate() : new Date();
      const diffDays = Math.ceil(Math.abs(now - txDate) / 86400000);
      if (diffDays <= 7) {
        const matchedItem = items.find(i => tx.item.includes(i.name) && (i.company === 'بدون شركة' || tx.item.includes(i.company)));
        if (matchedItem) {
          if (!map[matchedItem.id]) map[matchedItem.id] = 0;
          map[matchedItem.id] += Number(tx.qty);
        }
      }
    });
    return map;
  }, [transactions, items]);

  // Dead-stock detection: items with stock > 0 but zero outbound in 30 days
  const deadStockSet = useMemo(() => {
    const hasOutbound = new Set();
    const now = new Date();
    transactions.forEach(tx => {
      if (tx.type !== 'Issue' && tx.type !== 'صادر') return;
      if (!tx.timestamp) return;
      const txDate = tx.timestamp.toDate ? tx.timestamp.toDate() : new Date();
      const diffDays = Math.ceil(Math.abs(now - txDate) / 86400000);
      if (diffDays <= 30) {
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

  // Expiry map: itemId → sorted array of batches (earliest first)
  const expiryMap = useMemo(() => {
    const map = {};
    transactions.forEach(tx => {
      if (tx.type !== 'وارد' || !tx.expiryDate || !tx.itemId) return;
      if (!map[tx.itemId]) map[tx.itemId] = [];
      map[tx.itemId].push({ expiryDate: tx.expiryDate, inboundDate: tx.date || '', qty: tx.qty || 0, location: tx.location || '' });
    });
    Object.keys(map).forEach(id => {
      map[id].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    });
    return map;
  }, [transactions]);

  // Dynamic thresholds: Frozen=90/30, Chilled=7/2, Default=150/30
  const getExpiryThresholds = (cat) => {
    if (cat === 'مجمدات') return { red: 30, orange: 90 };
    if (cat === 'تبريد') return { red: 2, orange: 7 };
    return { red: 30, orange: 150 };
  };

  const getExpiryInfo = (itemId) => {
    const batches = expiryMap[itemId];
    if (!batches?.length) return null;
    const daysLeft = Math.ceil((new Date(batches[0].expiryDate) - Date.now()) / 86400000);
    return { daysLeft, earliest: batches[0].expiryDate, batches };
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.company || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'الكل' || item.cat === categoryFilter;
      const matchComp = companyFilter === 'الكل' || (item.company || 'بدون شركة') === companyFilter;
      const matchHot = showHotOnly ? ((hotItemsMap[item.id] || 0) >= 10) : true;
      return matchSearch && matchCat && matchComp && matchHot;
    });
    if (sortByExpiry) {
      result = [...result].sort((a, b) => {
        const da = expiryMap[a.id]?.[0] ? Math.ceil((new Date(expiryMap[a.id][0].expiryDate) - Date.now()) / 86400000) : Infinity;
        const db = expiryMap[b.id]?.[0] ? Math.ceil((new Date(expiryMap[b.id][0].expiryDate) - Date.now()) / 86400000) : Infinity;
        return da - db;
      });
    }
    return result;
  }, [items, searchQuery, categoryFilter, companyFilter, showHotOnly, hotItemsMap, sortByExpiry, expiryMap]);

  const groupedItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const cat = item.cat || 'أخرى';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  // --- ACTIONS ---
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formState.name.trim()) return toast.error("أدخل اسم الصنف.");
    
    const rawName = formState.name.trim();
    const rawCompany = formState.company.trim() || 'بدون شركة';
    const normName = normalizeText(rawName);
    const normCompany = normalizeText(rawCompany);

    const isDup = items.some(i => normalizeText(i.name) === normName && normalizeText(i.company || 'بدون شركة') === normCompany);
    if (isDup) {
      toast.error("هذا الصنف موجود مسبقاً بنفس الشركة.");
      playWarning();
      return;
    }

    try {
      await addDoc(collection(db, 'items'), {
        name: rawName,
        company: rawCompany,
        cat: formState.cat,
        unit: formState.unit,
        stockQty: 0,
        searchKey: `${rawName} ${rawCompany}`.toLowerCase(),
        createdAt: serverTimestamp()
      });
      toast.success("تم إضافة الصنف بنجاح ✅");
      playSuccess();
      setIsAddModalOpen(false);
      setFormState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
    } catch (err) {
      toast.error("حدث خطأ أثناء الإضافة.");
    }
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setFormState({ name: item.name, company: item.company, cat: item.cat, unit: item.unit });
    setIsCustomUnit(!uniqueUnits.includes(item.unit) && item.unit !== 'كرتونة');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formState.name.trim()) return;

    try {
      await updateDoc(doc(db, 'items', selectedItem.id), {
        name: formState.name.trim(),
        company: formState.company.trim() || 'بدون شركة',
        cat: formState.cat,
        unit: formState.unit,
        searchKey: `${formState.name} ${formState.company}`.toLowerCase(),
      });
      toast.success("تم التعديل بنجاح ✅");
      playSuccess();
      setIsEditModalOpen(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error("حدث خطأ أثناء التعديل.");
    }
  };

  const openDeleteModal = (item) => {
    if (item.stockQty > 0) {
      toast.error(`لا يمكن حذف المادة "${item.name}" لوجود رصيد حالي (${item.stockQty}) بالمخزن ⛔`);
      playWarning();
      return;
    }
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    try {
      await deleteDoc(doc(db, 'items', selectedItem.id));
      toast.success("تم الحذف بنجاح 🗑️");
      playSuccess();
      setIsDeleteModalOpen(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error("حدث خطأ أثناء الحذف.");
    }
  };

  const handleBulkDeleteSubmit = async (e) => {
    e.preventDefault();
    const itemsToDelete = items.filter(i => selectedForDelete.includes(i.id));
    const invalidItems = itemsToDelete.filter(i => i.stockQty > 0);
    
    if (invalidItems.length > 0) {
      toast.error(`هناك ${invalidItems.length} أصناف مسجلة برصيد حالي، لا يمكن حذفها تجنباً لتلف المخزون.`);
      playWarning();
      return;
    }

    try {
      await Promise.all(itemsToDelete.map(item => deleteDoc(doc(db, 'items', item.id))));
      toast.success(`تم حذف ${itemsToDelete.length} أصناف بنجاح 🗑️`);
      playSuccess();
      setIsBulkDeleteModalOpen(false);
      setSelectedForDelete([]);
    } catch (err) {
      toast.error("حدث خطأ أثناء الحذف الجماعي.");
    }
  };

  const toggleSelection = (id) => {
    setSelectedForDelete(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // --- EXPORT logic ---
  const handleExportPDF = () => {
    try {
        const d = new jsPDF();
        try {
            // Attempt to load Arabic font safely (fallback handled internally by jspdf if missing)
            d.addFont('Amiri.ttf', 'Amiri', 'normal');
            d.setFont('Amiri');
        } catch(e) {}

        const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'مدير النظام';

        d.setFontSize(22);
        d.text("Baraka Al Thimar PRO - Items Directory", 105, 15, { align: 'center' });
        d.setFontSize(10);
        d.text(`Date: ${new Date().toLocaleDateString('ar-SA')} | By: ${userName}`, 195, 25, { align: 'right' });
        
        d.autoTable({
            startY: 30,
            head: [['#', 'Item Name (اسم الصنف)', 'Company (الشركة)', 'Category (القسم)', 'Default Unit (وحدة القياس)']],
            body: filteredItems.map((it, idx) => [idx + 1, it.name, it.company || '-', it.cat, it.unit || 'كرتونة']),
            headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center' },
            styles: { halign: 'center', font: 'Amiri' }
        });
        d.save(`Items_Directory_${Date.now()}.pdf`);
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

  // --- ANIMATION VARIANTS ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const cardVariants = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } } };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 font-readex h-full overflow-hidden" dir="rtl">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark">دليل الأصناف والمخزون</h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">إدارة المنتجات ومراقبة مستويات التوفر والصلاحية</p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {!isViewer && selectedForDelete.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, width: 0 }} animate={{ opacity: 1, scale: 1, width: 'auto' }} exit={{ opacity: 0, scale: 0.9, width: 0 }}
                onClick={() => setIsBulkDeleteModalOpen(true)} 
                className="flex items-center whitespace-nowrap gap-2 px-4 py-2.5 bg-status-danger/10 border border-status-danger/20 text-status-danger rounded-xl font-bold text-sm transition-all"
              >
                <Trash2 size={16} />
                <span>حذف ({selectedForDelete.length})</span>
              </motion.button>
            )}
          </AnimatePresence>

          <div className="relative">
            <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="btn-outline flex items-center gap-2">
              <Download size={18} />
              <span>تصدير</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isExportMenuOpen && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute left-0 mt-2 w-48 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl z-30 p-1">
                  <button onClick={() => { handleExportPDF(); setIsExportMenuOpen(false); }} className="w-full text-right px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2">
                    <FileText size={16} className="text-status-danger" />
                    <span>تصدير PDF</span>
                  </button>
                  <button onClick={() => { handleExportPNG(); setIsExportMenuOpen(false); }} className="w-full text-right px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2">
                    <Image size={16} className="text-status-success" />
                    <span>طباعة الكتالوج</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isViewer && (
            <button onClick={() => { setFormState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' }); setIsCustomUnit(false); setIsAddModalOpen(true); }} className="btn-primary flex items-center gap-2">
               <Plus size={18} />
               <span>صنف جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 flex flex-col lg:flex-row lg:items-center gap-4 shrink-0">
        <div className="relative flex-1 group">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-light group-focus-within:text-primary transition-colors" />
          <input type="text" placeholder="بحث عن صنف أو شركة..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`${InputClass} pr-10 py-2.5`} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={`${InputClass} w-auto min-w-[120px] py-2.5`}>
            <option>الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
          </select>
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className={`${InputClass} w-auto min-w-[120px] py-2.5`}>
            {dynamicCompanies.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowHotOnly(!showHotOnly)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${showHotOnly ? 'bg-status-warning/10 text-status-warning border-status-warning/20' : 'bg-slate-50 dark:bg-slate-800/50 text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark'}`}
          >
            <Flame size={14} className={showHotOnly ? 'animate-bounce' : ''} />
            الأكثر طلباً
          </button>
          <button onClick={() => setSortByExpiry(!sortByExpiry)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${sortByExpiry ? 'bg-primary/10 text-primary dark:text-accent-light border-primary/20' : 'bg-slate-50 dark:bg-slate-800/50 text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark'}`}
          >
            <CalendarDays size={14} />
            الصلاحية
          </button>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10" id="printable-directory">
        {Object.keys(groupedItems).length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white/20 dark:bg-black/10 rounded-[2rem] border-2 border-dashed border-border-light dark:border-border-dark">
              <Package size={64} className="text-text-muted-light mb-6 opacity-20" />
              <h3 className="text-xl font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark mb-2">لا توجد نتائج</h3>
              <p className="text-text-secondary-light dark:text-text-secondary-dark mb-8 max-w-xs">جرب تغيير كلمات البحث أو الفلاتر للعثور على ما تبحث عنه.</p>
           </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10">
            {Object.keys(groupedItems).sort().map(cat => (
              <div key={cat} className="space-y-6">
                <div className="flex items-center gap-4 sticky top-0 z-10 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md py-3 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-dark shadow-sm border border-border-light dark:border-border-dark flex items-center justify-center text-primary dark:text-accent-light">
                    {getCatIcon(cat)}
                  </div>
                  <h3 className="text-xl font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark">قسم {cat}</h3>
                  <div className="flex-1 h-px bg-border-light dark:border-border-dark"></div>
                  <span className="text-[10px] font-bold text-text-muted-light uppercase tracking-widest bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark">{groupedItems[cat].length} صنف</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {groupedItems[cat].map(item => {
                    const expInfo = getExpiryInfo(item.id);
                    const daysLeft = expInfo?.daysLeft ?? null;
                    const thresholds = getExpiryThresholds(item.cat);
                    const isExpired = daysLeft !== null && daysLeft <= 0;
                    const isUrgent  = daysLeft !== null && daysLeft > 0  && daysLeft <= thresholds.red;
                    const isWarning = daysLeft !== null && daysLeft > thresholds.red && daysLeft <= thresholds.orange;
                    const isDead = deadStockSet.has(item.id);
                    const storageIcon = item.cat === 'مجمدات' ? <Snowflake size={12} className="text-primary dark:text-accent-light" /> : item.cat === 'تبريد' ? <Thermometer size={12} className="text-primary dark:text-accent-light" /> : null;
                    
                    return (
                      <motion.div
                        key={item.id} variants={cardVariants}
                        className={`bg-white rounded-[1.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:border-primary/20 group flex flex-col p-6 relative overflow-hidden transition-all duration-500 ${isExpired || isUrgent ? 'border-status-danger/40 bg-rose-50/10' : isWarning ? 'border-status-warning/40 bg-amber-50/10' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-3 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-primary/5 transition-colors">
                              {storageIcon}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{item.company || 'بدون شركة'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDead && (
                              <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase border border-slate-200">راكد</span>
                            )}
                            {expInfo && (
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1.5 shadow-sm ${
                                isExpired ? 'bg-status-danger text-white border-status-danger animate-pulse'
                                : isUrgent ? 'bg-rose-50 text-status-danger border-rose-200'
                                : isWarning ? 'bg-amber-50 text-status-warning border-amber-200'
                                : 'bg-emerald-50 text-status-success border-emerald-200'
                              }`}>
                                <Timer size={10} />
                                {isExpired ? 'منتهي' : `${daysLeft} يوم`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 mb-6">
                          <h4 className="text-lg font-bold text-slate-800 truncate leading-tight group-hover:text-primary transition-colors tracking-tight">{item.name}</h4>
                          {(hotItemsMap[item.id] || 0) >= 10 && (
                            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl animate-bounce" title={`🔥 ${hotItemsMap[item.id]} صادر مؤخراً`}>
                              <Flame size={16} />
                            </div>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3 pt-5 border-t border-slate-100">
                          <div className={`px-4 py-1.5 rounded-xl text-sm font-black border transition-all duration-300 shadow-sm ${ (item.stockQty || 0) <= 0 ? 'bg-rose-50 text-status-danger border-rose-100' : 'bg-slate-50 text-slate-700 border-slate-100 group-hover:bg-primary group-hover:text-white group-hover:border-primary' }`}>
                            {item.stockQty ?? 0} <span className="text-[10px] font-bold opacity-60 ml-0.5">{item.unit}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            {expInfo && (
                              <button onClick={() => setBatchEyeItem(item)} className="p-2.5 bg-white text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-sm hover:shadow-md active:scale-90"><Eye size={16} /></button>
                            )}
                            {!isViewer && (
                              <>
                                <button onClick={() => openEditModal(item)} className="p-2.5 bg-white text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 shadow-sm hover:shadow-md active:scale-90"><Pencil size={16} /></button>
                                <button onClick={() => openDeleteModal(item)} className="p-2.5 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 shadow-sm hover:shadow-md active:scale-90"><Trash2 size={16} /></button>
                                <label className="p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center">
                                  <input type="checkbox" checked={selectedForDelete.includes(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 rounded-lg text-primary border-slate-300 focus:ring-primary/20 transition-all" />
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Interactive accent bar */}
                        <div className="absolute bottom-0 right-0 w-0 h-1.5 bg-primary group-hover:w-full transition-all duration-700 ease-out"></div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* BATCH EYE MODAL 👁️ */}
      <AnimatePresence>
        {batchEyeItem && (() => {
          const batches = expiryMap[batchEyeItem.id] || [];
          const alertBatchIdx = batches.length > 0 ? 0 : -1; // First batch (earliest expiry) causes the alert
          const storageType = batchEyeItem.cat === 'مجمدات' ? '❄️ مجمد' : batchEyeItem.cat === 'تبريد' ? '🌡️ مبرد' : '📦 عادي';
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
              dir="rtl" onClick={() => setBatchEyeItem(null)}
            >
              <motion.div onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 25 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
              >
                {/* Header with item info */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-l from-slate-50/80 to-emerald-50/30 dark:from-slate-800/50 dark:to-emerald-900/10">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye size={18} className="text-indigo-500 shrink-0" />
                        <h3 className="text-base font-black text-slate-800 dark:text-white truncate">{batchEyeItem.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{batchEyeItem.company || 'بدون شركة'}</span>
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">{storageType}</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">{batches.length} دفعة</span>
                      </div>
                    </div>
                    <button onClick={() => setBatchEyeItem(null)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 rounded-full transition-colors shrink-0"><X size={18} /></button>
                  </div>
                </div>

                {/* Batches list */}
                <div className="p-4 space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar">
                  {batches.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarDays size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-sm text-slate-400 font-bold">لا توجد بيانات صلاحية مسجلة</p>
                    </div>
                  ) : batches.map((b, idx) => {
                    const days = Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000);
                    const expired = days <= 0; const urgent = days > 0 && days <= 30; const warn = days > 30 && days <= 150;
                    const isAlertCause = idx === alertBatchIdx && (expired || urgent || warn);
                    return (
                      <div key={idx} className={`relative flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                        isAlertCause
                          ? expired || urgent
                            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-400 dark:border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] dark:shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                            : 'bg-orange-50 dark:bg-orange-500/10 border-orange-400 dark:border-orange-500/40 shadow-[0_0_15px_rgba(251,146,60,0.15)]'
                          : expired || urgent ? 'bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20'
                          : warn ? 'bg-orange-50/50 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                      }`}>
                        {/* Alert cause indicator ribbon */}
                        {isAlertCause && (
                          <div className="absolute -top-0 right-3 bg-rose-500 dark:bg-rose-600 text-white text-[8px] font-black px-2 py-0.5 rounded-b-md shadow-sm">
                            ⚠ سبب التنبيه
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {/* Countdown badge */}
                          <div className={`inline-flex items-center gap-1 text-xs font-black mb-1.5 px-2 py-0.5 rounded-lg ${
                            expired ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                            : urgent ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : warn ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                            : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            <Timer size={10} className={expired || urgent ? 'animate-pulse' : ''} />
                            {expired ? '⛔ منتهي الصلاحية' : urgent ? `⚠️ ${days} يوم متبقي` : warn ? `🟠 ${days} يوم متبقي` : `✅ ${days} يوم متبقي`}
                          </div>
                          {/* Dates */}
                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-0.5"><CalendarDays size={9} className="opacity-60" /> صلاحية: {b.expiryDate}</span>
                            {b.inboundDate && <span className="flex items-center gap-0.5"><Truck size={9} className="opacity-60" /> وارد: {b.inboundDate}</span>}
                          </div>
                          {b.location && <p className="text-[9px] text-slate-400 font-bold mt-0.5">📍 {b.location}</p>}
                        </div>
                        <div className="text-left shrink-0 bg-white/60 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          <p className="text-sm font-black text-slate-700 dark:text-slate-200">{b.qty}</p>
                          <p className="text-[9px] text-slate-400 text-center">{batchEyeItem.unit || 'وحدة'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                  <p className="text-[10px] text-slate-400 font-bold">👁️ الدفعة الأقرب انتهاءً تظهر أولاً مع علامة «سبب التنبيه»</p>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* --- MODALS --- */}
      {/* ADD/EDIT MODAL */}
      <ModalWrapper 
        title={isEditModalOpen ? "تحديث بيانات الصنف" : "تسجيل صنف جديد"} 
        isOpen={isAddModalOpen || isEditModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} 
        onSubmit={isEditModalOpen ? handleEditSubmit : handleAddSubmit}
      >
        <div className="space-y-6 relative">
          <div className="relative group/nameItem">
            <label className={LabelClass}>اسم الصنف <span className="text-status-danger">*</span></label>
            <input type="text" className={InputClass} placeholder="مثال: دجاج صافي 1000ج" value={formState.name} onChange={e => { setFormState({...formState, name: e.target.value}); setNameSearchActiveIndex(-1); }} onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setNameSearchActiveIndex(prev => prev < itemSuggestions.length - 1 ? prev + 1 : prev); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setNameSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                else if (e.key === 'Enter' && nameSearchActiveIndex >= 0 && itemSuggestions[nameSearchActiveIndex]) {
                  e.preventDefault();
                  setFormState(prev => ({...prev, name: itemSuggestions[nameSearchActiveIndex]}));
                  setNameSearchActiveIndex(-1);
                }
            }} autoFocus required />
            
            {formState.name && itemSuggestions.length > 0 && (
              <div className="hidden group-focus-within/nameItem:block absolute top-[100%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark z-30 p-1 mt-1">
                {itemSuggestions.map((suggestion, idx) => (
                  <button key={idx} type="button" className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors text-sm font-bold ${nameSearchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onMouseDown={(e) => { e.preventDefault(); setFormState({...formState, name: suggestion}); setNameSearchActiveIndex(-1); }}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="relative group/compItem">
             <label className={LabelClass}>الشركة المنتجة</label>
             <input type="text" className={InputClass} placeholder="مثال: الوطنية، ساديا..." value={formState.company} onChange={e => { setFormState({...formState, company: e.target.value}); setCompanySearchActiveIndex(-1); }} onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setCompanySearchActiveIndex(prev => prev < companySuggestions.length - 1 ? prev + 1 : prev); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setCompanySearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                else if (e.key === 'Enter' && companySearchActiveIndex >= 0 && companySuggestions[companySearchActiveIndex]) {
                  e.preventDefault();
                  setFormState(prev => ({...prev, company: companySuggestions[companySearchActiveIndex]}));
                  setCompanySearchActiveIndex(-1);
                }
            }} />
             
             {formState.company && companySuggestions.length > 0 && (
              <div className="hidden group-focus-within/compItem:block absolute top-[100%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark z-30 p-1 mt-1">
                {companySuggestions.map((suggestion, idx) => (
                  <button key={idx} type="button" className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors text-sm font-bold ${companySearchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onMouseDown={(e) => { e.preventDefault(); setFormState({...formState, company: suggestion}); setCompanySearchActiveIndex(-1); }}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div>
              <label className={LabelClass}>المجموعة (القسم)</label>
              <select className={InputClass} value={formState.cat} onChange={e => setFormState({...formState, cat: e.target.value})}>
                <option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">وحدة القياس</label>
                <button type="button" onClick={() => { setIsCustomUnit(!isCustomUnit); setFormState({...formState, unit: (!isCustomUnit) ? '' : 'كرتونة'}); }} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-primary dark:text-accent-light px-2 py-1 rounded-lg font-bold hover:bg-primary/10 transition-all flex items-center shadow-sm">
                  {isCustomUnit ? 'قائمة' : <><Plus size={10} className="mr-0.5" /> مخصصة</>}
                </button>
              </div>
              {isCustomUnit ? (
                 <input type="text" className={InputClass} placeholder="اكتب الوحدة هنا..." value={formState.unit} onChange={e => setFormState({...formState, unit: e.target.value})} autoFocus required />
              ) : (
                 <select className={InputClass} value={formState.unit} onChange={e => setFormState({...formState, unit: e.target.value})}>
                   <option>كرتونة</option>
                 </select>
              )}
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* DELETE MODAL */}
      <ModalWrapper 
        title="تأكيد عملية الحذف" 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onSubmit={handleDeleteSubmit}
        submitLabel="تأكيد الحذف نهائياً"
      >
        <div className="flex flex-col items-center text-center p-2">
           <div className="w-16 h-16 bg-status-danger/10 rounded-full flex items-center justify-center text-status-danger mb-4 animate-pulse">
              <AlertTriangle size={32} />
           </div>
           <h4 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark mb-2">هل أنت متأكد من حذف هذا الصنف؟</h4>
           <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
             سيتم حذف <span className="text-status-danger font-bold">{selectedItem?.name}</span> من قائمة الأصناف بشكل نهائي. 
           </p>
           <div className="bg-status-danger/5 text-status-danger text-[10px] font-bold px-4 py-2 rounded-xl border border-status-danger/10">
             هذا الإجراء لا يمكن التراجع عنه.
           </div>
        </div>
      </ModalWrapper>

      {/* BULK DELETE MODAL */}
      <ModalWrapper 
        title="تأكيد الحذف الجماعي" 
        isOpen={isBulkDeleteModalOpen} 
        onClose={() => setIsBulkDeleteModalOpen(false)} 
        onSubmit={handleBulkDeleteSubmit}
        submitLabel="تأكيد الحذف نهائياً"
      >
        <div className="flex flex-col items-center text-center p-2">
           <div className="w-16 h-16 bg-status-danger/10 rounded-full flex items-center justify-center text-status-danger mb-4 animate-pulse">
              <AlertTriangle size={32} />
           </div>
           <h4 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark mb-2">هل أنت متأكد من حذف هذه الأصناف؟</h4>
           <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
             سيتم حذف <span className="text-status-danger font-bold">{selectedForDelete.length}</span> أصناف محددة من قائمة المخزن بشكل نهائي. 
           </p>
           <div className="bg-status-danger/5 text-status-danger text-[10px] font-bold px-4 py-2 rounded-xl border border-status-danger/10">
             لا يمكن التراجع عن هذا الإجراء وسيتم إجراء فحص الأرصدة أولاً.
           </div>
        </div>
      </ModalWrapper>

    </div>
  );
}
