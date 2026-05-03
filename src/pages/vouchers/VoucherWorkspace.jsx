import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Pencil, Trash2, Package, Box,
  AlertTriangle, CheckCircle, User, Truck, ChevronDown, Printer,
  Image as ImageIcon, FilterX, CalendarRange, Calendar, Download, Upload, FileText, LogOut, Paperclip, Hash,
  UploadCloud, Settings, Info, RefreshCw, History
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getItemName, getCompany, getCategory, getUnit } from '../../lib/itemFields';
import { toast } from 'sonner';
import { useAudio } from '../../contexts/AudioContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { normalizeArabic } from '../../lib/arabicTextUtils';
import html2canvas from 'html2canvas';

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/** @typedef {'in' | 'outward'} VoucherKind */



const KIND_CONFIG = {
  outward: {
    txType: 'سند إخراج',
    codePrefix: '',
    counterKey: 'out',
    pageTitle: 'سند إخراج بضاعة',
    pageSubtitle: 'إثبات خروج بضاعة (عهدة مندوب) بدون فاتورة مبيعات.',
    modalTitle: 'سند إخراج بضاعة',
    accent: 'blue',
    Icon: Upload,
    sessionFields: [{ key: 'rep', label: 'اسم المستفيد', required: true, placeholder: 'مثال: أحمد محمد' }],
    pdfTitle: 'إيصال عهدة — سند إخراج',
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
      input: '!border-emerald-500/50 focus:!ring-emerald-500/30 text-emerald-700',
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/25',
      badge: 'bg-emerald-50 border-emerald-100 text-emerald-600',
      softBg: 'bg-emerald-50/50 border-emerald-200/60',
      chip: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      tableHead: 'text-emerald-500',
      qtyBadge: 'bg-emerald-100 text-emerald-700',
      pdfRgb: [16, 185, 129],
      glow: 'hover:shadow-[0_0_22px_rgba(16,185,129,0.5)]',
      glowBlue: 'hover:shadow-[0_0_18px_rgba(16,185,129,0.45)]',
    };
  }
  return {
    ring: 'focus:ring-blue-500/20 focus:border-blue-500',
    input: '!border-blue-500/50 focus:!ring-blue-500/30 text-blue-700',
    gradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-blue-500/25',
    badge: 'bg-blue-50 border-blue-100 text-blue-600',
    softBg: 'bg-blue-50/50 border-blue-200/60',
    chip: 'bg-blue-50 border-blue-200 text-blue-700',
    tableHead: 'text-blue-500',
    qtyBadge: 'bg-blue-100 text-blue-700',
    pdfRgb: [59, 130, 246],
    glow: 'hover:shadow-[0_0_22px_rgba(59,130,246,0.5)]',
    glowBlue: 'hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]',
  };
}

const baseInput =
  'w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white text-sm font-bold rounded-xl block px-4 py-2 outline-none transition-all focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/5 focus:border-primary/30';
const LabelClass = 'block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 mr-1 uppercase tracking-wide';

const actionBtnBase =
  'inline-flex items-center justify-center rounded-xl border font-bold text-xs transition-all duration-200';

