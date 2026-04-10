import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Pencil, Trash2, FileText, Image, 
  Snowflake, Package, Archive, Box, AlertTriangle, 
  Download, ChevronDown, Flame, Thermometer, Eye, Timer,
  CalendarDays, Truck, PackageX, LayoutGrid, Keyboard,
  CheckCircle2, CornerDownLeft, Save, Trash, RotateCcw
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
  'مجمدات': <Snowflake size={18} className="text-primary dark:text-accent-light" />,
  'بلاستيك': <Archive size={18} className="text-status-warning" />,
  'تبريد': <Thermometer size={18} className="text-primary dark:text-accent-light" />
};

const getCatIcon = (catName) => {
  return categoryIcons[catName] || <Package size={18} className="text-text-muted-light" />;
};

// --- SHARED MODAL COMPONENT (kept for Edit/Delete) ---
const ModalWrapper = ({ title, isOpen, onClose, children, onSubmit, maxWidth = "max-w-md", submitLabel = "حفظ واعتماد" }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-all duration-500" 
        dir="rtl" onClick={onClose} 
      >
        <motion.div 
          onClick={(e) => e.stopPropagation()} 
          initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} 
          transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
          className={`w-full ${maxWidth} bg-white dark:bg-surface-dark rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-border-light dark:border-border-dark flex flex-col overflow-hidden`}
        >
          <div className="flex items-center justify-between p-8 border-b border-border-light dark:border-border-dark bg-slate-50/30 dark:bg-slate-800/30 shrink-0">
            <h3 className="text-2xl font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark tracking-tight">{title}</h3>
            <button type="button" onClick={onClose} className="p-2.5 text-text-muted-light hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-text-primary-light dark:hover:text-white rounded-2xl transition-all active:scale-90">
              <X size={22} />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col">
            <div className="p-8 overflow-y-auto custom-scrollbar">{children}</div>
            <div className="p-8 border-t border-border-light dark:border-border-dark bg-slate-50/30 dark:bg-slate-800/30 flex space-x-4 space-x-reverse justify-end shrink-0">
                <button type="button" onClick={onClose} className="btn-outline px-6 py-3">إلغاء</button>
                <button type="submit" className="btn-primary px-8 py-3 shadow-primary/30">{submitLabel}</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─────────────────────────────────────────────────────────────────────────────
// BULK ADD MODAL — keyboard-first, data-grid entry for 100+ items/day
// ─────────────────────────────────────────────────────────────────────────────
const CATS = ['مجمدات', 'بلاستيك', 'تبريد'];
const UNITS = ['كرتونة', 'قطعة', 'كيلو', 'لتر', 'طرد', 'علبة'];
const COLS = ['name', 'company', 'cat', 'unit'];
const COL_COUNT = COLS.length;

const emptyRow = () => ({ name: '', company: '', cat: 'مجمدات', unit: 'كرتونة', _id: Math.random() });

