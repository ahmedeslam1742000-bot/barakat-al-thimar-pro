/**
 * WarehouseInsights.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * READ-ONLY / LOCAL-ONLY view for the Storekeeper.
 *
 * ✅ Daily Logs      → reads Firestore transactions (TODAY). Zero writes.
 * ✅ Notepad          → stores ONLY in localStorage. Never touches Firestore.
 * ✅ Pre-Inventory    → reads Firestore items (stock levels). Zero writes.
 *
 * ⛔ Nothing in this file modifies stockQty, transactions, or any Firestore doc.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Activity, StickyNote, ListChecks,
  Search, Calendar, Clock, Filter,
  TrendingUp, TrendingDown, RotateCcw, FileText, Package,
  Plus, Trash2, AlertCircle, CheckCircle2, Info,
  ChevronUp, ChevronDown, ShieldCheck, Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { normalizeArabic } from '../lib/arabicTextUtils';

// ─── Constants & helpers ─────────────────────────────────────────────────────
const LOCAL_KEY = 'warehouse_notepad_v1';

const todayISO = () => new Date().toISOString().split('T')[0];

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const TX_META = {
  'وارد':              { label: 'وارد',       icon: TrendingUp,   cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  'صادر':              { label: 'صادر',       icon: TrendingDown, cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  'مرتجع':             { label: 'مرتجع',      icon: RotateCcw,    cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  'سند إدخال':    { label: 'إدخال سند',  icon: FileText,     cls: 'bg-teal-50 text-teal-600 border-teal-200' },
  'سند إخراج':    { label: 'إخراج سند',  icon: FileText,     cls: 'bg-purple-50 text-purple-600 border-purple-200' },
};
const getTxMeta = (type) =>
  TX_META[type] || { label: type || '—', icon: Package, cls: 'bg-slate-50 text-slate-500 border-slate-200' };

// ─── Root Component ──────────────────────────────────────────────────────────
export default function WarehouseInsights() {
  const [tab, setTab] = useState('daily');
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);

  // ── SUPABASE Reads (zero writes) ──
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: transData } = await supabase.from('transactions').select('id, date, timestamp, type, item, company, qty, unit, line_note, note, voucher_supply_notes').order('timestamp', { ascending: false });
      if (transData) setTransactions(transData);

      const { data: itemsData } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty');
      if (itemsData) setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty })));
    };

    fetchInitialData();

    const channels = [
      supabase.channel('public:transactions:insights').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData).subscribe(),
      supabase.channel('public:products:insights').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData).subscribe()
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  const TABS = [
    { id: 'daily',     label: 'سجل اليوم',      icon: Activity },
    { id: 'notepad',   label: 'مذكرة الفوارق',  icon: StickyNote },
    { id: 'preinv',    label: 'مرجع ما قبل الجرد', icon: ListChecks },
  ];

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col gap-6 animate-in fade-in duration-500 font-readex" dir="rtl">

      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 shrink-0">
            <Eye size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">نظرة المستودع</h1>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100 shadow-sm">
                <Lock size={12} /> وضع القراءة
              </span>
            </div>
            <p className="text-slate-400 mt-1 font-bold text-sm">عرض داخلي للأمين — لا يؤثر على الأرصدة أو البيانات المالية</p>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1.5 bg-slate-100/50 p-1.5 rounded-2xl w-fit flex-wrap border border-slate-200/50">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-black text-sm transition-all duration-300 ${
                tab === id
                  ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              <Icon size={18} className={tab === id ? 'text-indigo-600' : 'text-slate-400'} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content area ── */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {tab === 'daily'   && <Slide key="daily">   <DailyLog   transactions={transactions} /> </Slide>}
          {tab === 'notepad' && <Slide key="notepad"> <Notepad /> </Slide>}
          {tab === 'preinv'  && <Slide key="preinv">  <PreInventory items={items} /> </Slide>}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Slide({ children }) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
