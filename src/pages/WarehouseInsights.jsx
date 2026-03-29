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
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';

// ─── Constants & helpers ─────────────────────────────────────────────────────
const LOCAL_KEY = 'warehouse_notepad_v1';

const todayISO = () => new Date().toISOString().split('T')[0];

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const TX_META = {
  'وارد':              { label: 'وارد',       icon: TrendingUp,   cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
  'صادر':              { label: 'صادر',       icon: TrendingDown, cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' },
  'مرتجع':             { label: 'مرتجع',      icon: RotateCcw,    cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' },
  'سند إدخال صوري':    { label: 'إدخال سند',  icon: FileText,     cls: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/30' },
  'سند إخراج صوري':    { label: 'إخراج سند',  icon: FileText,     cls: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30' },
};
const getTxMeta = (type) =>
  TX_META[type] || { label: type || '—', icon: Package, cls: 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700' };

// ─── Root Component ──────────────────────────────────────────────────────────
export default function WarehouseInsights() {
  const [tab, setTab] = useState('daily');
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);

  // ── Firestore reads (zero writes) ──
  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, 'transactions'), orderBy('timestamp', 'desc')),
      (s) => setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(
      query(collection(db, 'items')),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); };
  }, []);

  const TABS = [
    { id: 'daily',     label: 'سجل اليوم',      icon: Activity },
    { id: 'notepad',   label: 'مذكرة الفوارق',  icon: StickyNote },
    { id: 'preinv',    label: 'مرجع ما قبل الجرد', icon: ListChecks },
  ];

  return (
    <div className="h-full w-full flex flex-col gap-4 font-['Cairo']" dir="rtl">

      {/* ── Page header ── */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 shrink-0">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
            <Eye size={22} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800 dark:text-white">نظرة المستودع</h2>
              <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                <Lock size={9} /> قراءة فقط
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
              عرض داخلي للأمين — لا يؤثر على أرصدة المخزن أو البيانات المالية
            </p>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1.5 bg-slate-100/80 dark:bg-slate-900/50 p-1 rounded-2xl w-fit flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all ${
                tab === id
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content area ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
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
        (tx.timestamp instanceof Timestamp
          ? tx.timestamp.toDate().toISOString().split('T')[0]
          : '');
      if (date && txDate !== date) return false;
      if (typeF !== 'all' && tx.type !== typeF) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (tx.item    || '').toLowerCase().includes(q) ||
          (tx.company || '').toLowerCase().includes(q)
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
    <div className="h-full flex flex-col gap-3 overflow-hidden">

      {/* Read-only notice */}
      <ReadOnlyBadge text="البيانات أدناه للعرض فقط — لا توجد أي عمليات كتابة" />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        <MiniStat label="إجمالي العمليات" value={summary.total}  color="indigo" />
        <MiniStat label="وارد (وحدة)"     value={summary.inQty}  color="emerald" />
        <MiniStat label="صادر (وحدة)"     value={summary.outQty} color="blue" />
        <MiniStat label="مرتجع (وحدة)"    value={summary.retQty} color="amber" />
      </div>

      {/* Filter row */}
      <div className="shrink-0 flex flex-wrap gap-2 items-center bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl px-3 py-2">
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
        />
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <select
          value={typeF}
          onChange={(e) => setTypeF(e.target.value)}
          className="bg-transparent text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
        >
          <option value="all">كل الأنواع</option>
          <option value="وارد">وارد</option>
          <option value="صادر">صادر</option>
          <option value="مرتجع">مرتجع</option>
          <option value="سند إدخال صوري">سند إدخال</option>
          <option value="سند إخراج صوري">سند إخراج</option>
        </select>
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن صنف..."
            className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none w-full placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>
        <button
          type="button"
          onClick={() => { setDate(todayISO()); setTypeF('all'); setSearch(''); }}
          className="text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors"
        >
          إعادة ضبط
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl shadow-inner">
        <div className="h-full overflow-y-auto custom-scrollbar">
          {rows.length === 0 ? (
            <EmptyState icon={Activity} title="لا توجد عمليات" sub="حاول تغيير التاريخ أو الفلتر" />
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-xs font-black text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-3">الوقت</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">الصنف</th>
                  <th className="px-4 py-3">الشركة</th>
                  <th className="px-4 py-3 text-center">الكمية</th>
                  <th className="px-4 py-3">الوحدة</th>
                  <th className="px-4 py-3">ملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
                {rows.map((tx) => {
                  const m = getTxMeta(tx.type);
                  const Icon = m.icon;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={10} />
                          <span dir="ltr">{fmtTime(tx.timestamp)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black border ${m.cls}`}>
                          <Icon size={10} />
                          {m.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 max-w-[160px] truncate">{tx.item || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{tx.company || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-lg font-black text-xs inline-block ${m.cls}`}>{tx.qty ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{tx.unit || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[130px] truncate">
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
  'نقص':         'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
  'تلف':         'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
  'مشكوك فيه':  'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  'للمراجعة':   'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  'عادي':        'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700',
};

function Notepad() {
  const [notes, setNotes]       = useState([]);
  const [draft, setDraft]       = useState('');
  const [draftTag, setDraftTag] = useState('للمراجعة');
  const [search, setSearch]     = useState('');
  const textareaRef             = useRef(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_KEY);
      if (stored) setNotes(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
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
    const q = search.toLowerCase();
    return notes.filter(n => n.text.toLowerCase().includes(q) || (n.tag || '').toLowerCase().includes(q));
  }, [notes, search]);

  const fmtNoteDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">

      {/* Local-only badge */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30">
        <ShieldCheck size={15} className="text-violet-500 shrink-0" />
        <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
          هذه المذكرة <strong>محلية تماماً</strong> — تُحفظ في المتصفح فقط ولا تُعدِّل أي رصيد في قاعدة البيانات
        </p>
      </div>

      {/* Input box */}
      <div className="shrink-0 bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <StickyNote size={14} className="text-violet-500" />
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">ملاحظة جديدة</span>
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }}
          rows={3}
          placeholder="مثال: وجدت 3 زجاجات زيت مكسورة في الرف 4 ... أو: رصيد الدقيق يبدو أقل من النظام"
          className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none resize-none placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
        />
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tag selector */}
          <div className="flex gap-1.5 flex-wrap">
            {NOTE_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDraftTag(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
                  draftTag === t
                    ? TAG_COLORS[t] + ' ring-2 ring-offset-1 ring-violet-400/50'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-[10px] text-slate-400 hidden sm:block">Ctrl+Enter لإضافة سريعة</span>
          <button
            type="button"
            onClick={addNote}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-black shadow-lg shadow-violet-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus size={14} />
            إضافة
          </button>
        </div>
      </div>

      {/* Search + clear */}
      {notes.length > 0 && (
        <div className="shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-xl px-3 py-2">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الملاحظات..."
              className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none w-full placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
          <span className="text-xs font-bold text-slate-400 shrink-0">{notes.length} ملاحظة</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0"
          >
            مسح الكل
          </button>
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pb-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title={notes.length === 0 ? 'لا توجد ملاحظات بعد' : 'لا نتائج مطابقة'}
            sub={notes.length === 0 ? 'اكتب ملاحظتك في الحقل أعلاه' : 'حاول تغيير مصطلح البحث'}
          />
        ) : (
          <AnimatePresence>
            {filtered.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.15 }}
                className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl px-4 py-3 flex items-start gap-3 group"
              >
                {/* Tag dot */}
                <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black border ${TAG_COLORS[note.tag] || TAG_COLORS['عادي']}`}>
                  {note.tag}
                </span>
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{note.text}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{fmtNoteDate(note.createdAt)}</p>
                </div>
                {/* Delete */}
                <button
                  type="button"
                  onClick={() => deleteNote(note.id)}
                  className="shrink-0 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={13} />
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
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.name    || '').toLowerCase().includes(q) ||
        (i.company || '').toLowerCase().includes(q) ||
        (i.cat     || '').toLowerCase().includes(q)
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
    return sortAsc ? <ChevronUp size={11} className="inline" /> : <ChevronDown size={11} className="inline" />;
  };

  // Stock health colour
  const qtyColor = (qty) => {
    if (qty == null) return 'text-slate-400';
    if (qty <= 0)   return 'text-rose-600 dark:text-rose-400 font-black';
    if (qty < 50)   return 'text-amber-600 dark:text-amber-400 font-black';
    return 'text-emerald-600 dark:text-emerald-400 font-bold';
  };

  const qtyBg = (qty) => {
    if (qty == null || qty <= 0) return 'bg-rose-50 dark:bg-rose-500/10';
    if (qty < 50) return 'bg-amber-50 dark:bg-amber-500/10';
    return 'bg-emerald-50 dark:bg-emerald-500/10';
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">

      <ReadOnlyBadge text={`${items.length} صنف في النظام — للمقارنة اليدوية مع الرفوف فقط`} />

      {/* Filters */}
      <div className="shrink-0 flex flex-wrap gap-2 items-center bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl px-3 py-2">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الشركة أو القسم..."
          className="flex-1 min-w-[140px] bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 placeholder:font-normal"
        />
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <Filter size={13} className="text-slate-400 shrink-0" />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="bg-transparent text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
        >
          <option value="all">كل الأقسام</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || catFilter !== 'all') && (
          <button
            type="button"
            onClick={() => { setSearch(''); setCatFilter('all'); }}
            className="text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors"
          >
            مسح
          </button>
        )}
        <span className="mr-auto text-xs font-bold text-slate-400">{sorted.length} نتيجة</span>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-3 px-1 flex-wrap">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الرصيد:</span>
        {[
          ['≥ 50',  'emerald', 'طبيعي'],
          ['< 50',  'amber',   'منخفض'],
          ['= 0',   'rose',    'نفد'],
        ].map(([range, color, label]) => (
          <span key={color} className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-${color}-50 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-400`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-${color}-500 inline-block`} />
            {range} — {label}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl shadow-inner">
        <div className="h-full overflow-y-auto custom-scrollbar">
          {sorted.length === 0 ? (
            <EmptyState icon={ListChecks} title="لا توجد نتائج" sub="غيّر مصطلح البحث أو الفلتر" />
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-xs font-black text-slate-400 dark:text-slate-500">
                  {[
                    { col: 'name',     label: 'اسم الصنف' },
                    { col: 'company',  label: 'الشركة' },
                    { col: 'cat',      label: 'القسم' },
                    { col: 'unit',     label: 'الوحدة' },
                    { col: 'stockQty', label: 'رصيد النظام' },
                  ].map(({ col, label }) => (
                    <th
                      key={col}
                      className="px-4 py-3 cursor-pointer hover:text-indigo-500 transition-colors select-none"
                      onClick={() => toggleSort(col)}
                    >
                      {label} <SortIcon col={col} />
                    </th>
                  ))}
                  <th className="px-4 py-3">حالة الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
                {sorted.map((item) => {
                  const qty = item.stockQty;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 max-w-[160px] truncate">{item.name || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{item.company || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{item.cat || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{item.unit || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-3 py-1 rounded-xl text-sm font-black inline-block ${qtyBg(qty)} ${qtyColor(qty)}`}>
                          {qty ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {qty == null ? (
                          <StatusChip color="slate" label="غير محدد" />
                        ) : qty <= 0 ? (
                          <StatusChip color="rose"    label="نفد الرصيد" icon={AlertCircle} />
                        ) : qty < 50 ? (
                          <StatusChip color="amber"   label="رصيد منخفض" icon={Info} />
                        ) : (
                          <StatusChip color="emerald" label="رصيد جيد"  icon={CheckCircle2} />
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
    <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
      <Eye size={13} className="text-indigo-400 shrink-0" />
      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300">{text}</p>
    </div>
  );
}

const MINI_COLORS = {
  indigo:  'from-indigo-500 to-violet-600  shadow-indigo-500/20',
  emerald: 'from-emerald-500 to-teal-600   shadow-emerald-500/20',
  blue:    'from-blue-500 to-indigo-600    shadow-blue-500/20',
  amber:   'from-amber-500 to-orange-500   shadow-amber-500/20',
};

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${MINI_COLORS[color]} flex items-center justify-center text-white shadow-lg shrink-0`}>
        <span className="text-sm font-black">{value}</span>
      </div>
      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

function StatusChip({ color, label, icon: Icon }) {
  const map = {
    rose:    'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
    amber:   'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    slate:   'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${map[color]}`}>
      {Icon && <Icon size={9} />}
      {label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400 dark:text-slate-500">
      <Icon size={36} className="mb-3 opacity-30" />
      <p className="font-bold text-sm">{title}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}