function BulkAddModal({ isOpen, onClose, onSaveAll, existingItems, uniqueCompanies }) {
  const [rows, setRows]           = useState([emptyRow()]);
  const [saving, setSaving]       = useState(false);
  const [discardDlg, setDiscardDlg] = useState(false);
  const [customUnit, setCustomUnit] = useState({});
  const cellRefs = useRef({});

  // reset when the modal opens
  useEffect(() => {
    if (isOpen) {
      setRows([emptyRow()]);
      setSaving(false);
      setDiscardDlg(false);
      setCustomUnit({});
    }
  }, [isOpen]);

  // focus first cell on open
  useEffect(() => {
    if (isOpen && rows.length > 0) {
      setTimeout(() => {
        const key = `${rows[0]._id}-0`;
        cellRefs.current[key]?.focus();
      }, 80);
    }
  }, [isOpen]);

  const hasUnsaved = rows.some(r => r.name.trim() !== '');

  // ── close guard ──
  const handleClose = useCallback(() => {
    if (hasUnsaved) { setDiscardDlg(true); return; }
    onClose();
  }, [hasUnsaved, onClose]);

  // ── Esc key on the modal backdrop ──
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // ── field update ──
  const updateCell = (rowId, field, value) => {
    setRows(prev => prev.map(r => r._id === rowId ? { ...r, [field]: value } : r));
  };

  // ── add new row ──
  const addRow = (focusColIdx = 0) => {
    const nr = emptyRow();
    setRows(prev => [...prev, nr]);
    setTimeout(() => {
      const key = `${nr._id}-${focusColIdx}`;
      cellRefs.current[key]?.focus();
    }, 30);
  };

  // ── delete row ──
  const deleteRow = (rowId) => {
    setRows(prev => prev.length === 1 ? [emptyRow()] : prev.filter(r => r._id !== rowId));
  };

  // ── keyboard navigation inside a cell ──
  const handleCellKey = (e, rowIdx, colIdx, row) => {
    // Enter → commit row, move to next row same column / add row
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        addRow(colIdx);
      } else {
        const nextRow = rows[rowIdx + 1];
        const key = `${nextRow._id}-${colIdx}`;
        cellRefs.current[key]?.focus();
      }
      return;
    }
    // Tab → next cell, wrap to new row at end
    if (e.key === 'Tab' && !e.shiftKey) {
      if (colIdx === COL_COUNT - 1) {
        e.preventDefault();
        if (rowIdx === rows.length - 1) addRow(0);
        else {
          const nextRow = rows[rowIdx + 1];
          const key = `${nextRow._id}-0`;
          cellRefs.current[key]?.focus();
        }
      }
    }
  };

  // ── save all non-empty rows ──
  const handleSaveAll = async () => {
    const valid = rows.filter(r => r.name.trim());
    if (!valid.length) { toast.error('أدخل اسم صنف واحد على الأقل'); return; }
    setSaving(true);
    try {
      await onSaveAll(valid);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const validCount = rows.filter(r => r.name.trim()).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          dir="rtl"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 32 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.4)] border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-l from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-900">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <LayoutGrid size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black font-tajawal text-slate-800 dark:text-white tracking-tight">إدخال أصناف جديدة</h2>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">أدخل بيانات الصنف في كل صف • Enter للانتقال • Tab للتنقل بين الحقول</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {validCount > 0 && (
                  <span className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-black px-3 py-1.5 rounded-full">
                    <CheckCircle2 size={13} />
                    {validCount} صنف جاهز
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ── Keyboard hints bar ── */}
            <div className="shrink-0 flex items-center gap-6 px-8 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              {[
                { icon: <CornerDownLeft size={11} />, label: 'Enter — صف جديد' },
                { icon: <Keyboard size={11} />, label: 'Tab — الحقل التالي' },
                { icon: <X size={11} />, label: 'Esc — إغلاق' },
              ].map((hint, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <span className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-1.5 py-0.5 text-slate-500 dark:text-slate-300 shadow-sm">{hint.icon}</span>
                  {hint.label}
                </span>
              ))}
            </div>

            {/* ── Grid Table ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full table-fixed border-collapse" style={{ borderSpacing: 0 }}>
                <colgroup>
                  <col style={{ width: '3rem' }} />
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '3.5rem' }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-none">#</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-none">
                      اسم الصنف <span className="text-rose-500">*</span>
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-none">الشركة المنتجة</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-none">القسم</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-none">وحدة القياس</th>
                    <th className="px-4 py-3 border-none"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const isDuplicate = row.name.trim() && existingItems.some(
                      i => i.name.trim().toLowerCase() === row.name.trim().toLowerCase()
                        && (i.company || '') .trim().toLowerCase() === row.company.trim().toLowerCase()
                    );
                    const hasDuplicateInGrid = row.name.trim() && rows.some(
                      (r, ri) => ri !== rowIdx && r.name.trim().toLowerCase() === row.name.trim().toLowerCase()
                        && r.company.trim().toLowerCase() === row.company.trim().toLowerCase()
                    );
                    const hasError = isDuplicate || hasDuplicateInGrid;

                    return (
                      <tr
                        key={row._id}
                        className={`group border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-150 ${
                          hasError
                            ? 'bg-rose-50/60 dark:bg-rose-500/5'
                            : row.name.trim()
                            ? 'bg-emerald-50/30 dark:bg-emerald-500/5'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Row number */}
                        <td className="px-3 py-2 text-center border-none">
                          <span className={`text-[11px] font-black tabular-nums ${
                            hasError ? 'text-rose-400' : row.name.trim() ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'
                          }`}>{rowIdx + 1}</span>
                        </td>

                        {/* Name */}
                        <td className="px-2 py-1.5 border-none">
                          <div className="relative">
                            <input
                              ref={el => { cellRefs.current[`${row._id}-0`] = el; }}
                              type="text"
                              placeholder="اسم الصنف..."
                              value={row.name}
                              onChange={e => updateCell(row._id, 'name', e.target.value)}
                              onKeyDown={e => handleCellKey(e, rowIdx, 0, row)}
                              className={`w-full text-sm font-bold rounded-xl px-3 py-2.5 outline-none transition-all border ${
                                hasError
                                  ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 placeholder:text-rose-300'
                                  : 'bg-slate-100/60 dark:bg-slate-800/60 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600'
                              }`}
                            />
                            {hasError && (
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-rose-500 bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                {isDuplicate ? 'موجود' : 'مكرر'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Company */}
                        <td className="px-2 py-1.5 border-none">
                          <input
                            ref={el => { cellRefs.current[`${row._id}-1`] = el; }}
                            type="text"
                            list={`companies-${row._id}`}
                            placeholder="الشركة..."
                            value={row.company}
                            onChange={e => updateCell(row._id, 'company', e.target.value)}
                            onKeyDown={e => handleCellKey(e, rowIdx, 1, row)}
                            className="w-full text-sm font-bold rounded-xl px-3 py-2.5 outline-none bg-slate-100/60 dark:bg-slate-800/60 border border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                          />
                          <datalist id={`companies-${row._id}`}>
                            {uniqueCompanies.map((c, i) => <option key={i} value={c} />)}
                          </datalist>
                        </td>

                        {/* Category */}
                        <td className="px-2 py-1.5 border-none">
                          <select
                            ref={el => { cellRefs.current[`${row._id}-2`] = el; }}
                            value={row.cat}
                            onChange={e => updateCell(row._id, 'cat', e.target.value)}
                            onKeyDown={e => handleCellKey(e, rowIdx, 2, row)}
                            className="w-full text-sm font-bold rounded-xl px-3 py-2.5 outline-none bg-slate-100/60 dark:bg-slate-800/60 border border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 dark:text-white appearance-none cursor-pointer"
                          >
                            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>

                        {/* Unit */}
                        <td className="px-2 py-1.5 border-none">
                          {customUnit[row._id] ? (
                            <input
                              ref={el => { cellRefs.current[`${row._id}-3`] = el; }}
                              type="text"
                              placeholder="وحدة مخصصة..."
                              value={row.unit}
                              onChange={e => updateCell(row._id, 'unit', e.target.value)}
                              onKeyDown={e => handleCellKey(e, rowIdx, 3, row)}
                              className="w-full text-sm font-bold rounded-xl px-3 py-2.5 outline-none bg-slate-100/60 dark:bg-slate-800/60 border border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 dark:text-white"
                            />
                          ) : (
                            <div className="flex gap-1">
                              <select
                                ref={el => { cellRefs.current[`${row._id}-3`] = el; }}
                                value={UNITS.includes(row.unit) ? row.unit : 'كرتونة'}
                                onChange={e => updateCell(row._id, 'unit', e.target.value)}
                                onKeyDown={e => handleCellKey(e, rowIdx, 3, row)}
                                className="flex-1 text-sm font-bold rounded-xl px-3 py-2.5 outline-none bg-slate-100/60 dark:bg-slate-800/60 border border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 dark:text-white appearance-none cursor-pointer"
                              >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => setCustomUnit(p => ({ ...p, [row._id]: true }))}
                                title="وحدة مخصصة"
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all text-[10px] font-black border border-transparent shrink-0"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Delete row */}
                        <td className="px-2 py-1.5 text-center border-none">
                          <button
                            type="button"
                            onClick={() => deleteRow(row._id)}
                            className="p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add row placeholder */}
                  <tr className="border-none">
                    <td colSpan={6} className="px-4 py-3 border-none">
                      <button
                        type="button"
                        onClick={() => addRow(0)}
                        className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-primary dark:hover:text-primary-light transition-colors group/add"
                      >
                        <span className="w-7 h-7 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover/add:border-primary/50 group-hover/add:text-primary transition-all">
                          <Plus size={14} />
                        </span>
                        <span className="group-hover/add:translate-x-[-2px] transition-transform">إضافة صف جديد</span>
                        <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 text-[9px] font-black text-slate-400">Enter</kbd>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-slate-400">
                  {rows.length} صف • {validCount} صنف صالح للحفظ
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows([emptyRow()])}
                    className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <RotateCcw size={11} /> تفريغ الكل
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-outline px-6 py-3 text-sm"
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving || validCount === 0}
                  className="flex items-center gap-2.5 btn-primary px-8 py-3 text-sm shadow-primary/20 disabled:opacity-50"
                >
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />جاري الحفظ...</>
                  ) : (
                    <><Save size={16} />حفظ {validCount > 0 ? validCount : ''} صنف</>
                  )}
                </button>
              </div>
            </div>

            {/* ── Discard confirmation dialog ── */}
            <AnimatePresence>
              {discardDlg && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-[2rem]"
                  onClick={e => e.stopPropagation()}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25 }}
                    className="bg-white dark:bg-slate-800 rounded-[1.5rem] shadow-2xl p-8 max-w-sm w-full mx-4 border border-slate-200 dark:border-slate-700"
                    dir="rtl"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                      <AlertTriangle size={28} className="text-amber-500" />
                    </div>
                    <h4 className="text-lg font-black font-tajawal text-slate-800 dark:text-white text-center mb-2">هل تريد حفظ البيانات؟</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-7 leading-relaxed">
                      لديك <span className="font-black text-slate-700 dark:text-slate-200">{validCount}</span> صنف غير محفوظ. ماذا تريد أن تفعل؟
                    </p>
                    <div className="flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => { setDiscardDlg(false); handleSaveAll(); }}
                        className="w-full flex items-center justify-center gap-2 btn-primary py-3.5 text-sm"
                      >
                        <Save size={16} /> حفظ الأصناف ومتابعة
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDiscardDlg(false); onClose(); }}
                        className="w-full py-3.5 rounded-2xl text-sm font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 transition-all"
                      >
                        تجاهل والخروج
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscardDlg(false)}
                        className="w-full py-3 rounded-2xl text-sm font-black text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                      >
                        إلغاء والعودة للإدخال
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const InputClass = "w-full bg-slate-100/50 dark:bg-slate-900/40 border border-transparent text-text-primary-light dark:text-text-primary-dark text-sm rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-primary/5 focus:border-primary/20 block px-5 py-4 outline-none transition-all duration-300 placeholder:text-text-muted-light/40";
const LabelClass = "block text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-2.5 mr-1 uppercase tracking-wider transition-colors duration-300";