//  TAB 1 — DAILY LOG  (read-only, Firestore)
// ═══════════════════════════════════════════════════════
function DailyLog({ transactions }) {
  const [date, setDate]       = useState(todayISO());
  const [typeF, setTypeF]     = useState('all');
  const [search, setSearch]   = useState('');

  const rows = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate =
        tx.date ||
        (tx.timestamp
          ? new Date(tx.timestamp).toISOString().split('T')[0]
          : '');
      if (date && txDate !== date) return false;
      if (typeF !== 'all' && tx.type !== typeF) return false;
      if (search.trim()) {
        const q = normalizeArabic(search);
        return (
          normalizeArabic(tx.item    || '').includes(q) ||
          normalizeArabic(tx.company || '').includes(q)
        );
      }
      return true;
    });
  }, [transactions, date, typeF, search]);

  // Quick summary for the chosen date
  const summary = useMemo(() => {
    const inRows  = rows.filter(r => r.type === 'وارد');
    const outRows = rows.filter(r => r.type === 'صادر');
    const retRows = rows.filter(r => r.type === 'مرتجع');
    const sum = (arr) => arr.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    return {
      total: rows.length,
      inQty:  sum(inRows),
      outQty: sum(outRows),
      retQty: sum(retRows),
    };
  }, [rows]);

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">

      {/* Read-only notice */}
      <ReadOnlyBadge text="البيانات أدناه للعرض والتدقيق اليومي فقط — لا توجد أي عمليات كتابة أو تعديل" />

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <MiniStat label="إجمالي العمليات" value={summary.total}  color="indigo" icon={Activity} />
        <MiniStat label="إجمالي الوارد"     value={summary.inQty}  color="emerald" icon={TrendingUp} />
        <MiniStat label="إجمالي الصادر"     value={summary.outQty} color="orange" icon={TrendingDown} />
        <MiniStat label="إجمالي المرتجع"    value={summary.retQty} color="amber" icon={RotateCcw} />
      </div>

      {/* Filter row */}
      <div className="bg-white border border-slate-100 p-5 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-3 rounded-2xl border border-slate-200/50 flex-1 md:flex-none md:min-w-[200px]">
          <Calendar size={18} className="text-slate-400 shrink-0" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm font-black text-slate-800 outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-3 rounded-2xl border border-slate-200/50 flex-1 md:flex-none md:min-w-[200px]">
          <Filter size={18} className="text-slate-400 shrink-0" />
          <select
            value={typeF}
            onChange={(e) => setTypeF(e.target.value)}
            className="bg-transparent text-sm font-black text-slate-800 outline-none w-full cursor-pointer appearance-none"
          >
            <option value="all">جميع أنواع العمليات</option>
            <option value="وارد">عمليات الوارد</option>
            <option value="صادر">عمليات الصادر</option>
            <option value="مرتجع">عمليات المرتجع</option>
            <option value="سند إدخال">سندات الإدخال</option>
            <option value="سند إخراج">سندات الإخراج</option>
          </select>
        </div>

        <div className="relative flex-1 group">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن صنف أو شركة..."
            className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 font-black text-sm rounded-2xl pr-11 pl-4 py-3 outline-none focus:bg-white focus:border-indigo-500/20 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
          />
        </div>

        <button
          type="button"
          onClick={() => { setDate(todayISO()); setTypeF('all'); setSearch(''); }}
          className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors py-3 px-5 rounded-2xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
        >
          إعادة ضبط
        </button>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden flex flex-col flex-1 shadow-sm">
        <div className="h-full overflow-x-auto overflow-y-auto custom-scrollbar">
          {rows.length === 0 ? (
            <EmptyState icon={Activity} title="لا توجد عمليات مسجلة" sub="حاول تغيير معايير البحث أو التاريخ المختار" />
          ) : (
            <table className="w-full text-right text-sm whitespace-nowrap border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 backdrop-blur-md border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider text-[11px]">
                  <th className="px-8 py-5 rounded-tr-[2rem]">الوقت</th>
                  <th className="px-6 py-5">النوع</th>
                  <th className="px-6 py-5">الصنف والمواصفات</th>
                  <th className="px-6 py-5 text-center">الكمية</th>
                  <th className="px-6 py-5">الوحدة</th>
                  <th className="px-8 py-5 rounded-tl-[2rem]">ملاحظات العملية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((tx) => {
                  const m = getTxMeta(tx.type);
                  const Icon = m.icon;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                      <td className="px-8 py-5">
                        <span className="flex items-center gap-2.5 text-xs font-black text-slate-400 group-hover:text-slate-600 transition-colors">
                          <Clock size={14} className="opacity-70" />
                          <span dir="ltr" className="tracking-tight">{fmtTime(tx.timestamp)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border shadow-sm ${m.cls}`}>
                          <Icon size={12} />
                          {m.label}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors tracking-tight text-base">{tx.item || '—'}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{tx.company || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-xl font-black text-sm shadow-sm ${m.cls}`}>{tx.qty ?? '—'}</span>
                      </td>
                      <td className="px-6 py-5 font-black text-slate-500 text-xs">{tx.unit || '—'}</td>
                      <td className="px-8 py-5 text-[11px] font-bold text-slate-400 max-w-[250px] truncate italic group-hover:text-slate-600 transition-colors">
                        {tx.lineNote || tx.note || tx.supplyNotes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  TAB 2 — NOTEPAD  (100% localStorage — zero Firestore)
// ═══════════════════════════════════════════════════════
const NOTE_TAGS = ['نقص', 'تلف', 'مشكوك فيه', 'للمراجعة', 'عادي'];
const TAG_COLORS = {
  'نقص':         'bg-rose-50 text-rose-600 border-rose-200',
  'تلف':         'bg-orange-50 text-orange-600 border-orange-200',
  'مشكوك فيه':  'bg-amber-50 text-amber-600 border-amber-200',
  'للمراجعة':   'bg-blue-50 text-blue-600 border-blue-200',
  'عادي':        'bg-slate-50 text-slate-500 border-slate-200',
};

function Notepad() {
  const [notes, setNotes]       = useState([]);
  const [draft, setDraft]       = useState('');
  const [draftTag, setDraftTag] = useState('للمراجعة');
  const [search, setSearch]     = useState('');
  const textareaRef             = useRef(null);

  // Load from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(LOCAL_KEY);
      if (stored) setNotes(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Save to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  }, [notes]);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const note = {
      id: `note_${Date.now()}`,
      text,
      tag: draftTag,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    setDraft('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const deleteNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));
  const clearAll   = () => {
    if (window.confirm('هل تريد حذف جميع الملاحظات؟')) setNotes([]);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = normalizeArabic(search);
    return notes.filter(n => normalizeArabic(n.text).includes(q) || normalizeArabic(n.tag || '').includes(q));
  }, [notes, search]);

  const fmtNoteDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">

      {/* Local-only badge */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-4 rounded-[1.5rem] bg-violet-50 border border-violet-100 shadow-sm shadow-violet-500/5">
        <ShieldCheck size={20} className="text-violet-500 shrink-0" />
        <p className="text-sm font-black text-violet-800 leading-relaxed tracking-tight">
          هذه المذكرة <span className="underline decoration-violet-300 decoration-2 underline-offset-4">محلية تماماً</span> — تُحفظ في متصفحك فقط لمساعدتك في المتابعة اليومية.
        </p>
      </div>

      {/* Input box */}
      <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-5 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <StickyNote size={20} className="text-violet-500" />
          <span className="text-sm font-black text-slate-800 uppercase tracking-widest">تدوين ملاحظة سريعة</span>
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }}
          rows={3}
          placeholder="مثال: وجدت 3 كراتين تالفة في الرف العلوي ... أو: رصيد الصنف X يحتاج مراجعة"
          className="w-full bg-slate-50 border-2 border-slate-100 text-slate-800 text-base font-black rounded-2xl px-5 py-4 outline-none resize-none placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500/30 focus:bg-white transition-all shadow-inner"
        />
        <div className="flex items-center justify-between gap-6 flex-wrap">
          {/* Tag selector */}
          <div className="flex gap-2 flex-wrap">
            {NOTE_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDraftTag(t)}
                className={`px-5 py-2 rounded-xl text-[11px] font-black border-2 transition-all duration-300 ${
                  draftTag === t
                    ? TAG_COLORS[t] + ' border-current shadow-lg shadow-violet-500/10 scale-105'
                    : 'border-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <span className="text-[10px] font-black text-slate-400 hidden sm:block italic tracking-widest">Ctrl + Enter للحفظ</span>
            <button
              type="button"
              onClick={addNote}
              disabled={!draft.trim()}
              className="px-8 py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-br from-violet-600 to-indigo-700 shadow-xl shadow-violet-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-40 disabled:grayscale"
            >
              <Plus size={20} />
              حفظ الملاحظة
            </button>
          </div>
        </div>
      </div>

      {/* Search + List Header */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative flex-1 group">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الملاحظات المدونة..."
            className="w-full bg-white border border-slate-100 text-slate-800 font-black text-sm rounded-2xl pr-11 pl-4 py-3 outline-none focus:ring-4 focus:ring-violet-500/5 focus:border-violet-500/20 transition-all shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={clearAll}
          disabled={notes.length === 0}
          className="text-[10px] font-black text-rose-500 hover:bg-rose-50 px-5 py-3 rounded-xl border border-transparent hover:border-rose-100 transition-all disabled:opacity-0"
        >
          حذف الكل
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pb-8">
        {filtered.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title={notes.length === 0 ? 'مذكرتك فارغة حالياً' : 'لم نجد ملاحظات تطابق بحثك'}
            sub={notes.length === 0 ? 'ابدأ بتدوين الملاحظات اليومية لمتابعتها لاحقاً' : 'جرب استخدام كلمات بحث مختلفة'}
          />
        ) : (
          <AnimatePresence>
            {filtered.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-start gap-5 group hover:shadow-xl hover:shadow-slate-200/50 hover:border-violet-200 transition-all duration-500"
              >
                {/* Tag Badge */}
                <span className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black border shadow-sm ${TAG_COLORS[note.tag] || TAG_COLORS['عادي']}`}>
                  {note.tag}
                </span>
                {/* Text Content */}
                <div className="flex-1 min-w-0 space-y-3">
                  <p className="text-lg font-black text-slate-800 whitespace-pre-wrap leading-relaxed tracking-tight group-hover:text-violet-700 transition-colors">{note.text}</p>
                  <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Clock size={12} className="opacity-70" />
                    <span>{fmtNoteDate(note.createdAt)}</span>
                  </div>
                </div>
                {/* Delete Action */}
                <button
                  type="button"
                  onClick={() => deleteNote(note.id)}
                  className="shrink-0 p-3 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all duration-300"
                >
                  <Trash2 size={20} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  TAB 3 — PRE-INVENTORY  (read-only stock snapshot)
// ═══════════════════════════════════════════════════════
function PreInventory({ items }) {
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sortCol, setSortCol]   = useState('name');
  const [sortAsc, setSortAsc]   = useState(true);

  const categories = useMemo(() => {
    const cats = [...new Set(items.map(i => i.cat || 'أخرى'))];
    return cats.sort();
  }, [items]);

  const sorted = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = normalizeArabic(search);
      list = list.filter(i =>
        normalizeArabic(i.name    || '').includes(q) ||
        normalizeArabic(i.company || '').includes(q) ||
        normalizeArabic(i.cat     || '').includes(q)
      );
    }
    if (catFilter !== 'all') list = list.filter(i => (i.cat || 'أخرى') === catFilter);
    list.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol === 'stockQty') { va = Number(va); vb = Number(vb); }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [items, search, catFilter, sortCol, sortAsc]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp size={11} className="inline mr-1" /> : <ChevronDown size={11} className="inline mr-1" />;
  };

  // Stock health colour
  const qtyColor = (qty) => {
    if (qty == null) return 'text-slate-400';
    if (qty <= 0)   return 'text-rose-600 font-black';
    if (qty < 50)   return 'text-orange-600 font-black';
    return 'text-emerald-600 font-black';
  };

  const qtyBg = (qty) => {
    if (qty == null || qty <= 0) return 'bg-rose-50 border-rose-100';
    if (qty < 50) return 'bg-orange-50 border-orange-100';
    return 'bg-emerald-50 border-emerald-100';
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">

      <ReadOnlyBadge text={`${items.length} صنف مسجل في النظام — يُستخدم كمرجع للمقارنة اليدوية مع الرفوف`} />

      {/* Filters */}
      <div className="bg-white border border-slate-100 p-5 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-4 shrink-0 shadow-sm">
        <div className="relative flex-1 group">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الشركة، أو القسم..."
            className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 font-black text-sm rounded-2xl pr-11 pl-4 py-3 outline-none focus:bg-white focus:border-indigo-500/20 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-3 rounded-2xl border border-slate-200/50 flex-1 md:flex-none md:min-w-[200px]">
          <Filter size={18} className="text-slate-400 shrink-0" />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="bg-transparent text-sm font-black text-slate-800 outline-none w-full cursor-pointer appearance-none"
          >
            <option value="all">جميع الأقسام</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {(search || catFilter !== 'all') && (
          <button
            type="button"
            onClick={() => { setSearch(''); setCatFilter('all'); }}
            className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors py-3 px-5 rounded-2xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-4 flex-wrap">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">دليل الرصيد:</span>
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          كافٍ (≥ 50)
        </span>
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black border border-orange-100 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          منخفض (&lt; 50)
        </span>
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black border border-rose-100 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          نافد (= 0)
        </span>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden flex flex-col flex-1 shadow-sm">
        <div className="h-full overflow-x-auto overflow-y-auto custom-scrollbar">
          {sorted.length === 0 ? (
            <EmptyState icon={ListChecks} title="لا توجد أصناف تطابق البحث" sub="تأكد من كتابة الاسم بشكل صحيح أو تغيير القسم المختار" />
          ) : (
            <table className="w-full text-right text-sm whitespace-nowrap border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 backdrop-blur-md border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider text-[11px]">
                  {[
                    { col: 'name',     label: 'اسم الصنف والمواصفات' },
                    { col: 'company',  label: 'الشركة' },
                    { col: 'cat',      label: 'القسم' },
                    { col: 'unit',     label: 'الوحدة' },
                    { col: 'stockQty', label: 'رصيد النظام' },
                  ].map(({ col, label }, i) => (
                    <th
                      key={col}
                      className={`px-8 py-5 cursor-pointer hover:text-indigo-600 transition-colors select-none ${i === 0 ? 'rounded-tr-[2rem]' : ''}`}
                      onClick={() => toggleSort(col)}
                    >
                      <div className="flex items-center gap-2">
                        {label}
                        <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                  <th className="px-8 py-5 rounded-tl-[2rem]">تقييم الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((item) => {
                  const qty = item.stockQty;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                      <td className="px-8 py-5 font-black text-slate-800 group-hover:text-indigo-600 transition-colors tracking-tight text-base">{item.name || '—'}</td>
                      <td className="px-8 py-5 font-black text-slate-500 text-xs">{item.company || '—'}</td>
                      <td className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-opacity">{item.cat || '—'}</td>
                      <td className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-opacity">{item.unit || '—'}</td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center justify-center min-w-[60px] px-4 py-2 rounded-xl text-base font-black border shadow-sm ${qtyBg(qty)} ${qtyColor(qty)}`}>
                          {qty ?? '—'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        {qty == null ? (
                          <StatusChip color="slate" label="غير محدد" />
                        ) : qty <= 0 ? (
                          <StatusChip color="rose" label="نافد الرصيد" icon={AlertCircle} />
                        ) : qty < 50 ? (
                          <StatusChip color="amber" label="رصيد منخفض" icon={Info} />
                        ) : (
                          <StatusChip color="emerald" label="رصيد كافٍ" icon={CheckCircle2} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  Shared sub-components
// ═══════════════════════════════════════════════════════
function ReadOnlyBadge({ text }) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-5 py-3 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm shadow-indigo-500/5">
      <Eye size={16} className="text-indigo-400 shrink-0" />
      <p className="text-xs font-black text-indigo-600 tracking-tight">{text}</p>
    </div>
  );
}

const MINI_COLORS = {
  indigo:  'from-indigo-600 to-violet-700 shadow-indigo-500/20',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
  orange:    'from-orange-500 to-rose-600 shadow-orange-500/20',
  amber:   'from-amber-500 to-orange-500 shadow-amber-500/20',
};

function MiniStat({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-5 flex items-center gap-5 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${MINI_COLORS[color]} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-500`}>
        {Icon ? <Icon size={24} /> : <span className="text-sm font-black">{value}</span>}
      </div>
      <div className="overflow-hidden">
        <p className="text-2xl font-black text-slate-800 leading-tight tracking-tight group-hover:translate-x-1 transition-transform duration-500">{value}</p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight mt-1">{label}</p>
      </div>
    </div>
  );
}

function StatusChip({ color, label, icon: Icon }) {
  const map = {
    rose:    'bg-rose-50 text-rose-600 border-rose-100',
    amber:   'bg-orange-50 text-orange-600 border-orange-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    slate:   'bg-slate-50 text-slate-500 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black border shadow-sm ${map[color]}`}>
      {Icon && <Icon size={12} />}
      {label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-slate-400">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
        <Icon size={40} className="opacity-20 text-slate-400" />
      </div>
      <p className="font-black text-xl text-slate-800 tracking-tight">{title}</p>
      {sub && <p className="text-sm mt-2 font-bold opacity-60 max-w-xs text-center leading-relaxed">{sub}</p>}
    </div>
  );
}
