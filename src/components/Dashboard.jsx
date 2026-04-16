import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, Truck, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Plus, X, FileText, RotateCcw, Search, Trash2, Bell, Clock, CheckCircle2, AlertOctagon,
  Timer, History, ChevronDown, Layers, FileCheck, FileInput, Download, Upload, FileOutput
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio } from '../contexts/AudioContext';

import { supabase } from '../lib/supabaseClient';

// Utility Imports
import { normalizeArabic, checkNearDuplicates } from '../lib/arabicTextUtils';
import { useDebounce } from '../hooks/useDebounce';

const salesData = [
  { name: 'يناير', sales: 0 }, { name: 'فبراير', sales: 0 },
  { name: 'مارس', sales: 0 }, { name: 'أبريل', sales: 0 },
  { name: 'مايو', sales: 0 }, { name: 'يونيو', sales: 0 },
  { name: 'يوليو', sales: 0 },
];

const FUNCTIONAL_INBOUND_TYPE = 'سند إدخال';
const FUNCTIONAL_OUTBOUND_TYPE = 'سند إخراج';
const FUNCTIONAL_VOUCHER_TYPES = [FUNCTIONAL_INBOUND_TYPE, FUNCTIONAL_OUTBOUND_TYPE];

// Simple Levenshtein distance for fuzzy matching
const levenshteinDistanceSimple = (str1, str2) => {
  if (!str1 || !str2) return Math.max(str1?.length || 0, str2?.length || 0);
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
    }
  }
  return matrix[str2.length][str1.length];
};

// --- Premium Stat Card with Action Button ---
const StatCard = React.memo(({ icon: Icon, label, value, subtext, actionLabel, onClick, accentColor = '#10B981' }) => (
  <motion.div
    whileHover={{ y: -4, transition: { duration: 0.25 } }}
    className="relative rounded-[20px] overflow-hidden cursor-pointer group bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100/80 hover-stable no-select-click"
    onClick={onClick}
    style={{
      willChange: 'transform',
      backfaceVisibility: 'hidden',
      transform: 'translate3d(0, 0, 0)',
    }}
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
));

const voucherCardTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1], layout: { duration: 0.2 } };

