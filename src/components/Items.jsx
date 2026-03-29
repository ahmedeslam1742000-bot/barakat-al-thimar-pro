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
  'مجمدات': <Snowflake size={18} className="text-cyan-500" />,
  'بلاستيك': <Archive size={18} className="text-amber-500" />,
  'تبريد': <Box size={18} className="text-blue-500" />
};

const getCatIcon = (catName) => {
  return categoryIcons[catName] || <Package size={18} className="text-slate-500" />;
};

// --- SHARED MODAL COMPONENT ---
const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-md", submitLabel = "حفظ" }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" 
        dir="rtl" onClick={onClose} 
      >
        <motion.div 
          onClick={(e) => e.stopPropagation()} 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
            <h3 className="text-lg font-black text-slate-800 dark:text-white">{title}</h3>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white rounded-full transition-colors">
              <X size={20} className="stroke-[3]" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col">
            <div className="p-5">{children}</div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex space-x-3 space-x-reverse justify-end scale-100">
                <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
                <button type="submit" className="px-6 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20">{submitLabel}</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const InputClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block px-4 py-2.5 outline-none transition-all";
const LabelClass = "block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5";

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
    <div className="h-full w-full flex flex-col font-['Cairo'] text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">
      
      {/* 1. Header & Quick Actions */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 mb-6 shrink-0 z-20 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
               <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">سجل الأصناف</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">إدارة دليلك الكامل للمخزون بدقة وسهولة</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse self-end lg:self-auto relative pr-2">
            
            <AnimatePresence>
                {!isViewer && selectedForDelete.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 'auto' }}
                    exit={{ opacity: 0, scale: 0.9, width: 0 }}
                    onClick={() => setIsBulkDeleteModalOpen(true)} 
                    className="flex items-center whitespace-nowrap space-x-2 space-x-reverse px-4 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-sm transition-all overflow-hidden"
                  >
                    <Trash2 size={16} />
                    <span>حذف ({selectedForDelete.length})</span>
                  </motion.button>
                )}
            </AnimatePresence>

            <div className="relative">
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center space-x-2 space-x-reverse px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all shadow-sm shadow-slate-200/50 dark:shadow-none">
                <Download size={16} />
                <span>تصدير الكتالوج</span>
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

            {!isViewer && (
              <button onClick={() => { setFormState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' }); setIsCustomUnit(false); setIsAddModalOpen(true); }} className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg hover:shadow-slate-500/20">
                 <Plus size={18} />
                 <span>إضافة صنف</span>
              </button>
            )}
          </div>

        </div>

        {/* Filter Bar */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative group col-span-2 flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-inner">
            <Search size={16} className="text-slate-400 group-focus-within:text-blue-500 transition-colors ml-3" />
            <input type="text" placeholder="البحث باسم الصنف أو الشركة..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent text-slate-800 dark:text-slate-100 text-sm font-bold focus:outline-none" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors shadow-inner appearance-none">
            <option>الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
          </select>
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors shadow-inner appearance-none">
            {dynamicCompanies.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowHotOnly(!showHotOnly)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all shadow-inner border truncate ${showHotOnly ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 text-orange-600 dark:text-orange-400' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Flame size={15} className={showHotOnly ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">الأكثر طلباً</span>
          </button>
          <button onClick={() => setSortByExpiry(!sortByExpiry)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all shadow-inner border truncate ${sortByExpiry ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 text-rose-600 dark:text-rose-400' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <CalendarDays size={15} />
            <span className="hidden sm:inline">الصلاحية</span>
          </button>
        </div>
      </div>

      {/* 2. Sectioned Content (The Directory) */}
      <div className="flex-1 overflow-y-auto px-1 pb-10 custom-scrollbar hide-print w-full" id="printable-directory">
        {Object.keys(groupedItems).length === 0 ? (
           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center p-12 text-center bg-white/40 dark:bg-slate-800/20 backdrop-blur-md rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 mt-4 h-[50vh] shadow-sm">
              <Package size={56} className="text-slate-300 dark:text-slate-600 mb-6 animate-bounce" />
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">لا توجد أصناف مطابقة للبحث</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold mb-8 max-w-sm text-center">قم بإضافة أصناف جديدة لمخزنك للبدء في تتبع الرصيد وإدارة المعاملات الخاصة بك.</p>
              {!isViewer && (
                <button onClick={() => { setFormState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' }); setIsCustomUnit(false); setIsAddModalOpen(true); }} className="flex items-center space-x-2 space-x-reverse px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:scale-[1.05] active:scale-95 transition-all shadow-lg hover:shadow-blue-500/30 dark:hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                   <Plus size={20} />
                   <span>إضافة صنف جديد</span>
                </button>
              )}
           </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8">
            {Object.keys(groupedItems).sort().map(cat => (
              <div key={cat} className="space-y-4">
                
                {/* Category Header */}
                <div className="flex items-center space-x-3 space-x-reverse px-2 sticky top-0 z-10 bg-slate-50/90 dark:bg-[#080d17]/90 backdrop-blur-md py-2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700/60 flex items-center justify-center">
                    {getCatIcon(cat)}
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">قسم {cat}</h3>
                  <div className="flex-1 h-px bg-gradient-to-l from-slate-200/0 via-slate-200 dark:via-slate-700 to-slate-200/0"></div>
                  <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">{groupedItems[cat].length} عنصر</span>
                </div>

                {/* The Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 px-1">
                  {groupedItems[cat].map(item => {
                    const expInfo = getExpiryInfo(item.id);
                    const daysLeft = expInfo?.daysLeft ?? null;
                    const thresholds = getExpiryThresholds(item.cat);
                    const isExpired = daysLeft !== null && daysLeft <= 0;
                    const isUrgent  = daysLeft !== null && daysLeft > 0  && daysLeft <= thresholds.red;
                    const isWarning = daysLeft !== null && daysLeft > thresholds.red && daysLeft <= thresholds.orange;
                    const isDead = deadStockSet.has(item.id);
                    const storageIcon = item.cat === 'مجمدات'
                      ? <Snowflake size={11} className="text-cyan-500 shrink-0" />
                      : item.cat === 'تبريد'
                      ? <Thermometer size={11} className="text-blue-500 shrink-0" />
                      : null;
                    return (
                      <motion.div
                        key={item.id} variants={cardVariants}
                        className={`group relative flex flex-col p-4 rounded-2xl bg-white dark:bg-slate-800/40 backdrop-blur-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 overflow-hidden ${
                          isExpired || isUrgent ? 'border-2 border-rose-500 dark:border-rose-500 expiry-blink'
                          : isWarning ? 'border-2 border-orange-400 dark:border-orange-400'
                          : 'border border-slate-100 dark:border-slate-700/50'}`}
                      >
                        {/* Top: storage icon + company + expiry countdown badge */}
                        <div className="flex items-center justify-between mb-1 gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {storageIcon}
                            <span className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase truncate">{item.company || 'بدون شركة'}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isDead && (
                              <span className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-md font-black bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600" title="لا يوجد صادر خلال 30 يوم">
                                <PackageX size={8} /> راكد
                              </span>
                            )}
                            {expInfo && (
                              <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg font-black border shadow-sm ${
                                isExpired ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/40 expiry-blink'
                                : isUrgent ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 expiry-blink'
                                : isWarning ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30'
                                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                              }`}>
                                <Timer size={9} className={isExpired || isUrgent ? 'animate-pulse' : ''} />
                                {isExpired ? '⛔ منتهي' : `${daysLeft} يوم متبقي`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Item name + hot/dead icons */}
                        <div className="flex items-center gap-1.5 mb-3">
                          <h4 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate flex-1">{item.name}</h4>
                          {(hotItemsMap[item.id] || 0) >= 10 && (
                            <div className="group/hot relative shrink-0">
                              <Flame size={15} className="text-orange-500 animate-[pulse_2s_ease-in-out_infinite]" />
                              <div className="hidden group-hover/hot:block absolute top-[130%] -right-2 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap z-[100] shadow-xl">
                                🔥 {hotItemsMap[item.id]} {item.unit || 'كرتونة'} هذا الأسبوع
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom: stock qty + actions */}
                        <div className="flex items-center justify-between mt-auto gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black border ${
                            (item.stockQty || 0) <= 0
                              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100'
                          }`}>
                            {item.stockQty ?? 0} <span className="text-[9px] mr-0.5 opacity-60">{item.unit}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            {expInfo && (
                              <button onClick={e => { e.stopPropagation(); setBatchEyeItem(item); }} title="عرض الدفعات"
                                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all">
                                <Eye size={13} />
                              </button>
                            )}
                            {!isViewer && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                <button onClick={e => { e.stopPropagation(); openEditModal(item); }} title="تعديل" className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all"><Pencil size={13} /></button>
                                <button onClick={e => { e.stopPropagation(); openDeleteModal(item); }} title="حذف" className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all"><Trash2 size={13} /></button>
                                <label className={`cursor-pointer p-1.5 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 transition-all ${selectedForDelete.includes(item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                  <input type="checkbox" checked={selectedForDelete.includes(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/50 dark:border-slate-600 dark:bg-slate-700 cursor-pointer" />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Accent line */}
                        <div className="absolute bottom-0 right-0 w-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 group-hover:w-full transition-all duration-500 ease-out"></div>
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
        <div className="space-y-4 relative">
          <div className="relative group/nameItem">
            <label className={LabelClass}>اسم الصنف <span className="text-rose-500">*</span></label>
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
              <div className="hidden group-focus-within/nameItem:block absolute top-[100%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700/60 z-30 p-1 mt-1">
                {itemSuggestions.map((suggestion, idx) => (
                  <button key={idx} type="button" className={`w-full text-right px-3 py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0 transition-colors text-sm font-bold ${nameSearchActiveIndex === idx ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} onMouseDown={(e) => { e.preventDefault(); setFormState({...formState, name: suggestion}); setNameSearchActiveIndex(-1); }}>
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
              <div className="hidden group-focus-within/compItem:block absolute top-[100%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700/60 z-30 p-1 mt-1">
                {companySuggestions.map((suggestion, idx) => (
                  <button key={idx} type="button" className={`w-full text-right px-3 py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0 transition-colors text-sm font-bold ${companySearchActiveIndex === idx ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} onMouseDown={(e) => { e.preventDefault(); setFormState({...formState, company: suggestion}); setCompanySearchActiveIndex(-1); }}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 relative z-10">
            <div>
              <label className={LabelClass}>المجموعة (القسم)</label>
              <select className={InputClass} value={formState.cat} onChange={e => setFormState({...formState, cat: e.target.value})}>
                <option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">وحدة القياس</label>
                <button type="button" onClick={() => { setIsCustomUnit(!isCustomUnit); setFormState({...formState, unit: (!isCustomUnit) ? '' : 'كرتونة'}); }} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center shadow-sm">
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
           <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4 animate-pulse">
              <AlertTriangle size={32} />
           </div>
           <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">هل أنت متأكد من حذف هذا الصنف؟</h4>
           <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">
             سيتم حذف <span className="text-rose-600 dark:text-rose-400">{selectedItem?.name}</span> من قائمة الأصناف بشكل نهائي. 
           </p>
           <p className="text-[10px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-500/20">هذا الإجراء لا يمكن التراجع عنه.</p>
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
           <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4 animate-pulse">
              <AlertTriangle size={32} />
           </div>
           <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">هل أنت متأكد من حذف هذه الأصناف؟</h4>
           <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">
             سيتم حذف <span className="text-rose-600 dark:text-rose-400">{selectedForDelete.length}</span> أصناف محددة من قائمة المخزن بشكل نهائي. 
           </p>
           <p className="text-[10px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-500/20">لا يمكن التراجع عن هذا الإجراء وسيتم إجراء فحص الأرصدة أولاً.</p>
        </div>
      </ModalWrapper>

    </div>
  );
}
