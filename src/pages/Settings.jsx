/**
 * Settings.jsx — Octopus Settings (8 sections)
 * ─────────────────────────────────────────────────────────────────
 * Emerald / Night Mode card-grid layout.
 * All state persists via SettingsContext → localStorage.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Package, Lock, Unlock, Palette,
  Bell, Users, Zap, Eye, EyeOff,
  Database, RotateCcw, Check, Plus, Trash2,
  X, Download, Sun, Moon, Building2, Phone,
  MapPin, FileDown, Clock, Shield, ShieldOff,
  Sliders, AlertTriangle, ChevronDown, Info,
  Save, Type, Brush, SlidersHorizontal,
} from 'lucide-react';
import { useSettings, DEFAULT_SETTINGS } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../lib/firebase';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, getDocs, serverTimestamp,
  Timestamp, writeBatch, where, setDoc, updateDoc
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../lib/firebase';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// ─── Constants ────────────────────────────────────────────────────
const UNITS = ['كرتونة', 'علبة', 'كيس', 'لتر', 'كيلو', 'قطعة', 'طرد', 'دستة', 'حبة', 'رزمة', 'شوال'];

const COLOR_PRESETS = [
  { hex: '#10b981', name: 'زمردي' },
  { hex: '#3b82f6', name: 'أزرق' },
  { hex: '#8b5cf6', name: 'بنفسجي' },
  { hex: '#f59e0b', name: 'عنبري' },
  { hex: '#ef4444', name: 'أحمر' },
  { hex: '#06b6d4', name: 'سماوي' },
  { hex: '#64748b', name: 'رمادي' },
  { hex: '#ec4899', name: 'وردي' },
];

const FILENAME_FORMATS = [
  { id: 'code_date', label: 'رقم السند + التاريخ', example: 'Barakat_IN-001_20250329.png' },
  { id: 'name_date', label: 'اسم المنشأة + التاريخ', example: 'بركةالثمار_20250329.png' },
  { id: 'date_code', label: 'التاريخ + رقم السند',   example: '20250329_IN-001.png' },
];

// ─── Shared tiny helpers ──────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
);

// ─── Card wrapper ─────────────────────────────────────────────────
const CARD_ACCENTS = {
  emerald: { icon: 'from-emerald-500 to-teal-600 shadow-emerald-500/25', badge: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', ring: 'focus:ring-emerald-500/20 focus:border-emerald-500' },
  rose:    { icon: 'from-rose-500 to-rose-600 shadow-rose-500/25',   badge: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',   ring: 'focus:ring-rose-500/20 focus:border-rose-500' },
  violet:  { icon: 'from-violet-500 to-purple-600 shadow-violet-500/25', badge: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20', ring: 'focus:ring-violet-500/20 focus:border-violet-500' },
  amber:   { icon: 'from-amber-500 to-orange-500 shadow-amber-500/25', badge: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', ring: 'focus:ring-amber-500/20 focus:border-amber-500' },
  blue:    { icon: 'from-blue-500 to-indigo-600 shadow-blue-500/25', badge: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20', ring: 'focus:ring-blue-500/20 focus:border-blue-500' },
  orange:  { icon: 'from-orange-500 to-amber-600 shadow-orange-500/25', badge: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20', ring: 'focus:ring-orange-500/20 focus:border-orange-500' },
  teal:    { icon: 'from-teal-500 to-cyan-600 shadow-teal-500/25', badge: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20', ring: 'focus:ring-teal-500/20 focus:border-teal-500' },
  indigo:  { icon: 'from-indigo-500 to-violet-600 shadow-indigo-500/25', badge: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20', ring: 'focus:ring-indigo-500/20 focus:border-indigo-500' },
  pink:    { icon: 'from-pink-500 to-rose-600 shadow-pink-500/25', badge: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20', ring: 'focus:ring-pink-500/20 focus:border-pink-500' },
};

function Card({ title, subtitle, icon: Icon, accent = 'emerald', number, children, className = '' }) {
  const a = CARD_ACCENTS[accent];
  return (
    <div className={`bg-white/90 dark:bg-slate-800/70 backdrop-blur-xl rounded-[1.75rem] border border-slate-200/60 dark:border-slate-700/50 shadow-sm flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex items-center gap-3 shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 bg-gradient-to-br ${a.icon}`}>
          <Icon size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-sm text-slate-800 dark:text-white truncate">{title}</h3>
            {number && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${a.badge}`}>#{number}</span>}
          </div>
          {subtitle && <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {/* Body */}
      <div className="p-5 flex-1 flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

