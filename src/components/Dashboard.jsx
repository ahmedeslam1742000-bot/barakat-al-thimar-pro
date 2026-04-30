import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, Truck, AlertTriangle, ArrowUpRight, ArrowDownRight, ArrowDownLeft,
  Plus, X, FileText, RotateCcw, Search, Trash2, Bell, Clock, CheckCircle2, AlertOctagon,
  Timer, History, ChevronDown, Layers, FileCheck, FileInput, Download, Upload, FileOutput, Pencil, Image, Loader2, Eye, CheckCircle, Save, List, Printer, User, Box, Calendar, RefreshCw,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio } from '../contexts/AudioContext';
import { formatDate } from '../lib/dateUtils';

import { supabase } from '../lib/supabaseClient';

// Utility Imports
import { normalizeArabic, checkNearDuplicates } from '../lib/arabicTextUtils';
import { useDebounce } from '../hooks/useDebounce';
import StockInwardModal from './StockInwardModal';

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

const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, onEnter, maxWidth = "max-w-4xl", isSubmitDisabled = false, compact = false, loading = false, submitLabel = "حفظ البيانات" }) => {
  const handleFormSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onSubmit) onSubmit(e);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0F2747]/60 backdrop-blur-md transition-all duration-300"
          dir="rtl" onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.4)] border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden`}
          >
            <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-2xl font-black font-tajawal text-[#0F2747] dark:text-white tracking-tight">{title}</h3>
              </div>
              <button type="button" onClick={onClose} className="p-3 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 rounded-2xl transition-all active:scale-90">
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} noValidate className="flex-1 flex flex-col overflow-hidden">
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 relative bg-white dark:bg-slate-900">{children}</div>
                
                <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
                    <button 
                      type="button" 
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl text-sm font-black text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-all active:scale-95"
                    >
                      إلغاء
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitDisabled || loading} 
                      className="px-8 py-2.5 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
                    >
                      {loading ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> جاري الحفظ...</> : <><CheckCircle2 size={18} /> {submitLabel}</>}
                    </button>
                </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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
  const [showHistory, setShowHistory] = useState(false);
  const [showVoucherHistory, setShowVoucherHistory] = useState(false);

  const [locations, setLocations] = useState(['مستودع الرياض', 'مستودع جدة', 'المركز الرئيسي', 'مورد خارجي']);
  const [stockSearchActiveIndex, setStockSearchActiveIndex] = useState(-1);

  // Modals Data State
  const [itemForm, setItemForm] = useState({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة' });
  const [itemErrors, setItemErrors] = useState({});
  
  // Batch Entry State
  const [sessionItems, setSessionItems] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [activeNameIdx, setActiveNameIdx] = useState(-1);
  const [activeCompIdx, setActiveCompIdx] = useState(-1);
  const itemNameInputRef = useRef(null);
  const companyInputRef = useRef(null);
  const catSelectRef = useRef(null);
  const unitInputRef = useRef(null);

  // Dynamic Categories & Units State
  const [categories, setCategories] = useState(['مجمدات', 'تبريد', 'بلاستيك']);
  const [units, setUnits] = useState(['كرتونة', 'حبة', 'سطل', 'شوال', 'شدة']);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const newCategoryInputRef = useRef(null);

  // Exit Guard State
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);


  const [invoiceForm, setInvoiceForm] = useState({ client: '', rep: '', date: new Date().toISOString().split('T')[0], items: [] });
  const [currentInvoiceItem, setCurrentInvoiceItem] = useState({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
  const [invoiceErrors, setInvoiceErrors] = useState({});
  const [isVoucherInvoice, setIsVoucherInvoice] = useState(false); 
  const [showInvoiceExitConfirm, setShowInvoiceExitConfirm] = useState(false);
  const invoiceSearchInputRef = useRef(null);

  const [returnForm, setReturnForm] = useState({ rep: '', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', reason: 'سليم (يعود للمخزون)', cat: '', returnee: '' });
  const [returnErrors, setReturnErrors] = useState({});
  const [returnItems, setReturnItems] = useState([]);
  const [showReturnExitConfirm, setShowReturnExitConfirm] = useState(false);
  const [showInvoiceSaveConfirm, setShowInvoiceSaveConfirm] = useState(false);
  const [showReturnSaveConfirm, setShowReturnSaveConfirm] = useState(false);
  const returnSearchInputRef = useRef(null);

  // Safety reset on open to prevent data persistence
  useEffect(() => {
    if (isSalesModalOpen && !isVoucherInvoice) {
      setInvoiceForm({ client: 'سحب مندوب', rep: '', date: new Date().toISOString().split('T')[0], items: [] });
      setCurrentInvoiceItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
      setInvoiceErrors({});
    }
  }, [isSalesModalOpen, isVoucherInvoice]);

  useEffect(() => {
    if (isReturnsModalOpen) {
      setReturnForm({ rep: '', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', returnStatus: 'سليم', cat: '', returnee: '', unit: '' });
      setReturnItems([]);
      setReturnErrors({});
    }
  }, [isReturnsModalOpen]);

  useEffect(() => {
    console.log("MODAL_STATE_CHANGE:", { 
      showInvoiceExitConfirm, 
      showReturnExitConfirm, 
      showInvoiceSaveConfirm, 
      showReturnSaveConfirm,
      isSalesModalOpen,
      isReturnsModalOpen
    });
  }, [showInvoiceExitConfirm, showReturnExitConfirm, showInvoiceSaveConfirm, showReturnSaveConfirm, isSalesModalOpen, isReturnsModalOpen]);

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


  
  // Trigger new item registration with centered confirmation prompt
  const triggerNewItemRegistration = (itemName, source) => {
    setPromptItemName(itemName);
    setPromptSource(source);
    setShowNewItemPrompt(true);
  };
  
  const handlePromptYes = () => {
    setShowNewItemPrompt(false);
    setItemForm({ name: promptItemName, company: '', cat: categories[0], unit: units[0] });
    setIsItemModalOpen(true);
    setTimeout(() => companyInputRef.current?.focus(), 150);
  };
  
  const handlePromptNo = () => {
    setShowNewItemPrompt(false);
    // Clear search and return focus
    if (promptSource === 'invoice') {
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
  

  const [invoiceSearchActiveIndex, setInvoiceSearchActiveIndex] = useState(-1);
  const [returnSearchActiveIndex, setReturnSearchActiveIndex] = useState(-1);
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false);
  const [selectedBatchTransactions, setSelectedBatchTransactions] = useState([]);
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
  const [repsList, setRepsList] = useState([]);

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
        if (isTransactionDetailOpen) setIsTransactionDetailOpen(false);
        if (isVoucherDetailOpen) setIsVoucherDetailOpen(false); setShowVoucherHistory(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isItemModalOpen, isStockInModalOpen, isTransactionDetailOpen, isVoucherDetailOpen]);

  
  // Keyboard shortcuts for confirmation modals
  useEffect(() => {
    const handleConfirmKeys = (e) => {
      if (showInvoiceExitConfirm) {
        if (e.key === 'Enter') { e.preventDefault(); performInvoiceReset(); }
        if (e.key === 'Escape') { e.preventDefault(); setShowInvoiceExitConfirm(false); }
      } else if (showReturnExitConfirm) {
        if (e.key === 'Enter') { e.preventDefault(); performReturnReset(); }
        if (e.key === 'Escape') { e.preventDefault(); setShowReturnExitConfirm(false); }
      } else if (showInvoiceSaveConfirm) {
        if (e.key === 'Enter' && !loading) { e.preventDefault(); performInvoiceSave(); }
        if (e.key === 'Escape') { e.preventDefault(); setShowInvoiceSaveConfirm(false); }
      } else if (showReturnSaveConfirm) {
        if (e.key === 'Enter' && !loading) { e.preventDefault(); performReturnSave(); }
        if (e.key === 'Escape') { e.preventDefault(); setShowReturnSaveConfirm(false); }
      }
    };
    window.addEventListener('keydown', handleConfirmKeys);
    return () => window.removeEventListener('keydown', handleConfirmKeys);
  }, [showInvoiceExitConfirm, showReturnExitConfirm, showInvoiceSaveConfirm, showReturnSaveConfirm, loading]);

  // Keyboard shortcuts for Voucher Detail modal
  useEffect(() => {
    const handleVoucherDetailKeys = (event) => {
      if (!isVoucherDetailOpen) return;
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        setIsVoucherDetailOpen(false); setShowVoucherHistory(false);
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
    try {
      console.log("🔍 Dashboard: fetching initial data...");
      const { data: repsData } = await supabase.from('reps').select('name');
      if (repsData) setRepsList(repsData.map(r => r.name));
      const { data: itemsData, error: itemsError } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty, search_key, created_at');
      if (itemsError) throw itemsError;
      if (itemsData) {
        setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty, searchKey: d.search_key, createdAt: d.created_at })));
      }
      
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('id, type, timestamp, item, company, qty, unit, cat, supplier, beneficiary, loc, location, rep, recipient, reference_number, batch_id, is_summary, item_id, notes, status')
        .order('timestamp', { ascending: false })
        .limit(200);
        
      if (transError) throw transError;
      if (transData) {
        setDbTransactionsList(transData.map(d => ({ 
          ...d, 
          itemId: d.item_id, 
          referenceNumber: d.reference_number,
          voucherCode: d.reference_number || '',
          voucherGroupId: d.batch_id,
          batchId: d.batch_id,
          isInvoice: d.status === 'مفوتر' || (d.notes && d.notes.includes('[تم إصدار الفاتورة]')),
          isFunctional: d.type === 'سند إدخال' || d.type === 'سند إخراج' || d.type === 'outward' || d.type === 'in' || (d.item && (d.item.includes('ملخص') || d.item.includes('عهده'))),
          isEdited: (d.notes && d.notes.includes('[تعديل حديث]')),
          historyLog: (() => {
            if (!d.notes) return null;
            const match = d.notes.match(/<!--(\{.*\})-->/);
            if (match) {
              try { return JSON.parse(match[1]); } catch(e) { return null; }
            }
            return null;
          })()
        })));
      }
    } catch (err) {
      console.error("❌ Dashboard: Error fetching initial data:", err);
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
        clientName: tx.rep || tx.loc || tx.beneficiary || 'غير محدد',
        itemName: tx.item || 'صنف غير محدد',
        quantity: Number(tx.qty || 0),
        timestamp: txDate,
        batchId: tx.batchId,
        invoiced: tx.invoiced === true,
        voucherCode: tx.voucherCode || '',
      };
    });

    const normalizedVouchers = outboundTx
      .filter(v => v.documentary === true && (v.type === 'سند إخراج صوري' || v.type === 'Issue'))
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
      .filter(v => v.documentary === true && (v.type === 'سند إخراج صوري' || v.type === 'Issue'))
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
      if (tx.isFunctional !== true || !FUNCTIONAL_VOUCHER_TYPES.includes(tx.type) || tx.is_summary === true) return;

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
          invoiced: false, // Will be computed from all lines below
          deducted: false,
          isFunctional: true,
          line_note: tx.notes || '',
          lines: [],
        });
      }

      const group = groupedVouchers.get(groupId);
      group.lines.push({
        ...tx,
        quantity: Number(tx.qty || 0),
        timestamp: txDate,
      });
      // Mark as invoiced if ANY line has 'مفوتر' status OR invoice note (OR logic)
      const txIsInvoiced = 
        tx.status === 'مفوتر' || 
        tx.invoiced === true || 
        (tx.notes && (
          tx.notes.includes('[تمت الفوترة]') || 
          tx.notes.includes('[تم إصدار الفاتورة]')
        ));
      
      const txIsCancelled = tx.status === 'cancelled';

      if (txIsInvoiced) {
        group.invoiced = true;
        // Extract invoice date from notes if present
        if (tx.notes && tx.notes.includes('[تم إصدار الفاتورة: ')) {
          const match = tx.notes.match(/\[تم إصدار الفاتورة: (.*?)\]/);
          if (match && match[1]) group.invoiceDate = match[1];
        }
      }
      if (txIsCancelled) {
        group.isCancelled = true;
      }
      if (txDate > group.timestamp) group.timestamp = txDate;
    });

    return Array.from(groupedVouchers.values())
      .map((voucher) => {
        // Pick the note containing history JSON if available, fallback to first line's note
        const richNote = voucher.lines.find(l => (l.notes || '').includes('<!--'));
        if (richNote) voucher.line_note = richNote.notes;
        return {
          ...voucher,
          itemName: voucher.lines.map(line => line.item).join('، '),
          quantity: voucher.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [dbTransactionsList]);

  const pendingVouchers = useMemo(
    () => functionalVoucherGroups
      .filter(v => !v.invoiced && !v.isCancelled)
      .sort((a, b) => b.timestamp - a.timestamp),
    [functionalVoucherGroups]
  );

  const completedVouchers = useMemo(
    () => functionalVoucherGroups
      .filter(v => v.invoiced && !v.isCancelled)
      .sort((a, b) => b.timestamp - a.timestamp),
    [functionalVoucherGroups]
  );

  const cancelledVouchers = useMemo(
    () => functionalVoucherGroups
      .filter(v => v.isCancelled)
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
    .filter(t => t.is_summary !== true && t.status !== 'cancelled')
    .filter(t => t.type === 'in' || t.type === 'Restock' || (t.type === FUNCTIONAL_INBOUND_TYPE && t.isFunctional === true))
    .reduce((sum, t) => sum + Number(t.qty || 0), 0);

  const salesCount = dbTransactionsList
    .filter(t => t.is_summary !== true && t.status !== 'cancelled')
    .filter(t => t.type === 'out' || (t.type === 'Issue' && t.isInvoice === true) || (t.type === FUNCTIONAL_OUTBOUND_TYPE && t.isFunctional === true))
    .reduce((sum, t) => sum + Math.abs(Number(t.qty || 0)), 0);

  const returnsCount = dbTransactionsList
    .filter(t => t.is_summary !== true && t.type === 'Return' && t.status !== 'cancelled')
    .reduce((sum, t) => sum + Number(t.qty || 0), 0);

  const damageCount = dbTransactionsList
    .filter(t => t.is_summary !== true && t.status === 'مرتجع تالف' && t.status !== 'cancelled')
    .reduce((sum, t) => sum + Number(t.qty || 0), 0);



  // --- 1. HYBRID BATCH REGISTRATION HANDLERS ---
  const handleNameInput = (val) => {
    setItemForm(prev => ({ ...prev, name: val }));
    if (!val.trim()) { setNameSuggestions([]); return; }
    const filtered = [...new Set(items.map(i => i.name))]
      .filter(n => (normalizeArabic(n) || '').includes(normalizeArabic(val)))
      .slice(0, 5);
    setNameSuggestions(filtered);
    setActiveNameIdx(-1);
  };

  const handleCompanyInput = (val) => {
    setItemForm(prev => ({ ...prev, company: val }));
    if (!val.trim()) { setCompanySuggestions([]); return; }
    const filtered = [...new Set(items.map(i => i.company || 'بدون شركة'))]
      .filter(c => (normalizeArabic(c) || '').includes(normalizeArabic(val)))
      .slice(0, 5);
    setCompanySuggestions(filtered);
    setActiveCompIdx(-1);
  };

  const handleModalKeyDown = (e, type) => {
    if (showSaveConfirm || showExitConfirm) return; // Prevent input shortcuts when overlays are active
    const isName = type === 'name';
    const isCompany = type === 'company';
    const suggestions = isName ? nameSuggestions : (isCompany ? companySuggestions : []);
    const activeIdx = isName ? activeNameIdx : (isCompany ? activeCompIdx : -1);
    const setIdx = isName ? setActiveNameIdx : (isCompany ? setActiveCompIdx : () => {});
    const setInput = isName ? handleNameInput : (isCompany ? handleCompanyInput : () => {});
    const setSuggestions = isName ? setNameSuggestions : (isCompany ? setCompanySuggestions : () => {});

    if (e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setIdx(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setIdx(prev => (prev > 0 ? prev - 1 : -1));
      }
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        e.preventDefault();
        const selectedValue = suggestions[activeIdx];
        setInput(selectedValue);
        setSuggestions([]);
        // Auto-focus next field after selecting from suggestions with Enter
        if (isName) {
          setTimeout(() => companyInputRef.current?.focus(), 50);
        }
      } else if (isName && itemForm.name.trim()) {
        e.preventDefault();
        companyInputRef.current?.focus();
      } else if (itemForm.name.trim() && itemForm.company.trim()) {
        e.preventDefault();
        addToSession();
      }
    } else if (e.key === 'Tab') {
      setSuggestions([]);
    }
  };

  const addToSession = () => {
    if (!itemForm.name.trim() || !itemForm.company.trim()) {
      return toast.error('يرجى إكمال البيانات المطلوبة');
    }
    const normName = normalizeArabic(itemForm.name);
    const normComp = normalizeArabic(itemForm.company);
    
    // If not editing, check for duplicates
    if (!editingSessionId) {
      if (items.some(i => normalizeArabic(i.name) === normName && normalizeArabic(i.company || 'بدون شركة') === normComp)) {
        return toast.error('هذا الصنف مسجل مسبقاً');
      }
      if (sessionItems.some(i => normalizeArabic(i.name) === normName && normalizeArabic(i.company) === normComp)) {
        return toast.error('تم إضافة الصنف للقائمة بالفعل');
      }
      setSessionItems(prev => [...prev, { ...itemForm, id: Date.now() }]);
      toast.success('تم الإضافة للقائمة ✅');
    } else {
      // Update existing item in session
      setSessionItems(prev => prev.map(item => item.id === editingSessionId ? { ...itemForm, id: editingSessionId } : item));
      setEditingSessionId(null);
      toast.success('تم تحديث الصنف في القائمة ✅');
    }

    setItemForm(prev => ({ ...prev, name: '', company: '' }));
    setNameSuggestions([]);
    setCompanySuggestions([]);
    setTimeout(() => itemNameInputRef.current?.focus(), 50);
  };

  const handleRegisterBatchSave = async () => {
    if (sessionItems.length === 0) return toast.error('القائمة فارغة');
    setShowSaveConfirm(true);
  };

  const confirmRegisterBatchSave = async () => {
    setShowSaveConfirm(false);
    setLoading(true);
    try {
      for (const item of sessionItems) {
        const { data: insertedDoc } = await supabase.from('products').insert({
          name: item.name,
          company: item.company,
          cat: item.cat,
          unit: item.unit,
          stock_qty: 0,
          search_key: `${item.name} ${item.company}`.toLowerCase()
        }).select().single();

        await supabase.from('transactions').insert({
          type: 'adjust_in',
          item_id: insertedDoc.id,
          qty: 0,
          unit: item.unit,
          cat: item.cat,
          date: new Date().toISOString().split('T')[0],
          location: 'إداري',
          notes: 'تعريف صنف جديد',
          invoiced: false
        });
      }
      toast.success('تم التسجيل واعتماد القائمة بنجاح! ✅');
      setSessionItems([]);
      setIsItemModalOpen(false);
      fetchInitialData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- KEYBOARD SHORTCUTS FOR MODAL OVERLAYS ---
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isItemModalOpen) return;

      // Handle Submit Confirmation Overlay
      if (showSaveConfirm) {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmRegisterBatchSave();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowSaveConfirm(false);
        }
        return;
      }

      // Handle Exit Confirmation Overlay
      if (showExitConfirm) {
        if (e.key === 'Enter') {
          e.preventDefault();
          performModalReset();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowExitConfirm(false);
        }
        return;
      }

      // Handle Main Modal ESC to Close
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseItemModal();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isItemModalOpen, showSaveConfirm, showExitConfirm, sessionItems, handleCloseItemModal, performModalReset, confirmRegisterBatchSave]);

  const removeSessionItem = (id) => {
    setSessionItems(prev => prev.filter(item => item.id !== id));
    toast.info("تم حذف الصنف من القائمة");
  };




  
  // --- Invoice Modal Handlers ---
  // Auto-focus on modal open
  useEffect(() => {
    if (isSalesModalOpen) {
      setTimeout(() => {
        if (!invoiceForm.rep) {
          // Find the rep input by placeholder or just use a ref if we had one. 
          // For now let's just use the search input as before but the user might want rep focus.
          // Let's add an ID to the rep input and focus it.
          document.getElementById('invoiceRepInput')?.focus();
        } else {
          invoiceSearchInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isSalesModalOpen]);
  
  // Exit guard
  const hasInvoiceUnsavedData = () => {
    return (
      invoiceForm.rep.trim() !== '' || 
      currentInvoiceItem.name.trim() !== '' || 
      invoiceForm.items.length > 0
    );
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
    setInvoiceForm({ client: 'سحب مندوب', rep: '', date: new Date().toISOString().split('T')[0], items: [] });
    setCurrentInvoiceItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
    setInvoiceErrors({});
    setShowInvoiceExitConfirm(false);
     setShowInvoiceSaveConfirm(false);
    setShowInvoiceSaveConfirm(false);
    setIsVoucherInvoice(false); 
    setStockSearchActiveIndex(-1);
  };

  const openInvoiceModal = () => {
    setInvoiceForm({ client: 'سحب مندوب', rep: '', date: new Date().toISOString().split('T')[0], items: [] });
    setCurrentInvoiceItem({ name: '', selectedItem: null, cat: '', unit: '', qty: '' });
    setInvoiceErrors({});
    setIsVoucherInvoice(false);
    setIsSalesModalOpen(true);
  };
  
  // Add invoice item to table
  const handleAddInvoiceItemToTable = () => {
    if (!currentInvoiceItem.selectedItem) return toast.error("حدد الصنف أولاً!");
    if (!currentInvoiceItem.qty || currentInvoiceItem.qty <= 0) return toast.error("أدخل كمية صحيحة!");
    
    // Account for voucher quantity if editing a voucher-to-invoice
    let alreadyReserved = 0;
    if (sourceVoucher) {
      const vLine = (sourceVoucher.lines || []).find(vl => vl.item_id === currentInvoiceItem.selectedItem.id);
      if (vLine) alreadyReserved = Number(vLine.qty || 0);
    }

    const requestedDelta = Number(currentInvoiceItem.qty) - alreadyReserved;

    if (requestedDelta > 0 && requestedDelta > currentInvoiceItem.selectedItem.stockQty) {
      const availableTotal = (currentInvoiceItem.selectedItem.stockQty || 0) + alreadyReserved;
      return toast.error(`الكمية غير كافية! الرصيد الإجمالي المتاح هو ${availableTotal} (شاملاً رصيد السند)`);
    }
    
    setInvoiceForm({...invoiceForm, items: [
      {...currentInvoiceItem, qty: Number(currentInvoiceItem.qty)},
      ...invoiceForm.items
    ]});
    setCurrentInvoiceItem({name:'', selectedItem: null, cat:'', unit:'', qty:''});
    setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
  };

  const handleEditInvoiceItem = (idx) => {
    const item = invoiceForm.items[idx];
    setCurrentInvoiceItem({
      name: item.name,
      selectedItem: item.selectedItem,
      cat: item.cat,
      unit: item.unit,
      qty: item.qty
    });
    setInvoiceForm({
      ...invoiceForm,
      items: invoiceForm.items.filter((_, i) => i !== idx)
    });
    setTimeout(() => invoiceSearchInputRef.current?.focus(), 50);
  };

  // --- 3. ADD INVOICE --- //
  const handleAddInvoice = (e) => {
    if (e) e.preventDefault();
    if (!invoiceForm.client.trim()) { setInvoiceErrors({ client: true }); return toast.error("أدخل اسم العميل أولاً!"); }
    if (!invoiceForm.rep.trim()) { setInvoiceErrors({ rep: true }); return toast.error("أدخل اسم المندوب!"); }
    if (invoiceForm.items.length === 0) return toast.error("لا توجد أصناف في الفاتورة!");
    
    for (let i = 0; i < invoiceForm.items.length; i++) {
        const line = invoiceForm.items[i];
        const invItem = items.find(inv => inv.id === (line.selectedItem?.id || line.selectedItemId));
        
        // If this is a voucher-to-invoice conversion, the 'line.qty' is already 
        // partially or fully deducted from stockQty. 
        // We only care about the DELTA (the difference).
        let alreadyDeducted = 0;
        if (sourceVoucher) {
            const vLine = (sourceVoucher.lines || []).find(vl => vl.item_id === (line.selectedItem?.id || line.selectedItemId));
            if (vLine) alreadyDeducted = Number(vLine.qty || 0);
        }

        const requestedDelta = Number(line.qty) - alreadyDeducted;

        if (!invItem || (requestedDelta > 0 && requestedDelta > invItem.stockQty)) {
            setInvoiceErrors({ [`qty-${i}`]: true });
            playWarning();
            const availableTotal = (invItem?.stockQty || 0) + alreadyDeducted;
            return toast.error(`الكمية غير كافية لـ "${line.selectedItem?.name || line.name}"! الرصيد الإجمالي المتاح هو ${availableTotal} فقط (شاملاً رصيد السند) ⛔️`);
        }
    }
    setInvoiceErrors({});
    setShowInvoiceSaveConfirm(true);
  };

  const performInvoiceSave = async () => {
    setShowInvoiceSaveConfirm(false);
    try {
      setLoading(true);
      const now = new Date();
      const invoiceTimestamp = now.toLocaleString('ar-SA', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      // 1. Skip optional invoices table (doesn't exist)
      // Removed to avoid 400 errors

      // 2. Sync Transactions & Stock
      if (sourceVoucher) {
        const batchId = sourceVoucher.voucherGroupId || sourceVoucher.id;
        const voucherLines = sourceVoucher.lines || [];
        const invoiceLines = invoiceForm.items;

        console.log('🔄 Invoice Save Starting...', {
          batchId,
          voucherLinesCount: voucherLines.length,
          invoiceLinesCount: invoiceLines.length,
          sourceVoucherKeys: Object.keys(sourceVoucher),
          firstLineId: voucherLines[0]?.id,
          firstLineItemId: voucherLines[0]?.item_id,
        });

        // STRATEGY: Update ALL transactions in this batch at once using batch_id
        // We only update status to 'مفوتر'. We DON'T touch notes to preserve user's comments.
        const { error: batchUpdateErr, count: batchCount } = await supabase
          .from('transactions')
          .update({ 
            status: 'مفوتر'
          })
          .eq('batch_id', batchId);

        console.log('📦 Batch update result:', { batchUpdateErr, batchCount, batchId });

        if (batchUpdateErr) {
          console.warn('⚠️ Batch update by batch_id failed, trying individual updates...');
          
          for (const vLine of voucherLines) {
            await supabase
              .from('transactions')
              .update({ 
                status: 'مفوتر',
                // Append if we have notes
                notes: vLine.notes ? `${vLine.notes} [تم إصدار الفاتورة]` : '[تم إصدار الفاتورة]'
              })
              .eq('id', vLine.id);
          }
        }

        // VERIFY: Read back to confirm the write actually persisted
        const { data: verifyData } = await supabase
          .from('transactions')
          .select('id, status, notes')
          .eq('batch_id', batchId)
          .limit(5);
        
        console.log('✅ Verification read-back:', verifyData);
        
        const verified = verifyData && verifyData.some(v => v.status === 'مفوتر');

        if (!verified) {
          console.error('❌ VERIFICATION FAILED! Data did not persist.');
          const vCode = sourceVoucher.voucherCode || sourceVoucher.reference_number;
          console.log('Trying alternative: update by reference_number...', vCode);
          
          if (vCode) {
            await supabase
              .from('transactions')
              .update({ status: 'مفوتر' })
              .eq('reference_number', vCode);
          }
          
          // Also try updating each line by ID one more time
          for (const vLine of voucherLines) {
            await supabase
              .from('transactions')
              .update({ 
                status: 'مفوتر',
                notes: vLine.notes ? `${vLine.notes} [تم إصدار الفاتورة]` : '[تم إصدار الفاتورة]'
              })
              .eq('id', vLine.id);
          }
        }

        // Handle stock adjustments for qty changes
        for (const vLine of voucherLines) {
          const matchingInvItem = invoiceLines.find(it => 
            (it.selectedItem?.id === vLine.item_id) || 
            (it.selectedItemId === vLine.item_id)
          );

          if (matchingInvItem) {
            const diff = Number(matchingInvItem.qty) - Number(vLine.qty);
            if (diff !== 0) {
              const currentItem = items.find(i => i.id === vLine.item_id);
              if (currentItem) {
                const newStock = (currentItem.stockQty || 0) - diff;
                await supabase.from('products').update({ stock_qty: newStock }).eq('id', vLine.item_id);
              }
              await supabase.from('transactions').update({ qty: Number(matchingInvItem.qty) }).eq('id', vLine.id);
            }
          } else {
            // Item deleted in review - return stock
            const currentItem = items.find(i => i.id === vLine.item_id);
            if (currentItem) {
              const newStock = (currentItem.stockQty || 0) + Number(vLine.qty);
              await supabase.from('products').update({ stock_qty: newStock }).eq('id', vLine.item_id);
            }
          }
        }

        // Handle new items added in review
        for (const invItem of invoiceLines) {
          const itemId = invItem.selectedItem?.id || invItem.selectedItemId;
          if (!itemId) continue;
          if (!voucherLines.some(vl => vl.item_id === itemId)) {
            const currentItem = items.find(i => i.id === itemId);
            if (currentItem) {
              const newStock = (currentItem.stockQty || 0) - Number(invItem.qty);
              await supabase.from('products').update({ stock_qty: newStock }).eq('id', itemId);
            }
            await supabase.from('transactions').insert({
              item: invItem.name || invItem.selectedItem?.name,
              item_id: itemId,
              type: sourceVoucher.type || 'outward',
              qty: Number(invItem.qty),
              batch_id: batchId,
              reference_number: sourceVoucher.voucherCode,
              beneficiary: sourceVoucher.clientName,
              rep: invoiceForm.rep,
              timestamp: new Date().toISOString(),
              status: 'مفوتر',
              notes: `[إضافة مراجعة] ${statusNotes}`
            });
          }
        }
        
        setInvoiceTimestamps(prev => ({...prev, [sourceVoucher.id]: invoiceTimestamp}));
        setSourceVoucher(null);
      } else {
        // --- 3. REGULAR SALES INVOICE (No Voucher) ---
        console.log('📝 Direct Invoice Save Starting...', {
          client: invoiceForm.client,
          itemsCount: invoiceForm.items.length
        });

        const batchId = `INV-${Date.now()}`;
        const txsToInsert = [];

        for (const line of invoiceForm.items) {
          const itemId = line.selectedItem?.id || line.selectedItemId;
          if (!itemId) continue;

          // Fetch fresh stock to avoid race conditions
          const { data: latestProd } = await supabase.from('products').select('stock_qty').eq('id', itemId).single();
          const currentStock = latestProd?.stock_qty || 0;
          const newStock = currentStock - Number(line.qty);
          
          await supabase.from('products').update({ stock_qty: newStock }).eq('id', itemId);

          txsToInsert.push({
            item: line.name || line.selectedItem?.name,
            item_id: itemId,
            type: 'Issue',
            qty: Number(line.qty),
            date: invoiceForm.date,
            timestamp: new Date().toISOString(),
            status: 'مفوتر',
            beneficiary: invoiceForm.client,
            rep: invoiceForm.rep,
            batch_id: batchId,
            reference_number: batchId,
            notes: `فاتورة مباشرة - ${invoiceForm.client}`
          });
        }

        if (txsToInsert.length > 0) {
          const { error: insErr } = await supabase.from('transactions').insert(txsToInsert);
          if (insErr) throw insErr;
        }
      }

      toast.success("تم تأكيد الفاتورة (إجراء روتيني) - المخزون تم التعامل معه مسبقاً في السند ✅");
      playSuccess();
      performInvoiceReset();
      fetchInitialData();
    } catch (err) {
      console.error("❌ performInvoiceSave crash:", err);
      toast.error("حدث خطأ تقني أثناء الحفظ. يرجى مراجعة الكونسول.");
    } finally {
      setLoading(false);
    }
  };
  
  // --- Global Modals ESC Support ---
  useEffect(() => {
    const handleGlobalEsc = (event) => {
      if (event.key === 'Escape') {
        if (isTransactionDetailOpen) setIsTransactionDetailOpen(false);
        if (isVoucherDetailOpen) setIsVoucherDetailOpen(false); setShowVoucherHistory(false);
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [isTransactionDetailOpen, isVoucherDetailOpen]);

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
    return (
      returnForm.returnee.trim() !== '' || 
      returnForm.rep.trim() !== '' || 
      returnForm.query.trim() !== '' || 
      returnItems.length > 0
    );
  };
  
  const handleCloseReturnModal = () => {
    console.log("handleCloseReturnModal triggered. Unsaved data:", hasReturnUnsavedData());
    if (hasReturnUnsavedData()) {
      setShowReturnExitConfirm(true);
      console.log("setShowReturnExitConfirm(true) called");
    } else {
      performReturnReset();
    }
  };
  
  const performReturnReset = () => {
    setIsReturnsModalOpen(false);
    setReturnForm({ rep: '', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', returnStatus: 'سليم', cat: '', returnee: '', unit: '' });
    setReturnItems([]);
    setReturnErrors({});
    setShowReturnExitConfirm(false);
     setShowReturnSaveConfirm(false);
    setShowReturnSaveConfirm(false);
    setStockSearchActiveIndex(-1);
  };

  const openReturnModal = () => {
    setReturnForm({ rep: '', date: new Date().toISOString().split('T')[0], query: '', selectedItem: null, qty: '', returnStatus: 'سليم', cat: '', returnee: '', unit: '' });
    setReturnItems([]);
    setReturnErrors({});
    setIsReturnsModalOpen(true);
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
      returnStatus: returnForm.returnStatus || 'سليم'
    }]);
    setReturnForm({...returnForm, query: '', selectedItem: null, cat: '', unit: '', qty: ''});
    setTimeout(() => returnSearchInputRef.current?.focus(), 50);
  };

  const handleEditReturnItem = (idx) => {
    const item = returnItems[idx];
    setReturnForm({
      ...returnForm,
      query: item.name,
      selectedItem: item.selectedItem,
      cat: item.cat,
      unit: item.unit,
      qty: item.qty,
      returnStatus: item.returnStatus
    });
    setReturnItems(returnItems.filter((_, i) => i !== idx));
    setTimeout(() => returnSearchInputRef.current?.focus(), 50);
  };

  // --- 4. ADD RETURN (Enhanced with Table & Stock Increment) --- //
  const handleAddReturn = (e) => {
    if (e) e.preventDefault();
    if (!returnForm.returnee.trim()) { setReturnErrors({ returnee: true }); return toast.error("يرجى تحديد الشخص أو الجهة التي قامت بالترجيع"); }
    if (!returnForm.rep || !returnForm.rep.trim()) { setReturnErrors({ rep: true }); return toast.error("يرجى تحديد المندوب المستلم أولاً"); }
    if (returnItems.length === 0) return toast.error("لا توجد أصناف مرتجعة!");
    
    setReturnErrors({});
    setShowReturnSaveConfirm(true);
  };

  const performReturnSave = async () => {
    setShowReturnSaveConfirm(false);
    setLoading(true);
    try {
        const batchId = Date.now().toString();
        const userId = currentUser?.email?.split('@')[0] || 'مدير النظام';
        const now = new Date().toISOString();

        const additions = {};
        returnItems.forEach(it => {
            if (it.returnStatus === 'سليم') {
                if (!additions[it.selectedItem.id]) additions[it.selectedItem.id] = { id: it.selectedItem.id, qty: 0 };
                additions[it.selectedItem.id].qty += Number(it.qty);
            }
        });
        for (const [id, payload] of Object.entries(additions)) {
            const currentItem = items.find(i => i.id === id);
            if (currentItem) {
                await supabase.from('products').update({ stock_qty: currentItem.stockQty + payload.qty }).eq('id', id);
            }
        }

        const txsToInsert = returnItems.map(it => ({
             item: `${it.name}`,
             type: 'return',
             qty: Number(it.qty),
             date: returnForm.date || new Date().toISOString().split('T')[0],
             timestamp: now,
             status: it.returnStatus === 'سليم' ? 'مكتمل' : 'مرتجع تالف',
             loc: returnForm.returnee,
             rep: returnForm.rep,
             beneficiary: returnForm.returnee,
             user_id: null,
             batch_id: batchId,
             item_id: it.selectedItem?.id
        }));
        await supabase.from('transactions').insert(txsToInsert);

        const damagedItems = returnItems.filter(it => it.returnStatus === 'تالف');
        if (damagedItems.length > 0) {
            const discrepanciesToInsert = damagedItems.map(it => ({
                item_id: it.selectedItem?.id || null,
                item_name: it.name || it.selectedItem?.name || '',
                expected_qty: 0,
                actual_qty: 0,
                diff: Number(it.qty),
                note: `مرتجع تالف - من: ${returnForm.returnee}${returnForm.rep ? ` / مندوب: ${returnForm.rep}` : ''}`,
                status: 'pending',
                created_at: now
            }));
            await supabase.from('discrepancies').insert(discrepanciesToInsert);
            toast.warning(`تم تسجيل ${damagedItems.length} صنف في قسم التوالف ❤️`);
        }

        toast.success(`تم تسجيل المرتجع بنجاح ✅`);
        playSuccess();
        performReturnReset();
        fetchInitialData();
    } catch (err) {
        console.error('❌ performReturnSave error:', err);
        toast.error("حدث خطأ أثناء حفظ المرتجع.");
    } finally {
        setLoading(false);
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
        client: voucher.clientName || voucher.recipient || 'عميل نقدي',
        rep: '',
        date: new Date().toISOString().split('T')[0],
        items: lineItems
      });
      setCurrentInvoiceItem({
        name: '',
        selectedItem: null,
        cat: '',
        unit: '',
        qty: ''
      });
    } else {
      // Fallback: create empty invoice with just recipient
      setInvoiceForm({
        client: voucher.clientName || voucher.recipient || 'عميل نقدي',
        rep: '',
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
    setIsVoucherDetailOpen(false); setShowVoucherHistory(false);
    setIsVoucherInvoice(true); // Enable read-only mode
    setIsSalesModalOpen(true);
  };

  // --- 6. VOUCHER ACTIONS (Delete, Edit, Mark as Invoiced) --- //
  const handleDeleteVoucher = async (voucher) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السند نهائياً؟ سيتم استرجاع الكميات للمخزن.')) return;
    
    try {
      setLoading(true);
      const lines = voucher.lines || [];
      
      // 1. Return stock for each line if it was deducted
      for (const line of lines) {
        if (line.deducted !== false) { // Assuming vouchers usually deduct stock
           const currentItem = items.find(i => i.id === line.item_id);
           if (currentItem) {
             const type = line.type || '';
             const isIn = type.includes('إدخال') || type === 'Restock';
             const isOut = type.includes('إخراج') || type === 'Issue' || type === 'out';
             
             // If it was Inbound (+stock), subtract to reverse
             // If it was Outbound (-stock), add to reverse
             const delta = isIn ? -Number(line.qty) : Number(line.qty);
             const newStock = currentItem.stockQty + delta;
             
             await supabase.from('products').update({ stock_qty: Math.max(0, newStock) }).eq('id', line.item_id);
           }
        }
      }
      
      // 2. Delete transactions from DB
      const { error } = await supabase.from('transactions').delete().eq('batch_id', voucher.id);
      if (error) throw error;
      
      toast.success('تم حذف السند وإرجاع الكميات للمخزن بنجاح ✅');
      playSuccess();
      setIsVoucherDetailOpen(false); setShowVoucherHistory(false);
      fetchInitialData();
    } catch (err) {
      toast.error('حدث خطأ أثناء حذف السند.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditVoucher = (voucher) => {
    const view = voucher.kind === 'in' ? 'voucher-in' : 'voucher-outward';
    // Use localStorage to pass the editing context to the workspace
    localStorage.setItem('edit_voucher_id', voucher.id);
    setActiveView(view);
    setIsVoucherDetailOpen(false); setShowVoucherHistory(false);
  };

  const handleMarkAsInvoiced = async (voucher = null) => {
    const v = voucher || selectedVoucher;
    if (!v) return;

    if (v.kind === 'in') {
      // For inbound vouchers: just mark as invoiced/completed in DB
      try {
        setLoading(true);
        const now = new Date();
        const invoiceTimestamp = now.toLocaleDateString('ar-SA', {
          year: 'numeric', month: 'long', day: 'numeric'
        });

        // Update all voucher line transactions sequentially
        const lines = v.lines || [];
        for (const line of lines) {
            await supabase.from('transactions').update({
                status: 'مفوتر',
                notes: line.notes ? `${line.notes} [تم إصدار الفاتورة] ${invoiceTimestamp}` : `[تم إصدار الفاتورة] ${invoiceTimestamp}`
            }).eq('id', line.id);
        }

        // Update local state
        setInvoiceTimestamps(prev => ({...prev, [v.id]: invoiceTimestamp}));
        setVoucherTransactions(prev =>
          prev.map(item => item.id === v.id ? { ...item, invoiced: true, deducted: true, invoiceDate: invoiceTimestamp } : item)
        );
        if (detailVoucher && detailVoucher.id === v.id) {
          setDetailVoucher(prev => ({...prev, invoiced: true, deducted: true, invoiceDate: invoiceTimestamp}));
        }

        toast.success('تم اعتماد السند بنجاح ✅');
        playSuccess();
        fetchInitialData();
      } catch (err) {
        toast.error('تعذر اعتماد السند.');
        playWarning();
      } finally {
        setLoading(false);
      }
      return;
    }

    // For outbound vouchers: stock was already deducted at voucher creation.
    // Open the invoice modal with voucher data pre-filled
    handleExportInvoiceToInvoice(v);
  };

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
  const finalTransactions = useMemo(() => {
    const movements = [];
    const seenGroups = new Set();

    // Grouping logic to show "Movement Logic" instead of individual lines
    dbTransactionsList.forEach(tx => {
       // Only movements, exclude "Add Item" and summary rows
       if (tx.type === 'product_add' || tx.type === 'AddProduct' || tx.is_summary === true) return;

       const groupId = tx.voucherGroupId || tx.batchId || tx.reference_number || tx.id;
       
       if (seenGroups.has(groupId)) return;
       seenGroups.add(groupId);

       // Movement filter logic
       let matches = true;
       if (movementTypeFilter !== 'الكل') {
         const type = tx.type || '';
         if (movementTypeFilter === 'وارد') {
           matches = type === 'Restock' || type === 'وارد' || type === 'in' || type === FUNCTIONAL_INBOUND_TYPE;
         } else if (movementTypeFilter === 'صادر') {
           // Fixed: include both direct out and functional vouchers
           matches = (type === 'Issue' || type === 'out' || type === 'صادر' || type === FUNCTIONAL_OUTBOUND_TYPE);
         } else if (movementTypeFilter === 'فاتورة') {
           matches = tx.isInvoice === true;
         } else if (movementTypeFilter === 'مرتجع') {
           matches = type === 'Return' || type === 'مرتجع' || type === 'return' || tx.status === 'مرتجع تالف';
         } else if (movementTypeFilter === 'سند إدخال') {
           matches = (type === FUNCTIONAL_INBOUND_TYPE || type === 'adjust_in') && !tx.isInvoice;
         } else if (movementTypeFilter === 'سند إخراج') {
           matches = (type === FUNCTIONAL_OUTBOUND_TYPE || type === 'adjust_out') && !tx.isInvoice;
         }
       }
       
       if (matches) {
         movements.push(tx);
       }
    });

    return movements;
  }, [dbTransactionsList, movementTypeFilter]);

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
        <StatCard icon={TrendingUp} label="الصادر" value={salesCount} subtext="وحدة مُباعة" actionLabel="فاتورة جديدة" onClick={openInvoiceModal} accentColor="#F59E0B" />
        <StatCard icon={RotateCcw} label={damageCount > 0 ? `المرتجعات (${damageCount} تالف)` : "المرتجعات"} value={returnsCount} subtext="وحدة مُرتجعة" actionLabel="تسجيل مرتجع" onClick={openReturnModal} accentColor="#EF4444" />
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
                <p className="text-[10px] text-slate-400 font-readex font-medium">{finalTransactions.length} حركة</p>
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
              <option value="صادر">صادر - فاتورة</option>
              <option value="مرتجع">مرتجع</option>
              <option value="سند إدخال">سند إدخال</option>
              <option value="سند إخراج">سند إخراج</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3">
            {finalTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <FileText size={36} strokeWidth={1.2} className="mb-3" />
                <p className="text-xs font-semibold">لم يتم تسجيل حركات</p>
              </div>
            ) : (
              <div className="space-y-2">
                {finalTransactions.slice(0, 50).map((tx) => {
                  let actionTitle = '';
                  let actionColor = 'text-slate-600';
                  let actionBg = 'bg-slate-100';
                  let actionIcon = <FileCheck size={14} />;
                  let docNumberRaw = tx.reference_number || tx.referenceNumber || tx.voucherCode || '';
                  let docNumber = docNumberRaw.split('-').pop();

                  // 1. Map Action Logic
                  const type = String(tx.type || '').toLowerCase();
                  const isFunctionalIn = tx.type === FUNCTIONAL_INBOUND_TYPE;
                  const isFunctionalOut = tx.type === FUNCTIONAL_OUTBOUND_TYPE;
                  const isReturn = type === 'return' || type === 'مرتجع' || tx.status === 'مرتجع تالف';
                  const isInbound = type === 'in' || type === 'وارد' || type === 'restock' || type === 'adjust_in';
                  const isOutbound = (type === 'issue' || type === 'out' || type === 'صادر');
                  const isCancelled = tx.status === 'cancelled';

                  if (isCancelled) {
                    actionTitle = (tx.type === FUNCTIONAL_OUTBOUND_TYPE || tx.type === 'outward' || tx.type === 'Issue') ? 'سند إخراج (ملغي)' : 
                                  (tx.type === FUNCTIONAL_INBOUND_TYPE || tx.type === 'in' || tx.type === 'Restock') ? 'سند إدخال (ملغي)' : 'حركة ملغاة';
                    actionColor = 'text-slate-400';
                    actionBg = 'bg-slate-50';
                    actionIcon = <AlertTriangle size={14} className="text-rose-500 animate-pulse" />;
                  } else if (isFunctionalOut) {
                    if (tx.isInvoice) {
                      actionTitle = 'فاتورة سند';
                      actionColor = 'text-blue-600';
                      actionBg = 'bg-blue-50';
                      actionIcon = <FileText size={14} />;
                    } else {
                      actionTitle = 'سند إخراج';
                      actionColor = 'text-rose-600';
                      actionBg = 'bg-rose-50';
                      actionIcon = <FileOutput size={14} />;
                    }
                  } else if (isFunctionalIn) {
                    actionTitle = 'سند إدخال';
                    actionColor = 'text-indigo-600';
                    actionBg = 'bg-indigo-50';
                    actionIcon = <FileInput size={14} />;
                  } else if (isInbound) {
                    const isAdj = type === 'adjust_in';
                    actionTitle = isAdj ? 'سند إدخال (تعديل)' : 'وارد';
                    actionColor = isAdj ? 'text-slate-500' : 'text-emerald-600';
                    actionBg = isAdj ? 'bg-slate-50' : 'bg-emerald-50';
                    actionIcon = isAdj ? <Pencil size={14} /> : <ArrowDownLeft size={14} />;
                  } else if (isReturn) {
                    actionTitle = 'مرتجع';
                    actionColor = 'text-amber-600';
                    actionBg = 'bg-amber-50';
                    actionIcon = <RotateCcw size={14} />;
                  } else if (isOutbound) {
                    actionTitle = tx.isInvoice ? 'صادر - فاتورة' : 'صادر';
                    actionColor = 'text-blue-600';
                    actionBg = 'bg-blue-50';
                    actionIcon = <ArrowUpRight size={14} />;
                  } else {
                    actionTitle = tx.type || 'حركة مخزنية';
                    actionColor = 'text-slate-600';
                    actionBg = 'bg-slate-50';
                    actionIcon = <FileCheck size={14} />;
                  }

                  const isModifiedVoucher = tx.isEdited;

                  // 2. Build Content Summary and Names
                  const supplierName = tx.supplier || '';
                  const beneficiaryName = tx.beneficiary || tx.recipient || tx.location || '';
                  const repName = tx.rep || '';
                  
                  // Improved name resolution
                  const primaryName = (isInbound || isFunctionalIn) 
                    ? (supplierName || beneficiaryName || 'مورد غير محدد') 
                    : (beneficiaryName || supplierName || 'جهة غير محددة');
                  const secondaryName = (isOutbound || isReturn || isFunctionalOut) ? repName : '';

                  const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
                  const formattedDate = txDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' });

                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        const rawBatch = tx.voucherGroupId 
                          ? dbTransactionsList.filter(t => t.voucherGroupId === tx.voucherGroupId) 
                          : tx.batchId 
                            ? dbTransactionsList.filter(t => t.batchId === tx.batchId) 
                            : [tx];
                        // FILTER OUT SUMMARY ROWS HERE
                        setSelectedBatchTransactions(rawBatch.filter(t => t.is_summary !== true));
                        setIsTransactionDetailOpen(true);
                      }}
                      className="flex items-center justify-between py-1.5 px-3 hover:bg-slate-50 transition-all rounded-xl cursor-pointer group border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${actionBg} ${actionColor} shadow-sm group-hover:scale-105 transition-transform`}>
                          {React.cloneElement(actionIcon, { size: 16 })}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-slate-800 text-[12px] font-tajawal text-right truncate">
                              {primaryName}
                              {secondaryName && (
                                <span className="text-[10px] text-slate-400 font-readex font-medium mr-1.5">
                                   - {secondaryName}
                                </span>
                              )}
                            </h4>
                          </div>
                          
                           <div className="flex items-center gap-2">
                             <p className={`text-[10px] font-bold font-readex ${actionColor}`}>
                               {actionTitle}
                             </p>
                            {isModifiedVoucher && (
                               <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-100 dark:border-amber-500/20">
                                 <RefreshCw size={8} className="animate-spin-slow" />
                                 <span className="text-[9px] font-black uppercase tracking-wider">تم تعديله</span>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-left shrink-0 mr-4">
                        <p className="text-[11px] text-slate-400 font-bold font-readex">
                          {formattedDate}
                        </p>
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
                              handleMarkAsInvoiced(voucher);
                            }}
                            className="shrink-0 mt-0.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              readOnly
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
                              <div className="flex flex-col gap-1">
                                <p className="text-[9px] text-slate-400 font-readex mt-0.5 truncate">
                                  {dayName} - {dateStr}
                                </p>
                                {voucher.line_note && (
                                  <p className="text-[9px] font-black text-indigo-500 font-tajawal truncate bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100/50 w-fit max-w-full">
                                    {voucher.line_note.split('[تعديل حديث]')[0].split('[تم إصدار الفاتورة')[0].split('<!--')[0].trim()}
                                  </p>
                                )}
                              </div>
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

                {/* Cancelled Vouchers Section */}
                {cancelledVouchers.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-4 mb-2">
                      <div className="h-px flex-1 bg-rose-100"></div>
                      <span className="text-[10px] font-bold text-rose-400 font-readex uppercase tracking-wider">سندات ملغاة</span>
                      <div className="h-px flex-1 bg-rose-100"></div>
                    </div>
                    <AnimatePresence>
                      {cancelledVouchers.slice(0, 5).map((voucher) => (
                        <motion.div
                          key={`${voucher.id}-${voucher.batchId}`}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            setDetailVoucher(voucher);
                            setIsVoucherDetailOpen(true);
                          }}
                          className="p-2 rounded-xl border border-rose-100 bg-rose-50/30 cursor-pointer hover:bg-rose-50 transition-all opacity-60 group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                               <AlertTriangle size={12} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[11px] font-bold text-slate-500 font-tajawal truncate line-through decoration-rose-300">
                                {voucher.kind === 'in' ? 'سند إدخال' : 'سند إخراج'} - {voucher.clientName}
                              </h4>
                              <p className="text-[8px] text-rose-400 font-medium">تم إلغاء هذا السند وإرجاع الكميات</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
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
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${iconColor} bg-white border border-slate-100`}>
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
      {/* 0. Transaction Details Modal (Redesigned for Premium Look) */}
      <AnimatePresence>
        {isTransactionDetailOpen && selectedBatchTransactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md"
            dir="rtl"
            onClick={() => setIsTransactionDetailOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="w-full max-w-4xl bg-white rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/20 flex flex-col max-h-[90vh] overflow-hidden"
            >
              {(() => {
                const firstTx = selectedBatchTransactions[0];
                const type = String(firstTx.type || '').toLowerCase();
                const isFunctionalIn = firstTx.isFunctional && (type === 'in' || type === 'سند إدخال' || (firstTx.item && firstTx.item.includes('ملخص سند')));
                const isFunctionalOut = firstTx.isFunctional && (type === 'outward' || type === 'سند إخراج' || (firstTx.item && (firstTx.item.includes('ملخص عهده') || firstTx.item.includes('عهده'))));
                const isReturn = type === 'return' || type === 'مرتجع' || firstTx.status === 'مرتجع تالف';
                const isInbound = !isFunctionalIn && (type === 'in' || type === 'وارد' || type === 'restock' || type === 'adjust_in');
                const isOutbound = !isFunctionalOut && (type === 'issue' || type === 'out' || type === 'صادر' || type === 'outward');

                let typeLabel = '';
                let themeColor = 'indigo';
                let themeIcon = <FileText size={28} />;

                if (isFunctionalIn) {
                  typeLabel = 'تفاصيل سند إدخال';
                  themeColor = 'indigo';
                  themeIcon = <FileInput size={28} />;
                } else if (isFunctionalOut) {
                  const isInvoicedVoucher = firstTx.isInvoice;
                  typeLabel = isInvoicedVoucher ? 'تفاصيل فاتورة سند' : 'تفاصيل سند إخراج';
                  themeColor = isInvoicedVoucher ? 'blue' : 'rose';
                  themeIcon = isInvoicedVoucher ? <FileText size={28} /> : <FileOutput size={28} />;
                } else if (isInbound) {
                  const isAdj = type === 'adjust_in';
                  typeLabel = isAdj ? 'سند إدخال (تعديل)' : 'تفاصيل حركة وارد';
                  themeColor = isAdj ? 'slate' : 'emerald';
                  themeIcon = isAdj ? <ArrowDownLeft size={28} /> : <ArrowDownLeft size={28} />;
                } else if (isReturn) {
                  typeLabel = 'تفاصيل مرتجع مخزني';
                  themeColor = 'amber';
                  themeIcon = <RotateCcw size={28} />;
                } else if (isOutbound) {
                  typeLabel = firstTx.isInvoice ? 'تفاصيل فاتورة صادر' : 'تفاصيل حركة صادر';
                  themeColor = 'blue';
                  themeIcon = <ArrowUpRight size={28} />;
                } else {
                  typeLabel = 'تفاصيل حركة مخزنية';
                  themeColor = 'slate';
                  themeIcon = <FileText size={28} />;
                }

                const docNumberRaw = firstTx.reference_number || firstTx.referenceNumber || firstTx.voucherCode || '';
                const docNumber = docNumberRaw.split('-').pop();
                const txDate = firstTx.timestamp ? new Date(firstTx.timestamp) : new Date();
                const formattedDate = txDate.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const formattedTime = txDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                
                const primaryName = (isInbound || isFunctionalIn) 
                  ? (firstTx.supplier || firstTx.beneficiary || firstTx.recipient || firstTx.location || 'بدون مورد') 
                  : (firstTx.beneficiary || firstTx.recipient || firstTx.supplier || firstTx.location || 'جهة غير محددة');
                
                const isModifiedVoucher = firstTx.isEdited;
                const currentNotes = (firstTx.notes || '')
                                      .split(/\[تعديل حديث\]|\[تم تعديله\]|\[تم إصدار الفاتورة|\[إضافة مراجعة\]|\[مستند رقم|<!--/)[0]
                                      .trim();

                return (
                  <>
                    {/* Header: Premium Gradient Style */}
                    <div className="relative px-8 py-8 shrink-0 overflow-hidden">
                       <div className={`absolute inset-0 bg-gradient-to-br ${
                         themeColor === 'rose' ? 'from-rose-500 to-rose-700' : 
                         themeColor === 'emerald' ? 'from-emerald-500 to-teal-700' : 
                         themeColor === 'amber' ? 'from-amber-500 to-orange-600' : 
                         'from-indigo-500 to-blue-700'
                       } transition-all duration-500`} />
                       <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl animate-pulse" />
                       
                       <div className="relative z-10 flex flex-col gap-6">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-5">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-[22px] flex items-center justify-center text-white shadow-2xl border border-white/30">
                                   {themeIcon}
                                </div>
                                <div>
                                   <div className="flex items-center gap-3 mb-1.5">
                                      <h3 className="text-xl font-black font-tajawal text-white tracking-tight">{typeLabel}</h3>
                                      {docNumber && (
                                        <span className="bg-white/20 text-[9px] font-black text-white px-2 py-0.5 rounded-md backdrop-blur-md border border-white/10 uppercase tracking-widest">
                                          #{docNumber}
                                        </span>
                                      )}
                                   </div>
                                   <div className="flex items-center gap-4 text-white/80">
                                      <div className="flex items-center gap-1.5 text-[10px] font-bold font-readex">
                                         <Calendar size={12} className="opacity-70" />
                                         {formattedDate}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] font-bold font-readex">
                                         <Clock size={12} className="opacity-70" />
                                         {formattedTime}
                                      </div>
                                      {isModifiedVoucher && (
                                        <span className="inline-flex items-center gap-1 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-[9px] font-black shadow-lg animate-in fade-in zoom-in">
                                           <RefreshCw size={10} className="animate-spin-slow" />
                                           معدل
                                        </span>
                                      )}
                                   </div>
                                </div>
                             </div>
                             
                             <button 
                               onClick={() => setIsTransactionDetailOpen(false)}
                               className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-90 border border-white/10"
                             >
                                <X size={20} />
                             </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                             <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 group/card transition-all hover:bg-white/15">
                                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">الجهة</p>
                                <div className="flex items-center gap-2">
                                   <User size={14} className="text-white/80" />
                                   <p className="text-xs font-black text-white truncate">{primaryName}</p>
                                </div>
                             </div>
                             <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 group/card transition-all hover:bg-white/15 overflow-hidden">
                                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">ملاحظات</p>
                                <div className="flex items-center gap-2">
                                   <FileText size={14} className="text-white/80" />
                                   <p className="text-xs font-bold text-white truncate italic opacity-90">
                                      {currentNotes || 'لا توجد ملاحظات'}
                                   </p>
                                </div>
                             </div>
                             <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 group/card transition-all hover:bg-white/15">
                                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">النوع</p>
                                <div className="flex items-center gap-2">
                                   <Activity size={14} className="text-white/80" />
                                   <p className="text-xs font-black text-white flex items-center gap-2">
                                      {firstTx.isInvoice && firstTx.isFunctional ? 'فاتورة' : typeLabel.replace('تفاصيل ', '')}
                                   </p>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50/30 custom-scrollbar">
                         <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                           <table className="w-full text-right text-[11px]">
                              <thead className="bg-slate-50/50 text-slate-400 font-black text-[9px] uppercase tracking-widest border-b border-slate-100 sticky top-0 backdrop-blur-md z-10">
                                 <tr>
                                    <th className="px-4 py-3 text-center w-10">#</th>
                                    <th className="px-4 py-3 text-right">الصنف</th>
                                    <th className="px-4 py-3 text-center">الشركة</th>
                                    <th className="px-4 py-3 text-center">القسم</th>
                                    <th className="px-4 py-3 text-center">الوحدة</th>
                                    <th className="px-4 py-3 text-center">الكمية</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                 {selectedBatchTransactions.filter(t => t.is_summary !== true).map((tx, idx) => {
                                   const itemFromId = tx.item_id ? items.find(i => i.id === tx.item_id) : null;
                                   const itemName = itemFromId ? itemFromId.name : (tx.item || tx.itemName || 'صنف غير معروف');
                                   const itemCompany = itemFromId ? itemFromId.company : (tx.company || '');
                                   const itemCat = tx.cat || itemFromId?.cat || '-';
                                   
                                   return (
                                     <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-4 py-3 text-center font-black text-slate-300 tabular-nums">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                           <div className="flex flex-col">
                                              <span className="text-xs font-bold text-slate-700">{itemName}</span>
                                           </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                           <span className="text-[10px] font-bold text-slate-500">{itemCompany || '-'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                           <span className="text-[9px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">
                                              {itemCat}
                                           </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                           <span className="text-[10px] font-bold text-slate-400">{tx.unit || 'وحدة'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                           <div className={`text-xs font-black tabular-nums ${isInbound || isFunctionalIn || type === 'return' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {isInbound || isFunctionalIn || type === 'return' ? `+${Math.abs(tx.qty)}` : `-${Math.abs(tx.qty)}`}
                                           </div>
                                        </td>
                                     </tr>
                                   );
                                 })}
                              </tbody>
                           </table>
                         </div>
                     </div>

                    {/* Footer Section */}
                    <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                       <div className="flex items-center gap-6">
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">الإجمالي</span>
                             <p className="text-base font-black text-slate-800 font-tajawal tabular-nums">
                                {selectedBatchTransactions.reduce((acc, curr) => acc + Number(curr.qty || 0), 0)} وحدة
                             </p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setIsTransactionDetailOpen(false)}
                            className={`px-8 py-2 bg-${themeColor}-600 text-white rounded-xl text-xs font-black hover:brightness-95 shadow-lg shadow-${themeColor}-500/20 transition-all active:scale-95`}
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
              className={`w-full ${showVoucherHistory ? 'max-w-[1200px]' : 'max-w-4xl'} bg-white rounded-[24px] shadow-2xl border border-slate-100/60 flex flex-col max-h-[85vh] overflow-hidden transition-all duration-500`}
            >
              {(() => {
                const isIn = detailVoucher.kind === 'in';
                const isCancelled = detailVoucher.isCancelled === true || (detailVoucher.line_note || '').includes('[تم الإلغاء]');
                const matchColon = (detailVoucher.line_note || '').match(/\[تم إصدار الفاتورة:\s*([^\]]+)\]/);
                const matchNoColon = (detailVoucher.line_note || '').match(/\[تم إصدار الفاتورة\]\s*([^\[<]+)/);
                const invoiceMatch = matchColon || matchNoColon;
                const isCompleted = (detailVoucher.invoiced === true || invoiceTimestamps[detailVoucher.id] || invoiceMatch) && !isCancelled;
                const extractedDate = invoiceMatch && invoiceMatch[1] ? invoiceMatch[1].trim() : 'حديثاً';
                const voucherDate = detailVoucher.timestamp ? new Date(detailVoucher.timestamp) : new Date();
                const formattedShortDate = voucherDate.toLocaleDateString('ar-SA', {
                  day: 'numeric', month: 'long', year: 'numeric'
                });
                const invoiceDate = invoiceTimestamps[detailVoucher.id] || detailVoucher.invoiceDate || (extractedDate !== 'حديثاً' ? extractedDate : new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }));
                const recipient = detailVoucher.clientName || detailVoucher.supplier || detailVoucher.rep || 'غير محدد';
                const lines = detailVoucher.lines || [];
                
                // Simple history extractor - reads new <!--HIST:{}--> and old <!--{}--> formats
                const getOldVersion = (note) => {
                  if (!note) return null;
                  // New format
                  const m1 = note.match(/<!--HIST:(\{.*?\})-->/s);
                  if (m1) { try { return JSON.parse(m1[1]); } catch(e) {} }
                  // Old format (backward compat) - try with basic repair
                  const m2 = note.match(/<!--(\{.*?)(?:-->|$)/s);
                  if (m2) {
                    let j = m2[1];
                    try { return JSON.parse(j); } catch(e) {
                      const ob = (j.match(/\{/g)||[]).length, cb = (j.match(/\}/g)||[]).length;
                      const oB = (j.match(/\[/g)||[]).length, cB = (j.match(/\]/g)||[]).length;
                      if ((j.match(/"/g)||[]).length % 2 !== 0) j += '"';
                      for(let i=0;i<oB-cB;i++) j+=']';
                      for(let i=0;i<ob-cb;i++) j+='}';
                      try {
                        const p = JSON.parse(j);
                        // Normalize old format fields
                        return { at: p.modifiedAt, lines: p.lines || [] };
                      } catch(e2) { return null; }
                    }
                  }
                  return null;
                };
                const historyData = getOldVersion(detailVoucher.line_note);
                const currentNotes = (detailVoucher.line_note || '')
                                      .split(/\[تعديل حديث\]|\[تم تعديله\]|\[تم إصدار الفاتورة|\[إضافة مراجعة\]|\[مستند رقم|<!--/)[0]
                                      .trim();

                return (
                  <>
                    {/* Header: Symmetrical layout */}
                    {/* --- Premium Redesigned Header (Balanced & Sleeker) --- */}
                    <div className="relative px-6 py-4 shrink-0 overflow-hidden">
                      {/* Background Gradient & Animated Glow */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${isCancelled ? 'from-rose-600 to-rose-800' : isCompleted ? 'from-emerald-600 to-teal-800' : isIn ? 'from-teal-600 to-emerald-700' : 'from-indigo-600 to-blue-800'} transition-all duration-500`} />
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse" />
                      
                      <div className="relative flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl border border-white/20 shrink-0">
                              {isIn ? <Download size={22} strokeWidth={2.5} /> : <Upload size={22} strokeWidth={2.5} />}
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-white font-tajawal tracking-tight">
                                {isCancelled ? (
                                  <span className="flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-white" />
                                    {isIn ? 'سند إدخال (ملغي)' : 'سند إخراج (ملغي)'}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    {isIn ? 'سند إدخال مخزني' : 'سند إخراج بضاعة'}
                                    {isCompleted && <CheckCircle size={16} className="text-emerald-300" />}
                                  </span>
                                )}
                              </h3>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {/* Audit Trail Button - Premium Pill */}
                            {historyData && (
                              <button
                                type="button"
                                onClick={() => setShowVoucherHistory(v => !v)}
                                className={`h-10 px-5 rounded-full text-[11px] font-black transition-all flex items-center gap-2 border shadow-lg active:scale-95 ${
                                  showVoucherHistory 
                                  ? 'bg-amber-500 border-amber-400 text-white shadow-amber-500/30' 
                                  : 'bg-white/15 border-white/20 text-white hover:bg-white/25'
                                }`}
                              >
                                <History size={16} className={showVoucherHistory ? 'animate-spin-slow' : ''} />
                                {showVoucherHistory ? 'النسخة الحالية' : 'النسخة السابقة'}
                              </button>
                            )}
                            
                            <button
                              onClick={() => setIsVoucherDetailOpen(false)}
                              className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-all active:scale-90 border border-white/10"
                            >
                              <X size={20} />
                            </button>
                          </div>
                        </div>

                        {/* Distinct Stats Cards - Refined */}
                        <div className="grid grid-cols-3 gap-3">
                           <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-xl">
                              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-1">الجهة المستلمة</span>
                              <div className="flex items-center gap-2.5">
                                <User size={16} className="text-emerald-300" />
                                <p className="text-[15px] font-black text-white truncate leading-none">{recipient}</p>
                              </div>
                           </div>
                           <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-xl">
                              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-1">تاريخ العملية</span>
                              <div className="flex items-center gap-2.5">
                                <Calendar size={16} className="text-emerald-300" />
                                <p className="text-[15px] font-black text-white tabular-nums leading-none">{formattedShortDate}</p>
                              </div>
                           </div>
                           <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-xl">
                              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-1">ملاحظات السند</span>
                              <div className="flex items-center gap-2.5">
                                <FileText size={16} className="text-emerald-300" />
                                <p className="text-[15px] font-bold text-white leading-none truncate italic">
                                   {currentNotes || 'لا توجد'}
                                </p>
                              </div>
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* --- Content Area --- */}
                    <div className="flex-1 overflow-hidden bg-slate-50/50">
                      {lines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 opacity-40">
                          <FileText size={48} className="text-slate-300 mb-2" />
                          <p className="text-sm font-bold text-slate-400">لا توجد بيانات متاحة لهذا السند</p>
                        </div>
                      ) : showVoucherHistory && historyData && historyData.lines && historyData.lines.length > 0 ? (
                        /* ── Split-Screen: Two Full Voucher Cards ── */
                        <div className="grid grid-cols-2 h-full bg-slate-100/30" dir="rtl">
                          {(() => {
                            const oldDate = historyData.date || (historyData.at
                              ? new Date(historyData.at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })
                              : historyData.modifiedAt 
                                ? new Date(historyData.modifiedAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })
                                : 'تاريخ سابق');
                            const oldRecipient = historyData.beneficiary || recipient;
                            const oldNotes = historyData.notes || '';
                            
                            // Check if metadata has changed to decide on header visibility
                            const hasHeaderChange = oldRecipient !== recipient || oldNotes !== currentNotes;

                            return (
                              <>
                                {/* RIGHT: Current Voucher */}
                                <div className="flex flex-col overflow-hidden border-l border-slate-200/60 shadow-[inset_-10px_0_15px_-10px_rgba(0,0,0,0.05)]">
                                  {/* Card Header - Only if changed */}
                                  {hasHeaderChange ? (
                                    <div className="relative px-4 py-2.5 shrink-0 overflow-hidden">
                                      <div className={`absolute inset-0 bg-gradient-to-br ${isIn ? 'from-teal-500 to-emerald-600' : 'from-indigo-500 to-blue-600'}`} />
                                      <div className="relative flex items-center gap-3">
                                        <span className="text-[9px] font-black text-white px-2 py-1 rounded-lg bg-white/20 backdrop-blur-md border border-white/10 shadow-sm uppercase shrink-0">
                                          النسخة الحالية
                                        </span>
                                        <div className="flex items-center gap-2 text-white bg-white/10 px-2 py-1 rounded-lg border border-white/5 shadow-inner min-w-0">
                                          <User size={12} className="text-white/70 shrink-0" />
                                          <span className="text-[11px] font-black tracking-tight truncate">{recipient}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/90 bg-black/10 px-2 py-1 rounded-lg border border-white/5 shrink-0 mr-auto">
                                          <Calendar size={11} className="opacity-70" />
                                          {formattedShortDate}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="px-4 py-1.5 shrink-0 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-200/50 px-1.5 py-0.5 rounded">الحالية</span>
                                        <span className="text-[11px] font-bold text-slate-600">{recipient}</span>
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">{formattedShortDate}</span>
                                    </div>
                                  )}
                                  
                                  {/* Card Items */}
                                  <div className="overflow-y-auto custom-scrollbar flex-1 p-3">
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                      <table className="w-full text-right text-xs">
                                        <thead className={`${isIn ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'} font-black text-[10px] uppercase tracking-widest border-b sticky top-0 backdrop-blur-md z-10`}>
                                          <tr>
                                            <th className="px-3 py-2.5 text-center w-8">م</th>
                                            <th className="px-3 py-2.5 text-right">الصنف</th>
                                            <th className="px-3 py-2.5 text-center">القسم</th>
                                            <th className="px-3 py-2.5 text-center">كمية</th>
                                            <th className="px-3 py-2.5 text-center">وحدة</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {lines.map((line, idx) => (
                                            <tr key={line.id || idx} className={`transition-colors group hover:bg-slate-50/80`}>
                                              <td className={`px-3 py-2 text-center text-[10px] font-black ${isIn ? 'text-teal-300' : 'text-indigo-300'}`}>{idx + 1}</td>
                                              <td className="px-3 py-2 font-black text-slate-700 text-right text-[11px] leading-tight">
                                                {line.company && line.company !== '-' && !(line.item||'').includes(line.company)
                                                  ? <span className="flex flex-col"><span>{line.item}</span><span className="text-[9px] text-slate-400 font-bold">{line.company}</span></span> : line.item||'-'}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold">{line.cat||'-'}</span>
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-lg font-black text-xs tabular-nums border ${isIn ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>{line.qty}</span>
                                              </td>
                                              <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-400">{line.unit||'كرتونة'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                {/* LEFT: Old Voucher Comparison */}
                                <div className="flex flex-col overflow-hidden bg-white/40">
                                  {/* Card Header - Only if changed */}
                                  {hasHeaderChange ? (
                                    <div className="relative px-4 py-2.5 shrink-0 overflow-hidden">
                                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600" />
                                      <div className="relative flex items-center gap-3">
                                        <span className="text-[9px] font-black text-white px-2 py-1 rounded-lg bg-white/20 backdrop-blur-md border border-white/10 shadow-sm uppercase shrink-0">
                                          النسخة السابقة
                                        </span>
                                        <div className="flex items-center gap-2 text-white bg-white/10 px-2 py-1 rounded-lg border border-white/5 shadow-inner min-w-0">
                                          <User size={12} className="text-white/70 shrink-0" />
                                          <span className="text-[11px] font-black tracking-tight truncate">{oldRecipient}</span>
                                        </div>
                                        {oldDate && (
                                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/90 bg-black/10 px-2 py-1 rounded-lg border border-white/5 shrink-0 mr-auto">
                                            <Calendar size={11} className="opacity-70" />
                                            {oldDate}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="px-4 py-1.5 shrink-0 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-200/50 px-1.5 py-0.5 rounded">السابقة</span>
                                        <span className="text-[11px] font-bold text-amber-700">{oldRecipient}</span>
                                      </div>
                                      <span className="text-[10px] font-bold text-amber-400 tabular-nums">{oldDate}</span>
                                    </div>
                                  )}
                                  
                                  {/* Card Items */}
                                  <div className="overflow-y-auto custom-scrollbar flex-1 p-3">
                                    <div className="bg-amber-50/40 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                                      <table className="w-full text-right text-xs">
                                        <thead className="bg-amber-100 text-amber-700 font-black text-[10px] uppercase tracking-widest border-b border-amber-200 sticky top-0 backdrop-blur-md z-10">
                                          <tr>
                                            <th className="px-3 py-2.5 text-center w-8">م</th>
                                            <th className="px-3 py-2.5 text-right">الصنف</th>
                                            <th className="px-3 py-2.5 text-center">القسم</th>
                                            <th className="px-3 py-2.5 text-center">كمية</th>
                                            <th className="px-3 py-2.5 text-center">وحدة</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-amber-100/50">
                                          {historyData.lines.filter(l => l.item && l.item.trim() !== '').map((l, i) => (
                                            <tr key={i} className="hover:bg-amber-100/40 transition-colors">
                                              <td className="px-3 py-2 text-center text-[10px] font-black text-amber-400">{i + 1}</td>
                                              <td className="px-3 py-2 font-black text-amber-900/80 text-right text-[11px] leading-tight">{l.item}</td>
                                              <td className="px-3 py-2 text-center">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[9px] font-bold">{l.cat||'-'}</span>
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-lg font-black text-xs tabular-nums border bg-amber-50 text-amber-700 border-amber-300 shadow-sm">{l.qty}</span>
                                              </td>
                                              <td className="px-3 py-2 text-center text-[10px] font-bold text-amber-500/70">{l.unit||'-'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        /* ── Normal Single-Column View ── */
                        <div className="p-6 overflow-y-auto custom-scrollbar h-full">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 px-1 text-slate-400">
                              <List size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">قائمة الأصناف الحالية</span>
                            </div>
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                              <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50/80 text-slate-400 font-black text-[9px] uppercase tracking-widest border-b border-slate-100 sticky top-0 backdrop-blur-md z-10">
                                  <tr>
                                    <th className="px-5 py-4 text-center w-12">م</th>
                                    <th className="px-5 py-4 text-right">الصنف</th>
                                    <th className="px-5 py-4 text-center">القسم</th>
                                    <th className="px-5 py-4 text-center">الكمية</th>
                                    <th className="px-5 py-4 text-center">الوحدة</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {lines.map((line, idx) => (
                                    <tr key={line.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-5 py-4 text-[10px] font-bold text-center tabular-nums text-slate-400">{idx + 1}</td>
                                      <td className="px-5 py-4 text-right">
                                        <span className="text-sm font-black text-slate-700">
                                          {line.company && line.company !== '-' && !(line.item||'').includes(line.company)
                                            ? `${line.item||'-'} - ${line.company}` : line.item||'-'}
                                        </span>
                                      </td>
                                      <td className="px-5 py-4 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500">{line.cat||'-'}</span>
                                      </td>
                                      <td className="px-5 py-4 text-center">
                                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg font-black text-xs tabular-nums border ${isIn ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{line.qty}</span>
                                      </td>
                                      <td className="px-5 py-4 text-center">
                                        <span className="text-[11px] font-bold text-slate-400">{line.unit||'كرتونة'}</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* --- Balanced Footer --- */}
                    <div className="px-6 py-5 bg-white border-t border-slate-100 shrink-0">
                      <div className="flex items-center justify-center gap-4">
                        {isCancelled && (
                          <div className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/50 shadow-sm">
                            <AlertTriangle size={18} />
                            <span className="text-[13px] font-black font-tajawal">هذا السند ملغي ولا يمكن إصدار فاتورة له</span>
                          </div>
                        )}

                        {isCompleted && invoiceDate && (
                          <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/50 shadow-sm">
                            <CheckCircle size={18} />
                            <span className="text-[13px] font-black font-tajawal">تم إصدار الفاتورة بتاريخ {invoiceDate}</span>
                          </div>
                        )}

                        {!(isCancelled || (isCompleted && invoiceDate)) && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsInvoiced(detailVoucher)}
                            className={`px-12 py-3 rounded-2xl text-xs font-black text-white ${isIn ? 'bg-gradient-to-r from-teal-500 to-emerald-600 shadow-teal-500/30' : 'bg-gradient-to-r from-indigo-500 to-blue-600 shadow-indigo-500/30'} shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2`}
                          >
                            {isIn ? (
                              <><CheckCircle size={16} strokeWidth={3} /> اعتماد السند</>
                            ) : (
                              <><FileText size={16} strokeWidth={3} /> إصدار الفاتورة</>
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={() => setIsVoucherDetailOpen(false)}
                          className="px-12 py-3 rounded-2xl bg-slate-100 text-slate-500 text-[11px] font-black hover:bg-slate-200 hover:text-slate-600 transition-all active:scale-95 border border-slate-200"
                        >
                          إغلاق النافذة
                        </button>
                      </div>
                      
                      {!(isCancelled || (isCompleted && invoiceDate)) && !isIn && (
                        <p className="text-[9px] text-slate-400 font-bold text-center mt-3 italic">
                          * سيتم مراجعة الفاتورة قبل الاعتماد النهائي
                        </p>
                      )}
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

      {/* ═══ HYBRID BATCH REGISTRATION MODAL ═══ */}
      <AnimatePresence>
        {isItemModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0F2747]/60 backdrop-blur-md"
            dir="rtl"
            onClick={handleCloseItemModal}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.4)] border border-slate-100 dark:border-slate-800 flex flex-col h-[85vh] min-h-[650px] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
                <div className="flex flex-col">
                  <h3 className="text-2xl font-black text-[#1e293b] dark:text-white font-tajawal tracking-tight">تعريف أصناف جديدة</h3>
                  <p className="text-[13px] text-slate-400 font-readex mt-1 font-semibold">
                    {sessionItems.length > 0 ? `${sessionItems.length} صنف في الجلسة — اضغط "اعتماد وحفظ" لإتمام التسجيل` : 'أضف الأصناف للقائمة ثم اعتمدها دفعة واحدة'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseItemModal}
                  className="p-3 text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-500 rounded-2xl transition-all active:scale-90"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Exit Confirmation Overlay (Internal to Modal for better UX) */}
                <AnimatePresence>
                  {showExitConfirm && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[160] flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-b-[2rem]"
                      onClick={e => e.stopPropagation()}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl px-10 py-16 max-w-md w-full mx-4 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden"
                      >
                        <div className="w-20 h-20 rounded-[2rem] bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-6 text-rose-500">
                          <AlertTriangle size={40} />
                        </div>
                        <h4 className="text-2xl font-black font-tajawal text-slate-800 dark:text-white mb-3">تنبيه: بيانات غير محفوظة</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10 leading-relaxed px-4">
                          لديك <span className="font-black text-rose-500">{sessionItems.length}</span> صنف في القائمة لم يتم حفظهم بعد. هل أنت متأكد من الخروج؟
                        </p>
                        <div className="flex flex-col gap-3.5 px-4">
                          <button
                            type="button"
                            onClick={performModalReset}
                            className="w-full py-3 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
                          >
                            تأكيد الخروج وفقدان البيانات
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowExitConfirm(false)}
                            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          >
                            البقاء في القائمة
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Confirmation Overlay */}
                <AnimatePresence>
                  {showSaveConfirm && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[160] flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-b-[2rem]"
                      onClick={e => e.stopPropagation()}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl px-10 py-16 max-w-md w-full mx-4 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden"
                      >
                        <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 text-emerald-500">
                          <CheckCircle2 size={40} />
                        </div>
                        <h4 className="text-2xl font-black font-tajawal text-slate-800 dark:text-white mb-3">تأكيد الحفظ النهائي</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10 leading-relaxed px-4">
                          هل أنت متأكد من اعتماد وحفظ <span className="font-black text-emerald-500">{sessionItems.length}</span> صنف في قاعدة البيانات؟
                        </p>
                        <div className="flex flex-col gap-3.5 px-4">
                          <button
                            type="button"
                            onClick={confirmRegisterBatchSave}
                            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
                          >
                            نعم، اعتماد وحفظ الكل
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowSaveConfirm(false)}
                            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          >
                            مراجعة القائمة
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Entry Form Row - Compact Single-Row Header */}
                <div className="px-8 pt-6 pb-4 shrink-0">
                  <div className="bg-[#f8fbf9] p-5 rounded-[24px] border border-[#f0f5f3] flex items-end gap-4 shadow-sm relative group/header">
                    {/* Item Name */}
                    <div className="flex-[2.5] relative">
                      <label className="block text-[11px] font-bold text-[#8ba3b5] uppercase mb-2 text-center tracking-widest">اسم الصنف الكامل *</label>
                      <input
                        ref={itemNameInputRef}
                        type="text"
                        autoFocus
                        autoComplete="off"
                        className="w-full h-[46px] rounded-[14px] px-4 text-[13px] font-bold border-2 border-transparent bg-white outline-none focus:border-[#10b981] transition-all text-center shadow-sm placeholder:text-slate-300 placeholder:font-medium text-slate-800"
                        placeholder="مثال: فراولة مركز ماريتا"
                        value={itemForm.name}
                        onChange={e => handleNameInput(e.target.value)}
                        onKeyDown={e => handleModalKeyDown(e, 'name')}
                      />
                      {nameSuggestions.length > 0 && (
                        <div className="absolute z-[100] top-full right-0 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mt-1 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                          {nameSuggestions.map((s, i) => (
                            <div key={i} onMouseDown={() => { handleNameInput(s); setNameSuggestions([]); setTimeout(() => companyInputRef.current?.focus(), 50); }} className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors text-center ${activeNameIdx === i ? 'bg-[#10b981] text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white'}`}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Company */}
                    <div className="flex-[2.5] relative">
                      <label className="block text-[11px] font-bold text-[#8ba3b5] uppercase mb-2 text-center tracking-widest">الشركة *</label>
                      <input
                        ref={companyInputRef}
                        type="text"
                        autoComplete="off"
                        className="w-full h-[46px] rounded-[14px] px-4 text-[13px] font-bold border-2 border-transparent bg-white outline-none focus:border-[#10b981] transition-all text-center shadow-sm placeholder:text-slate-300 placeholder:font-medium text-slate-800"
                        placeholder="اسم الشركة..."
                        value={itemForm.company}
                        onChange={e => handleCompanyInput(e.target.value)}
                        onKeyDown={e => handleModalKeyDown(e, 'company')}
                      />
                      {companySuggestions.length > 0 && (
                        <div className="absolute z-[100] top-full right-0 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mt-1 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                          {companySuggestions.map((s, i) => (
                            <div key={i} onMouseDown={() => { handleCompanyInput(s); setCompanySuggestions([]); }} className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors text-center ${activeCompIdx === i ? 'bg-[#10b981] text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white'}`}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <div className="flex-[1.8] relative">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <label className="text-[11px] font-bold text-[#8ba3b5] uppercase tracking-tighter w-full text-center">القسم</label>
                        <button type="button" onClick={() => setIsAddingCategory(!isAddingCategory)} className="text-[#10b981] hover:scale-110 transition-transform p-0.5 absolute left-2 top-0"><Plus size={14} strokeWidth={3} /></button>
                      </div>
                      {isAddingCategory ? (
                        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center bg-white dark:bg-slate-900 border-2 border-[#10b981]/40 rounded-[14px] overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-200 h-[46px]">
                          <input
                            ref={newCategoryInputRef}
                            type="text"
                            autoFocus
                            className="flex-1 h-full px-3 text-[13px] font-bold outline-none bg-transparent text-center text-slate-800"
                            placeholder="قسم جديد..."
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
                              if (e.key === 'Escape') { setIsAddingCategory(false); setNewCategoryName(''); }
                            }}
                          />
                          <button type="button" onClick={handleAddCategory} className="p-2 text-[#10b981] hover:bg-emerald-50 transition-colors"><CheckCircle2 size={16} /></button>
                        </div>
                      ) : (
                        <select
                          className="w-full h-[46px] rounded-[14px] px-2 text-[13px] font-bold border-2 border-transparent bg-white outline-none focus:border-[#10b981] cursor-pointer text-center shadow-sm appearance-none text-slate-800"
                          value={itemForm.cat}
                          onChange={e => setItemForm({ ...itemForm, cat: e.target.value })}
                          onKeyDown={e => handleModalKeyDown(e, 'other')}
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </div>

                    {/* Unit */}
                    <div className="flex-[1.8] relative">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <label className="text-[11px] font-bold text-[#8ba3b5] uppercase tracking-tighter w-full text-center">الوحدة</label>
                        <button type="button" onClick={() => setIsCustomUnit(!isCustomUnit)} className="text-[#10b981] hover:scale-110 transition-transform p-0.5 absolute left-2 top-0"><Plus size={14} strokeWidth={3} /></button>
                      </div>
                      {isCustomUnit ? (
                        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center bg-white dark:bg-slate-900 border-2 border-[#10b981]/40 rounded-[14px] overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-200 h-[46px]">
                          <input
                            ref={unitInputRef}
                            type="text"
                            autoFocus
                            className="flex-1 h-full px-3 text-[13px] font-bold outline-none bg-transparent text-center text-slate-800"
                            placeholder="وحدة مخصصة..."
                            value={itemForm.unit}
                            onChange={e => setItemForm({...itemForm, unit: e.target.value})}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); setIsCustomUnit(false); }
                              if (e.key === 'Escape') { setIsCustomUnit(false); }
                            }}
                          />
                          <button type="button" onClick={() => setIsCustomUnit(false)} className="p-2 text-[#10b981] hover:bg-emerald-50 transition-colors"><CheckCircle2 size={16} /></button>
                        </div>
                      ) : (
                        <select
                          className="w-full h-[46px] rounded-[14px] px-2 text-[13px] font-bold border-2 border-transparent bg-white outline-none focus:border-[#10b981] cursor-pointer text-center shadow-sm appearance-none text-slate-800"
                          value={itemForm.unit}
                          onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                          onKeyDown={e => handleModalKeyDown(e, 'other')}
                        >
                          {units && units.length > 0 ? units.map(u => <option key={u} value={u}>{u}</option>) : ['كرتونة','قطعة','كيلو','لتر','طرد','علبة'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      )}
                    </div>

                    {/* Add Button */}
                    <div className="shrink-0 mb-1">
                      <button
                        type="button"
                        onClick={addToSession}
                        title={editingSessionId ? "تحديث الصنف" : "إضافة للقائمة (Enter)"}
                        className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all duration-300 relative overflow-hidden group/btn shadow-md ${
                          editingSessionId 
                            ? 'bg-orange-500 hover:bg-orange-600' 
                            : 'bg-[#10b981] hover:bg-[#0ea5e9]'
                        } active:scale-95`}
                        style={!editingSessionId ? { backgroundColor: '#10b981' } : {}}
                      >
                        {editingSessionId ? (
                          <Save size={20} className="text-white relative z-10 group-hover/btn:rotate-12 transition-transform duration-300" />
                        ) : (
                          <Plus size={24} strokeWidth={3} className="text-white relative z-10 transition-transform duration-300 group-hover/btn:rotate-90" />
                        )}
                      </button>
                    </div>
                  </div>
                  {editingSessionId && (
                    <div className="flex justify-end mt-2 px-1">
                      <button type="button" onClick={() => { setEditingSessionId(null); setItemForm({name:'', company:'', cat: categories[0], unit: units[0]}); }} className="text-[10px] font-black text-rose-500 hover:underline">إلغاء التعديل</button>
                    </div>
                  )}
                </div>

                {/* Preview Table */}
                <div className="flex-1 overflow-hidden px-8 pb-6 flex flex-col min-h-0">
                  <div className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden flex flex-col min-h-0 shadow-sm">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <table className="w-full border-separate border-spacing-0 text-center">
                        <thead className="sticky top-0 z-10 bg-white dark:bg-slate-950">
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                            <th className="py-3 px-4 w-12 border-b border-slate-100 dark:border-slate-800">م</th>
                            <th className="py-3 px-4 border-b border-slate-100 dark:border-slate-800 w-[35%] text-center">اسم الصنف</th>
                            <th className="py-3 px-4 border-b border-slate-100 dark:border-slate-800 w-[25%] text-center">الشركة / المورد</th>
                            <th className="py-3 px-4 w-32 border-b border-slate-100 dark:border-slate-800 text-center">القسم</th>
                            <th className="py-3 px-4 w-28 border-b border-slate-100 dark:border-slate-800 text-center">الوحدة</th>
                            <th className="py-3 px-4 w-24 border-b border-slate-100 dark:border-slate-800 text-center">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                          {sessionItems.map((item, idx) => (
                            <tr key={item.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors ${editingSessionId === item.id ? 'bg-orange-50/50 dark:bg-orange-500/5' : ''}`}>
                              <td className="py-3.5 px-4 text-[11px] font-bold text-slate-400 tabular-nums text-center">{idx + 1}</td>
                              <td className="py-3.5 px-4 font-tajawal font-bold text-xs text-slate-800 dark:text-white text-center">{item.name}</td>
                              <td className="py-3.5 px-4 text-center"><span className="text-[10px] font-bold text-slate-500">{item.company}</span></td>
                              <td className="py-3.5 px-4 text-center"><span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-100 dark:border-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px] font-black">{item.cat}</span></td>
                              <td className="py-3.5 px-4 text-[10px] font-bold text-slate-500 text-center">{item.unit}</td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setItemForm({name: item.name, company: item.company, cat: item.cat, unit: item.unit});
                                      setEditingSessionId(item.id);
                                      itemNameInputRef.current?.focus();
                                    }}
                                    className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                    title="تعديل"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeSessionItem(item.id)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                                    title="حذف"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {sessionItems.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-24 text-center">
                                <div className="flex flex-col items-center justify-center opacity-40">
                                  <div className="w-16 h-16 flex items-center justify-center mb-4">
                                    <Package size={48} className="text-slate-200" strokeWidth={1.5} />
                                  </div>
                                  <p className="text-[13px] font-black font-tajawal text-slate-300 mb-1">ابدأ بإضافة الأصناف للقائمة</p>
                                  <p className="text-[11px] font-bold text-slate-200">بيانات الصنف ستظهر هنا قبل الحفظ النهائي</p>
                                </div>
                              </td>
                            </tr>
                          )}

                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-5 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 border-t border-slate-50">
                <button
                  type="button"
                  onClick={handleCloseItemModal}
                  className="px-8 py-2.5 rounded-[12px] text-sm font-bold text-[#64748b] border border-[#e2e8f0] bg-white hover:bg-slate-50 transition-all active:scale-95"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  disabled={sessionItems.length === 0 || loading}
                  onClick={handleRegisterBatchSave}
                  className="px-8 py-3 rounded-[12px] text-sm font-black text-white bg-[#86d4b4] hover:bg-[#6ec29e] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
                >
                  {loading ? (
                    <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> جاري الحفظ...</>
                  ) : (
                    <><CheckCircle2 size={18} /> اعتماد وحفظ القائمة {sessionItems.length > 0 ? `(${sessionItems.length})` : ''}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <StockInwardModal 
        isOpen={isStockInModalOpen} 
        onClose={() => setIsStockInModalOpen(false)}
        onExitToDashboard={() => setIsStockInModalOpen(false)}
        onSaveSuccess={() => {
          fetchInitialData();
          setIsStockInModalOpen(false);
        }}
      />

      {showNewItemPrompt && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><Package size={24} className="text-amber-600" /></div>
              <h4 className="text-base font-bold text-slate-800 font-tajawal mb-2">صنف غير مسجل</h4>
              <p className="text-sm text-slate-600 font-readex leading-relaxed">الصنف "<span className="font-bold text-slate-800">{promptItemName}</span>" غير مسجل. هل تود إضافته؟</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-3">
              <button type="button" onClick={handlePromptYes} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md transition-all">نعم</button>
              <button type="button" onClick={handlePromptNo} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-all">لا</button>
            </div>
          </motion.div>
        </motion.div>
      )}

            <ModalWrapper title={isVoucherInvoice ? "مراجعة فاتورة صادر" : "إنشاء فاتورة صادر (نظام بريميوم)"} 
        maxWidth="max-w-6xl" 
        isOpen={isSalesModalOpen} 
        onClose={handleCloseInvoiceModal} 
        onSubmit={handleAddInvoice} 
        compact
        loading={loading}>

          {/* Header Fields - Client, Representative, and Date */}
          <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              
             
             <div className="flex flex-col">
               <label className="text-[10px] font-black text-slate-400 mb-1 mr-1 uppercase">المندوب المسجل <span className="text-red-500">*</span></label>
               <input
                 type="text"
                 list="reps-datalist"
                 className={`w-full h-[38px] bg-white border ${!invoiceForm.rep.trim() && invoiceErrors.rep ? 'border-red-200 ring-2 ring-red-500/5' : 'border-slate-200'} text-slate-800 text-[13px] font-black rounded-xl px-4 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all font-tajawal`}
                 value={invoiceForm.rep}
                 
                 onChange={(e) => {
                    setInvoiceForm({...invoiceForm, rep: e.target.value});
                    if (e.target.value.trim()) setInvoiceErrors(prev => ({...prev, rep: false}));
                 }}
                 autoComplete="off" id="invoiceRepInput" placeholder="اسم مندوب المبيعات"
               />
               <datalist id="reps-datalist">
                 {repsList.map(rep => <option key={rep} value={rep} />)}
               </datalist>
             </div>

             <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 mb-1 mr-1 uppercase">تاريخ الفاتورة</label>
                <div className="relative">
                  <input 
                    type="date" 
                    className="w-full h-[38px] bg-white border border-slate-200 text-slate-800 text-[13px] font-black rounded-xl px-4 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all font-readex text-center" 
                    value={invoiceForm.date} 
                    onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})} 
                     
                  />
                </div>
             </div>
          </div>

          {/* Item Entry Section - Redesigned Card */}
          {!isVoucherInvoice && (
            <div className={`p-2.5 rounded-[1.2rem] border mb-2 shadow-sm ${isVoucherInvoice ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-2 mr-1">
                  <div className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                  <h4 className="text-[11px] font-black text-slate-700 font-tajawal">إضافة سريع للأصناف</h4>
              </div>
              <div className="flex flex-wrap items-end gap-2.5">
                  {/* Search Field */}
                  <div className="flex-1 min-w-[250px] relative group/item">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 mr-1 uppercase h-[15px] leading-[15px]">البحث عن صنف</label>
                    <div className="relative">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        ref={invoiceSearchInputRef}
                        type="text"
                        autoComplete="off"
                        className="w-full h-[38px] bg-white border border-slate-200 text-slate-800 text-[13px] font-black rounded-xl pr-9 pl-3 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all font-tajawal placeholder:text-slate-300 placeholder:font-semibold"
                        placeholder="اكتب اسم الصنف هنا..."
                        value={currentInvoiceItem.name}
                        onChange={(e) => {
                          setCurrentInvoiceItem({...currentInvoiceItem, name: e.target.value, selectedItem: null, cat: '', unit: ''});
                          setInvoiceSearchActiveIndex(-1);
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
                              setTimeout(() => document.getElementById('invoiceQtyInput')?.focus(), 10);
                            } else if (currentInvoiceItem.selectedItem) {
                              setTimeout(() => document.getElementById('invoiceQtyInput')?.focus(), 10);
                            }
                          }
                        }}
                      />
                    </div>
                    {currentInvoiceItem.name && !currentInvoiceItem.selectedItem && (
                      <div className="hidden group-focus-within/item:block absolute top-[110%] right-0 w-full max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-1.5 backdrop-blur-xl custom-scrollbar">
                        {items.filter(i => i.name.includes(currentInvoiceItem.name) || i.company.includes(currentInvoiceItem.name)).map((invItem, idx) => (
                             <button key={invItem.id} type="button" className={`w-full text-right px-3 py-2 rounded-lg transition-all ${invoiceSearchActiveIndex === idx ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`} onMouseDown={(e) => {
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
                                 <div className="flex flex-col">
                                    <span className="text-xs font-black">{invItem.name}</span>
                                    <span className="text-[9px] font-bold opacity-60">{invItem.company}</span>
                                 </div>
                                 <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">رصيد: {invItem.stockQty}</span>
                               </div>
                             </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quantity Field */}
                  <div className="w-[85px]">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 text-center uppercase h-[15px] leading-[15px]">الكمية</label>
                    <input
                      type="number"
                      id="invoiceQtyInput"
                      className="w-full h-[38px] bg-white border-2 border-indigo-400/50 focus:border-indigo-500 text-indigo-700 text-sm rounded-xl px-2 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-center font-black tabular-nums shadow-inner"
                      placeholder="0"
                      value={currentInvoiceItem.qty}
                      onChange={(e) => { if (e.target.value.length <= 4) setCurrentInvoiceItem({...currentInvoiceItem, qty: e.target.value}); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddInvoiceItemToTable(); } }}
                    />
                  </div>

                  {/* Category & Unit - Unified Fields */}
                  <div className="w-[85px]">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 text-center uppercase h-[15px] leading-[15px]">القسم</label>
                    <input type="text" className="w-full h-[38px] bg-slate-100/50 border border-slate-200/60 text-slate-600 text-[12px] font-black rounded-xl px-2 outline-none cursor-default text-center transition-all" value={currentInvoiceItem.cat || '-'} readOnly />
                  </div>

                  <div className="w-[85px]">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 text-center uppercase h-[15px] leading-[15px]">الوحدة</label>
                    <input type="text" className="w-full h-[38px] bg-white border border-slate-200 text-slate-800 text-[12px] font-black rounded-xl px-2 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all text-center" value={currentInvoiceItem.unit} onChange={(e) => setCurrentInvoiceItem({...currentInvoiceItem, unit: e.target.value})} placeholder="كرتونة" />
                  </div>

                  {/* Add/Update Button */}
                  <button
                    type="button"
                    className={`w-[38px] h-[38px] ${currentInvoiceItem.selectedItem ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300'} text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center hover:scale-105 active:scale-95 shrink-0`}
                    onClick={handleAddInvoiceItemToTable}
                    title={currentInvoiceItem.selectedItem ? "إضافة/تحديث الصنف" : "حدد صنف أولاً"}
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
               </div>
            </div>
          )}

          {/* Middle Section (The Table - Redesigned) */}
          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden flex flex-col flex-1 min-h-[45vh] shadow-sm">
            <div className="overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar pt-2">
              <table className="w-full min-w-max text-right text-xs whitespace-nowrap">
                <thead className="bg-slate-50/30 sticky top-0 z-10 backdrop-blur-md">
                  <tr className="text-[10px] font-black text-slate-500 border-b border-slate-100 uppercase tracking-wider">
                    <th className="px-6 py-4 w-16 text-center">م</th>
                    <th className="px-6 py-4 min-w-[250px]">اسم الصنف</th>
                    <th className="px-6 py-4 w-32">التصنيف</th>
                    <th className="px-6 py-4 w-24 text-center">الوحدة</th>
                    <th className="px-6 py-4 w-32 text-center">الكمية</th>
                    {!isVoucherInvoice && <th className="px-6 py-4 w-20 text-center">الإجراء</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoiceForm.items.length === 0 ? (
                    <tr>
                      <td colSpan={isVoucherInvoice ? 5 : 6} className="text-center py-20">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100/50">
                            <Package size={32} className="text-slate-300" />
                          </div>
                          <p className="text-sm font-bold text-slate-400 font-tajawal">{isVoucherInvoice ? 'لا توجد أصناف منقولة من السند' : 'ابدأ بإضافة الأصناف للفاتورة من الأعلى'}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    invoiceForm.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition-all group border-b border-slate-50 last:border-0">
                        <td className="px-6 py-4 text-[11px] font-black text-slate-300 text-center group-hover:text-indigo-400 transition-colors tabular-nums">{idx + 1}</td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-700">{item.name && item.company ? item.name : (item.name || item.item || '-')}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black">{item.cat || 'بدون تصنيف'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{item.unit || 'كرتونة'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-xl ${isVoucherInvoice ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-red-50 text-red-600 border-red-100'} border font-black text-sm tabular-nums`}>
                              {isVoucherInvoice ? item.qty : `-${item.qty}`}
                           </div>
                        </td>
                        {!isVoucherInvoice && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100">
                              <button 
                                type="button" 
                                onClick={() => handleEditInvoiceItem(idx)} 
                                className={`w-9 h-9 flex items-center justify-center ${isVoucherInvoice ? 'text-indigo-500 hover:bg-indigo-50' : 'text-blue-500 hover:bg-blue-50'} rounded-xl transition-all`}
                                title="تعديل"
                              >
                                <Pencil size={18} strokeWidth={2.5} />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setInvoiceForm({...invoiceForm, items: invoiceForm.items.filter((_, i) => i !== idx)})} 
                                className="w-9 h-9 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="حذف"
                              >
                                <Trash2 size={18} strokeWidth={2.5} />
                              </button>
                            </div>
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
      


      {/* 4. Add Return (Compact Layout with Hybrid Search & Intelligent Expiry) */}
      <ModalWrapper title="تسجيل مرتجع مخزني" maxWidth="max-w-6xl" isOpen={isReturnsModalOpen} onClose={handleCloseReturnModal} onSubmit={handleAddReturn} compact loading={loading}>
          {/* Header Fields - Returnee, Representative, and Date */}
          <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 mb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
             <div className="flex flex-col">
               <label className="text-[10px] font-black text-slate-400 mb-1 mr-1 uppercase">اسم المرجع / العميل <span className="text-red-500">*</span></label>
               <input
                 type="text"
                 className={`w-full bg-white border ${!returnForm.returnee.trim() ? 'border-red-200 ring-2 ring-red-500/5' : 'border-slate-200'} text-slate-800 text-[13px] font-black rounded-xl px-4 py-2 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all font-tajawal`}
                 value={returnForm.returnee}
                 onChange={(e) => {
                   setReturnForm({...returnForm, returnee: e.target.value});
                   if (e.target.value.trim()) setReturnErrors(prev => ({...prev, returnee: false}));
                 }}
                 placeholder="من قام بالإرجاع؟"
               />
             </div>
             
             <div className="flex flex-col">
               <label className="text-[10px] font-black text-slate-400 mb-1 mr-1 uppercase">المندوب المستلم <span className="text-red-500">*</span></label>
               <input
                 type="text"
                 list="reps-datalist"
                 className={`w-full h-[38px] bg-white border ${!returnForm.rep.trim() && returnErrors.rep ? "border-red-200 ring-2 ring-red-500/5" : "border-slate-200"} text-slate-800 text-[13px] font-black rounded-xl px-4 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all font-tajawal`}
                 value={returnForm.rep}
                 onChange={(e) => { setReturnForm({...returnForm, rep: e.target.value}); if (e.target.value.trim()) setReturnErrors(prev => ({...prev, rep: false})); }}
                 placeholder="اسم المندوب"
               />
             </div>

             <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 mb-1 mr-1 uppercase">تاريخ الإرجاع</label>
                <input 
                  type="date" 
                  className="w-full bg-white border border-slate-200 text-slate-800 text-[13px] font-black rounded-xl px-4 py-2 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all font-readex text-center" 
                  value={returnForm.date} 
                  onChange={(e) => setReturnForm({...returnForm, date: e.target.value})} 
                />
             </div>
          </div>

          {/* Top Section (Fixed Entry - Compact Style) */}
          <div className="bg-slate-50/50 p-2.5 rounded-[1.2rem] border border-slate-100 mb-2 shadow-sm">
             <div className="flex items-center gap-2 mb-2 mr-1">
                <div className="w-1.5 h-3 bg-amber-500 rounded-full" />
                <h4 className="text-[11px] font-black text-slate-700 font-tajawal">إضافة سريع للمرتجعات</h4>
             </div>
             <div className="flex flex-wrap items-end gap-2.5">
                {/* Search Field */}
                <div className="flex-1 min-w-[200px] relative group/ret">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 mr-1 uppercase h-[15px] leading-[15px]">البحث عن صنف</label>
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={returnSearchInputRef}
                      type="text"
                      id="returnSearchInput"
                      className="w-full h-[38px] bg-white border border-slate-200 text-slate-800 text-[13px] font-black rounded-xl pr-9 pl-3 outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/30 transition-all font-tajawal placeholder:text-slate-300 placeholder:font-semibold"
                      placeholder="اكتب للبحث أو إضافة صنف جديد..."
                      value={returnForm.query}
                      onChange={(e) => {
                        setReturnForm({...returnForm, query: e.target.value, selectedItem: null, cat: '', unit: ''});
                        setReturnSearchActiveIndex(-1);
                      }}
                      onBlur={() => {
                        if (returnForm.query.trim().length >= 2 && !returnForm.selectedItem) {
                          const matchFound = items.some(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query));
                          if (!matchFound) {
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
                            setReturnForm({...returnForm, query: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat || invItem.category || '', unit: invItem.unit || 'كرتونة', expiryDate: isReturnExpiryDisabled ? '' : '', returnStatus: returnForm.returnStatus || 'سليم' });
                            setReturnSearchActiveIndex(-1);
                            setTimeout(() => document.getElementById('returnQtyInput')?.focus(), 10);
                          } else if (suggestions.length === 0 && returnForm.query.trim().length >= 2) {
                            triggerNewItemRegistration(returnForm.query.trim(), 'return');
                          } else if (returnForm.selectedItem) {
                            setTimeout(() => document.getElementById('returnQtyInput')?.focus(), 10);
                          }
                        } else if (e.key === 'Tab') {
                          setTimeout(() => document.getElementById('returnQtyInput')?.focus(), 10);
                        }
                      }}
                    />
                  </div>
                  {returnForm.query && !returnForm.selectedItem && (
                    <div className="hidden group-focus-within/ret:block absolute top-[110%] right-0 w-full max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-1.5 backdrop-blur-xl custom-scrollbar">
                      {items.filter(i => i.name.includes(returnForm.query) || i.company.includes(returnForm.query)).map((invItem, idx) => (
                           <button key={invItem.id} type="button" className={`w-full text-right px-3 py-2 rounded-lg transition-all ${returnSearchActiveIndex === idx ? 'bg-amber-50 text-amber-700' : 'hover:bg-slate-50 text-slate-700'}`} onMouseDown={(e) => {
                             e.preventDefault();
                             const isReturnExpiryDisabled = invItem.cat === 'بلاستيك';
                             setReturnForm({...returnForm, query: `${invItem.name} - ${invItem.company}`, selectedItem: invItem, cat: invItem.cat || invItem.category || '', unit: invItem.unit || 'كرتونة', expiryDate: isReturnExpiryDisabled ? '' : '', returnStatus: returnForm.returnStatus || 'سليم' });
                             setReturnSearchActiveIndex(-1);
                             setTimeout(() => { document.getElementById('returnQtyInput')?.focus(); }, 10);
                           }}>
                             <div className="flex justify-between items-center w-full">
                               <div className="flex flex-col">
                                  <span className="text-xs font-black">{invItem.name}</span>
                                  <span className="text-[9px] font-bold opacity-60">{invItem.company}</span>
                               </div>
                               <span className="text-[9px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md">رصيد: {invItem.stockQty}</span>
                             </div>
                           </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity Field */}
                <div className="w-[85px] shrink-0">
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 text-center uppercase h-[15px] leading-[15px]">الكمية</label>
                  <input 
                    type="number" 
                    id="returnQtyInput" 
                    className="w-full h-[38px] bg-white border-2 border-amber-400/50 focus:border-amber-500 text-amber-700 text-sm rounded-xl px-2 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all text-center font-black tabular-nums shadow-inner" 
                    placeholder="0" 
                    maxLength={4}
                    value={returnForm.qty} 
                    onChange={(e) => { if (e.target.value.length <= 4) setReturnForm({...returnForm, qty: e.target.value}); }} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddReturnItemToTable(); }
                    }} 
                  />
                </div>

                {/* Category Field */}
                <div className="w-[85px] shrink-0">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 text-center uppercase h-[15px] leading-[15px]">القسم</label>
                  <input type="text" className="w-full h-[38px] bg-slate-100/50 border border-slate-200/60 text-slate-600 text-[12px] font-black rounded-xl px-2 outline-none cursor-default text-center transition-all" value={returnForm.cat || '-'} readOnly placeholder="تلقائي" />
                </div>

                {/* Unit Field */}
                <div className="w-[85px] shrink-0">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 text-center uppercase h-[15px] leading-[15px]">الوحدة</label>
                  {returnForm.selectedItem ? (
                    <input type="text" className="w-full h-[38px] bg-slate-100/50 border border-slate-200/60 text-slate-600 text-[12px] font-black rounded-xl px-2 outline-none cursor-default text-center transition-all font-tajawal" value={returnForm.unit || 'كرتونة'} readOnly placeholder="تلقائي" />
                  ) : (
                    <input type="text" className="w-full h-[38px] bg-white border border-slate-200 text-slate-800 text-[13px] font-black rounded-xl px-2 outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500/30 transition-all text-center font-tajawal" value={returnForm.unit || 'كرتونة'} onChange={(e) => setReturnForm({...returnForm, unit: e.target.value})} placeholder="كرتونة" />
                  )}
                </div>

                {/* Return Status Field */}
                <div className="w-[85px] shrink-0">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 text-center uppercase h-[15px] leading-[15px]">الحالة</label>
                  <select 
                    className={`w-full h-[38px] border text-[12px] font-black rounded-xl px-1 outline-none focus:ring-4 transition-all text-center ${returnForm.returnStatus === 'تالف' ? 'bg-red-50 border-red-200 text-red-600 focus:ring-red-500/10 focus:border-red-500' : 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500/10 focus:border-emerald-500'}`}
                    value={returnForm.returnStatus || 'سليم'} 
                    onChange={(e) => setReturnForm({...returnForm, returnStatus: e.target.value})}
                  >
                    <option value="سليم">سليم</option>
                    <option value="تالف">تالف</option>
                  </select>
                </div>

                {/* Add Button */}
                <button
                  type="button"
                  className="w-[38px] h-[38px] bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all shadow-md shadow-amber-200 flex items-center justify-center hover:scale-105 active:scale-95 shrink-0"
                  onClick={handleAddReturnItemToTable}
                  title="إضافة للمرتجع"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
             </div>
          </div>

          {/* Middle Section (The Table - Maximized Height) */}
          <div className="card overflow-hidden flex flex-col flex-1 min-h-[45vh]">

            <div className="overflow-y-auto w-full overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full min-w-max text-right text-xs whitespace-nowrap">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-[11px] font-black text-slate-600 border-b border-slate-200">
                    <th className="px-3 py-2 font-black w-10 text-center">م</th>
                    <th className="px-3 py-2 font-black min-w-[180px]">اسم الصنف</th>
                    <th className="px-3 py-2 font-black w-24">القسم</th>
                    <th className="px-3 py-2 font-black w-20">الوحدة</th>
                    <th className="px-3 py-2 font-black w-20 text-center">الكمية</th>
                    <th className="px-3 py-2 font-black w-20 text-center">الحالة</th>
                    <th className="px-3 py-2 font-black w-14 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {returnItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-slate-400 text-[10px] font-bold">
                        <div className="flex flex-col items-center justify-center opacity-50">
                          <RotateCcw size={28} className="mb-1.5" />
                          لم يتم إضافة أصناف مرتجعة بعد
                        </div>
                      </td>
                    </tr>
                  ) : (
                    returnItems.map((item, idx) => (
                      <tr key={idx} className={`transition-colors group ${item.returnStatus === 'تالف' ? 'bg-red-50/30 hover:bg-red-50' : 'bg-white hover:bg-slate-50'} border-b border-slate-50`}>
                        <td className="px-3 py-2 text-[10px] font-black text-slate-400 text-center tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2 text-xs font-black text-slate-800">
                          {item.name || '-'}
                        </td>
                        <td className="px-3 py-2 text-[10px]">
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-black">{item.cat}</span>
                        </td>
                        <td className="px-3 py-2 text-[10px] font-black text-slate-600">{item.unit}</td>
                        <td className="px-3 py-2 text-xs font-black text-emerald-600 border-r border-slate-100 text-center">+{item.qty}</td>
                        <td className="px-3 py-2 text-center text-[10px] font-black">
                          {item.returnStatus === 'تالف' ? (
                            <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded">تالف (توالف)</span>
                          ) : (
                            <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">سليم (للمخزن)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              type="button" 
                              onClick={() => handleEditReturnItem(idx)} 
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                              title="تعديل"
                            >
                              <Pencil size={14} strokeWidth={2.5} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { setReturnItems(prev => prev.filter((_, i) => i !== idx)); }} 
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                          </div>
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

      {/* Invoice Exit Confirmation Dialog */}
      <AnimatePresence>
        {showInvoiceExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] p-12 text-center border border-white"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 text-rose-500">
                  <AlertTriangle size={48} strokeWidth={2.5} />
               </div>
               <h4 className="text-3xl font-black text-slate-800 mb-3 font-tajawal tracking-tight">خروج وتجاهل؟</h4>
               <p className="text-sm text-slate-500 mb-12 font-readex leading-relaxed">الفاتورة الحالية تحتوي على أصناف أو بيانات. هل أنت متأكد من الخروج دون حفظ؟</p>
               
               <div className="flex flex-col gap-3">
                  <button 
                    onClick={performInvoiceReset} 
                    className="w-full py-4.5 rounded-2xl bg-rose-500 text-white text-lg font-black shadow-xl shadow-rose-500/25 hover:bg-rose-600 transition-all active:scale-95 font-tajawal"
                  >
                    نعم، تجاهل البيانات
                  </button>
                  <button 
                    onClick={() => setShowInvoiceExitConfirm(false)} 
                    className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold hover:bg-slate-200 transition-all font-tajawal"
                  >
                    تراجع والعودة
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

{/* Return Exit Confirmation Dialog */}
      <AnimatePresence>
        {showReturnExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] p-12 text-center border border-white"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 text-rose-500">
                  <AlertTriangle size={48} strokeWidth={2.5} />
               </div>
               <h4 className="text-3xl font-black text-slate-800 mb-3 font-tajawal tracking-tight">خروج وتجاهل؟</h4>
               <p className="text-sm text-slate-500 mb-12 font-readex leading-relaxed">لديك بيانات مرتجع لم يتم حفظها. هل أنت متأكد من الخروج وفقدان هذه البيانات؟</p>
               
               <div className="flex flex-col gap-3">
                  <button 
                    onClick={performReturnReset} 
                    className="w-full py-4.5 rounded-2xl bg-rose-500 text-white text-lg font-black shadow-xl shadow-rose-500/25 hover:bg-rose-600 transition-all active:scale-95 font-tajawal"
                  >
                    نعم، تجاهل البيانات
                  </button>
                  <button 
                    onClick={() => setShowReturnExitConfirm(false)} 
                    className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold hover:bg-slate-200 transition-all font-tajawal"
                  >
                    تراجع والعودة
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
{/* Save Confirmation Dialogs */}
      <AnimatePresence>
        {(showInvoiceSaveConfirm || showReturnSaveConfirm) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] p-12 text-center border border-white"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 text-emerald-600">
                  <CheckCircle2 size={48} strokeWidth={2.5} />
               </div>
               <h4 className="text-3xl font-black text-slate-800 mb-3 font-tajawal tracking-tight">تأكيد الحفظ</h4>
               <p className="text-sm text-slate-500 mb-12 font-readex leading-relaxed">
                  {showInvoiceSaveConfirm 
                    ? `هل أنت متأكد من حفظ الفاتورة لـ ${invoiceForm.client}؟ سيتم تحديث أرصدة المخزن فوراً.` 
                    : `هل أنت متأكد من اعتماد المرتجع من ${returnForm.returnee}؟`}
               </p>
               
               <div className="flex flex-col gap-3">
                  <button 
                    onClick={showInvoiceSaveConfirm ? performInvoiceSave : performReturnSave} 
                    disabled={loading}
                    className="w-full py-4.5 rounded-2xl bg-emerald-600 text-white text-lg font-black shadow-xl shadow-emerald-500/25 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2 font-tajawal disabled:opacity-50"
                  >
                    {loading ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><Save size={20} /> تأكيد وحفظ</>}
                  </button>
                  <button 
                    onClick={() => { setShowInvoiceSaveConfirm(false); setShowReturnSaveConfirm(false); }} 
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-slate-50 text-slate-400 font-bold hover:bg-slate-100 transition-all font-tajawal"
                  >
                    تراجع
                  </button>
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

      {/* Batch Registration Modals (Item Registration) */}
      <AnimatePresence>
        {showSaveConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="bg-white rounded-[3rem] shadow-2xl p-12 max-w-sm w-full text-center border border-slate-100">
               <CheckCircle2 size={40} className="text-emerald-600 mx-auto mb-6" />
               <h4 className="text-2xl font-black mb-3">تأكيد الحفظ</h4>
               <p className="text-sm text-slate-500 mb-10">حفظ {sessionItems.length} صنف؟</p>
               <button onClick={confirmRegisterBatchSave} className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black shadow-lg mb-3">تأكيد</button>
               <button onClick={() => setShowSaveConfirm(false)} className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold">تراجع</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExitConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="bg-white rounded-[3rem] shadow-2xl p-12 max-w-sm w-full text-center border border-slate-100">
               <AlertTriangle size={40} className="text-rose-500 mx-auto mb-6" />
               <h4 className="text-2xl font-black mb-3">خروج بدون حفظ؟</h4>
               <button onClick={performModalReset} className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black shadow-lg mb-3">نعم، خروج</button>
               <button onClick={() => setShowExitConfirm(false)} className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold">تراجع</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
