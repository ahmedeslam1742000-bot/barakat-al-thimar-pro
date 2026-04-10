import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, Truck, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Plus, X, FileText, RotateCcw, Search, Trash2, Bell, Clock, CheckCircle2, AlertOctagon,
  Timer, History, ChevronDown, Layers, FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio } from '../contexts/AudioContext';

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

// --- Premium Stat Card with Action Button ---
const StatCard = ({ icon: Icon, label, value, subtext, actionLabel, onClick, accentColor = '#10B981' }) => (
  <motion.div
    whileHover={{ y: -4, transition: { duration: 0.25 } }}
    className="relative rounded-[20px] overflow-hidden cursor-pointer group bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100/80"
    onClick={onClick}
  >
    <div className="p-6 pb-3 flex items-center gap-5">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
        style={{ backgroundColor: accentColor + '18', color: accentColor }}
      >
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-slate-500 font-readex mb-1">{label}</span>
        <span className="text-[32px] font-bold text-[#0F2747] font-tajawal leading-none tracking-tight">{value}</span>
        {subtext && <span className="text-[11px] text-slate-400 font-readex mt-1.5">{subtext}</span>}
      </div>
    </div>
    {/* Action Button */}
    {actionLabel && (
      <div className="px-6 pb-5">
        <div
          className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold font-tajawal transition-all duration-200 hover:brightness-95"
          style={{ backgroundColor: accentColor + '12', color: accentColor }}
        >
          <Plus size={14} strokeWidth={2.5} />
          {actionLabel}
        </div>
      </div>
    )}
    <div
      className="absolute -top-6 -left-6 w-20 h-20 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500"
      style={{ backgroundColor: accentColor }}
    />
  </motion.div>
);