const VoucherStatusCard = React.memo(function VoucherStatusCard({
  voucher,
  isCompleted = false,
  isActive = false,
  onOpen,
}) {
  const vDate = voucher.timestamp;
  const dayName = vDate.toLocaleDateString('ar-SA', { weekday: 'long' });
  const dateStr = vDate.toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' });
  const title = `${voucher.kind === 'in' ? 'سند إدخال' : 'سند إخراج'} - ${voucher.clientName}`;

  const handleOpen = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isCompleted) onOpen(voucher);
  }, [isCompleted, onOpen, voucher]);

  return (
    <motion.div
      key={voucher.id}
      layout
      initial={{ opacity: 0, height: 0, scale: 0.985 }}
      animate={{ opacity: isCompleted ? 0.82 : 1, height: 'auto', scale: 1 }}
      exit={{ opacity: 0, height: 0, scale: 0.985 }}
      transition={voucherCardTransition}
      whileHover={isCompleted ? undefined : { scale: 1.01, y: -1 }}
      whileTap={isCompleted ? undefined : { scale: 0.995 }}
      onClick={handleOpen}
      className={`overflow-hidden rounded-lg border p-2.5 group hover-stable no-select-click ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 bg-white cursor-pointer hover:shadow-sm'} ${isActive ? 'ring-2 ring-emerald-200 shadow-sm' : ''}`}
      style={{
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        transform: 'translate3d(0, 0, 0)',
        WebkitFontSmoothing: 'antialiased',
        pointerEvents: 'auto',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="flex items-start gap-2">
        <div
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="shrink-0 mt-0.5"
        >
          <input
            type="checkbox"
            checked={isCompleted}
            readOnly
            onClick={handleOpen}
            className={`w-4 h-4 rounded border-2 ${isCompleted ? 'border-emerald-500 accent-emerald-500 cursor-default' : 'border-slate-300 hover:border-emerald-500 cursor-pointer accent-emerald-500'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[11px] font-bold text-[#0F2747] font-tajawal leading-tight truncate">
            {title}
          </h4>
          <p className="text-[10px] text-slate-400 font-readex mt-0.5 truncate">
            {dayName} - {dateStr}
          </p>
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => (
  prevProps.isCompleted === nextProps.isCompleted &&
  prevProps.isActive === nextProps.isActive &&
  prevProps.voucher.id === nextProps.voucher.id &&
  prevProps.voucher.invoiced === nextProps.voucher.invoiced &&
  prevProps.voucher.clientName === nextProps.voucher.clientName &&
  prevProps.voucher.timestamp?.getTime?.() === nextProps.voucher.timestamp?.getTime?.()
));

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

const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-2xl", isSubmitDisabled = false, compact = false }) => (
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
          <div className={`flex items-center justify-between border-b border-slate-100 shrink-0 ${compact ? 'px-6 py-3' : 'px-8 py-6'}`}>
            <h3 className={`font-bold text-[#0F2747] font-tajawal tracking-tight ${compact ? 'text-lg' : 'text-2xl'}`}>{title}</h3>
            <button type="button" onClick={onClose} className={`text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all active:scale-90 ${compact ? 'p-1.5' : 'p-2.5'}`}>
              <X size={compact ? 18 : 22} />
            </button>
          </div>
          <form onSubmit={onSubmit} noValidate className="flex-1 flex flex-col overflow-hidden">
              <div className={`${compact ? 'px-6 py-3' : 'px-8 py-6'} overflow-y-auto custom-scrollbar flex-1 relative`}>{children}</div>
              <div className={`${compact ? 'px-6 py-3' : 'px-8 py-5'} border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0`}>
                  <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-white transition-all font-readex">إلغاء</button>
                  <button type="submit" disabled={isSubmitDisabled} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-[#10B981] hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-tajawal">حفظ واعتماد</button>
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
  // ⚠️ ALL STATE DECLARATIONS MUST BE AT THE TOP (React Rules of Hooks)
  // Centered confirmation prompt state (MUST BE FIRST)
  const [showNewItemPrompt, setShowNewItemPrompt] = useState(false);
  const [promptItemName, setPromptItemName] = useState('');
  const [promptSource, setPromptSource] = useState('stockIn');
  const newItemRegistrationRef = useRef(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [isReturnsModalOpen, setIsReturnsModalOpen] = useState(false);
  const [sourceVoucher, setSourceVoucher] = useState(null); // Track voucher being invoiced

  // ---  RENAMED STATE VARIABLES TO FORCIBLY BYPASS VITE HMR --- //
  const [items, setItems] = useState([]);
  const [dbTransactionsList, setDbTransactionsList] = useState([]);

  // Dynamic Locations State
  const [locations, setLocations] = useState(['مستودع الرياض']);

  // Modals Data State
  const [itemForm, setItemForm] = useState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
  const [itemErrors, setItemErrors] = useState({});
  
  // Batch Entry State
  const [sessionItems, setSessionItems] = useState([]);
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [nearDuplicateWarning, setNearDuplicateWarning] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const itemNameInputRef = useRef(null);
  const companyInputRef = useRef(null);
  const catSelectRef = useRef(null);
  const unitInputRef = useRef(null);
  
  // Dynamic Categories State
  const [categories, setCategories] = useState(['مجمدات', 'تبريد', 'بلاستيك']);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const newCategoryInputRef = useRef(null);
  
  // Exit Guard State
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // Debounced search values for autocomplete
  const debouncedItemName = useDebounce(itemForm.name, 200);
  const debouncedCompany = useDebounce(itemForm.company, 200);
  
  // Auto-focus item name input when modal opens
  useEffect(() => {
    if (isItemModalOpen) {
      setTimeout(() => {
        itemNameInputRef.current?.focus();
      }, 100);
    }
  }, [isItemModalOpen]);
  
  // Escape key handler to close modal with exit guard
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && isItemModalOpen) {
        event.preventDefault();
        handleCloseItemModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isItemModalOpen, itemForm.name, itemForm.company, sessionItems.length]);
  
  // Check if there's unsaved data
  const hasUnsavedData = () => {
    return itemForm.name.trim() !== '' || 
           itemForm.company.trim() !== '' || 
           sessionItems.length > 0;
  };
  
  // Handle modal close with exit guard
  const handleCloseItemModal = () => {
    if (hasUnsavedData()) {
      setShowExitConfirm(true);
    } else {
      performModalReset();
    }
  };
  
  // Reset all modal state
  const performModalReset = () => {
    setIsItemModalOpen(false);
    setItemForm({ name: '', company: '', cat: categories[0] || 'مجمدات', unit: 'كرتونة' });
    setItemErrors({});
    setNearDuplicateWarning(null);
    setIsCustomUnit(false);
    setSessionItems([]);
    setShowExitConfirm(false);
    setIsAddingCategory(false);
    setNewCategoryName('');
  };
  
  // Handle add category
  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const trimmed = newCategoryName.trim();
      if (!categories.includes(trimmed)) {
        setCategories(prev => [...prev, trimmed]);
        setItemForm(prev => ({...prev, cat: trimmed}));
        setIsAddingCategory(false);
        setNewCategoryName('');
        toast.success(`تم إضافة القسم "${trimmed}" ✅`);
        playSuccess();
        setTimeout(() => catSelectRef.current?.focus(), 50);
      } else {
        toast.warning('هذا القسم موجود بالفعل');
      }
    }
  };
  
  // Stock-In Auto-focus on modal open
  useEffect(() => {
    if (isStockInModalOpen) {
      setTimeout(() => {
        stockSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isStockInModalOpen]);
  
  // Stock-In Exit Guard
  const hasStockInUnsavedData = () => {
    return currentStockItem.name.trim() !== '' || stockForm.items.length > 0;
  };
  
  const handleCloseStockInModal = () => {
    if (hasStockInUnsavedData()) {
      setShowStockInExitConfirm(true);
    } else {
      performStockInReset();
    }
  };
  
  const performStockInReset = () => {
    setIsStockInModalOpen(false);
    setStockForm({ loc: 'مستودع الرياض', supplier: '', date: new Date().toISOString().split('T')[0], items: [] });
    setCurrentStockItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '', expiryDate: '' });
    setStockErrors({});
    setShowStockInExitConfirm(false);
    setStockSearchActiveIndex(-1);
    setShowNewItemRegistration(false);
    setNewItemData({ name: '', cat: '', unit: '', company: '' });
    setShowNewItemPrompt(false);
    setPromptItemName('');
    setPromptSource('stockIn');
  };
  
  // Add stock item to temporary table (with validation)
  const handleAddStockItemToTable = () => {
    // For existing items
    if (currentStockItem.selectedItem) {
      if (!currentStockItem.cat) return toast.error("القسم غير محدد لهذا الصنف!");
      if (!currentStockItem.qty || currentStockItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
      if (!isExpiryDisabled && !currentStockItem.expiryDate) return toast.error("أدخل تاريخ الصلاحية!");
      
      setStockForm({...stockForm, items: [
        {...currentStockItem, qty: Number(currentStockItem.qty), expiryDate: isExpiryDisabled ? null : currentStockItem.expiryDate, hasExpiry: !isExpiryDisabled},
        ...stockForm.items
      ]});
      setCurrentStockItem({name:'', selectedItem: null, cat:'', unit:'', qty:'', expiryDate: ''});
      setTimeout(() => stockSearchInputRef.current?.focus(), 50);
    } else {
      // For new items (free text entry)
      if (!currentStockItem.name.trim()) return toast.error("أدخل اسم الصنف!");
      if (!currentStockItem.cat) return toast.error("اختر القسم للصنف الجديد!");
      if (!currentStockItem.qty || currentStockItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
      if (!isExpiryDisabled && !currentStockItem.expiryDate) return toast.error("أدخل تاريخ الصلاحية!");
      
      // Create temporary item for table
      const newItem = {
        id: 'temp_' + Date.now(),
        name: currentStockItem.name.trim(),
        company: stockForm.loc,
        cat: currentStockItem.cat,
        unit: currentStockItem.unit || 'كرتونة',
        qty: Number(currentStockItem.qty),
        expiryDate: isExpiryDisabled ? null : currentStockItem.expiryDate,
        hasExpiry: !isExpiryDisabled,
        isNewItem: true
      };
      
      setStockForm({...stockForm, items: [newItem, ...stockForm.items]});
      setCurrentStockItem({name:'', selectedItem: null, cat:'', unit:'', qty:'', expiryDate: ''});
      setTimeout(() => stockSearchInputRef.current?.focus(), 50);
    }
  };
  
  // Trigger new item registration with centered confirmation prompt
  const triggerNewItemRegistration = (itemName, source) => {
    setPromptItemName(itemName);
    setPromptSource(source);
    setShowNewItemPrompt(true);
  };
  
  const handlePromptYes = () => {
    setShowNewItemPrompt(false);
    setNewItemData({ name: promptItemName, cat: '', unit: '', company: '' });
    setRegistrationSource(promptSource);
    setShowNewItemRegistration(true);
  };
  
  const handlePromptNo = () => {
    setShowNewItemPrompt(false);
    // Clear search and return focus
    if (promptSource === 'stockIn') {
      setCurrentStockItem({name:'', selectedItem: null, cat:'', unit:'', qty:'', expiryDate: ''});
      setTimeout(() => stockSearchInputRef.current?.focus(), 50);
    } else if (promptSource === 'invoice') {
      setCurrentInvoiceItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
      setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
    } else if (promptSource === 'return') {
      setReturnForm({...returnForm, query: '', selectedItem: null, cat: '', unit: ''});
      setTimeout(() => returnSearchInputRef.current?.focus(), 50);
    }
  };

  // Keyboard shortcuts for confirmation prompt
  useEffect(() => {
    const handlePromptKeys = (event) => {
      if (!showNewItemPrompt) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        handlePromptYes();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handlePromptNo();
      }
    };
    window.addEventListener('keydown', handlePromptKeys);
    return () => window.removeEventListener('keydown', handlePromptKeys);
  }, [showNewItemPrompt, promptItemName, promptSource]);
  
  // Handle on-the-fly item registration (works for all modals)
  const handleRegisterNewItem = async () => {
    if (!newItemData.name.trim()) return toast.error("أدخل اسم الصنف!");
    if (!newItemData.cat) return toast.error("اختر القسم!");
    if (!newItemData.company.trim()) return toast.error("أدخل اسم الشركة!");
    
    // Strict duplicate prevention with normalization
    const normalizedName = normalizeArabic(newItemData.name.trim());
    const duplicateItem = items.find(i => normalizeArabic(i.name) === normalizedName);
    if (duplicateItem) {
      return toast.error("هذا الصنف مسجل مسبقاً بالفعل!");
    }
    
    try {
      const rawName = newItemData.name.trim();
      const rawCompany = newItemData.company.trim();
      
      const { data: insertedItem, error: insertError } = await supabase.from('products').insert({
        name: rawName,
        company: rawCompany,
        cat: newItemData.cat,
        unit: newItemData.unit || 'كرتونة',
        stock_qty: 0,
        search_key: `${rawName} ${rawCompany}`.toLowerCase()
      }).select().single();
      if (insertError) throw insertError;
      
      toast.success(`تم تسجيل الصنف "${rawName}" بنجاح ✅`);
      playSuccess();
      setShowNewItemRegistration(false);
      
      // Auto-select the newly registered item based on source
      const newItem = { name: rawName, company: rawCompany, cat: newItemData.cat, unit: newItemData.unit || 'كرتونة' };
      
      if (registrationSource === 'stockIn') {
        setCurrentStockItem({
          name: `${rawName} - ${rawCompany}`,
          selectedItem: newItem,
          cat: newItemData.cat,
          unit: newItemData.unit || 'كرتونة',
          qty: '',
          expiryDate: ''
        });
        // Focus quantity field after registration
        setTimeout(() => document.getElementById('stockQtyInput')?.focus(), 100);
      } else if (registrationSource === 'invoice') {
        setCurrentInvoiceItem({
          name: `${rawName} - ${rawCompany}`,
          selectedItem: newItem,
          cat: newItemData.cat,
          unit: newItemData.unit || 'كرتونة',
          qty: ''
        });
        // Focus quantity field after registration
        setTimeout(() => document.getElementById('invoiceQtyInput')?.focus(), 100);
      } else if (registrationSource === 'return') {
        setReturnForm({...returnForm, 
          query: `${rawName} - ${rawCompany}`, 
          selectedItem: newItem, 
          cat: newItemData.cat, 
          unit: newItemData.unit || 'كرتونة' 
        });
        setTimeout(() => returnSearchInputRef.current?.focus(), 50);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [stockForm, setStockForm] = useState({
    loc: 'مستودع الرياض', supplier: '', date: new Date().toISOString().split('T')[0], items: []
  });
  const [currentStockItem, setCurrentStockItem] = useState({ name: '', selectedItem: null, cat: '', unit: '', qty: '', expiryDate: '' });
  const [stockErrors, setStockErrors] = useState({});
  
  // Stock-In Exit Guard State
  const [showStockInExitConfirm, setShowStockInExitConfirm] = useState(false);
  const stockSearchInputRef = useRef(null);
  
  // Stock-In Intelligent Expiry State
  const [showNewItemRegistration, setShowNewItemRegistration] = useState(false);
  const [newItemData, setNewItemData] = useState({ name: '', cat: '', unit: '', company: '' });
  const [registrationSource, setRegistrationSource] = useState('stockIn');
  
  // Automated expiry disable based on category (Plastic = no expiry)
  const isExpiryDisabled = currentStockItem.cat === 'بلاستيك';

  const [invoiceForm, setInvoiceForm] = useState({
    rep: 'أحمد المندوب', date: new Date().toISOString().split('T')[0], items: []
  });
  const [currentInvoiceItem, setCurrentInvoiceItem] = useState({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
  const [invoiceErrors, setInvoiceErrors] = useState({});
  const [isVoucherInvoice, setIsVoucherInvoice] = useState(false); // Tracks if invoice is from voucher (read-only mode)
  
  // Invoice Modal State
  const [showInvoiceExitConfirm, setShowInvoiceExitConfirm] = useState(false);
  const invoiceSearchInputRef = useRef(null);

  const [returnForm, setReturnForm] = useState({
    rep: 'محمد المندوب', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', reason: 'سليم (يعود للمخزون)', cat: '', expiryDate: '', returnee: ''
  });
  const [returnErrors, setReturnErrors] = useState({});
  const [returnItems, setReturnItems] = useState([]);
  const [showReturnExitConfirm, setShowReturnExitConfirm] = useState(false);
  const returnSearchInputRef = useRef(null);
  const [productFormSearchActiveIndex, setProductFormSearchActiveIndex] = useState(-1);
  const [companyFormSearchActiveIndex, setCompanyFormSearchActiveIndex] = useState(-1);
  const [stockSearchActiveIndex, setStockSearchActiveIndex] = useState(-1);
  const [invoiceSearchActiveIndex, setInvoiceSearchActiveIndex] = useState(-1);
  const [returnSearchActiveIndex, setReturnSearchActiveIndex] = useState(-1);
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false);
  const [selectedBatchTransactions, setSelectedBatchTransactions] = useState([]);
  const [stockInItemSuggestions, setStockInItemSuggestions] = useState([]);
  const [invoiceItemSuggestions, setInvoiceItemSuggestions] = useState([]);
  const [returnItemSuggestions, setReturnItemSuggestions] = useState([]);

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
  const [movementTypeFilter, setMovementTypeFilter] = useState('الكل');
  const [isMorningBriefOpen, setIsMorningBriefOpen] = useState(false);

  // Voucher Status Tracking State
  const [voucherTransactions, setVoucherTransactions] = useState([]);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [activeVoucherId, setActiveVoucherId] = useState(null);
  const voucherOpenLockRef = useRef({ id: null, at: 0 });
  
  // Voucher Detail View State
  const [isVoucherDetailOpen, setIsVoucherDetailOpen] = useState(false);
  const [detailVoucher, setDetailVoucher] = useState(null);
  const [invoiceTimestamps, setInvoiceTimestamps] = useState({}); // { voucherId: timestamp }
  
  // Global Keyboard Shortcuts for Modals
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.key === 'Escape') {
        if (isItemModalOpen) setIsItemModalOpen(false);
        if (isStockInModalOpen) setIsStockInModalOpen(false);
        if (isSalesModalOpen) setIsSalesModalOpen(false);
        if (isReturnsModalOpen) setIsReturnsModalOpen(false);
        if (isTransactionDetailOpen) setIsTransactionDetailOpen(false);
        if (isVoucherDetailOpen) setIsVoucherDetailOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isItemModalOpen, isStockInModalOpen, isSalesModalOpen, isReturnsModalOpen, isTransactionDetailOpen, isVoucherDetailOpen]);

  
  // Keyboard shortcuts for Voucher Detail modal
  useEffect(() => {
    const handleVoucherDetailKeys = (event) => {
      if (!isVoucherDetailOpen) return;
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        setIsVoucherDetailOpen(false);
      }
    };
    window.addEventListener('keydown', handleVoucherDetailKeys);
    return () => window.removeEventListener('keydown', handleVoucherDetailKeys);
  }, [isVoucherDetailOpen]);

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

  // ---  LIVE SUPABASE CONNECTIVITY --- //
  const fetchInitialData = useCallback(async () => {
    const { data: itemsData } = await supabase.from('products').select('*');
    if (itemsData) {
      setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty, searchKey: d.search_key, createdAt: d.created_at })));
    }
    
    // Sort by timestamp desc to ensure latest transactions appear at the top
    const { data: transData } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false }).limit(10);
    if (transData) {
      setDbTransactionsList(transData.map(d => ({ ...d, itemId: d.item_id, balanceAfter: d.balance_after, isInvoice: d.is_invoice, batchId: d.batch_id, voucherGroupId: d.id, voucherCode: d.source_voucher_id || '', expiryDate: d.expiry_date })));
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
    
    const itemsChannel = supabase.channel('public:products:dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData)
      .subscribe();

    const transChannel = supabase.channel('public:transactions:dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData)
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(transChannel);
    };
  }, [fetchInitialData]);

  // Build functional voucher groups from transaction lines in real time.
  useEffect(() => {
    if (dbTransactionsList.length === 0) return;

    const outboundTx = dbTransactionsList.filter(tx =>
      tx.type === 'Issue' || tx.type === 'سند إخراج' || tx.type === 'سند إخراج صوري'
    ).map(tx => {
      const txItemStr = tx.item || 'غير محدد';
      const matchedItem = items.find(i => i.id === tx.itemId || txItemStr.includes(i.name));
      const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
      return {
        ...tx,
        clientName: tx.rep || tx.loc || tx.supplier || 'غير محدد',
        itemName: tx.item || 'صنف غير محدد',
        quantity: Number(tx.qty || 0),
        timestamp: txDate,
        batchId: tx.batchId,
        invoiced: tx.invoiced === true,
        voucherCode: tx.voucherCode || '',
      };
    });

    const normalizedVouchers = outboundTx
      .filter(v => v.documentary === true && v.type === 'Ø³Ù†Ø¯ Ø¥Ø®Ø±Ø§Ø¬ ØµÙˆØ±ÙŠ')
      .reduce((acc, voucher) => {
        if (!voucher?.id || acc.some(v => v.id === voucher.id)) return acc;
        acc.push({
          ...voucher,
          invoiced: voucher.invoiced === true,
          deducted: voucher.deducted === true,
        });
        return acc;
      }, [])
      .sort((a, b) => b.timestamp - a.timestamp);

    setVoucherTransactions(normalizedVouchers);
  }, [dbTransactionsList, items]);

  const canonicalVoucherTransactions = useMemo(() => {
    const groupedVouchers = new Map();
    const uniqueVouchers = groupedVouchers;

    dbTransactionsList
      .filter(v => v.documentary === true && v.type === 'Ø³Ù†Ø¯ Ø¥Ø®Ø±Ø§Ø¬ ØµÙˆØ±ÙŠ')
      .forEach(v => {
        if (!v?.id || uniqueVouchers.has(v.id)) return;
        uniqueVouchers.set(v.id, {
          ...v,
          invoiced: v.invoiced === true,
          deducted: v.deducted === true,
        });
      });

    return Array.from(uniqueVouchers.values());
  }, [voucherTransactions]);

  const functionalVoucherGroups = useMemo(() => {
    const groupedVouchers = new Map();

    dbTransactionsList.forEach((tx) => {
      if (tx.isFunctional !== true || !FUNCTIONAL_VOUCHER_TYPES.includes(tx.type)) return;

      const groupId = tx.voucherGroupId || tx.id;
      const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();

      if (!groupedVouchers.has(groupId)) {
        groupedVouchers.set(groupId, {
          id: groupId,
          voucherGroupId: groupId,
          voucherCode: tx.voucherCode || '',
          type: tx.type,
          kind: tx.type === FUNCTIONAL_INBOUND_TYPE ? 'in' : 'outward',
          clientName: tx.rep || tx.supplier || tx.loc || 'غير محدد',
          timestamp: txDate,
          invoiced: tx.invoiced === true,
          deducted: tx.deducted === true,
          isFunctional: true,
          lines: [],
        });
      }

      const group = groupedVouchers.get(groupId);
      group.lines.push({
        ...tx,
        quantity: Number(tx.qty || 0),
        timestamp: txDate,
      });
      group.invoiced = group.invoiced && tx.invoiced === true;
      group.deducted = group.deducted && tx.deducted === true;
      if (txDate > group.timestamp) group.timestamp = txDate;
    });

    return Array.from(groupedVouchers.values())
      .map((voucher) => ({
        ...voucher,
        itemName: voucher.lines.map(line => line.item).join('، '),
        quantity: voucher.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [dbTransactionsList]);

  const pendingVouchers = useMemo(
    () => functionalVoucherGroups
      .filter(v => !v.invoiced)
      .sort((a, b) => b.timestamp - a.timestamp),
    [functionalVoucherGroups]
  );

  const completedVouchers = useMemo(
    () => functionalVoucherGroups
      .filter(v => v.invoiced)
      .sort((a, b) => b.timestamp - a.timestamp),
    [functionalVoucherGroups]
  );

  const openVoucherModal = useCallback((voucher) => {
    const now = Date.now();
    if (voucherOpenLockRef.current.id === voucher.id && now - voucherOpenLockRef.current.at < 250) return;

    voucherOpenLockRef.current = { id: voucher.id, at: now };
    setActiveVoucherId(voucher.id);
    setSelectedVoucher(voucher);
    setIsVoucherModalOpen(true);
  }, []);

  // --- Aggregations --- //
  const stockInCount = dbTransactionsList
    .filter(t => t.type === 'Restock' || (t.type === FUNCTIONAL_INBOUND_TYPE && t.isFunctional === true))
    .reduce((sum, t) => sum + Number(t.qty || 0), 0);
  const salesCount = dbTransactionsList
    .filter(t => (t.type === 'Issue' && t.isInvoice === true) || (t.type === FUNCTIONAL_OUTBOUND_TYPE && t.isFunctional === true))
    .reduce((sum, t) => sum + Number(t.qty || 0), 0);
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

  // --- 1. ADD NEW MASTER ITEM (Enhanced with Batch Support) --- //
  const handleAddItem = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    const errors = {};
    if (!itemForm.name.trim()) errors.name = true;
    if (!itemForm.company.trim()) errors.company = true;
    
    if (Object.keys(errors).length > 0) {
      setItemErrors(errors);
      if (!itemForm.name.trim()) {
        toast.error("يرجى إدخال اسم الصنف المكتمل.");
        itemNameInputRef.current?.focus();
      } else if (!itemForm.company.trim()) {
        toast.error("يرجى إدخال اسم الشركة الموردة.");
        companyInputRef.current?.focus();
      }
      return;
    }

    const rawName = itemForm.name.trim();
    const rawCompany = itemForm.company.trim();

    const normalizedInputName = normalizeArabic(rawName);
    const normalizedInputCompany = normalizeArabic(rawCompany);

    try {
        // Check for exact duplicates
        const duplicate = items.find(i => 
          normalizeArabic(i.name) === normalizedInputName &&
          normalizeArabic(i.company || 'بدون شركة') === normalizedInputCompany
        );

        if (duplicate) {
            setItemErrors({ name: true });
            toast.error("هذا الصنف مسجل مسبقاً لدى هذه الشركة");
            return;
        }
        
        const { data: insertedDoc, error: insertError } = await supabase.from('products').insert({
            name: rawName,
            company: rawCompany,
            cat: itemForm.cat,
            unit: itemForm.unit,
            stock_qty: 0,
            search_key: `${rawName} ${rawCompany}`.toLowerCase()
        }).select().single();
        if (insertError) throw insertError;

        // Insert initial transaction
        const { error: txError } = await supabase.from('transactions').insert({
            type: 'in',
            item_id: insertedDoc.id,
            qty: 0,
            unit: itemForm.unit,
            cat: itemForm.cat,
            date: new Date().toISOString().split('T')[0],
            location: 'إداري',
            notes: 'تعريف صنف جديد',
            invoiced: false
        });
        if (txError) console.error("Initial transaction error:", txError);
        
        // Add to session list for batch preview
        setSessionItems(prev => [...prev, { 
          id: Date.now(), 
          name: rawName, 
          company: rawCompany, 
          cat: itemForm.cat, 
          unit: itemForm.unit 
        }]);
        
        toast.success(`تم إضافة "${rawName}" إلى القائمة ✅`);
        playSuccess();
        fetchInitialData();
        
        // Reset form for next entry (keep modal open for batch)
        setItemForm({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
        setItemErrors({});
        setNearDuplicateWarning(null);
        setIsCustomUnit(false);
        
        // Refocus on item name field for next entry
        setTimeout(() => itemNameInputRef.current?.focus(), 50);
    } catch (err) {
        toast.error(err.message);
    }
  };
  
  // Submit all session items (if user wants to close modal)
  const handleBatchSubmit = async () => {
    if (sessionItems.length === 0) {
      return toast.error("لا توجد أصناف مضافة في الجلسة الحالية");
    }
    
    toast.success(`تم اعتماد ${sessionItems.length} صنف بنجاح ✅`);
    playSuccess();
    setSessionItems([]);
    setIsItemModalOpen(false);
    setItemForm({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
    setItemErrors({});
    setNearDuplicateWarning(null);
    setIsCustomUnit(false);
  };
  
  // Remove item from session list
  const removeSessionItem = (id) => {
    setSessionItems(prev => prev.filter(item => item.id !== id));
    toast.info("تم حذف الصنف من القائمة");
  };

  // --- 2. ADD STOCK IN (Enhanced with Expiry Date & New Item Registration) --- //
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (stockForm.items.length === 0) {
      return toast.error("الجدول فارغ! الرجاء إضافة الأصناف أولاً.");
    }

    // Validate expiry dates (only for items that require expiry)
    const itemsWithoutExpiry = stockForm.items.filter(it => it.hasExpiry && !it.expiryDate);
    if (itemsWithoutExpiry.length > 0) {
      return toast.error(`يوجد ${itemsWithoutExpiry.length} صنف بدون تاريخ صلاحية. تاريخ الصلاحية مطلوب.`);
    }

    try {
        const processPromises = [];
        
        // First, register any new items to the database
        // Build additions map
        const newItemsMap = {};
        for (const it of stockForm.items) {
          if (it.isNewItem) {
            const { data: insertedDoc, error } = await supabase.from('products').insert({
              name: it.name,
              company: it.company,
              cat: it.cat,
              unit: it.unit,
              stock_qty: 0,
              search_key: `${it.name} ${it.company}`.toLowerCase()
            }).select().single();
            if (error) throw error;
            newItemsMap[it.id] = insertedDoc.id;
            it.selectedItemId = insertedDoc.id;
          }
        }

        const txsToInsert = stockForm.items.map(it => {
           const itemId = it.selectedItemId || it.selectedItem?.id;
           const itemName = it.name || it.selectedItem?.name || 'صنف غير معروف';
           const itemCompany = it.company || it.selectedItem?.company || 'بدون شركة';
           return {
               type: 'in', // لازم تكون 'in' أو 'out'
               item_id: itemId, // التأكد إنه UUID سليم
               qty: parseInt(it.qty, 10), // تحويل الكمية لرقم (ضروري جداً)
               unit: it.unit || it.selectedItem?.unit || 'كرتونة',
               cat: it.cat || it.selectedItem?.cat || it.selectedItem?.category || 'عام',
               date: stockForm.date || new Date().toISOString().split('T')[0], // تنسيق التاريخ YYYY-MM-DD
               location: stockForm.loc || 'مستودع الرياض',
               invoiced: false
           };
        });

        // 2. إرسال البيانات لجدول الترانزكشن
        const { error: txError } = await supabase.from('transactions').insert(txsToInsert);
        if (txError) throw txError;

        // 3. تحديث كميات المخزن (Stock_qty) للأصناف باستخدام RPC
        for (const it of stockForm.items) {
           const itemId = it.selectedItemId || it.selectedItem?.id;
           const { error: updateError } = await supabase.rpc('increment_stock', {
               product_id: itemId,
               amount: parseInt(it.qty, 10)
           });
           if (updateError) console.error("Update stock error:", updateError);
        }

        toast.success(`تم توريد ${stockForm.items.length} صنف للمستودع بنجاح ✅`);
        playSuccess();
        performStockInReset();
        fetchInitialData(); 
    } catch (err) {
        console.error("Detailed Error:", err.message, err);
        toast.error(`خطأ في الحفظ: ${err.message || 'يرجى المحاولة مرة أخرى.'}`);
    }
  };
  
  // --- Invoice Modal Handlers ---
  // Auto-focus on modal open
  useEffect(() => {
    if (isSalesModalOpen) {
      setTimeout(() => {
        invoiceSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isSalesModalOpen]);
  
  // Exit guard
  const hasInvoiceUnsavedData = () => {
    return currentInvoiceItem.name.trim() !== '' || invoiceForm.items.length > 0;
  };
  
  const handleCloseInvoiceModal = () => {
    if (hasInvoiceUnsavedData()) {
      setShowInvoiceExitConfirm(true);
    } else {
      performInvoiceReset();
    }
  };
  
  const performInvoiceReset = () => {
    setIsSalesModalOpen(false);
    setInvoiceForm({ rep: 'أحمد المندوب', date: new Date().toISOString().split('T')[0], items: [] });
    setCurrentInvoiceItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
    setInvoiceErrors({});
    setShowInvoiceExitConfirm(false);
    setIsVoucherInvoice(false); // Reset read-only mode
    setStockSearchActiveIndex(-1);
  };
  
  // Add invoice item to table
  const handleAddInvoiceItemToTable = () => {
    if (!currentInvoiceItem.selectedItem) return toast.error("حدد الصنف أولاً!");
    if (!currentInvoiceItem.qty || currentInvoiceItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
    if (Number(currentInvoiceItem.qty) > currentInvoiceItem.selectedItem.stockQty) {
      return toast.error(`الكمية غير كافية! الرصيد المتوفر ${currentInvoiceItem.selectedItem.stockQty}`);
    }
    
    setInvoiceForm({...invoiceForm, items: [
      {...currentInvoiceItem, qty: Number(currentInvoiceItem.qty)},
      ...invoiceForm.items
    ]});
    setCurrentInvoiceItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
    setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
  };

  // --- 3. ADD INVOICE --- //
  const handleAddInvoice = async (e) => {
    e.preventDefault();

    // Mandatory recipient validation
    if (!invoiceForm.rep.trim()) {
      setInvoiceErrors({ recipient: true });
      return toast.error("يرجى تحديد العميل أو المستلم أولاً");
    }

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
        const processPromises = [];

        // CRITICAL FIX: Only deduct stock if this is NOT a voucher invoice
        // Vouchers (سند إخراج) already deduct stock when created
        const shouldDeductInventory = !sourceVoucher || sourceVoucher.kind !== 'outward' || sourceVoucher.deducted !== true;
        if (shouldDeductInventory) {
            const deductions = {};
            invoiceForm.items.forEach(it => {
                const id = it.selectedItem.id || it.selectedItemId;
                if (!deductions[id]) deductions[id] = { id: id, qty: 0, currentStock: 0 };
                deductions[id].qty += Number(it.qty);
            });

            for (const [id, payload] of Object.entries(deductions)) {
                const currentItem = items.find(i => i.id === id);
                if (currentItem) {
                    const newStock = currentItem.stockQty - payload.qty;
                    if (newStock < 50) playWarning();
                    await supabase.from('products').update({ stock_qty: newStock }).eq('id', id);
                }
            }
        }

        const batchId = Date.now().toString();
        const userId = currentUser?.email?.split('@')[0] || 'مدير النظام';
        
        // Log transactions
        const txsToInsert = invoiceForm.items.map(it => ({
            item: `${it.selectedItem.name} - ${it.selectedItem.company}`,
            type: 'out',
            qty: Number(it.qty),
            date: new Date().toLocaleTimeString('ar-SA'),
            timestamp: new Date().toISOString(),
            status: 'مكتمل',
            loc: invoiceForm.rep,
            rep: invoiceForm.rep,
            is_invoice: true,
            user_id: null,
            batch_id: batchId,
            source_voucher_id: sourceVoucher?.voucherGroupId || sourceVoucher?.id || null,
            item_id: it.selectedItem.id || it.selectedItemId
        }));
        await supabase.from('transactions').insert(txsToInsert);

        // CREATE INVOICE RECORD
        const { data: insertedInvoice, error: invError } = await supabase.from('invoices').insert({
          status: 'issued',
          recipient: invoiceForm.rep,
          created_by: userId,
          issued_at: new Date().toISOString()
        }).select().single();
        
        if (insertedInvoice && !invError) {
          const invItemsToInsert = invoiceForm.items.map(it => ({
            invoice_id: insertedInvoice.id,
            product_id: it.selectedItem.id || it.selectedItemId,
            item_name: it.selectedItem.name,
            company: it.selectedItem.company,
            cat: it.cat || it.selectedItem.cat,
            unit: it.unit || it.selectedItem.unit,
            quantity: Number(it.qty)
          }));
          await supabase.from('invoice_items').insert(invItemsToInsert);
        }

        // If this invoice came from a voucher, mark the voucher as invoiced
        if (sourceVoucher) {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          const h = String(now.getHours()).padStart(2, '0');
          const min = String(now.getMinutes()).padStart(2, '0');
          const invoiceTimestamp = `${y}/${m}/${d} - ${h}:${min}`;

          // Update all voucher line transactions sequentially
          for (const line of sourceVoucher.lines) {
              await supabase.from('transactions').update({
                  invoiced: true,
                  deducted: true,
                  invoice_date: invoiceTimestamp
              }).eq('id', line.id);
          }
          
          // Update local state with invoiceDate
          setInvoiceTimestamps(prev => ({...prev, [sourceVoucher.id]: invoiceTimestamp}));
          setVoucherTransactions(prev =>
            prev.map(v => v.id === sourceVoucher.id ? { ...v, invoiced: true, deducted: true, invoiceDate: invoiceTimestamp } : v)
          );
          if (detailVoucher && detailVoucher.id === sourceVoucher.id) {
            setDetailVoucher(prev => ({...prev, invoiced: true, deducted: true, invoiceDate: invoiceTimestamp}));
          }
          setSourceVoucher(null);
        }

        toast.success(`تم إصدار فاتورة بنجاح ${sourceVoucher ? 'وتوثيق السند' : 'وتحجيم الأرصدة'} ✅`);
        playSuccess();
        setIsSalesModalOpen(false);
        fetchInitialData();
        setInvoiceForm({ rep: invoiceForm.rep, date: new Date().toISOString().split('T')[0], items: [] });
        setCurrentInvoiceItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
    } catch (err) {
        toast.error("حدث خطأ في النظام. قد تحتاج لمراجعة اتصالك.");
    }
  };
  
  // --- Transaction Details Modal Keyboard Shortcuts ---
  useEffect(() => {
    const handleTransactionDetailsKeys = (event) => {
      if (!isTransactionDetailOpen) return;
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        setIsTransactionDetailOpen(false);
      }
    };
    window.addEventListener('keydown', handleTransactionDetailsKeys);
    return () => window.removeEventListener('keydown', handleTransactionDetailsKeys);
  }, [isTransactionDetailOpen]);

  // --- Return Modal Handlers ---
  // Auto-focus on modal open
  useEffect(() => {
    if (isReturnsModalOpen) {
      setTimeout(() => {
        returnSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isReturnsModalOpen]);
  
  // Exit guard
  const hasReturnUnsavedData = () => {
    return returnForm.query.trim() !== '' || returnForm.returnee.trim() !== '' || returnItems.length > 0;
  };
  
  const handleCloseReturnModal = () => {
    if (hasReturnUnsavedData()) {
      setShowReturnExitConfirm(true);
    } else {
      performReturnReset();
    }
  };
  
  const performReturnReset = () => {
    setIsReturnsModalOpen(false);
    setReturnForm({ rep: 'محمد المندوب', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', reason: 'سليم (يعود للمخزون)', cat: '', expiryDate: '', returnee: '', unit: '' });
    setReturnItems([]);
    setReturnErrors({});
    setShowReturnExitConfirm(false);
    setStockSearchActiveIndex(-1);
  };
  
  // Add return item to table
  const handleAddReturnItemToTable = () => {
    if (!returnForm.selectedItem) return toast.error("حدد الصنف أولاً!");
    if (!returnForm.cat) return toast.error("القسم غير محدد!");
    if (!returnForm.qty || returnForm.qty <= 0) return toast.error("أدخل كمية صحيحة!");
    
    setReturnItems([...returnItems, {
      name: returnForm.query,
      cat: returnForm.cat,
      unit: returnForm.unit || 'كرتونة',
      qty: Number(returnForm.qty),
      selectedItem: returnForm.selectedItem,
      reason: returnForm.reason
    }]);
    setReturnForm({...returnForm, query: '', selectedItem: null, cat: '', unit: '', qty: ''});
    setTimeout(() => returnSearchInputRef.current?.focus(), 50);
  };

  // --- 4. ADD RETURN (Enhanced with Table & Stock Increment) --- //
  const handleAddReturn = async (e) => {
    e.preventDefault();
    
    // Mandatory returnee validation
    if (!returnForm.returnee.trim()) {
      setReturnErrors({ returnee: true });
      return toast.error("يرجى تحديد الشخص أو الجهة التي قامت بالترجيع");
    }
    
    if (returnItems.length === 0) {
      return toast.error("لا توجد أصناف مرتجعة! الرجاء إضافة الأصناف أولاً.");
    }

    setReturnErrors({});

    try {
        const processPromises = [];
        const isGood = returnForm.reason.includes('سليم') || returnForm.reason.includes('خطأ');
        const txStatus = isGood ? 'مكتمل' : 'مرتجع تالف';
        const batchId = Date.now().toString();
        const userId = currentUser?.email?.split('@')[0] || 'مدير النظام';

        // Increment stock for good returns
        if (isGood) {
            const additions = {};
            returnItems.forEach(it => {
                if (!additions[it.selectedItem.id]) additions[it.selectedItem.id] = { id: it.selectedItem.id, qty: 0 };
                additions[it.selectedItem.id].qty += Number(it.qty);
            });

            for (const [id, payload] of Object.entries(additions)) {
                const currentItem = items.find(i => i.id === id);
                if (currentItem) {
                    await supabase.from('products').update({ stock_qty: currentItem.stockQty + payload.qty }).eq('id', id);
                }
            }
        }

        // Log transactions
        const txsToInsert = returnItems.map(it => ({
             item: `${it.name}`,
             type: 'return',
             qty: Number(it.qty),
             date: stockForm.date || new Date().toISOString().split('T')[0],
             timestamp: new Date().toISOString(),
             status: txStatus,
             loc: returnForm.returnee,
             rep: returnForm.rep,
             user_id: null,
             batch_id: batchId,
             item_id: it.selectedItem?.id
        }));
        await supabase.from('transactions').insert(txsToInsert);

        toast.success(`تم تسجيل المرتجع بنجاح ${isGood ? 'وإعادة الأصناف للمخزون' : '(تالف)'} ✅`);
        playSuccess();
        performReturnReset();
        fetchInitialData();
    } catch (err) {
        toast.error("حدث خطأ أثناء حفظ المرتجع.");
    }
  };

  // --- 5. MORNING BRIEF PROCESSING --- //

  const findItemFromVoucherLine = (line) => {
    if (line.itemId) {
      const byId = items.find(item => item.id === line.itemId);
      if (byId) return byId;
    }

    const itemName = line.item || '';
    return (
      items.find(item => `${item.name} - ${item.company}` === itemName) ||
      items.find(item => itemName.includes(item.name) && (item.company === 'بدون شركة' || itemName.includes(item.company))) ||
      items.find(item => itemName.includes(item.name)) ||
      null
    );
  };

  const finalizeInboundVoucher = async (voucher) => {
    // Stock was already increased when the voucher was created.
    // This function only marks the voucher as invoiced (financial record).
    try {
      for (const line of voucher.lines) {
        await supabase.from('transactions').update({ invoiced: true, deducted: true }).eq('id', line.id);
      }
      setIsVoucherModalOpen(false);
      setSelectedVoucher(null);
      toast.success('تم اعتماد سند الإدخال بنجاح ✅');
      playSuccess();
    } catch {
      toast.error('تعذر اعتماد سند الإدخال.');
      playWarning();
    }
  };

  // --- 5. EXPORT VOUCHER TO INVOICE (from voucher detail modal) --- //
  const handleExportInvoiceToInvoice = (voucher) => {
    if (!voucher) return;
    
    // Build line items from voucher
    const lineItems = (voucher.lines || [])
      .map((line) => {
        const matchedItem = findItemFromVoucherLine(line);
        if (!matchedItem) return null;

        return {
          selectedItem: matchedItem,
          name: `${matchedItem.name} - ${matchedItem.company}`,
          cat: matchedItem.cat,
          unit: matchedItem.unit,
          qty: Number(line.qty || 0)
        };
      })
      .filter(Boolean);

    // Set source voucher with deducted=true to prevent stock movement
    const sourceVoucherData = {
      ...voucher,
      deducted: true,
      kind: voucher.kind === 'in' ? 'in' : 'outward'
    };
    setSourceVoucher(sourceVoucherData);

    // Pre-fill invoice form
    if (lineItems.length > 0) {
      setInvoiceForm({
        rep: voucher.clientName || voucher.recipient || 'عميل نقدي',
        date: new Date().toISOString().split('T')[0],
        items: lineItems
      });
      setCurrentInvoiceItem({
        name: lineItems[0].name,
        selectedItem: lineItems[0].selectedItem,
        cat: lineItems[0].cat,
        unit: lineItems[0].unit,
        qty: String(lineItems[0].qty)
      });
    } else {
      // Fallback: create empty invoice with just recipient
      setInvoiceForm({
        rep: voucher.clientName || voucher.recipient || 'عميل نقدي',
        date: new Date().toISOString().split('T')[0],
        items: []
      });
      setCurrentInvoiceItem({
        name: '',
        selectedItem: null,
        cat: '',
        unit: '',
        qty: ''
      });
    }

    // Close voucher detail modal and open invoice modal
    setIsVoucherDetailOpen(false);
    setIsVoucherInvoice(true); // Enable read-only mode
    setIsSalesModalOpen(true);
  };

  // --- 6. MARK VOUCHER AS INVOICED (opens invoice modal) --- //
  const handleMarkAsInvoiced = () => {
    if (!selectedVoucher) return;
    if (selectedVoucher.kind === 'in') {
      finalizeInboundVoucher(selectedVoucher);
      return;
    }

    // For outbound vouchers: stock was already deducted at voucher creation.
    // The invoice is a financial record only - no stock movement.
    // Close voucher modal
    setIsVoucherModalOpen(false);

    // Set source voucher with forced deducted=true to prevent double deduction
    const sourceVoucherData = {
      ...selectedVoucher,
      deducted: true, // Ensure invoice doesn't deduct stock again
      kind: 'outward'
    };
    setSourceVoucher(sourceVoucherData);

    const lineItems = (selectedVoucher.lines || [])
      .map((line) => {
        const matchedItem = findItemFromVoucherLine(line);
        if (!matchedItem) return null;

        return {
          selectedItem: matchedItem,
          name: `${matchedItem.name} - ${matchedItem.company}`,
          cat: matchedItem.cat,
          unit: matchedItem.unit,
          qty: Number(line.qty || 0)
        };
      })
      .filter(Boolean);

    if (lineItems.length > 0) {
      setInvoiceForm({
        rep: selectedVoucher.clientName || 'عميل نقدي',
        date: new Date().toISOString().split('T')[0],
        items: lineItems
      });
      setCurrentInvoiceItem({
        name: lineItems[0].name,
        selectedItem: lineItems[0].selectedItem,
        cat: lineItems[0].cat,
        unit: lineItems[0].unit,
        qty: String(lineItems[0].qty)
      });
      setIsSalesModalOpen(true);
      setSelectedVoucher(null);
      return;
    }

    // Pre-fill invoice form with voucher data
    const itemName = selectedVoucher.itemName || '';
    
    // Try to find matching item - multiple strategies
    let matchedItem = null;
    
    // Strategy 1: Direct name match (itemName might be "فراولة - شركة نادك")
    matchedItem = items.find(i => 
      itemName.includes(i.name) && (i.company === 'بدون شركة' || itemName.includes(i.company))
    );
    
    // Strategy 2: Just match by item name if company doesn't match
    if (!matchedItem) {
      matchedItem = items.find(i => itemName.includes(i.name));
    }
    
    // Strategy 3: Match by exact item string
    if (!matchedItem) {
      matchedItem = items.find(i => `${i.name} - ${i.company}` === itemName);
    }

    if (matchedItem) {
      setCurrentInvoiceItem({
        name: `${matchedItem.name} - ${matchedItem.company}`,
        selectedItem: matchedItem,
        cat: matchedItem.cat,
        unit: matchedItem.unit,
        qty: String(selectedVoucher.quantity)
      });
      // Auto-add to invoice items
      const lineItem = {
        selectedItem: matchedItem,
        name: `${matchedItem.name} - ${matchedItem.company}`,
        cat: matchedItem.cat,
        unit: matchedItem.unit,
        qty: Number(selectedVoucher.quantity)
      };
      setInvoiceForm({
        rep: selectedVoucher.clientName || 'عميل نقدي',
        date: new Date().toISOString().split('T')[0],
        items: [lineItem]
      });
    } else {
      setInvoiceForm({
        rep: selectedVoucher.clientName || 'عميل نقدي',
        date: new Date().toISOString().split('T')[0],
        items: []
      });
      setCurrentInvoiceItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
    }

    // Open invoice modal
    setIsSalesModalOpen(true);
    setSelectedVoucher(null);
  };

  // --- Derived Autocomplete State for Add Item (Enhanced with Fuzzy Matching) --- //
  const uniqueItemNames = [...new Set(items.map(i => i.name))].filter(Boolean);
  const uniqueCompanies = [...new Set(items.map(i => i.company || 'بدون شركة'))].filter(Boolean);

  // Use normalized text for comparisons
  const normalizedInputName = normalizeArabic(itemForm.name);
  const normalizedInputCompany = normalizeArabic(itemForm.company || 'بدون شركة');

  // Strict duplicate check
  const isDuplicateMatch = itemForm.name.trim() !== '' && items.some(i =>
    normalizeArabic(i.name) === normalizedInputName &&
    normalizeArabic(i.company || 'بدون شركة') === normalizedInputCompany
  );
  
  // Check for near-duplicates (fuzzy matching)
  useEffect(() => {
    if (itemForm.name && itemForm.name.length >= 2) {
      const warning = checkNearDuplicates(itemForm.name, itemForm.company, items, 0.75);
      setNearDuplicateWarning(warning);
    } else {
      setNearDuplicateWarning(null);
    }
  }, [debouncedItemName, debouncedCompany, items]);

  // Enhanced autocomplete with fuzzy matching
  const itemSuggestions = useMemo(() => {
    if (!debouncedItemName || debouncedItemName.length < 1) return [];
    
    // First, exact/partial matches
    const exactMatches = uniqueItemNames.filter(n => 
      n.includes(debouncedItemName)
    );
    
    // Then, fuzzy matches if not enough exact matches
    if (exactMatches.length < 5) {
      const fuzzyMatches = items
        .filter(item => {
          const normName = normalizeArabic(item.name);
          const normQuery = normalizeArabic(debouncedItemName);
          const distance = Math.min(normName.length, normQuery.length);
          const similarity = 1 - (levenshteinDistanceSimple(normName, normQuery) / Math.max(normName.length, normQuery.length));
          return similarity > 0.6 && !exactMatches.includes(item.name);
        })
        .map(item => item.name)
        .slice(0, 5 - exactMatches.length);
      
      return [...exactMatches, ...fuzzyMatches].slice(0, 8);
    }
    
    return exactMatches.slice(0, 8);
  }, [debouncedItemName, uniqueItemNames, items]);
  
  const companySuggestions = useMemo(() => {
    if (!debouncedCompany || debouncedCompany.length < 1) return [];
    
    const exactMatches = uniqueCompanies.filter(c => 
      c.includes(debouncedCompany)
    );
    
    if (exactMatches.length < 5) {
      const fuzzyMatches = items
        .filter(item => {
          const normCompany = normalizeArabic(item.company || 'بدون شركة');
          const normQuery = normalizeArabic(debouncedCompany);
          const similarity = 1 - (levenshteinDistanceSimple(normCompany, normQuery) / Math.max(normCompany.length, normQuery.length));
          return similarity > 0.6 && !exactMatches.includes(item.company || 'بدون شركة');
        })
        .map(item => item.company || 'بدون شركة')
        .slice(0, 5 - exactMatches.length);
      
      return [...exactMatches, ...fuzzyMatches].slice(0, 8);
    }
    
    return exactMatches.slice(0, 8);
  }, [debouncedCompany, uniqueCompanies, items]);

  // --- Transactions Chart Processing --- //
  const now = new Date();
  const filteredTxForChart = dbTransactionsList.filter(tx => {
     if (chartDateRange === 'الكل') return true;
     if (!tx.timestamp) return true;
     const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
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
     const txItemStr = tx.item || 'غير معروف';
     const matchedItem = items.find(i => i.id === tx.itemId || (txItemStr.includes(i.name) && (i.company === 'بدون شركة' || txItemStr.includes(i.company))));
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
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date();
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date();
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
     if (movementTypeFilter === 'الكل') return true;
     if (movementTypeFilter === 'وارد') return tx.type === 'Restock' || tx.type === 'وارد' || tx.type === 'in';
     if (movementTypeFilter === 'صادر') return (tx.type === 'Issue' || tx.type === 'out') && !tx.isInvoice && !tx.isFunctional;
     if (movementTypeFilter === 'فاتورة') return (tx.type === 'Issue' || tx.type === 'out') && tx.isInvoice;
     if (movementTypeFilter === 'مرتجع') return tx.type === 'Return' || tx.type === 'مرتجع' || tx.type === 'return' || tx.status === 'مرتجع تالف';
     if (movementTypeFilter === 'سند إدخال') return tx.type === FUNCTIONAL_INBOUND_TYPE || tx.type === 'adjust_in' || (tx.type === FUNCTIONAL_INBOUND_TYPE && tx.isFunctional);
     if (movementTypeFilter === 'سند إخراج') return tx.type === FUNCTIONAL_OUTBOUND_TYPE || tx.type === 'adjust_out' || (tx.type === FUNCTIONAL_OUTBOUND_TYPE && tx.isFunctional);
     return true;
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

      {/* ── Bottom 3-Card Row ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-0 overflow-hidden">

        {/* ─── RIGHT: Recent Movements ─── */}
        <motion.div
          variants={cardVariants}
          className="flex flex-col bg-white rounded-[24px] border border-slate-100/80 shadow-sm overflow-hidden"
        >
          {/* Header: title + dropdown filter */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                <History size={15} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-[#0F2747] font-tajawal leading-tight">آخر الحركات</h3>
                <p className="text-[10px] text-slate-400 font-readex font-medium">{finalTransactions.length}</p>
              </div>
            </div>
            {/* Movement Type Dropdown Filter */}
            <select 
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              className="text-xs bg-slate-100 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/20 font-bold font-tajawal"
            >
              <option value="الكل">الكل</option>
              <option value="وارد">وارد</option>
              <option value="صادر">صادر</option>
              <option value="فاتورة">فاتورة</option>
              <option value="مرتجع">مرتجع</option>
              <option value="سند إدخال">سند إدخال</option>
              <option value="سند إخراج">سند إخراج</option>
            </select>
          </div>
          {/* List with compact rows - fixed issues! */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
            {finalTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300"><FileText size={36} strokeWidth={1.2} className="mb-3" /><p className="text-xs font-semibold">لم يتم تسجيل حركات</p></div>
            ) : (
              <div className="space-y-2">
                {finalTransactions.slice(0, 50).map((tx) => {
                  // --- 1. Fix Transaction Type Detection ---
                  // First match exact type, then check flags for invoices
                  let transactionLabel = '';
                  let transactionColor = '';
                  let transactionBg = '';
                  let transactionIcon = null;

                  // Handle all transaction types with correct labels/colors/icons
                  if (tx.type === 'Issue' && tx.is_invoice) {
                    transactionLabel = 'فاتورة مبيعات';
                    transactionColor = 'text-cyan-600';
                    transactionBg = 'bg-cyan-50';
                    transactionIcon = <FileText className="w-3.5 h-3.5" />;
                  } else if (tx.type === 'مرتجع' || tx.type === 'Return' || tx.type === 'return' || tx.status === 'مرتجع تالف') {
                    transactionLabel = tx.status === 'مرتجع تالف' ? 'إتلاف مخزني' : 'مرتجع';
                    transactionColor = tx.status === 'مرتجع تالف' ? 'text-rose-600' : 'text-red-600';
                    transactionBg = tx.status === 'مرتجع تالف' ? 'bg-rose-50' : 'bg-red-50';
                    transactionIcon = <RotateCcw className="w-3.5 h-3.5" />;
                  } else if (tx.type === 'وارد' || tx.type === 'Restock' || tx.type === 'in') {
                    transactionLabel = 'وارد مخزني';
                    transactionColor = 'text-blue-600';
                    transactionBg = 'bg-blue-50';
                    transactionIcon = <Download className="w-3.5 h-3.5" />;
                  } else if (tx.type === 'Issue' || tx.type === 'صادر' || tx.type === 'out') {
                    transactionLabel = 'صادر مبيعات';
                    transactionColor = 'text-orange-600';
                    transactionBg = 'bg-orange-50';
                    transactionIcon = <Upload className="w-3.5 h-3.5" />;
                  } else if (tx.type === FUNCTIONAL_INBOUND_TYPE) {
                    transactionLabel = 'سند إدخال';
                    transactionColor = 'text-purple-600';
                    transactionBg = 'bg-purple-50';
                    transactionIcon = <FileInput className="w-3.5 h-3.5" />;
                  } else if (tx.type === FUNCTIONAL_OUTBOUND_TYPE) {
                    transactionLabel = 'سند إخراج';
                    transactionColor = 'text-green-600';
                    transactionBg = 'bg-green-50';
                    transactionIcon = <FileOutput className="w-3.5 h-3.5" />;
                  } else {
                    transactionLabel = tx.type || 'عملية';
                    transactionColor = 'text-slate-600';
                    transactionBg = 'bg-slate-100';
                    transactionIcon = <FileCheck className="w-3.5 h-3.5" />;
                  }

                  // --- 2. Get the item with company name (find in items list by item_id) ---
                  // First try to match using tx.item_id, then fallback to tx.item name
                  const matchedItem = tx.item_id 
                    ? items.find(i => i.id === tx.item_id) 
                    : items.find(i => tx.item?.includes(i.name));
                  
                  // Build item display name with company if available
                  let itemDisplayName = tx.item || 'صنف غير معرف';
                  if (matchedItem) {
                    if (matchedItem.company) {
                      itemDisplayName = `${matchedItem.name} - ${matchedItem.company}`;
                    } else {
                      itemDisplayName = matchedItem.name;
                    }
                  }

                  // --- 3. Beneficiary/Client text ---
                  const beneficiaryText = tx.rep || tx.supplier || tx.loc || '';

                  // --- 4. Format date without time ---
                  const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
                  const formattedDate = txDate.toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        setSelectedBatchTransactions(tx.voucherGroupId ? dbTransactionsList.filter(t => t.voucherGroupId === tx.voucherGroupId) : tx.batchId ? dbTransactionsList.filter(t => t.batchId === tx.batchId) : [tx]);
                        setIsTransactionDetailOpen(true);
                      }}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 transition-all rounded-xl cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {/* --- Smaller Icon Container --- */}
                        <div className={`p-1.5 rounded-lg ${transactionBg} ${transactionColor}`}>
                          {transactionIcon}
                        </div>
                        
                        <div>
                          {/* --- Item Name (with company) --- */}
                          <h4 className="font-bold text-slate-800 text-xs font-tajawal text-right">
                            {itemDisplayName}
                          </h4>
                          
                          {/* --- Beneficiary + Date in one line (no time) --- */}
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-slate-500 font-readex">
                              {transactionLabel}
                            </p>
                            {beneficiaryText && (
                              <>
                                <span className="text-slate-300 text-[10px]">•</span>
                                <p className="text-[10px] text-slate-500 font-readex">
                                  {beneficiaryText}
                                </p>
                              </>
                            )}
                            <span className="text-slate-300 text-[10px]">•</span>
                            <p className="text-[10px] text-slate-400 font-readex">
                              {formattedDate}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* --- Quantity Badge --- */}
                      <div className="text-left">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${transactionBg} ${transactionColor}`}>
                          {tx.qty}
                        </span>
                      </div>
                    </div>
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
                <p className="text-[10px] text-slate-400 font-readex font-medium">{pendingVouchers.length} قيد الانتظار</p>
              </div>
            </div>
          </div>
          {/* Voucher List with checkboxes and sorting - vertically compressed */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2">
            {pendingVouchers.length === 0 && completedVouchers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <FileCheck size={36} strokeWidth={1.2} className="mb-3" />
                <p className="text-xs font-semibold">لا توجد سندات</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Un-invoiced vouchers at top (newest first) */}
                <AnimatePresence>
                  {pendingVouchers
                    .slice(0, 15)
                    .map((voucher) => {
                      const isCompleted = voucher.invoiced === true;
                      const invoiceDate = invoiceTimestamps[voucher.id] || voucher.invoiceDate;
                      const vDate = voucher.timestamp;
                      const dayName = vDate.toLocaleDateString('ar-SA', { weekday: 'long' });
                      const dateStr = vDate.toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' });

                      return (
                      <div
                        key={`${voucher.id}-${voucher.batchId}`}
                        onClick={() => {
                          setDetailVoucher(voucher);
                          setIsVoucherDetailOpen(true);
                        }}
                        className={`p-1.5 rounded-lg border cursor-pointer hover-stable no-select-click ${isCompleted ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Checkbox */}
                          <div
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const now = new Date();
                              const timestamp = now.toLocaleString('ar-SA', {
                                year: 'numeric', month: 'long', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              });
                              setInvoiceTimestamps(prev => ({...prev, [voucher.id]: timestamp}));
                              setVoucherTransactions(prev =>
                                prev.map(v => v.id === voucher.id ? {...v, invoiced: true, deducted: true} : v)
                              );
                              toast.success(`تم إصدار الفاتورة بنجاح ✅`);
                              playSuccess();
                            }}
                            className="shrink-0 mt-0.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              readOnly
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const now = new Date();
                                const timestamp = now.toLocaleString('ar-SA', {
                                  year: 'numeric', month: 'long', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                });
                                setInvoiceTimestamps(prev => ({...prev, [voucher.id]: timestamp}));
                                setVoucherTransactions(prev =>
                                  prev.map(v => v.id === voucher.id ? {...v, invoiced: true, deducted: true} : v)
                                );
                                toast.success(`تم إصدار الفاتورة بنجاح ✅`);
                                playSuccess();
                              }}
                              className="w-4 h-4 rounded border-2 border-slate-300 hover:border-emerald-500 cursor-pointer accent-emerald-500"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[11px] font-bold text-[#0F2747] font-tajawal leading-tight truncate">
                              {voucher.kind === 'in' ? 'سند إدخال' : 'سند إخراج'} - {voucher.clientName}
                            </h4>
                            {isCompleted && invoiceDate ? (
                              <p className="text-[8px] text-emerald-600 font-readex mt-0.5 truncate font-medium">
                                تم إصدار الفاتورة بتاريخ: {invoiceDate}
                              </p>
                            ) : (
                              <p className="text-[9px] text-slate-400 font-readex mt-0.5 truncate">
                                {dayName} - {dateStr}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    })
                  }
                </AnimatePresence>

                {/* Invoiced vouchers at bottom (green status) */}
                {completedVouchers.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-2 mb-1">
                      <div className="h-px flex-1 bg-slate-200"></div>
                      <span className="text-[10px] font-medium text-slate-400 font-readex">سندات تمت فوترتها</span>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    <AnimatePresence>
                      {completedVouchers
                        .slice(0, 10)
                        .map((voucher) => {
                          const vDate = voucher.timestamp;
                          const dayName = vDate.toLocaleDateString('ar-SA', { weekday: 'long' });
                          const dateStr = vDate.toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' });
                          const invoiceDate = invoiceTimestamps[voucher.id] || voucher.invoiceDate;

                          return (
                          <div
                            key={`${voucher.id}-${voucher.batchId}`}
                            onClick={() => {
                              setDetailVoucher(voucher);
                              setIsVoucherDetailOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 cursor-pointer hover-stable no-select-click hover:bg-emerald-50"
                          >
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 mt-0.5">
                                <input
                                  type="checkbox"
                                  checked={true}
                                  readOnly
                                  className="w-4 h-4 rounded border-2 border-emerald-500 accent-emerald-500 cursor-default"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-[11px] font-bold text-[#0F2747] font-tajawal leading-tight truncate">
                                  {voucher.kind === 'in' ? 'سند إدخال' : 'سند إخراج'} - {voucher.clientName}
                                </h4>
                                {invoiceDate ? (
                                  <p className="text-[8px] text-emerald-600 font-readex mt-0.5 truncate font-medium">
                                    تم إصدار الفاتورة بتاريخ: {invoiceDate}
                                  </p>
                                ) : (
                                  <p className="text-[9px] text-slate-400 font-readex mt-0.5 truncate">
                                    {dayName} - {dateStr}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                        })
                      }
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── CENTER: Inventory Alerts (تنبيهات المخزن) ─── */}
        <motion.div
          variants={cardVariants}
          className="flex flex-col bg-white rounded-[24px] border border-slate-100/80 shadow-sm overflow-hidden"
        >
          {/* Header: title right-aligned, category filter on same line */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                <AlertTriangle size={15} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-[#0F2747] font-tajawal leading-tight">تنبيهات المخزن</h3>
                <p className="text-[10px] text-slate-400 font-readex font-medium">{finalAlerts.length} صنف</p>
              </div>
            </div>
            {/* Category Filter Dropdown */}
            <select
              className="text-[10px] font-medium text-slate-500 outline-none cursor-pointer hover:text-slate-600 transition-colors border border-slate-100 rounded-lg px-2.5 py-1.5 bg-white hover:bg-slate-50"
              value={alertCatFilter}
              onChange={e => setAlertCatFilter(e.target.value)}
            >
              <option value="الكل">الأقسام</option>
              {[...new Set(items.map(i => i.cat).filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Alerts List with progress bars */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
            {finalAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                <CheckCircle2 size={32} strokeWidth={1.2} className="mb-2" />
                <p className="text-xs font-semibold">المخزون آمن</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {finalAlerts.map((item, idx) => {
                    // Color coding logic
                    let statusColor, iconColor, icon, barColor, urgencyLabel, urgencyBg;
                    if (item.stockQty < 70) {
                      statusColor = '#EF4444';
                      iconColor = 'text-red-500';
                      icon = <AlertOctagon size={12} />;
                      barColor = '#EF4444';
                      urgencyLabel = 'حرج';
                      urgencyBg = 'bg-red-50 text-red-600';
                    } else if (item.stockQty >= 70 && item.stockQty <= 100) {
                      statusColor = '#F59E0B';
                      iconColor = 'text-amber-500';
                      icon = <AlertTriangle size={12} />;
                      barColor = '#F59E0B';
                      urgencyLabel = 'تحذير';
                      urgencyBg = 'bg-amber-50 text-amber-600';
                    } else {
                      statusColor = '#10B981';
                      iconColor = 'text-emerald-500';
                      icon = <CheckCircle2 size={12} />;
                      barColor = '#10B981';
                      urgencyLabel = 'آمن';
                      urgencyBg = 'bg-emerald-50 text-emerald-600';
                    }
                    const stockPct = Math.min((item.stockQty / 200) * 100, 100);
                    
                    return (
                      <motion.div
                        key={`${item.id}-${idx}`}
                        layout
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 15, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }}
                        transition={{ duration: 0.25, layout: { duration: 0.3 }, ease: [0.4, 0, 0.2, 1] }}
                        whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.6)' }}
                        className="p-2.5 rounded-lg border border-slate-100 bg-white group/alert cursor-pointer hover-stable no-select-click"
                        style={{ willChange: 'transform, opacity', backfaceVisibility: 'hidden', transform: 'translate3d(0, 0, 0)' }}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${iconColor} bg-white border border-slate-100`}>
                            {icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-[11px] font-bold text-[#0F2747] font-tajawal truncate">{item.name} - {item.company || 'بدون شركة'}</h4>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${urgencyBg}`}>{urgencyLabel}</span>
                                <span className="text-xs font-bold tabular-nums" style={{ color: statusColor }}>{item.stockQty}</span>
                              </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${stockPct}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.05 }}
                                className="h-full rounded-full transition-all duration-500"
                                style={{ backgroundColor: barColor }}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

      </div>

      {/* MODALS */}
      {/* 0. Voucher/Transaction Details Modal */}
      <AnimatePresence>
        {isTransactionDetailOpen && selectedBatchTransactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0F2747]/60 backdrop-blur-md"
            dir="rtl"
            onClick={() => setIsTransactionDetailOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-3xl bg-white rounded-[24px] shadow-2xl border border-slate-100/60 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header with Color Coding */}
              {(() => {
                const firstTx = selectedBatchTransactions[0];
                const isVoucherIn = firstTx.type === FUNCTIONAL_INBOUND_TYPE || firstTx.type === 'وارد';
                const isVoucherOut = firstTx.type === FUNCTIONAL_OUTBOUND_TYPE || firstTx.type === 'صادر' || firstTx.type === 'Issue';
                const headerColor = isVoucherIn ? 'from-teal-500 to-teal-600' : 
                                   isVoucherOut ? 'from-red-500 to-red-600' : 
                                   'from-slate-500 to-slate-600';
                const headerBg = isVoucherIn ? 'bg-teal-50' : 
                                isVoucherOut ? 'bg-red-50' : 
                                'bg-slate-50';
                const headerText = isVoucherIn ? 'text-teal-700' : 
                                  isVoucherOut ? 'text-red-700' : 
                                  'text-slate-700';
                const typeLabel = firstTx.type === FUNCTIONAL_INBOUND_TYPE ? 'سند إدخال' :
                                 firstTx.type === FUNCTIONAL_OUTBOUND_TYPE ? 'سند إخراج' :
                                 firstTx.type === 'وارد' || firstTx.type === 'Restock' ? 'وارد' :
                                 firstTx.type === 'Issue' ? 'صادر' :
                                 firstTx.type === 'Return' ? 'مرتجع' : firstTx.type;
                const txDate = firstTx.timestamp ? new Date(firstTx.timestamp) : new Date();
                const formattedDate = txDate.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const batchId = firstTx.batchId || firstTx.voucherGroupId || 'N/A';
                
                return (
                  <>
                    <div className={`px-6 py-4 ${headerBg} border-b border-slate-100 shrink-0`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${isVoucherIn ? 'bg-teal-100 text-teal-600' : isVoucherOut ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'} flex items-center justify-center`}>
                            <FileText size={18} />
                          </div>
                          <div>
                            <h3 className={`text-lg font-bold ${headerText} font-tajawal`}>{typeLabel}</h3>
                            <p className="text-[10px] text-slate-500 font-readex">رقم الدفعة: {batchId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600 font-readex">{formattedDate}</p>
                          <p className="text-[10px] text-slate-400">{firstTx.user || 'مدير النظام'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Table */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-slate-700">الأصناف ({selectedBatchTransactions.length})</h4>
                      </div>
                      <table className="w-full min-w-max text-right text-xs whitespace-nowrap">
                        <thead className="bg-white sticky top-0 z-10">
                          <tr className="text-[10px] font-bold text-slate-600 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-center w-10">#</th>
                            <th className="px-4 py-2.5 min-w-[180px]">الصنف</th>
                            <th className="px-4 py-2.5 text-center w-24">القسم</th>
                            <th className="px-4 py-2.5 text-center w-20">الكمية</th>
                            <th className="px-4 py-2.5 text-center w-24">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedBatchTransactions.map((tx, idx) => {
                            const itemParts = tx.item ? String(tx.item).split(' - ') : ['غير معروف'];
                            const itemName = itemParts[0] || tx.item || 'غير محدد';
                            const itemCat = tx.cat || (items.find(i => i.name === itemName)?.cat || '-');
                            return (
                              <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-[10px] font-bold text-slate-500 text-center">{idx + 1}</td>
                                <td className="px-4 py-3 text-xs font-bold text-slate-800">{itemName}</td>
                                <td className="px-4 py-3 text-[10px] text-center">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{itemCat}</span>
                                </td>
                                <td className={`px-4 py-3 text-xs font-bold text-center ${isVoucherIn || tx.type === 'Return' ? 'text-teal-600' : 'text-red-600'}`}>
                                  {isVoucherIn || tx.type === 'Return' ? '+' : '-'}{tx.qty}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                    tx.status === 'مكتمل' ? 'bg-emerald-50 text-emerald-700' : 
                                    tx.status === 'مرتجع تالف' ? 'bg-red-50 text-red-700' : 
                                    'bg-slate-50 text-slate-600'
                                  }`}>
                                    {tx.status || 'مكتمل'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                      <p className="text-xs text-slate-600 font-readex">
                        إجمالي الأصناف: <span className="font-bold">{selectedBatchTransactions.length}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsTransactionDetailOpen(false)}
                        className={`px-5 py-2 rounded-lg text-xs font-bold text-white ${isVoucherIn ? 'bg-teal-500 hover:bg-teal-600' : isVoucherOut ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-500 hover:bg-slate-600'} transition-all`}
                      >
                        إغلاق
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voucher Detail Modal */}
      <AnimatePresence>
        {isVoucherDetailOpen && detailVoucher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0F2747]/60 backdrop-blur-md"
            dir="rtl"
            onClick={() => setIsVoucherDetailOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-xl bg-white rounded-[24px] shadow-2xl border border-slate-100/60 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {(() => {
                const isIn = detailVoucher.kind === 'in';
                const isCompleted = detailVoucher.invoiced === true || invoiceTimestamps[detailVoucher.id];
                const invoiceDate = invoiceTimestamps[detailVoucher.id] || detailVoucher.invoiceDate;
                const voucherDate = detailVoucher.timestamp ? new Date(detailVoucher.timestamp) : new Date();
                const formattedShortDate = voucherDate.toLocaleDateString('ar-SA', { 
                  day: '2-digit', month: '2-digit', year: 'numeric'
                }) + ' ' + voucherDate.toLocaleTimeString('ar-SA', { 
                  hour: '2-digit', minute: '2-digit'
                });
                const recipient = detailVoucher.clientName || detailVoucher.supplier || detailVoucher.rep || 'غير محدد';
                const lines = detailVoucher.lines || [];

                return (
                  <>
                    {/* Header: Symmetrical layout */}
                    <div className={`px-6 py-5 border-b border-slate-100 shrink-0 ${isCompleted ? 'bg-emerald-50' : isIn ? 'bg-teal-50' : 'bg-red-50'}`}>
                      <div className="flex items-start justify-between">
                        {/* Right: Voucher Type + Date */}
                        <div className="flex flex-col items-start">
                          <h3 className={`text-xl font-extrabold ${isCompleted ? 'text-emerald-700' : isIn ? 'text-teal-700' : 'text-red-700'} font-tajawal`}>
                            {isIn ? 'سند إدخال' : 'سند إخراج'}
                          </h3>
                          <p className="text-xs text-slate-500 font-readex mt-1">
                            تاريخ السند: <span className="font-bold text-slate-700">{formattedShortDate}</span>
                          </p>
                        </div>
                        {/* Left: Recipient */}
                        <div className="text-right pl-4">
                          <span className="text-[10px] text-slate-500 font-readex block">المستلم</span>
                          <p className="text-base font-extrabold text-[#0F2747] font-tajawal mt-0.5">{recipient}</p>
                        </div>
                      </div>
                    </div>

                    {/* Export Invoice Button / Status */}
                    <div className={`px-6 py-4 border-b border-slate-100 shrink-0 ${isCompleted ? 'bg-emerald-50/50' : ''}`}>
                      {isCompleted && invoiceDate ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-700 font-tajawal">
                            تم إصدار الفاتورة بتاريخ: {invoiceDate}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleExportInvoiceToInvoice(detailVoucher)}
                          className="w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <FileText size={16} />
                          تصدير الفاتورة
                        </button>
                      )}
                    </div>

                    {/* Items Table with borders */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {lines.length === 0 ? (
                        <div className="px-6 py-8 text-center text-slate-400 text-xs">لا توجد أصناف</div>
                      ) : (
                        <table className="w-full text-center text-xs border border-slate-200 rounded-lg overflow-hidden">
                          <thead className="bg-slate-50">
                            <tr className="text-[10px] font-bold text-slate-600 border-b border-slate-200">
                              <th className="px-5 py-3 text-center w-12 border-l border-slate-200">م</th>
                              <th className="px-5 py-3 text-center border-l border-slate-200">اسم الصنف</th>
                              <th className="px-5 py-3 text-center w-24">الكمية</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {lines.map((line, idx) => {
                              // Hard-coded concatenation: Item Name - Company
                              const displayName = line.item && line.company 
                                ? `${line.item} - ${line.company}` 
                                : (line.item || '-');
                              return (
                                <tr key={line.id || idx} className="bg-white hover:bg-slate-50">
                                  <td className="px-5 py-4 text-[10px] font-bold text-slate-500 text-center border-l border-slate-200">{idx + 1}</td>
                                  <td className="px-5 py-4 text-xs font-bold text-slate-800 text-center border-l border-slate-200">{displayName}</td>
                                  <td className={`px-5 py-4 text-xs font-bold text-center ${isIn ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {line.qty}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Footer */}
                    <div className={`px-6 py-4 ${isCompleted ? 'bg-emerald-50' : isIn ? 'bg-teal-50' : 'bg-red-50'} border-t border-slate-200 shrink-0`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600 font-readex">
                          إجمالي الأصناف: <span className="font-bold">{lines.length}</span>
                        </p>
                        <button
                          onClick={() => setIsVoucherDetailOpen(false)}
                          className={`px-6 py-2.5 rounded-lg text-xs font-bold text-white ${isCompleted ? 'bg-emerald-500 hover:bg-emerald-600' : isIn ? 'bg-teal-500 hover:bg-teal-600' : 'bg-red-500 hover:bg-red-600'} transition-all`}
                        >
                          إغلاق
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="w-full max-w-sm bg-white rounded-[24px] shadow-2xl border border-slate-100/60 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                <h3 className="text-lg font-bold text-[#0F2747] font-tajawal tracking-tight">{selectedVoucher.kind === 'in' ? 'اعتماد سند إدخال' : 'إصدار فاتورة جديدة'}</h3>
                <button
                  type="button"
                  onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }}
                  className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body - Minimalist centered layout */}
              <div className="px-6 py-8 flex flex-col items-center justify-center text-center">
                {/* Primary: Voucher Type - Beneficiary */}
                <h4 className="text-base font-bold text-[#0F2747] font-tajawal leading-tight">
                  {selectedVoucher.kind === 'in' ? 'سند إدخال' : 'سند إخراج'} - {selectedVoucher.clientName}
                </h4>
                {/* Secondary: Date with day name */}
                <p className="text-xs text-slate-400 font-readex mt-2">
                  {selectedVoucher.timestamp.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                {/* Footer note */}
                <p className="text-sm text-slate-500 font-tajawal mt-6">
                  {selectedVoucher.kind === 'in' ? 'سيتم اعتماد السند وإضافة الكميات إلى المخزون مباشرة.' : 'سيتم فتح نموذج الفاتورة الآن مع تعبئة كافة البيانات تلقائياً.'}
                </p>
              </div>

              {/* Footer Buttons */}
              <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => { setIsVoucherModalOpen(false); setSelectedVoucher(null); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 border border-slate-200 hover:bg-white transition-all font-readex"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleMarkAsInvoiced}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all font-tajawal"
                >
                  {selectedVoucher.kind === 'in' ? 'اعتماد السند الآن' : 'إصدار الفاتورة الآن'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Add Item - Professional Batch Entry Modal */}
      <AnimatePresence>
        {isItemModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-[#0F2747]/70 backdrop-blur-md transition-all duration-300 overflow-y-auto"
            dir="rtl" 
            onClick={() => setIsItemModalOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.97, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 20 }} 
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="w-full max-w-5xl bg-white rounded-[28px] shadow-3xl border border-slate-200/60 flex flex-col max-h-[95vh] my-8 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200 shrink-0 bg-gradient-to-r from-slate-50 to-white">
                <div>
                  <h3 className="text-2xl font-bold text-[#0F2747] font-tajawal tracking-tight">إضافة صنف جديد</h3>
                  <p className="text-xs text-slate-500 font-readex mt-1">
                    {sessionItems.length > 0 ? `تم إضافة ${sessionItems.length} صنف في هذه الجلسة` : 'أدخل بيانات الصنف'}
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsItemModalOpen(false)} 
                  className="p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-all active:scale-90"
                >
                  <X size={22} />
                </button>
              </div>
              
              {/* Form Section */}
              <form onSubmit={handleAddItem} className="flex-1 flex flex-col overflow-hidden">
                <div className="px-8 py-6 overflow-y-auto custom-scrollbar flex-1">
                  {/* Input Form */}
                  <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Item Name Field */}
                      <div className="relative group/nameItem">
                        <label className={LabelClass}>اسم الصنف <span className="text-status-danger">*</span></label>
                        <input
                          ref={itemNameInputRef}
                          id="addItemNameInput"
                          type="text"
                          autoComplete="off"
                          className={`${InputClass} ${isDuplicateMatch || itemErrors.name ? 'border-status-danger ring-2 ring-status-danger/20' : nearDuplicateWarning ? 'border-amber-400 ring-2 ring-amber-400/20' : ''}`}
                          placeholder="مثال: فراولة"
                          value={itemForm.name}
                          onChange={(e) => {
                            setItemForm({...itemForm, name: e.target.value});
                            setProductFormSearchActiveIndex(-1);
                          }}
                          onKeyDown={(e) => {
                            const suggestions = itemSuggestions;
                            if (e.key === 'ArrowDown') { 
                              e.preventDefault(); 
                              setProductFormSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); 
                            } else if (e.key === 'ArrowUp') { 
                              e.preventDefault(); 
                              setProductFormSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); 
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (productFormSearchActiveIndex >= 0 && suggestions[productFormSearchActiveIndex]) {
                                setItemForm(prev => ({...prev, name: suggestions[productFormSearchActiveIndex]}));
                                setProductFormSearchActiveIndex(-1);
                                setTimeout(() => companyInputRef.current?.focus(), 10);
                              } else if (itemForm.name.trim()) {
                                setTimeout(() => companyInputRef.current?.focus(), 10);
                              }
                            } else if (e.key === 'Tab') {
                              setTimeout(() => companyInputRef.current?.focus(), 10);
                            }
                          }}
                          onFocus={() => { setFocusedField('name'); setProductFormSearchActiveIndex(-1); }}
                          onBlur={() => setFocusedField(null)}
                          autoFocus
                        />
                        
                        {/* Autocomplete Dropdown */}
                        {itemForm.name && !isDuplicateMatch && itemSuggestions.length > 0 && (focusedField === 'name' || document.activeElement?.id === 'addItemNameInput') && (
                          <div className="absolute top-[100%] right-0 w-full max-h-52 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 z-30 p-1 mt-1">
                            {itemSuggestions.map((suggestionName, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className={`w-full text-right px-3 py-2.5 border-b border-slate-100 last:border-0 transition-colors ${productFormSearchActiveIndex === idx ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setItemForm(prev => ({...prev, name: suggestionName}));
                                  setProductFormSearchActiveIndex(-1);
                                  setTimeout(() => companyInputRef.current?.focus(), 10);
                                }}>
                                <span className="text-sm font-bold text-slate-800">{suggestionName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Duplicate Error */}
                        {isDuplicateMatch && (
                          <p className="text-status-danger text-[10px] font-bold mt-1.5 flex items-center animate-pulse">
                            <AlertTriangle size={12} className="ml-1" /> 
                            هذا الصنف مسجل مسبقاً لدى هذه الشركة
                          </p>
                        )}
                        
                        {/* Near Duplicate Warning */}
                        {nearDuplicateWarning && !isDuplicateMatch && (
                          <p className="text-amber-600 text-[10px] font-semibold mt-1.5 flex items-center">
                            <AlertTriangle size={12} className="ml-1" /> 
                            هل تقصد: <strong className="mx-1">{nearDuplicateWarning.item.name}</strong>؟
                          </p>
                        )}
                        
                        {/* Autocomplete Dropdown */}
                        {itemForm.name && !isDuplicateMatch && itemSuggestions.length > 0 && (focusedField === 'name' || document.activeElement?.id === 'addItemNameInput') && (
                          <div className="absolute top-[100%] right-0 w-full max-h-52 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 z-30 p-1 mt-1">
                            {itemSuggestions.map((suggestionName, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className={`w-full text-right px-3 py-2.5 border-b border-slate-100 last:border-0 transition-colors ${productFormSearchActiveIndex === idx ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setItemForm(prev => ({...prev, name: suggestionName}));
                                  setProductFormSearchActiveIndex(-1);
                                  setTimeout(() => companyInputRef.current?.focus(), 10);
                                }}>
                                <span className="text-sm font-bold text-slate-800">{suggestionName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Company Field */}
                      <div className="relative group/companyItem">
                        <label className={LabelClass}>الشركة الموردة <span className="text-status-danger">*</span></label>
                        <input
                          ref={companyInputRef}
                          id="addItemCompanyInput"
                          type="text"
                          autoComplete="off"
                          className={`${InputClass} ${itemErrors.company ? 'border-status-danger ring-2 ring-status-danger/20' : ''}`}
                          placeholder="ماريتا"
                          value={itemForm.company}
                          onChange={(e) => {
                            setItemForm({...itemForm, company: e.target.value});
                            setCompanyFormSearchActiveIndex(-1);
                            if (itemErrors.company) setItemErrors(prev => ({...prev, company: false}));
                          }}
                          onKeyDown={(e) => {
                            const suggestions = companySuggestions;
                            if (e.key === 'ArrowDown') { 
                              e.preventDefault(); 
                              setCompanyFormSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); 
                            } else if (e.key === 'ArrowUp') { 
                              e.preventDefault(); 
                              setCompanyFormSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); 
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (companyFormSearchActiveIndex >= 0 && suggestions[companyFormSearchActiveIndex]) {
                                setItemForm(prev => ({...prev, company: suggestions[companyFormSearchActiveIndex]}));
                                setCompanyFormSearchActiveIndex(-1);
                                setTimeout(() => document.getElementById('addItemCatInput')?.focus(), 10);
                              } else {
                                setTimeout(() => document.getElementById('addItemCatInput')?.focus(), 10);
                              }
                            } else if (e.key === 'Tab') {
                              setTimeout(() => document.getElementById('addItemCatInput')?.focus(), 10);
                            }
                          }}
                          onFocus={() => { setFocusedField('company'); setCompanyFormSearchActiveIndex(-1); }}
                          onBlur={() => setFocusedField(null)}
                        />
                        
                        {/* Company Autocomplete */}
                        {itemForm.company && companySuggestions.length > 0 && (focusedField === 'company' || document.activeElement?.id === 'addItemCompanyInput') && (
                          <div className="absolute top-[100%] right-0 w-full max-h-52 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 z-30 p-1 mt-1">
                            {companySuggestions.map((suggestionCompany, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className={`w-full text-right px-3 py-2.5 border-b border-slate-100 last:border-0 transition-colors ${companyFormSearchActiveIndex === idx ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setItemForm(prev => ({...prev, company: suggestionCompany}));
                                  setCompanyFormSearchActiveIndex(-1);
                                  setTimeout(() => catSelectRef.current?.focus(), 10);
                                }}>
                                <span className="text-sm font-bold text-slate-800">{suggestionCompany}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Category Field */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">القسم</label>
                          <button 
                            type="button" 
                            onClick={() => { 
                              setIsAddingCategory(true); 
                              setTimeout(() => newCategoryInputRef.current?.focus(), 50); 
                            }} 
                            className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center shadow-sm"
                          >
                            <Plus size={10} className="ml-0.5" /> قسم جديد
                          </button>
                        </div>
                        
                        {isAddingCategory ? (
                          <div className="flex gap-2">
                            <input
                              ref={newCategoryInputRef}
                              type="text"
                              className={`${InputClass} flex-1`}
                              placeholder="اسم القسم الجديد..."
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCategory();
                                } else if (e.key === 'Escape') {
                                  setIsAddingCategory(false);
                                  setNewCategoryName('');
                                }
                              }}
                              onBlur={() => {
                                if (!newCategoryName.trim()) {
                                  setIsAddingCategory(false);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleAddCategory}
                              className="px-3 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all font-bold text-sm"
                            >
                              إضافة
                            </button>
                          </div>
                        ) : (
                          <select 
                            ref={catSelectRef}
                            id="addItemCatInput" 
                            className={InputClass} 
                            value={itemForm.cat} 
                            onChange={(e) => setItemForm({...itemForm, cat: e.target.value})} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { 
                                e.preventDefault(); 
                                setTimeout(() => unitInputRef.current?.focus(), 10); 
                              } else if (e.key === 'Tab') {
                                setTimeout(() => unitInputRef.current?.focus(), 10);
                              }
                            }}
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      
                      {/* Unit Field */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">وحدة القياس</label>
                          <button 
                            type="button" 
                            onClick={() => { 
                              setIsCustomUnit(!isCustomUnit); 
                              setItemForm({...itemForm, unit: (!isCustomUnit) ? '' : 'كرتونة'}); 
                            }} 
                            className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center shadow-sm"
                          >
                            {isCustomUnit ? 'العودة للقيمة الثابتة' : <><Plus size={10} className="ml-0.5" /> وحدة مخصصة</>}
                          </button>
                        </div>
                        {isCustomUnit ? (
                          <input 
                            ref={unitInputRef}
                            id="addItemUnitInput" 
                            type="text" 
                            className={InputClass} 
                            placeholder="اكتب الوحدة..." 
                            value={itemForm.unit} 
                            onChange={(e) => setItemForm({...itemForm, unit: e.target.value})} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { 
                                e.preventDefault(); 
                                if (!isDuplicateMatch && itemForm.name.trim()) handleAddItem(e); 
                              }
                            }} 
                          />
                        ) : (
                          <select 
                            ref={unitInputRef}
                            id="addItemUnitInput" 
                            className={InputClass} 
                            value={itemForm.unit} 
                            onChange={(e) => setItemForm({...itemForm, unit: e.target.value})}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { 
                                e.preventDefault(); 
                                if (!isDuplicateMatch && itemForm.name.trim()) handleAddItem(e); 
                              } else if (e.key === 'Tab' && e.shiftKey) {
                                setTimeout(() => itemNameInputRef.current?.focus(), 10);
                              }
                            }}
                          >
                            <option>كرتونة</option>
                            <option>قطعة</option>
                            <option>كيلو</option>
                            <option>لتر</option>
                            <option>طرد</option>
                            <option>علبة</option>
                          </select>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-4 flex items-center justify-end pt-3 border-t border-slate-200">
                      <button 
                        type="submit" 
                        disabled={isDuplicateMatch || !itemForm.name.trim() || !itemForm.company.trim()}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-tajawal flex items-center gap-2"
                      >
                        <Plus size={16} />
                        إضافة للقائمة
                      </button>
                    </div>
                  </div>
                  
                  {/* Session Preview Table */}
                  {sessionItems.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 font-tajawal">
                            الأصناف المضافة ({sessionItems.length})
                          </h4>
                          <p className="text-xs text-slate-500 font-readex mt-0.5">
                            مراجعة قبل الاعتماد النهائي
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSessionItems([]);
                            toast.info("تم مسح القائمة");
                          }}
                          className="text-xs text-red-500 hover:text-red-600 font-readex px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                        >
                          مسح القائمة
                        </button>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600">#</th>
                              <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600">اسم الصنف</th>
                              <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600">القسم</th>
                              <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-600">الوحدة</th>
                              <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-600">إجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sessionItems.map((item, idx) => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-500 font-readex">{idx + 1}</td>
                                <td className="px-4 py-3 font-bold text-slate-800 font-tajawal">
                                  {item.name && item.company ? `${item.name} - ${item.company}` : (item.name || '-')}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-lg text-xs">
                                    {item.cat}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeSessionItem(item.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <X size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Footer Buttons */}
                <div className="px-8 py-5 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
                  <button 
                    type="button" 
                    onClick={handleCloseItemModal} 
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-white transition-all font-readex"
                  >
                    إغلاق
                  </button>
                  {sessionItems.length > 0 && (
                    <button 
                      type="button"
                      onClick={handleBatchSubmit}
                      className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all font-tajawal flex items-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      اعتماد {sessionItems.length} صنف
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Exit Confirmation Dialog */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle size={24} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-800 font-tajawal mb-1">تنبيه: بيانات غير معتمدة</h4>
                    <p className="text-sm text-slate-600 font-readex leading-relaxed">
                      {sessionItems.length > 0 
                        ? `يوجد ${sessionItems.length} صنف غير معتمد في القائمة. هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات غير المعتمدة.`
                        : 'هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات غير المعتمدة.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-all font-readex"
                >
                  إلغاء والعودة
                </button>
                <button
                  type="button"
                  onClick={performModalReset}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-md transition-all font-tajawal"
                >
                  تأكيد الإغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Add Stock (Enhanced with Expiry Date & Exit Guard - Compact Layout) */}
      <ModalWrapper title="إضافة وارد مخزني (تلقيم احترافي)" maxWidth="max-w-6xl" isOpen={isStockInModalOpen} onClose={handleCloseStockInModal} onSubmit={handleAddStock} compact>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
             <div>
                <label className={LabelClass}>جهة الورود</label>
                <div className="flex gap-2">
                   <select className={`${InputClass} py-2.5`} value={stockForm.loc} onChange={(e) => setStockForm({...stockForm, loc: e.target.value})}>
                     {locations.map(l => <option key={l}>{l}</option>)}
                   </select>
                   <button type="button" onClick={() => { const nl = window.prompt("اسم الجهة/المستودع الجديد:"); if (nl && nl.trim()) { setLocations([...locations, nl.trim()]); setStockForm({...stockForm, loc: nl.trim()}); } }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 rounded-lg font-bold transition-colors text-sm">+</button>
                </div>
             </div>
             <div><label className={LabelClass}>تاريخ التوريد</label><input type="date" className={`${InputClass} py-2.5`} value={stockForm.date} onChange={(e) => setStockForm({...stockForm, date: e.target.value})} /></div>
          </div>

          {/* Top Section (Fixed Entry with Category & Expiry Date) */}
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 mb-3 shadow-sm">
             <h4 className="text-xs font-bold text-emerald-700 mb-2">إضافة صنف للجدول</h4>
             <div className="flex flex-wrap items-end gap-2.5">
               {/* Search Field */}
               <div className="flex-1 min-w-[200px] relative group/item">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">البحث عن الصنف</label>
                 <input
                   ref={stockSearchInputRef}
                   type="text"
                   id="stockSearchInput"
                   className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2.5 py-2 outline-none transition-all duration-300 placeholder:text-slate-400 text-center"
                   placeholder="اكتب للبحث أو إضافة صنف جديد..."
                   value={currentStockItem.name}
                   onChange={(e) => {
                     setCurrentStockItem({...currentStockItem, name: e.target.value, selectedItem: null, cat: '', unit: ''});
                     setStockSearchActiveIndex(-1);
                     // Reset category/unit when typing new name
                     if (currentStockItem.selectedItem) {
                       setCurrentStockItem(prev => ({...prev, selectedItem: null, cat: '', unit: ''}));
                     }
                   }}
                   onBlur={() => {
                     // Check if user typed unknown item name
                     if (currentStockItem.name.trim().length >= 2 && !currentStockItem.selectedItem) {
                       const matchFound = items.some(i => 
                         i.name.includes(currentStockItem.name) || 
                         i.company.includes(currentStockItem.name)
                       );
                       if (!matchFound) {
                         // Show toast confirmation instead of directly opening modal
                         triggerNewItemRegistration(currentStockItem.name.trim(), 'stockIn');
                       }
                     }
                   }}
                   onKeyDown={(e) => {
                     const suggestions = items.filter(i => i.name.includes(currentStockItem.name) || i.company.includes(currentStockItem.name));
                     if (e.key === 'ArrowDown') { e.preventDefault(); setStockSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); }
                     else if (e.key === 'ArrowUp') { e.preventDefault(); setStockSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                     else if (e.key === 'Enter') {
                       e.preventDefault();
                       if (stockSearchActiveIndex >= 0 && suggestions[stockSearchActiveIndex]) {
                         const invItem = suggestions[stockSearchActiveIndex];
                         setCurrentStockItem({ ...currentStockItem, name: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat || invItem.category || '', unit: invItem.unit || 'كرتونة' });
                         setStockSearchActiveIndex(-1); setTimeout(() => document.getElementById('stockQtyInput')?.focus(), 10);
                       } else if (suggestions.length === 0 && currentStockItem.name.trim().length >= 2) {
                         // Show toast confirmation instead of directly opening modal
                         triggerNewItemRegistration(currentStockItem.name.trim(), 'stockIn');
                       } else if (currentStockItem.selectedItem) {
                         setTimeout(() => document.getElementById('stockQtyInput')?.focus(), 10);
                       }
                     } else if (e.key === 'Tab') {
                       setTimeout(() => document.getElementById('stockCatInput')?.focus(), 10);
                     }
                   }}
                 />
                 {currentStockItem.name && !currentStockItem.selectedItem && (
                   <div className="hidden group-focus-within/item:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200 z-30 p-0.5">
                     {items.filter(i => i.name.includes(currentStockItem.name) || i.company.includes(currentStockItem.name)).map((invItem, idx) => (
                          <button key={invItem.id} type="button" className={`w-full text-right px-2.5 py-1.5 border-b border-slate-50 last:border-0 transition-colors ${stockSearchActiveIndex === idx ? 'bg-emerald-50' : 'hover:bg-slate-50'}`} onMouseDown={(e) => {
                            e.preventDefault();
                            setCurrentStockItem({
                              ...currentStockItem,
                              name: `${invItem.name} - ${invItem.company}`,
                              selectedItem: invItem,
                              cat: invItem.cat || invItem.category || '',
                              unit: invItem.unit || 'كرتونة'
                            });
                            setStockSearchActiveIndex(-1);
                            setTimeout(() => { document.getElementById('stockCatInput')?.focus(); }, 10);
                          }}>
                            <span className="text-xs font-bold text-slate-800">{invItem.name}</span> <span className="text-[10px] text-slate-500">- {invItem.company}</span>
                          </button>
                     ))}
                   </div>
                 )}
               </div>

               {/* Category Field - Editable for new items */}
               <div className="w-[100px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">القسم</label>
                 {currentStockItem.selectedItem ? (
                   <input
                     type="text"
                     id="stockCatInput"
                     className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl block px-2.5 py-2 outline-none cursor-default text-center"
                     value={currentStockItem.cat}
                     readOnly
                     placeholder="تلقائي"
                   />
                 ) : (
                   <select
                     id="stockCatInput"
                     className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2 py-2 outline-none transition-all duration-300 text-center"
                     value={currentStockItem.cat}
                     onChange={(e) => setCurrentStockItem({...currentStockItem, cat: e.target.value})}
                   >
                     <option value="">اختر...</option>
                     {categories.map(cat => (
                       <option key={cat} value={cat}>{cat}</option>
                     ))}
                   </select>
                 )}
               </div>

               {/* Unit Field - Editable for new items */}
               <div className="w-[90px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الوحدة</label>
                 {currentStockItem.selectedItem ? (
                   <input
                     type="text"
                     id="stockUnitInput"
                     className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl block px-2.5 py-2 outline-none cursor-default text-center"
                     value={currentStockItem.unit}
                     readOnly
                     placeholder="تلقائي"
                   />
                 ) : (
                   <input
                     type="text"
                     id="stockUnitInput"
                     className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2 py-2 outline-none transition-all duration-300 text-center"
                     value={currentStockItem.unit}
                     onChange={(e) => setCurrentStockItem({...currentStockItem, unit: e.target.value})}
                     placeholder="كرتونة"
                   />
                 )}
               </div>

               {/* Quantity Field - Rigid Fixed Width */}
               <div className="w-[75px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الكمية <span className="text-red-500">*</span></label>
                 <input
                   type="number"
                   id="stockQtyInput"
                   className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2 py-2 outline-none transition-all duration-300 placeholder:text-slate-400 text-center font-bold tabular-nums"
                   placeholder="0"
                   maxLength={4}
                   value={currentStockItem.qty}
                   onChange={(e) => {
                     // Limit to 4 digits
                     if (e.target.value.length <= 4) {
                       setCurrentStockItem({...currentStockItem, qty: e.target.value});
                     }
                   }}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       e.preventDefault();
                       handleAddStockItemToTable();
                     } else if (e.key === 'Tab') {
                       e.preventDefault();
                       setTimeout(() => document.getElementById('stockExpiryInput')?.focus(), 10);
                     }
                   }}
                 />
               </div>

               {/* Expiry Date + Add Button Group */}
               <div className="flex-1 min-w-[240px]">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">
                   تاريخ الصلاحية {!isExpiryDisabled && <span className="text-red-500">*</span>}
                   {isExpiryDisabled && <span className="text-slate-400 font-normal ml-1">(لا يتطلب صلاحية)</span>}
                 </label>
                 <div className="flex items-center gap-2">
                   <input
                     type="date"
                     id="stockExpiryInput"
                     className={`flex-1 border text-xs rounded-xl block px-2.5 py-2 outline-none transition-all duration-300 text-center ${
                       isExpiryDisabled
                         ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                         : 'bg-white border-slate-200 text-slate-800 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20'
                     }`}
                     value={currentStockItem.expiryDate}
                     onChange={(e) => setCurrentStockItem({...currentStockItem, expiryDate: e.target.value})}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         e.preventDefault();
                         handleAddStockItemToTable();
                       }
                     }}
                     min={new Date().toISOString().split('T')[0]}
                     disabled={isExpiryDisabled}
                     
                   />
                   <button
                     type="button"
                     className="shrink-0 w-9 h-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center hover:scale-105 active:scale-95"
                     onClick={handleAddStockItemToTable}
                     title="إضافة للجدول"
                   >
                     <Plus size={18} strokeWidth={2.5} />
                   </button>
                 </div>
               </div>
             </div>
          </div>

          {/* Middle Section (The Table with Expiry Date - Maximized Height) */}
          <div className="card overflow-hidden flex flex-col flex-1 min-h-[45vh]">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between shrink-0 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-700">الأصناف المضافة ({stockForm.items.length})</h4>
              {stockForm.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStockForm(prev => ({...prev, items: []}));
                    toast.info("تم مسح القائمة");
                  }}
                  className="text-[10px] text-red-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-all font-bold"
                >
                  مسح القائمة
                </button>
              )}
            </div>
            <div className="overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full min-w-max text-right text-xs whitespace-nowrap">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-600 border-b border-slate-200">
                    <th className="px-3 py-2 font-bold w-10 text-center">#</th>
                    <th className="px-3 py-2 font-bold min-w-[180px]">اسم الصنف</th>
                    <th className="px-3 py-2 font-bold w-24">القسم</th>
                    <th className="px-3 py-2 font-bold w-20">الكمية</th>
                    <th className="px-3 py-2 font-bold w-36">تاريخ الصلاحية</th>
                    <th className="px-3 py-2 font-bold w-14 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stockForm.items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400 text-[10px] font-bold">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <Package size={28} className="mb-1.5" />
                          لم يتم إضافة أصناف للجدول بعد
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stockForm.items.map((item, idx) => {
                      const hasExpiry = item.hasExpiry !== false && item.expiryDate;
                      const daysUntilExpiry = hasExpiry ? Math.ceil((new Date(item.expiryDate) - Date.now()) / 86400000) : null;
                      const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                      const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

                      return (
                        <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors group">
                          <td className="px-3 py-2 text-[10px] font-bold text-slate-500 text-center">{idx + 1}</td>
                          <td className="px-3 py-2 text-xs font-bold text-slate-800">
                            {item.name && item.company ? `${item.name} - ${item.company}` : (item.name || '-')}
                          </td>
                          <td className="px-3 py-2 text-[10px]">
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold">
                              {item.cat}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-emerald-600 border-r border-slate-100 text-center">+{item.qty}</td>
                          <td className="px-3 py-2 text-[10px]">
                            {!hasExpiry ? (
                              <span className="px-1.5 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600">
                                بدون صلاحية
                              </span>
                            ) : (
                              <span className={`px-1.5 py-0.5 rounded-md font-bold ${
                                isExpired ? 'bg-red-100 text-red-700' : 
                                isExpiringSoon ? 'bg-amber-100 text-amber-700' : 
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {new Date(item.expiryDate).toLocaleDateString('ar-SA')}
                                {isExpired && ' (منتهي)'}
                                {isExpiringSoon && ` (${daysUntilExpiry} يوم)`}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => { setStockForm({...stockForm, items: stockForm.items.filter((_, i) => i !== idx)}); }} className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-50 group-hover:opacity-100"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </ModalWrapper>
      
      {/* Stock-In Exit Confirmation Dialog */}
      <AnimatePresence>
        {showStockInExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle size={24} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-800 font-tajawal mb-1">تنبيه: بيانات غير معتمدة</h4>
                    <p className="text-sm text-slate-600 font-readex leading-relaxed">
                      {stockForm.items.length > 0 
                        ? `يوجد ${stockForm.items.length} صنف غير معتمد في الجدول. هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات.`
                        : 'هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStockInExitConfirm(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-all font-readex"
                >
                  إلغاء والعودة
                </button>
                <button
                  type="button"
                  onClick={performStockInReset}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-md transition-all font-tajawal"
                >
                  تأكيد الإغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Centered Item Not Found Confirmation Prompt */}
      <AnimatePresence>
        {showNewItemPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <Package size={24} className="text-amber-600" />
                </div>
                <h4 className="text-base font-bold text-slate-800 font-tajawal mb-2">صنف غير مسجل</h4>
                <p className="text-sm text-slate-600 font-readex leading-relaxed">
                  الصنف "<span className="font-bold text-slate-800">{promptItemName}</span>" غير مسجل. هل تود إضافته؟
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePromptYes}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md transition-all font-tajawal"
                >
                  نعم
                </button>
                <button
                  type="button"
                  onClick={handlePromptNo}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-all font-readex"
                >
                  لا
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Item Registration Dialog */}
      <AnimatePresence>
        {showNewItemRegistration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Package size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800 font-tajawal">تسجيل صنف جديد</h4>
                    <p className="text-xs text-slate-600 font-readex">"{newItemData.name}"</p>
                  </div>
                </div>
              </div>
              
              <div className="px-5 py-4">
                <div className="space-y-3" ref={newItemRegistrationRef}>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">اسم الصنف</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2.5 py-2 outline-none transition-all duration-300 text-center"
                      value={newItemData.name}
                      onChange={(e) => setNewItemData({...newItemData, name: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRegisterNewItem();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowNewItemRegistration(false);
                          if (registrationSource === 'stockIn') setTimeout(() => stockSearchInputRef.current?.focus(), 50);
                          else if (registrationSource === 'invoice') setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
                          else setTimeout(() => returnSearchInputRef.current?.focus(), 50);
                        }
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الشركة <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2.5 py-2 outline-none transition-all duration-300 text-center"
                      value={newItemData.company}
                      onChange={(e) => setNewItemData({...newItemData, company: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRegisterNewItem();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowNewItemRegistration(false);
                          if (registrationSource === 'stockIn') setTimeout(() => stockSearchInputRef.current?.focus(), 50);
                          else if (registrationSource === 'invoice') setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
                          else setTimeout(() => returnSearchInputRef.current?.focus(), 50);
                        }
                      }}
                      placeholder="اسم الشركة أو العلامة التجارية"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">القسم <span className="text-red-500">*</span></label>
                    <select
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2.5 py-2 outline-none transition-all duration-300 text-center"
                      value={newItemData.cat}
                      onChange={(e) => {
                        setNewItemData({...newItemData, cat: e.target.value});
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRegisterNewItem();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowNewItemRegistration(false);
                          if (registrationSource === 'stockIn') setTimeout(() => stockSearchInputRef.current?.focus(), 50);
                          else if (registrationSource === 'invoice') setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
                          else setTimeout(() => returnSearchInputRef.current?.focus(), 50);
                        }
                      }}
                    >
                      <option value="">اختر القسم...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الوحدة</label>
                    <select
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/20 block px-2.5 py-2 outline-none transition-all duration-300 text-center"
                      value={newItemData.unit}
                      onChange={(e) => setNewItemData({...newItemData, unit: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRegisterNewItem();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowNewItemRegistration(false);
                          if (registrationSource === 'stockIn') setTimeout(() => stockSearchInputRef.current?.focus(), 50);
                          else if (registrationSource === 'invoice') setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
                          else setTimeout(() => returnSearchInputRef.current?.focus(), 50);
                        }
                      }}
                    >
                      <option value="كرتونة">كرتونة</option>
                      <option value="قطعة">قطعة</option>
                      <option value="كيلو">كيلو</option>
                      <option value="لتر">لتر</option>
                      <option value="طرد">طرد</option>
                      <option value="علبة">علبة</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewItemRegistration(false);
                    // Return focus to the appropriate search field
                    if (registrationSource === 'stockIn') {
                      setCurrentStockItem({name:'', selectedItem: null, cat:'', unit:'', qty:'', expiryDate: ''});
                      setTimeout(() => stockSearchInputRef.current?.focus(), 50);
                    } else if (registrationSource === 'invoice') {
                      setCurrentInvoiceItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
                      setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
                    } else if (registrationSource === 'return') {
                      setReturnForm({...returnForm, query: '', selectedItem: null, cat: '', unit: ''});
                      setTimeout(() => returnSearchInputRef.current?.focus(), 50);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-white transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleRegisterNewItem}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md transition-all"
                >
                  تسجيل ومتابعة
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. New Invoice (Compact Layout with Hybrid Search) */}
      <ModalWrapper 
        title={isVoucherInvoice ? "فاتورة من سند (مراجعة)" : "إنشاء فاتورة صادر (تلقيم احترافي)"} 
        maxWidth="max-w-6xl" 
        isOpen={isSalesModalOpen} 
        onClose={handleCloseInvoiceModal} 
        onSubmit={handleAddInvoice} 
        compact
      >
          {/* Header Fields - Read-only recipient when from voucher */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
             <div>
               <label className={LabelClass}>جهة العميل / المستلم <span className="text-red-500">*</span></label>
               <input
                 type="text"
                 className={`${InputClass} py-2.5 text-center ${isVoucherInvoice ? 'bg-slate-100 cursor-not-allowed' : ''} ${!invoiceForm.rep.trim() ? 'border-red-300 ring-2 ring-red-500/10' : ''}`}
                 value={invoiceForm.rep}
                 readOnly={isVoucherInvoice}
                 onChange={(e) => {
                   setInvoiceForm({...invoiceForm, rep: e.target.value});
                   if (e.target.value.trim()) setInvoiceErrors(prev => ({...prev, recipient: false}));
                 }}
                 placeholder="اسم العميل أو المستلم"
               />
             </div>
             <div><label className={LabelClass}>تاريخ الفاتورة</label><input type="date" className={`${InputClass} py-2.5 text-center ${isVoucherInvoice ? 'bg-slate-100 cursor-not-allowed' : ''}`} value={invoiceForm.date} onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})} readOnly={isVoucherInvoice} /></div>
          </div>

          {/* Item Entry Section - Hidden when from voucher */}
          {!isVoucherInvoice && (
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-3 shadow-sm">
             <h4 className="text-xs font-bold text-blue-700 mb-2">إضافة صنف للفاتورة</h4>
             <div className="flex flex-wrap items-end gap-2.5">
               {/* Search Field */}
               <div className="flex-1 min-w-[200px] relative group/item">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">البحث عن الصنف</label>
                 <input
                   ref={invoiceSearchInputRef}
                   type="text"
                   id="invoiceSearchInput"
                   className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 block px-2.5 py-2 outline-none transition-all duration-300 placeholder:text-slate-400 text-center"
                   placeholder="اكتب للبحث أو إضافة صنف جديد..."
                   value={currentInvoiceItem.name}
                   onChange={(e) => {
                     setCurrentInvoiceItem({...currentInvoiceItem, name: e.target.value, selectedItem: null, cat: '', unit: ''});
                     setInvoiceSearchActiveIndex(-1);
                     if (currentInvoiceItem.selectedItem) {
                       setCurrentInvoiceItem(prev => ({...prev, selectedItem: null, cat: '', unit: ''}));
                     }
                   }}
                   onBlur={() => {
                     if (currentInvoiceItem.name.trim().length >= 2 && !currentInvoiceItem.selectedItem) {
                       const matchFound = items.some(i =>
                         i.name.includes(currentInvoiceItem.name) ||
                         i.company.includes(currentInvoiceItem.name)
                       );
                       if (!matchFound) {
                         triggerNewItemRegistration(currentInvoiceItem.name.trim(), 'invoice');
                       }
                     }
                   }}
                   onKeyDown={(e) => {
                     const suggestions = items.filter(i => i.name.includes(currentInvoiceItem.name) || i.company.includes(currentInvoiceItem.name));
                     if (e.key === 'ArrowDown') { e.preventDefault(); setInvoiceSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); }
                     else if (e.key === 'ArrowUp') { e.preventDefault(); setInvoiceSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                     else if (e.key === 'Enter') {
                       e.preventDefault();
                       if (invoiceSearchActiveIndex >= 0 && suggestions[invoiceSearchActiveIndex]) {
                         const invItem = suggestions[invoiceSearchActiveIndex];
                         setCurrentInvoiceItem({ ...currentInvoiceItem, name: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat || invItem.category || '', unit: invItem.unit || 'كرتونة' });
                         setInvoiceSearchActiveIndex(-1);
                       } else if (suggestions.length === 0 && currentInvoiceItem.name.trim().length >= 2) {
                         triggerNewItemRegistration(currentInvoiceItem.name.trim(), 'invoice');
                       } else if (currentInvoiceItem.selectedItem) {
                         setTimeout(() => document.getElementById('invoiceQtyInput')?.focus(), 10);
                       }
                     } else if (e.key === 'Tab') {
                       setTimeout(() => document.getElementById('invoiceQtyInput')?.focus(), 10);
                     }
                   }}
                 />
                 {currentInvoiceItem.name && !currentInvoiceItem.selectedItem && (
                   <div className="hidden group-focus-within/item:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200 z-30 p-0.5">
                     {items.filter(i => i.name.includes(currentInvoiceItem.name) || i.company.includes(currentInvoiceItem.name)).map((invItem, idx) => (
                          <button key={invItem.id} type="button" className={`w-full text-right px-2.5 py-1.5 border-b border-slate-50 last:border-0 transition-colors ${invoiceSearchActiveIndex === idx ? 'bg-blue-50' : 'hover:bg-slate-50'}`} onMouseDown={(e) => {
                            e.preventDefault();
                            setCurrentInvoiceItem({
                              ...currentInvoiceItem,
                              name: `${invItem.name} - ${invItem.company}`,
                              selectedItem: invItem,
                              cat: invItem.cat || invItem.category || '',
                              unit: invItem.unit || 'كرتونة'
                            });
                            setInvoiceSearchActiveIndex(-1);
                            setTimeout(() => { document.getElementById('invoiceQtyInput')?.focus(); }, 10);
                          }}>
                            <div className="flex justify-between items-center w-full">
                              <span className="text-xs font-bold text-slate-800">{invItem.name}</span> <span className="text-[10px] text-slate-500">- {invItem.company}</span>
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">المتوفر: {invItem.stockQty}</span>
                            </div>
                          </button>
                     ))}
                   </div>
                 )}
               </div>

               {/* Category Field */}
               <div className="w-[100px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">القسم</label>
                 {currentInvoiceItem.selectedItem ? (
                   <input type="text" className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl block px-2.5 py-2 outline-none cursor-default text-center" value={currentInvoiceItem.cat} readOnly placeholder="تلقائي" />
                 ) : (
                   <select className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 block px-2 py-2 outline-none transition-all duration-300 text-center" value={currentInvoiceItem.cat} onChange={(e) => setCurrentInvoiceItem({...currentInvoiceItem, cat: e.target.value})}>
                     <option value="">اختر...</option>
                     {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                   </select>
                 )}
               </div>

               {/* Unit Field */}
               <div className="w-[90px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الوحدة</label>
                 {currentInvoiceItem.selectedItem ? (
                   <input type="text" className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl block px-2.5 py-2 outline-none cursor-default text-center" value={currentInvoiceItem.unit} readOnly placeholder="تلقائي" />
                 ) : (
                   <input type="text" className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 block px-2 py-2 outline-none transition-all duration-300 text-center" value={currentInvoiceItem.unit} onChange={(e) => setCurrentInvoiceItem({...currentInvoiceItem, unit: e.target.value})} placeholder="كرتونة" />
                 )}
               </div>

               {/* Quantity Field - Fixed Width */}
               <div className="w-[75px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الكمية <span className="text-red-500">*</span></label>
                 <input
                   type="number"
                   id="invoiceQtyInput"
                   className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 block px-2 py-2 outline-none transition-all duration-300 placeholder:text-slate-400 text-center font-bold tabular-nums"
                   placeholder="0"
                   maxLength={4}
                   value={currentInvoiceItem.qty}
                   onChange={(e) => { if (e.target.value.length <= 4) setCurrentInvoiceItem({...currentInvoiceItem, qty: e.target.value}); }}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') { e.preventDefault(); handleAddInvoiceItemToTable(); }
                   }}
                 />
               </div>

               {/* Add Button */}
               <div className="w-[44px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">إضافة</label>
                 <button
                   type="button"
                   className="w-9 h-9 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center hover:scale-105 active:scale-95"
                   onClick={handleAddInvoiceItemToTable}
                   title="إضافة للفاتورة"
                 >
                   <Plus size={18} strokeWidth={2.5} />
                 </button>
               </div>
             </div>
          </div>
          )}

          {/* Middle Section (The Table - Maximized Height) */}
          <div className="card overflow-hidden flex flex-col flex-1 min-h-[45vh]">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between shrink-0 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-700">الأصناف الصادرة ({invoiceForm.items.length})</h4>
              {!isVoucherInvoice && invoiceForm.items.length > 0 && (
                <button type="button" onClick={() => { setInvoiceForm(prev => ({...prev, items: []})); toast.info("تم مسح القائمة"); }} className="text-[10px] text-red-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-all font-bold">مسح القائمة</button>
              )}
            </div>
            <div className="overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full min-w-max text-right text-xs whitespace-nowrap">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-600 border-b border-slate-200">
                    <th className="px-3 py-2 font-bold w-10 text-center">#</th>
                    <th className="px-3 py-2 font-bold min-w-[180px]">اسم الصنف</th>
                    <th className="px-3 py-2 font-bold w-24">القسم</th>
                    <th className="px-3 py-2 font-bold w-20">الوحدة</th>
                    <th className="px-3 py-2 font-bold w-24 text-center">الكمية</th>
                    {!isVoucherInvoice && <th className="px-3 py-2 font-bold w-14 text-center">إجراء</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoiceForm.items.length === 0 ? (
                    <tr>
                      <td colSpan={isVoucherInvoice ? 5 : 6} className="text-center py-10 text-slate-400 text-[10px] font-bold">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <Package size={28} className="mb-1.5" />
                          {isVoucherInvoice ? 'لا توجد أصناف منقولة من السند' : 'لم يتم إضافة أصناف للفاتورة بعد'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    invoiceForm.items.map((item, idx) => (
                      <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors group">
                        <td className="px-3 py-2 text-[10px] font-bold text-slate-500 text-center">{idx + 1}</td>
                        <td className="px-3 py-2 text-xs font-bold text-slate-800">
                          {item.name && item.company ? `${item.name} - ${item.company}` : (item.name || item.item || '-')}
                        </td>
                        <td className="px-3 py-2 text-[10px]">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-bold">{item.cat}</span>
                        </td>
                        <td className="px-3 py-2 text-[10px] text-slate-600">{item.unit}</td>
                        <td className="px-3 py-2 text-xs font-bold text-red-600 border-r border-slate-100 text-center">
                          {isVoucherInvoice ? item.qty : `-${item.qty}`}
                        </td>
                        {!isVoucherInvoice && (
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => { setInvoiceForm({...invoiceForm, items: invoiceForm.items.filter((_, i) => i !== idx)}); }} className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-50 group-hover:opacity-100"><Trash2 size={14} /></button>
                        </td>
                        )}
                        {isVoucherInvoice && (
                        <td className="px-3 py-2 text-center">
                          <span className="text-[10px] text-slate-400">🔒</span>
                        </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

      </ModalWrapper>
      
      {/* Invoice Exit Confirmation Dialog */}
      <AnimatePresence>
        {showInvoiceExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle size={24} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-800 font-tajawal mb-1">تنبيه: بيانات غير معتمدة</h4>
                    <p className="text-sm text-slate-600 font-readex leading-relaxed">
                      {invoiceForm.items.length > 0 
                        ? `يوجد ${invoiceForm.items.length} صنف غير معتمد في الفاتورة. هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات.`
                        : 'هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowInvoiceExitConfirm(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-all font-readex">إلغاء والعودة</button>
                <button type="button" onClick={performInvoiceReset} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-md transition-all font-tajawal">تأكيد الإغلاق</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Add Return (Compact Layout with Hybrid Search & Intelligent Expiry) */}
      <ModalWrapper title="تسجيل مرتجع مخزني" maxWidth="max-w-6xl" isOpen={isReturnsModalOpen} onClose={handleCloseReturnModal} onSubmit={handleAddReturn} compact>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
             <div>
               <label className={LabelClass}>اسم المرجع / العميل <span className="text-red-500">*</span></label>
               <input 
                 type="text" 
                 className={`${InputClass} py-2.5 text-center ${!returnForm.returnee.trim() ? 'border-red-300 ring-2 ring-red-500/10' : ''}`} 
                 value={returnForm.returnee} 
                 onChange={(e) => {
                   setReturnForm({...returnForm, returnee: e.target.value});
                   if (e.target.value.trim()) setReturnErrors(prev => ({...prev, returnee: false}));
                 }} 
                 placeholder="اسم الشخص أو الجهة المرجعة"
               />
             </div>
             <div><label className={LabelClass}>تاريخ الإرجاع</label><input type="date" className={`${InputClass} py-2.5 text-center`} value={returnForm.date} onChange={(e) => setReturnForm({...returnForm, date: e.target.value})} /></div>
          </div>

          {/* Top Section (Fixed Entry - Compact Style) */}
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 mb-3 shadow-sm">
             <h4 className="text-xs font-bold text-amber-700 mb-2">إضافة صنف مرتجع</h4>
             <div className="flex flex-wrap items-end gap-2.5">
               {/* Search Field */}
               <div className="flex-1 min-w-[200px] relative group/ret">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">البحث عن صنف</label>
                 <input
                   ref={returnSearchInputRef}
                   type="text"
                   id="returnSearchInput"
                   className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/20 block px-2.5 py-2 outline-none transition-all duration-300 placeholder:text-slate-400 text-center"
                   placeholder="اكتب للبحث أو إضافة صنف جديد..."
                   value={returnForm.query}
                   onChange={(e) => {
                     setReturnForm({...returnForm, query: e.target.value, selectedItem: null, cat: '', unit: ''});
                     setReturnSearchActiveIndex(-1);
                     if (returnForm.selectedItem) {
                       setReturnForm(prev => ({...prev, selectedItem: null, cat: '', unit: ''}));
                     }
                   }}
                   onBlur={() => {
                     if (returnForm.query.trim().length >= 2 && !returnForm.selectedItem) {
                       const matchFound = items.some(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query));
                       if (!matchFound) {
                         // Show toast confirmation instead of directly opening modal
                         triggerNewItemRegistration(returnForm.query.trim(), 'return');
                       }
                     }
                   }}
                   onKeyDown={(e) => {
                     const suggestions = items.filter(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query));
                     if (e.key === 'ArrowDown') { e.preventDefault(); setReturnSearchActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); }
                     else if (e.key === 'ArrowUp') { e.preventDefault(); setReturnSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                     else if (e.key === 'Enter') {
                       e.preventDefault();
                       if (returnSearchActiveIndex >= 0 && suggestions[returnSearchActiveIndex]) {
                         const invItem = suggestions[returnSearchActiveIndex];
                         const isReturnExpiryDisabled = invItem.cat === 'بلاستيك';
                         setReturnForm({...returnForm, query: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat || invItem.category || '', unit: invItem.unit || 'كرتونة', expiryDate: isReturnExpiryDisabled ? '' : '' });
                         setReturnSearchActiveIndex(-1);
                       } else if (suggestions.length === 0 && returnForm.query.trim().length >= 2) {
                         // Show toast confirmation instead of directly opening modal
                         triggerNewItemRegistration(returnForm.query.trim(), 'return');
                       } else if (returnForm.selectedItem) {
                         setTimeout(() => document.getElementById('returnQtyInput')?.focus(), 10);
                       }
                     } else if (e.key === 'Tab') {
                       setTimeout(() => document.getElementById('returnQtyInput')?.focus(), 10);
                     }
                   }}
                 />
                 {returnForm.query && !returnForm.selectedItem && (
                   <div className="hidden group-focus-within/ret:block absolute top-[100%] right-0 w-full max-h-48 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200 z-30 p-0.5">
                     {items.filter(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query)).map((invItem, idx) => (
                          <button key={invItem.id} type="button" className={`w-full text-right px-2.5 py-1.5 border-b border-slate-50 last:border-0 transition-colors ${returnSearchActiveIndex === idx ? 'bg-amber-50' : 'hover:bg-slate-50'}`} onMouseDown={(e) => {
                            e.preventDefault();
                            const isReturnExpiryDisabled = invItem.cat === 'بلاستيك';
                            setReturnForm({...returnForm, query: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat || invItem.category || '', unit: invItem.unit || 'كرتونة', expiryDate: isReturnExpiryDisabled ? '' : '' });
                            setReturnSearchActiveIndex(-1);
                            setTimeout(() => { document.getElementById('returnQtyInput')?.focus(); }, 10);
                          }}>
                            <div className="flex justify-between items-center w-full">
                              <span className="text-xs font-bold text-slate-800">{invItem.name}</span> <span className="text-[10px] text-slate-500">- {invItem.company}</span>
                              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{invItem.cat}</span>
                            </div>
                          </button>
                     ))}
                   </div>
                 )}
               </div>

               {/* Category Field */}
               <div className="w-[100px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">القسم</label>
                 {returnForm.selectedItem ? (
                   <input type="text" className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl block px-2.5 py-2 outline-none cursor-default text-center" value={returnForm.cat} readOnly placeholder="تلقائي" />
                 ) : (
                   <select className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/20 block px-2 py-2 outline-none transition-all duration-300 text-center" value={returnForm.cat} onChange={(e) => setReturnForm({...returnForm, cat: e.target.value})}>
                     <option value="">اختر...</option>
                     {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                   </select>
                 )}
               </div>

               {/* Unit Field */}
               <div className="w-[90px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الوحدة</label>
                 {returnForm.selectedItem ? (
                   <input type="text" className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl block px-2.5 py-2 outline-none cursor-default text-center" value={returnForm.unit || 'كرتونة'} readOnly placeholder="تلقائي" />
                 ) : (
                   <input type="text" className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/20 block px-2 py-2 outline-none transition-all duration-300 text-center" value={returnForm.unit || 'كرتونة'} onChange={(e) => setReturnForm({...returnForm, unit: e.target.value})} placeholder="كرتونة" />
                 )}
               </div>

               {/* Quantity Field - Fixed Width */}
               <div className="w-[75px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">الكمية <span className="text-red-500">*</span></label>
                 <input 
                   type="number" 
                   id="returnQtyInput" 
                   className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/20 block px-2 py-2 outline-none transition-all duration-300 placeholder:text-slate-400 text-center font-bold tabular-nums" 
                   placeholder="0" 
                   maxLength={4}
                   value={returnForm.qty} 
                   onChange={(e) => { if (e.target.value.length <= 4) setReturnForm({...returnForm, qty: e.target.value}); }} 
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') { e.preventDefault(); handleAddReturnItemToTable(); }
                   }} 
                 />
               </div>

               {/* Add Button */}
               <div className="w-[44px] shrink-0">
                 <label className="block text-[10px] font-bold text-slate-600 mb-1 text-center">إضافة</label>
                 <button
                   type="button"
                   className="w-9 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center hover:scale-105 active:scale-95"
                   onClick={handleAddReturnItemToTable}
                   title="إضافة للمرتجع"
                 >
                   <Plus size={18} strokeWidth={2.5} />
                 </button>
               </div>
             </div>
          </div>

          {/* Middle Section (The Table - Maximized Height) */}
          <div className="card overflow-hidden flex flex-col flex-1 min-h-[45vh]">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between shrink-0 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-700">الأصناف المرتجعة ({returnItems.length})</h4>
              {returnItems.length > 0 && (
                <button type="button" onClick={() => { setReturnItems([]); toast.info("تم مسح القائمة"); }} className="text-[10px] text-red-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-all font-bold">مسح القائمة</button>
              )}
            </div>
            <div className="overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full min-w-max text-right text-xs whitespace-nowrap">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-600 border-b border-slate-200">
                    <th className="px-3 py-2 font-bold w-10 text-center">#</th>
                    <th className="px-3 py-2 font-bold min-w-[180px]">اسم الصنف</th>
                    <th className="px-3 py-2 font-bold w-24">القسم</th>
                    <th className="px-3 py-2 font-bold w-20">الوحدة</th>
                    <th className="px-3 py-2 font-bold w-20 text-center">الكمية</th>
                    <th className="px-3 py-2 font-bold w-14 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {returnItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400 text-[10px] font-bold">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <RotateCcw size={28} className="mb-1.5" />
                          لم يتم إضافة أصناف مرتجعة بعد
                        </div>
                      </td>
                    </tr>
                  ) : (
                    returnItems.map((item, idx) => (
                      <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors group">
                        <td className="px-3 py-2 text-[10px] font-bold text-slate-500 text-center">{idx + 1}</td>
                        <td className="px-3 py-2 text-xs font-bold text-slate-800">
                          {item.name && item.company ? `${item.name} - ${item.company}` : (item.name || '-')}
                        </td>
                        <td className="px-3 py-2 text-[10px]">
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold">{item.cat}</span>
                        </td>
                        <td className="px-3 py-2 text-[10px] text-slate-600">{item.unit}</td>
                        <td className="px-3 py-2 text-xs font-bold text-emerald-600 border-r border-slate-100 text-center">+{item.qty}</td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => { setReturnItems(prev => prev.filter((_, i) => i !== idx)); }} className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-50 group-hover:opacity-100"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Footer with Confirmation */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-3 shrink-0">
            {returnItems.length > 0 && (
              <button 
                type="submit" 
                disabled={!returnForm.returnee.trim()}
                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                حفظ واعتماد {returnItems.length} صنف
              </button>
            )}
          </div>
      </ModalWrapper>
      
      {/* Return Exit Confirmation Dialog */}
      <AnimatePresence>
        {showReturnExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle size={24} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-800 font-tajawal mb-1">تنبيه: بيانات غير معتمدة</h4>
                    <p className="text-sm text-slate-600 font-readex leading-relaxed">
                      {returnItems.length > 0 
                        ? `يوجد ${returnItems.length} صنف غير معتمد في المرتجع. هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات.`
                        : 'هل أنت متأكد من الإغلاق؟ سيتم فقدان البيانات.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowReturnExitConfirm(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 transition-all font-readex">إلغاء والعودة</button>
                <button type="button" onClick={performReturnReset} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-md transition-all font-tajawal">تأكيد الإغلاق</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

    </div>
  );
}



