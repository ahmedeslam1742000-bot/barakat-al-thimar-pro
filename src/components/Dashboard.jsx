import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, TrendingUp, Truck, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Plus, X, FileText, RotateCcw, Search, Trash2, Bell, Clock, CheckCircle2, AlertOctagon, Printer,
  Timer, Snowflake, Thermometer, ShieldAlert
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-colors duration-500" 
        dir="rtl" onClick={onClose} 
      >
        <motion.div 
          onClick={(e) => e.stopPropagation()} 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden transition-colors duration-500`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0 transition-colors duration-500">
            <h3 className="text-xl font-black text-slate-800 dark:text-white transition-colors duration-500">{title}</h3>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white rounded-full transition-colors">
              <X size={20} className="stroke-[3]" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 overflow-y-auto custom-scrollbar flex-1 relative">{children}</div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex space-x-3 space-x-reverse justify-end shrink-0 transition-colors duration-500">
                  <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
                  <button type="submit" disabled={isSubmitDisabled} className={`px-8 py-2.5 rounded-xl font-bold text-white transition-all ${isSubmitDisabled ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700 shadow-[0_4px_14px_rgba(37,99,235,0.3)] dark:shadow-[0_4px_14px_rgba(37,99,235,0.2)]'}`}>حفظ واعتماد</button>
              </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const InputClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl focus:ring-4 focus:ring-blue-500/15 dark:focus:ring-blue-500/30 focus:border-blue-600 dark:focus:border-blue-500 block px-4 py-3 outline-none transition-all";
const LabelClass = "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 transition-colors duration-500";

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
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-xl font-bold text-slate-500">Loading Firebase...</div>;
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
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 dark:border-slate-800 text-right min-w-[200px]" dir="rtl">
          <p className="font-black text-slate-800 dark:text-slate-100 text-sm mb-3 border-b border-slate-100 dark:border-slate-800 pb-2 truncate">{data.name}</p>
          <div className="space-y-2">
             <p className="text-[10px] font-bold text-slate-500 flex justify-between"><span>الشركة:</span> <span className="text-slate-800 dark:text-slate-200">{data.company}</span></p>
             <p className="text-[10px] font-bold text-slate-500 flex justify-between"><span>الكمية المباعة:</span> <span className="text-emerald-600 dark:text-emerald-400 font-black">{data.sales}</span></p>
             <p className="text-[10px] font-bold text-slate-500 flex justify-between"><span>تاريخ الحركة:</span> <span className="text-slate-700 dark:text-slate-300">{data.date}</span></p>
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
    <div className="h-screen w-full flex flex-col space-y-4 font-['Cairo'] p-4 sm:p-6 bg-transparent text-slate-800 dark:text-slate-100 overflow-hidden box-border transition-colors duration-500">
      
      {/* 4 Stat Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <motion.div variants={itemVariants} className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between overflow-hidden transition-colors duration-500">
          <div className="flex justify-between items-start mb-3">
            <div><p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">إجمالي الأصناف</p><h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white transition-colors">{items.length}</h3></div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white"><Package size={20} /></div>
          </div>
          <button onClick={() => setIsItemModalOpen(true)} className="w-full py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center border border-slate-100 dark:border-slate-700 transition-colors"><Plus size={16} className="ml-1" /> إضافة صنف</button>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between overflow-hidden transition-colors duration-500">
          <div className="flex justify-between items-start mb-3">
            <div><p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">الوارد</p><h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white transition-colors">{stockInCount}</h3></div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white"><Truck size={20} /></div>
          </div>
          <button onClick={() => setIsStockInModalOpen(true)} className="w-full py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center border border-slate-100 dark:border-slate-700 transition-colors"><Plus size={16} className="ml-1" /> إضافة وارد</button>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between overflow-hidden transition-colors duration-500">
          <div className="flex justify-between items-start mb-3">
            <div><p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">الصادر</p><h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white transition-colors">{salesCount}</h3></div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white"><TrendingUp size={20} /></div>
          </div>
          <button onClick={() => setIsSalesModalOpen(true)} className="w-full py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center border border-slate-100 dark:border-slate-700 transition-colors"><FileText size={16} className="ml-1" /> فاتورة جديدة</button>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between overflow-hidden transition-colors duration-500">
          <div className="flex justify-between items-start mb-3">
            <div>
               <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">المرتجعات</p>
               <div className="flex space-x-2 space-x-reverse"><h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white transition-colors">{returnsCount}</h3>{damageCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 dark:bg-rose-500/10 text-red-600 dark:text-rose-400 rounded-md">تالف: {damageCount}</span>}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white"><RotateCcw size={20} /></div>
          </div>
          <button onClick={() => setIsReturnsModalOpen(true)} className="w-full py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-red-600 dark:text-rose-400 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center border border-slate-100 dark:border-slate-700 transition-colors"><Plus size={16} className="ml-1" /> تسجيل مرتجع</button>
        </motion.div>
      </motion.div>

      {/* Main Grid: 3 Equal Columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-h-0 mb-4">
        
        {/* Card 1: Alerts (Right) */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-4 sm:p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col min-h-[400px] max-h-[500px] lg:max-h-full overflow-hidden transition-colors duration-500">
          
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center transition-colors"><Bell size={18} className="ml-2 text-amber-500 animate-pulse" /> تنبيهات المخزن</h3>
            <button onClick={generatePDFReport} className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors flex items-center space-x-2 space-x-reverse text-xs font-bold border border-blue-100 dark:border-blue-500/20 shadow-sm">
               <Printer size={16} /> <span>تصدير</span>
            </button>
          </div>
          
          {/* Smart Filters Horizontal Row */}
          <div className="flex items-center space-x-2 space-x-reverse mb-4 shrink-0 overflow-x-auto pb-1 custom-scrollbar w-full">
             <input type="text" placeholder="بحث..." className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg px-3 py-1.5 flex-1 min-w-[70px] focus:outline-none focus:border-blue-500 transition-colors" value={alertSearch} onChange={e => setAlertSearch(e.target.value)} />
             <select className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer" value={alertCatFilter} onChange={e => setAlertCatFilter(e.target.value)}>
               <option>الكل</option>
               {[...new Set(items.map(i=>i.cat))].map(c => <option key={c}>{c}</option>)}
             </select>
             <select className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer" value={alertUrgencyFilter} onChange={e => setAlertUrgencyFilter(e.target.value)}>
               <option>الكل</option><option>حرج</option><option>تحذير</option><option>آمن</option>
             </select>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative">
             <div className="space-y-2">
               {finalAlerts.length === 0 ? (
                  <div className="text-center text-slate-400 dark:text-slate-500 text-xs font-bold mt-10 transition-colors">لا توجد تنبيهات تطابق الفلتر</div>
               ) : finalAlerts.map((i, idx) => {
                 let cardColor = "bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0] dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"; 
                 let icon = <CheckCircle2 size={16} className="opacity-80" />;
                 if (i.stockQty < 50) {
                    cardColor = "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 animate-pulse shadow-sm"; 
                    icon = <AlertOctagon size={16} className="opacity-80" />;
                 }
                 else if (i.stockQty < 100) {
                    cardColor = "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"; 
                    icon = <AlertTriangle size={16} className="opacity-80" />;
                 }
                 return (
                   <div key={`${i.id}-${idx}`} className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${cardColor}`}>
                     <div className="flex items-center space-x-3 space-x-reverse">
                       <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0">{icon}</div>
                       <div>
                         <h4 className="font-black text-xs sm:text-sm">{i.name}</h4>
                         <p className="text-[9px] sm:text-[10px] font-bold opacity-70">{i.company}</p>
                       </div>
                     </div>
                     <div className="bg-white/50 dark:bg-black/20 px-3 py-1 rounded-lg text-center shrink-0 border border-white/20 dark:border-black/10 shadow-sm">
                       <span className="font-black text-sm sm:text-base mr-1">{i.stockQty}</span>
                       <span className="text-[9px] sm:text-[10px] font-bold opacity-80">{i.unit || 'كرتونة'}</span>
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        </motion.div>

        {/* Card 2: Transactions (Middle) */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-4 sm:p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col min-h-[400px] max-h-[500px] lg:max-h-full transition-colors duration-500">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 shrink-0 gap-2">
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white transition-colors">آخر الحركات</h3>
            <div className="flex bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-700/60 space-x-1 space-x-reverse transition-colors">
               {['الكل', 'Restock', 'Issue', 'Return'].map(filter => (
                  <button key={filter} onClick={() => setTxFilter(filter)} className={`px-2 py-1 text-[10px] font-bold flex-1 rounded-lg transition-colors ${txFilter === filter ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    {filter === 'الكل' ? 'الكل' : filter === 'Restock' ? 'وارد' : filter === 'Issue' ? 'صادر' : 'مرتجع'}
                  </button>
               ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pl-1 custom-scrollbar">
             {finalTransactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 transition-colors">
                  <FileText className="opacity-20 mb-2" size={32} /><p className="text-sm font-bold">لم يتم تسجيل حركات</p>
                </div>
             ) : (
                <div className="space-y-2">
                  {finalTransactions.slice(0, 50).map((activity, idx) => (
                    <div key={activity.id + idx} onClick={() => {
                        if (activity.batchId) setSelectedBatchTransactions(dbTransactionsList.filter(t => t.batchId === activity.batchId)); 
                        else setSelectedBatchTransactions([activity]); 
                        setIsTransactionDetailOpen(true);
                    }} className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-50 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-900/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group/tx">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${activity.type === 'Issue' ? 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400' : activity.type === 'Return' ? 'bg-gradient-to-br from-red-100 to-red-200 dark:from-rose-500/20 dark:to-rose-500/10 text-red-600 dark:text-rose-400' : 'bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                          {activity.type === 'Issue' ? <Truck size={14} /> : activity.type === 'Return' ? <RotateCcw size={14} /> : <Package size={14} />}
                        </div>
                        <div className="overflow-hidden">
                           <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover/tx:text-blue-600 dark:group-hover/tx:text-blue-400 transition-colors truncate max-w-[120px]">{activity.item}</p>
                           <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[150px] transition-colors">{activity.date} | {activity.loc || 'مستودع'} | بواسطة: {activity.user || 'المدير'}</p>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <p dir="ltr" className={`text-sm font-black text-right transition-colors ${activity.type === 'Issue' ? 'text-amber-500 dark:text-amber-400' : activity.type === 'Return' ? 'text-red-500 dark:text-rose-500' : 'text-emerald-500 dark:text-emerald-400'}`}>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-4 sm:p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col min-h-[400px] max-h-[500px] lg:max-h-full transition-colors duration-500">
          <div className="flex flex-col mb-4 shrink-0 gap-3">
            <div className="flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white transition-colors">إحصائيات المبيعات</h3>
              <div className="flex bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-700/60 space-x-1 space-x-reverse transition-colors">
                 <button onClick={() => setChartMode('category')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${chartMode === 'category' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>أقسام</button>
                 <button onClick={() => setChartMode('item')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${chartMode === 'item' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>أصناف</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
               <select className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-xl px-2 py-1.5 transition-colors focus:outline-none focus:border-blue-500" value={chartDateRange} onChange={e => setChartDateRange(e.target.value)}>
                 <option>آخر 7 أيام</option><option>هذا الشهر</option><option>هذا العام</option><option>مخصص</option><option>الكل</option>
               </select>
               <select className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-xl px-2 py-1.5 transition-colors focus:outline-none focus:border-blue-500" value={chartCompanyFilter} onChange={e => setChartCompanyFilter(e.target.value)}>
                 <option>الكل</option>
                 {[...new Set(items.map(i=>i.company||'بدون شركة'))].map(c => <option key={c}>{c}</option>)}
               </select>
               {chartDateRange === 'مخصص' && (
                 <div className="col-span-2 flex space-x-2 space-x-reverse">
                    <input type="date" className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-xl px-2 py-1.5 flex-1 transition-colors focus:outline-none focus:border-blue-500" value={chartCustomStartDate} onChange={e => setChartCustomStartDate(e.target.value)} />
                    <input type="date" className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-xl px-2 py-1.5 flex-1 transition-colors focus:outline-none focus:border-blue-500" value={chartCustomEndDate} onChange={e => setChartCustomEndDate(e.target.value)} />
                 </div>
               )}
               {chartMode === 'item' && (
                 <div className="col-span-2 relative">
                    <input type="text" placeholder="البحث عن صنف..." className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-xl px-2 py-1.5 w-full transition-colors focus:outline-none focus:border-blue-500" value={chartItemFilter !== 'الكل' ? chartItemFilter : chartItemSearchQuery} onChange={e => {
                       setChartItemFilter('الكل');
                       setChartItemSearchQuery(e.target.value);
                       setIsChartItemSearchOpen(true);
                    }} onFocus={() => setIsChartItemSearchOpen(true)} onBlur={() => setTimeout(()=>setIsChartItemSearchOpen(false), 200)} />
                    {isChartItemSearchOpen && (
                        <div className="absolute top-[100%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 p-1 mt-1 transition-colors">
                           <button onClick={() => { setChartItemFilter('الكل'); setChartItemSearchQuery(''); setIsChartItemSearchOpen(false); }} className="w-full text-right px-2 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">الكل</button>
                           {[...new Set(items.map(i=>i.name))].filter(n => n.includes(chartItemSearchQuery)).map(n => (
                               <button key={n} onClick={() => { setChartItemFilter(n); setChartItemSearchQuery(''); setIsChartItemSearchOpen(false); }} className="w-full text-right px-2 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors">{n}</button>
                           ))}
                        </div>
                    )}
                 </div>
               )}
            </div>
          </div>
          <div className="flex-1 w-full min-h-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicSalesData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f8fafc'} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#cbd5e1' : '#94a3b8', fontSize: 9 }} dy={10} reversed={false} minTickGap={30} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#cbd5e1' : '#94a3b8', fontSize: 10 }} dx={10} orientation="right" />
                <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 6, fill: '#3b82f6', stroke: isDarkMode ? '#1e293b' : '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>

      {/* MODALS */}
      {/* 0. Transaction Details */}
      <ModalWrapper title="تفاصيل الحركة المخزنية المجمعة" maxWidth="max-w-4xl" isOpen={isTransactionDetailOpen} onClose={() => setIsTransactionDetailOpen(false)}>
         <div className="border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden flex flex-col max-h-[60vh] transition-colors duration-500">
            <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 transition-colors">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 transition-colors">الأصناف المشمولة في هذه العملية ({selectedBatchTransactions.length})</h4>
            </div>
            <div className="p-0 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto w-full overflow-x-auto text-sm custom-scrollbar transition-colors">
              <table className="w-full text-right">
                <thead className="bg-white dark:bg-slate-800 sticky top-0 shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-10 transition-colors">
                  <tr className="text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-4 py-3 text-center w-12">#</th>
                    <th className="px-4 py-3 min-w-[200px]">الصنف</th>
                    <th className="px-4 py-3 text-center">نوع الحركة</th>
                    <th className="px-4 py-3 text-center border-r border-slate-50 dark:border-slate-700">الكمية</th>
                    <th className="px-4 py-3 text-center">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {selectedBatchTransactions.map((tx, idx) => (
                    <tr key={idx} className="bg-white dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-200">{tx.item}</td>
                      <td className="px-4 py-3 text-xs font-bold text-center"><span className={`px-2 py-1 rounded-md transition-colors ${tx.type === 'Issue' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>{tx.type === 'Issue' ? 'صادر' : 'وارد'}</span></td>
                      <td className={`px-4 py-3 text-sm font-black text-center border-r border-slate-50 dark:border-slate-700/50 transition-colors ${tx.type === 'Issue' ? 'text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-500/10' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10'}`}>{tx.type === 'Issue' ? '-' : '+'}{tx.qty}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500 text-center">{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
         </div>
      </ModalWrapper>

      {/* 1. Add Item */}
      <ModalWrapper title="إضافة صنف جديد" isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} onSubmit={handleAddItem} isSubmitDisabled={isDuplicateMatch}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group/nameItem">
              <label className={LabelClass}>اسم الصنف <span className="text-red-500">*</span></label>
              <input 
                id="addItemNameInput"
                type="text" 
                className={`${InputClass} ${isDuplicateMatch || itemErrors.name ? 'border-red-400' : ''}`} 
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
                <p className="text-red-600 text-[10px] font-bold mt-1.5 flex items-center animate-pulse"><AlertTriangle size={12} className="ml-1" /> هذا الصنف موجود بالفعل بلفظ مشابه، يرجى اختياره من القائمة</p>
              )}
              {itemForm.name && !isDuplicateMatch && itemSuggestions.length > 0 && (
                <div className="hidden group-focus-within/nameItem:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700/60 z-30 p-1 mt-1 transition-colors">
                  {itemSuggestions.map((suggestionName, idx) => (
                     <button 
                       key={idx} 
                       type="button" 
                       className={`w-full text-right px-3 py-2.5 border-b border-slate-50 dark:border-slate-700/60 last:border-0 transition-colors ${itemFormSearchActiveIndex === idx ? 'bg-blue-100 dark:bg-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} 
                       onMouseDown={(e) => {
                         e.preventDefault(); 
                         setItemForm(prev => ({...prev, name: suggestionName}));
                         setItemFormSearchActiveIndex(-1);
                         setTimeout(() => document.getElementById('addItemCompanyInput')?.focus(), 10);
                       }}>
                       <span className="text-sm font-black text-slate-700 dark:text-slate-200 transition-colors">{suggestionName}</span>
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
                <div className="hidden group-focus-within/companyItem:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700/60 z-30 p-1 mt-1 transition-colors">
                  {companySuggestions.map((suggestionCompany, idx) => (
                     <button 
                       key={idx} 
                       type="button" 
                       className={`w-full text-right px-3 py-2.5 border-b border-slate-50 dark:border-slate-700/60 last:border-0 transition-colors ${companyFormSearchActiveIndex === idx ? 'bg-blue-100 dark:bg-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} 
                       onMouseDown={(e) => {
                         e.preventDefault(); 
                         setItemForm(prev => ({...prev, company: suggestionCompany}));
                         setCompanyFormSearchActiveIndex(-1);
                         setTimeout(() => document.getElementById('addItemCatInput')?.focus(), 10);
                       }}>
                       <span className="text-sm font-black text-slate-700 dark:text-slate-200 transition-colors">{suggestionCompany}</span>
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
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">وحدة القياس</label>
                <button type="button" onClick={() => { setIsCustomUnit(!isCustomUnit); setItemForm({...itemForm, unit: (!isCustomUnit) ? '' : 'كرتونة'}); }} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center shadow-sm">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div>
                <label className={LabelClass}>جهة الورود</label>
                <div className="flex space-x-2 space-x-reverse">
                   <select className={InputClass} value={stockForm.loc} onChange={(e) => setStockForm({...stockForm, loc: e.target.value})}>
                     {locations.map(l => <option key={l}>{l}</option>)}
                   </select>
                   <button type="button" onClick={() => { const nl = window.prompt("اسم الجهة/المستودع الجديد:"); if (nl && nl.trim()) { setLocations([...locations, nl.trim()]); setStockForm({...stockForm, loc: nl.trim()}); } }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 rounded-xl font-bold flex items-center shrink-0">+</button>
                </div>
             </div>
             <div><label className={LabelClass}>تاريخ التوريد</label><input type="date" className={InputClass} value={stockForm.date} onChange={(e) => setStockForm({...stockForm, date: e.target.value})} /></div>
          </div>
          
          {/* Top Section (Fixed Entry) */}
          <div className="bg-blue-50/50 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/20 mb-4 shadow-sm transition-colors">
             <h4 className="text-sm font-black text-blue-800 dark:text-blue-300 mb-3 transition-colors">إضافة صنف للجدول (اضغط Enter للإدراج)</h4>
             <div className="grid grid-cols-12 gap-3 items-end">
               <div className="col-span-12 md:col-span-5 relative group/item">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">البحث عن الصنف</label>
                 <input type="text" id="stockSearchInput" className={`${InputClass} py-2.5 text-sm bg-white focus:ring-blue-500/20 shadow-inner`} placeholder="اكتب للبحث..." value={currentStockItem.name} 
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
                   <div className="hidden group-focus-within/item:block absolute top-[110%] right-0 w-full max-h-48 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-100 z-30 p-1">
                     {items.filter(i => i.name.includes(currentStockItem.name) || i.company.includes(currentStockItem.name)).map((invItem, idx) => (
                          <button key={invItem.id} type="button" className={`w-full text-right px-3 py-2.5 border-b border-slate-50 last:border-0 transition-colors ${searchActiveIndex === idx ? 'bg-blue-100' : 'hover:bg-slate-50'}`} onMouseDown={(e) => {
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
                            <span className="text-sm font-black text-slate-700">{invItem.name}</span> <span className="text-xs font-bold text-slate-400">- {invItem.company}</span>
                          </button>
                     ))}
                     {items.filter(i => i.name.includes(currentStockItem.name) || i.company.includes(currentStockItem.name)).length === 0 && (
                       <div className="px-3 py-2 text-xs font-bold text-red-500 text-center">لا توجد نتائج مطابقة</div>
                     )}
                   </div>
                 )}
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">القسم</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/80 text-slate-500`} value={currentStockItem.cat} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">الوحدة</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/80 text-slate-500`} value={currentStockItem.unit} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-12 md:col-span-3">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">الكمية الموردة</label>
                 <div className="flex space-x-2 space-x-reverse">
                   <input type="number" id="stockQtyInput" className={`${InputClass} py-2.5 text-sm bg-white focus:ring-blue-500/20 shadow-inner`} placeholder="الرقم" value={currentStockItem.qty} onChange={(e) => setCurrentStockItem({...currentStockItem, qty: e.target.value})} onKeyDown={(e) => { 
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
                   <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl font-bold flex items-center justify-center transition-colors shadow-sm" onClick={() => {
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
          <div className="border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[35vh] transition-colors duration-500">
            <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-200 dark:border-slate-700/60 transition-colors">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 transition-colors">جدول الأصناف المضافة ({stockForm.items.length})</h4>
            </div>
            <div className="p-0 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar transition-colors">
              <table className="w-full text-right text-sm">
                <thead className="bg-white dark:bg-slate-800 sticky top-0 shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-10 transition-colors">
                  <tr className="text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-4 py-3 font-bold w-12 text-center">#</th>
                    <th className="px-4 py-3 font-bold min-w-[200px]">اسم الصنف</th>
                    <th className="px-4 py-3 font-bold w-24">القسم</th>
                    <th className="px-4 py-3 font-bold w-24">الوحدة</th>
                    <th className="px-4 py-3 font-bold w-32 border-r border-slate-50 dark:border-slate-700">الكمية</th>
                    <th className="px-4 py-3 font-bold w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {stockForm.items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-bold transition-colors">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <Package size={32} className="mb-2" />
                          لم يتم إضافة أصناف للجدول بعد
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stockForm.items.map((item, idx) => (
                      <tr key={idx} className="bg-white dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors group">
                        <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-200">{item.name}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md transition-colors">{item.cat}</span></td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md transition-colors">{item.unit}</span></td>
                        <td className="px-4 py-3 text-sm font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-50 dark:border-slate-700/50 bg-emerald-50/30 dark:bg-emerald-500/10 transition-colors">+{item.qty}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => { setStockForm({...stockForm, items: stockForm.items.filter((_, i) => i !== idx)}); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-rose-500/20 rounded-lg transition-colors opacity-50 group-hover:opacity-100"><Trash2 size={16} /></button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div><label className={LabelClass}>جهة العميل / المستلم</label><input type="text" className={InputClass} value={invoiceForm.rep} onChange={(e) => setInvoiceForm({...invoiceForm, rep: e.target.value})} /></div>
             <div><label className={LabelClass}>تاريخ الفاتورة</label><input type="date" className={InputClass} value={invoiceForm.date} onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})} /></div>
          </div>
          
          {/* Top Section (Fixed Entry) */}
          <div className="bg-blue-50/50 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/20 mb-4 shadow-sm transition-colors">
             <h4 className="text-sm font-black text-blue-800 dark:text-blue-300 mb-3 transition-colors">إضافة صنف للفاتورة (اضغط Enter للإدراج)</h4>
             <div className="grid grid-cols-12 gap-3 items-end">
               <div className="col-span-12 md:col-span-5 relative group/item">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">البحث عن الصنف</label>
                 <input type="text" id="invoiceSearchInput" className={`${InputClass} py-2.5 text-sm bg-white focus:ring-blue-500/20 shadow-inner`} placeholder="اكتب للبحث..." value={currentInvoiceItem.name} 
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
                   <div className="hidden group-focus-within/item:block absolute top-[110%] right-0 w-full max-h-48 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-100 z-30 p-1">
                     {items.filter(i => i.name.includes(currentInvoiceItem.name) || i.company.includes(currentInvoiceItem.name)).map((invItem, idx) => (
                          <button key={invItem.id} type="button" className={`w-full text-right px-3 py-2.5 border-b border-slate-50 last:border-0 transition-colors ${searchActiveIndex === idx ? 'bg-blue-100' : 'hover:bg-slate-50'}`} onMouseDown={(e) => {
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
                              <div><span className="text-sm font-black text-slate-700">{invItem.name}</span> <span className="text-xs font-bold text-slate-400">- {invItem.company}</span></div>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">المتوفر: {invItem.stockQty}</span>
                            </div>
                          </button>
                     ))}
                     {items.filter(i => i.name.includes(currentInvoiceItem.name) || i.company.includes(currentInvoiceItem.name)).length === 0 && (
                       <div className="px-3 py-2 text-xs font-bold text-red-500 text-center">لا توجد نتائج مطابقة</div>
                     )}
                   </div>
                 )}
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">القسم</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/80 text-slate-500`} value={currentInvoiceItem.cat} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-6 md:col-span-2">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">الوحدة</label>
                 <input type="text" className={`${InputClass} py-2.5 text-sm bg-slate-100/80 text-slate-500`} value={currentInvoiceItem.unit} readOnly placeholder="تلقائي" />
               </div>
               <div className="col-span-12 md:col-span-3">
                 <label className="block text-xs font-bold text-slate-600 mb-1.5">الكمية الصادرة</label>
                 <div className="flex space-x-2 space-x-reverse">
                   <input type="number" id="invoiceQtyInput" className={`${InputClass} py-2.5 text-sm bg-white focus:ring-blue-500/20 shadow-inner`} placeholder="الرقم" value={currentInvoiceItem.qty} onChange={(e) => setCurrentInvoiceItem({...currentInvoiceItem, qty: e.target.value})} onKeyDown={(e) => { 
                     if (e.key === 'Enter') { 
                       e.preventDefault(); 
                       if (!currentInvoiceItem.selectedItem) return toast.error("حدد الصنف أولاً!");
                       if (!currentInvoiceItem.qty || currentInvoiceItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
                       // Check Stock locally before adding to table
                       if (Number(currentInvoiceItem.qty) > currentInvoiceItem.selectedItem.stockQty) return toast.error(`الكمية غير كافية! الرصيد المتوفر ${currentInvoiceItem.selectedItem.stockQty}`);
                       
                       setInvoiceForm({...invoiceForm, items: [
                         {...currentInvoiceItem, qty: Number(currentInvoiceItem.qty)},
                         ...invoiceForm.items
                       ]}); 
                       setCurrentInvoiceItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
                       setTimeout(() => document.getElementById('invoiceSearchInput').focus(), 50);
                     } 
                   }} />
                   <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl font-bold flex items-center justify-center transition-colors shadow-sm" onClick={() => {
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
          <div className="border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[35vh] transition-colors duration-500">
            <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-200 dark:border-slate-700/60 transition-colors">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 transition-colors">جدول الأصناف الصادرة ({invoiceForm.items.length})</h4>
            </div>
            <div className="p-0 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar transition-colors">
              <table className="w-full text-right text-sm">
                <thead className="bg-white dark:bg-slate-800 sticky top-0 shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-10 transition-colors">
                  <tr className="text-xs font-bold text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-4 py-3 font-bold w-12 text-center">#</th>
                    <th className="px-4 py-3 font-bold min-w-[200px]">اسم الصنف</th>
                    <th className="px-4 py-3 font-bold w-24">القسم</th>
                    <th className="px-4 py-3 font-bold w-24">الوحدة</th>
                    <th className="px-4 py-3 font-bold w-32 border-r border-slate-50 dark:border-slate-700">الكمية</th>
                    <th className="px-4 py-3 font-bold w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {invoiceForm.items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-bold transition-colors">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <Package size={32} className="mb-2" />
                          لم يتم إضافة أصناف للفاتورة بعد
                        </div>
                      </td>
                    </tr>
                  ) : (
                    invoiceForm.items.map((item, idx) => (
                      <tr key={idx} className="bg-white dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors group">
                        <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-200">{item.name}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md transition-colors">{item.cat}</span></td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-500"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md transition-colors">{item.unit}</span></td>
                        <td className="px-4 py-3 text-sm font-black text-red-600 dark:text-rose-400 border-r border-slate-50 dark:border-slate-700/50 bg-red-50/30 dark:bg-rose-500/10 transition-colors">-{item.qty}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => { setInvoiceForm({...invoiceForm, items: invoiceForm.items.filter((_, i) => i !== idx)}); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-rose-500/20 rounded-lg transition-colors opacity-50 group-hover:opacity-100"><Trash2 size={16} /></button>
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
      <ModalWrapper title="تسجيل مرتجع" isOpen={isReturnsModalOpen} onClose={() => setIsReturnsModalOpen(false)} onSubmit={handleAddReturn}>
          <div className="block mb-4 relative group/ret">
             <label className={LabelClass}>البحث عن صنف للإرجاع</label>
             <input type="text" id="returnSearchInput" className={`${InputClass} w-full ${returnErrors.query ? 'border-red-400' : ''}`} placeholder="ابحث لتلقيم القسم والبيانات..." value={returnForm.query} 
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
             }} />
             {returnForm.query && !returnForm.selectedItem && (
               <div className="hidden group-focus-within/ret:block absolute top-[110%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700/60 z-20 p-1 transition-colors">
                 {items.filter(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query)).map((invItem, idx) => (
                      <button key={invItem.id} type="button" className={`w-full text-right px-3 py-3 border-b border-slate-50 dark:border-slate-700/60 transition-colors ${searchActiveIndex === idx ? 'bg-blue-100 dark:bg-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`} onMouseDown={(e) => {
                          e.preventDefault(); 
                          setReturnForm({...returnForm, query: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat});
                          setSearchActiveIndex(-1);
                          setTimeout(() => { document.getElementById('returnQtyInput').focus(); }, 10);
                      }}>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors">{invItem.name} <span className="text-slate-400 dark:text-slate-500">- {invItem.company}</span></span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md mr-2 transition-colors">{invItem.cat}</span>
                      </button>
                  ))}
               </div>
             )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
             <div>
               <label className={LabelClass}>الكمية المستردة</label>
               <input type="number" id="returnQtyInput" className={`${InputClass} ${returnErrors.qty ? 'border-red-400' : ''}`} value={returnForm.qty} onChange={(e) => setReturnForm({...returnForm, qty: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); {document.getElementById('returnSubmitBtn')?.click() || handleAddReturn(e)} } }} />
             </div>
             <div><label className={LabelClass}>القسم المُلقم</label><input type="text" className={`${InputClass} bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400`} value={returnForm.cat} placeholder="تلقائي" readOnly /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div><label className={LabelClass}>الحالة التقنية للمرتجع</label><select className={InputClass} value={returnForm.reason} onChange={(e) => setReturnForm({...returnForm, reason: e.target.value})}><option>سليم (يعود للمخزون)</option><option className="text-red-600 font-bold">تالف (يسجل تالف)</option></select></div>
             <div><label className={LabelClass}>تاريخ الإرجاع</label><input type="date" className={InputClass} value={returnForm.date} onChange={(e) => setReturnForm({...returnForm, date: e.target.value})} /></div>
          </div>
      </ModalWrapper>

      {/* MORNING BRIEF MODAL */}
      <AnimatePresence>
        {isMorningBriefOpen && morningBriefData.atRiskItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
            dir="rtl" onClick={() => setIsMorningBriefOpen(false)}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-l from-amber-50 via-orange-50/50 to-rose-50/30 dark:from-amber-900/20 dark:via-orange-900/10 dark:to-rose-900/5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                      <ShieldAlert size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">تقرير الصباح — متطلب تدخل</h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsMorningBriefOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Summary Banner */}
              <div className="mx-5 mt-4 p-4 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold opacity-90">أصناف تقترب صلاحيتها</p>
                    <p className="text-3xl font-black">{morningBriefData.atRiskItems.length} <span className="text-base font-bold opacity-80">صنف</span></p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold opacity-90">إجمالي الكمية المعرضة</p>
                    <p className="text-3xl font-black">{morningBriefData.totalQty} <span className="text-base font-bold opacity-80">وحدة</span></p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-5 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {morningBriefData.atRiskItems.slice(0, 15).map((item, idx) => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    item.isExpired ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
                    : item.isUrgent ? 'bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20 expiry-blink'
                    : 'bg-orange-50/50 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20'
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-white/60 dark:bg-slate-800/60 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                        {item.cat === 'مجمدات' ? <Snowflake size={13} className="text-cyan-500" /> : item.cat === 'تبريد' ? <Thermometer size={13} className="text-blue-500" /> : <Package size={13} className="text-slate-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 dark:text-white truncate">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{item.company} • {item.cat}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">{item.totalQtyAtRisk} وحدة</span>
                      <span className={`inline-flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded-md font-black ${
                        item.isExpired ? 'bg-rose-200 dark:bg-rose-500/30 text-rose-800 dark:text-rose-300'
                        : item.isUrgent ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                        : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                      }`}>
                        <Timer size={8} />
                        {item.isExpired ? '⛔ منتهي' : `${item.daysLeft}ي`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-bold">⚠️ راجع الصلاحيات وخطط للتصريف السريع</p>
                <button onClick={() => setIsMorningBriefOpen(false)} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95">
                  تم الاطلاع ✅
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