export default function Items() {
  const { playSuccess, playWarning } = useAudio();
  const { isDarkMode } = useTheme();
  const { currentUser, isViewer } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [companyFilter, setCompanyFilter] = useState('الكل');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
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
      return matchSearch && matchCat && matchComp;
    });
    return result;
  }, [items, searchQuery, categoryFilter, companyFilter]);

  const totalItemsCount = filteredItems.length;

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

  // ── Bulk add handler (called by BulkAddModal) ──
  const handleBulkSaveAll = useCallback(async (validRows) => {
    let added = 0;
    let skipped = 0;
    for (const row of validRows) {
      const rawName    = row.name.trim();
      const rawCompany = row.company.trim() || 'بدون شركة';
      const normName    = normalizeText(rawName);
      const normCompany = normalizeText(rawCompany);
      const isDup = items.some(
        i => normalizeText(i.name) === normName && normalizeText(i.company || 'بدون شركة') === normCompany
      );
      if (isDup) { skipped++; continue; }
      await addDoc(collection(db, 'items'), {
        name: rawName,
        company: rawCompany,
        cat: row.cat,
        unit: row.unit,
        stockQty: 0,
        searchKey: `${rawName} ${rawCompany}`.toLowerCase(),
        createdAt: serverTimestamp()
      });
      added++;
    }
    if (added > 0) { toast.success(`✅ تمت إضافة ${added} صنف بنجاح!`); playSuccess(); }
    if (skipped > 0) toast.warning(`⚠️ تم تخطي ${skipped} صنف مكرر.`);
    setIsBulkAddOpen(false);
  }, [items, playSuccess]);

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
    <div className="flex-1 flex flex-col min-h-0 gap-2 font-readex h-full overflow-hidden" dir="rtl">

      {/* ═══ COMPACT TOP BAR — title + filters + actions on one line ═══ */}
      <div className="shrink-0 flex items-center gap-3 flex-wrap">

        {/* Title + badges */}
        <div className="flex items-center gap-2.5 shrink-0">
          <h1 className="text-2xl font-black font-tajawal tracking-tight text-slate-900 dark:text-white leading-none">
            دليل الأصناف
          </h1>
          <span className="rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[11px] font-black dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 tabular-nums">
            {Object.keys(groupedItems).length} قسم
          </span>
          <span className="rounded-full bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 text-[11px] font-black dark:bg-primary/10 tabular-nums flex items-center gap-1">
            <Package size={11} />{totalItemsCount}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text" dir="rtl"
            placeholder="ابحث عن صنف أو شركة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-bold rounded-xl pr-9 pl-3 py-2 outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-sm"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all appearance-none cursor-pointer shadow-sm"
        >
          <option>الكل</option><option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
        </select>

        {/* Company filter */}
        <select
          value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all appearance-none cursor-pointer shadow-sm max-w-[160px] truncate"
        >
          {dynamicCompanies.map(c => <option key={c}>{c}</option>)}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export button */}
        <div className="relative">
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-black rounded-xl px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Download size={15} />
            <span>تصدير</span>
            <ChevronDown size={12} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {isExportMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-[calc(100%+6px)] z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-[160px]"
              >
                <button onClick={handleExportPDF} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-right">
                  <FileText size={15} className="text-slate-400" /> PDF
                </button>
                <button onClick={handleExportPNG} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-right border-t border-slate-100 dark:border-slate-700">
                  <Image size={15} className="text-slate-400" /> PNG / طباعة
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Primary CTA */}
        {!isViewer && (
          <button
            onClick={() => setIsBulkAddOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm shadow-primary/20 shrink-0"
          >
            <LayoutGrid size={16} />
            <span>+ أضف صنف</span>
          </button>
        )}
      </div>

      {/* Directory Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10" id="printable-directory">
        {Object.keys(groupedItems).length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-gradient-to-br from-slate-50 via-slate-100 to-white rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-100 text-slate-400 shadow-inner mb-6">
                <Package size={44} />
              </div>
              <h3 className="text-2xl font-black font-tajawal text-slate-900 mb-2">لا توجد نتائج</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md">
                قم بتعديل البحث أو الفلاتر لعرض الأصناف المناسبة. إذا كان الكتالوج فارغاً، ابدأ بإضافة صنف جديد الآن.
              </p>
              {!isViewer && (
                <button onClick={() => setIsBulkAddOpen(true)} className="btn-primary px-8 py-3 shadow-primary/20 flex items-center gap-2">
                  <LayoutGrid size={16} /> أضف أول صنف
                </button>
              )}
           </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10">
            {Object.keys(groupedItems).sort().map(cat => (
              <div key={cat} className="space-y-6">
                <div className="flex items-center gap-4 sticky top-0 z-10 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md py-3 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-dark shadow-sm border border-border-light dark:border-border-dark flex items-center justify-center text-primary dark:text-accent-light">
                    {getCatIcon(cat)}
                  </div>
                  <h3 className="text-xl font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark">قسم {cat}</h3>
                  <div className="flex-1 h-px bg-border-light dark:border-border-dark"></div>
                  <span className="text-[10px] font-bold text-text-muted-light uppercase tracking-widest bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark">{groupedItems[cat].length} صنف</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {groupedItems[cat].map(item => {
                    const expInfo = getExpiryInfo(item.id);
                    const daysLeft = expInfo?.daysLeft ?? null;
                    const thresholds = getExpiryThresholds(item.cat);
                    const isExpired = daysLeft !== null && daysLeft <= 0;
                    const isUrgent  = daysLeft !== null && daysLeft > 0  && daysLeft <= thresholds.red;
                    const isWarning = daysLeft !== null && daysLeft > thresholds.red && daysLeft <= thresholds.orange;
                    const isDead = deadStockSet.has(item.id);
                    const storageIcon = item.cat === 'مجمدات' ? <Snowflake size={12} className="text-primary dark:text-accent-light" /> : item.cat === 'تبريد' ? <Thermometer size={12} className="text-primary dark:text-accent-light" /> : null;
                    
                    return (
                      <motion.div
                        key={item.id} variants={cardVariants}
                        className={`bg-white rounded-[1.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:border-primary/20 group flex flex-col p-6 relative overflow-hidden transition-all duration-500 ${isExpired || isUrgent ? 'border-status-danger/40 bg-rose-50/10' : isWarning ? 'border-status-warning/40 bg-amber-50/10' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-3 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-primary/5 transition-colors">
                              {storageIcon}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{item.company || 'بدون شركة'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDead && (
                              <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase border border-slate-200">راكد</span>
                            )}
                            {expInfo && (
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1.5 shadow-sm ${
                                isExpired ? 'bg-status-danger text-white border-status-danger animate-pulse'
                                : isUrgent ? 'bg-rose-50 text-status-danger border-rose-200'
                                : isWarning ? 'bg-amber-50 text-status-warning border-amber-200'
                                : 'bg-emerald-50 text-status-success border-emerald-200'
                              }`}>
                                <Timer size={10} />
                                {isExpired ? 'منتهي' : `${daysLeft} يوم`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 mb-6">
                          <h4 className="text-lg font-bold text-slate-800 truncate leading-tight group-hover:text-primary transition-colors tracking-tight">{item.name}</h4>
                          {(hotItemsMap[item.id] || 0) >= 10 && (
                            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl animate-bounce" title={`🔥 ${hotItemsMap[item.id]} صادر مؤخراً`}>
                              <Flame size={16} />
                            </div>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3 pt-5 border-t border-slate-100">
                          <div className={`px-4 py-1.5 rounded-xl text-sm font-black border transition-all duration-300 shadow-sm ${ (item.stockQty || 0) <= 0 ? 'bg-rose-50 text-status-danger border-rose-100' : 'bg-slate-50 text-slate-700 border-slate-100 group-hover:bg-primary group-hover:text-white group-hover:border-primary' }`}>
                            {item.stockQty ?? 0} <span className="text-[10px] font-bold opacity-60 ml-0.5">{item.unit}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            {expInfo && (
                              <button onClick={() => setBatchEyeItem(item)} className="p-2.5 bg-white text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-sm hover:shadow-md active:scale-90"><Eye size={16} /></button>
                            )}
                            {!isViewer && (
                              <>
                                <button onClick={() => openEditModal(item)} className="p-2.5 bg-white text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 shadow-sm hover:shadow-md active:scale-90"><Pencil size={16} /></button>
                                <button onClick={() => openDeleteModal(item)} className="p-2.5 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 shadow-sm hover:shadow-md active:scale-90"><Trash2 size={16} /></button>
                                <label className="p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center">
                                  <input type="checkbox" checked={selectedForDelete.includes(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 rounded-lg text-primary border-slate-300 focus:ring-primary/20 transition-all" />
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Interactive accent bar */}
                        <div className="absolute bottom-0 right-0 w-0 h-1.5 bg-primary group-hover:w-full transition-all duration-700 ease-out"></div>
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

      {/* BULK ADD MODAL */}
      <BulkAddModal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        onSaveAll={handleBulkSaveAll}
        existingItems={items}
        uniqueCompanies={uniqueCompanies}
      />

      {/* EDIT MODAL (single item) */}
      <ModalWrapper 
        title="تحديث بيانات الصنف"
        isOpen={isEditModalOpen} 
        onClose={() => { setIsEditModalOpen(false); }} 
        onSubmit={handleEditSubmit}
      >
        <div className="space-y-6 relative">
          <div className="relative group/nameItem">
            <label className={LabelClass}>اسم الصنف <span className="text-status-danger">*</span></label>
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
              <div className="hidden group-focus-within/nameItem:block absolute top-[100%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark z-30 p-1 mt-1">
                {itemSuggestions.map((suggestion, idx) => (
                  <button key={idx} type="button" className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors text-sm font-bold ${nameSearchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onMouseDown={(e) => { e.preventDefault(); setFormState({...formState, name: suggestion}); setNameSearchActiveIndex(-1); }}>
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
              <div className="hidden group-focus-within/compItem:block absolute top-[100%] right-0 w-full max-h-40 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-border-light dark:border-border-dark z-30 p-1 mt-1">
                {companySuggestions.map((suggestion, idx) => (
                  <button key={idx} type="button" className={`w-full text-right px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-0 transition-colors text-sm font-bold ${companySearchActiveIndex === idx ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} onMouseDown={(e) => { e.preventDefault(); setFormState({...formState, company: suggestion}); setCompanySearchActiveIndex(-1); }}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div>
              <label className={LabelClass}>المجموعة (القسم)</label>
              <select className={InputClass} value={formState.cat} onChange={e => setFormState({...formState, cat: e.target.value})}>
                <option>مجمدات</option><option>بلاستيك</option><option>تبريد</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">وحدة القياس</label>
                <button type="button" onClick={() => { setIsCustomUnit(!isCustomUnit); setFormState({...formState, unit: (!isCustomUnit) ? '' : 'كرتونة'}); }} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-primary dark:text-accent-light px-2 py-1 rounded-lg font-bold hover:bg-primary/10 transition-all flex items-center shadow-sm">
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
           <div className="w-16 h-16 bg-status-danger/10 rounded-full flex items-center justify-center text-status-danger mb-4 animate-pulse">
              <AlertTriangle size={32} />
           </div>
           <h4 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark mb-2">هل أنت متأكد من حذف هذا الصنف؟</h4>
           <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
             سيتم حذف <span className="text-status-danger font-bold">{selectedItem?.name}</span> من قائمة الأصناف بشكل نهائي. 
           </p>
           <div className="bg-status-danger/5 text-status-danger text-[10px] font-bold px-4 py-2 rounded-xl border border-status-danger/10">
             هذا الإجراء لا يمكن التراجع عنه.
           </div>
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
           <div className="w-16 h-16 bg-status-danger/10 rounded-full flex items-center justify-center text-status-danger mb-4 animate-pulse">
              <AlertTriangle size={32} />
           </div>
           <h4 className="text-lg font-bold font-tajawal text-text-primary-light dark:text-text-primary-dark mb-2">هل أنت متأكد من حذف هذه الأصناف؟</h4>
           <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
             سيتم حذف <span className="text-status-danger font-bold">{selectedForDelete.length}</span> أصناف محددة من قائمة المخزن بشكل نهائي. 
           </p>
           <div className="bg-status-danger/5 text-status-danger text-[10px] font-bold px-4 py-2 rounded-xl border border-status-danger/10">
             لا يمكن التراجع عن هذا الإجراء وسيتم إجراء فحص الأرصدة أولاً.
           </div>
        </div>
      </ModalWrapper>

    </div>
  );
}
