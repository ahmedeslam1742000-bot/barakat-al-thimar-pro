import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Image as ImageIcon, Loader2, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  ChevronDown, Truck, Layers, Search, LogOut,
  CheckCircle2, Save, Pencil, Trash2, Calendar,
  LayoutGrid, Warehouse, FileText, Camera, Upload
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { normalizeArabic } from '../lib/arabicTextUtils';
import { formatDate } from '../lib/dateUtils';

// --- Premium UI Components ---

const CompactLabel = ({ children, required, color = "text-slate-400" }) => (
  <label className={`block text-[10px] font-bold ${color} font-tajawal mb-1 px-1 tracking-tight uppercase`}>
    {children} {required && <span className="text-rose-400">*</span>}
  </label>
);

const PremiumInput = React.forwardRef(({ className, isError, ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full h-9 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 font-tajawal font-bold text-sm outline-none transition-all focus:border-[#279489]/40 focus:ring-4 focus:ring-[#279489]/5 placeholder:text-slate-300 ${className}`}
    {...props}
  />
));

export default function StockInwardModal({ isOpen, onClose, onSaveSuccess }) {
  const { playSuccess, playWarning } = useAudio();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  
  // Refs for Advanced Keyboard Navigation
  const itemNameRef = useRef(null);
  const qtyRef = useRef(null);
  const catSelectRef = useRef(null);
  const unitSelectRef = useRef(null);
  const newSupplierInputRef = useRef(null);
  const receiptNumRef = useRef(null);
  const exitConfirmBtnRef = useRef(null);
  const saveConfirmBtnRef = useRef(null);

  const [stockForm, setStockForm] = useState({
    loc: 'مستودع الرياض',
    supplier: '',
    date: formatDate(new Date()),
    receiptType: 'بدون',
    receiptNumber: '',
    receiptImage: null,
    receiptImageFile: null,
    items: []
  });

  const [currentStockItem, setCurrentStockItem] = useState({ 
    name: '', 
    selectedItem: null, 
    cat: 'مجمدات',
    unit: 'كرتونة', 
    qty: '',
  });

  const [suggestionsIndex, setSuggestionsIndex] = useState(-1);
  const [locations, setLocations] = useState(['مستودع الرياض']);
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  
  const [categories, setCategories] = useState(['مجمدات', 'بلاستيك', 'تبريد']);
  const [units, setUnits] = useState(['كرتونة', 'شدة', 'شوال', 'سطل', 'حبة', 'علب']);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        console.log("🔍 StockInwardModal: fetching products...");
        const { data, error } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty');
        if (error) {
          console.error("❌ StockInwardModal: Error fetching products:", error);
          return;
        }
        if (data) {
          console.log(`✅ StockInwardModal: fetched ${data.length} products`);
          setItems(data);
        }
      } catch (err) {
        console.error("❌ StockInwardModal: Unexpected error fetching products:", err);
      }
    };
    fetchItems();
  }, []);

  // Handle Global ESC Key
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (showSaveConfirm) setShowSaveConfirm(false);
        else if (showExitConfirm) setShowExitConfirm(false);
        else handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, showExitConfirm, showSaveConfirm, stockForm.items.length]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => itemNameRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const itemSuggestions = useMemo(() => {
    if (!currentStockItem.name || currentStockItem.selectedItem) return [];
    const query = normalizeArabic(currentStockItem.name);
    return items.filter(i => {
      const name = normalizeArabic(i.name);
      const company = normalizeArabic(i.company || '');
      return name.includes(query) || company.includes(query);
    }).slice(0, 8);
  }, [items, currentStockItem.name, currentStockItem.selectedItem]);

  // Reset suggestion index when suggestions change
  useEffect(() => {
    setSuggestionsIndex(-1);
  }, [itemSuggestions]);

  const handlePushToDraft = () => {
    const { name, qty, unit, cat, selectedItem } = currentStockItem;
    if (!name.trim() || !qty || Number(qty) <= 0) {
      toast.error('يرجى مراجعة الصنف والكمية');
      playWarning();
      return;
    }

    let targetItem = selectedItem;
    if (!targetItem) {
      const normName = normalizeArabic(name.trim());
      targetItem = items.find(i => normalizeArabic(i.name) === normName);
    }

    if (!targetItem) {
      toast.error('الصنف غير موجود، اختر من القائمة');
      return;
    }

    const newDraft = {
      id: Date.now() + Math.random(),
      itemId: targetItem.id,
      item: targetItem.name,
      company: targetItem.company || 'بدون شركة',
      cat: cat || targetItem.cat || 'مجمدات',
      unit: unit || targetItem.unit || 'كرتونة',
      qty: Number(qty),
    };

    setStockForm(prev => ({ ...prev, items: [newDraft, ...prev.items] }));
    setCurrentStockItem({ name: '', selectedItem: null, cat: categories[0], unit: units[0], qty: '' });
    setIsAddingCategory(false);
    setIsCustomUnit(false);
    playSuccess();
    toast.success('تمت الإضافة بنجاح ✅');
    setTimeout(() => itemNameRef.current?.focus(), 50);
  };

  const handleBulkSubmit = () => {
    if (stockForm.items.length === 0) {
      toast.error('أضف أصنافاً أولاً');
      return;
    }
    if (stockForm.receiptType !== 'بدون') {
      if (!stockForm.receiptNumber.trim()) {
        toast.error('رقم السند مطلوب');
        receiptNumRef.current?.focus();
        return;
      }
      if (!stockForm.receiptImageFile) {
        toast.error('صورة السند مطلوبة');
        return;
      }
    }
    setShowSaveConfirm(true);
    setTimeout(() => saveConfirmBtnRef.current?.focus(), 100);
  };

  const confirmBulkSubmit = async () => {
    if (loading) return; // Prevent double submission
    
    if (!navigator.onLine) {
      toast.error('عذراً، لا يوجد اتصال بالإنترنت حالياً. يرجى التأكد من الشبكة والمحاولة مرة أخرى.');
      return;
    }

    console.log("🚀 بدء عملية الحفظ النهائي...");
    setShowSaveConfirm(false);
    setLoading(true);

    const safetyTimeout = setTimeout(() => {
      console.warn("⚠️ Safety timeout triggered - forcing loading state to false");
      setLoading(false);
    }, 60000); // Increased to 60s

    const itemIds = [...new Set(stockForm.items.map(i => i.itemId))].filter(Boolean);
    
    if (itemIds.length === 0) {
      toast.error("لا توجد أصناف صالحة للحفظ (تأكد من اختيار الأصناف بشكل صحيح)");
      clearTimeout(safetyTimeout);
      setLoading(false);
      return;
    }

    // التحقق من تكرار رقم السند في حركات الوارد فقط
    if (stockForm.receiptNumber.trim()) {
      const { data: dup } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference_number', stockForm.receiptNumber.trim())
        .in('type', ['وارد', 'Restock', 'in'])
        .limit(1);
      
      if (dup && dup.length > 0) {
        toast.error(`رقم السند (${stockForm.receiptNumber}) مسجل مسبقاً! يرجى التأكد من الرقم.`);
        clearTimeout(safetyTimeout);
        setLoading(false);
        return;
      }
    }

    try {
      const locationName = stockForm.loc;
      const supplier = locationName; 
      let imageUrl = stockForm.receiptImage;
      
      // 1. رفع الصورة مع مهلة زمنية
      if (stockForm.receiptImageFile) {
        console.log("📸 جاري رفع الصورة إلى Cloudinary...");
        try {
          const uploadPromise = uploadToCloudinary(stockForm.receiptImageFile, supplier);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("استغرق رفع الصورة وقتاً طويلاً جداً")), 30000));
          imageUrl = await Promise.race([uploadPromise, timeoutPromise]);
          console.log("✅ تم رفع الصورة بنجاح:", imageUrl);
        } catch (uploadErr) {
          console.error("❌ فشل رفع الصورة:", uploadErr);
          throw new Error(`فشل رفع الصورة: ${uploadErr.message}`);
        }
      }

      const batchId = `STOCKIN-${Date.now()}`;
      const now = new Date();
      const timestamp = now.toISOString();
      const dateStr = stockForm.date || timestamp.split('T')[0];

      // 2. جلب بيانات المنتجات
      console.log("🔍 جاري جلب بيانات المنتجات لتحديث المخزون...", itemIds);
      const { data: currentProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, stock_qty, name')
        .in('id', itemIds);

      if (fetchError) {
        console.error("❌ فشل جلب بيانات المنتجات:", fetchError);
        throw fetchError;
      }
      console.log(`✅ تم جلب ${currentProducts?.length || 0} صنف بنجاح.`);

      const stockMap = {};
      currentProducts.forEach(p => {
        stockMap[p.id] = Number(p.stock_qty || 0);
      });

      // 3. تحضير البيانات وتحديث المخزون
      console.log("🔄 جاري تحديث المخزون وتسجيل المعاملات...");
      const transactionsToInsert = [];
      const runningBalances = { ...stockMap };

      for (const item of stockForm.items) {
        const prevBalance = runningBalances[item.itemId] || 0;
        const newBalance = prevBalance + item.qty;
        runningBalances[item.itemId] = newBalance;

        transactionsToInsert.push({
          type: 'in',
          item_id: item.itemId,
          item: item.item,
          company: item.company,
          unit: item.unit,
          cat: item.cat,
          qty: item.qty,
          date: dateStr,
          location: locationName,
          beneficiary: supplier,
          recipient: supplier, // إضافة حقل المستلم للتوافق
          receipt_type: stockForm.receiptType,
        reference_number: stockForm.receiptNumber,
          receipt_image: imageUrl,
          batch_id: batchId,
          is_summary: false,
          timestamp: timestamp,
          balance_after: newBalance,
          status: 'مكتمل'
        });

        console.log(`   - جاري تحديث رصيد الصنف ${item.item} (ID: ${item.itemId}) من ${prevBalance} إلى ${newBalance}`);
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_qty: newBalance })
          .eq('id', item.itemId);
        
        if (updateError) {
          console.error(`❌ فشل تحديث رصيد الصنف ${item.item}:`, updateError);
          throw updateError;
        }
        console.log(`   - تم تحديث رصيد الصنف ${item.item} بنجاح.`);
      }
      console.log("✅ تم تحديث المخزون بنجاح.");

      // 4. إضافة سطر الملخص
      const totalQty = stockForm.items.reduce((sum, i) => sum + i.qty, 0);
      transactionsToInsert.push({
        type: 'in',
        item: 'ملخص توريد',
        qty: totalQty,
        date: dateStr,
        location: locationName,
        beneficiary: supplier,
        recipient: supplier,
        receipt_type: stockForm.receiptType,
        reference_number: stockForm.receiptNumber,
        receipt_image: imageUrl,
        batch_id: batchId,
        is_summary: true,
        timestamp: timestamp,
        status: 'مكتمل'
      });
      console.log("✅ تم إضافة سطر الملخص.");

      // 5. إدراج المعاملات
      console.log("📝 جاري تسجيل المعاملات في قاعدة البيانات...", transactionsToInsert.length, "سجل");
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);

      if (insertError) {
        console.error("❌ فشل تسجيل المعاملات:", insertError);
        // محاولة تقديم تفاصيل أكثر عن الخطأ
        const errorMsg = insertError.message || insertError.details || "خطأ غير معروف في قاعدة البيانات";
        throw new Error(`فشل تسجيل المعاملات: ${errorMsg}`);
      }
      console.log("✅ تم تسجيل المعاملات بنجاح.");

      console.log("✨ تمت العملية بنجاح!");
      toast.success('تم الحفظ والترحيل بنجاح ✅');
      playSuccess?.();
      
      // Small delay before success callback to allow UI to settle
      setTimeout(() => {
        try {
          onSaveSuccess?.();
          performModalReset();
        } catch (callbackErr) {
          console.error("❌ خطأ في تنفيذ توابع النجاح:", callbackErr);
        }
      }, 500);

    } catch (err) { 
      console.error('❌ خطأ في عملية الحفظ:', err);
      toast.error(`حدث خطأ أثناء الحفظ: ${err.message || "خطأ غير معروف"}`); 
    } finally { 
      clearTimeout(safetyTimeout);
      setLoading(false); 
    }
  };

  const uploadToCloudinary = async (file, supplier) => {
    console.log("📤 بدء رفع الملف إلى Cloudinary...");
    
    const year = new Date(stockForm.date).getFullYear();
    const month = new Date(stockForm.date).getMonth() + 1;
    const subFolder = stockForm.receiptType === 'سند' ? 'سندات_توريد' : 'فواتير_توريد';
    const folderPath = `vouchers/ادخال/${subFolder}/${supplier}/${year}/${month}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'invoices');
    formData.append('folder', folderPath);
    
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/dvxryz62u/image/upload', {
        method: 'POST', 
        body: formData 
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ استجابة Cloudinary غير ناجحة:", res.status, errorData);
        throw new Error(`فشل رفع الصورة: ${errorData.error?.message || res.statusText}`);
      }

      const data = await res.json();
      console.log("✅ تم الرفع إلى Cloudinary بنجاح. URL:", data.secure_url);
      return data.secure_url;
    } catch (error) {
      console.error("❌ خطأ أثناء الاتصال بـ Cloudinary:", error);
      throw error;
    }
  };

  const handleCloseModal = () => {
    if (stockForm.items.length > 0) {
      setShowExitConfirm(true);
      playWarning();
      setTimeout(() => exitConfirmBtnRef.current?.focus(), 100);
    } else performModalReset();
  };

  const performModalReset = () => {
    setStockForm({ loc: 'مستودع الرياض', supplier: '', date: formatDate(new Date()), receiptType: 'بدون', receiptNumber: '', receiptImage: null, receiptImageFile: null, items: [] });
    setCurrentStockItem({ name: '', selectedItem: null, cat: categories[0], unit: units[0], qty: '' });
    setShowExitConfirm(false);
    setShowSaveConfirm(false);
    onClose();
  };

  const handleItemNameKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestionsIndex(prev => Math.min(prev + 1, itemSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionsIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestionsIndex >= 0 && itemSuggestions[suggestionsIndex]) {
        const s = itemSuggestions[suggestionsIndex];
        const combinedName = `${s.name}${s.company ? ` - ${s.company}` : ''}`;
        setCurrentStockItem({ ...currentStockItem, name: combinedName, selectedItem: s, cat: s.cat, unit: s.unit });
      } else if (itemSuggestions.length > 0) {
        const s = itemSuggestions[0];
        const combinedName = `${s.name}${s.company ? ` - ${s.company}` : ''}`;
        setCurrentStockItem({ ...currentStockItem, name: combinedName, selectedItem: s, cat: s.cat, unit: s.unit });
      }
      qtyRef.current?.focus();
    }
  };

  const isReceiptDisabled = stockForm.receiptType === 'بدون';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[4px]"
          dir="rtl" onClick={handleCloseModal}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="w-full max-w-[950px] bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] flex flex-col h-[90vh] max-h-[820px] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-50 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3 text-[#279489]">
                <Plus size={20} strokeWidth={3} />
                <h3 className="text-lg font-black font-tajawal text-slate-800 dark:text-white">إضافة وارد مخزني جديد</h3>
              </div>
              <button type="button" onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-rose-500 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              {/* Exit/Save Dialogs */}
              <AnimatePresence>
                {showExitConfirm && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[160] flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full mx-4 text-center border border-slate-50">
                      <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-6 text-rose-500"><AlertTriangle size={32} /></div>
                      <h4 className="text-xl font-black font-tajawal text-slate-800 mb-2">بيانات غير محفوظة!</h4>
                      <p className="text-sm text-slate-500 mb-8 font-tajawal">هل تريد الخروج حقاً وضياع البيانات؟</p>
                      <div className="flex flex-col gap-2">
                        <button ref={exitConfirmBtnRef} type="button" onClick={performModalReset} className="w-full py-3.5 rounded-xl bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-500/20 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all">نعم، خروج</button>
                        <button type="button" onClick={() => setShowExitConfirm(false)} className="w-full py-3.5 rounded-xl bg-slate-50 text-slate-400 font-bold text-sm">إلغاء</button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
                {showSaveConfirm && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[160] flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full mx-4 text-center border border-slate-50">
                      <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-6 text-teal-600"><CheckCircle2 size={32} /></div>
                      <h4 className="text-xl font-black font-tajawal text-slate-800 mb-2">تأكيد الحفظ</h4>
                      <p className="text-sm text-slate-500 mb-8 font-tajawal">حفظ وترحيل <span className="text-[#279489] font-black">{stockForm.items.length}</span> صنف؟</p>
                      <div className="flex flex-col gap-2">
                        <button ref={saveConfirmBtnRef} type="button" onClick={confirmBulkSubmit} className="w-full py-3.5 rounded-xl bg-[#279489] text-white font-black text-sm shadow-lg shadow-teal-500/20 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all">تأكيد الحفظ النهائي</button>
                        <button type="button" onClick={() => setShowSaveConfirm(false)} className="w-full py-3.5 rounded-xl bg-slate-50 text-slate-400 font-bold text-sm">مراجعة القائمة</button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900 custom-scrollbar">
                {/* Master Info */}
                <div className="bg-slate-50/40 dark:bg-slate-800/10 p-5 rounded-[1.5rem] border border-slate-50 dark:border-slate-800 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                    <div className="group relative">
                      <div className="flex items-center justify-between mb-1">
                        <CompactLabel required>المورد المستلم</CompactLabel>
                        <button type="button" onClick={() => setIsAddingNewSupplier(!isAddingNewSupplier)} className="text-[#279489] hover:text-teal-700 transition-colors">
                          <Plus size={10} strokeWidth={4} />
                        </button>
                      </div>
                      {isAddingNewSupplier ? (
                        <PremiumInput 
                          autoFocus
                          placeholder="مورد/مستودع جديد..." 
                          className="text-center"
                          value={newSupplierName} 
                          onChange={e => setNewSupplierName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newSupplierName.trim()) {
                              setLocations(prev => [...new Set([...prev, newSupplierName.trim()])]);
                              setStockForm(prev => ({ ...prev, loc: newSupplierName.trim() }));
                              setNewSupplierName('');
                              setIsAddingNewSupplier(false);
                            }
                          }}
                        />
                      ) : (
                        <select className="w-full h-9 bg-white border border-slate-100 rounded-xl px-3 font-bold text-xs outline-none focus:border-[#279489]/40 transition-all appearance-none cursor-pointer text-center" value={stockForm.loc} onChange={e => setStockForm({ ...stockForm, loc: e.target.value })}>
                          {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="group">
                      <CompactLabel required>تاريخ التوريد</CompactLabel>
                      <input type="date" className="w-full h-9 bg-white border border-slate-100 rounded-xl px-3 font-bold text-xs outline-none focus:border-[#279489]/40 transition-all text-center" value={stockForm.date} onChange={e => setStockForm({ ...stockForm, date: e.target.value })} />
                    </div>
                    <div className="group">
                      <CompactLabel required>نوع المستند</CompactLabel>
                      <select className="w-full h-9 bg-white border border-slate-100 rounded-xl px-3 font-bold text-xs outline-none focus:border-[#279489]/40 transition-all text-center appearance-none cursor-pointer" value={stockForm.receiptType} onChange={e => setStockForm({ ...stockForm, receiptType: e.target.value })}>
                        <option value="بدون">بدون ملحقات</option>
                        <option value="فاتورة">فاتورة توريد</option>
                        <option value="سند">سند توريد</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <CompactLabel color={isReceiptDisabled ? 'text-slate-300' : 'text-slate-400'}>الرقم المرجعي</CompactLabel>
                        <input ref={receiptNumRef} disabled={isReceiptDisabled} className={`w-full h-9 bg-white border rounded-xl px-3 font-bold text-xs outline-none transition-all ${isReceiptDisabled ? 'opacity-50 bg-slate-50 border-slate-100 cursor-not-allowed text-slate-400' : 'border-slate-100 focus:border-[#279489]/40'}`} placeholder="رقم الفاتورة..." value={stockForm.receiptNumber} onChange={e => setStockForm({ ...stockForm, receiptNumber: e.target.value })} onKeyDown={e => e.key === 'Enter' && itemNameRef.current?.focus()} />
                      </div>
                      <div className="relative">
                        <input type="file" className="hidden" id="receipt-upload" disabled={isReceiptDisabled} onChange={e => setStockForm({ ...stockForm, receiptImageFile: e.target.files[0], receiptImage: URL.createObjectURL(e.target.files[0]) })} />
                        <motion.label 
                          htmlFor="receipt-upload" 
                          whileHover={isReceiptDisabled ? {} : { scale: 1.1, y: -2 }} 
                          whileTap={isReceiptDisabled ? {} : { scale: 0.9 }} 
                          className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-all cursor-pointer shadow-md ${
                            isReceiptDisabled 
                              ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                              : stockForm.receiptImageFile 
                                ? 'bg-gradient-to-br from-[#279489] to-[#1b6d65] text-white shadow-teal-500/20' 
                                : 'bg-teal-50 text-[#279489] border border-teal-100 hover:bg-teal-100/50'
                          }`}
                        >
                          {stockForm.receiptImageFile ? <CheckCircle2 size={20} strokeWidth={3} /> : <Camera size={20} strokeWidth={2.5} />}
                        </motion.label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Entry Row - Keyboard Focused */}
                <div className="grid grid-cols-12 gap-2 items-end mb-6">
                  <div className="col-span-12 md:col-span-5 relative">
                    <CompactLabel color="text-[#279489]">اسم الصنف</CompactLabel>
                    <PremiumInput ref={itemNameRef} placeholder="ابحث هنا..." className="text-center" value={currentStockItem.name} onChange={e => setCurrentStockItem({ ...currentStockItem, name: e.target.value, selectedItem: null })} onKeyDown={handleItemNameKeyDown} />
                    {itemSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 shadow-2xl rounded-xl mt-1 z-[200] overflow-hidden">
                        {itemSuggestions.map((s, idx) => (
                          <button 
                            key={s.id} 
                            type="button" 
                            onClick={() => { 
                              const combinedName = `${s.name}${s.company ? ` - ${s.company}` : ''}`;
                              setCurrentStockItem({ ...currentStockItem, name: combinedName, selectedItem: s, cat: s.cat, unit: s.unit }); 
                              qtyRef.current?.focus(); 
                            }} 
                            className={`w-full px-4 py-2.5 text-right flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors ${suggestionsIndex === idx ? 'bg-teal-50 border-teal-100' : 'hover:bg-slate-50'}`}
                          >
                            <div className="flex items-center gap-2 font-tajawal">
                              <span className="font-black text-slate-800 text-[13px]">{s.name}</span>
                              <span className="text-[11px] text-slate-400 font-bold">— {s.company || 'بدون شركة'}</span>
                            </div>
                            <span className="text-[10px] font-black bg-slate-50 px-2 py-0.5 rounded text-slate-400 uppercase font-tajawal">{s.cat}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <CompactLabel color="text-[#279489]">الكمية</CompactLabel>
                    <PremiumInput ref={qtyRef} type="number" className="text-center" placeholder="0" value={currentStockItem.qty} onChange={e => setCurrentStockItem({ ...currentStockItem, qty: e.target.value })} onKeyDown={e => e.key === 'Enter' && catSelectRef.current?.focus()} />
                  </div>
                  <div className="col-span-4 md:col-span-2 relative">
                    <div className="flex items-center justify-between mb-1">
                      <CompactLabel color="text-[#279489]">القسم</CompactLabel>
                      <button type="button" onClick={() => setIsAddingCategory(!isAddingCategory)} className="text-[#279489] hover:text-teal-700 transition-colors">
                        <Plus size={10} strokeWidth={4} />
                      </button>
                    </div>
                    {isAddingCategory ? (
                      <div className="flex gap-1">
                        <PremiumInput 
                          autoFocus
                          placeholder="قسم جديد..." 
                          className="text-center"
                          value={newCategoryName} 
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newCategoryName.trim()) {
                              setCategories(prev => [...new Set([...prev, newCategoryName.trim()])]);
                              setCurrentStockItem(prev => ({ ...prev, cat: newCategoryName.trim() }));
                              setNewCategoryName('');
                              setIsAddingCategory(false);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <select ref={catSelectRef} className="w-full h-9 bg-white border border-slate-100 rounded-xl px-3 font-bold text-xs text-center appearance-none outline-none focus:border-[#279489]/40" value={currentStockItem.cat} onChange={e => setCurrentStockItem({ ...currentStockItem, cat: e.target.value })} onKeyDown={e => e.key === 'Enter' && unitSelectRef.current?.focus()}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="col-span-4 md:col-span-2 relative">
                    <div className="flex items-center justify-between mb-1">
                      <CompactLabel color="text-[#279489]">الوحدة</CompactLabel>
                      <button type="button" onClick={() => setIsCustomUnit(!isCustomUnit)} className="text-[#279489] hover:text-teal-700 transition-colors">
                        <Plus size={10} strokeWidth={4} />
                      </button>
                    </div>
                    {isCustomUnit ? (
                      <PremiumInput 
                        autoFocus
                        placeholder="وحدة جديدة..." 
                        className="text-center"
                        value={currentStockItem.unit} 
                        onChange={e => setCurrentStockItem({ ...currentStockItem, unit: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && currentStockItem.unit.trim()) {
                            setUnits(prev => [...new Set([...prev, currentStockItem.unit.trim()])]);
                            setIsCustomUnit(false);
                            handlePushToDraft();
                          }
                        }}
                      />
                    ) : (
                      <select ref={unitSelectRef} className="w-full h-9 bg-white border border-slate-100 rounded-xl px-3 font-bold text-xs text-center appearance-none outline-none focus:border-[#279489]/40" value={currentStockItem.unit} onChange={e => setCurrentStockItem({ ...currentStockItem, unit: e.target.value })} onKeyDown={e => e.key === 'Enter' && handlePushToDraft()}>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-1 flex justify-center pb-0.5">
                    <motion.button 
                      type="button" 
                      whileHover={{ scale: 1.1, rotate: 180 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handlePushToDraft} 
                      className="w-10 h-10 rounded-2xl bg-[#279489] text-white flex items-center justify-center transition-all shadow-lg shadow-teal-500/20 hover:bg-[#1b6d65] hover:shadow-teal-600/30"
                    >
                      <Plus size={24} strokeWidth={2.5} />
                    </motion.button>
                  </div>
                </div>

                {/* Session Table */}
                <div className="flex-1 min-h-[200px] border border-slate-50 rounded-[1.5rem] overflow-hidden bg-slate-50/10">
                  {stockForm.items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30">
                      <Package size={24} className="text-slate-300 mb-2" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">أضف أصنافاً للبدء</span>
                    </div>
                  ) : (
                    <table className="w-full text-center bg-white">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                          <th className="py-3 px-4 w-12 text-center">م</th>
                          <th className="py-3 px-4 text-center">اسم الصنف</th>
                          <th className="py-3 px-4 text-center">الكمية</th>
                          <th className="py-3 px-4 text-center">القسم</th>
                          <th className="py-3 px-4 text-center">الوحدة</th>
                          <th className="py-3 px-4 w-20 text-center">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {stockForm.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 group">
                            <td className="py-3 px-4 text-[10px] font-bold text-slate-400 text-center">{idx + 1}</td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="font-bold text-slate-700 text-[12px]">{item.item}</span>
                                {item.company && item.company !== 'بدون شركة' && (
                                  <span className="text-[11px] text-slate-700 font-medium"> - {item.company}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center"><span className="text-[#279489] text-[13px] font-black">{item.qty}</span></td>
                            <td className="py-3 px-4 text-[11px] font-bold text-slate-500 text-center">{item.cat}</td>
                            <td className="py-3 px-4 text-[11px] font-bold text-slate-500 text-center">{item.unit}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2.5">
                                <motion.button 
                                  whileHover={{ scale: 1.15, rotate: -8 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => {
                                    setCurrentStockItem({ name: item.item, selectedItem: { id: item.itemId, name: item.item, company: item.company, cat: item.cat, unit: item.unit }, cat: item.cat, unit: item.unit, qty: item.qty });
                                    setStockForm(prev => ({ ...prev, items: prev.items.filter(it => it.id !== item.id) }));
                                    itemNameRef.current?.focus();
                                  }} 
                                  className="w-8 h-8 flex items-center justify-center text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors shadow-sm shadow-teal-500/5"
                                >
                                  <Pencil size={14} strokeWidth={2.5} />
                                </motion.button>
                                <motion.button 
                                  whileHover={{ scale: 1.15, rotate: 8 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => setStockForm(prev => ({ ...prev, items: prev.items.filter(it => it.id !== item.id) }))} 
                                  className="w-8 h-8 flex items-center justify-center text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors shadow-sm shadow-rose-500/5"
                                >
                                  <Trash2 size={14} strokeWidth={2.5} />
                                </motion.button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-10 py-4 border-t border-slate-50 flex items-center justify-between bg-white shrink-0">
                <button type="button" onClick={handleCloseModal} className="px-8 py-2.5 text-[10px] font-black text-slate-300 hover:text-slate-500">إلغاء</button>
                <button type="button" disabled={stockForm.items.length === 0 || loading} onClick={handleBulkSubmit} className="px-12 py-2.5 rounded-xl text-[10px] font-black text-white bg-[#279489] hover:bg-[#1b6d65] shadow-lg shadow-teal-500/10 transition-all disabled:opacity-30 flex items-center gap-2 group">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <><span>حفظ واعتماد التوريد</span><CheckCircle2 size={14} /></>}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