// ─── Field + Input helpers ────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-1 font-bold">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:font-normal placeholder:text-slate-400';

function Toggle({ checked, onChange, label, description, accent = 'emerald' }) {
  const colors = { emerald:'bg-emerald-500', rose:'bg-rose-500', blue:'bg-blue-500', amber:'bg-amber-500', teal:'bg-teal-500' };
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2 px-0 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-right"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 text-right">{label}</p>
        {description && <p className="text-[11px] text-slate-400 mt-0.5 font-bold text-right">{description}</p>}
      </div>
      <div className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${checked ? colors[accent] || 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}>
        <motion.div animate={{ x: checked ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 1 — DEFAULT VALUES
// ═══════════════════════════════════════════════════════
function S1DefaultValues({ settings, update }) {
  return (
    <Card title="القيم الافتراضية" subtitle="تسريع الإدخال اليومي" icon={Package} accent="emerald" number="1">
      <Field label="رمز المؤسسة + الاسم">
        <div className="flex gap-2">
          <input type="text" value={settings.orgEmoji} onChange={e => update({ orgEmoji: e.target.value })}
            maxLength={4} placeholder="🌿" className={`${inputCls} w-14 text-center text-lg`} />
          <input type="text" value={settings.orgName} onChange={e => update({ orgName: e.target.value })}
            placeholder="مؤسسة بركة الثمار" className={`${inputCls} flex-1`} />
        </div>
      </Field>
      <Field label="الشعار الفرعي">
        <input type="text" value={settings.orgSubtitle} onChange={e => update({ orgSubtitle: e.target.value })}
          placeholder="للتجارة والتوزيع الغذائي" className={inputCls} />
      </Field>
      <Field label="معلومات التواصل" hint="يظهر في رأس الوثيقة المُصدَّرة">
        <input type="text" value={settings.orgContact} onChange={e => update({ orgContact: e.target.value })}
          placeholder="05xxxxxxxx" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الوحدة الافتراضية">
          <select value={settings.defaultUnit} onChange={e => update({ defaultUnit: e.target.value })} className={inputCls}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="الماركة الافتراضية">
          <input type="text" value={settings.defaultBrand} onChange={e => update({ defaultBrand: e.target.value })}
            placeholder="مثال: زاكي" className={inputCls} />
        </Field>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 2 — SYSTEM FREEZE
// ═══════════════════════════════════════════════════════
function S2SystemFreeze({ settings, update }) {
  const isFrozen = settings.systemFrozen;
  return (
    <Card title="تجميد النظام" subtitle="إيقاف الإدخال أثناء الجرد" icon={isFrozen ? Lock : Unlock} accent={isFrozen ? 'rose' : 'teal'} number="2">
      {/* Big freeze toggle */}
      <div className={`rounded-2xl border-2 p-4 transition-all ${isFrozen ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/60 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`font-black text-sm ${isFrozen ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
              {isFrozen ? '⛔ النظام مجمَّد الآن' : '✅ النظام يعمل بشكل طبيعي'}
            </p>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
              {isFrozen ? 'جميع عمليات الإدخال معطلة' : 'الإدخال مفعّل لجميع المستخدمين'}
            </p>
          </div>
          <button type="button" onClick={() => update({ systemFrozen: !isFrozen })}
            className={`px-4 py-2 rounded-xl font-black text-sm text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${isFrozen ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25' : 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/25'}`}>
            {isFrozen ? 'إلغاء التجميد' : 'تجميد النظام'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isFrozen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={12} className="shrink-0" />
            سيظهر شريط تحذير أحمر في الأعلى لجميع مستخدمي النظام تلقائياً.
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-slate-400 font-bold mt-auto">
        استخدم هذا الخيار قبل بدء عملية الجرد الرسمي لمنع أي تغييرات غير مقصودة في قاعدة البيانات.
      </p>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 3 — TEMPLATE CUSTOMIZER
// ═══════════════════════════════════════════════════════
function S3Template({ settings, update }) {
  const accentHex = settings.voucherCustomAccent || '#10b981';
  return (
    <Card title="قالب الوثائق" subtitle="ألوان وخطوط السندات المُصدَّرة" icon={Palette} accent="violet" number="3">
      <Field label="لون الإبراز" hint="يُطبَّق على رأس وأعمدة السند">
        <div className="flex flex-wrap gap-2 mb-2">
          {COLOR_PRESETS.map(({ hex, name }) => (
            <button key={hex} type="button" title={name}
              onClick={() => update({ voucherCustomAccent: hex })}
              className={`w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 ${settings.voucherCustomAccent === hex ? 'border-slate-800 dark:border-white scale-110 shadow-md' : 'border-transparent'}`}
              style={{ background: hex }} />
          ))}
          {/* auto */}
          <button type="button" title="تلقائي (حسب النوع)"
            onClick={() => update({ voucherCustomAccent: '' })}
            className={`w-8 h-8 rounded-xl border-2 text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-slate-700 transition-all hover:scale-110 ${!settings.voucherCustomAccent ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`}>
            A
          </button>
        </div>
        {/* Custom hex input */}
        <div className="flex items-center gap-2">
          <input type="color" value={accentHex} onChange={e => update({ voucherCustomAccent: e.target.value })}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800 shrink-0" />
          <input type="text" value={settings.voucherCustomAccent}
            onChange={e => update({ voucherCustomAccent: e.target.value })}
            placeholder="تلقائي (مثال: #10b981)"
            className={`${inputCls} flex-1 font-mono text-xs`} dir="ltr" />
        </div>
      </Field>

      <Field label="حجم الخط في الوثيقة">
        <div className="flex gap-2">
          {[['small', 'صغير', '10px'], ['medium', 'متوسط', '11px'], ['large', 'كبير', '13px']].map(([v, l, s]) => (
            <button key={v} type="button" onClick={() => update({ voucherFontSize: v })}
              className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-black transition-all ${settings.voucherFontSize === v ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}>
              <span className="block" style={{ fontSize: s }}>{l}</span>
              <span className="text-[9px] opacity-60">{s}</span>
            </button>
          ))}
        </div>
      </Field>

      {/* Live mini preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 text-white text-[10px] font-black" style={{ background: accentHex }}>
          <span>{settings.orgEmoji} {settings.orgName}</span>
          <span>سند إخراج</span>
        </div>
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/30 text-[10px] font-bold text-slate-500">
          ← معاينة رأس الوثيقة بهذا اللون
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 4 — SMART ALERTS
// ═══════════════════════════════════════════════════════
function S4SmartAlerts({ settings, update }) {
  const threshold = settings.lowStockThreshold;
  return (
    <Card title="تنبيهات ذكية" subtitle="حدود المخزون والإشعارات" icon={Bell} accent="amber" number="4">
      <Field label="حد المخزون المنخفض (وحدة)" hint="سيظهر تنبيه كرسي في الجرس عندما يقل الرصيد عن هذا الحد">
        <div className="flex items-center gap-3">
          <input type="number" min="1" max="10000" value={threshold}
            onChange={e => update({ lowStockThreshold: Number(e.target.value) || 50 })}
            className={`${inputCls} w-28 text-center text-lg font-black`} />
          <div className={`flex-1 h-4 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700`}>
            <motion.div
              animate={{ width: `${Math.min((threshold / 200) * 100, 100)}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400"
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>
        </div>
      </Field>

      {/* Alert preview chips */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'آمن', range: `≥ ${threshold}`, color: 'emerald' },
          { label: 'منخفض', range: `< ${threshold}`, color: 'amber' },
          { label: 'نفد', range: '= 0', color: 'rose' },
        ].map(({ label, range, color }) => (
          <div key={label} className={`text-center py-2 rounded-xl border bg-${color}-50 dark:bg-${color}-500/10 border-${color}-200 dark:border-${color}-500/30`}>
            <p className={`text-xs font-black text-${color}-600 dark:text-${color}-400`}>{label}</p>
            <p className={`text-[10px] font-bold text-${color}-400`}>{range}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
        <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
          يُطبَّق هذا الحد على أيقونة الجرس في الشريط العلوي بعد حفظ الإعدادات.
        </p>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 5 — CONTACTS MANAGER
// ═══════════════════════════════════════════════════════
function S5Contacts() {
  const [reps, setReps] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const u = onSnapshot(
      query(collection(db, 'reps'), orderBy('createdAt', 'desc')),
      s => setReps(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return u;
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('أدخل اسم المندوب'); return; }
    setAdding(true);
    try {
      await addDoc(collection(db, 'reps'), { name: name.trim(), phone: phone.trim(), zone: zone.trim(), notes: '', createdAt: serverTimestamp() });
      toast.success('✅ تمت إضافة المندوب');
      setName(''); setPhone(''); setZone(''); setShowForm(false);
    } catch { toast.error('فشل الحفظ'); }
    finally { setAdding(false); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذا المندوب؟')) return;
    await deleteDoc(doc(db, 'reps', id));
    toast.success('تم الحذف');
  };

  const AVATAR = ['from-violet-500 to-purple-600','from-blue-500 to-indigo-600','from-emerald-500 to-teal-600','from-amber-500 to-orange-500','from-rose-500 to-pink-600'];
  const av = (n = '') => AVATAR[n.charCodeAt(0) % AVATAR.length];
  const initials = (n = '') => n.trim().split(' ').slice(0,2).map(w=>w[0]).join('');

  return (
    <Card title="إدارة المناديب" subtitle="قائمة المناديب المتاحة في القوائم المنسدلة" icon={Users} accent="blue" number="5">
      {/* Rep list */}
      <div className="flex-1 min-h-0 space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
        {reps.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">لا يوجد مناديب مسجلون</p>
          </div>
        ) : reps.map(rep => (
          <div key={rep.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 group transition-colors">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${av(rep.name)} text-white font-black text-xs flex items-center justify-center shrink-0`}>
              {initials(rep.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{rep.name}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate">{rep.phone || '—'} {rep.zone ? `· ${rep.zone}` : ''}</p>
            </div>
            <button type="button" onClick={() => handleDelete(rep.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd} className="overflow-hidden space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="الاسم *" className={inputCls} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="الهاتف" className={inputCls} />
              <input type="text" value={zone}  onChange={e => setZone(e.target.value)}  placeholder="المنطقة" className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
              <button type="submit" disabled={adding} className="flex-1 py-2 rounded-xl font-black text-xs text-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-1">
                {adding ? <Spinner /> : <Check size={13} />} حفظ
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-500/40 text-blue-500 dark:text-blue-400 text-xs font-black hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all">
          <Plus size={14} /> إضافة مندوب جديد
        </button>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 6 — PERFORMANCE
// ═══════════════════════════════════════════════════════
function S6Performance({ settings, update }) {
  const [oldCount, setOldCount] = useState(null);
  const [counting, setCounting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const checkOldLogs = useCallback(async () => {
    setCounting(true);
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      const q = query(collection(db, 'transactions'), where('timestamp', '<', Timestamp.fromDate(cutoff)));
      const snap = await getDocs(q);
      setOldCount(snap.size);
    } catch { setOldCount(0); }
    finally { setCounting(false); }
  }, []);

  const clearOldLogs = async () => {
    if (oldCount === 0) { toast.info('لا توجد سجلات قديمة'); return; }
    if (!window.confirm(`سيتم حذف ${oldCount} سجل أقدم من 6 أشهر. هل أنت متأكد؟`)) return;
    setCleaning(true);
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      const q = query(collection(db, 'transactions'), where('timestamp', '<', Timestamp.fromDate(cutoff)));
      const snap = await getDocs(q);
      const MAX_BATCH = 499;
      for (let i = 0; i < snap.docs.length; i += MAX_BATCH) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + MAX_BATCH).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      toast.success(`✅ تم حذف ${snap.size} سجل بنجاح`);
      update({ lastCleanupDate: new Date().toISOString() });
      setOldCount(0);
    } catch { toast.error('فشل الحذف'); }
    finally { setCleaning(false); }
  };

  const checkIntegrity = async () => {
    setCounting(true);
    try {
      const [itemsSnap, txSnap] = await Promise.all([
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'transactions'))
      ]);
      const itemsMap = new Map(itemsSnap.docs.map(i => [i.id, { ...i.data(), id: i.id }]));
      const calcs = {};
      txSnap.docs.forEach(doc => {
        const t = doc.data();
        if (t.documentary) return;
        if (!calcs[t.itemId]) calcs[t.itemId] = 0;
        if (t.type === 'وارد' || t.type === 'مرتجع') calcs[t.itemId] += Number(t.qty || 0);
        else if (t.type === 'صادر') calcs[t.itemId] -= Number(t.qty || 0);
      });
      let errors = 0;
      itemsMap.forEach(item => {
        const expected = calcs[item.id] || 0;
        if ((item.stockQty || 0) !== expected) errors++;
      });
      if (errors > 0) toast.error(`⚠️ تنبيه: وُجد ${errors} أصناف رصيدها لا يطابق مجموع الحركات`);
      else toast.success('✅ سلامة البيانات ممتازة (الأرصدة متطابقة 100%)');
    } catch {
      toast.error('فشل الفحص');
    } finally {
      setCounting(false);
    }
  };

  return (
    <Card title="الأداء وصحة البيانات" subtitle="حذف السجلات ومطابقة الأرصدة" icon={Zap} accent="orange" number="6">
      <div className="flex gap-2">
        <button type="button" onClick={checkOldLogs} disabled={counting}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {counting ? <Spinner /> : <Clock size={14} />} فحص السجلات
        </button>
        <button type="button" onClick={checkIntegrity} disabled={counting}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          {counting ? <Spinner /> : <Database size={14} />} مطابقة الأرصدة
        </button>
      </div>

      <AnimatePresence>
        {oldCount !== null && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`rounded-xl border p-3 ${oldCount > 0 ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'}`}>
            <p className={`text-sm font-black ${oldCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {oldCount > 0 ? `وُجد ${oldCount} سجل أقدم من 6 أشهر` : '✅ لا توجد سجلات قديمة — التطبيق نظيف'}
            </p>
            {oldCount > 0 && (
              <button type="button" onClick={clearOldLogs} disabled={cleaning}
                className="mt-2 w-full py-2 rounded-xl font-black text-sm text-white bg-gradient-to-br from-orange-500 to-amber-600 shadow-md shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all">
                {cleaning ? <Spinner /> : <Trash2 size={14} />} حذف السجلات القديمة
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto flex items-center gap-2 text-[11px] font-bold text-slate-400">
        <Clock size={11} />
        {settings.lastCleanupDate ? `آخر تنظيف: ${fmtDate(settings.lastCleanupDate)}` : 'لم يتم تنظيف قاعدة البيانات بعد'}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 7 — UI TOGGLES
// ═══════════════════════════════════════════════════════
function S7UIToggles({ settings, update }) {
  const toggles = [
    { key: 'voucherShowCompany',   label: 'عرض اسم الشركة في السند',   desc: 'سطر صغير أسفل اسم الصنف' },
    { key: 'voucherShowNotes',     label: 'عمود الملاحظات في السند',    desc: 'يُضيف/يُخفي العمود الأخير' },
    { key: 'uiShowSignatureBox',   label: 'صناديق التوقيع في السند',    desc: 'ويةالمستلم + أمين المستودع' },
    { key: 'uiShowVoucherCode',    label: 'رقم السند في الترويسة',      desc: 'يظهر في بيانات السند اليسرى' },
    { key: 'uiShowUnit',           label: 'وحدة القياس في الجداول',     desc: 'مرئية في عمود الكمية' },
  ];

  // Column chips preview
  const activeColumns = [
    { label: 'م',         always: true },
    { label: 'اسم الصنف', always: true },
    { label: 'الكمية',    always: true },
    { label: 'ملاحظات',   key: 'voucherShowNotes' },
  ];

  return (
    <Card title="خيارات الواجهة" subtitle="إظهار وإخفاء عناصر الوثائق والجداول" icon={Eye} accent="teal" number="7">
      <div className="space-y-0.5">
        {toggles.map(({ key, label, desc }) => (
          <React.Fragment key={key}>
            <Toggle
              checked={settings[key] !== false}
              onChange={v => update({ [key]: v })}
              label={label}
              description={desc}
              accent="teal"
            />
            <div className="h-px bg-slate-50 dark:bg-slate-700/50 mx-1" />
          </React.Fragment>
        ))}
      </div>

      {/* Column preview */}
      <div className="mt-auto">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">معاينة أعمدة السند:</p>
        <div className="flex gap-1.5 flex-wrap">
          {activeColumns.map(({ label, always, key }) => {
            const on = always || settings[key] !== false;
            return (
              <span key={label} className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all ${on ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 line-through opacity-40'}`}>
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 8 — MASTER BACKUP
// ═══════════════════════════════════════════════════════
function S8MasterBackup({ settings, update }) {
  const [exporting, setExporting] = useState(false);
  const [collections, setCollections] = useState({ items: true, transactions: true, reps: true, discrepancies: true });

  const handleExport = async () => {
    const selected = Object.entries(collections).filter(([, v]) => v).map(([k]) => k);
    if (selected.length === 0) { toast.error('اختر قسماً واحداً على الأقل'); return; }
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Items
      if (collections.items) {
        const snap = await getDocs(collection(db, 'items'));
        const rows = snap.docs.map(d => {
          const r = d.data();
          return { 'الكود': d.id, 'اسم الصنف': r.name||'', 'الشركة': r.company||'', 'القسم': r.cat||'', 'الوحدة': r.unit||'', 'الرصيد': r.stockQty??0 };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'الأصناف');
      }

      // Transactions
      if (collections.transactions) {
        const snap = await getDocs(query(collection(db, 'transactions'), orderBy('timestamp', 'desc')));
        const rows = snap.docs.map(d => {
          const r = d.data();
          const ts = r.timestamp instanceof Timestamp ? r.timestamp.toDate().toLocaleDateString('ar-SA') : r.date||'';
          return { 'التاريخ': ts, 'النوع': r.type||'', 'الصنف': r.item||'', 'الشركة': r.company||'', 'الكمية': r.qty??'', 'الوحدة': r.unit||'', 'المندوب': r.rep||'', 'ملاحظة': r.lineNote||r.note||'' };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'الحركات');
      }

      // Reps
      if (collections.reps) {
        const snap = await getDocs(collection(db, 'reps'));
        const rows = snap.docs.map(d => {
          const r = d.data();
          return { 'الاسم': r.name||'', 'الهاتف': r.phone||'', 'المنطقة': r.zone||'', 'ملاحظات': r.notes||'' };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'المناديب');
      }

      // Discrepancies
      if (collections.discrepancies) {
        const snap = await getDocs(collection(db, 'discrepancies'));
        const rows = snap.docs.map(d => {
          const r = d.data();
          return { 'التاريخ': r.date||'', 'الصنف': r.itemName||'', 'السبب': r.reason||'', 'المتوقع': r.expectedQty??'', 'الفعلي': r.actualQty??'', 'الفارق': r.diff??'', 'الحالة': r.status||'' };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), 'الفوارق');
      }

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Barakat_Backup_${dateStr}.xlsx`);
      toast.success('✅ تم تصدير قاعدة البيانات بنجاح — تحقق من مجلد التنزيلات');
      update({ lastBackupDate: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      toast.error('فشل التصدير — تحقق من الاتصال بالإنترنت');
    } finally {
      setExporting(false);
    }
  };

  const collLabels = { items: 'الأصناف', transactions: 'الحركات', reps: 'المناديب', discrepancies: 'الفوارق' };

  return (
    <Card title="النسخة الاحتياطية الشاملة" subtitle="تصدير قاعدة البيانات بالكامل إلى Excel" icon={Database} accent="indigo" number="8">
      <Field label="اختر القسم للتصدير">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(collLabels).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setCollections(p => ({ ...p, [k]: !p[k] }))}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-black transition-all ${collections[k] ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
              <div className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${collections[k] ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-600'}`}>
                {collections[k] && <Check size={10} className="text-white stroke-[3]" />}
              </div>
              {l}
            </button>
          ))}
        </div>
      </Field>

      <button type="button" onClick={handleExport} disabled={exporting}
        className="w-full py-3 rounded-xl font-black text-white text-sm bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
        {exporting ? <><Spinner /> جاري التصدير...</> : <><FileDown size={16} /> تصدير إلى Excel (.xlsx)</>}
      </button>

      <div className="grid grid-cols-1 gap-2 text-[10px] font-bold text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock size={10} />
          {settings.lastBackupDate ? `آخر نسخة: ${fmtDate(settings.lastBackupDate)}` : 'لم يتم تصدير نسخة احتياطية بعد'}
        </div>
        <div className="flex items-center gap-1.5">
          <Info size={10} />
          الملف يحتوي على ورقات منفصلة لكل قسم مختار
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 9 — USER MANAGEMENT
// ═══════════════════════════════════════════════════════
function S9Users() {
  const [usersList, setUsersList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Viewer');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), s => {
      setUsersList(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!email || !password || !username) {
      toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }
    setAdding(true);
    try {
      // Reuse the secondary app if already initialized — avoids "app already exists" crash
      const secondaryApp = getApps().find(a => a.name === 'SecondaryApp')
        ?? initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);
      
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        username,
        role,
        createdAt: new Date().toISOString()
      });
      
      await secondaryAuth.signOut();
      
      toast.success('✅ تمت إضافة المستخدم بنجاح');
      setEmail(''); setPassword(''); setUsername(''); setRole('Viewer'); setShowForm(false);
    } catch (err) {
      console.error(err);
      toast.error('فشل إضافة المستخدم. قد يكون البريد مستخدماً أو كلمة المرور ضعيفة.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ملاحظة: سيتم حذف بيانات المستخدم، ولكن تأكد من إزالته عبر لوحة Firebase Authentication للأمان. هل تريد إزالة بياناته؟')) return;
    await deleteDoc(doc(db, 'users', id));
    toast.success('تم الحذف');
  };

  const bgColors = {
    Admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    Storekeeper: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    Viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400'
  };

  return (
    <Card title="إدارة المستخدمين" subtitle="صلاحيات النظام" icon={Shield} accent="rose" number="9">
      <div className="flex-1 min-h-0 space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
        {usersList.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-bold">جاري التحميل...</div>
        ) : usersList.map(u => (
          <div key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 group transition-colors">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 font-black text-white text-xs flex items-center justify-center shrink-0`}>
              {u.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{u.username || 'بدون اسم'}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate">{u.email}</p>
            </div>
            <select
              value={u.role}
              onChange={async (e) => {
                try {
                  await updateDoc(doc(db, 'users', u.id), { role: e.target.value });
                  toast.success('تم تحديث الصلاحية');
                } catch { toast.error('خطأ في التحديث'); }
              }}
              className={`px-2 py-0.5 rounded-md text-[9px] font-black outline-none cursor-pointer text-center appearance-none ${bgColors[u.role] || bgColors.Viewer}`}
            >
              <option value="Admin">مدير</option>
              <option value="Storekeeper">أمين</option>
              <option value="Viewer">مراقب</option>
            </select>
            <button type="button" onClick={() => handleDelete(u.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddUser} className="overflow-hidden space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="اسم المستخدم" className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all" required />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all" required minLength={6} />
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all">
              <option value="Viewer">مشاهد عرض (رؤية فقط)</option>
              <option value="Storekeeper">أمين مستودع (إدخال وإخراج)</option>
              <option value="Admin">مدير نظام (تحكم كامل)</option>
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">إلغاء</button>
              <button type="submit" disabled={adding} className="flex-1 py-2 rounded-xl font-black text-xs text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-md shadow-rose-500/20 flex items-center justify-center gap-1 disabled:opacity-50 transition-all">
                {adding ? <Spinner /> : <Plus size={13} />} إضافة
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-rose-300 dark:border-rose-500/40 text-rose-500 dark:text-rose-400 text-xs font-black hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">
          <Plus size={14} /> مستخدم جديد
        </button>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  SECTION 10 — CUSTOM DICTIONARY
// ═══════════════════════════════════════════════════════
function S10Dictionary({ settings, update }) {
  const labels = settings.labels || DEFAULT_SETTINGS.labels;
  const updateLabel = (key, val) => {
    update({ labels: { ...labels, [key]: val } });
  };

  return (
    <Card title="قاموس العناوين" subtitle="تعديل المسميات في التطبيق والطباعة" icon={Type} accent="pink" number="10">
      <div className="space-y-3">
        <Field label="اسم (سند إدخال)">
          <input type="text" value={labels.voucherIn || ''} onChange={e => updateLabel('voucherIn', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500" />
        </Field>
        <Field label="اسم (سند إخراج)">
          <input type="text" value={labels.voucherOut || ''} onChange={e => updateLabel('voucherOut', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500" />
        </Field>
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <Field label="اسم قسم (الوارد)">
            <input type="text" value={labels.stockIn || ''} onChange={e => updateLabel('stockIn', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500" />
          </Field>
          <Field label="اسم قسم (الصادر)">
            <input type="text" value={labels.stockOut || ''} onChange={e => updateLabel('stockOut', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500" />
          </Field>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  ROOT PAGE
// ═══════════════════════════════════════════════════════
export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { isDarkMode, toggleTheme } = useTheme();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    toast.success('✅ تم حفظ جميع الإعدادات');
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (window.confirm('هل تريد إعادة ضبط جميع الإعدادات للقيم الافتراضية؟')) {
      resetSettings();
      toast.success('تمت إعادة الضبط الكاملة');
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-['Cairo']" dir="rtl">

      {/* ── Page Header ── */}
      <div className="shrink-0 mb-5">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0">
                <SettingsIcon size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">لوحة التحكم السحرية (الأخطبوط)</h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">10 أقسام</span>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-0.5">تحكم كامل في النظام — الهوية، الطباعة، الأداء، والأمان</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all">
                <RotateCcw size={14} /> إعادة ضبط
              </button>
              <button type="button" onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl font-black text-sm text-white shadow-lg transition-all ${saved ? 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-emerald-500/30 scale-95' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25 hover:scale-[1.02] active:scale-95'}`}>
                <AnimatePresence mode="wait">
                  {saved
                    ? <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5"><Check size={15} /> تم الحفظ</motion.span>
                    : <motion.span key="save" className="flex items-center gap-1.5"><Save size={14} /> حفظ الإعدادات</motion.span>
                  }
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Freeze Banner (always visible when frozen) */}
      <AnimatePresence>
        {settings.systemFrozen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="shrink-0 mb-4 flex items-center gap-3 px-5 py-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/30 font-bold text-sm">
            <Lock size={16} className="shrink-0" />
            <p className="flex-1">⛔ النظام مجمَّد — جميع عمليات الإدخال معطّلة حتى يتم إلغاء التجميد</p>
            <button type="button" onClick={() => updateSettings({ systemFrozen: false })}
              className="shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-black transition-colors">
              إلغاء التجميد
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 8 Cards Grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Row 1: 4 compact cards */}
          <S1DefaultValues settings={settings} update={updateSettings} />
          <S2SystemFreeze  settings={settings} update={updateSettings} />
          <S3Template      settings={settings} update={updateSettings} />
          <S4SmartAlerts   settings={settings} update={updateSettings} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          <S5Contacts />
          <S6Performance settings={settings} update={updateSettings} />
          <S7UIToggles   settings={settings} update={updateSettings} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          <S8MasterBackup settings={settings} update={updateSettings} />
          <S9Users />
          <S10Dictionary settings={settings} update={updateSettings} />
        </div>
      </div>
    </div>
  );
}