/* ─── Quick Access Card ─── */
function QuickAccessCard({ items }) {
  const [qaSearch, setQaSearch] = useState('');
  const threshold = 100;

  const filtered = items
    .filter(i => !qaSearch || i.name.includes(qaSearch) || i.company?.includes(qaSearch))
    .sort((a, b) => b.stockQty - a.stockQty)
    .slice(0, 5);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Pill search */}
      <div className="px-5 py-3 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            placeholder="ابحث عن صنف..."
            className="w-full bg-[#F9FAFB] border-0 text-[11px] rounded-full pr-10 pl-4 py-2.5 outline-none font-readex placeholder:text-slate-300"
            value={qaSearch}
            onChange={e => setQaSearch(e.target.value)}
          />
        </div>
      </div>
      {/* Items list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Package size={36} strokeWidth={1.2} className="mb-3" />
            <p className="text-xs font-semibold">لا توجد أصناف</p>
          </div>
        ) : filtered.map((item) => {
          const stockPct = Math.min((item.stockQty / (threshold * 2)) * 100, 100);
          const isLow = item.stockQty < 50;
          const isMid = item.stockQty >= 50 && item.stockQty < threshold;
          const barColor = isLow ? '#EF4444' : isMid ? '#F59E0B' : '#10B981';
          return (
            <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 text-slate-400">
                <Layers size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[12px] font-bold text-[#0F2747] font-tajawal truncate">{item.name}</h4>
                  <span className="text-xs font-bold tabular-nums shrink-0 mr-2" style={{ color: barColor }}>{item.stockQty}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stockPct}%`, backgroundColor: barColor }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-2xl", isSubmitDisabled = false }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0F2747]/60 backdrop-blur-md transition-all duration-300"
        dir="rtl" onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 24 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={`w-full ${maxWidth} bg-white rounded-[24px] shadow-2xl border border-slate-100/60 flex flex-col max-h-[92vh] overflow-hidden`}
        >
          <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
            <h3 className="text-2xl font-bold text-[#0F2747] font-tajawal tracking-tight">{title}</h3>
            <button type="button" onClick={onClose} className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all active:scale-90">
              <X size={22} />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-8 py-6 overflow-y-auto custom-scrollbar flex-1 relative">{children}</div>
              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
                  <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-white transition-all font-readex">إلغاء</button>
                  <button type="submit" disabled={isSubmitDisabled} className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-[#10B981] hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-tajawal">حفظ واعتماد</button>
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

  // ---  RENAMED STATE VARIABLES TO FORCIBLY BYPASS VITE HMR --- //
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

  // Voucher Status Tracking State
  const [voucherTransactions, setVoucherTransactions] = useState([]);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } } };

  // Card entry animations
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { type: 'spring', stiffness: 200, damping: 18 } 
    }
  };

  // ---  LIVE FIREBASE CONNECTIVITY --- //
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

  // Fetch voucher status (outbound non-invoiced transactions)
  useEffect(() => {
    if (!db || dbTransactionsList.length === 0) return;

    const outboundTx = dbTransactionsList.filter(tx => 
      tx.type === 'Issue' && !tx.invoiced
    ).map(tx => {
      // Find matching item to get client/rep info
      const matchedItem = items.find(i => tx.item.includes(i.name));
      return {
        ...tx,
        clientName: tx.loc || 'غير محدد',
        itemName: tx.item,
        quantity: Number(tx.qty || 0),
        timestamp: tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date(),
        batchId: tx.batchId
      };
    });

    setVoucherTransactions(outboundTx);
  }, [dbTransactionsList, items]);

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

  // --- 5. MARK VOUCHER AS INVOICED --- //
  const handleMarkAsInvoiced = async () => {
    if (!selectedVoucher) return;
    
    try {
      // Find the original transaction in dbTransactionsList
      const originalTx = dbTransactionsList.find(tx => tx.id === selectedVoucher.id);

      if (originalTx) {
        // Update the transaction in Firestore
        const txRef = doc(db, 'transactions', originalTx.id);
        await updateDoc(txRef, { invoiced: true });

        // Update local state - mark as invoiced and move to bottom
        setVoucherTransactions(prev => 
          prev.map(v => v.id === selectedVoucher.id ? { ...v, invoiced: true } : v)
        );

        toast.success(`تم تحديد السند #${selectedVoucher.id.slice(-6)} كفوترة بنجاح ✅`);
        playSuccess();
        setIsVoucherModalOpen(false);
        setSelectedVoucher(null);
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء تحديث حالة السند");
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
               <span className="text-text-primary-light dark:text-text-primary-dark font-semibold">{data.company}</span>
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

  // --- Transactions Processing --- //
  const finalTransactions = dbTransactionsList.filter(tx => {
     if (txFilter === 'الكل') return true;
     return tx.type === txFilter;
  });

  return (
    <div className="flex-1 min-h-0 h-full w-full flex flex-col gap-5 font-readex bg-transparent text-text-primary-light dark:text-text-primary-dark overflow-hidden box-border transition-colors duration-300">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[26px] font-bold text-[#0F2747] font-tajawal leading-tight">لوحة القيادة</h1>
          <p className="text-[13px] text-slate-400 font-readex mt-1">نظرة عامة على المخزون والحركات</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-readex">
          <Clock size={14} />
          <span>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 shrink-0">
        <StatCard icon={Package} label="إجمالي الأصناف" value={items.length} subtext="صنف مسجل" actionLabel="إضافة صنف" onClick={() => setIsItemModalOpen(true)} accentColor="#10B981" />
        <StatCard icon={Truck} label="الوارد" value={stockInCount} subtext="وحدة مُورّدة" actionLabel="إضافة وارد" onClick={() => setIsStockInModalOpen(true)} accentColor="#3B82F6" />
        <StatCard icon={TrendingUp} label="الصادر" value={salesCount} subtext="وحدة مُباعة" actionLabel="فاتورة جديدة" onClick={() => setIsSalesModalOpen(true)} accentColor="#F59E0B" />
        <StatCard icon={RotateCcw} label={damageCount > 0 ? `المرتجعات (${damageCount} تالف)` : "المرتجعات"} value={returnsCount} subtext="وحدة مُرتجعة" actionLabel="تسجيل مرتجع" onClick={() => setIsReturnsModalOpen(true)} accentColor="#EF4444" />
      </div>

      {/* ── Bottom 2-Card Row ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0 overflow-hidden">

        {/* ─── RIGHT: Recent Movements ─── */}
        <motion.div
          variants={cardVariants}
          className="flex flex-col bg-white rounded-[24px] border border-slate-100/80 shadow-sm overflow-hidden"
        >
          {/* Header: title right-aligned, filters on same line */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                <History size={15} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-[#0F2747] font-tajawal leading-tight">آخر الحركات</h3>
                <p className="text-[10px] text-slate-400 font-readex font-medium">{finalTransactions.length}</p>
              </div>
            </div>
            {/* Segmented Picker - Compact on same line */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {[
                { key: 'الكل', icon: <FileText size={12} strokeWidth={2} /> },
                { key: 'Restock', icon: <ArrowDownRight size={12} strokeWidth={2} /> },
                { key: 'Issue', icon: <ArrowUpRight size={12} strokeWidth={2} /> },
                { key: 'Return', icon: <RotateCcw size={12} strokeWidth={2} /> }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setTxFilter(f.key)}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    txFilter === f.key
                      ? 'bg-white shadow-sm text-[#0F2747]'
                      : 'text-slate-400 hover:text-slate-500'
                  }`}
                >
                  {f.icon}
                </button>
              ))}
            </div>
          </div>
          {/* List with compact rows and descriptions */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
            {finalTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300"><FileText size={36} strokeWidth={1.2} className="mb-3" /><p className="text-xs font-semibold">لم يتم تسجيل حركات</p></div>
            ) : (
              <div className="space-y-1">
                {finalTransactions.slice(0, 50).map((tx) => {
                  const txType = tx.type === 'Issue' ? 'صادر' : tx.type === 'Return' ? 'مرتجع' : 'وارد';
                  const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date();
                  const formattedDate = txDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' });
                  const formattedTime = txDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <motion.div
                      key={tx.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => { setSelectedBatchTransactions(tx.batchId ? dbTransactionsList.filter(t => t.batchId === tx.batchId) : [tx]); setIsTransactionDetailOpen(true); }}
                      whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.8)' }}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-transparent cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.type === 'Issue' ? 'bg-amber-50 text-amber-500' : tx.type === 'Return' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                          {tx.type === 'Issue' ? <ArrowUpRight size={13} /> : tx.type === 'Return' ? <RotateCcw size={13} /> : <ArrowDownRight size={13} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-[#0F2747] font-tajawal truncate group-hover:text-emerald-600 transition-colors">{tx.item}</p>
                          <p className="text-[10px] text-slate-400 font-readex mt-0.5">{txType} - {formattedDate} - {formattedTime}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold tabular-nums shrink-0 ${tx.type === 'Issue' ? 'text-amber-500' : tx.type === 'Return' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {tx.type === 'Issue' ? '-' : '+'}{tx.qty}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── LEFT: Voucher Status Tracking (Converted from Alerts) ─── */}
        <motion.div
          variants={cardVariants}
          className="flex flex-col bg-white rounded-[24px] border border-slate-100/80 shadow-sm overflow-hidden"
        >
          {/* Header: title right-aligned, no search bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                <FileCheck size={15} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-[#0F2747] font-tajawal leading-tight">حالة السندات</h3>
                <p className="text-[10px] text-slate-400 font-readex font-medium">{voucherTransactions.filter(v => !v.invoiced).length} قيد الانتظار</p>
              </div>
            </div>
          </div>
          {/* Voucher List with checkboxes and sorting */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
            {voucherTransactions.filter(v => !v.invoiced).length === 0 && voucherTransactions.filter(v => v.invoiced).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <FileCheck size={36} strokeWidth={1.2} className="mb-3" />
                <p className="text-xs font-semibold">لا توجد سندات</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Un-invoiced vouchers at top (newest first) */}
                <AnimatePresence>
                  {voucherTransactions
                    .filter(v => !v.invoiced)
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 15)
                    .map((voucher) => (
                      <motion.div
                        key={voucher.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, transition: { duration: 0.3 } }}
                        transition={{ duration: 0.3, layout: { duration: 0.3 } }}
                        className="p-2.5 rounded-lg border border-slate-100 bg-white group cursor-pointer hover:bg-slate-50"
                      >
                        <div className="flex items-start gap-2">
                          {/* Checkbox */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVoucher(voucher);
                              setIsVoucherModalOpen(true);
                            }}
                            className="shrink-0 mt-1 w-5 h-5 rounded border-2 border-slate-300 hover:border-emerald-500 flex items-center justify-center transition-all hover:bg-emerald-50"
                          >
                            <CheckCircle2 size={14} className="text-emerald-500 opacity-0" />
                          </button>
                          <div className="min-w-0 flex-1">
                            {/* Title: Type - Item Name */}
                            <h4 className="text-[11px] font-bold text-[#0F2747] font-tajawal truncate">
                              صادر - {voucher.itemName}
                            </h4>
                            {/* Description: Customer/Source - Date - Time */}
                            <p className="text-[10px] text-slate-400 font-readex mt-0.5">
                              {voucher.clientName} - {voucher.timestamp.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })} - {voucher.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                {voucher.quantity} وحدة
                              </span>
                              <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                #{voucher.id.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  }
                </AnimatePresence>
                
                {/* Invoiced vouchers at bottom (green status) */}
                {voucherTransactions.filter(v => v.invoiced).length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-3 mb-2">
                      <div className="h-px flex-1 bg-slate-200"></div>
                      <span className="text-[10px] font-medium text-slate-400 font-readex">السندات المفوترة</span>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    <AnimatePresence>
                      {voucherTransactions
                        .filter(v => v.invoiced)
                        .slice(0, 10)
                        .map((voucher) => (
                          <motion.div
                            key={voucher.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30 group opacity-75"
                          >
                            <div className="flex items-start gap-2">
                              {/* Green checkbox */}
                              <div className="shrink-0 mt-1 w-5 h-5 rounded bg-emerald-500 flex items-center justify-center">
                                <CheckCircle2 size={14} className="text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-[11px] font-bold text-[#0F2747] font-tajawal truncate">
                                  صادر - {voucher.itemName}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-readex mt-0.5">
                                  {voucher.clientName} - {voucher.timestamp.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })} - {voucher.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                    {voucher.quantity} وحدة
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      }
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}
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
                      <td className="px-4 py-3 text-center">
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

      {/* 0.5 Voucher Confirmation Modal */}
      <AnimatePresence>
        {isVoucherModalOpen && selectedVoucher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0F2747]/60 backdrop-blur-md transition-all duration-300"
            dir="rtl"
            onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-md bg-white rounded-[24px] shadow-2xl border border-slate-100/60 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-[#0F2747] font-tajawal tracking-tight">تأكيد الفوترة</h3>
                <button
                  type="button"
                  onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }}
                  className="p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all active:scale-90"
                >
                  <X size={22} />
                </button>
              </div>
              
              {/* Body */}
              <div className="px-8 py-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <FileText size={22} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[#0F2747] font-tajawal">صادر - {selectedVoucher.itemName}</h4>
                    <p className="text-xs text-slate-400 font-readex mt-0.5">
                      {selectedVoucher.clientName} - {selectedVoucher.timestamp.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                  <span className="text-xs text-slate-500 font-readex">الكمية:</span>
                  <span className="text-sm font-bold text-amber-600">{selectedVoucher.quantity} وحدة</span>
                </div>
                <p className="text-sm text-slate-600 font-tajawal mt-4 text-center">هل تمت الفوترة؟</p>
              </div>
              
              {/* Footer Buttons */}
              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-white transition-all font-readex"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleMarkAsInvoiced}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all font-tajawal"
                >
                  نعم، تمت الفوترة
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0F2747]/40 backdrop-blur-sm"
            dir="rtl" onClick={() => setIsMorningBriefOpen(false)}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }} transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="w-full max-w-lg bg-white rounded-[24px] shadow-2xl border border-slate-100/60 overflow-hidden flex flex-col max-h-[88vh]"
            >
              {/* Header */}
              <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500"><AlertTriangle size={20} /></div>
                  <div><h3 className="text-base font-bold text-[#0F2747] font-tajawal">تقرير الصباح</h3><p className="text-[11px] text-slate-400 font-readex">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                </div>
                <button onClick={() => setIsMorningBriefOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"><X size={18} /></button>
              </div>
              {/* Summary Banner */}
              <div className="mx-7 mt-5 p-5 rounded-2xl bg-gradient-to-r from-[#0F2747] to-[#15345b] text-white flex items-center justify-between shrink-0">
                <div><p className="text-[11px] opacity-70 mb-1 font-readex">أصناف معرضة</p><p className="text-2xl font-bold font-tajawal">{morningBriefData.atRiskItems.length}</p></div>
                <div className="text-left border-r border-white/20 pr-6"><p className="text-[11px] opacity-70 mb-1 font-readex">إجمالي الكمية</p><p className="text-2xl font-bold font-tajawal">{morningBriefData.totalQty} وحدة</p></div>
              </div>
              {/* Items List */}
              <div className="px-7 py-4 space-y-2 overflow-y-auto custom-scrollbar flex-1">
                {morningBriefData.atRiskItems.slice(0, 12).map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${item.isExpired || item.isUrgent ? 'bg-red-50/60 border-red-100/60' : 'bg-amber-50/60 border-amber-100/60'}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm"><Layers size={15} className="text-[#0F2747]" /></div>
                      <div className="min-w-0"><p className="text-[13px] font-bold text-[#0F2747] font-tajawal truncate">{item.name}</p><p className="text-[10px] text-slate-400 font-readex">{item.company} • {item.cat}</p></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold bg-white border border-slate-100 px-2.5 py-1 rounded-lg shadow-sm tabular-nums">{item.totalQtyAtRisk}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 font-readex ${item.isExpired ? 'bg-red-500 text-white' : item.isUrgent ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}><Clock size={11} />{item.isExpired ? 'منتهي' : `${item.daysLeft} يوم`}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div className="px-7 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-readex">مراجعة المخزون ضرورية</p>
                <button onClick={() => setIsMorningBriefOpen(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#10B981] hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all font-tajawal">تم — متابعة</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voucher Confirmation Modal */}
      <AnimatePresence>
        {isVoucherModalOpen && selectedVoucher && (
          <motion.div
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0F2747]/50 backdrop-blur-md"
            dir="rtl" 
            onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 24 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }} 
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-[24px] shadow-2xl border border-slate-100/60 overflow-hidden"
            >
              {/* Header */}
              <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FileCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0F2747] font-tajawal">تأكيد الفوترة</h3>
                    <p className="text-[11px] text-slate-400 font-readex">تحويل السند إلى فاتورة</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }} 
                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Content */}
              <div className="px-7 py-6">
                <p className="text-sm text-slate-600 font-readex mb-4">
                  هل أنت متأكد من تحويل السند التالي إلى حالة "تمت الفوترة"؟
                </p>
                
                {/* Voucher Details Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-readex">العميل:</span>
                    <span className="text-sm font-bold text-[#0F2747] font-tajawal">{selectedVoucher.clientName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-readex">رقم السند:</span>
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200">#{selectedVoucher.id.slice(-6)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-readex">الكمية:</span>
                    <span className="text-sm font-bold text-amber-600">{selectedVoucher.quantity} وحدة</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-readex">التاريخ:</span>
                    <span className="text-xs text-slate-700">{selectedVoucher.timestamp.toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
                <button 
                  onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-white transition-all font-readex"
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => handleMarkAsInvoiced(selectedVoucher)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all font-tajawal"
                >
                  تأكيد الفوترة ✓
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
