import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, CheckCircle, ArrowUpRight, Flame, User, Printer, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { normalizeArabic } from '../lib/arabicTextUtils';
import { formatDate } from '../lib/dateUtils';

const categoryIcons = {
  'مجمدات': <Snowflake size={18} className="text-cyan-500" />,
  'بلاستيك': <Archive size={18} className="text-amber-500" />,
  'تبريد': <Box size={18} className="text-blue-500" />
};
const getCatIcon = (catName) => categoryIcons[catName] || <Package size={18} className="text-slate-500" />;

// --- MODAL WRAPPER ---
const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-md", submitLabel = "حفظ", submitColor = "blue", loading = false, disableSubmit = false }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" 
        dir="rtl" onMouseDown={onClose}
      >
        <motion.div 
          onMouseDown={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[90vh]`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <h3 className="text-lg font-black text-slate-800">{title}</h3>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
              <X size={20} className="stroke-[3]" />
            </button>
          </div>
          <form onSubmit={onSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex space-x-3 space-x-reverse justify-end shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">إلغاء</button>
              <button type="submit" disabled={loading || disableSubmit} className={`px-6 py-2 rounded-xl font-bold text-white flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${submitColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : submitColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
                {loading && <Box className="animate-spin" size={16} />}
                {submitLabel}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const InputClass = "w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 block px-4 h-[38px] outline-none transition-all";
const LabelClass = "block text-xs font-black text-slate-700 mb-1.5";

export default function StockOut() {
  const { playSuccess, playWarning } = useAudio();
  const { currentUser, isViewer } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [companyFilter, setCompanyFilter] = useState('الكل');
  const [showHotOnly, setShowHotOnly] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({ qty: '', date: '', recipient: '' });

  // Bulk Modal State
  const itemNameRef = useRef(null);
  const [bulkRecipient, setBulkRecipient] = useState('');
  const [bulkDate, setBulkDate] = useState(formatDate(new Date()));
  const [modalDrafts, setModalDrafts] = useState([]);
  const [searchNameText, setSearchNameText] = useState('');
  const [selectedItemModel, setSelectedItemModel] = useState(null);
  const [draftQty, setDraftQty] = useState('');
  const [itemSearchActiveIndex, setItemSearchActiveIndex] = useState(-1);

  // --- SUPABASE SYNC ---
  // Auto-focus on item search when modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      setTimeout(() => itemNameRef.current?.focus(), 150);
    }
  }, [isAddModalOpen]);

  // Global Keyboard Shortcuts for Modals
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (isEditModalOpen) setIsEditModalOpen(false);
        if (isDeleteModalOpen) setIsDeleteModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isAddModalOpen, isEditModalOpen, isDeleteModalOpen]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: itemsData } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty');
      if (itemsData) {
        setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty })));
      }
      
      const { data: transData } = await supabase.from('transactions').select('id, type, item_id, balance_after, timestamp, item, company, qty, unit, cat, recipient, beneficiary, date, status, batch_id, is_summary, total_qty, items_summary').order('timestamp', { ascending: false });
      if (transData) {
        setTransactions(transData.map(d => ({ ...d, itemId: d.item_id, balanceAfter: d.balance_after })));
      }
    };
    
    fetchInitialData();

    const itemsChannel = supabase.channel('public:products:stockout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData)
      .subscribe();

    const transChannel = supabase.channel('public:transactions:stockout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData)
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(transChannel);
    };
  }, []);

  const stockOutTransactions = useMemo(() => transactions.filter(t => t.type === 'out'), [transactions]);

  // Autocomplete suggestions (name + company pairing)
  const itemSuggestions = useMemo(() => {
    if (!searchNameText || selectedItemModel) return [];
    const query = normalizeArabic(searchNameText);
    return items.filter(i => {
      const name = normalizeArabic(i.name);
      const company = normalizeArabic(i.company || '');
      return name.includes(query) || company.includes(query) || `${name} - ${company}`.includes(query);
    }).slice(0, 10);
  }, [items, searchNameText, selectedItemModel]);

  const dynamicCompanies = ['الكل', ...new Set(items.map(i => i.company || 'بدون شركة'))].filter(Boolean);

  // Hot items map (high velocity in last 7 days from BOTH in/out)
  const hotItemsMap = useMemo(() => {
    const map = {};
    const now = new Date();
    transactions.forEach(tx => {
      const txDate = tx.date ? new Date(tx.date) : (tx.timestamp?.toDate ? tx.timestamp.toDate() : new Date());
      const diffDays = Math.ceil(Math.abs(now - txDate) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        if (!map[tx.itemId]) map[tx.itemId] = 0;
        map[tx.itemId] += Number(tx.qty);
      }
    });
    return map;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return stockOutTransactions.filter(tx => {
      const itemsList = tx.items_summary || [];
      const itemsText = itemsList.map(i => `${i.item} ${i.company}`).join(' ');
      const searchKey = normalizeArabic(`${tx.item || ''} ${tx.recipient || ''} ${itemsText}`);
      const matchSearch = searchKey.includes(normalizeArabic(searchQuery));
      
      const cats = new Set(itemsList.map(i => i.cat));
      const matchCat = categoryFilter === 'الكل' || cats.has(categoryFilter);
      
      const comps = new Set(itemsList.map(i => i.company || 'بدون شركة'));
      const matchComp = companyFilter === 'الكل' || comps.has(companyFilter);
      
      return matchSearch && matchCat && matchComp;
    });
  }, [stockOutTransactions, searchQuery, categoryFilter, companyFilter]);

  const groupedTransactions = useMemo(() => {
    return { 'سجلات الصادر': filteredTransactions };
  }, [filteredTransactions]);

  const todayTotal = useMemo(() => {
    const todayStr = formatDate(new Date());
    return stockOutTransactions.reduce((acc, tx) => {
      const txDate = tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '');
      return txDate === todayStr ? acc + Number(tx.qty || 0) : acc;
    }, 0);
  }, [stockOutTransactions]);

  // --- BULK MODAL ACTIONS ---
  const handleSelectSuggestion = (itemObj) => {
    setSelectedItemModel(itemObj);
    setSearchNameText(`${itemObj.name} - ${itemObj.company || 'بدون شركة'}`);
    setItemSearchActiveIndex(-1);
    // Auto jump to qty
    setTimeout(() => document.getElementById('stock-out-qty-input')?.focus(), 50);
  };

  const handleClearDynamicRow = () => {
    setSelectedItemModel(null);
    setSearchNameText('');
    setDraftQty('');
    setTimeout(() => { itemNameRef.current?.focus(); }, 50);
  };

  const handlePushToDraft = () => {
    let finalName = searchNameText.trim();
    let finalCompany = 'بدون شركة';
    let targetItem = selectedItemModel;

    if (!targetItem) {
      if (finalName.includes(" - ")) {
        const parts = finalName.split(" - ");
        finalName = parts[0].trim();
        finalCompany = parts[1].trim();
      }
      const normName = normalizeArabic(finalName);
      const normComp = normalizeArabic(finalCompany);
      targetItem = items.find(i => 
        normalizeArabic(i.name) === normName && 
        normalizeArabic(i.company || 'بدون شركة') === normComp
      );
    }

    if (!targetItem || !draftQty || Number(draftQty) <= 0) {
      toast.error('يرجى اختيار صنف وإدخال الكمية الصادرة.');
      playWarning();
      return;
    }

    // Stock guard — don't allow dispatching more than available
    const availableQty = Number(targetItem.stockQty || 0);
    const alreadyInDraft = modalDrafts.filter(d => d.itemId === targetItem.id).reduce((s, d) => s + d.qty, 0);
    if (Number(draftQty) + alreadyInDraft > availableQty) {
      toast.error(`الرصيد المتاح لـ "${targetItem.name}" هو ${availableQty} فقط. الكمية المطلوبة تتجاوز المتاح.`);
      playWarning();
      return;
    }

    setModalDrafts(prev => [{
      draftId: crypto.randomUUID(),
      itemId: targetItem.id,
      item: targetItem.name,
      company: targetItem.company || 'بدون شركة',
      cat: targetItem.cat || 'أخرى',
      unit: targetItem.unit || 'كرتونة',
      qty: Number(draftQty),
    }, ...prev]);

    playSuccess();
    handleClearDynamicRow();
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (modalDrafts.length === 0) {
      toast.error('أضف صنفاً واحداً على الأقل قبل الحفظ.');
      return;
    }
    if (!bulkRecipient.trim()) {
      toast.error('يرجى إدخال اسم المستلم قبل تأكيد الصرف.');
      playWarning();
      return;
    }
    setLoading(true);
    try {
      // Build aggregates map: itemId -> total qty requested
      const itemAggregates = {};
      for (const entry of modalDrafts) {
        if (!itemAggregates[entry.itemId]) itemAggregates[entry.itemId] = 0;
        itemAggregates[entry.itemId] += entry.qty;
      }

      const now = new Date();
      const timestamp = now.toISOString();
      const beneficiary = bulkRecipient.trim();
      const itemsSummary = modalDrafts.map(d => ({
        id: d.itemId,
        item: d.item,
        company: d.company,
        qty: d.qty,
        unit: d.unit,
        cat: d.cat
      }));
      const totalQty = modalDrafts.reduce((sum, d) => sum + d.qty, 0);

      // 1. Path A: Inventory Update (Decrement)
      console.log("🔄 Path A: Updating Stock Quantities...");
      for (const [id, aggQty] of Object.entries(itemAggregates)) {
        const { data: itemData, error: fetchErr } = await supabase
          .from('products')
          .select('stock_qty, name')
          .eq('id', id)
          .single();
          
        if (fetchErr || !itemData) throw new Error(`تعذّر جلب بيانات الصنف (${id})`);
        
        const currentStock = Number(itemData.stock_qty || 0);
        if (aggQty > currentStock) {
          throw new Error(`رصيد "${itemData.name}" غير كافٍ. المتاح: ${currentStock}، المطلوب: ${aggQty}`);
        }
        
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_qty: currentStock - aggQty })
          .eq('id', id);
          
        if (updateError) throw updateError;
      }

      // 2. Path B: Transaction Archiving (Single Summary Record)
      console.log("📝 Path B: Recording Transaction Summary...");
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          type: 'out',
          recipient: beneficiary,
          beneficiary: beneficiary,
          items_summary: itemsSummary,
          total_qty: totalQty,
          date: bulkDate || now.toISOString().split('T')[0],
          timestamp: timestamp,
          status: 'مكتمل'
        });

      if (insertError) throw insertError;

      toast.success(`✅ تم صرف ${modalDrafts.length} أصناف لـ "${bulkRecipient}" وتحديث المخزن بنجاح`);
      playSuccess();
      setModalDrafts([]);
      setBulkRecipient('');
      setBulkDate(formatDate(new Date()));
      setIsAddModalOpen(false);
      handleClearDynamicRow();
    } catch (err) {
      const msg = err.message?.includes('رصيد') ? err.message : `حدث خطأ أثناء الحفظ: ${err.message}`;
      toast.error(msg);
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  // --- ROW EDIT / DELETE ---
  const openEditTx = (tx) => {
    setSelectedTx(tx);
    setEditForm({ qty: tx.qty, date: tx.date || formatDate(new Date()), recipient: tx.recipient || '' });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (Number(editForm.qty) <= 0) return;
    setLoading(true);
    try {
      const matchedItem = items.find(i => i.id === selectedTx.itemId || (i.name === selectedTx.item && (i.company || 'بدون شركة') === (selectedTx.company || 'بدون شركة')));
      
      if (matchedItem) {
          const { data: itemData } = await supabase.from('products').select('stock_qty').eq('id', matchedItem.id).single();
          if (itemData) {
              const diff = Number(selectedTx.qty) - Number(editForm.qty); 
              const currentBalance = Number(itemData.stock_qty || 0);
              await supabase.from('products').update({ stock_qty: currentBalance + diff }).eq('id', matchedItem.id);
          }
      }
      
      const { error } = await supabase.from('transactions').update({ qty: Number(editForm.qty), date: editForm.date, recipient: editForm.recipient }).eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم تعديل سند الصرف بنجاح ✅');
      playSuccess();
      setIsEditModalOpen(false);
    } catch {
      toast.error('خطأ في عملية التعديل');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const openDeleteTx = (tx) => { setSelectedTx(tx); setIsDeleteModalOpen(true); };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const matchedItem = items.find(i => i.id === selectedTx.itemId || (i.name === selectedTx.item && (i.company || 'بدون شركة') === (selectedTx.company || 'بدون شركة')));
      
      if (matchedItem) {
          const { data: itemData } = await supabase.from('products').select('stock_qty').eq('id', matchedItem.id).single();
          if (itemData) {
              const currentBalance = Number(itemData.stock_qty || 0);
              await supabase.from('products').update({ stock_qty: currentBalance + Number(selectedTx.qty) }).eq('id', matchedItem.id);
          }
      }
      
      const { error } = await supabase.from('transactions').delete().eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم حذف سند الصرف وإعادة الكمية للمخزن 🗑️');
      playSuccess();
      setIsDeleteModalOpen(false);
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  // --- EXPORT ---
  const handleExportPDF = () => {
    try {
      const d = new jsPDF();
      const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'مدير النظام';
      d.setFontSize(20);
      d.text("Baraka Al Thimar PRO — سجل الصادر", 105, 15, { align: 'center' });
      d.setFontSize(9);
      d.text(`تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} | بواسطة: ${userName}`, 195, 24, { align: 'right' });
      d.autoTable({
        startY: 30,
        head: [['#', 'التاريخ', 'المستلم', 'الصنف', 'الشركة', 'القسم', 'الكمية']],
        body: filteredTransactions.map((tx, idx) => [
          idx + 1,
          tx.date || (tx.timestamp?.toDate ? formatDate(tx.timestamp.toDate()) : '-'),
          tx.recipient || '-',
          tx.item,
          tx.company || '-',
          tx.cat || '-',
          `${tx.qty} ${tx.unit}`,
        ]),
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { halign: 'center' },
      });
      d.save(`StockOut_Dispatch_${Date.now()}.pdf`);
      toast.success('تم تصدير PDF بنجاح 📄');
    } catch {
      toast.error('خطأ أثناء إنشاء PDF');
    }
    setIsExportMenuOpen(false);
  };

  // --- BLANK TEMPLATE PDF (30-Row A4-Optimised — Outbound) ---
  const handleBlankTemplate = async () => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;background:white;padding:30px;font-family:Cairo,sans-serif;direction:rtl;';
    
    const ROWS_COUNT = 30;
    const rowsHtml = Array.from({ length: ROWS_COUNT }).map((_, i) => `
      <tr style="height:32px;border-bottom:1px solid #e2e8f0;${(i + 1) % 5 === 0 ? 'background:#f8fafc;' : ''}">
        <td style="border:1px solid #cbd5e1;text-align:center;font-size:12px;color:#64748b;font-weight:700;">${i + 1}</td>
        <td style="border:1px solid #cbd5e1;"></td>
        <td style="border:1px solid #cbd5e1;"></td>
        <td style="border:1px solid #cbd5e1;"></td>
        <td style="border:1px solid #cbd5e1;"></td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div style="border:1px solid #0f172a;padding:20px;min-height:1050px;display:flex;flex-direction:column;">
        <div style="background:#0f172a;color:white;padding:15px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div style="width:3.5mm;height:18mm;background:#3b82f6;margin-left:15px;border-radius:2px;"></div>
          <div style="flex:1;text-align:center;">
            <div style="font-size:20px;font-weight:900;">بركة الثمار | Barakat Al-Thimar</div>
            <div style="font-size:12px;color:#60a5fa;margin-top:4px;">إذن صرف بضاعة — Stock Outbound Voucher</div>
          </div>
          <div style="width:100px;"></div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:15px;padding:0 10px;">
          <div style="font-size:14px;font-weight:700;">المندوب: _________________________________</div>
          <div style="font-size:12px;color:#94a3b8;direction:ltr;">Date: ____ / ____ / 202__</div>
        </div>

        <table style="width:100%;border-collapse:collapse;flex:1;">
          <thead>
            <tr style="background:#1e293b;color:white;font-size:12px;">
              <th style="border:1px solid #0f172a;padding:8px;width:30px;">م</th>
              <th style="border:1px solid #0f172a;padding:8px;width:120px;">كود الصنف</th>
              <th style="border:1px solid #0f172a;padding:8px;">الصنف والشركة</th>
              <th style="border:1px solid #0f172a;padding:8px;width:80px;">الكمية</th>
              <th style="border:1px solid #0f172a;padding:8px;width:150px;">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:20px;">
          <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:15px;text-align:center;">
            <div style="background:#3b82f6;height:3px;margin-bottom:10px;"></div>
            <div style="font-size:13px;font-weight:900;margin-bottom:30px;">أمين المخزن (Warehouse Keeper)</div>
            <div style="border-bottom:1px dashed #94a3b8;width:80%;margin:0 auto;"></div>
          </div>
          <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:15px;text-align:center;">
            <div style="background:#3b82f6;height:3px;margin-bottom:10px;"></div>
            <div style="font-size:13px;font-weight:900;margin-bottom:30px;">المستلم (Recipient)</div>
            <div style="border-bottom:1px dashed #94a3b8;width:80%;margin:0 auto;"></div>
          </div>
        </div>

        <div style="text-align:center;margin-top:15px;font-size:10px;color:#94a3b8;">
          نظام بركة الثمار PRO • Barakat Al-Thimar Warehouse Management
        </div>
      </div>
    `;

    document.body.appendChild(el);
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Blank_StockOut_Voucher_${Date.now()}.pdf`);
      toast.success('تم توليد سند صادر A4 جاهز للطباعة 📋');
    } catch (e) {
      console.error(e);
      toast.error('خطأ أثناء توليد السند');
    } finally {
      document.body.removeChild(el);
    }
  };

  // --- ROW: Export single صادر voucher as PDF ---
  const handleRowExportPDF = async (tx) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:595px;background:white;padding:40px;font-family:Cairo,sans-serif;direction:rtl;color:#1e293b;';
    
    const itemsList = tx.items_summary || [
      { item: tx.item, company: tx.company, qty: tx.qty, unit: tx.unit, cat: tx.cat }
    ];

    el.innerHTML = `
      <div style="border:2px solid #f97316;border-radius:24px;padding:30px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;border-bottom:3px solid #f97316;padding-bottom:20px;">
          <div>
            <div style="font-size:28px;font-weight:900;color:#f97316;">بركة الثمار</div>
            <div style="font-size:12px;color:#64748b;font-weight:700;">سند صادر رسمي — Official Stock-Out Voucher</div>
          </div>
          <div style="text-align:left;direction:ltr;">
            <div style="font-size:14px;font-weight:800;">Date: ${tx.date || formatDate(new Date())}</div>
            <div style="font-size:12px;color:#94a3b8;">Voucher: #${tx.id.slice(0,8).toUpperCase()}</div>
          </div>
        </div>

        <div style="background:#fff7ed;border-radius:16px;padding:20px;margin-bottom:25px;display:flex;justify-content:space-between;border:1px solid #ffedd5;">
          <div style="font-size:16px;font-weight:900;color:#c2410c;">المستلم: ${tx.recipient || tx.rep || '—'}</div>
          <div style="font-size:14px;font-weight:700;color:#9a3412;">نوع الحركة: ${tx.type === 'out' ? 'صادر بضاعة' : tx.type}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;font-size:14px;">
          <thead>
            <tr style="background:#f97316;color:white;">
              <th style="padding:12px;border:1px solid #ea580c;text-align:center;width:40px;">م</th>
              <th style="padding:12px;border:1px solid #ea580c;text-align:right;">الصنف والشركة</th>
              <th style="padding:12px;border:1px solid #ea580c;text-align:center;width:80px;">الكمية</th>
              <th style="padding:12px;border:1px solid #ea580c;text-align:center;width:100px;">الوحدة</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList.map((it, idx) => `
              <tr style="background:${idx % 2 === 0 ? '#fff' : '#fffaf5'};">
                <td style="padding:10px;border:1px solid #fed7aa;text-align:center;font-weight:700;">${idx + 1}</td>
                <td style="padding:10px;border:1px solid #fed7aa;text-align:right;">
                  <div style="font-weight:800;">${it.item}</div>
                  <div style="font-size:11px;color:#94a3b8;">${it.company || '—'}</div>
                </td>
                <td style="padding:10px;border:1px solid #fed7aa;text-align:center;font-weight:900;color:#c2410c;">${it.qty}</td>
                <td style="padding:10px;border:1px solid #fed7aa;text-align:center;color:#64748b;">${it.unit || 'كرتونة'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px;padding-top:20px;border-top:1px dashed #fdba74;">
          <div style="text-align:center;">
            <div style="font-size:13px;font-weight:900;color:#475569;margin-bottom:40px;">توقيع أمين المستودع</div>
            <div style="border-bottom:2px solid #cbd5e1;width:160px;margin:0 auto;"></div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:13px;font-weight:900;color:#475569;margin-bottom:40px;">توقيع المستلم</div>
            <div style="border-bottom:2px solid #cbd5e1;width:160px;margin:0 auto;"></div>
          </div>
        </div>

        <div style="margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:15px;">
          نظام بركة الثمار الإلكتروني PRO • طُبع في: ${new Date().toLocaleString('ar-SA')}
        </div>
      </div>
    `;
    
    document.body.appendChild(el);
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`StockOut_Voucher_${tx.date || Date.now()}.pdf`);
      toast.success('تم تصدير السند كـ PDF بنجاح 📄');
    } catch (e) {
      console.error(e);
      toast.error('خطأ أثناء تصدير PDF');
    } finally {
      document.body.removeChild(el);
    }
  };

  // --- ROW: Save single صادر voucher as PNG ---
  const handleRowSaveImage = async (tx) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:420px;background:#0f172a;border-radius:20px;padding:24px;font-family:Cairo,sans-serif;direction:rtl;color:white;';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#431407,#0f172a);border-radius:14px;padding:16px 20px;margin-bottom:16px;text-align:center;">
        <div style="font-size:22px;font-weight:900;color:#fff;">بركة الثمار</div>
        <div style="font-size:10px;color:#f97316;margin-top:2px;">سند صادر رسمي — Stock-Out Voucher</div>
      </div>
      <div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:12px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#fb923c;font-weight:900;font-size:13px;">سند صادر</span>
        <span style="color:#94a3b8;font-size:11px;">${tx.date || formatDate(new Date())}</span>
      </div>
      ${[['الصنف',tx.item||'-'],['الشركة',tx.company||'-'],['الكمية',`${tx.qty} ${tx.unit||'كرتونة'}`],['المستلم',tx.recipient||'-'],['الرصيد بعد',`${tx.balanceAfter??'-'}`]].map(([k,v])=>`
        <div style="display:flex;justify-content:space-between;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <span style="color:#64748b;font-size:11px;">${k}</span>
          <span style="color:#f1f5f9;font-weight:800;font-size:12px;">${v}</span>
        </div>`).join('')}
      <div style="text-align:center;margin-top:16px;color:#334155;font-size:9px;">نظام بركة الثمار PRO • ${new Date().toLocaleDateString('ar-SA')}</div>
    `;
    document.body.appendChild(el);
    try {
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
      const link = document.createElement('a');
      link.download = `StockOut_${tx.item}_${tx.date || Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('تم حفظ السند كصورة PNG 🖼️');
    } catch(e) {
      toast.error('خطأ أثناء حفظ الصورة');
    } finally {
      document.body.removeChild(el);
    }
  };

  // --- ANIMATIONS ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const cardVariants = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } } };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-readex text-slate-800 overflow-hidden" dir="rtl">

      {/* ─── HEADER ─── */}
      <div className="bg-white border-b border-slate-200 p-4 sm:p-6 shrink-0 z-20 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-rose-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-orange-500/20 shrink-0">
              <ArrowUpRight size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">أذونات الصادر</h2>
              <p className="text-sm font-bold text-slate-400 mt-1">إدارة عمليات صرف وتوزيع البضاعة من المستودع بدقة</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse self-end lg:self-auto relative pr-2">
            
            <div className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-orange-50 border border-orange-100 rounded-2xl mr-2">
              <span className="text-xs font-black text-orange-500 uppercase tracking-wider">صادر اليوم:</span>
              <span className="text-xl font-black text-orange-600 leading-none">{todayTotal} <span className="text-[11px] font-bold opacity-60">كرتونة</span></span>
            </div>

            {/* Export dropdown */}
            <div className="relative">
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm transition-all shadow-sm">
                <Download size={18} />
                <span>تصدير </span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isExportMenuOpen ? 'rotate-180 text-orange-500' : ''}`} />
              </button>
              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                    className="absolute top-full mt-3 right-0 w-56 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-50 text-sm font-bold">
                    <button onClick={handleExportPDF} className="w-full flex items-center justify-between px-5 py-4 text-slate-600 hover:bg-slate-50 hover:text-orange-600 transition-colors border-b border-slate-50">
                      <span className="flex items-center space-x-3 space-x-reverse"><FileText size={18} /><span>تحميل PDF</span></span>
                    </button>
                    <button onClick={() => { toast.info('جاري تجهيز الصفحة للطباعة...'); window.print(); setIsExportMenuOpen(false); }} className="w-full flex items-center justify-between px-5 py-4 text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors">
                      <span className="flex items-center space-x-3 space-x-reverse"><Image size={18} /><span>تحميل صورة PNG</span></span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-10 bg-slate-200 mx-2"></div>

            {/* Blank Template Button — Professional */}
            <button
              onClick={handleBlankTemplate}
              className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-sm transition-all shadow-sm"
              title="طباعة سند إخراج فارغ للكتابة اليدوية"
            >
              <Printer size={18} />
              <span>طباعة سند فارغ</span>
            </button>

            {!isViewer && (
              <button
                onClick={() => { setModalDrafts([]); setBulkRecipient(''); setBulkDate(formatDate(new Date())); setIsAddModalOpen(true); setTimeout(() => itemNameRef.current?.focus(), 150); }}
                className="flex items-center space-x-2 space-x-reverse px-6 py-3 bg-gradient-to-br from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm hover:shadow-2xl hover:shadow-orange-500/30 active:scale-95 transition-all shadow-xl shadow-orange-500/20">
                <Plus size={20} /><span>إضافة صادر جديد</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="relative group flex-1 min-w-[300px]">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            <input type="text" placeholder="البحث بالصنف، الشركة، أو المستلم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-100/50 border border-transparent focus:bg-white focus:border-orange-500/20 focus:ring-4 focus:ring-orange-500/5 text-slate-800 text-sm font-bold rounded-2xl pr-11 pl-4 py-3 outline-none transition-all" />
          </div>
          <div className="flex items-center gap-3">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-100/50 border border-transparent text-slate-700 text-sm font-bold rounded-2xl px-5 py-3 cursor-pointer focus:bg-white focus:border-orange-500/20 outline-none transition-all appearance-none">
              <option>التصنيف: الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
            </select>
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="bg-slate-100/50 border border-transparent text-slate-700 text-sm font-bold rounded-2xl px-5 py-3 cursor-pointer focus:bg-white focus:border-orange-500/20 outline-none transition-all appearance-none">
              {dynamicCompanies.map(c => <option key={c}>{c === 'الكل' ? 'الشركة: الكل' : c}</option>)}
            </select>
            <button onClick={() => setShowHotOnly(!showHotOnly)}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all border ${showHotOnly ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-lg shadow-orange-500/10' : 'bg-slate-100/50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
              <Flame size={18} className={showHotOnly ? 'animate-pulse text-orange-500' : ''} /><span>نشاط عالي</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── SECTIONED GRID ─── */}
      <div className="flex-1 overflow-y-auto px-6 pb-12 custom-scrollbar w-full bg-slate-50/30">
        {Object.keys(groupedTransactions).length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 mt-8 min-h-[50vh] shadow-sm">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
              <ArrowUpRight size={48} className="text-slate-300 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">لا توجد حركات صادر مطابقة</h3>
            <p className="text-slate-400 font-bold mb-10 max-w-sm">أضف أذونات الصرف والتوزيع من المستودع لتظهر هنا مصنفة بالأقسام.</p>
            {!isViewer && (
              <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-3.5 bg-gradient-to-br from-orange-500 to-rose-600 text-white rounded-2xl font-black shadow-lg shadow-orange-500/30">إضافة أول حركة صادر</button>
            )}
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10 mt-8">
            {Object.keys(groupedTransactions).sort().map(cat => (
              <div key={cat} className="space-y-6">
                
                {/* Category Header */}
                <div className="flex items-center space-x-4 space-x-reverse px-2 sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-3 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-orange-500">
                    {getCatIcon(cat)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">صادر {cat}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">تصنيف المنتجات</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent via-slate-200 to-transparent mx-4"></div>
                  <span className="text-xs font-black text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100 shadow-sm">{groupedTransactions[cat].length} سند</span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {groupedTransactions[cat].map(tx => (
                    <motion.div key={tx.id} variants={cardVariants}
                      onClick={() => { setSelectedTx(tx); setIsDetailsOpen(true); }}
                      className="group relative flex flex-col justify-between p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-2xl hover:border-orange-200 transition-all duration-500 cursor-pointer">
                      <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between w-full mb-4">
                          <div className="flex flex-col w-full overflow-hidden">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase truncate">{tx.recipient || 'بدون مستلم'}</span>
                              <span className="text-[10px] font-bold text-slate-400">{tx.date}</span>
                            </div>
                            <div className="flex items-center gap-2 w-full">
                              <h4 className="text-lg font-black text-slate-800 leading-tight group-hover:text-orange-600 transition-colors truncate tracking-tight">
                                {tx.items_summary?.length || 0} أصناف منصرفة
                              </h4>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-end justify-between mt-auto pt-4 border-t border-slate-50">
                          <div className="flex flex-col space-y-2">
                            <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-sm font-black bg-orange-50 text-orange-600 border border-orange-100 w-max shadow-sm">
                              -{tx.total_qty || tx.qty} <span className="text-[10px] font-bold mr-1 opacity-70">إجمالي</span>
                            </span>
                          </div>

                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            <button onClick={(e) => { e.stopPropagation(); handleRowExportPDF(tx); }} title="تصدير PDF" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-200 hover:shadow-lg transition-all active:scale-90"><FileText size={14} /></button>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-0 right-10 left-10 h-1 bg-gradient-to-r from-orange-500 to-rose-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out rounded-t-full"></div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ─── BULK DISPATCH MODAL ─── */}
      <ModalWrapper
        title="إنشاء إذن صرف مجمع"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleBulkSubmit}
        loading={loading}
        submitLabel={`تأكيد خروج البضاعة (عدد: ${modalDrafts.length})`}
        submitColor="orange"
        maxWidth="max-w-4xl"
        disableSubmit={modalDrafts.length === 0}
      >
        <div className="flex flex-col gap-6">

          {/* Row 1: Date + Recipient */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
            <div>
              <label className={LabelClass}>تاريخ الإذن</label>
              <input type="date" className={InputClass} value={bulkDate} onChange={e => setBulkDate(e.target.value)} required />
            </div>
            <div>
              <label className={LabelClass}>اسم المستلم / المندوب <span className="text-rose-500">*</span></label>
              <div className="relative">
                <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input type="text" className={`${InputClass} pr-10`} placeholder="مثال: أحمد محمد..." value={bulkRecipient} onChange={e => setBulkRecipient(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Row 2: Standardized Entry Row */}
          <div className="bg-orange-50/50 border border-orange-200/60 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3 relative z-30">
              
              {/* Unified Search (flex-grow) */}
              <div className="flex-1 min-w-[300px] relative group/finder">
                 <label className={LabelClass}>البحث عن صنف أو شركة</label>
                 <div className="relative">
                    <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input 
                      ref={itemNameRef} type="text" 
                      className={`${InputClass} pr-11 text-center`}
                      placeholder="ابحث عن صنف أو شركة..." 
                      value={searchNameText} 
                      onChange={e => { setSearchNameText(e.target.value); setSelectedItemModel(null); if (e.target.value.length >= 2) setItemSearchActiveIndex(-1); }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setItemSearchActiveIndex(prev => prev < itemSuggestions.length - 1 ? prev + 1 : prev); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setItemSearchActiveIndex(prev => prev > 0 ? prev - 1 : 0); }
                        else if (e.key === 'Enter') {
                           e.preventDefault();
                           if (itemSearchActiveIndex >= 0 && itemSuggestions[itemSearchActiveIndex]) handleSelectSuggestion(itemSuggestions[itemSearchActiveIndex]);
                           else if (selectedItemModel) {
                             document.getElementById('stock-out-qty-input')?.focus();
                           }
                        }
                      }}
                    />
                    <AnimatePresence>
                      {itemSuggestions.length > 0 && !selectedItemModel && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-[100] py-2">
                           {itemSuggestions.map((item, idx) => (
                             <button key={item.id} type="button" onMouseEnter={() => setItemSearchActiveIndex(idx)} onClick={() => handleSelectSuggestion(item)} className={`w-full px-5 py-2 cursor-pointer flex items-center justify-between transition-colors ${idx === itemSearchActiveIndex ? 'bg-orange-50 text-orange-700' : 'hover:bg-slate-50'}`}>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-800">{item.name} - {item.company || 'بدون شركة'}</div>
                                  <div className="text-[10px] text-slate-400 font-bold">{item.cat}</div>
                                </div>
                                <div className="text-[10px] font-black bg-orange-100/50 text-orange-600 px-2 py-1 rounded-lg tabular-nums">رصيد: {item.stockQty} {item.unit}</div>
                             </button>
                           ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
              </div>

              {/* Quantity */}
              <div className="w-[120px]">
                 <label className={LabelClass}>الكمية</label>
                 <input 
                   id="stock-out-qty-input" 
                   type="number" 
                   className={`${InputClass} text-center font-black !border-orange-500/40 focus:!ring-orange-500/20`}
                   placeholder="0" 
                   value={draftQty} 
                   onChange={e => setDraftQty(e.target.value)} 
                   onKeyDown={e => e.key === 'Enter' && handlePushToDraft()} 
                 />
              </div>

              {/* Add Button */}
              <button 
                type="button" 
                onClick={handlePushToDraft} 
                className="h-[42px] px-6 bg-orange-500 text-white rounded-xl font-black text-sm hover:shadow-lg hover:shadow-orange-500/30 transition-all flex items-center gap-2"
              >
                <Plus size={18} />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Row 3: Review Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-inner">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="text-sm font-black text-slate-700">مراجعة الأسطر</h4>
              <span className="text-xs font-bold bg-white px-3 py-1 rounded-full text-orange-600 border border-slate-200 shadow-sm">{modalDrafts.length} أصناف مُعدّة للصرف</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto px-2 custom-scrollbar">
              {modalDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 opacity-60">
                  <CheckCircle size={32} className="mb-2" />
                  <span className="font-bold text-sm">ابحث عن صنف بالأعلى ثم أدخل الكمية المراد صرفها.</span>
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-lg border border-slate-200 mt-2">
                  <table className="w-full min-w-[640px] text-right border-separate border-spacing-y-2">
                    <thead>
                    <tr className="text-slate-400 font-black text-xs text-center">
                      <th className="px-2 py-1">م</th><th className="px-3 py-1 text-right">الصنف</th><th className="px-3 py-1 text-right">الشركة</th>
                      <th className="px-2 py-1">القسم</th><th className="px-2 py-1 text-orange-500">الكمية</th><th className="px-2 py-1">الوحدة</th><th className="px-2 py-1 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {modalDrafts.map((dr, index) => (
                        <motion.tr key={dr.draftId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-slate-50 text-sm font-bold hover:bg-white transition-all">
                          <td className="px-2 py-3 text-center text-slate-400 rounded-r-xl border-y border-r border-slate-200">{index + 1}</td>
                          <td className="px-3 py-3 text-slate-800 border-y border-slate-200">{dr.item}</td>
                          <td className="px-3 py-3 text-slate-600 text-xs border-y border-slate-200">{dr.company}</td>
                          <td className="px-2 py-3 text-center text-orange-500 text-xs border-y border-slate-200">{dr.cat}</td>
                          <td className="px-2 py-3 text-center border-y border-slate-200"><span className="bg-orange-100 text-orange-700 px-3 py-1 rounded inline-block">-{dr.qty}</span></td>
                          <td className="px-2 py-3 text-center text-slate-500 text-xs border-y border-slate-200">{dr.unit}</td>
                          <td className="px-2 py-3 text-center rounded-l-xl border-y border-l border-slate-200">
                            <button onClick={() => setModalDrafts(prev => prev.filter(d => d.draftId !== dr.draftId))} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mx-auto block">
                              <X size={16} className="stroke-[3]" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
         </div>
        </ModalWrapper>

      {/* ─── EDIT MODAL ─── */}
      <ModalWrapper title="تعديل سند الصرف" isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSubmit={handleEditSubmit} loading={loading}>
        <div className="space-y-4">
          <div>
            <label className={LabelClass}>الكمية</label>
            <input type="number" min="1" className={InputClass} value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} required />
          </div>
          <div>
            <label className={LabelClass}>اسم المستلم</label>
            <input type="text" className={InputClass} value={editForm.recipient} onChange={e => setEditForm({ ...editForm, recipient: e.target.value })} />
          </div>
          <div>
            <label className={LabelClass}>التاريخ</label>
            <input type="date" className={InputClass} value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} required />
          </div>
        </div>
      </ModalWrapper>

      {/* ─── DELETE MODAL ─── */}
      <ModalWrapper title="إلغاء سند صرف" isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onSubmit={handleDeleteSubmit} loading={loading} submitLabel="نعم، إلغاء الصرف" submitColor="rose">
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4 animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">تأكيد إلغاء سند الصرف</h4>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">سيتم إعادة الكمية المصروفة إلى رصيد المخزن تلقائياً.</p>
        </div>
      </ModalWrapper>

      {/* ─── DETAILS MODAL ─── */}
      <AnimatePresence>
        {isDetailsOpen && selectedTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                       <ArrowUpRight size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none">تفاصيل إذن الصرف</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">مراجعة بيانات الصادر</p>
                    </div>
                 </div>
                 <button onClick={() => setIsDetailsOpen(false)} className="p-3 bg-white dark:bg-slate-700 text-slate-400 hover:text-rose-500 rounded-2xl shadow-sm transition-colors active:scale-90">
                    <X size={20} />
                 </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">المستلم / المندوب</span>
                       <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black">
                          <User size={16} className="text-orange-500" />
                          {selectedTx.recipient}
                       </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">تاريخ الحركة</span>
                       <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black">
                          <Calendar size={16} className="text-orange-500" />
                          {selectedTx.date}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                       <Package size={14} className="text-orange-500" />
                       قائمة الأصناف المنصرفة
                    </h4>
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                       <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                             <tr>
                                <th className="px-5 py-3">الصنف والشركة</th>
                                <th className="px-5 py-3 text-center">القسم</th>
                                <th className="px-5 py-3 text-center">الكمية</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                             {(selectedTx.items_summary || []).map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                   <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-300 border-x border-slate-100 dark:border-slate-700">{it.item}</td>
                                   <td className="px-5 py-3 text-center border-x border-slate-100 dark:border-slate-700">
                                      <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-md text-[9px] font-black">{it.cat}</span>
                                   </td>
                                   <td className="px-5 py-3 text-center font-black text-orange-600 tabular-nums border-x border-slate-100 dark:border-slate-700">
                                      -{it.qty} {it.unit}
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                 <button onClick={() => handleRowExportPDF(selectedTx)} className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-black text-sm shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                    <Printer size={18} />
                    <span>طباعة السند</span>
                 </button>
                 <button onClick={() => setIsDetailsOpen(false)} className="px-8 py-3 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl font-bold text-sm border border-slate-200 dark:border-slate-600 active:scale-95 transition-all">إغلاق</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
