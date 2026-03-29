import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Pencil, Trash2, Package, Box,
  AlertTriangle, CheckCircle, User, Truck, ChevronDown, Printer,
  Image as ImageIcon, FilterX, CalendarRange,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import {
  collection, onSnapshot, query, orderBy, doc, serverTimestamp, Timestamp, writeBatch,
  updateDoc, deleteDoc, runTransaction,
} from 'firebase/firestore';
import { getItemName, getCompany, getCategory, getUnit } from '../../lib/itemFields';
import { toast } from 'sonner';
import { useAudio } from '../../contexts/AudioContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import html2canvas from 'html2canvas';

const formatDate = (date) => {
  if (!date) return '';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  return d.toISOString().split('T')[0];
};

/** @typedef {'in' | 'outward'} VoucherKind */



const KIND_CONFIG = {
  in: {
    txType: 'سند إدخال صوري',
    codePrefix: 'IN',
    counterKey: 'in',
    pageTitle: 'سند إدخال صوري',
    pageSubtitle:
      'مرجع توريد سريع للأرشفة — لا يعدّل رصيد المخزن (لتفادي الازدواج مع حركة الوارد الفعلية)',
    modalTitle: 'سند إدخال صوري (مرجع توريد)',
    accent: 'emerald',
    Icon: Package,
    sessionFields: [{ key: 'supplier', label: 'اسم المورد', required: true, placeholder: 'مثال: شركة التوريدات' }],
    pdfTitle: 'إيصال مرجعي — سند إدخال صوري',
  },
  outward: {
    txType: 'سند إخراج صوري',
    codePrefix: 'OUT',
    counterKey: 'out',
    pageTitle: 'عهدة المندوب (سند إخراج صوري)',
    pageSubtitle: 'إثبات تسليم أصناف بعهدة مندوب — سند صوري لا يغيّر رصيد المخزن',
    modalTitle: 'سند إخراج صوري (عهدة مندوب)',
    accent: 'blue',
    Icon: Truck,
    sessionFields: [{ key: 'rep', label: 'اسم المندوب', required: true, placeholder: 'مثال: أحمد محمد' }],
    pdfTitle: 'إيصال عهدة — سند إخراج صوري',
  },
};

function accentTheme(accent) {
  if (accent === 'rose') {
    return {
      ring: 'focus:ring-rose-500/20 focus:border-rose-500',
      gradient: 'from-rose-500 to-rose-700',
      shadow: 'shadow-rose-500/25',
      pdfRgb: [244, 63, 94],
      glow: 'hover:shadow-[0_0_22px_rgba(244,63,94,0.45)]',
    };
  }
  if (accent === 'emerald') {
    return {
      ring: 'focus:ring-emerald-500/20 focus:border-emerald-500',
      input: '!border-emerald-500/50 focus:!ring-emerald-500/30 text-emerald-700 dark:text-emerald-400',
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/25',
      badge: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      softBg: 'bg-emerald-50/50 dark:bg-slate-800/30 border-emerald-200/60 dark:border-slate-700',
      chip: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
      tableHead: 'text-emerald-500',
      qtyBadge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
      pdfRgb: [16, 185, 129],
      glow: 'hover:shadow-[0_0_22px_rgba(16,185,129,0.5)]',
      glowBlue: 'hover:shadow-[0_0_18px_rgba(16,185,129,0.45)]',
    };
  }
  return {
    ring: 'focus:ring-blue-500/20 focus:border-blue-500',
    input: '!border-blue-500/50 focus:!ring-blue-500/30 text-blue-700 dark:text-blue-400',
    gradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-blue-500/25',
    badge: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400',
    softBg: 'bg-blue-50/50 dark:bg-slate-800/30 border-blue-200/60 dark:border-slate-700',
    chip: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300',
    tableHead: 'text-blue-500',
    qtyBadge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    pdfRgb: [59, 130, 246],
    glow: 'hover:shadow-[0_0_22px_rgba(59,130,246,0.5)]',
    glowBlue: 'hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]',
  };
}

const baseInput =
  'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl block px-4 py-2.5 outline-none transition-all';
const LabelClass = 'block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5';

const actionBtnBase =
  'inline-flex items-center justify-center rounded-xl border font-bold text-xs transition-all duration-200';

function ModalWrapper({
  title, isOpen, onClose, children, onSubmit, maxWidth, submitLabel, loading, disableSubmit, accent,
}) {
  const t = accentTheme(accent);
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
          dir="rtl"
          onMouseDown={onClose}
        >
          <motion.div
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`w-full ${maxWidth} bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]`}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} className="stroke-[3]" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex space-x-3 space-x-reverse justify-end shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading || disableSubmit}
                  className={`px-6 py-2 rounded-xl font-bold text-white flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br ${t.gradient} ${t.shadow}`}
                >
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
}

function emptySession(kind) {
  const base = { date: formatDate(new Date()) };
  if (kind === 'in') return { ...base, supplier: '', supplyNotes: '' };
  return { ...base, rep: '' };
}

async function allocateVoucherCode(kind) {
  const cfg = KIND_CONFIG[kind];
  const counterRef = doc(db, 'settings', 'voucherCounters');
  const year = new Date().getFullYear();
  const key = `${cfg.counterKey}${year}`;
  let seq = 1;
  await runTransaction(db, async (t) => {
    const snap = await t.get(counterRef);
    const data = snap.exists() ? snap.data() : {};
    seq = Number(data[key] || 0) + 1;
    t.set(counterRef, { [key]: seq }, { merge: true });
  });
  return `${cfg.codePrefix}-${year}-${String(seq).padStart(3, '0')}`;
}

// Export pipeline: renders hidden HTML → html2canvas → jsPDF or PNG download
// This approach embeds Arabic perfectly since browser renders the fonts.

/**
 * @param {{ kind: VoucherKind }} props
 */