/** Memoized voucher group row for table (desktop) */
const VoucherGroupRow = React.memo(function VoucherGroupRow({
  group, idx, kind, expandedGroupId, isExporting, isViewer, theme, headerPartyLabel,
  triggerExport, openEditGroup, openDeleteGroup, setExpandedGroupId, openEdit, openDelete, onResetStatus
}) {
  const isExpanded = expandedGroupId === group.groupId;

  return (
    <React.Fragment key={group.groupId}>
      <tr
        onClick={() => setExpandedGroupId((id) => (id === group.groupId ? null : group.groupId))}
        className="group hover:bg-slate-50/50 cursor-pointer transition-colors hover-stable no-select-click h-[56px]"
        style={{ willChange: 'transform, opacity', backfaceVisibility: 'hidden', transform: 'translate3d(0, 0, 0)' }}
      >
        <td className="px-4 text-center border-x border-slate-50/50 dark:border-slate-700/30">
          <span className="text-[11px] font-black text-slate-400 group-hover:text-primary transition-colors">{idx + 1}</span>
        </td>
        <td className="px-6 text-center border-x border-slate-50/50 dark:border-slate-700/30">
          <span className="text-xs font-black text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/10 px-3 py-1 rounded-lg border border-primary/10">
            {group.voucherCode || '—'}
          </span>
        </td>
        <td className="px-6 text-center border-x border-slate-50/50 dark:border-slate-700/30">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700">
            {group.date || '—'}
          </span>
        </td>
        <td className="px-6 text-right border-x border-slate-50/50 dark:border-slate-700/30">
          <div className="font-black text-slate-800 dark:text-white truncate">
            {group.rep || '—'}
          </div>
        </td>
        <td className="px-6 text-center border-x border-slate-50/50 dark:border-slate-700/30">
          <span className="inline-flex items-center justify-center min-w-[2.5rem] h-8 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-black text-xs border border-slate-200 dark:border-slate-700">
            {group.lineCount}
          </span>
        </td>
        <td className="px-6 text-right border-x border-slate-50/50 dark:border-slate-700/30">
          <div className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">
             {(group.line_note || '').split(/\[تم الإلغاء\]|\[تعديل حديث\]|\[تم تعديله\]|\[تم إصدار الفاتورة|\[تمت الفوترة\]|\[إضافة مراجعة\]|\[مستند رقم|\[نوع:|<!--/)[0].trim() || '—'}
             {(group.line_note || '').includes('<!--') && (
               <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 ml-1">
                 <History size={10} />
               </div>
             )}
          </div>
        </td>
        <td className="px-6 text-center border-x border-slate-50/50 dark:border-slate-700/30">
           {group.lines.some(l => l.status === 'cancelled') ? (
             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black shadow-sm">
                <AlertTriangle size={10} /> ملغي
             </span>
           ) : (group.lines.some(l => l.status === 'مفوتر') || group.isTransfer) ? (
             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black shadow-sm">
                <CheckCircle size={10} /> {group.isTransfer ? 'تحويل مكتمل' : 'مفوتر'}
             </span>
           ) : (
             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black shadow-sm">
                <RefreshCw size={10} className="animate-spin-slow" /> قيد المراجعة
             </span>
           )}
        </td>
        <td className="px-6 text-center border-x border-slate-50/50 dark:border-slate-700/30">
          <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
            {!isViewer && (
              <>
                {group.lines.some(l => l.status === 'cancelled') ? (
                  <span className="text-[10px] font-bold text-rose-400 italic px-2">سند ملغي</span>
                ) : group.lines.some(l => l.status === 'مفوتر') ? (
                  /* Professional Mode: Lock invoiced vouchers, require reset to edit */
                  <button 
                    onClick={() => onResetStatus(group)}
                    className="p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-all"
                    title="إلغاء الفوترة لإتاحة التعديل"
                  >
                    <RefreshCw size={14} strokeWidth={2.5} />
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => openEditGroup(group)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                      title="تعديل السند"
                    >
                      <Pencil size={14} strokeWidth={2.5} />
                    </button>
                    <button 
                      onClick={() => openDeleteGroup(group)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                      title="حذف السند"
                    >
                      <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    </React.Fragment>
  );
}, (prev, next) => (
  prev.group.groupId === next.group.groupId &&
  prev.group.lines.length === next.group.lines.length &&
  prev.group.lines.every((l, i) => l.status === next.group.lines[i]?.status) &&
  prev.expandedGroupId === next.expandedGroupId &&
  prev.isExporting === next.isExporting &&
  prev.isViewer === next.isViewer &&
  prev.kind === next.kind &&
  prev.headerPartyLabel === next.headerPartyLabel &&
  prev.idx === next.idx
));

/** Memoized expanded details section */
const VoucherGroupDetails = React.memo(function VoucherGroupDetails({
  group, kind, isViewer, theme, openEdit, openDelete,
}) {
  const [showHistory, setShowHistory] = React.useState(false);

  // Extract history from notes
  const historyData = React.useMemo(() => {
    const match = (group.line_note || '').match(/<!--(\{.*?\})-->/s);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch(e) { return null; }
  }, [group.line_note]);

  return (
    <tr>
      <td colSpan="8" className="px-6 py-0">
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden bg-slate-50/50 dark:bg-slate-900/30 rounded-[2rem] mb-6 mt-2 border border-slate-100 dark:border-slate-800 shadow-inner"
        >
          <div className="p-6">
            {/* Header: Notes + Actions */}
            {/* ─── Refined Stats Cards ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {/* Card 1: Beneficiary/Supplier */}
              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-3 border border-white/20 dark:border-slate-700/50 shadow-sm flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-lg shrink-0`}>
                  <User size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">
                    الجهة المستلمة
                  </span>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">
                    {group.rep || '—'}
                  </p>
                </div>
              </div>

              {/* Card 2: Date */}
              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-3 border border-white/20 dark:border-slate-700/50 shadow-sm flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-lg shrink-0`}>
                  <Calendar size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">تاريخ العملية</span>
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200 tabular-nums">
                    {group.date || '—'}
                  </p>
                </div>
              </div>

              {/* Card 3: Notes & Attachment */}
              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-3 border border-white/20 dark:border-slate-700/50 shadow-sm flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-lg shrink-0`}>
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">ملاحظات ومرفقات</span>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate italic">
                      {(group.line_note || '').split(/<!--|\[تم الإلغاء\]|\[تعديل حديث\]|\[تم تعديله\]|\[تم إصدار الفاتورة|\[تمت الفوترة\]|\[إضافة مراجعة\]|\[مستند رقم|\[نوع:/)[0].trim() || 'لا توجد ملاحظات'}
                    </p>
                    {group.attachment && (
                      <a 
                        href={group.attachment} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1 bg-blue-50 text-blue-500 rounded-md hover:bg-blue-100 transition-colors shrink-0"
                        title="عرض المرفق"
                      >
                        <Paperclip size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-6">
                {/* Space for additional info if needed */}
              </div>
              <div className="flex items-center gap-2">
                {group.isTransfer && (
                   <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 text-[10px] font-black shadow-sm">
                      <Package size={12} /> تحويل مخزني مكتمل
                   </div>
                )}
                {group.status === 'cancelled' && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 text-[10px] font-black animate-pulse shadow-sm">
                    <AlertTriangle size={14} /> تم إلغاء هذا السند بالكامل - الكميات مسترجعة للمخزن
                  </div>
                )}
                {/* Previous Version Button */}
                {historyData && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(v => !v)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[10px] font-black transition-all shadow-sm ${
                      showHistory
                        ? 'bg-amber-400 text-amber-950 border-amber-300'
                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <RefreshCw size={12} />
                    {showHistory ? 'عرض النسخة الحالية' : 'عرض النسخة السابقة'}
                  </button>
                )}
              </div>
            </div>

            {/* Previous Version Inline Panel */}
            {showHistory && historyData && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-700">
                    <RefreshCw size={13} />
                    <span className="text-[10px] font-black uppercase tracking-widest">بيانات السند قبل آخر تعديل</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 tabular-nums">
                    بتاريخ: {new Date(historyData.modifiedAt).toLocaleString('ar-SA')}
                  </span>
                </div>
                <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-amber-50/80 text-amber-600 font-black text-[9px] uppercase tracking-widest border-b border-amber-100">
                      <tr>
                        <th className="px-4 py-2.5 text-center w-10">م</th>
                        <th className="px-4 py-2.5">الصنف</th>
                        <th className="px-4 py-2.5 text-center">الكمية</th>
                        <th className="px-4 py-2.5 text-center">الوحدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-50">
                      {historyData.lines.filter(l => !l.is_summary && !(l.item && l.item.includes('ملخص'))).map((l, i) => (
                        <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-4 py-2.5 text-center text-[10px] font-bold text-amber-400">{i + 1}</td>
                          <td className="px-4 py-2.5 font-black text-amber-900">{l.item}</td>
                          <td className="px-4 py-2.5 text-center font-black text-amber-700 tabular-nums">{l.qty}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-amber-600">{l.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}


            <table className="w-full text-right text-xs border-separate border-spacing-y-1.5">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest text-[9px]">
                  <th className="px-4 py-2 w-12 text-center">م</th>
                  <th className="px-4 py-2">الصنف والشركة</th>
                  <th className="px-4 py-2 text-center">الكمية</th>
                  <th className="px-4 py-2 text-center">القسم</th>
                  <th className="px-4 py-2">ملاحظات السطر</th>
                  {!isViewer && group.status !== 'cancelled' && <th className="px-4 py-2 text-center">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {group.lines.filter(l => !l.is_summary).map((l, lIdx) => (
                  <tr key={l.id} className="bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl shadow-sm group/row">
                    <td className="px-4 py-2 text-center text-[10px] font-black text-slate-400 rounded-r-xl border-y border-r border-slate-50 dark:border-slate-700/50">{lIdx + 1}</td>
                    <td className="px-4 py-2 font-black text-slate-800 dark:text-slate-200 border-y border-slate-50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-slate-300" />
                        <span>{l.item}</span>
                        {l.company && <span className="text-[10px] font-bold text-slate-400">({l.company})</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center border-y border-slate-50 dark:border-slate-700/50">
                      <span className={`px-3 py-1 rounded-lg font-black text-xs ${theme.qtyBadge}`}>
                        {l.qty} {l.unit}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-slate-500 text-[10px] font-bold border-y border-slate-50 dark:border-slate-700/50">{l.cat || '—'}</td>
                    <td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-bold border-y border-slate-50 dark:border-slate-700/50 italic">
                      {kind === 'in' ? l.lineNote || '—' : l.custodyStatus || '—'}
                    </td>
                    {!isViewer && group.status !== 'cancelled' && (
                      <td className="px-4 py-2 text-center rounded-l-xl border-y border-l border-slate-50 dark:border-slate-700/50">
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(l); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Pencil size={14} strokeWidth={2.5} /></button>
                          <button onClick={(e) => { e.stopPropagation(); openDelete(l); }} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={14} strokeWidth={2.5} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </td>
    </tr>
  );
}, (prev, next) => (
  prev.group.groupId === next.group.groupId &&
  prev.group.lines.length === next.group.lines.length &&
  prev.group.status === next.group.status &&
  prev.isViewer === next.isViewer &&
  prev.kind === next.kind
));

function ModalWrapper({
  title, isOpen, onClose, children, onSubmit, maxWidth, submitLabel, loading, disableSubmit, accent, height = 'h-[92vh]', hideFooter = false,
}) {
  const theme = accentTheme(accent);
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onMouseDown={onClose}
          />
          <motion.div
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full ${maxWidth} bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden ${height} max-h-[95vh]`}
            dir="rtl"
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r ${theme.gradient} shrink-0`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-lg border border-white/10">
                  <Box size={22} />
                </div>
                <h3 className="text-lg font-black text-white">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1">{children}</div>
              {!hideFooter && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-row-reverse gap-3 shrink-0">
                  <button
                    type="submit"
                    disabled={loading || disableSubmit}
                    className={`px-10 py-3 rounded-[1.25rem] font-black text-white flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br ${theme.gradient} ${theme.shadow}`}
                  >
                    {loading && <Box className="animate-spin" size={18} />}
                    {submitLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-8 py-3 rounded-[1.25rem] font-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function emptySession(kind) {
  const base = { date: formatDate(new Date()), voucher_no: '', attachment: null };
  return { ...base, rep: '', line_note: '', outwardType: 'sale' };
}

async function allocateVoucherCode(kind) {
  const cfg = KIND_CONFIG[kind];
  const year = new Date().getFullYear();
  const key = `${cfg.counterKey}${year}`;
  
  const { data, error } = await supabase.rpc('allocate_voucher_code', {
    p_prefix: cfg.codePrefix,
    p_key: key
  });
  
  if (error) {
    console.error('Voucher code allocation error:', error);
    // Fallback to a random code if RPC fails
    return `${Math.floor(Math.random() * 900) + 100}`;
  }
  return data;
}

// Export pipeline: renders hidden HTML → html2canvas → jsPDF or PNG download
// This approach embeds Arabic perfectly since browser renders the fonts.



export default function VoucherWorkspace({ kind, setActiveView }) {
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
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [draftUnit, setDraftUnit] = useState('');
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);

  // Export state: { group, mode: 'pdf' | 'png' | 'blank-pdf' }
  const [exportJob, setExportJob] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [groupToReset, setGroupToReset] = useState(null);
  const [originalVoucherTotals, setOriginalVoucherTotals] = useState({}); // itemId -> totalQty in DB

  const voucherTxs = useMemo(
    () => transactions.filter((t) => t.type === cfg.txType),
    [transactions, cfg.txType]
  );

  const voucherGroups = useMemo(() => {
    const map = new Map();
    voucherTxs.forEach((t) => {
      // Prioritize batch_id, fallback to reference_number for legacy, finally to ID
      const gid = t.batch_id || t.reference_number || `legacy_${t.id}`;
      if (!map.has(gid)) map.set(gid, { groupId: gid, lines: [] });
      map.get(gid).lines.push(t);
    });
    const groups = [...map.values()].map((g) => {
      g.lines.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
      const representative = g.lines.find(l => !l.is_summary) || g.lines[0];
      const lastTs = g.lines.reduce(
        (max, line) => Math.max(max, line.timestamp ? new Date(line.timestamp).getTime() : 0),
        0
      );
      return {
        ...g,
        date: representative?.date || formatDate(representative?.timestamp?.toDate?.()),
        supplier: representative?.supplier,
        rep: representative?.rep,
        line_note: representative?.notes || '',
        attachment: representative?.attachment || null,
        voucherCode: (representative?.reference_number || '').replace(/^[A-Z]+-\d+-/g, '').replace(/^[A-Z]+-/g, ''),
        lineCount: g.lines.length,
        isEdited: (representative?.notes && representative?.notes.includes('[تعديل حديث]')),
        isTransfer: (representative?.notes && representative?.notes.includes('[نوع: تحويل مخزني]')),
        historyLog: (() => {
          if (!representative?.notes) return null;
          const match = representative.notes.match(/<!--(\{.*\})-->/);
          if (match) {
            try { return JSON.parse(match[1]); } catch(e) { return null; }
          }
          return null;
        })(),
        lastTs,
      };
    });
    groups.sort((a, b) => b.lastTs - a.lastTs);
    return groups;
  }, [voucherTxs]);

  const filteredGroups = useMemo(() => {
    return voucherGroups.filter((g) => {
      if (filterSearch.trim()) {
        const q = normalizeArabic(filterSearch);
        const header = (kind === 'in' ? g.supplier : g.rep) || '';
        const headerMatch = normalizeArabic(header).includes(q);
        const itemMatch = g.lines.some((l) => normalizeArabic(l.item || '').includes(q));
        const codeMatch = normalizeArabic(g.voucherCode || '').includes(q);
        if (!headerMatch && !itemMatch && !codeMatch) return false;
      }
      if (filterDateFrom && g.date && g.date < filterDateFrom) return false;
      if (filterDateTo && g.date && g.date > filterDateTo) return false;
      return true;
    });
  }, [voucherGroups, filterSearch, filterDateFrom, filterDateTo, kind]);

  const triggerExport = (group, mode) => setExportJob({ group, mode });

  const fetchInitialData = useCallback(async () => {
    try {
      const { data: itemsData, error: itemsError } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty');
      if (itemsError) throw itemsError;
      if (itemsData) setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty })));

      const { data: transData, error: transError } = await supabase.from('transactions').select('id, type, timestamp, item_id, batch_id, reference_number, beneficiary, item, company, qty, unit, cat, notes, date, balance_after, receipt_image, is_summary, status').order('timestamp', { ascending: false });
      if (transError) throw transError;
      if (transData) setTransactions(transData.map(d => ({ 
        ...d, 
        itemId: d.item_id,
        voucherGroupId: d.batch_id,
        voucherCode: d.reference_number,
        lineNote: d.notes,
        supplier: d.beneficiary,
        rep: d.beneficiary,
        status: d.status || 'قيد المراجعة',
        line_note: d.notes || '',
        attachment: d.receipt_image || null
      })));
    } catch (err) {
      console.error("❌ VoucherWorkspace: Error fetching data:", err);
    }
  }, [kind]);

  useEffect(() => {
    fetchInitialData();

    const channels = [
      supabase.channel(`public:products:vouchers:${kind}`).on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData).subscribe(),
      supabase.channel(`public:transactions:vouchers:${kind}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData).subscribe()
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [kind]);

  // ─── External Edit Trigger from Dashboard ───
  useEffect(() => {
    const editId = localStorage.getItem('edit_voucher_id');
    if (editId && voucherGroups.length > 0) {
      const groupToEdit = voucherGroups.find(g => g.groupId === editId);
      if (groupToEdit) {
        localStorage.removeItem('edit_voucher_id');
        openEditGroup(groupToEdit);
      }
    }
  }, [voucherGroups]);

  // Handle ESC key to exit or close modals
  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.key === 'Escape') {
        if (isConfirmCloseOpen) setIsConfirmCloseOpen(false);
        else if (isConfirmSaveOpen) setIsConfirmSaveOpen(false);
        else if (isResetConfirmOpen) setIsResetConfirmOpen(false);
        else if (isAddModalOpen) triggerCloseAddModal();
        else if (isEditOpen) setIsEditOpen(false);
        else if (isDeleteOpen) setIsDeleteOpen(false);
        else if (isDeleteGroupOpen) setIsDeleteGroupOpen(false);
        else if (expandedGroupId) setExpandedGroupId(null);
        else window.location.hash = '#dashboard';
      } else if (e.key === 'Enter') {
        // Prevent submission if user is in an input (except for specific modals)
        if (e.target.tagName === 'INPUT' && isAddModalOpen && !isConfirmSaveOpen && !isConfirmCloseOpen) return;

        if (isConfirmCloseOpen) {
          e.preventDefault();
          closeAddModal();
        } else if (isConfirmSaveOpen) {
          e.preventDefault();
          executeSave();
        } else if (isResetConfirmOpen) {
          e.preventDefault();
          handleResetStatusSubmit();
        } else if (isDeleteGroupOpen) {
          e.preventDefault();
          handleDeleteGroupSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }); // Run on every render to capture fresh closures for closeAddModal/executeSave

  // ─── EMERGENCY AUTO-SAVE ───
  const DRAFT_KEY = `barakat_voucher_draft_${kind}`;





  const resetFilters = () => {
    setFilterSearch('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const itemSuggestions = useMemo(() => {
    if (!searchNameText || selectedItem) return [];
    const q = normalizeArabic(searchNameText);
    if (!q) return [];

    return items.filter((i) => {
      const n = normalizeArabic(getItemName(i));
      const c = normalizeArabic(getCompany(i) || '');
      const cat = normalizeArabic(getCategory(i) || '');
      
      // Search in name, company, and category for maximum flexibility
      return n.includes(q) || c.includes(q) || cat.includes(q);
    }).slice(0, 20); // Show up to 20 suggestions
  }, [items, searchNameText, selectedItem]);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setSearchNameText(`${getItemName(item)} — ${getCompany(item)}`);
    setDraftUnit(getUnit(item) || 'كرتونة');
    setSearchIdx(-1);
    setTimeout(() => document.getElementById(`voucher-qty-${kind}`)?.focus(), 50);
  };

  const clearRow = useCallback(() => {
    setSelectedItem(null);
    setSearchNameText('');
    setDraftQty('');
    setDraftExpiryDate('');
    setDraftLineNote('');
    setDraftUnit('');
    setTimeout(() => itemNameRef.current?.focus(), 50);
  }, []);

  const triggerCloseAddModal = () => {
    if (modalDrafts.length > 0) {
      setIsConfirmCloseOpen(true);
    } else {
      closeAddModal();
    }
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setIsConfirmCloseOpen(false);
    setEditingGroupId(null);
    setEditingLineIds([]);
    setPreservedVoucherCode('');
    setModalDrafts([]);
    setOriginalVoucherTotals({});
    setSession(emptySession(kind));
    clearRow();
  };

  const pushDraft = () => {
    if (!selectedItem || !draftQty || Number(draftQty) <= 0) {
      toast.error('يرجى اختيار صنف وإدخال كمية صحيحة.');
      playWarning();
      return;
    }

    if (kind === 'outward') {
      let availableStock = Number(selectedItem.stock_qty || 0);
      
      // If we are editing an existing line in an edit session, add its original qty back to available
      if (editingDraftId) {
        const existingDraft = modalDrafts.find(d => d.draftId === editingDraftId);
        if (existingDraft && existingDraft.isOriginal) {
          availableStock += Number(existingDraft.originalQty || 0);
        }
      }

      const requestedQty = Number(draftQty);
      if (requestedQty > availableStock) {
        toast.error(`الكمية لا تسمح! الرصيد المتاح: ${availableStock}`);
        playWarning();
        return;
      }
    }

    const row = {
      draftId: editingDraftId || crypto.randomUUID(),
      itemId: selectedItem.id,
      item: getItemName(selectedItem),
      company: getCompany(selectedItem),
      cat: getCategory(selectedItem),
      unit: draftUnit || getUnit(selectedItem),
      qty: Number(draftQty),
      lineNote: String(draftLineNote || '').trim(),
    };

    if (editingDraftId) {
      setModalDrafts((p) => p.map((x) => (x.draftId === editingDraftId ? row : x)));
      setEditingDraftId(null);
      toast.success('تم تحديث السطر في المسودة');
    } else {
      setModalDrafts((p) => [row, ...p]);
    }

    playSuccess();
    clearRow();
  };

  const handleEditDraft = (d) => {
    setEditingDraftId(d.draftId);
    const item = items.find((i) => i.id === d.itemId);
    if (item) {
      setSelectedItem(item);
      setDraftQty(String(d.qty));
      setDraftLineNote(d.lineNote || '');
      setDraftUnit(d.unit || getUnit(item) || 'كرتونة');
      setTimeout(() => document.getElementById(`voucher-qty-${kind}`)?.focus(), 150);
    }
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
    if (!String(session.voucher_no || '').trim()) {
      toast.error('يرجى إدخال رقم السند.');
      playWarning();
      return false;
    }
    return true;
  };

  const openEditGroup = (group) => {
    setEditingGroupId(group.groupId);
    setEditingLineIds(group.lines.map((l) => l.id));
    setPreservedVoucherCode(group.voucherCode || '');
    
    // Robust cleaning using regex - Expanded to catch variations
    let rawNote = group.line_note || '';
    let cleanNote = rawNote
      .split(/<!--|\[تعديل حديث\]|\[تم تعديله\]|\[تم إصدار الفاتورة|\[إضافة مراجعة\]|\[مستند رقم/)[0]
      .trim();
    
    if (kind === 'in') {
      setSession({
        supplier: group.supplier || '',
        date: group.date || formatDate(new Date()),
        line_note: cleanNote,
        voucher_no: group.voucherCode || '',
        attachment: group.attachment || null,
      });
    } else {
      setSession({
        rep: group.rep || '', 
        date: group.date || formatDate(new Date()),
        voucher_no: group.voucherCode || '',
        line_note: cleanNote,
        attachment: group.attachment || null,
        outwardType: (group.line_note || '').includes('[نوع: تحويل مخزني]') ? 'transfer' : 'sale'
      });
    }

    // Calculate original totals per item for stock validation
    const totals = {};
    group.lines.forEach(l => {
      if (l.is_summary) return;
      totals[l.itemId] = (totals[l.itemId] || 0) + Number(l.qty || 0);
    });
    setOriginalVoucherTotals(totals);

    setModalDrafts(
      group.lines
        .filter((l) => l.is_summary !== true)
        .map((l) => ({
          draftId: crypto.randomUUID(),
          itemId: l.itemId,
          item: l.item,
          company: l.company || 'بدون شركة',
          cat: l.cat || 'أخرى',
          unit: l.unit || 'كرتونة',
          qty: Number(l.qty),
          originalQty: Number(l.qty), // Keep track of DB quantity
          isOriginal: true,           // Mark as existing DB line
          expiryDate: l.expiryDate || '',
          lineNote: l.lineSupplyNote || l.lineNote || '',
        }))
    );
    setIsAddModalOpen(true);
    setTimeout(() => itemNameRef.current?.focus(), 150);
  };

  const triggerSave = (e) => {
    if (e) e.preventDefault();
    if (!modalDrafts.length) return;
    if (!validateSession()) return;
    setIsConfirmSaveOpen(true);
  };

  const executeSave = (e) => {
    if (e) e.preventDefault();
    setIsConfirmSaveOpen(false);
    handleBulkSubmit();
  };

  const uploadToCloudinary = async (file) => {
    if (!file || typeof file === 'string') return file; // Already a URL or empty
    
    const year = new Date(session.date).getFullYear();
    const month = new Date(session.date).getMonth() + 1;
    const beneficiary = session.rep || 'عام';
    const subType = session.outwardType === 'transfer' ? 'تحويلات' : 'فواتير';
    
    // Structure: vouchers / اخراج / [فواتير|تحويلات] / [Beneficiary] / [Year] / [Month]
    const folderPath = `vouchers/اخراج/${subType}/${beneficiary}/${year}/${month}`;
    
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
        throw new Error(`Cloudinary Error: ${errorData.error?.message || res.statusText}`);
      }

      const data = await res.json();
      return data.secure_url;
    } catch (error) {
      console.error("❌ Cloudinary Upload Failed:", error);
      throw error;
    }
  };

  const handleBulkSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!modalDrafts.length) return;
    if (!validateSession()) return;

    let voucherSupplyNotes = String(session.line_note || '').trim();
    
    // Add specific tag for internal transfers
    if (kind === 'outward' && session.outwardType === 'transfer') {
      if (!voucherSupplyNotes.includes('[نوع: تحويل مخزني]')) {
        voucherSupplyNotes = voucherSupplyNotes ? `${voucherSupplyNotes} [نوع: تحويل مخزني]` : '[نوع: تحويل مخزني]';
      }
    }

    setLoading(true);

    try {
      // ─── Cloudinary Upload Logic ───
      let imageUrl = session.attachment;
      if (session.attachment && typeof session.attachment !== 'string') {
        imageUrl = await uploadToCloudinary(session.attachment);
      }
      // ───────────────────────────────
      let oldLines = [];
      if (editingGroupId) {
          // IMPORTANT: Fetch existing transactions BEFORE deleting them
          const { data: existing } = await supabase
            .from('transactions')
            .select('item_id, qty')
            .eq('batch_id', editingGroupId)
            .eq('is_summary', false);
          if (existing) oldLines = existing;
      }

      // ═══ OUTWARD: Final stock validation before saving ═══
      // This is the critical gate — re-fetch live stock from DB to prevent negatives
      if (kind === 'outward') {
        const outItemIds = [...new Set(modalDrafts.map(d => d.itemId))].filter(Boolean);
        const { data: liveProducts, error: liveErr } = await supabase
          .from('products')
          .select('id, name, stock_qty')
          .in('id', outItemIds);

        if (liveErr) throw liveErr;

        // Group draft totals per item
        const draftTotals = {};
        for (const d of modalDrafts) {
          draftTotals[d.itemId] = (draftTotals[d.itemId] || 0) + Number(d.qty || 0);
        }

        for (const p of liveProducts || []) {
          const liveStock = Number(p.stock_qty || 0);
          const requested = draftTotals[p.id] || 0;
          const previouslyDeducted = Number(originalVoucherTotals[p.id] || 0);
          
          // Logic: We only care if the NEW total is greater than what was already taken.
          // Net additional stock needed = requested - previouslyDeducted
          const netAdditionalNeeded = requested - previouslyDeducted;

          if (netAdditionalNeeded > liveStock) {
            setLoading(false);
            toast.error(
              `❌ الكمية المطلوبة للصنف "${p.name}" (${requested}) تتجاوز المخزون المتاح حالياً (${liveStock}) + الكمية المسترجعة من السند الأصلي (${previouslyDeducted}).`,
              { duration: 8000 }
            );
            playWarning();
            return;
          }
        }
      }
      // ═══════════════════════════════════════════════════════

      let voucherGroupId = editingGroupId || crypto.randomUUID();
      const inputVoucherCode = String(session.voucher_no || '').trim();
      let voucherCode = inputVoucherCode.replace(/^[A-Z]+-\d+-/g, '').replace(/^[A-Z]+-/g, '');

      if (!voucherCode) {
        voucherCode = await allocateVoucherCode(kind);
      } else {
        // Check for duplicates if the number changed OR if it's a new voucher
        const hasNumberChanged = voucherCode !== preservedVoucherCode;
        if (!editingGroupId || hasNumberChanged) {
          const checkTypes = ['سند إخراج', 'outward'];
          const { data: dup } = await supabase
            .from('transactions')
            .select('id')
            .eq('reference_number', voucherCode)
            .in('type', checkTypes)
            .limit(1);
          
          if (dup && dup.length > 0) {
            setLoading(false);
            return toast.error(`عفواً، رقم السند (${voucherCode}) مسجل مسبقاً في ${kind === 'in' ? 'سندات الإدخال' : 'سندات الإخراج'}!`);
          }
        }
      }

      // 1. Delete old lines if editing
      if (editingGroupId) {
        const { error: delError } = await supabase.from('transactions').delete().eq('batch_id', editingGroupId);
        if (delError) throw delError;
      }

      // ─── 2. Prepare Rows for Database ───
      const now = new Date();
      const timestamp = now.toISOString();
      
      // Save previous version snapshot when editing
      let historyTag = '';
      if (editingGroupId && voucherGroups.length > 0) {
        const originalGroup = voucherGroups.find(g => g.groupId === editingGroupId);
        if (originalGroup) {
          const snapshot = {
            at: timestamp,
            beneficiary: originalGroup.clientName || originalGroup.supplier || originalGroup.rep || '',
            date: originalGroup.date || '',
            notes: (originalGroup.line_note || '').split(/\[تعديل حديث\]|\[تم تعديله\]|\[تم إصدار الفاتورة|\[إضافة مراجعة\]|\[مستند رقم|\[نوع:|<!--/)[0].trim(),
            lines: originalGroup.lines
              .filter(l => !l.is_summary)
              .map(l => ({ item: l.item, qty: l.qty, unit: l.unit, cat: l.cat || '' }))
          };
          historyTag = ` <!--HIST:${JSON.stringify(snapshot)}-->`;
        }
      }

      const beneficiary = String(session.rep || '').trim();

      const common = {
        type: 'سند إخراج',
        date: session.date,
        batch_id: voucherGroupId,
        reference_number: voucherCode,
        beneficiary: beneficiary,
        notes: `${voucherSupplyNotes}${historyTag}`,
        receipt_image: imageUrl || null,
        timestamp: timestamp, // Jump to top
      };

      common.rep = beneficiary;

      const rows = modalDrafts.map((entry) => ({
        ...common,
        item: entry.item,
        item_id: entry.itemId,
        company: entry.company,
        qty: entry.qty,
        unit: entry.unit,
        cat: entry.cat,
        is_summary: false
      }));

      // Add Summary Row
      const totalQty = modalDrafts.reduce((sum, d) => sum + d.qty, 0);
      rows.push({
        ...common,
        item: 'ملخص عهده مندوب',
        qty: totalQty,
        total_qty: totalQty,
        is_summary: true,
        notes: common.notes ? `${common.notes} [مستند رقم ${voucherCode}]` : `مستند رقم ${voucherCode}`
      });

      console.log('🚀 Final Transaction Payload:', rows);

      const { error: insError } = await supabase.from('transactions').insert(rows);
      if (insError) {
        console.error('❌ Supabase Insert Error:', insError);
        throw insError;
      }

      // --- Real-time Stock Update Logic (Sync Everything) ---
      const itemIds = [...new Set(modalDrafts.map(d => d.itemId))].filter(Boolean);
      
      const allAffectedItemIds = [...new Set([...itemIds, ...oldLines.map(l => l.item_id)])].filter(Boolean);

      if (allAffectedItemIds.length > 0) {
        const { data: currentProducts, error: fetchError } = await supabase
          .from('products')
          .select('id, stock_qty')
          .in('id', allAffectedItemIds);

        if (!fetchError && currentProducts) {
          // Calculate Net Change per Product
          for (const pid of allAffectedItemIds) {
            const p = currentProducts.find(x => x.id === pid);
            if (!p) continue;

            let netChange = 0;
            // 1. Undo Old Impact
            const oldSum = oldLines.filter(ol => ol.item_id === pid).reduce((sum, ol) => sum + Number(ol.qty || 0), 0);
            netChange += oldSum; // Old Outbound subtracted stock, so undoing adds

            // 2. Apply New Impact
            const newSum = modalDrafts.filter(nd => nd.itemId === pid).reduce((sum, nd) => sum + Number(nd.qty || 0), 0);
            netChange -= newSum; // New Outbound subtracts stock

            if (netChange !== 0) {
                const currentStock = Number(p.stock_qty || 0);
                await supabase
                  .from('products')
                  .update({ stock_qty: Math.max(0, currentStock + netChange) })
                  .eq('id', pid);
            }
          }
        }
      }
      // ------------------------------------

      toast.success(
        editingGroupId
          ? `✅ تم تحديث السند ${voucherCode}`
          : `✅ تم حفظ السند ${voucherCode} (${modalDrafts.length} سطر)`
      );
      playSuccess();
      closeAddModal();
    } catch (err) {
      console.error(err);
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
      const { error } = await supabase.from('transactions').update({ 
        qty: Number(editForm.qty), 
        date: editForm.date, 
        notes: String(editForm.lineNote || '').trim() 
      }).eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم تعديل السطر بنجاح');
      playSuccess();
      setIsEditOpen(false);
    } catch (err) {
      console.error(err);
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
      const { error } = await supabase.from('transactions').delete().eq('id', selectedTx.id);
      if (error) throw error;
      toast.success('تم حذف السطر');
      playSuccess();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
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
    if (e) e.preventDefault();
    if (!groupToDelete?.lines?.length) return;
    setLoading(true);
    try {
      // 1. Return stock BEFORE deleting
      const lines = groupToDelete.lines.filter(l => l.is_summary !== true);
      const itemIds = [...new Set(lines.map(l => l.item_id))].filter(Boolean);
      
      if (itemIds.length > 0) {
          const { data: products } = await supabase.from('products').select('id, stock_qty').in('id', itemIds);
          if (products) {
              for (const l of lines) {
                  const p = products.find(x => x.id === l.item_id);
                  if (p) {
                      const current = Number(p.stock_qty || 0);
                      const qty = Number(l.qty || 0);
                      // If it was Inbound (added stock), deleting it subtracts stock.
                      // If it was Outbound (subtracted stock), deleting it adds stock.
                      const adjustment = kind === 'in' ? -qty : qty;
                      await supabase.from('products').update({ stock_qty: Math.max(0, current + adjustment) }).eq('id', p.id);
                  }
              }
          }
      }

      // 2. Mark as cancelled instead of hard deleting for audit trail
      const ids = groupToDelete.lines.map((l) => l.id);
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled', notes: `[تم الإلغاء] - ${new Date().toLocaleString('ar-EG')}` })
        .in('id', ids);
      if (error) throw error;

      toast.success('تم إلغاء السند وإرجاع الكميات للمخزن بنجاح');
      playSuccess();
      await fetchInitialData();
      setIsDeleteGroupOpen(false);
      setGroupToDelete(null);
      setExpandedGroupId(null);
    } catch (err) {
      console.error(err);
      toast.error('تعذر حذف السند');
      playWarning();
    } finally {
      setLoading(false);
    }
  };

  const onResetStatus = (group) => {
    setGroupToReset(group);
    setIsResetConfirmOpen(true);
  };

  const handleResetStatusSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!groupToReset || !groupToReset.lines) return;
    setLoading(true);
    try {
      let hasError = false;
      for (const line of groupToReset.lines) {
        let cleanNote = (line.notes || '')
          .split(/<!--|\[تعديل حديث\]|\[تم تعديله\]|\[تم إصدار الفاتورة|\[إضافة مراجعة\]|\[مستند رقم/)[0]
          .trim();
          
        const { error } = await supabase
          .from('transactions')
          .update({ 
            status: null, 
            notes: cleanNote || null 
          }) 
          .eq('id', line.id);
          
        if (error) {
           console.error('Error updating line:', line.id, error);
           hasError = true;
        }
      }

      if (hasError) throw new Error("Failed to reset some lines");

      toast.success('تم إلغاء الفوترة بنجاح. السند متاح الآن للتعديل أو الحذف.');
      playSuccess();
      await fetchInitialData();
      setIsResetConfirmOpen(false);
      setGroupToReset(null);
      fetchInitialData();
    } catch (err) {
      console.error('❌ Reset Status Error:', err);
      toast.error('تعذر إلغاء الفوترة. تحقق من الاتصال وقاعدة البيانات.');
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

  const headerPartyLabel = kind === 'in' ? 'المورد' : 'المستفيد';

  // Accent colors for the hidden receipt DOM
  const accentHex = kind === 'in' ? '#10b981' : '#3b82f6';
  const accentLight = kind === 'in' ? '#d1fae5' : '#dbeafe';
  const accentDark  = kind === 'in' ? '#065f46' : '#1e3a8a';
  const partyLabel  = kind === 'in' ? 'المورد' : 'المستفيد';
  const partyValue  = exportJob?.group ? (kind === 'in' ? exportJob.group.supplier : exportJob.group.rep) : '—';

  // Pad lines array so the table always shows at least 30 rows
  const receiptLines = (exportJob?.group?.lines || []).filter(l => !l.is_summary);
  const BLANK_ROWS = 30;
  const paddedLines = receiptLines.length >= BLANK_ROWS
    ? receiptLines
    : [...receiptLines, ...Array(BLANK_ROWS - receiptLines.length).fill(null)];

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col gap-6 animate-in fade-in duration-500 font-readex" dir="rtl">

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
            className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
              <p className="text-sm font-black text-slate-700">جاري إنشاء الملف...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 bg-gradient-to-br ${theme.gradient} rounded-2xl flex items-center justify-center text-white shadow-lg ${theme.shadow} shrink-0`}>
            <Icon size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              {settings?.labels?.[kind === 'in' ? 'voucherIn' : 'voucherOut'] || cfg.pageTitle}
            </h1>
            <p className="text-slate-400 mt-1 font-bold text-[11px]">{cfg.pageSubtitle}</p>
          </div>
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="flex-1 flex flex-col md:flex-row items-center gap-4 px-4">
          <div className="relative flex-1 w-full group">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder={`ابحث برقم السند أو ${kind === 'in' ? 'المورد' : 'المستفيد'}...`}
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full bg-slate-50/50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[13px] font-bold rounded-2xl pr-12 pl-4 h-12 outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-primary/20 shadow-inner" 
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto relative">
            <button 
              onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
              className={`h-12 px-5 rounded-2xl border transition-all flex items-center gap-3 font-black text-[12px] shadow-sm ${
                isDateFilterOpen || filterDateFrom || filterDateTo 
                  ? `bg-${cfg.accent}-50 border-${cfg.accent}-200 text-${cfg.accent}-600` 
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'
              }`}
            >
              <CalendarRange size={18} />
              <span>{filterDateFrom || filterDateTo ? 'تصفية مفعلة' : 'فلتر التاريخ'}</span>
            </button>

            {isDateFilterOpen && (
              <div className="absolute top-full left-0 mt-3 w-72 bg-white dark:bg-slate-800 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-700 p-6 z-[100] animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">من تاريخ</label>
                    <input 
                      type="date" 
                      className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl px-4 text-xs font-black outline-none focus:border-primary/30"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-2 tracking-widest">إلى تاريخ</label>
                    <input 
                      type="date" 
                      className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl px-4 text-xs font-black outline-none focus:border-primary/30"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => { resetFilters(); setIsDateFilterOpen(false); }}
                      className="flex-1 py-2.5 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors"
                    >
                      إعادة تعيين
                    </button>
                    <button 
                      onClick={() => setIsDateFilterOpen(false)}
                      className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black hover:bg-slate-200"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {(filterSearch) && (
              <button 
                onClick={resetFilters}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all shadow-sm shadow-rose-500/10"
                title="إعادة تعيين البحث"
              >
                <FilterX size={20} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isViewer && (
            <button
              type="button"
              onClick={openModal}
              className={`flex items-center gap-2 px-6 py-2.5 h-11 rounded-xl font-bold text-white bg-gradient-to-br ${theme.gradient} ${theme.shadow} shadow-lg transition-all active:scale-95`}
            >
              <Plus size={20} />
              <span>سند جديد</span>
            </button>
          )}

          <button 
            type="button"
            onClick={() => setActiveView ? setActiveView('dashboard') : (window.location.hash = '#dashboard')}
            className="w-11 h-11 bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-xl flex items-center justify-center transition-all border border-rose-100 dark:border-rose-500/20 group shadow-sm shadow-rose-500/10"
            title="العودة للرئيسية"
          >
             <LogOut size={22} className="group-hover:-translate-x-1 transition-transform rotate-180" />
          </button>
        </div>
      </div>



      {/* ═══ TABLE AREA ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30 dark:bg-slate-900/50 p-6 pt-2">
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
               <div className={`w-10 h-10 border-4 border-${cfg.accent}-100 border-t-${cfg.accent}-600 rounded-full animate-spin`}></div>
               <span className="text-slate-400 font-bold text-sm">جاري تحميل السجلات...</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-400 opacity-60">
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-inner">
                  <FileText size={40} className="text-slate-300" />
               </div>
               <p className="text-lg font-black">لا توجد سجلات مطابقة</p>
            </div>
          ) : (
            <>
            <div className="hidden md:block">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  <th className="px-4 py-4 text-center w-12 border-x border-slate-100 dark:border-slate-700">م</th>
                  <th className="px-6 py-4 text-center w-40 border-x border-slate-100 dark:border-slate-700">رقم السند</th>
                  <th className="px-6 py-4 text-center w-48 border-x border-slate-100 dark:border-slate-700">التاريخ</th>
                  <th className="px-6 py-4 text-right border-x border-slate-100 dark:border-slate-700">{headerPartyLabel}</th>
                  <th className="px-6 py-4 text-center w-28 border-x border-slate-100 dark:border-slate-700">الأصناف</th>
                  <th className="px-6 py-4 text-right w-48 border-x border-slate-100 dark:border-slate-700">الملاحظات</th>
                  <th className="px-6 py-4 text-center w-44 border-x border-slate-100 dark:border-slate-700">الحالة</th>
                  <th className="px-6 py-4 text-center w-48 border-x border-slate-100 dark:border-slate-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredGroups.map((group, idx) => (
                  <React.Fragment key={group.groupId}>
                    <VoucherGroupRow
                      group={group}
                      idx={idx}
                      kind={kind}
                      isViewer={isViewer}
                      theme={theme}
                      isExporting={isExporting}
                      headerPartyLabel={headerPartyLabel}
                      setExpandedGroupId={setExpandedGroupId}
                      onResetStatus={onResetStatus}
                      openEditGroup={openEditGroup}
                      openDeleteGroup={openDeleteGroup}
                      triggerExport={triggerExport}
                    />
                    <AnimatePresence>
                      {expandedGroupId === group.groupId && (
                        <VoucherGroupDetails
                          group={group}
                          kind={kind}
                          isViewer={isViewer}
                          theme={theme}
                          openEdit={openEdit}
                          openDelete={openDelete}
                        />
                      )}
                    </AnimatePresence>
                  </React.Fragment>
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
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="p-4 bg-white/40 dark:bg-slate-900/20 space-y-3 hover-stable no-select-click"
                    style={{ willChange: 'transform, opacity', backfaceVisibility: 'hidden', transform: 'translate3d(0, 0, 0)' }}
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
                    <div className="flex items-center justify-between">
                       <p className="text-xs text-slate-500">{group.lineCount} صنف</p>
                       {group.lines.some(l => l.status === 'مفوتر') && (
                         <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">مفوتر</span>
                       )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={isExporting} onClick={() => triggerExport(group, 'png')} className={`${actionBtnBase} px-3 py-2 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 disabled:opacity-40 ${glowImg}`}>
                        <ImageIcon size={14} className="ml-1" /> صورة
                      </button>
                      {!isViewer && (
                        <>
                          {group.lines.some(l => l.status === 'مفوتر') ? (
                            <button type="button" onClick={() => onResetStatus(group)} className={`${actionBtnBase} px-3 py-2 border-orange-200 bg-orange-50 text-orange-600`}>
                              <RefreshCw size={14} className="ml-1" /> فك القفل
                            </button>
                          ) : (
                            <>
                              <button type="button" onClick={() => openEditGroup(group)} className={`${actionBtnBase} px-3 py-2 border-blue-200 text-blue-600 ${glowEdit}`}>
                                <Pencil size={14} className="ml-1" /> تعديل
                              </button>
                              <button type="button" onClick={() => openDeleteGroup(group)} className={`${actionBtnBase} px-3 py-2 border-rose-200 text-rose-600 ${glowDel}`}>
                                <Trash2 size={14} className="ml-1" /> حذف
                              </button>
                            </>
                          )}
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
                          <table className="w-full text-right text-xs border-separate border-spacing-y-1 whitespace-nowrap">
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

              {/* Expanded row details handled via VoucherGroupDetails in the table body */}
            </>
          )}
        </div>
      </div>

      {/* ═══ ADD/EDIT VOUCHER MODAL ═══ */}
      <ModalWrapper
        title={editingGroupId ? `تعديل السند ${preservedVoucherCode || ''}` : cfg.modalTitle}
        isOpen={isAddModalOpen}
        onClose={triggerCloseAddModal}
        onSubmit={triggerSave}
        maxWidth="max-w-6xl"
        submitLabel={editingGroupId ? `حفظ التعديلات (${modalDrafts.length} سطر)` : `حفظ السند (${modalDrafts.length} سطر)`}
        loading={loading}
        disableSubmit={modalDrafts.length === 0}
        accent={cfg.accent}
      >
        <div className="flex flex-col gap-4">
          {/* ─── ULTRA-COMPACT SESSION HEADER (Grid 12) ─── */}
          <div className="relative grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
            
            {/* Supplier / Rep Name */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1">
                <User size={10} className="text-primary" /> {cfg.sessionFields[0].label} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-[11px] font-black rounded-full px-4 py-2 outline-none focus:border-primary/50 transition-all text-slate-700 dark:text-white shadow-sm"
                placeholder={cfg.sessionFields[0].placeholder}
                value={session[cfg.sessionFields[0].key] || ''}
                onChange={(e) => setSession((s) => ({ ...s, [cfg.sessionFields[0].key]: e.target.value }))}
              />
            </div>

            {/* Voucher Date */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1">
                <CalendarRange size={10} className="text-primary" /> تاريخ السند <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-[11px] font-black rounded-full px-4 py-2 outline-none focus:border-primary/50 transition-all text-slate-700 dark:text-white shadow-sm"
                value={session.date}
                onChange={(e) => setSession((s) => ({ ...s, date: e.target.value }))}
              />
            </div>

            {/* Voucher Number */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1">
                رقم السند <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-[11px] font-black rounded-full px-4 py-2 outline-none focus:border-primary/50 transition-all text-slate-700 dark:text-white shadow-sm"
                placeholder="رقم السند..."
                value={session.voucher_no || ''}
                onChange={(e) => setSession((s) => ({ ...s, voucher_no: e.target.value }))}
              />
            </div>

            {/* Notes / Customer / Rep */}
            <div className={`${kind === 'outward' ? 'md:col-span-3' : 'md:col-span-4'} space-y-1`}>
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1">
                <Info size={10} className="text-primary" /> ملاحظات إضافية للسند
              </label>
              <input
                type="text"
                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-[11px] font-black rounded-full px-4 py-2 outline-none focus:border-primary/50 transition-all text-slate-700 dark:text-white shadow-sm"
                placeholder="تفاصيل إضافية..."
                value={session.line_note || ''}
                onChange={(e) => setSession((s) => ({ ...s, line_note: e.target.value }))}
              />
            </div>

            {/* Operation Type (Outward Only) */}
            {kind === 'outward' && (
              <div className="md:col-span-1 flex flex-col justify-end pb-1">
                <div className="flex bg-white dark:bg-slate-800 rounded-lg p-0.5 border border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSession(s => ({ ...s, outwardType: 'sale' }))}
                    className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-all ${session.outwardType === 'sale' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
                    title="مبيعات / عهدة"
                  >
                    <Truck size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSession(s => ({ ...s, outwardType: 'transfer', rep: 'بركة الثمار - الرياض' }))}
                    className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-all ${session.outwardType === 'transfer' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600'}`}
                    title="تحويل للمخزن الرئيسي"
                  >
                    <Package size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Attachment Button (Colorful & Animated) */}
            <div className="md:col-span-1 flex flex-col justify-end">
              <div className="flex justify-start pb-0.5">
                <motion.label
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  className={`relative w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all shadow-lg ${
                    session.attachment 
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-emerald-500/30' 
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30'
                  }`}
                  title="المرفق"
                >
                  {session.attachment ? <CheckCircle size={16} strokeWidth={3} /> : <UploadCloud size={16} strokeWidth={3} />}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setSession((s) => ({ ...s, attachment: file }));
                        toast.success('تم إرفاق الملف بنجاح');
                      }
                    }}
                  />
                  {session.attachment && (
                    <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer hover:bg-rose-600 transition-colors"
                         onClick={(e) => { e.preventDefault(); setSession(s => ({ ...s, attachment: null })); }}>
                      <X size={8} strokeWidth={4} />
                    </div>
                  )}
                </motion.label>
              </div>
            </div>
          </div>

          {/* ─── SINGLE ROW ITEM ENTRY ─── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-[2rem] shadow-sm relative">
            {/* Subtle background glow when item is selected */}
            <AnimatePresence>
              {selectedItem && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 0.5 }} 
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 bg-gradient-to-r from-transparent via-${cfg.accent}-500/5 to-transparent pointer-events-none rounded-[2rem]`}
                />
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center relative z-10">
              {/* Item Search */}
              <div className="lg:col-span-5 relative">
                {selectedItem ? (
                  <div className="flex items-center justify-between w-full h-[44px] rounded-full px-5 border-2 border-slate-200 bg-slate-50 text-slate-900 shadow-sm">
                    <div className="truncate text-[13px] font-black flex items-center gap-2">
                      <Package size={18} className="text-emerald-600 shrink-0" />
                      <span>{getItemName(selectedItem)}</span>
                      <span className="text-slate-400 font-bold">-</span>
                      <span className="text-slate-700">{getCompany(selectedItem)}</span>
                    </div>
                    <button type="button" onClick={clearRow} className="shrink-0 p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-full transition-all">
                      <X size={16} strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <div className="relative group">
                    <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                      ref={itemNameRef}
                      type="text"
                      className="w-full h-[44px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 text-[12px] font-black rounded-full px-12 outline-none focus:border-primary/50 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder-slate-400 shadow-sm"
                      placeholder="ابحث عن صنف للتكملة التلقائية..."
                      value={searchNameText}
                      onChange={(e) => { setSearchNameText(e.target.value); setSearchIdx(-1); }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx((p) => (p < itemSuggestions.length - 1 ? p + 1 : p)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx((p) => (p > 0 ? p - 1 : 0)); }
                        else if (e.key === 'Enter') {
                          if (searchIdx >= 0 && itemSuggestions[searchIdx]) {
                            e.preventDefault(); handleSelect(itemSuggestions[searchIdx]);
                          } else if (selectedItem && draftQty > 0) {
                            e.preventDefault(); pushDraft();
                          }
                        }
                      }}
                    />
                    
                    {/* ─── SUGGESTIONS DROPDOWN ─── */}
                    <AnimatePresence>
                      {(itemSuggestions.length > 0 || (searchNameText.length >= 2 && !selectedItem)) && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[999] overflow-hidden max-h-[350px] overflow-y-auto custom-scrollbar"
                        >
                          {itemSuggestions.length > 0 ? (
                            itemSuggestions.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className={`p-4 cursor-pointer flex items-center justify-between transition-all border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${idx === searchIdx ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                onClick={() => handleSelect(item)}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[12px] font-black">{getItemName(item)}</span>
                                  <span className="text-[10px] text-slate-400 font-bold">{getCompany(item)}</span>
                                </div>
                                <div className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                                  {getCategory(item)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center flex flex-col items-center gap-3">
                               <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center text-slate-300">
                                  <Search size={20} strokeWidth={1.5} />
                               </div>
                               <div className="space-y-1">
                                  <p className="text-xs font-black text-slate-600 dark:text-slate-300">لم يتم العثور على نتائج لـ "{searchNameText}"</p>
                                  <p className="text-[10px] font-bold text-slate-400">تأكد من كتابة اسم الصنف أو الشركة بشكل صحيح</p>
                               </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="lg:col-span-2">
                <input
                  id={`voucher-qty-${kind}`}
                  type="number" min="1"
                  disabled={!selectedItem}
                  className={`w-full h-[44px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 text-center text-[14px] font-black rounded-full outline-none transition-all ${selectedItem ? 'focus:border-primary/50 focus:bg-white focus:ring-4 focus:ring-primary/10' : 'opacity-50 cursor-not-allowed'}`}
                  placeholder="كمية"
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') { 
                      e.preventDefault(); 
                      if (selectedItem && draftQty > 0) pushDraft(); 
                    } 
                  }}
                />
              </div>

              {/* Category & Unit */}
              <div className="lg:col-span-4 flex gap-2">
                <div className={`flex-1 h-[44px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-full flex items-center justify-center text-[11px] font-black text-slate-500 truncate px-3 transition-opacity ${!selectedItem ? 'opacity-50' : ''}`} title="القسم">
                  {selectedItem ? getCategory(selectedItem) : 'القسم'}
                </div>
                <div className={`flex-1 relative group h-[44px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-full flex items-center justify-center px-3 transition-all ${!selectedItem ? 'opacity-70' : 'hover:border-primary/40'}`} title="الوحدة">
                    {/* Floating Colorful + Button - Always Visible but Dimmed when Idle */}
                    <button 
                      type="button"
                      id={`unit-plus-btn-${kind}`}
                      className={`absolute -top-2.5 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all z-20 ${
                        !selectedItem 
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50' 
                          : 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white hover:scale-110'
                      }`}
                      onClick={() => {
                        if (!selectedItem) {
                           toast.info('يرجى اختيار صنف أولاً لتعديل وحدته');
                           return;
                        }
                        const input = document.getElementById(`unit-input-${kind}`);
                        if (input) {
                          input.focus();
                          input.select();
                        }
                      }}
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>

                    {selectedItem ? (
                      <input 
                        id={`unit-input-${kind}`}
                        type="text"
                        className="w-full h-full text-center bg-transparent outline-none text-[11px] font-black text-slate-700 dark:text-slate-200 placeholder-slate-400"
                        value={draftUnit}
                        onChange={(e) => setDraftUnit(e.target.value)}
                        placeholder={getUnit(selectedItem) || 'الوحدة'}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') { 
                            e.preventDefault(); 
                            if (draftQty > 0) pushDraft(); 
                          } 
                        }}
                      />
                    ) : (
                      <span className="text-[11px] font-black text-slate-400">الوحدة</span>
                    )}
                </div>
              </div>

              {/* Action Button (Add/Update) */}
              <div className="lg:col-span-1">
                <motion.button
                  whileHover={selectedItem ? { scale: 1.05 } : {}}
                  whileTap={selectedItem ? { scale: 0.95 } : {}}
                  type="button"
                  onClick={(e) => { 
                    e.preventDefault(); 
                    if (!selectedItem) {
                      toast.error('يرجى اختيار صنف أولاً من قائمة البحث');
                      itemNameRef.current?.focus();
                      return;
                    }
                    pushDraft(); 
                  }}
                  className={`w-11 h-11 flex items-center justify-center rounded-full text-white transition-all shadow-lg relative overflow-hidden ${
                    editingDraftId 
                      ? 'bg-amber-500 hover:bg-amber-600' 
                      : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-95'
                  }`}
                  title={editingDraftId ? 'تحديث السطر (Enter)' : 'إضافة للجدول (Enter)'}
                >
                  <motion.div 
                    layoutId="ping"
                    className="absolute inset-0 bg-white/20 rounded-full"
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  {editingDraftId ? (
                    <RefreshCw size={22} strokeWidth={3} className="animate-spin-slow" />
                  ) : (
                    <Plus size={28} strokeWidth={3} className="relative z-10" />
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {/* ─── PREMIUM TABLE AREA ─── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4">
               <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Package size={16} className="text-primary" />
                  قائمة المحتويات
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {modalDrafts.length}
                  </span>
               </h4>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-black text-[8px] uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-2 w-10 text-center">م</th>
                    <th className="px-4 py-2">الصنف</th>
                    <th className="px-4 py-2">الشركة</th>
                    <th className="px-4 py-2 text-center">الكمية</th>
                    <th className="px-4 py-2 text-center">القسم</th>
                    <th className="px-4 py-2 text-center">الوحدة</th>
                    <th className="px-4 py-2 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  <AnimatePresence initial={false}>
                    {modalDrafts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-10 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <Box size={24} strokeWidth={1} />
                            <span className="font-black text-[10px]">ابدأ بإضافة الأصناف أعلاه</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      modalDrafts.map((d, idx) => (
                        <motion.tr 
                          key={d.draftId} 
                          layout
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${editingDraftId === d.draftId ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}`}
                        >
                          <td className="px-4 py-1.5 text-center text-[9px] font-black text-slate-300">{modalDrafts.length - idx}</td>
                          <td className="px-4 py-1.5">
                            <div className="font-black text-slate-800 dark:text-white text-xs">{d.item}</div>
                          </td>
                          <td className="px-4 py-1.5">
                            <div className="text-[9px] font-black text-slate-400">{d.company || '—'}</div>
                          </td>
                          <td className="px-4 py-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded-md font-black text-xs ${theme.qtyBadge}`}>
                              {d.qty}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-center text-[9px] font-bold text-slate-500">{d.cat}</td>
                          <td className="px-4 py-1.5 text-center text-[10px] font-black text-slate-400">{d.unit}</td>
                          <td className="px-4 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => handleEditDraft(d)} className="w-7 h-7 flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"><Pencil size={12} /></button>
                              <button type="button" onClick={() => setModalDrafts(p => p.filter(x => x.draftId !== d.draftId))} className="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
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
        height="h-auto"
        submitLabel="حفظ التغييرات"
        loading={loading}
        accent={cfg.accent}
      >
        <div className="space-y-5">
          <div>
            <label className={LabelClass}>الكمية</label>
            <input
              type="number"
              min="1"
              className="InputClass text-center text-lg"
              value={editForm.qty}
              onChange={(e) => setEditForm((f) => ({ ...f, qty: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={LabelClass}>التاريخ</label>
            <input
              type="date"
              className="InputClass"
              value={editForm.date}
              onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={LabelClass}>ملاحظات السطر</label>
            <input
              type="text"
              className="InputClass"
              placeholder="أضف ملاحظة لهذا الصنف..."
              value={editForm.lineNote}
              onChange={(e) => setEditForm((f) => ({ ...f, lineNote: e.target.value }))}
            />
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper
        title="تأكيد حذف السطر"
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onSubmit={handleDeleteSubmit}
        maxWidth="max-w-md"
        height="h-auto"
        submitLabel="نعم، احذف السطر"
        loading={loading}
        accent="rose"
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-20 h-20 bg-status-danger/10 rounded-full flex items-center justify-center text-status-danger mb-4">
            <AlertTriangle size={40} />
          </div>
          <h4 className="text-xl font-black text-slate-800 dark:text-white mb-2">هل أنت متأكد؟</h4>
          <p className="text-slate-500 dark:text-slate-400 font-bold">سيتم حذف هذا الصنف من السند نهائياً. لا يمكن التراجع عن هذا الإجراء.</p>
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
        height="h-auto"
        submitLabel="نعم، احذف السند كاملاً"
        loading={loading}
        accent="rose"
      >
        <div className="flex flex-col items-center text-center py-4 space-y-4">
          <div className="w-20 h-20 bg-status-danger/10 rounded-full flex items-center justify-center text-status-danger mb-2">
            <Trash2 size={40} />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-800 dark:text-white mb-2">حذف السند رقم {groupToDelete?.voucherCode}</h4>
            <p className="text-slate-500 dark:text-slate-400 font-bold">
              سيتم إلغاء السند وجميع أسطره الملحقة به ({groupToDelete?.lineCount} أصناف). سيتم إرجاع كافة الكميات للمخزن تلقائياً وسيبقى السند في السجلات كـ "ملغي".
            </p>
          </div>
        </div>
      </ModalWrapper>

      {/* ═══ Reset Invoice Status Confirmation (Professional Mode) ═══ */}
      <ModalWrapper
        title="إلغاء فوترة السند"
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onSubmit={handleResetStatusSubmit}
        maxWidth="max-w-md"
        submitLabel="إلغاء الفوترة وفتح السند"
        loading={loading}
        accent="orange"
        height="h-auto"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-100 shadow-inner">
            <RefreshCw size={32} className="animate-spin-slow" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">هل تريد إلغاء فوترة هذا السند؟</h3>
          <p className="text-sm font-bold text-slate-500 leading-relaxed">
            هذا السند تم إصدار فاتورة له مسبقاً. إلغاء الفوترة سيقوم بفتحه للتعديل أو الحذف، وسيحذف سجل التاريخ الخاص بالفاتورة المرتبطة به.
          </p>
          <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-400">
             * فك القفل نفسه لا يغير المخزن، ولكن أي تعديل تجريه على السند لاحقاً سيحدث المخزن تلقائياً.
          </div>
        </div>
      </ModalWrapper>

      {/* ── Confirm Close Modal ── */}
      <ModalWrapper
        title="تأكيد الخروج"
        isOpen={isConfirmCloseOpen}
        onClose={() => setIsConfirmCloseOpen(false)}
        onSubmit={(e) => { e.preventDefault(); closeAddModal(); }}
        maxWidth="max-w-sm"
        height="h-auto"
        submitLabel="نعم، تخلص من المسودة"
        loading={false}
        accent="rose"
      >
        <div className="flex flex-col items-center text-center py-4 space-y-4">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-2">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-800 dark:text-white mb-2">تجاهل التغييرات؟</h4>
            <p className="text-slate-500 dark:text-slate-400 font-bold">
              لديك أصناف لم يتم حفظها في المسودة. هل أنت متأكد من رغبتك في الخروج (Enter)؟
            </p>
          </div>
        </div>
      </ModalWrapper>

      {/* ── Confirm Save Modal ── */}
      <ModalWrapper
        title="تأكيد حفظ السند"
        isOpen={isConfirmSaveOpen}
        onClose={() => setIsConfirmSaveOpen(false)}
        onSubmit={executeSave}
        maxWidth="max-w-sm"
        height="h-auto"
        submitLabel="نعم، احفظ السند"
        loading={loading}
        accent={cfg.accent}
      >
        <div className="flex flex-col items-center text-center py-4 space-y-4">
          <div className={`w-16 h-16 bg-${cfg.accent}-500/10 rounded-full flex items-center justify-center text-${cfg.accent}-500 mb-2`}>
            <CheckCircle size={32} />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-800 dark:text-white mb-2">تأكيد الحفظ</h4>
            <p className="text-slate-500 dark:text-slate-400 font-bold">
              هل أنت متأكد من حفظ هذا السند وإدراجه في النظام نهائياً (Enter)؟
            </p>
          </div>
        </div>
      </ModalWrapper>

      {/* ── Details Popup Modal ── */}
      <ModalWrapper
        title={expandedGroupId ? (() => {
          const g = voucherGroups.find(x => x.groupId === expandedGroupId);
          if (!g) return 'تفاصيل السند';
          const typeLabel = kind === 'in' ? 'إدخال' : 'إخراج';
          const partyLabel = kind === 'in' ? 'المورد' : 'المستفيد';
          const partyName = kind === 'in' ? g.supplier : g.rep;
          return `تفاصيل سند ${typeLabel} - ${partyLabel}: ${partyName || '—'}`;
        })() : 'تفاصيل السند'}
        isOpen={!!expandedGroupId}
        onClose={() => setExpandedGroupId(null)}
        maxWidth="max-w-5xl"
        height="h-auto"
        hideFooter={true}
        accent={cfg.accent}
      >
        {expandedGroupId && (() => {
          const g = voucherGroups.find(x => x.groupId === expandedGroupId);
          if (!g) return null;
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 mb-1 uppercase">رقم السند</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{g.voucherCode || '—'}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 mb-1 uppercase">تاريخ السند</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{g.date}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 mb-1 uppercase">إجمالي القطع</p>
                  <p className="text-sm font-black text-primary">{g.lines.filter(l => !l.is_summary).reduce((sum, l) => sum + Number(l.qty || 0), 0)}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-black uppercase text-[9px] tracking-widest">
                    <tr>
                      <th className="px-4 py-3 text-center w-10">م</th>
                      <th className="px-4 py-3">اسم الصنف</th>
                      <th className="px-4 py-3">الشركة</th>
                      <th className="px-4 py-3 text-center">الكمية</th>
                      <th className="px-4 py-3 text-center">القسم</th>
                      <th className="px-4 py-3 text-center">وحدة القياس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {g.lines.filter(l => !l.is_summary).map((l, idx) => (
                      <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors font-bold">
                        <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{l.item}</td>
                        <td className="px-4 py-3 text-slate-500">{l.company || '—'}</td>
                        <td className="px-4 py-3 text-center font-black text-emerald-600 tabular-nums">{l.qty}</td>
                        <td className="px-4 py-3 text-center text-slate-500 text-[10px]">{l.cat || '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-500 text-[10px]">{l.unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
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
