import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, CheckCircle, ArrowUpRight, Flame, User, Printer, Calendar, Layers, LogOut
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

export default function StockOut({ setActiveView }) {
  const { playSuccess, playWarning } = useAudio();
  const { currentUser, isViewer } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const { data: itemsData } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty');
      if (itemsData) {
        setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty })));
      }
      
      const { data: transData } = await supabase.from('transactions').select('id, type, item_id, balance_after, timestamp, item, company, qty, unit, cat, recipient, beneficiary, rep, date, status, batch_id, is_summary, total_qty, items_summary').order('timestamp', { ascending: false });
      if (transData) {
        setTransactions(transData.map(d => ({ ...d, itemId: d.item_id, balanceAfter: d.balance_after })));
      }
      setLoading(false);
    };
    
    fetchInitialData();

    const channel = supabase.channel('stock-out-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsDetailsModalOpen(false);
    };
    if (isDetailsModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailsModalOpen]);

  const stockOutTransactions = useMemo(() => transactions.filter(t => t.type === 'out'), [transactions]);

  // Group transactions by batch_id to show "Invoices" instead of individual items
  const groupedInvoices = useMemo(() => {
    const groups = {};
    stockOutTransactions.forEach(tx => {
      const bid = tx.batch_id || tx.id;
      if (!groups[bid]) {
        groups[bid] = {
          id: bid,
          batch_id: tx.batch_id,
          rep: tx.rep || tx.recipient || tx.beneficiary || 'غير محدد',
          date: tx.date || (tx.timestamp ? formatDate(new Date(tx.timestamp)) : '-'),
          timestamp: tx.timestamp,
          items: tx.items_summary && Array.isArray(tx.items_summary) ? tx.items_summary : [
            { item: tx.item, company: tx.company, qty: tx.qty, unit: tx.unit, cat: tx.cat }
          ]
        };
      }
    });

    const list = Object.values(groups);

    return list.filter(inv => {
      const q = normalizeArabic(searchQuery);
      const searchStr = normalizeArabic(`${inv.rep} ${inv.id}`);
      const matchSearch = searchStr.includes(q);
      
      return matchSearch;
    }).sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date);
      const dateB = new Date(b.timestamp || b.date);
      return dateB - dateA;
    });
  }, [stockOutTransactions, searchQuery]);

  const openInvoiceDetails = (inv) => {
    setSelectedInvoice(inv);
    setIsDetailsModalOpen(true);
  };

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

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-readex text-slate-800 bg-slate-50/30 overflow-hidden" dir="rtl">
      
      {/* ─── PREMIUM HEADER ─── */}
      <div className="mx-6 mt-6 shrink-0 z-20">
        <div className="bg-white border border-slate-200 rounded-[1.5rem] p-3 flex flex-col lg:flex-row items-center justify-between shadow-sm gap-4 lg:gap-0">
          
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start lg:pl-4 lg:border-l border-slate-200 shrink-0">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                   <ArrowUpRight size={20} />
                </div>
                <div className="flex flex-col">
                   <h2 className="text-xl font-black text-[#0f2747] tracking-tight leading-none">أذونات الصادر</h2>
                   <p className="text-[10px] text-slate-400 font-bold mt-1">سجل حركة خروج البضاعة</p>
                </div>
             </div>
          </div>

          <div className="flex-1 w-full lg:w-auto lg:px-4 relative group flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              <input 
                type="text" 
                placeholder="ابحث عن مندوب أو رقم إذن..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#fcfdfc] border border-slate-100 text-[13px] font-bold rounded-[14px] pr-12 pl-4 h-11 outline-none transition-all placeholder:text-slate-400 text-slate-800 focus:bg-white focus:border-orange-500/20 shadow-inner" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => setActiveView('dashboard')}
               className="w-11 h-11 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 rounded-[14px] flex items-center justify-center transition-all border border-rose-100 group shadow-sm shadow-rose-500/10"
               title="العودة للرئيسية"
             >
                <LogOut size={22} className="group-hover:-translate-x-1 transition-transform rotate-180" />
             </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN TABLE AREA ─── */}
      <div className="flex-1 overflow-hidden p-6 pt-4">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin" />
                <p className="font-bold">جاري تحميل سجلات الصادر...</p>
              </div>
            ) : groupedInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-400 opacity-60">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                   <ArrowUpRight size={40} className="text-slate-300" />
                </div>
                <p className="text-lg font-black">لا توجد سجلات مطابقة</p>
              </div>
            ) : (
              <table className="w-full text-right border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="bg-slate-50 text-[#8ba3b5] font-black text-[9px] uppercase tracking-widest border-b border-slate-200">
                    <th className="px-6 py-5 text-center w-20">م</th>
                    <th className="px-6 py-5 text-center">اسم المندوب / المستلم</th>
                    <th className="px-6 py-5 text-center w-48">عدد الأصناف</th>
                    <th className="px-6 py-5 text-center w-64">التاريخ</th>
                    <th className="px-6 py-5 text-center w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedInvoices.map((inv, idx) => (
                    <tr 
                      key={inv.id} 
                      onClick={() => openInvoiceDetails(inv)}
                      className="group hover:bg-orange-50/30 transition-all border-b border-slate-100 cursor-pointer"
                    >
                      <td className="px-6 py-4 text-center align-middle">
                         <span className="text-xs font-black text-slate-300 group-hover:text-orange-500 transition-colors tabular-nums">{idx + 1}</span>
                      </td>
                      <td className="px-6 py-4 text-center align-middle">
                         <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-100 group-hover:bg-white text-slate-700 rounded-xl border border-slate-200/50 shadow-sm transition-all">
                            <User size={14} className="text-orange-500" />
                            <span className="text-sm font-black tracking-tight">{inv.rep}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center align-middle">
                         <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 text-xs font-black">
                            <Layers size={12} />
                            <span>{inv.items.length} صنف</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center align-middle">
                         <div className="flex flex-col items-center">
                            <span className="text-[13px] font-black text-slate-600 tabular-nums">{inv.date}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center align-middle">
                         <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                            <ChevronDown size={18} className="-rotate-90" />
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="px-8 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-center items-center shrink-0">
             <p className="text-[10px] font-bold text-slate-300 italic">نظام بركة الثمار PRO - سجل الصادر الملخص</p>
          </div>
        </div>
      </div>

      {/* ─── DETAILS MODAL ─── */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            dir="rtl" onClick={() => setIsDetailsModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[95vh] border border-slate-100"
              onClick={e => e.stopPropagation()}
            >
              {/* --- Modal Header --- */}
              <div className="p-10 pb-6 border-b border-slate-100 bg-white relative shrink-0">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                       <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                          <User size={28} />
                       </div>
                       <div className="flex flex-col text-right">
                          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{selectedInvoice.rep}</h3>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                       <div className="px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center min-w-[120px]">
                          <span className="text-[9px] font-black text-slate-400 mb-0.5">تاريخ الفاتورة</span>
                          <span className="text-sm font-black text-slate-700 tabular-nums">{selectedInvoice.date}</span>
                       </div>
                       
                       <button 
                         onClick={() => setIsDetailsModalOpen(false)}
                         className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-transparent hover:border-rose-100"
                       >
                          <X size={24} strokeWidth={3} />
                       </button>
                    </div>
                 </div>
              </div>

              {/* --- Modal Body --- */}
              <div className="p-8 flex-1 overflow-auto custom-scrollbar bg-white">
                 <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-right border-separate border-spacing-0">
                       <thead>
                          <tr className="bg-slate-50/50 text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
                             <th className="px-6 py-4 text-center w-16">م</th>
                             <th className="px-6 py-4">بيان الصنف</th>
                             <th className="px-6 py-4 text-center w-32">القسم</th>
                             <th className="px-6 py-4 text-center w-32">وحدة القياس</th>
                             <th className="px-6 py-4 text-center w-32">الكمية</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {selectedInvoice.items.map((it, i) => (
                             <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                                <td className="px-6 py-4 text-center text-xs font-black text-slate-300 tabular-nums">{i + 1}</td>
                                <td className="px-6 py-4">
                                   <div className="flex flex-col">
                                      <span className="text-sm font-black text-slate-700">{it.item}</span>
                                      <span className="text-[10px] font-bold text-slate-400 mt-0.5">{it.company || 'بدون شركة'}</span>
                                   </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                   <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200/50">
                                      {it.cat}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                   <span className="text-xs font-bold text-slate-400 uppercase">{it.unit}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                   <span className="text-sm font-black text-slate-700 tabular-nums">{it.qty}</span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* --- Modal Footer --- */}
              <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-4 text-slate-500">
                    <div className="flex flex-col items-start leading-none">
                       <span className="text-[10px] font-black uppercase opacity-60">إجمالي الأصناف</span>
                       <span className="text-sm font-black text-slate-700 mt-1">{selectedInvoice.items.length} صنف</span>
                    </div>
                 </div>
                 
                 <div className="flex gap-3">
                    <button 
                      onClick={() => setIsDetailsModalOpen(false)}
                      className="px-12 py-2.5 bg-slate-800 text-white rounded-xl font-black text-xs shadow-lg shadow-slate-200 hover:bg-slate-900 transition-all"
                    >
                       إغلاق
                    </button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