export default function VoucherWorkspace({ kind }) {
  const cfg = KIND_CONFIG[kind];
  const theme = accentTheme(cfg.accent);
  const { playSuccess, playWarning } = useAudio();
  const { currentUser, isViewer } = useAuth();
  const { settings } = useSettings();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(() => emptySession(kind));
  const [modalDrafts, setModalDrafts] = useState([]);
  const [searchNameText, setSearchNameText] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [draftQty, setDraftQty] = useState('');
  const [draftExpiryDate, setDraftExpiryDate] = useState('');
  const [draftLineNote, setDraftLineNote] = useState('');
  const [searchIdx, setSearchIdx] = useState(-1);
  const itemNameRef = useRef(null);
  // Hidden DOM refs used for html2canvas capture
  const receiptRef = useRef(null);   // filled voucher (PDF A4 + PNG)
  const blankRef   = useRef(null);   // blank voucher template

  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingLineIds, setEditingLineIds] = useState([]);
  const [preservedVoucherCode, setPreservedVoucherCode] = useState('');

  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const [editForm, setEditForm] = useState({ qty: '', date: '', lineNote: '' });

  // Export state: { group, mode: 'pdf' | 'png' | 'blank-pdf' }
  const [exportJob, setExportJob] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const triggerExport = (group, mode) => setExportJob({ group, mode });

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'items')), (s) =>
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(query(collection(db, 'transactions'), orderBy('timestamp', 'desc')), (s) =>
      setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  // ─── EMERGENCY AUTO-SAVE ───
  const DRAFT_KEY = `barakat_voucher_draft_${kind}`;
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.drafts && parsed.drafts.length > 0) setHasUnsavedDraft(true);
      } catch {}
    }
  }, [DRAFT_KEY]);

  useEffect(() => {
    if (modalDrafts.length > 0 || session.supplier !== '' || session.rep !== '') {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ session, drafts: modalDrafts }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
      setHasUnsavedDraft(false);
    }
  }, [session, modalDrafts, DRAFT_KEY]);

  const restoreDraft = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (saved && saved.drafts) {
        setSession(saved.session || emptySession(kind));
        setModalDrafts(saved.drafts);
        setIsAddModalOpen(true);
      }
    } catch {}
    setHasUnsavedDraft(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasUnsavedDraft(false);
  };


  const voucherTxs = useMemo(
    () => transactions.filter((t) => t.type === cfg.txType && t.documentary === true),
    [transactions, cfg.txType]
  );

  const voucherGroups = useMemo(() => {
    const map = new Map();
    voucherTxs.forEach((t) => {
      const gid = t.voucherGroupId || `legacy_${t.id}`;
      if (!map.has(gid)) map.set(gid, { groupId: gid, lines: [] });
      map.get(gid).lines.push(t);
    });
    const groups = [...map.values()].map((g) => {
      g.lines.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
      const first = g.lines[0];
      const lastTs = g.lines.reduce(
        (max, line) => Math.max(max, line.timestamp?.toMillis?.() || 0),
        0
      );
      return {
        ...g,
        date: first?.date || formatDate(first?.timestamp?.toDate?.()),
        supplier: first?.supplier,
        rep: first?.rep,
        supplyNotes: first?.voucherSupplyNotes || '',
        voucherCode: first?.voucherCode || '',
        lineCount: g.lines.length,
        lastTs,
      };
    });
    groups.sort((a, b) => b.lastTs - a.lastTs);
    return groups;
  }, [voucherTxs]);

  const filteredGroups = useMemo(() => {
    return voucherGroups.filter((g) => {
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        const header = (kind === 'in' ? g.supplier : g.rep) || '';
        const headerMatch = header.toLowerCase().includes(q);
        const itemMatch = g.lines.some((l) => (l.item || '').toLowerCase().includes(q));
        const codeMatch = (g.voucherCode || '').toLowerCase().includes(q);
        if (!headerMatch && !itemMatch && !codeMatch) return false;
      }
      if (filterDateFrom && g.date && g.date < filterDateFrom) return false;
      if (filterDateTo && g.date && g.date > filterDateTo) return false;
      return true;
    });
  }, [voucherGroups, filterSearch, filterDateFrom, filterDateTo, kind]);

  const resetFilters = () => {
    setFilterSearch('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const itemSuggestions = useMemo(() => {
    if (!searchNameText || selectedItem) return [];
    const q = searchNameText.toLowerCase();
    return items.filter((i) => {
      const n = getItemName(i).toLowerCase();
      const c = (getCompany(i) || '').toLowerCase();
      return n.includes(q) || c.includes(q);
    });
  }, [items, searchNameText, selectedItem]);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setSearchNameText(`${getItemName(item)} — ${getCompany(item)}`);
    setSearchIdx(-1);
    setTimeout(() => document.getElementById(`voucher-qty-${kind}`)?.focus(), 50);
  };

  const clearRow = useCallback(() => {
    setSelectedItem(null);
    setSearchNameText('');
    setDraftQty('');
    setDraftExpiryDate('');
    setDraftLineNote('');
    setTimeout(() => itemNameRef.current?.focus(), 50);
  }, []);

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setEditingGroupId(null);
    setEditingLineIds([]);
    setPreservedVoucherCode('');
    setModalDrafts([]);
    setSession(emptySession(kind));
    clearRow();
  };

  const pushDraft = () => {
    if (!selectedItem || !draftQty || Number(draftQty) <= 0 || (kind === 'in' && !draftExpiryDate)) {
      toast.error(kind === 'in' ? 'يرجى اختيار صنف، الكمية، وتحديد تاريخ الصلاحية.' : 'يرجى اختيار صنف وإدخال كمية صحيحة.');
      playWarning();
      return;
    }
    const row = {
      draftId: crypto.randomUUID(),
      itemId: selectedItem.id,
      item: getItemName(selectedItem),
      company: getCompany(selectedItem),
      cat: getCategory(selectedItem),
      unit: getUnit(selectedItem),
      qty: Number(draftQty),
      expiryDate: draftExpiryDate || '',
      lineNote: String(draftLineNote || '').trim(),
    };
    setModalDrafts((p) => [row, ...p]);
    playSuccess();
    clearRow();
  };

  const validateSession = () => {
    for (const f of cfg.sessionFields) {
      if (f.required && !String(session[f.key] || '').trim()) {
        toast.error(`يرجى تعبئة: ${f.label}`);
        playWarning();
        return false;
      }
    }
    if (!session.date) {
      toast.error('يرجى اختيار التاريخ.');
      playWarning();
      return false;
    }
    return true;
  };

  const openEditGroup = (group) => {
    setEditingGroupId(group.groupId);
    setEditingLineIds(group.lines.map((l) => l.id));
    setPreservedVoucherCode(group.voucherCode || '');
    if (kind === 'in') {
      setSession({
        supplier: group.supplier || '',
        date: group.date || formatDate(new Date()),
        supplyNotes: group.supplyNotes || '',
      });
    } else {
      setSession({
        rep: group.rep || '',
        date: group.date || formatDate(new Date()),
      });
    }
    setModalDrafts(
      group.lines.map((l) => ({
        draftId: crypto.randomUUID(),
        itemId: l.itemId,
        item: l.item,
        company: l.company || 'بدون شركة',
        cat: l.cat || 'أخرى',
        unit: l.unit || 'كرتونة',
        qty: Number(l.qty),
        expiryDate: l.expiryDate || '',
        lineNote: l.lineSupplyNote || l.lineNote || '',
      }))
    );
    setIsAddModalOpen(true);
    setTimeout(() => itemNameRef.current?.focus(), 150);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!modalDrafts.length) return;
    if (!validateSession()) return;

    const voucherSupplyNotes = kind === 'in' ? String(session.supplyNotes || '').trim() : '';
    setLoading(true);

    try {
      let voucherGroupId = editingGroupId || crypto.randomUUID();
      let voucherCode = preservedVoucherCode;

      if (!voucherCode) {
        voucherCode = await allocateVoucherCode(kind);
      }

      const batch = writeBatch(db);
      editingLineIds.forEach((id) => batch.delete(doc(db, 'transactions', id)));

      const basePayload = {
        type: cfg.txType,
        documentary: true,
        date: session.date,
        timestamp: serverTimestamp(),
        voucherGroupId,
        voucherCode,
      };
      if (kind === 'in') {
        basePayload.supplier = String(session.supplier).trim();
        basePayload.voucherSupplyNotes = voucherSupplyNotes;
      } else {
        basePayload.rep = String(session.rep).trim();
      }

      modalDrafts.forEach((entry) => {
        const txRef = doc(collection(db, 'transactions'));
        const line = {
          ...basePayload,
          item: entry.item,
          itemId: entry.itemId,
          company: entry.company,
          qty: entry.qty,
          unit: entry.unit,
          cat: entry.cat,
          expiryDate: entry.expiryDate || '',
          lineNote: entry.lineNote || '',
        };
        batch.set(txRef, line);
      });

      await batch.commit();

      toast.success(
        editingGroupId
          ? `✅ تم تحديث السند ${voucherCode}`
          : `✅ تم حفظ السند ${voucherCode} (${modalDrafts.length} سطر)`
      );
      playSuccess();
      closeAddModal();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ. حاول مرة أخرى.');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || '—';

  // Unified export pipeline via html2canvas → file download
  useLayoutEffect(() => {
    if (!exportJob) return undefined;
    const { group, mode } = exportJob;
    const elRef = (mode === 'blank-png') ? blankRef : receiptRef;

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        setIsExporting(true);
        try {
          const el = elRef.current;
          if (!el) { setExportJob(null); setIsExporting(false); return; }

          const canvas = await html2canvas(el, {
            scale: 3,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true,
          });

          // PNG-only download for all modes
          const dateStr = (group?.date || new Date().toISOString().slice(0,10)).replace(/-/g, '');
          const vCode = group?.voucherCode || (mode === 'blank-png' ? 'BLANK' : 'VOUCHER');
          const orgSlug = (settings?.orgName || 'Barakat').replace(/[\s]/g, '_').replace(/[\u0600-\u06FF]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Barakat';
          let dlName;
          if (settings?.filenameFormat === 'name_date') {
            dlName = `${orgSlug}_${dateStr}.png`;
          } else if (settings?.filenameFormat === 'date_code') {
            dlName = `${dateStr}_${vCode}.png`;
          } else {
            dlName = `Barakat_${vCode}_${dateStr}.png`; // default: code_date
          }
          const link = document.createElement('a');
          link.download = dlName;
          link.href = canvas.toDataURL('image/png', 1);
          link.click();
          if (mode === 'blank-png') {
            toast.success('✅ تم تحميل السند الفارغ كصورة عالية الجودة');
          } else {
            toast.success('✅ تم حفظ الصورة — جاهزة للمشاركة عبر واتساب 📱');
          }
        } catch (err) {
          console.error(err);
          toast.error('تعذر إنشاء الملف، يرجى المحاولة مجدداً.');
        } finally {
          setExportJob(null);
          setIsExporting(false);
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [exportJob, kind]);

  const openEdit = (tx) => {
    setSelectedTx(tx);
    setEditForm({
      qty: tx.qty,
      date: tx.date || formatDate(tx.timestamp?.toDate?.() || new Date()),
      lineNote: tx.lineSupplyNote || tx.lineNote || '',
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTx || Number(editForm.qty) <= 0) return;
    setLoading(true);
    try {
      const txRef = doc(db, 'transactions', selectedTx.id);
      const patch = { qty: Number(editForm.qty), date: editForm.date, lineNote: String(editForm.lineNote || '').trim() };
      await updateDoc(txRef, patch);
      toast.success('تم تعديل السطر بنجاح');
      playSuccess();
      setIsEditOpen(false);
    } catch {
      toast.error('خطأ في التعديل');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const openDelete = (tx) => {
    setSelectedTx(tx);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTx) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'transactions', selectedTx.id));
      toast.success('تم حذف السطر');
      playSuccess();
      setIsDeleteOpen(false);
    } catch {
      toast.error('خطأ أثناء الحذف');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const openDeleteGroup = (group) => {
    setGroupToDelete(group);
    setIsDeleteGroupOpen(true);
  };

  const handleDeleteGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupToDelete?.lines?.length) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      groupToDelete.lines.forEach((l) => batch.delete(doc(db, 'transactions', l.id)));
      await batch.commit();
      toast.success('تم حذف السند بالكامل');
      playSuccess();
      setIsDeleteGroupOpen(false);
      setGroupToDelete(null);
      setExpandedGroupId(null);
    } catch {
      toast.error('تعذر حذف السند');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const Icon = cfg.Icon;
  const inputClass = `${baseInput} ${theme.ring}`;
  const glowImg = theme.glow;
  const glowEdit = 'hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]';
  const glowDel = 'hover:shadow-[0_0_18px_rgba(244,63,94,0.45)]';

  const openModal = () => {
    setEditingGroupId(null);
    setEditingLineIds([]);
    setPreservedVoucherCode('');
    setSession(emptySession(kind));
    setModalDrafts([]);
    clearRow();
    setIsAddModalOpen(true);
    setTimeout(() => itemNameRef.current?.focus(), 150);
  };

  const headerPartyLabel = kind === 'in' ? 'المورد' : 'المندوب';

  // Accent colors for the hidden receipt DOM
  const accentHex = kind === 'in' ? '#10b981' : '#3b82f6';
  const accentLight = kind === 'in' ? '#d1fae5' : '#dbeafe';
  const accentDark  = kind === 'in' ? '#065f46' : '#1e3a8a';
  const partyLabel  = kind === 'in' ? 'المورد' : 'المندوب';
  const partyValue  = exportJob?.group ? (kind === 'in' ? exportJob.group.supplier : exportJob.group.rep) : '—';

  // Pad lines array so the table always shows at least 30 rows
  const receiptLines = exportJob?.group?.lines || [];
  const BLANK_ROWS = 30;
  const paddedLines = receiptLines.length >= BLANK_ROWS
    ? receiptLines
    : [...receiptLines, ...Array(BLANK_ROWS - receiptLines.length).fill(null)];

  return (
    <div className="h-full w-full flex flex-col font-['Cairo'] text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">

      {/* ═══════════════════════════════════════════════
          OFF-SCREEN FILLED RECEIPT  (PDF A4 + PNG)
          Hidden far off-screen, rendered on export
      ═══════════════════════════════════════════════ */}
      <div
        ref={receiptRef}
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '794px', minHeight: '1123px',
          background: '#ffffff', color: '#111827',
          fontFamily: 'Cairo, Tahoma, Arial, sans-serif',
          direction: 'rtl', padding: '28px 48px 40px',
          boxSizing: 'border-box',
        }}
      >
        {exportJob && exportJob.mode !== 'blank-png' && (
          <VoucherReceiptTemplate
            kind={kind}
            group={exportJob.group}
            paddedLines={paddedLines}
            accentHex={accentHex}
            accentLight={accentLight}
            accentDark={accentDark}
            partyLabel={partyLabel}
            partyValue={partyValue}
            userName={userName}
            cfg={cfg}
            settings={settings}
          />
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          OFF-SCREEN BLANK RECEIPT  (blank PDF)
      ═══════════════════════════════════════════════ */}
      <div
        ref={blankRef}
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '794px', minHeight: '1123px',
          background: '#ffffff', color: '#111827',
          fontFamily: 'Cairo, Tahoma, Arial, sans-serif',
          direction: 'rtl', padding: '28px 48px 40px',
          boxSizing: 'border-box',
        }}
      >
        {exportJob && exportJob.mode === 'blank-png' && (
          <BlankVoucherTemplate
            kind={kind}
            accentHex={accentHex}
            accentLight={accentLight}
            accentDark={accentDark}
            partyLabel={partyLabel}
            cfg={cfg}
            settings={settings}
          />
        )}
      </div>

      {/* Loading overlay while exporting */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-emerald-500 animate-spin" />
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">جاري إنشاء الملف...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 mb-4 shrink-0 z-20 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div
              className={`w-12 h-12 bg-gradient-to-br ${theme.gradient} rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${theme.shadow}`}
            >
              <Icon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">{settings?.labels?.[kind === 'in' ? 'voucherIn' : 'voucherOut'] || cfg.pageTitle}</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{cfg.pageSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end lg:self-auto">
            {/* Blank Voucher Image Download */}
            <button
              type="button"
              disabled={isExporting}
              onClick={() => triggerExport(null, 'blank-png')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400 hover:shadow-[0_0_16px_rgba(168,85,247,0.35)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ImageIcon size={16} />
              <span>سند فارغ صورة</span>
            </button>

            {!isViewer && (
              <button
                type="button"
                onClick={openModal}
                className={`flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-br ${theme.gradient} text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg ${theme.shadow} ${theme.glow}`}
              >
                <Plus size={18} />
                <span>سند جديد</span>
              </button>
            )}
          </div>
        </div>

        {/* Emergency Auto-Save Recovery Banner */}
        <AnimatePresence>
          {hasUnsavedDraft && !isViewer && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-4 bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-500 rounded-xl p-3 flex items-center justify-between text-amber-700 dark:text-amber-400 overflow-hidden shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="text-sm font-bold">توجد مسودة غير محفوظة (تم استردادها تلقائياً). هل تريد المتابعة؟</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={restoreDraft} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-black rounded-lg hover:bg-amber-600 transition-colors shadow-sm">استعادة التحرير</button>
                <button type="button" onClick={discardDraft} className="px-3 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-500 text-xs font-black rounded-lg transition-colors">إلغاء</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-[1.25rem] border border-slate-200/60 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl p-4 shadow-inner">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className={LabelClass}>
              <span className="inline-flex items-center gap-1">
                <Search size={12} /> بحث (مورد / مندوب / صنف / رقم السند)
              </span>
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="ابحث..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-36">
            <label className={LabelClass}>
              <span className="inline-flex items-center gap-1">
                <CalendarRange size={12} /> من تاريخ
              </span>
            </label>
            <input
              type="date"
              className={inputClass}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-36">
            <label className={LabelClass}>إلى تاريخ</label>
            <input
              type="date"
              className={inputClass}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all hover:shadow-[0_0_16px_rgba(148,163,184,0.35)]"
          >
            <FilterX size={16} />
            إعادة ضبط
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-10 custom-scrollbar min-h-0">
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-[1.5rem] overflow-hidden shadow-inner">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-sm flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">سجل السندات الصورية</h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${theme.badge}`}>
              {filteredGroups.length} / {voucherGroups.length} سند
            </span>
          </div>

          {voucherGroups.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-bold text-sm">
              لا توجد سندات صورية بعد. أنشئ سنداً جديداً من الزر أعلاه.
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-bold text-sm">
              لا توجد نتائج مطابقة للتصفية. جرّب تغيير البحث أو التواريخ.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[700px] text-right text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-black text-xs">
                      <th className="px-3 py-3">رقم السند</th>
                      <th className="px-3 py-3">التاريخ</th>
                      <th className="px-3 py-3">{headerPartyLabel}</th>
                      <th className="px-3 py-3 text-center">الأسطر</th>
                      <th className="px-3 py-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => (
                      <motion.tr
                        key={group.groupId}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-slate-100 dark:border-slate-800/80 bg-white/30 dark:bg-slate-900/20 hover:bg-white/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-3 py-3 font-black text-slate-800 dark:text-slate-100">{group.voucherCode || '—'}</td>
                        <td className="px-3 py-3 font-bold text-slate-600 dark:text-slate-300">{group.date || '—'}</td>
                        <td className="px-3 py-3 font-bold text-slate-700 dark:text-slate-200 max-w-[200px] truncate">
                          {kind === 'in' ? group.supplier || '—' : group.rep || '—'}
                        </td>
                        <td className="px-3 py-3 text-center font-bold">{group.lineCount}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button type="button" title="🖼️ حفظ كصورة" disabled={isExporting}
                              onClick={() => triggerExport(group, 'png')}
                              className={`${actionBtnBase} px-2.5 py-1.5 border-emerald-200 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 disabled:opacity-40 ${glowImg}`}>
                              <ImageIcon size={14} className="ml-1" /> صورة
                            </button>
                            {!isViewer && (
                              <>
                                <button type="button" title="تعديل السند"
                                  onClick={() => openEditGroup(group)}
                                  className={`${actionBtnBase} px-2.5 py-1.5 border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ${glowEdit}`}>
                                  <Pencil size={14} className="ml-1" /> تعديل
                                </button>
                                <button type="button" title="حذف السند"
                                  onClick={() => openDeleteGroup(group)}
                                  className={`${actionBtnBase} px-2.5 py-1.5 border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 ${glowDel}`}>
                                  <Trash2 size={14} className="ml-1" /> حذف
                                </button>
                              </>
                            )}
                            <button type="button"
                              onClick={() => setExpandedGroupId((id) => (id === group.groupId ? null : group.groupId))}
                              className={`${actionBtnBase} px-2.5 py-1.5 border-slate-200 dark:border-slate-600 text-slate-500 ${theme.glow}`}>
                              <ChevronDown size={14} className={`ml-1 transition-transform ${expandedGroupId === group.groupId ? 'rotate-180' : ''}`} />
                              تفاصيل
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/80">
                {filteredGroups.map((group) => (
                  <motion.div
                    key={group.groupId}
                    layout
                    className="p-4 bg-white/40 dark:bg-slate-900/20 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs font-black text-slate-400">رقم السند</p>
                        <p className="font-black text-slate-800 dark:text-white">{group.voucherCode || '—'}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{group.date}</span>
                    </div>
                    <p className="text-sm font-bold">
                      {headerPartyLabel}: {kind === 'in' ? group.supplier || '—' : group.rep || '—'}
                    </p>
                    <p className="text-xs text-slate-500">{group.lineCount} صنف</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={isExporting} onClick={() => triggerExport(group, 'png')} className={`${actionBtnBase} px-3 py-2 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 disabled:opacity-40 ${glowImg}`}>
                        <ImageIcon size={14} className="ml-1" /> صورة
                      </button>
                      {!isViewer && (
                        <>
                          <button type="button" onClick={() => openEditGroup(group)} className={`${actionBtnBase} px-3 py-2 border-blue-200 text-blue-600 ${glowEdit}`}>
                            <Pencil size={14} className="ml-1" /> تعديل
                          </button>
                          <button type="button" onClick={() => openDeleteGroup(group)} className={`${actionBtnBase} px-3 py-2 border-rose-200 text-rose-600 ${glowDel}`}>
                            <Trash2 size={14} className="ml-1" /> حذف
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedGroupId((id) => (id === group.groupId ? null : group.groupId))}
                      className="w-full py-2 text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-600 rounded-xl"
                    >
                      {expandedGroupId === group.groupId ? 'إخفاء التفاصيل' : 'عرض الأسطر'}
                    </button>
                    <AnimatePresence>
                      {expandedGroupId === group.groupId && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0 }} className="overflow-x-auto pt-2">
                          <table className="w-full text-right text-xs border-separate border-spacing-y-1">
                            <thead>
                              <tr className="text-slate-400 font-black">
                                <th className="px-1">م</th>
                                <th>صنف</th>
                                <th>كمية</th>
                                <th>{kind === 'in' ? 'ملاحظة' : 'عهدة'}</th>
                                <th>إجراء</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.lines.map((line, idx) => (
                                <tr key={line.id} className="bg-slate-50/80 dark:bg-slate-800/50 font-bold">
                                  <td className="px-1 py-2 text-center">{idx + 1}</td>
                                  <td className="py-2">{line.item}</td>
                                  <td className="py-2 text-center">{line.qty}</td>
                                  <td className="py-2 text-[10px]">{kind === 'in' ? line.lineSupplyNote || '—' : line.custodyStatus}</td>
                                  <td className="py-2 text-center">
                                    {!isViewer && (
                                     <>
                                      <button type="button" onClick={() => openEdit(line)} className="p-1 text-emerald-500"><Pencil size={12} /></button>
                                      <button type="button" onClick={() => openDelete(line)} className="p-1 text-rose-500"><Trash2 size={12} /></button>
                                     </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>

              {/* Expanded row details (desktop) */}
              {filteredGroups.map(
                (group) =>
                  expandedGroupId === group.groupId && (
                    <motion.div
                      key={`exp-${group.groupId}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hidden md:block border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40 p-3 overflow-x-auto"
                    >
                      <table className="w-full text-right text-sm border-separate border-spacing-y-1 min-w-[640px]">
                        <thead>
                          <tr className="text-slate-400 font-black text-xs">
                            <th className="px-2 py-1">م</th>
                            <th className="px-2 py-1">الصنف</th>
                            <th className="px-2 py-1">الشركة</th>
                            <th className={`px-2 py-1 ${theme.tableHead}`}>الكمية</th>
                            <th className="px-2 py-1">القسم</th>
                            {kind === 'in' ? <th className="px-2 py-1">ملاحظات السطر</th> : <th className="px-2 py-1">حالة العهدة</th>}
                            <th className="px-2 py-1 text-center">سطر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.lines.map((line, idx) => (
                            <tr key={line.id} className="bg-white/60 dark:bg-slate-800/50 font-bold rounded-xl">
                              <td className="px-2 py-2 text-center text-slate-400">{idx + 1}</td>
                              <td className="px-2 py-2">{line.item}</td>
                              <td className="px-2 py-2 text-xs text-slate-500">{line.company}</td>
                              <td className="px-2 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-lg ${theme.qtyBadge}`}>{line.qty}</span>
                              </td>
                              <td className="px-2 py-2 text-center text-xs">{line.cat}</td>
                              <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-300 max-w-[140px] truncate">
                                {kind === 'in' ? line.lineSupplyNote || '—' : line.custodyStatus || '—'}
                              </td>
                              <td className="px-2 py-2 text-center">
                                {!isViewer && (
                                <div className="flex gap-1 justify-center">
                                  <button type="button" onClick={() => openEdit(line)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors">
                                    <Pencil size={14} />
                                  </button>
                                  <button type="button" onClick={() => openDelete(line)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )
              )}
            </>
          )}
        </div>
      </div>

      <ModalWrapper
        title={editingGroupId ? `تعديل السند ${preservedVoucherCode || ''}` : cfg.modalTitle}
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onSubmit={handleBulkSubmit}
        maxWidth="max-w-4xl"
        submitLabel={editingGroupId ? `حفظ التعديلات (${modalDrafts.length} سطر)` : `حفظ السند (${modalDrafts.length} سطر)`}
        loading={loading}
        disableSubmit={modalDrafts.length === 0}
        accent={cfg.accent}
      >
        <div className="flex flex-col space-y-5">
          <div className="grid gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 relative z-20 md:grid-cols-2">
            {cfg.sessionFields.map((f) => (
              <div key={f.key}>
                <label className={LabelClass}>
                  {f.label}
                  {f.required && <span className="text-rose-500"> *</span>}
                </label>
                <div className="relative">
                  <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                  <input
                    type="text"
                    className={`${inputClass} pr-10`}
                    placeholder={f.placeholder}
                    value={session[f.key] || ''}
                    onChange={(e) => setSession((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
            <div>
              <label className={LabelClass}>التاريخ</label>
              <input
                type="date"
                className={inputClass}
                value={session.date}
                onChange={(e) => setSession((s) => ({ ...s, date: e.target.value }))}
                required
              />
            </div>
            {kind === 'in' && (
              <div className="md:col-span-2">
                <label className={LabelClass}>ملاحظات التوريد (عامة للسند)</label>
                <textarea
                  className={`${inputClass} min-h-[72px] resize-y`}
                  placeholder="اختياري — تظهر على كل الأسطر والإيصال"
                  value={session.supplyNotes || ''}
                  onChange={(e) => setSession((s) => ({ ...s, supplyNotes: e.target.value }))}
                  rows={2}
                />
              </div>
            )}
          </div>

          <div className={`rounded-2xl p-4 flex flex-col gap-3 overflow-visible relative z-30 border ${theme.softBg}`}>
            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">إضافة صنف جديد</p>
            <div className="grid grid-cols-12 gap-3 items-end">

              {/* اسم الصنف — 4 cols */}
              <div className="col-span-12 md:col-span-4 relative group/fi">
                <label className={LabelClass}>اسم الصنف</label>
                {selectedItem ? (
                  <div className={`flex items-center justify-between w-full text-sm font-bold rounded-xl px-3 py-2.5 border ${theme.chip}`}>
                    <span className="truncate text-xs">{getItemName(selectedItem)} — {getCompany(selectedItem)}</span>
                    <button type="button" onClick={clearRow} className="shrink-0 opacity-70 hover:opacity-100"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <input
                      ref={itemNameRef}
                      type="text"
                      className={`${inputClass} pr-9 text-sm`}
                      placeholder="ابحث في الأصناف..."
                      value={searchNameText}
                      onChange={(e) => { setSearchNameText(e.target.value); setSearchIdx(-1); }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx((p) => (p < itemSuggestions.length - 1 ? p + 1 : p)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx((p) => (p > 0 ? p - 1 : 0)); }
                        else if (e.key === 'Enter' && searchIdx >= 0 && itemSuggestions[searchIdx]) { e.preventDefault(); handleSelect(itemSuggestions[searchIdx]); }
                      }}
                    />
                  </div>
                )}
                {!selectedItem && searchNameText && itemSuggestions.length > 0 && (
                  <div className="absolute top-full right-0 w-full max-h-48 overflow-y-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 p-1 mt-1">
                    {itemSuggestions.map((s, idx) => (
                      <button key={s.id} type="button"
                        className={`w-full text-right px-3 py-2 border-b border-slate-50 dark:border-slate-700/60 last:border-0 text-sm flex flex-col transition-colors ${
                          searchIdx === idx ? `${theme.softBg} ${theme.tableHead}` : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                        onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}>
                        <span className="font-black text-xs">{getItemName(s)}</span>
                        <span className="text-[10px] opacity-70 font-bold">{getCompany(s)} • {getCategory(s)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* الشركة — 2 cols (readonly) */}
              <div className="col-span-6 md:col-span-2">
                <label className={LabelClass}>الشركة</label>
                <input type="text" readOnly value={selectedItem ? getCompany(selectedItem) : '---'}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-transparent text-slate-500 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed truncate" />
              </div>

              {/* الوحدة — 2 cols (readonly) */}
              <div className="col-span-6 md:col-span-2">
                <label className={LabelClass}>الوحدة</label>
                <input type="text" readOnly value={selectedItem ? getUnit(selectedItem) : 'كرتونة'}
                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-transparent text-slate-500 text-xs font-bold rounded-xl px-3 py-2.5 outline-none cursor-not-allowed text-center" />
              </div>

              {/* الصلاحية  — 2 cols */}
              {kind === 'in' && (
                <div className="col-span-6 md:col-span-2">
                  <label className={LabelClass}>تاريخ الانتهاء <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    className={`${inputClass} text-xs font-bold text-slate-600 dark:text-slate-400`}
                    disabled={!selectedItem}
                    value={draftExpiryDate}
                    onChange={(e) => setDraftExpiryDate(e.target.value)}
                  />
                </div>
              )}

              {/* الكمية — 2 cols */}
              <div className="col-span-6 md:col-span-2">
                <label className={LabelClass}>الكمية <span className="opacity-70">↵</span></label>
                <input
                  id={`voucher-qty-${kind}`}
                  type="number" min="1"
                  disabled={!selectedItem}
                  className={`${inputClass} ${theme.input} font-bold text-center`}
                  placeholder="0"
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pushDraft(); } }}
                />
              </div>

            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[200px] shadow-inner bg-white/90 dark:bg-slate-900/80 backdrop-blur-md">
            <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center backdrop-blur-sm">
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">مراجعة الأسطر</h4>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${theme.badge}`}>
                {modalDrafts.length} سطر
              </span>
            </div>
            <div className="p-2 overflow-y-auto max-h-56">
              {modalDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 font-bold text-sm">
                  <CheckCircle size={28} className="mb-2 opacity-50" />
                  أضف أصنافاً ثم اضغط Enter في الكمية — التركيز يعود لاسم الصنف.
                </div>
              ) : (
                <table className="w-full text-right text-sm border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-slate-400 font-black text-xs text-center">
                      <th className="px-1">م</th>
                      <th className="px-2 text-right">الصنف</th>
                      <th className="px-2 text-right">الشركة</th>
                      <th className="px-2 text-right">الوحدة</th>
                      {kind === 'in' && <th className="px-2 text-center text-orange-500">الصلاحية</th>}
                      <th className={`px-2 ${theme.tableHead}`}>الكمية</th>
                      <th className="px-1">ملاحظة</th>
                      <th className="px-1">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {modalDrafts.map((dr, index) => (
                        <motion.tr
                          key={dr.draftId}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="bg-slate-50 dark:bg-slate-800/40 font-bold"
                        >
                          <td className="px-1 py-2 text-center text-slate-400">{index + 1}</td>
                          <td className="px-2 py-2">{dr.item}</td>
                          <td className="px-2 py-2 text-xs text-slate-500">{dr.company}</td>
                          <td className="px-2 py-2 text-xs text-slate-500 text-center">{dr.unit}</td>
                          {kind === 'in' && (
                             <td className="px-2 py-2 text-center">
                               {dr.expiryDate ? <span className="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{dr.expiryDate}</span> : <span className="text-[10px] text-slate-400">—</span>}
                             </td>
                          )}
                          <td className="px-2 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-lg inline-block ${theme.qtyBadge}`}>{dr.qty}</span>
                          </td>
                          <td className="px-1 py-2 text-[10px] text-slate-500 max-w-[100px] truncate">
                            {dr.lineNote || '—'}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setModalDrafts((p) => p.filter((d) => d.draftId !== dr.draftId))}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper
        title="تعديل سطر السند"
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEditSubmit}
        maxWidth="max-w-md"
        submitLabel="حفظ"
        loading={loading}
        accent={cfg.accent}
      >
        <div className="space-y-4">
          <div>
            <label className={LabelClass}>الكمية</label>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={editForm.qty}
              onChange={(e) => setEditForm((f) => ({ ...f, qty: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={LabelClass}>التاريخ</label>
            <input
              type="date"
              className={inputClass}
              value={editForm.date}
              onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>
        <div>
          <label className={LabelClass}>ملاحظات السطر</label>
          <input
            type="text"
            className={inputClass}
            value={editForm.lineNote}
            onChange={(e) => setEditForm((f) => ({ ...f, lineNote: e.target.value }))}
          />
        </div>
        </div>
      </ModalWrapper>

      <ModalWrapper
        title="حذف سطر"
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onSubmit={handleDeleteSubmit}
        maxWidth="max-w-md"
        submitLabel="نعم، احذف السطر"
        loading={loading}
        accent="rose"
      >
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-3">
            <AlertTriangle size={28} />
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">هل أنت متأكد من حذف هذا السطر؟</p>
        </div>
      </ModalWrapper>

      <ModalWrapper
        title="حذف السند بالكامل"
        isOpen={isDeleteGroupOpen}
        onClose={() => {
          setIsDeleteGroupOpen(false);
          setGroupToDelete(null);
        }}
        onSubmit={handleDeleteGroupSubmit}
        maxWidth="max-w-md"
        submitLabel="نعم، احذف السند كاملاً"
        loading={loading}
        accent="rose"
      >
        <div className="flex flex-col items-center text-center p-2 space-y-2">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-2">
            <AlertTriangle size={28} />
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">هل أنت متأكد؟</p>
          <p className="text-xs text-slate-500">
            سيتم حذف السند <span className="font-black text-slate-800 dark:text-white">{groupToDelete?.voucherCode || ''}</span> وجميع أسطره ({groupToDelete?.lineCount || 0}). لا يؤثر على المخزن.
          </p>
        </div>
      </ModalWrapper>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VOUCHER RECEIPT TEMPLATE — rendered off-screen for html2canvas capture
   Inbound:  م | الصنف والشركة | الكمية | ملاحظات          (emerald)
   Outbound: م | كود الصنف | الصنف والشركة | الكمية | ملاحظات (blue)
   50 rows, column separators, no الوحدة, no إجمالي footer
═══════════════════════════════════════════════════════════════════ */
function VoucherReceiptTemplate({ kind, group, paddedLines, accentHex, accentLight, accentDark, partyLabel, partyValue, userName, settings }) {
  const printDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  const isIn = kind === 'in';
  const showNotes   = settings?.voucherShowNotes   !== false;
  const showCompany = settings?.voucherShowCompany !== false;
  const orgEmoji    = settings?.orgEmoji    || '🌿';
  const orgName     = settings?.orgName     || 'مؤسسة بركة الثمار';
  const orgSubtitle = settings?.orgSubtitle || 'للتجارة والتوزيع الغذائي';
  const orgContact  = settings?.orgContact  || '';

  // Shared cell border style
  const cellBorder = `1px solid #e5e7eb`;
  const thStyle = {
    padding: '8px 6px',
    fontWeight: 900,
    textAlign: 'center',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    borderLeft: cellBorder,
    borderRight: cellBorder,
    color: '#fff',
    background: accentHex,
  };
  const tdBase = {
    padding: '5px 6px',
    borderLeft: cellBorder,
    borderRight: cellBorder,
    borderBottom: cellBorder,
    fontSize: '11px',
  };

  return (
    <div style={{ fontFamily: 'Cairo, Tahoma, Arial, sans-serif', direction: 'rtl', color: '#111827', width: '100%', paddingTop: '8px' }}>

      {/* ── MINIMAL 3-COLUMN HEADER ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '16px', borderBottom: `3px solid ${accentHex}`, paddingBottom: '14px', marginBottom: '16px' }}>
        {/* RIGHT: Branding */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: accentHex, lineHeight: 1.2 }}>{orgEmoji} {orgName}</div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', fontWeight: 700 }}>{orgSubtitle}</div>
        </div>
        {/* CENTER: Bold Title Pill — perfectly centered */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0', background: accentHex, borderRadius: '12px',
          minWidth: '180px', height: '64px',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1, textAlign: 'center' }}>
            {isIn ? 'سند إدخال بضاعة' : 'سند إخراج بضاعة'}
          </div>
        </div>
        {/* LEFT: Meta — increased line-height for breathing room */}
        <div style={{ textAlign: 'left', direction: 'ltr', fontSize: '12px', fontWeight: 700, color: '#374151', lineHeight: 2.4 }}>
          <div>التاريخ: <b style={{ color: accentDark }}>{group?.date || '—'}</b></div>
          <div>{partyLabel}: <b style={{ color: accentDark }}>{partyValue || '—'}</b></div>
          {group?.voucherCode && <div>رقم السند: <b style={{ color: accentDark }}>{group.voucherCode}</b></div>}
        </div>
      </div>

      {/* ── CARGO TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', border: `1px solid #e5e7eb` }}>
        <colgroup>
          <col style={{ width: '32px' }} />
          <col />{/* اسم الصنف — takes all remaining space */}
          <col style={{ width: showNotes ? '64px' : '80px' }} />
          {showNotes && <col style={{ width: '110px' }} />}
        </colgroup>
        <thead>
          <tr style={{ background: accentHex }}>
            <th style={thStyle}>م</th>
            <th style={{ ...thStyle, textAlign: 'right', padding: '9px 12px' }}>اسم الصنف</th>
            <th style={thStyle}>الكمية</th>
            {showNotes && <th style={thStyle}>ملاحظات</th>}
          </tr>
        </thead>
        <tbody>
          {paddedLines.map((line, i) => {
            const rowBg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
            return (
              <tr key={i} style={{ background: rowBg }}>
                <td style={{ ...tdBase, textAlign: 'center', color: '#94a3b8', fontWeight: 800, fontSize: '10px', borderLeft: '1px solid #e5e7eb' }}>{line ? i + 1 : ''}</td>
                <td style={{ ...tdBase, fontWeight: line ? 700 : 400, textAlign: 'right', padding: '6px 12px' }}>
                  {line ? (
                    <>
                      <span style={{ display: 'block', fontWeight: 800, color: '#111827' }}>{line.item}</span>
                      {showCompany && line.company && (
                        <span style={{ display: 'block', fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>{line.company}</span>
                      )}
                    </>
                  ) : null}
                </td>
                <td style={{ ...tdBase, textAlign: 'center', fontWeight: 900, color: accentDark }}>
                  {line?.qty != null ? (
                    <span style={{ background: accentLight, padding: '1px 8px', borderRadius: '5px', display: 'inline-block' }}>
                      {line.qty}
                    </span>
                  ) : null}
                </td>
                {showNotes && (
                  <td style={{ ...tdBase, textAlign: 'center', color: '#374151', fontSize: '10px', borderRight: '1px solid #e5e7eb' }}>
                    {line ? (line.lineNote || line.lineSupplyNote || '') : ''}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── TWO SIGNATURE BOXES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '22px', paddingTop: '20px', borderTop: `1px dashed ${accentHex}` }}>
        <SigBox label="أمين المستودع" accentHex={accentHex} />
        <SigBox label="المستلم" accentHex={accentHex} />
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: '16px', fontSize: '8.5px', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>طُبع بواسطة: {userName} — {printDate}</span>
        <span style={{ color: accentHex, fontWeight: 700 }}>
          نظام بركة الثمار الإلكتروني {orgContact && `— ${orgContact}`}
        </span>
        <span>للأرشيفة الداخلية</span>
      </div>
    </div>
  );
}

function SigBox({ label, accentHex }) {
  return (
    <div style={{ textAlign: 'center', border: `1.5px solid ${accentHex}40`, borderRadius: '12px', padding: '14px 20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 900, color: '#374151', marginBottom: '10px' }}>{label}</div>
      <div style={{ height: '52px', borderBottom: '1.5px solid #cbd5e1' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BLANK VOUCHER TEMPLATE — 30-row A4-optimised empty cargo list
   In:  م | الصنف والشركة (wide) | الكمية | ملاحظات
   Out: م | كود الصنف | الصنف والشركة | الكمية | ملاحظات
═══════════════════════════════════════════════════════════════════ */
function BlankVoucherTemplate({ kind, accentHex, accentLight, accentDark, partyLabel, settings }) {
  const ROWS = 30;
  const isIn = kind === 'in';
  const showNotes   = settings?.voucherShowNotes   !== false;
  const orgEmoji    = settings?.orgEmoji    || '🌿';
  const orgName     = settings?.orgName     || 'مؤسسة بركة الثمار';
  const orgSubtitle = settings?.orgSubtitle || 'للتجارة والتوزيع الغذائي';
  const orgContact  = settings?.orgContact  || '';

  const cellBorder = `1px solid #e5e7eb`;
  const thStyle = {
    padding: '6px 5px',
    fontWeight: 900,
    textAlign: 'center',
    fontSize: '10px',
    whiteSpace: 'nowrap',
    borderLeft: cellBorder,
    borderRight: cellBorder,
    color: '#fff',
    background: accentHex,
  };
  const tdBase = {
    padding: '4px 5px',
    borderLeft: cellBorder,
    borderRight: cellBorder,
    borderBottom: cellBorder,
    fontSize: '10.5px',
    height: '22px',
  };

  return (
    <div style={{ fontFamily: 'Cairo, Tahoma, Arial, sans-serif', direction: 'rtl', color: '#111827', width: '100%', paddingTop: '8px' }}>

      {/* ── COMPACT 3-COL HEADER ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '16px', borderBottom: `3px solid ${accentHex}`, paddingBottom: '12px', marginBottom: '14px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: accentHex, lineHeight: 1.2 }}>{orgEmoji} {orgName}</div>
          <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '4px', fontWeight: 700 }}>{orgSubtitle}</div>
        </div>
        {/* CENTER: Title box with fixed height for perfect centering */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0', background: accentHex, borderRadius: '10px',
          minWidth: '160px', height: '58px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1, textAlign: 'center' }}>
            {isIn ? 'إذن استلام بضاعة' : 'إذن صرف بضاعة'}
          </div>
        </div>
        {/* LEFT: Meta with generous line-height */}
        <div style={{ textAlign: 'left', direction: 'ltr', fontSize: '11px', fontWeight: 700, color: '#374151', lineHeight: 2.5 }}>
          <div>التاريخ: _______________________</div>
          <div>{partyLabel}: _____________________</div>
        </div>
      </div>

      {/* ── BLANK CARGO TABLE (30 rows) ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', tableLayout: 'fixed', border: `1px solid #e5e7eb` }}>
        <colgroup>
          <col style={{ width: '28px' }} />
          <col />
          <col style={{ width: showNotes ? '58px' : '80px' }} />
          {showNotes && <col style={{ width: '100px' }} />}
        </colgroup>
        <thead>
          <tr style={{ background: accentHex }}>
            <th style={thStyle}>م</th>
            <th style={{ ...thStyle, textAlign: 'right', padding: '7px 10px' }}>اسم الصنف</th>
            <th style={thStyle}>الكمية</th>
            {showNotes && <th style={thStyle}>ملاحظات</th>}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS }).map((_, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
              <td style={{ ...tdBase, textAlign: 'center', color: (i + 1) % 10 === 0 ? accentDark : '#94a3b8', fontWeight: 800, fontSize: '9.5px', borderLeft: '1px solid #e5e7eb' }}>{i + 1}</td>
              <td style={tdBase} />
              <td style={showNotes ? tdBase : { ...tdBase, borderRight: '1px solid #e5e7eb' }} />
              {showNotes && <td style={{ ...tdBase, borderRight: '1px solid #e5e7eb' }} />}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── SIGNATURE BOXES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '16px', paddingTop: '14px', borderTop: `1px dashed ${accentHex}` }}>
        <SigBox label="أمين المستودع" accentHex={accentHex} />
        <SigBox label="المستلم" accentHex={accentHex} />
      </div>

      <div style={{ marginTop: '12px', fontSize: '7.5px', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: accentHex, fontWeight: 700 }}>
          نظام بركة الثمار الإلكتروني {orgContact && `— ${orgContact}`}
        </span>
        <span>للأرشيفة الداخلية</span>
      </div>
    </div>
  );
}
