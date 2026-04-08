import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, TrendingUp, Truck, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Plus, X, FileText, RotateCcw, Search, Trash2, Bell, Clock, CheckCircle2, AlertOctagon, Printer,
  Timer, Snowflake, Thermometer, ShieldAlert, History, ChevronDown
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio } from '../contexts/AudioContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Firebase Imports
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, where } from 'firebase/firestore';

const salesData = [
  { name: 'يناير', sales: 0 }, { name: 'فبراير', sales: 0 },
  { name: 'مارس', sales: 0 }, { name: 'أبريل', sales: 0 },
  { name: 'مايو', sales: 0 }, { name: 'يونيو', sales: 0 },
  { name: 'يوليو', sales: 0 },
];

const normalizeText = (text) => {
  if (!text) return '';
  return text.toString()
    .replace(/[\u064B-\u065F]/g, '') // Remove Tashkeel
    .replace(/[أإآ]/g, 'ا') // Normalize Alif
    .replace(/ة/g, 'ه') // Normalize Ta Marbuta
    .replace(/ى/g, 'ي') // Normalize Alif Maqsura
    .replace(/\s+/g, ' ') // Remove extra spaces
    .trim();
};

const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-2xl", isSubmitDisabled = false }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md transition-all duration-500" 
        dir="rtl" onClick={onClose} 
      >
        <motion.div 
          onClick={(e) => e.stopPropagation()} 
          initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden`}
        >
          <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50/30 shrink-0">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h3>
            <button type="button" onClick={onClose} className="p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-2xl transition-all active:scale-90">
              <X size={22} />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 relative">{children}</div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex space-x-4 space-x-reverse justify-end shrink-0">
                  <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">إلغاء</button>
                  <button type="submit" disabled={isSubmitDisabled} className="btn-primary px-8 py-3 shadow-primary/30">حفظ واعتماد العمليات</button>
              </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const InputClass = "w-full bg-slate-100/50 border border-transparent text-slate-800 text-sm rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 block px-5 py-4 outline-none transition-all duration-300 placeholder:text-slate-400";
const LabelClass = "block text-xs font-black text-slate-500 mb-2.5 mr-1 uppercase tracking-wider transition-colors duration-300";

export default function Dashboard() {
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isReturnsModalOpen, setIsReturnsModalOpen] = useState(false);

  // --- 🔥 RENAMED STATE VARIABLES TO FORCIBLY BYPASS VITE HMR --- //
  const [items, setItems] = useState([]); 
  const [dbTransactionsList, setDbTransactionsList] = useState([]);

  // Dynamic Locations State
  const [locations, setLocations] = useState(['مستودع الرياض']);

  // Modals Data State
  const [itemForm, setItemForm] = useState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
  const [itemErrors, setItemErrors] = useState({});

  const [stockForm, setStockForm] = useState({ 
    loc: 'مستودع الرياض', date: new Date().toISOString().split('T')[0], items: [] 
  });
  const [currentStockItem, setCurrentStockItem] = useState({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
  const [stockErrors, setStockErrors] = useState({});

  const [invoiceForm, setInvoiceForm] = useState({ 
    rep: 'أحمد المندوب', date: new Date().toISOString().split('T')[0], items: [] 
  });
  const [currentInvoiceItem, setCurrentInvoiceItem] = useState({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
  const [invoiceErrors, setInvoiceErrors] = useState({});

  const [returnForm, setReturnForm] = useState({ 
    rep: 'محمد المندوب', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', reason: 'سليم (يعود للمخزون)', cat: '' 
  });
  const [returnErrors, setReturnErrors] = useState({});
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [itemFormSearchActiveIndex, setItemFormSearchActiveIndex] = useState(-1);
  const [companyFormSearchActiveIndex, setCompanyFormSearchActiveIndex] = useState(-1);
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false);
  const [selectedBatchTransactions, setSelectedBatchTransactions] = useState([]);
  const [isCustomUnit, setIsCustomUnit] = useState(false);

  // --- NEW Advanced States --- //
  const { currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const { playSuccess, playWarning } = useAudio();
  const [chartMode, setChartMode] = useState('category'); // 'category' | 'item'
  const [chartItemFilter, setChartItemFilter] = useState('الكل');
  const [chartItemSearchQuery, setChartItemSearchQuery] = useState('');
  const [isChartItemSearchOpen, setIsChartItemSearchOpen] = useState(false);
  const [chartCompanyFilter, setChartCompanyFilter] = useState('الكل');
  const [chartDateRange, setChartDateRange] = useState('هذا الشهر');
  const [chartCustomStartDate, setChartCustomStartDate] = useState('');
  const [chartCustomEndDate, setChartCustomEndDate] = useState('');

  const [alertCatFilter, setAlertCatFilter] = useState('الكل');
  const [alertUrgencyFilter, setAlertUrgencyFilter] = useState('الكل');
  const [alertSearch, setAlertSearch] = useState('');

  const [txFilter, setTxFilter] = useState('الكل');
  const [isMorningBriefOpen, setIsMorningBriefOpen] = useState(false);

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } } };

  // --- 🔥 LIVE FIREBASE CONNECTIVITY --- //
  useEffect(() => {
    if (!db) return;
    
    // 1. Fetch Items safely
    const qItems = query(collection(db, 'items'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Fetch Transactions safely
    const qTrans = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      setDbTransactionsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeItems();
      unsubscribeTrans();
    };
  }, []);

  if (!db) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-xl font-bold text-slate-500">Loading Firebase...</div>;
  }

  // --- Aggregations --- //
  const stockInCount = dbTransactionsList.filter(t => t.type === 'Restock').reduce((sum, t) => sum + Number(t.qty || 0), 0);
  const salesCount = dbTransactionsList.filter(t => t.type === 'Issue').reduce((sum, t) => sum + Number(t.qty || 0), 0);
  const returnsCount = dbTransactionsList.filter(t => t.type === 'Return').reduce((sum, t) => sum + Number(t.qty || 0), 0);
  const damageCount = dbTransactionsList.filter(t => t.status === 'مرتجع تالف').reduce((sum, t) => sum + Number(t.qty || 0), 0);

  // --- MORNING BRIEF: Expiry-at-risk items ---
  const getExpiryThresholds = (cat) => {
    if (cat === 'مجمدات') return { red: 30, orange: 90 };
    if (cat === 'تبريد') return { red: 2, orange: 7 };
    return { red: 30, orange: 150 };
  };

  const morningBriefData = useMemo(() => {
    // Build expiry map from inbound transactions
    const expiryMap = {};
    dbTransactionsList.forEach(tx => {
      if (tx.type !== 'وارد' || !tx.expiryDate || !tx.itemId) return;
      if (!expiryMap[tx.itemId]) expiryMap[tx.itemId] = [];
      expiryMap[tx.itemId].push({ expiryDate: tx.expiryDate, qty: Number(tx.qty || 0) });
    });
    Object.keys(expiryMap).forEach(id => {
      expiryMap[id].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    });

    const atRiskItems = [];
    items.forEach(item => {
      const batches = expiryMap[item.id];
      if (!batches?.length) return;
      const earliest = batches[0];
      const daysLeft = Math.ceil((new Date(earliest.expiryDate) - Date.now()) / 86400000);
      const t = getExpiryThresholds(item.cat);
      if (daysLeft <= t.orange) {
        const totalQtyAtRisk = batches.filter(b => Math.ceil((new Date(b.expiryDate) - Date.now()) / 86400000) <= t.orange).reduce((s, b) => s + b.qty, 0);
        atRiskItems.push({ ...item, daysLeft, totalQtyAtRisk, isUrgent: daysLeft <= t.red, isExpired: daysLeft <= 0 });
      }
    });

    atRiskItems.sort((a, b) => a.daysLeft - b.daysLeft);
    const totalQty = atRiskItems.reduce((s, i) => s + i.totalQtyAtRisk, 0);
    return { atRiskItems, totalQty };
  }, [items, dbTransactionsList]);

  // Show morning brief once per session when data loads
  useEffect(() => {
    if (items.length > 0 && dbTransactionsList.length > 0 && morningBriefData.atRiskItems.length > 0) {
      const shown = sessionStorage.getItem('morningBriefShown');
      if (!shown) {
        setIsMorningBriefOpen(true);
        sessionStorage.setItem('morningBriefShown', 'true');
      }
    }
  }, [items.length, dbTransactionsList.length, morningBriefData.atRiskItems.length]);

  // --- 1. ADD NEW MASTER ITEM --- //
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim()) {
      setItemErrors({ name: true });
      return toast.error("يرجى إدخال اسم الصنف المكتمل.");
    }
    
    const rawName = itemForm.name.trim();
    const rawCompany = itemForm.company.trim() || 'بدون شركة';

    const normalizedInputName = normalizeText(rawName);
    const normalizedInputCompany = normalizeText(rawCompany);

    try {
        // Fetch all items from Firestore to guarantee absolute duplicate prevention across all entries
        const qCompanyItems = query(collection(db, 'items'));
        const querySnapshot = await getDocs(qCompanyItems);
        
        let foundDuplicate = null;
        querySnapshot.forEach((docSnap) => {
           const dbItem = docSnap.data();
           const normDbCompany = normalizeText(dbItem.company || 'بدون شركة');
           const normDbName = normalizeText(dbItem.name);
           
           if (normDbCompany === normalizedInputCompany && normDbName === normalizedInputName) {
               foundDuplicate = dbItem;
           }
        });

        if (foundDuplicate) {
            setItemErrors({ name: true });
            alert(`خطأ: هذا الصنف موجود بالفعل بلفظ مشابه. لا يمكن تكراره لضمان دقة المخزون.\n\nالصنف المسجل: ${foundDuplicate.name}\nالشركة: ${foundDuplicate.company || 'بدون شركة'}`);
            return;
        }
        await addDoc(collection(db, 'items'), {
            name: rawName,
            company: rawCompany,
            cat: itemForm.cat,
            unit: itemForm.unit,
            stockQty: 0,
            searchKey: `${rawName} ${rawCompany}`.toLowerCase(),
            createdAt: serverTimestamp()
        });
        toast.success(`تم إضافة الصنف "${rawName}" بنجاح ✅`);
        playSuccess();
        setIsItemModalOpen(false);
        setIsCustomUnit(false);
        setItemForm({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
        setItemErrors({});
    } catch (err) {
        toast.error(err.message);
    }
  };

  // --- 2. ADD STOCK IN --- //
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (stockForm.items.length === 0) {
      if (currentStockItem.selectedItem && currentStockItem.qty) return toast.error("اضغط Enter لإضافة الصنف المفتوح إلى الجدول أولاً.");
      return toast.error("الجدول فارغ! الرجاء إضافة الأصناف أولاً.");
    }
    
    try {
        const processPromises = [];
        const additions = {};
        
        stockForm.items.forEach(it => {
            if (!additions[it.selectedItem.id]) additions[it.selectedItem.id] = { id: it.selectedItem.id, qty: 0 };
            additions[it.selectedItem.id].qty += Number(it.qty);
        });

        for (const [id, payload] of Object.entries(additions)) {
            const currentItem = items.find(i => i.id === id);
            if (currentItem) {
                processPromises.push(updateDoc(doc(db, 'items', id), { stockQty: currentItem.stockQty + payload.qty }));
            }
        }
        
        const batchId = Date.now().toString();
        const userId = currentUser?.email?.split('@')[0] || 'مدير النظام';
        for (let it of stockForm.items) {
           processPromises.push(addDoc(collection(db, 'transactions'), {
               item: `${it.selectedItem.name} - ${it.selectedItem.company}`, type: 'Restock', qty: Number(it.qty), date: new Date().toLocaleTimeString('ar-SA'), status: 'مكتمل', loc: stockForm.loc, user: userId, timestamp: serverTimestamp(), batchId
           }));
        }
        await Promise.all(processPromises);

        toast.success(`تم توريد الأصناف للمستودع بنجاح ✅`);
        playSuccess();
        setIsStockInModalOpen(false);
        setStockForm({ loc: stockForm.loc, date: new Date().toISOString().split('T')[0], items: [] });
        setCurrentStockItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
    } catch (err) {
      toast.error("حدث خطأ أثناء حفظ التوريد، يرجى المحاولة مرة أخرى.");
    }
  };

  // --- 3. ADD INVOICE --- //
  const handleAddInvoice = async (e) => {
    e.preventDefault();
    
    if (invoiceForm.items.length === 0) {
      if (currentInvoiceItem.selectedItem && currentInvoiceItem.qty) return toast.error("اضغط Enter لإضافة الصنف المفتوح إلى الفاتورة أولاً.");
      return toast.error("الفاتورة فارغة! الرجاء إضافة الأصناف أولاً.");
    }

    // Validation Loop for Negative Stock Block
    for (let i = 0; i < invoiceForm.items.length; i++) {
        const line = invoiceForm.items[i];
        if (!line.selectedItem) {
            setInvoiceErrors({ [`item-${i}`]: true }); return toast.error(`يرجى تحديد الصنف بدقة في السطر ${i+1}.`);
        }
        if (!line.qty || line.qty <= 0) {
            setInvoiceErrors({ [`qty-${i}`]: true }); return toast.error(`الكمية غير صحيحة في السطر ${i+1}.`);
        }

        const invItem = items.find(inv => inv.id === line.selectedItem.id);
        if (!invItem || Number(line.qty) > invItem.stockQty) {
            setInvoiceErrors({ [`qty-${i}`]: true });
            playWarning();
            return toast.error(`الكمية غير كافية لـ "${line.selectedItem.name}"! الرصيد المتوفر ${invItem?.stockQty || 0} فقط ⛔️`);
        }
    }
    setInvoiceErrors({});

    try {
        const deductions = {};
        invoiceForm.items.forEach(it => {
            if (!deductions[it.selectedItem.id]) deductions[it.selectedItem.id] = { id: it.selectedItem.id, qty: 0, currentStock: 0 };
            deductions[it.selectedItem.id].qty += Number(it.qty);
        });

        const processPromises = [];
        for (const [id, payload] of Object.entries(deductions)) {
            const currentItem = items.find(i => i.id === id);
            if (currentItem) {
                const newStock = currentItem.stockQty - payload.qty;
                if (newStock < 50) playWarning();
                processPromises.push(updateDoc(doc(db, 'items', id), { stockQty: newStock }));
            }
        }
        
        const batchId = Date.now().toString();
        const userId = currentUser?.email?.split('@')[0] || 'مدير النظام';
        for (let it of invoiceForm.items) {
           processPromises.push(addDoc(collection(db, 'transactions'), {
               item: `${it.selectedItem.name} - ${it.selectedItem.company}`, type: 'Issue', qty: Number(it.qty), date: new Date().toLocaleTimeString('ar-SA'), status: 'مكتمل', loc: invoiceForm.rep, user: userId, timestamp: serverTimestamp(), batchId
           }));
        }
        await Promise.all(processPromises);

        toast.success(`تم إصدار فاتورة بنجاح وتحجيم الأرصدة ✅`);
        playSuccess();
        setIsSalesModalOpen(false);
        setInvoiceForm({ rep: invoiceForm.rep, date: new Date().toISOString().split('T')[0], items: [] });
        setCurrentInvoiceItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
    } catch (err) {
        toast.error("حدث خطأ في النظام. قد تحتاج لمراجعة اتصالك.");
    }
  };

  // --- 4. ADD RETURN --- //
  const handleAddReturn = async (e) => {
    e.preventDefault();
    if (!returnForm.selectedItem) { setReturnErrors({ query: true }); return toast.error("حدد الصنف."); }
    if (!returnForm.qty || returnForm.qty <= 0) { setReturnErrors({ qty: true }); return toast.error("كمية خاطئة."); }
    setReturnErrors({});

    try {
        const isGood = returnForm.reason.includes('سليم') || returnForm.reason.includes('خطأ');
        let txStatus = isGood ? 'مكتمل' : 'مرتجع تالف';

        if (isGood) {
            const currentItem = items.find(i => i.id === returnForm.selectedItem.id);
            if (currentItem) {
                await updateDoc(doc(db, 'items', currentItem.id), { stockQty: currentItem.stockQty + Number(returnForm.qty) });
            }
            toast.success(`تم اعتماد مرتجع وإعادته للمخزون ✅`);
        } else {
            toast.info(`تم تسجيل المرتجع كصنف (تالف) ولن يعود للمخزن ⚠️`);
        }

        const userId = currentUser?.email?.split('@')[0] || 'مدير النظام';
        await addDoc(collection(db, 'transactions'), {
             item: returnForm.selectedItem.name, type: 'Return', qty: Number(returnForm.qty), date: new Date().toLocaleTimeString('ar-SA'), status: txStatus, loc: returnForm.rep, user: userId, timestamp: serverTimestamp()
        });

        setIsReturnsModalOpen(false);
        playSuccess();
        setReturnForm({ rep: 'محمد المندوب', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', reason: 'سليم (يعود للمخزون)' });
    } catch (err) {
        toast.error("حدث خطأ أثناء تسجيل المرتجع.");
    }
  };

  // --- Derived Autocomplete State for Add Item --- //
  const uniqueItemNames = [...new Set(items.map(i => i.name))].filter(Boolean);
  const uniqueCompanies = [...new Set(items.map(i => i.company || 'بدون شركة'))].filter(Boolean);
  
  const normalizedInputName = normalizeText(itemForm.name);
  const normalizedInputCompany = normalizeText(itemForm.company || 'بدون شركة');
  
  const isDuplicateMatch = itemForm.name.trim() !== '' && items.some(i => 
    normalizeText(i.name) === normalizedInputName && 
    normalizeText(i.company || 'بدون شركة') === normalizedInputCompany
  );

  const itemSuggestions = itemForm.name ? uniqueItemNames.filter(n => n.includes(itemForm.name)) : [];
  const companySuggestions = itemForm.company ? uniqueCompanies.filter(c => c.includes(itemForm.company)) : [];

  // --- Transactions Chart Processing --- //
  const now = new Date();
  const filteredTxForChart = dbTransactionsList.filter(tx => {
     if (chartDateRange === 'الكل') return true;
     if (!tx.timestamp) return true;
     const txDate = tx.timestamp.toDate ? tx.timestamp.toDate() : new Date();
     if (chartDateRange === 'آخر 7 أيام') {
         const diffTime = Math.abs(now - txDate);
         return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 7;
     }
     if (chartDateRange === 'هذا الشهر') {
         return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
     }
     if (chartDateRange === 'هذا العام') {
         return txDate.getFullYear() === now.getFullYear();
     }
     if (chartDateRange === 'مخصص') {
         if (!chartCustomStartDate || !chartCustomEndDate) return true;
         // Adjust end date to include end of day
         const end = new Date(chartCustomEndDate);
         end.setHours(23, 59, 59, 999);
         return txDate >= new Date(chartCustomStartDate) && txDate <= end;
     }
     return true;
  });

  const enrichedTxs = filteredTxForChart.map(tx => {
     const matchedItem = items.find(i => tx.item.includes(i.name) && (i.company === 'بدون شركة' || tx.item.includes(i.company)));
     return {
       ...tx,
       category: matchedItem ? matchedItem.cat : 'أخرى',
       companyName: matchedItem ? (matchedItem.company || 'بدون شركة') : 'بدون شركة',
       rawItemName: matchedItem ? matchedItem.name : tx.item
     };
  });

  const finalizedTxs = enrichedTxs.filter(tx => {
     if (chartCompanyFilter !== 'الكل' && tx.companyName !== chartCompanyFilter) return false;
     if (chartMode === 'item' && chartItemFilter !== 'الكل' && tx.rawItemName !== chartItemFilter) return false;
     return true;
  });

  const chartTransactions = finalizedTxs.filter(t => t.type === 'Issue').sort((a,b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date();
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date();
      return dateA - dateB; 
  });

  let dynamicSalesData = chartTransactions.map((tx, index) => ({
      index,
      name: tx.rawItemName,
      company: tx.companyName,
      sales: Number(tx.qty),
      date: tx.date || new Date().toLocaleDateString('ar-SA'),
      category: tx.category
  }));

  if (dynamicSalesData.length === 0) dynamicSalesData = [{ index: 0, name: 'لا توجد بيانات', company: '-', sales: 0, date: '-' }];

  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.name === 'لا توجد بيانات') return null;

      return (
        <div className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark p-4 rounded-xl shadow-xl transition-all duration-300 min-w-[200px]" dir="rtl">
          <p className="font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark text-sm mb-3 border-b border-border-light dark:border-border-dark pb-2 truncate">{data.name}</p>
          <div className="space-y-2">
             <div className="flex justify-between items-center text-xs">
               <span className="text-text-secondary-light dark:text-text-secondary-dark font-medium">الشركة:</span> 
               <span className="text-text-primary-light dark:text-text-primary-dark font-bold">{data.company}</span>
             </div>
             <div className="flex justify-between items-center text-xs">
               <span className="text-text-secondary-light dark:text-text-secondary-dark font-medium">الكمية المباعة:</span> 
               <span className="text-status-success font-bold">{data.sales}</span>
             </div>
             <div className="flex justify-between items-center text-xs">
               <span className="text-text-secondary-light dark:text-text-secondary-dark font-medium">تاريخ الحركة:</span> 
               <span className="text-text-primary-light dark:text-text-primary-dark font-bold">{data.date}</span>
             </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- Alerts Processing --- //
  const finalAlerts = items.filter(i => {
     if (alertCatFilter !== 'الكل' && i.cat !== alertCatFilter) return false;
     if (alertSearch && !i.name.includes(alertSearch) && !i.company.includes(alertSearch)) return false;
     if (alertUrgencyFilter === 'حرج' && i.stockQty >= 50) return false;
     if (alertUrgencyFilter === 'تحذير' && (i.stockQty < 50 || i.stockQty >= 100)) return false;
     if (alertUrgencyFilter === 'آمن' && i.stockQty < 100) return false;
     return true;
  }).sort((a,b) => a.stockQty - b.stockQty);

  const generatePDFReport = async () => {
    try {
       const doc = new jsPDF();
       try {
           const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/main/fonts/ttf/amiri-regular.ttf';
           const response = await fetch(fontUrl);
           const buffer = await response.arrayBuffer();
           const base64Font = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
           doc.addFileToVFS('Amiri.ttf', base64Font);
           doc.addFont('Amiri.ttf', 'Amiri', 'normal');
           doc.setFont('Amiri');
       } catch (e) {
           console.warn("Could not load Arabic font, falling back", e);
       }
       
       doc.setFontSize(20);
       doc.text("Baraka Al Thimar PRO - Inventory Report", 105, 15, { align: 'center' });
       doc.setFontSize(12);
       doc.text(`Date: ${new Date().toLocaleDateString('ar-SA')}`, 195, 25, { align: 'right' });
       
       const tableData = finalAlerts.map((i, idx) => [
         idx + 1,
         i.name,
         i.company || '-',
         i.cat,
         `${i.stockQty} (${i.unit || 'كرتونة'})`,
         i.stockQty < 50 ? 'Critical (حرج)' : i.stockQty < 100 ? 'Warning (تحذير)' : 'Safe (آمن)'
       ]);
       
       doc.autoTable({
          startY: 30,
          head: [['#', 'Item Name', 'Company', 'Category', 'Stock Qty', 'Status']],
          body: tableData,
          styles: { font: 'Amiri', halign: 'right' },
          headStyles: { fillColor: [37, 99, 235], halign: 'center' }
       });
       
       doc.save(`Stock_Report_${Date.now()}.pdf`);
       playSuccess();
       toast.success("تم تصدير التقرير بنجاح");
    } catch (err) {
       toast.error("حدث خطأ أثناء التصدير");
    }
  };

  // --- Transactions Processing --- //
  const finalTransactions = dbTransactionsList.filter(tx => {
     if (txFilter === 'الكل') return true;
     return tx.type === txFilter;
  });

  return (
    <div className="h-full w-full flex flex-col gap-4 sm:gap-6 font-readex bg-transparent text-text-primary-light dark:text-text-primary-dark overflow-hidden box-border transition-colors duration-300">
      
      {/* 4 Stat Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 shrink-0">
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 flex flex-col justify-between group hover:border-primary/30 dark:hover:border-accent/30 hover:shadow-xl transition-all duration-500 relative overflow-hidden border border-slate-100 shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-[0.15em]">إجمالي الأصناف</p>
              <h3 className="text-slate-800 font-extrabold text-3xl sm:text-4xl">{items.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-accent-light transition-all group-hover:rotate-12 duration-300 shadow-sm border border-primary/10">
              <Package size={22} />
            </div>
          </div>
          <button onClick={() => setIsItemModalOpen(true)} className="w-full py-2.5 text-xs flex items-center justify-center gap-2 rounded-xl font-bold transition-all bg-[#0F2747] text-white hover:bg-[#15345b] shadow-lg shadow-black/10 hover:shadow-xl relative z-10">
            <Plus size={14} /> 
            <span>إضافة صنف جديد</span>
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 flex flex-col justify-between group hover:border-emerald-400/30 hover:shadow-xl transition-all duration-500 relative overflow-hidden border border-slate-100 shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-[0.15em]">الوارد (الكمية)</p>
              <h3 className="text-slate-800 font-extrabold text-3xl sm:text-4xl">{stockInCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 transition-all group-hover:rotate-12 duration-300 shadow-sm border border-emerald-100">
              <Truck size={22} />
            </div>
          </div>
          <button onClick={() => setIsStockInModalOpen(true)} className="w-full py-2.5 text-xs flex items-center justify-center gap-2 rounded-xl font-bold transition-all bg-[#10B981] text-white hover:bg-[#0ea5e9] shadow-lg shadow-emerald-500/20 hover:shadow-xl relative z-10">
            <Plus size={14} /> 
            <span>توريد بضاعة</span>
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 flex flex-col justify-between group hover:border-amber-400/30 hover:shadow-xl transition-all duration-500 relative overflow-hidden border border-slate-100 shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-[0.15em]">الصادر (الكمية)</p>
              <h3 className="text-slate-800 font-extrabold text-3xl sm:text-4xl">{salesCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 transition-all group-hover:rotate-12 duration-300 shadow-sm border border-amber-100">
              <TrendingUp size={22} />
            </div>
          </div>
          <button onClick={() => setIsSalesModalOpen(true)} className="w-full py-2.5 text-xs flex items-center justify-center gap-2 rounded-xl font-bold transition-all bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20 hover:shadow-xl relative z-10">
            <FileText size={14} /> 
            <span>إصدار فاتورة صادر</span>
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 flex flex-col justify-between group hover:border-rose-400/30 hover:shadow-xl transition-all duration-500 relative overflow-hidden border border-slate-100 shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <p className="text-slate-400 text-[10px] font-bold mb-1 uppercase tracking-[0.15em]">المرتجعات</p>
              <div className="flex items-center gap-2">
                <h3 className="text-slate-800 font-extrabold text-3xl sm:text-4xl">{returnsCount}</h3>
                {damageCount > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded border border-rose-100 uppercase tracking-tighter">تالف: {damageCount}</span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 transition-all group-hover:rotate-12 duration-300 shadow-sm border border-rose-100">
              <RotateCcw size={22} />
            </div>
          </div>
          <button onClick={() => setIsReturnsModalOpen(true)} className="w-full py-2.5 text-xs flex items-center justify-center gap-2 rounded-xl font-bold transition-all bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 hover:shadow-xl relative z-10">
            <Plus size={14} /> 
            <span>تسجيل مرتجع جديد</span>
          </button>
        </motion.div>
      </motion.div>

      {/* Main Grid: 3 Equal Columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-h-0 pb-2">
        
        {/* Card 1: Alerts (Right) */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl p-6 flex flex-col h-full overflow-hidden border border-slate-100 shadow-sm transition-shadow duration-500 hover:shadow-lg">
          
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h3 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark flex items-center gap-3">
              <div className="p-2 bg-status-warning/10 rounded-xl text-status-warning border border-status-warning/20">
                <Bell size={20} className="animate-pulse" />
              </div>
              تنبيهات المخزن
            </h3>
            <button onClick={generatePDFReport} className="btn-outline py-1.5 px-3 text-[10px] flex items-center gap-2 rounded-full border-border-light dark:border-border-dark">
               <Printer size={14} /> 
               <span>تصدير PDF</span>
            </button>
          </div>
          
          {/* Smart Filters Horizontal Row */}
          <div className="flex items-center gap-2 mb-6 shrink-0 overflow-x-auto pb-1 custom-scrollbar w-full">
             <div className="relative flex-1 min-w-[120px]">
               <Search size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-light" />
               <input type="text" placeholder="بحث بالأصناف..." className="w-full bg-slate-100/50 dark:bg-slate-900/40 border border-transparent focus:bg-white dark:focus:bg-slate-900 text-[10px] rounded-full pr-9 pl-3 py-2.5 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all outline-none" value={alertSearch} onChange={e => setAlertSearch(e.target.value)} />
             </div>
             <select className="bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-[10px] font-bold rounded-full px-3 py-2.5 focus:ring-4 focus:ring-primary/5 transition-all outline-none cursor-pointer" value={alertCatFilter} onChange={e => setAlertCatFilter(e.target.value)}>
               <option>التصنيف</option>
               {[...new Set(items.map(i=>i.cat))].map(c => <option key={c}>{c}</option>)}
             </select>
             <select className="bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-[10px] font-bold rounded-full px-3 py-2.5 focus:ring-4 focus:ring-primary/5 transition-all outline-none cursor-pointer" value={alertUrgencyFilter} onChange={e => setAlertUrgencyFilter(e.target.value)}>
               <option>الحالة</option><option>حرج</option><option>تحذير</option><option>آمن</option>
             </select>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative">
             <div className="space-y-2.5">
               {finalAlerts.length === 0 ? (
                  <div className="text-center text-text-muted-light py-16">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-border-light dark:border-border-dark">
                      <CheckCircle2 size={32} className="opacity-20" />
                    </div>
                    <p className="text-xs font-bold opacity-60">لا توجد تنبيهات حالياً</p>
                  </div>
               ) : finalAlerts.map((i, idx) => {
                 let statusStyles = "bg-status-success/5 text-status-success border-status-success/10"; 
                 let iconColor = "text-status-success bg-status-success/10";
                 let icon = <CheckCircle2 size={16} />;
                 if (i.stockQty < 50) {
                    statusStyles = "bg-status-danger/5 text-status-danger border-status-danger/10"; 
                    iconColor = "text-status-danger bg-status-danger/10";
                    icon = <AlertOctagon size={16} />;
                 }
                 else if (i.stockQty < 100) {
                    statusStyles = "bg-status-warning/5 text-status-warning border-status-warning/10"; 
                    iconColor = "text-status-warning bg-status-warning/10";
                    icon = <AlertTriangle size={16} />;
                 }
                 return (
                   <div key={`${i.id}-${idx}`} className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 group/alert hover:bg-white dark:hover:bg-slate-800 hover:shadow-md ${statusStyles}`}>
                     <div className="flex items-center gap-3">
                       <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-black/5 ${iconColor}`}>{icon}</div>
                       <div>
                         <h4 className="font-bold text-xs text-text-primary-light dark:text-text-primary-dark">{i.name}</h4>
                         <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest">{i.company}</p>
                       </div>
                     </div>
                     <div className="bg-white/80 dark:bg-black/20 px-3 py-1.5 rounded-xl text-center shrink-0 border border-black/5 shadow-sm">
                       <span className="font-bold text-sm mr-1 tabular-nums">{i.stockQty}</span>
                       <span className="text-[9px] font-bold opacity-60">{i.unit || 'كرتونة'}</span>
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        </motion.div>

        {/* Card 2: Transactions (Middle) */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl p-6 flex flex-col h-full overflow-hidden border border-slate-100 shadow-sm transition-all duration-500 hover:shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 shrink-0 gap-4">
            <h3 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary dark:text-accent-light border border-primary/20">
                <History size={20} />
              </div>
              آخر الحركات
            </h3>
            <div className="flex bg-slate-100/50 dark:bg-slate-900/40 p-1 rounded-full border border-border-light dark:border-border-dark w-full sm:w-auto">
               {['الكل', 'Restock', 'Issue', 'Return'].map(filter => (
                  <button key={filter} onClick={() => setTxFilter(filter)} className={`px-3 py-1.5 text-[9px] font-bold flex-1 rounded-full transition-all ${txFilter === filter ? 'bg-white dark:bg-slate-700 text-primary dark:text-accent-light shadow-sm' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'}`}>
                    {filter === 'الكل' ? 'الكل' : filter === 'Restock' ? 'وارد' : filter === 'Issue' ? 'صادر' : 'مرتجع'}
                  </button>
               ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pl-1 custom-scrollbar">
             {finalTransactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted-light py-16">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-border-light dark:border-border-dark">
                    <FileText className="opacity-20" size={32} />
                  </div>
                  <p className="text-xs font-bold opacity-60">لم يتم تسجيل حركات</p>
                </div>
             ) : (
                <div className="space-y-2.5">
                  {finalTransactions.slice(0, 50).map((activity, idx) => (
                    <div key={activity.id + idx} onClick={() => {
                        if (activity.batchId) setSelectedBatchTransactions(dbTransactionsList.filter(t => t.batchId === activity.batchId)); 
                        else setSelectedBatchTransactions([activity]); 
                        setIsTransactionDetailOpen(true);
                    }} className="flex items-center justify-between p-3.5 rounded-xl border border-border-light dark:border-border-dark bg-slate-50/30 dark:bg-slate-900/30 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/30 transition-all group/tx shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${activity.type === 'Issue' ? 'bg-status-warning/10 text-status-warning' : activity.type === 'Return' ? 'bg-status-danger/10 text-status-danger' : 'bg-status-success/10 text-status-success'}`}>
                          {activity.type === 'Issue' ? <Truck size={18} /> : activity.type === 'Return' ? <RotateCcw size={18} /> : <Package size={18} />}
                        </div>
                        <div className="overflow-hidden">
                           <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark group-hover/tx:text-primary dark:group-hover/tx:text-accent-light transition-colors truncate max-w-[150px]">{activity.item}</p>
                           <div className="flex items-center gap-2 mt-1">
                             <Clock size={10} className="text-text-muted-light" />
                             <p className="text-[10px] font-medium text-text-secondary-light dark:text-text-secondary-dark truncate max-w-[180px]">{activity.date} • {activity.loc || 'المستودع'}</p>
                           </div>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <p dir="ltr" className={`text-base font-bold tabular-nums ${activity.type === 'Issue' ? 'text-status-warning' : activity.type === 'Return' ? 'text-status-danger' : 'text-status-success'}`}>
                          {activity.type === 'Issue' ? '-' : '+'}{activity.qty}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        </motion.div>

        {/* Card 3: Sales (Left) */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl p-6 flex flex-col h-full overflow-hidden border border-slate-100 shadow-sm transition-all duration-500 hover:shadow-lg">
          <div className="flex flex-col mb-6 shrink-0 gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary dark:text-accent-light border border-primary/20">
                  <TrendingUp size={20} />
                </div>
                إحصائيات المبيعات
              </h3>
              <div className="flex bg-slate-100/50 dark:bg-slate-900/40 p-1 rounded-full border border-border-light dark:border-border-dark">
                 <button onClick={() => setChartMode('category')} className={`px-4 py-1.5 text-[9px] font-bold rounded-full transition-all ${chartMode === 'category' ? 'bg-white dark:bg-slate-700 text-primary dark:text-accent-light shadow-sm' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light'}`}>أقسام</button>
                 <button onClick={() => setChartMode('item')} className={`px-4 py-1.5 text-[9px] font-bold rounded-full transition-all ${chartMode === 'item' ? 'bg-white dark:bg-slate-700 text-primary dark:text-accent-light shadow-sm' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light'}`}>أصناف</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <div className="relative group">
                 <select className="w-full bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-[10px] font-bold rounded-full px-4 py-2.5 transition-all outline-none focus:ring-4 focus:ring-primary/5 cursor-pointer appearance-none" value={chartDateRange} onChange={e => setChartDateRange(e.target.value)}>
                   <option>آخر 7 أيام</option><option>هذا الشهر</option><option>هذا العام</option><option>مخصص</option><option>الكل</option>
                 </select>
                 <ChevronDown size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light pointer-events-none group-hover:text-primary transition-colors" />
               </div>
               <div className="relative group">
                 <select className="w-full bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-[10px] font-bold rounded-full px-4 py-2.5 transition-all outline-none focus:ring-4 focus:ring-primary/5 cursor-pointer appearance-none" value={chartCompanyFilter} onChange={e => setChartCompanyFilter(e.target.value)}>
                   <option>الكل</option>
                   {[...new Set(items.map(i=>i.company||'بدون شركة'))].map(c => <option key={c}>{c}</option>)}
                 </select>
                 <ChevronDown size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light pointer-events-none group-hover:text-primary transition-colors" />
               </div>
               {chartDateRange === 'مخصص' && (
                 <div className="col-span-2 flex gap-2">
                    <input type="date" className="bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-[10px] font-bold rounded-full px-4 py-2.5 flex-1 outline-none focus:ring-4 focus:ring-primary/5" value={chartCustomStartDate} onChange={e => setChartCustomStartDate(e.target.value)} />
                    <input type="date" className="bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-[10px] font-bold rounded-full px-4 py-2.5 flex-1 outline-none focus:ring-4 focus:ring-primary/5" value={chartCustomEndDate} onChange={e => setChartCustomEndDate(e.target.value)} />
                 </div>
               )}
               {chartMode === 'item' && (
                 <div className="col-span-2 relative">
                    <Search size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted-light" />
                    <input type="text" placeholder="البحث عن صنف معين..." className="w-full bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-[10px] font-bold rounded-full pr-10 pl-4 py-2.5 outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white dark:focus:bg-slate-900 transition-all" value={chartItemFilter !== 'الكل' ? chartItemFilter : chartItemSearchQuery} onChange={e => {
                       setChartItemFilter('الكل');
                       setChartItemSearchQuery(e.target.value);
                       setIsChartItemSearchOpen(true);
                    }} onFocus={() => setIsChartItemSearchOpen(true)} onBlur={() => setTimeout(()=>setIsChartItemSearchOpen(false), 200)} />
                    {isChartItemSearchOpen && (
                        <div className="absolute top-[110%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-border-light dark:border-border-dark z-30 p-1.5 mt-2 transition-all">
                           <button onClick={() => { setChartItemFilter('الكل'); setChartItemSearchQuery(''); setIsChartItemSearchOpen(false); }} className="w-full text-right px-4 py-2 text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">عرض الكل</button>
                           {[...new Set(items.map(i=>i.name))].filter(n => n.includes(chartItemSearchQuery)).map(n => (
                               <button key={n} onClick={() => { setChartItemFilter(n); setChartItemSearchQuery(''); setIsChartItemSearchOpen(false); }} className="w-full text-right px-4 py-2 text-[10px] font-bold text-text-primary-light dark:text-text-primary-dark hover:bg-primary/5 dark:hover:bg-primary/20 rounded-xl transition-colors">{n}</button>
                           ))}
                        </div>
                    )}
                 </div>
               )}
            </div>
          </div>
          <div className="flex-1 w-full min-h-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicSalesData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isDarkMode ? '#10B981' : '#0F2747'} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={isDarkMode ? '#10B981' : '#0F2747'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#E2E8F0'} strokeOpacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 9, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 9, fontWeight: 600 }} dx={10} orientation="right" />
                <Tooltip content={<CustomChartTooltip />} />
                <Area type="monotone" dataKey="sales" stroke={isDarkMode ? '#10B981' : '#0F2747'} strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 6, fill: isDarkMode ? '#10B981' : '#0F2747', stroke: isDarkMode ? '#0B1220' : '#fff', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>

      {/* MODALS */}
      {/* 0. Transaction Details */}
      <ModalWrapper title="تفاصيل الحركة المخزنية المجمعة" maxWidth="max-w-4xl" isOpen={isTransactionDetailOpen} onClose={() => setIsTransactionDetailOpen(false)}>
         <div className="card overflow-hidden flex flex-col max-h-[60vh]">
            <div className="bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 border-b border-border-light dark:border-border-dark shrink-0">
              <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">الأصناف المشمولة في هذه العملية ({selectedBatchTransactions.length})</h4>
            </div>
            <div className="overflow-y-auto w-full overflow-x-auto text-sm custom-scrollbar">
              <table className="w-full min-w-max text-right whitespace-nowrap">
                <thead className="bg-white dark:bg-surface-dark sticky top-0 z-10">
                  <tr className="text-xs font-bold text-text-muted-light border-b border-border-light dark:border-border-dark">
                    <th className="px-4 py-3 text-center w-12">#</th>
                    <th className="px-4 py-3 min-w-[200px]">الصنف</th>
                    <th className="px-4 py-3 text-center">نوع الحركة</th>
                    <th className="px-4 py-3 text-center border-r border-border-light dark:border-border-dark">الكمية</th>
                    <th className="px-4 py-3 text-center">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {selectedBatchTransactions.map((tx, idx) => (
                    <tr key={idx} className="bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-text-muted-light text-center">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{tx.item}</td>
                      <td className="px-4 py-3 text-xs font-bold text-center">
                        <span className={`px-2 py-1 rounded-md ${tx.type === 'Issue' ? 'bg-status-warning/10 text-status-warning' : 'bg-status-success/10 text-status-success'}`}>
                          {tx.type === 'Issue' ? 'صادر' : 'وارد'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-center border-r border-border-light dark:border-border-dark ${tx.type === 'Issue' ? 'text-status-warning bg-status-warning/5' : 'text-status-success bg-status-success/5'}`}>
                        {tx.type === 'Issue' ? '-' : '+'}{tx.qty}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark text-center">{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
         </div>
      </ModalWrapper>

      {/* 1. Add Item */}
      <ModalWrapper title="إضافة صنف جديد" isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} onSubmit={handleAddItem} isSubmitDisabled={isDuplicateMatch}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative group/nameItem">
              <label className={LabelClass}>اسم الصنف <span className="text-status-danger">*</span></label>
              <input 
                id="addItemNameInput"
                type="text" 
                className={`${InputClass} ${isDuplicateMatch || itemErrors.name ? 'border-status-danger' : ''}`} 
                placeholder="مثال: فراولة" 
                value={itemForm.name} 
                onChange={(e) => {
                    setItemForm({...itemForm, name: e.target.value});
                    setItemFormSearchActiveIndex(-1);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setItemFormSearchActiveIndex(prev => prev < itemSuggestions.length - 1 ? prev + 1 : prev); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setItemFormSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                    else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (itemFormSearchActiveIndex >= 0 && itemSuggestions[itemFormSearchActiveIndex]) {
                           setItemForm(prev => ({...prev, name: itemSuggestions[itemFormSearchActiveIndex]}));
                        }
                        setItemFormSearchActiveIndex(-1);
                        setTimeout(() => document.getElementById('addItemCompanyInput')?.focus(), 10);
                    }
                }}
              />
              {isDuplicateMatch && (
                <p className="text-status-danger text-[10px] font-bold mt-1.5 flex items-center animate-pulse"><AlertTriangle size={12} className="ml-1" /> هذا الصنف موجود بالفعل بلفظ مشابه، يرجى اختياره من القائمة</p>
              )}
              {itemForm.name && !isDuplicateMatch && itemSuggestions.length > 0 && (
                <div className="hidden group-focus-within/nameItem:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-border-light dark:border-border-dark z-30 p-1 mt-1 transition-colors">
                  {itemSuggestions.map((suggestionName, idx) => (
                     <button 
                       key={idx} 
                       type="button" 
                       className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors ${itemFormSearchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} 
                       onMouseDown={(e) => {
                         e.preventDefault(); 
                         setItemForm(prev => ({...prev, name: suggestionName}));
                         setItemFormSearchActiveIndex(-1);
                         setTimeout(() => document.getElementById('addItemCompanyInput')?.focus(), 10);
                       }}>
                       <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark transition-colors">{suggestionName}</span>
                     </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative group/companyItem">
              <label className={LabelClass}>الشركة الموردة</label>
              <input 
                id="addItemCompanyInput"
                type="text" 
                className={InputClass} 
                placeholder="ماريتا" 
                value={itemForm.company} 
                onChange={(e) => {
                    setItemForm({...itemForm, company: e.target.value});
                    setCompanyFormSearchActiveIndex(-1);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setCompanyFormSearchActiveIndex(prev => prev < companySuggestions.length - 1 ? prev + 1 : prev); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setCompanyFormSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                    else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (companyFormSearchActiveIndex >= 0 && companySuggestions[companyFormSearchActiveIndex]) {
                           setItemForm(prev => ({...prev, company: companySuggestions[companyFormSearchActiveIndex]}));
                        }
                        setCompanyFormSearchActiveIndex(-1);
                        setTimeout(() => document.getElementById('addItemCatInput')?.focus(), 10);
                    }
                }}
              />
              {itemForm.company && companySuggestions.length > 0 && (
                <div className="hidden group-focus-within/companyItem:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-border-light dark:border-border-dark z-30 p-1 mt-1 transition-colors">
                  {companySuggestions.map((suggestionCompany, idx) => (
                     <button 
                       key={idx} 
                       type="button" 
                       className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors ${companyFormSearchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} 
                       onMouseDown={(e) => {
                         e.preventDefault(); 
                         setItemForm(prev => ({...prev, company: suggestionCompany}));
                         setCompanyFormSearchActiveIndex(-1);
                         setTimeout(() => document.getElementById('addItemCatInput')?.focus(), 10);
                       }}>
                       <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark transition-colors">{suggestionCompany}</span>
                     </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={LabelClass}>القسم</label>
              <select id="addItemCatInput" className={InputClass} value={itemForm.cat} onChange={(e) => setItemForm({...itemForm, cat: e.target.value})} onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); setTimeout(() => document.getElementById('addItemUnitInput')?.focus(), 10); }
              }}><option>مجمدات</option><option>تبريد</option><option>بلاستيك</option></select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">وحدة القياس</label>
                <button type="button" onClick={() => { setIsCustomUnit(!isCustomUnit); setItemForm({...itemForm, unit: (!isCustomUnit) ? '' : 'كرتونة'}); }} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-primary dark:text-accent-light px-2 py-1 rounded-lg font-bold hover:bg-primary/10 transition-all flex items-center shadow-sm">
                  {isCustomUnit ? 'العودة' : <><Plus size={10} className="mr-0.5" /> مخصصة</>}
                </button>
              </div>
              {isCustomUnit ? (
                 <input id="addItemUnitInput" type="text" className={InputClass} placeholder="اكتب الوحدة..." value={itemForm.unit} onChange={(e) => setItemForm({...itemForm, unit: e.target.value})} onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); if (!isDuplicateMatch) handleAddItem(e); }
                }} autoFocus required />
              ) : (
                 <select id="addItemUnitInput" className={InputClass} value={itemForm.unit} onChange={(e) => setItemForm({...itemForm, unit: e.target.value})} onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); if (!isDuplicateMatch) handleAddItem(e); }
                }}><option>كرتونة</option></select>
              )}
            </div>
          </div>
      </ModalWrapper>

      {/* 2. Add Stock (Max W 6XL & Add-to-Table) */}
      <ModalWrapper title="إضافة وارد مخزني (تلقيم احترافي)" maxWidth="max-w-6xl" isOpen={isStockInModalOpen} onClose={() => setIsStockInModalOpen(false)} onSubmit={handleAddStock}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div>
                <label className={LabelClass}>جهة الورود</label>
                <div className="flex gap-2">
                   <select className={InputClass} value={stockForm.loc} onChange={(e) => setStockForm({...stockForm, loc: e.target.value})}>
                     {locations.map(l => <option key={l}>{l}</option>)}
                   </select>
                   <button type="button" onClick={() => { const nl = window.prompt("اسم الجهة/المستودع الجديد:"); if (nl && nl.trim()) { setLocations([...locations, nl.trim()]); setStockForm({...stockForm, loc: nl.trim()}); } }} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-primary-light dark:text-text-primary-dark px-4 rounded-xl font-bold transition-colors">+</button>
                </div>
             </div>
             <div><label className={LabelClass}>تاريخ التوريد</label><input type="date" className={InputClass} value={stockForm.date} onChange={(e) => setStockForm({...stockForm, date: e.target.value})} /></div>
          </div>
          
          {/* Top Section (Fixed Entry) */}
          <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-2xl border border-primary/10 mb-6 shadow-sm transition-colors">
             <h4 className="text-sm font-bold text-primary dark:text-accent-light mb-4 transition-colors">إضافة صنف للجدول (اضغط Enter للإدراج)</h4>
             <div className="grid grid-cols-12 gap-4 items-end">
               <div className="col-span-12 md:col-span-5 relative group/item">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">البحث عن الصنف</label>
                 <input type="text" id="stockSearchInput" className={`${InputClass} py-2.5 text-sm bg-white dark:bg-slate-900/50 focus:ring-primary/20`} placeholder="اكتب للبحث..." value={currentStockItem.name} 
                 onChange={(e) => {
                   setCurrentStockItem({...currentStockItem, name: e.target.value, selectedItem: null, cat: '', unit: ''});
                   setSearchActiveIndex(-1);
                 }} 
                 onKeyDown={(e) => {
                   const suggestions = items.filter(i => i.name.includes(currentStockItem.name) || i.company.includes(currentStockItem.name));
                   if (e.key === 'ArrowDown') { e.preventDefault(); setSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); }
                   else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                   else if (e.key === 'Enter') {
                     e.preventDefault(); 
                     if (searchActiveIndex >= 0 && suggestions[searchActiveIndex]) {
                       const invItem = suggestions[searchActiveIndex];
                       setCurrentStockItem({ ...currentStockItem, name: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat, unit: invItem.unit });
                       setSearchActiveIndex(-1);
                       setTimeout(() => { document.getElementById('stockQtyInput').focus(); }, 10);
                     }
                   }
                 }} />
                 {currentStockItem.name && !currentStockItem.selectedItem && (
                   <div className="hidden group-focus-within/item:block absolute top-[110%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-border-light dark:border-border-dark z-30 p-1">
                     {items.filter(i => i.name.includes(currentStockItem.name) || i.company.includes(currentStockItem.name)).map((invItem, idx) => (
                          <button key={invItem.id} type="button" className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors ${searchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onMouseDown={(e) => {
                            e.preventDefault(); 
                            setCurrentStockItem({
                              ...currentStockItem, 
                              name: `${invItem.name} - ${invItem.company}`, 
                              selectedItem: invItem, 
                              cat: invItem.cat, 
                              unit: invItem.unit 
                            }); 
                            setSearchActiveIndex(-1);
                            setTimeout(() => { document.getElementById('stockQtyInput').focus(); }, 10);
                          }}>
                            <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{invItem.name}</span> <span className="text-xs text-text-muted-light">- {invItem.company}</span>
                          </button>
                     ))}
                   </div>
                 )}
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">القسم</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/50 dark:bg-slate-800/50 text-text-muted-light`} value={currentStockItem.cat} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">الوحدة</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/50 dark:bg-slate-800/50 text-text-muted-light`} value={currentStockItem.unit} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-12 md:col-span-3">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">الكمية الموردة</label>
                 <div className="flex gap-2">
                   <input type="number" id="stockQtyInput" className={`${InputClass} py-2.5 text-sm bg-white dark:bg-slate-900/50 focus:ring-primary/20`} placeholder="الرقم" value={currentStockItem.qty} onChange={(e) => setCurrentStockItem({...currentStockItem, qty: e.target.value})} onKeyDown={(e) => { 
                     if (e.key === 'Enter') { 
                       e.preventDefault(); 
                       if (!currentStockItem.selectedItem) return toast.error("حدد الصنف أولاً!");
                       if (!currentStockItem.qty || currentStockItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
                       setStockForm({...stockForm, items: [
                         {...currentStockItem, qty: Number(currentStockItem.qty)},
                         ...stockForm.items
                       ]}); 
                       setCurrentStockItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
                       setTimeout(() => document.getElementById('stockSearchInput').focus(), 50);
                     } 
                   }} />
                   <button type="button" className="btn-primary px-4 flex items-center justify-center transition-colors shadow-sm" onClick={() => {
                       if (!currentStockItem.selectedItem) return toast.error("حدد الصنف أولاً!");
                       if (!currentStockItem.qty || currentStockItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
                       setStockForm({...stockForm, items: [
                         {...currentStockItem, qty: Number(currentStockItem.qty)},
                         ...stockForm.items
                       ]}); 
                       setCurrentStockItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
                       setTimeout(() => document.getElementById('stockSearchInput').focus(), 50);
                   }}><Plus size={18} /></button>
                 </div>
               </div>
             </div>
          </div>

          {/* Middle Section (The Table) */}
          <div className="card overflow-hidden flex flex-col flex-1 min-h-[35vh]">
            <div className="bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 flex items-center justify-between shrink-0 border-b border-border-light dark:border-border-dark transition-colors">
              <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">جدول الأصناف المضافة ({stockForm.items.length})</h4>
            </div>
            <div className="overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full min-w-max text-right text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-surface-dark sticky top-0 z-10 transition-colors">
                  <tr className="text-xs font-bold text-text-muted-light border-b border-border-light dark:border-border-dark">
                    <th className="px-4 py-3 font-bold w-12 text-center">#</th>
                    <th className="px-4 py-3 font-bold min-w-[200px]">اسم الصنف</th>
                    <th className="px-4 py-3 font-bold w-24">القسم</th>
                    <th className="px-4 py-3 font-bold w-24">الوحدة</th>
                    <th className="px-4 py-3 font-bold w-32 border-r border-border-light dark:border-border-dark text-center">الكمية</th>
                    <th className="px-4 py-3 font-bold w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {stockForm.items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-text-muted-light text-xs font-bold transition-colors">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <Package size={32} className="mb-2" />
                          لم يتم إضافة أصناف للجدول بعد
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stockForm.items.map((item, idx) => (
                      <tr key={idx} className="bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-4 py-3 text-xs font-bold text-text-muted-light text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{item.name}</td>
                        <td className="px-4 py-3 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"><span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{item.cat}</span></td>
                        <td className="px-4 py-3 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"><span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{item.unit}</span></td>
                        <td className="px-4 py-3 text-sm font-bold text-status-success border-r border-border-light dark:border-border-dark bg-status-success/5 text-center">+{item.qty}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => { setStockForm({...stockForm, items: stockForm.items.filter((_, i) => i !== idx)}); }} className="p-1.5 text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors opacity-50 group-hover:opacity-100"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </ModalWrapper>

      {/* 3. New Invoice (Max W 6XL & Add-to-Table) */}
      <ModalWrapper title="إنشاء فاتورة صادر (تلقيم احترافي)" maxWidth="max-w-6xl" isOpen={isSalesModalOpen} onClose={() => setIsSalesModalOpen(false)} onSubmit={handleAddInvoice}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div><label className={LabelClass}>جهة العميل / المستلم</label><input type="text" className={InputClass} value={invoiceForm.rep} onChange={(e) => setInvoiceForm({...invoiceForm, rep: e.target.value})} /></div>
             <div><label className={LabelClass}>تاريخ الفاتورة</label><input type="date" className={InputClass} value={invoiceForm.date} onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})} /></div>
          </div>
          
          {/* Top Section (Fixed Entry) */}
          <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-2xl border border-primary/10 mb-6 shadow-sm transition-colors">
             <h4 className="text-sm font-bold text-primary dark:text-accent-light mb-4 transition-colors">إضافة صنف للفاتورة (اضغط Enter للإدراج)</h4>
             <div className="grid grid-cols-12 gap-4 items-end">
               <div className="col-span-12 md:col-span-5 relative group/item">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">البحث عن الصنف</label>
                 <input type="text" id="invoiceSearchInput" className={`${InputClass} py-2.5 text-sm bg-white dark:bg-slate-900/50 focus:ring-primary/20`} placeholder="اكتب للبحث..." value={currentInvoiceItem.name} 
                 onChange={(e) => {
                   setCurrentInvoiceItem({...currentInvoiceItem, name: e.target.value, selectedItem: null, cat: '', unit: ''});
                   setSearchActiveIndex(-1);
                 }} 
                 onKeyDown={(e) => {
                   const suggestions = items.filter(i => i.name.includes(currentInvoiceItem.name) || i.company.includes(currentInvoiceItem.name));
                   if (e.key === 'ArrowDown') { e.preventDefault(); setSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); }
                   else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                   else if (e.key === 'Enter') {
                     e.preventDefault(); 
                     if (searchActiveIndex >= 0 && suggestions[searchActiveIndex]) {
                       const invItem = suggestions[searchActiveIndex];
                       setCurrentInvoiceItem({ ...currentInvoiceItem, name: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat, unit: invItem.unit });
                       setSearchActiveIndex(-1);
                       setTimeout(() => { document.getElementById('invoiceQtyInput').focus(); }, 10);
                     }
                   }
                 }} />
                 {currentInvoiceItem.name && !currentInvoiceItem.selectedItem && (
                   <div className="hidden group-focus-within/item:block absolute top-[110%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-border-light dark:border-border-dark z-30 p-1">
                     {items.filter(i => i.name.includes(currentInvoiceItem.name) || i.company.includes(currentInvoiceItem.name)).map((invItem, idx) => (
                          <button key={invItem.id} type="button" className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors ${searchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onMouseDown={(e) => {
                            e.preventDefault(); 
                            setCurrentInvoiceItem({
                              ...currentInvoiceItem, 
                              name: `${invItem.name} - ${invItem.company}`, 
                              selectedItem: invItem, 
                              cat: invItem.cat, 
                              unit: invItem.unit 
                            }); 
                            setSearchActiveIndex(-1);
                            setTimeout(() => { document.getElementById('invoiceQtyInput').focus(); }, 10);
                          }}>
                            <div className="flex justify-between items-center w-full">
                              <div><span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{invItem.name}</span> <span className="text-xs text-text-muted-light">- {invItem.company}</span></div>
                              <span className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">المتوفر: {invItem.stockQty}</span>
                            </div>
                          </button>
                     ))}
                   </div>
                 )}
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">القسم</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/50 dark:bg-slate-800/50 text-text-muted-light`} value={currentInvoiceItem.cat} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">الوحدة</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/50 dark:bg-slate-800/50 text-text-muted-light`} value={currentInvoiceItem.unit} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-12 md:col-span-3">
                 <label className="block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2">الكمية الصادرة</label>
                 <div className="flex gap-2">
                   <input type="number" id="invoiceQtyInput" className={`${InputClass} py-2.5 text-sm bg-white dark:bg-slate-900/50 focus:ring-primary/20`} placeholder="الرقم" value={currentInvoiceItem.qty} onChange={(e) => setCurrentInvoiceItem({...currentInvoiceItem, qty: e.target.value})} onKeyDown={(e) => { 
                     if (e.key === 'Enter') { 
                       e.preventDefault(); 
                       if (!currentInvoiceItem.selectedItem) return toast.error("حدد الصنف أولاً!");
                       if (!currentInvoiceItem.qty || currentInvoiceItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
                       if (Number(currentInvoiceItem.qty) > currentInvoiceItem.selectedItem.stockQty) return toast.error(`الكمية غير كافية! الرصيد المتوفر ${currentInvoiceItem.selectedItem.stockQty}`);
                       
                       setInvoiceForm({...invoiceForm, items: [
                         {...currentInvoiceItem, qty: Number(currentInvoiceItem.qty)},
                         ...invoiceForm.items
                       ]}); 
                       setCurrentInvoiceItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
                       setTimeout(() => document.getElementById('invoiceSearchInput').focus(), 50);
                     } 
                   }} />
                   <button type="button" className="btn-primary px-4 flex items-center justify-center transition-colors shadow-sm" onClick={() => {
                       if (!currentInvoiceItem.selectedItem) return toast.error("حدد الصنف أولاً!");
                       if (!currentInvoiceItem.qty || currentInvoiceItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
                       if (Number(currentInvoiceItem.qty) > currentInvoiceItem.selectedItem.stockQty) return toast.error(`الكمية غير كافية! الرصيد المتوفر ${currentInvoiceItem.selectedItem.stockQty}`);
                       setInvoiceForm({...invoiceForm, items: [
                         {...currentInvoiceItem, qty: Number(currentInvoiceItem.qty)},
                         ...invoiceForm.items
                       ]}); 
                       setCurrentInvoiceItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
                       setTimeout(() => document.getElementById('invoiceSearchInput').focus(), 50);
                   }}><Plus size={18} /></button>
                 </div>
               </div>
             </div>
          </div>

          {/* Middle Section (The Table) */}
          <div className="card overflow-hidden flex flex-col flex-1 min-h-[35vh]">
            <div className="bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3 flex items-center justify-between shrink-0 border-b border-border-light dark:border-border-dark transition-colors">
              <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">جدول الأصناف الصادرة ({invoiceForm.items.length})</h4>
            </div>
            <div className="overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full min-w-max text-right text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-surface-dark sticky top-0 z-10 transition-colors">
                  <tr className="text-xs font-bold text-text-muted-light border-b border-border-light dark:border-border-dark">
                    <th className="px-4 py-3 font-bold w-12 text-center">#</th>
                    <th className="px-4 py-3 font-bold min-w-[200px]">اسم الصنف</th>
                    <th className="px-4 py-3 font-bold w-24">القسم</th>
                    <th className="px-4 py-3 font-bold w-24">الوحدة</th>
                    <th className="px-4 py-3 font-bold w-32 border-r border-border-light dark:border-border-dark text-center">الكمية</th>
                    <th className="px-4 py-3 font-bold w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {invoiceForm.items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-text-muted-light text-xs font-bold transition-colors">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <Package size={32} className="mb-2" />
                          لم يتم إضافة أصناف للفاتورة بعد
                        </div>
                      </td>
                    </tr>
                  ) : (
                    invoiceForm.items.map((item, idx) => (
                      <tr key={idx} className="bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-4 py-3 text-xs font-bold text-text-muted-light text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{item.name}</td>
                        <td className="px-4 py-3 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"><span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{item.cat}</span></td>
                        <td className="px-4 py-3 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"><span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{item.unit}</span></td>
                        <td className="px-4 py-3 text-sm font-bold text-status-danger border-r border-border-light dark:border-border-dark bg-status-danger/5 text-center">-{item.qty}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => { setInvoiceForm({...invoiceForm, items: invoiceForm.items.filter((_, i) => i !== idx)}); }} className="p-1.5 text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors opacity-50 group-hover:opacity-100"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </ModalWrapper>

      {/* 4. Add Return */}
      <ModalWrapper title="تسجيل مرتجع مخزني" isOpen={isReturnsModalOpen} onClose={() => setIsReturnsModalOpen(false)} onSubmit={handleAddReturn}>
          <div className="space-y-6">
            <div className="relative group/ret">
               <label className={LabelClass}>البحث عن صنف للإرجاع <span className="text-status-danger">*</span></label>
               <div className="relative">
                 <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted-light group-focus-within/ret:text-primary transition-colors" />
                 <input 
                   type="text" 
                   id="returnSearchInput" 
                   className={`${InputClass} pr-11 ${returnErrors.query ? 'border-status-danger' : ''}`} 
                   placeholder="ابحث بالاسم أو الشركة..." 
                   value={returnForm.query} 
                   onChange={(e) => { setReturnForm({...returnForm, query: e.target.value, selectedItem: null, cat: ''}); setSearchActiveIndex(-1); }}
                   onKeyDown={(e) => {
                     const suggestions = items.filter(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query));
                     if (e.key === 'ArrowDown') { e.preventDefault(); setSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); }
                     else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                     else if (e.key === 'Enter') {
                       e.preventDefault();
                       if (searchActiveIndex >= 0 && suggestions[searchActiveIndex]) {
                         const invItem = suggestions[searchActiveIndex];
                         setReturnForm({...returnForm, query: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat});
                         setSearchActiveIndex(-1);
                         setTimeout(() => { document.getElementById('returnQtyInput').focus(); }, 10);
                       }
                     }
                   }} 
                 />
               </div>
               {returnForm.query && !returnForm.selectedItem && (
                 <div className="hidden group-focus-within/ret:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-border-light dark:border-border-dark z-50 p-1 mt-1 transition-colors">
                   {items.filter(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query)).map((invItem, idx) => (
                        <button key={invItem.id} type="button" className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors ${searchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onMouseDown={(e) => {
                            e.preventDefault(); 
                            setReturnForm({...returnForm, query: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat});
                            setSearchActiveIndex(-1);
                            setTimeout(() => { document.getElementById('returnQtyInput').focus(); }, 10);
                        }}>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{invItem.name} <span className="text-xs text-text-muted-light">- {invItem.company}</span></span>
                              <span className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{invItem.cat}</span>
                            </div>
                        </button>
                    ))}
                 </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label className={LabelClass}>الكمية المستردة <span className="text-status-danger">*</span></label>
                 <input type="number" id="returnQtyInput" className={`${InputClass} ${returnErrors.qty ? 'border-status-danger' : ''}`} value={returnForm.qty} onChange={(e) => setReturnForm({...returnForm, qty: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddReturn(e); } }} />
               </div>
               <div>
                 <label className={LabelClass}>القسم المُلقم</label>
                 <input type="text" className={`${InputClass} bg-slate-100/50 dark:bg-slate-800/50 text-text-muted-light cursor-not-allowed`} value={returnForm.cat} placeholder="تلقائي" readOnly />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label className={LabelClass}>الحالة التقنية للمرتجع</label>
                 <select className={InputClass} value={returnForm.reason} onChange={(e) => setReturnForm({...returnForm, reason: e.target.value})}>
                   <option>سليم (يعود للمخزون)</option>
                   <option className="text-status-danger font-bold">تالف (يسجل تالف)</option>
                 </select>
               </div>
               <div>
                 <label className={LabelClass}>تاريخ الإرجاع</label>
                 <input type="date" className={InputClass} value={returnForm.date} onChange={(e) => setReturnForm({...returnForm, date: e.target.value})} />
               </div>
            </div>
          </div>
      </ModalWrapper>

      {/* MORNING BRIEF MODAL */}
      <AnimatePresence>
        {isMorningBriefOpen && morningBriefData.atRiskItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            dir="rtl" onClick={() => setIsMorningBriefOpen(false)}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-card shadow-2xl border border-border-light dark:border-border-dark overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-border-light dark:border-border-dark shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-status-warning/10 flex items-center justify-center text-status-warning shadow-sm">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark">تقرير الصباح — تنبيهات هامة</h3>
                      <p className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsMorningBriefOpen(false)} className="p-2 text-text-muted-light hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Summary Banner */}
              <div className="mx-6 mt-6 p-5 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium opacity-80 uppercase tracking-wider mb-1">أصناف معرضة للخطر</p>
                    <p className="text-3xl font-bold font-tajawal">{morningBriefData.atRiskItems.length} <span className="text-sm font-medium opacity-70">صنف</span></p>
                  </div>
                  <div className="text-left border-r border-white/20 pr-6">
                    <p className="text-xs font-medium opacity-80 uppercase tracking-wider mb-1">إجمالي الكمية المعرضة</p>
                    <p className="text-3xl font-bold font-tajawal">{morningBriefData.totalQty} <span className="text-sm font-medium opacity-70">وحدة</span></p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-6 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {morningBriefData.atRiskItems.slice(0, 15).map((item, idx) => (
                  <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    item.isExpired ? 'bg-status-danger/5 border-status-danger/20'
                    : item.isUrgent ? 'bg-status-danger/5 border-status-danger/20 expiry-blink'
                    : 'bg-status-warning/5 border-status-warning/20'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark flex items-center justify-center shrink-0 shadow-sm transition-colors">
                        {item.cat === 'مجمدات' ? <Package size={16} className="text-primary dark:text-accent-light" /> : <Package size={16} className="text-text-muted-light" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark truncate">{item.name}</p>
                        <p className="text-[10px] font-medium text-text-secondary-light dark:text-text-secondary-dark truncate uppercase tracking-wider">{item.company} • {item.cat}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-border-light dark:border-border-dark shadow-sm">{item.totalQtyAtRisk} وحدة</span>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-bold ${
                        item.isExpired ? 'bg-status-danger text-white shadow-sm'
                        : item.isUrgent ? 'bg-status-danger/10 text-status-danger'
                        : 'bg-status-warning/10 text-status-warning'
                      }`}>
                        <Clock size={12} />
                        {item.isExpired ? 'منتهي' : `${item.daysLeft} يوم`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
                <p className="text-[10px] text-text-muted-light font-medium uppercase tracking-widest">⚠️ مراجعة المخزون ضرورية</p>
                <button onClick={() => setIsMorningBriefOpen(false)} className="btn-accent px-6 py-2.5 shadow-lg shadow-accent/20">
                  تم الاطلاع والمتابعة
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
