import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, Plus, Trash2, X, CheckCircle,
  TrendingDown, TrendingUp, RotateCcw, Package, Truck,
  ArrowUpRight, FileText, ClipboardList, ChevronDown, Search,
  Calendar, Clock, Edit3, Save,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc,
  doc, updateDoc, serverTimestamp, Timestamp, where,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

// ─── helpers ────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const TX_TYPES = {
  'وارد': { label: 'وارد', color: 'emerald', icon: TrendingUp, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30' },
  'صادر': { label: 'صادر', color: 'blue', icon: TrendingDown, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/30' },
  'مرتجع': { label: 'مرتجع', color: 'amber', icon: RotateCcw, bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/30' },
  'سند إدخال صوري': { label: 'سند إدخال', color: 'teal', icon: FileText, bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-500/30' },
  'سند إخراج صوري': { label: 'سند إخراج', color: 'purple', icon: FileText, bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/30' },
};

const getTxStyle = (type) => TX_TYPES[type] || { label: type, color: 'slate', icon: Package, bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700' };

const DISC_REASONS = ['نقص في العدد', 'تلف / كسر', 'انتهاء صلاحية', 'اختلاف في الوزن', 'سرقة مشتبه بها', 'خطأ في الإدخال', 'أخرى'];

// ─── main component ──────────────────────────────────────────────────────────
export default function WarehouseLogs() {
  const [activeTab, setActiveTab] = useState('daily');

  // ── shared data ──
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, 'transactions'), orderBy('timestamp', 'desc')),
      (s) => setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(collection(db, 'items'), (s) =>
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u3 = onSnapshot(
      query(collection(db, 'discrepancies'), orderBy('createdAt', 'desc')),
      (s) => setDiscrepancies(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); u3(); };
  }, []);

  return (
    <div className="h-full w-full flex flex-col font-['Cairo']" dir="rtl">
      {/* Page Header */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 mb-5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/25 shrink-0">
            <ClipboardList size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white">سجلات المستودع</h2>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              مراقبة الحركة اليومية وتوثيق الفوارق قبل الجرد الرسمي
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-4 flex gap-2 bg-slate-100/80 dark:bg-slate-900/50 p-1 rounded-2xl w-fit">
          <TabButton id="daily" active={activeTab} icon={Activity} label="النشاط اليومي" onClick={setActiveTab} />
          <TabButton id="discrepancy" active={activeTab} icon={AlertTriangle} label="سجل الفوارق" onClick={setActiveTab} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'daily' && (
            <motion.div key="daily" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="h-full">
              <DailyActivity transactions={transactions} />
            </motion.div>
          )}
          {activeTab === 'discrepancy' && (
            <motion.div key="disc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="h-full">
              <DiscrepancyLog discrepancies={discrepancies} items={items} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────────────────────────────────
function TabButton({ id, active, icon: Icon, label, onClick }) {
  const isActive = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
        isActive
          ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAB 1 — DAILY ACTIVITY
// ═══════════════════════════════════════════════════════════════
function DailyActivity({ transactions }) {
  const [dateFilter, setDateFilter] = useState(todayStr());
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = tx.date || (tx.timestamp instanceof Timestamp ? tx.timestamp.toDate().toISOString().split('T')[0] : '');
      if (dateFilter && txDate !== dateFilter) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!(tx.item || '').toLowerCase().includes(q) &&
            !(tx.company || '').toLowerCase().includes(q) &&
            !(tx.type || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [transactions, dateFilter, typeFilter, search]);

  // Stats for today
  const todayTxs = useMemo(() => transactions.filter((tx) => {
    const txDate = tx.date || (tx.timestamp instanceof Timestamp ? tx.timestamp.toDate().toISOString().split('T')[0] : '');
    return txDate === todayStr();
  }), [transactions]);

  const statsData = useMemo(() => {
    const inQty = todayTxs.filter(t => t.type === 'وارد').reduce((s, t) => s + (Number(t.qty) || 0), 0);
    const outQty = todayTxs.filter(t => t.type === 'صادر').reduce((s, t) => s + (Number(t.qty) || 0), 0);
    const retQty = todayTxs.filter(t => t.type === 'مرتجع').reduce((s, t) => s + (Number(t.qty) || 0), 0);
    return { total: todayTxs.length, inQty, outQty, retQty };
  }, [todayTxs]);

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Today Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <StatCard label="إجمالي العمليات اليوم" value={statsData.total} icon={Activity} color="violet" />
        <StatCard label="وارد اليوم (وحدة)" value={statsData.inQty} icon={TrendingUp} color="emerald" />
        <StatCard label="صادر اليوم (وحدة)" value={statsData.outQty} icon={TrendingDown} color="blue" />
        <StatCard label="مرتجع اليوم" value={statsData.retQty} icon={RotateCcw} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 shrink-0 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن صنف..."
            className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400 shrink-0" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 outline-none"
        >
          <option value="all">كل الأنواع</option>
          <option value="وارد">وارد</option>
          <option value="صادر">صادر</option>
          <option value="مرتجع">مرتجع</option>
          <option value="سند إدخال صوري">سند إدخال</option>
          <option value="سند إخراج صوري">سند إخراج</option>
        </select>
        <button
          type="button"
          onClick={() => { setDateFilter(todayStr()); setTypeFilter('all'); setSearch(''); }}
          className="text-xs font-bold text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10"
        >
          إعادة ضبط
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl shadow-inner">
        <div className="h-full overflow-x-auto overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400 dark:text-slate-500">
              <Activity size={40} className="mb-3 opacity-40" />
              <p className="font-bold text-sm">لا توجد حركات في هذا اليوم</p>
              <p className="text-xs mt-1 opacity-70">حاول تغيير التاريخ أو نوع الحركة</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-right text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-black text-xs">
                  <th className="px-4 py-3">الوقت</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">اسم الصنف</th>
                  <th className="px-4 py-3">الشركة</th>
                  <th className="px-4 py-3 text-center">الكمية</th>
                  <th className="px-4 py-3">الوحدة</th>
                  <th className="px-4 py-3">ملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                <AnimatePresence>
                  {filtered.map((tx, i) => {
                    const style = getTxStyle(tx.type);
                    const Icon = style.icon;
                    return (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Clock size={11} />
                            <span className="text-xs font-bold" dir="ltr">{fmtTime(tx.timestamp)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black border ${style.bg} ${style.text} ${style.border}`}>
                            <Icon size={10} />
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 max-w-[160px] truncate">{tx.item || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{tx.company || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-lg font-black text-xs inline-block ${style.bg} ${style.text}`}>{tx.qty ?? '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{tx.unit || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500 max-w-[140px] truncate">
                          {tx.lineNote || tx.note || tx.supplyNotes || '—'}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
const COLOR_MAP = {
  violet: 'from-violet-500 to-indigo-600 shadow-violet-500/25',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
  blue: 'from-blue-500 to-indigo-600 shadow-blue-500/25',
  amber: 'from-amber-500 to-orange-500 shadow-amber-500/25',
  rose: 'from-rose-500 to-rose-600 shadow-rose-500/25',
};

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${COLOR_MAP[color]} flex items-center justify-center text-white shadow-lg shrink-0`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAB 2 — STOCK DISCREPANCY LOG
// ═══════════════════════════════════════════════════════════════
function DiscrepancyLog({ discrepancies, items }) {
  const { isViewer } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ itemSearch: '', selectedItem: null, reason: DISC_REASONS[0], expectedQty: '', actualQty: '', notes: '', date: todayStr() });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestions = useMemo(() => {
    if (!form.itemSearch || form.selectedItem) return [];
    const q = form.itemSearch.toLowerCase();
    return items.filter(i => (i.name || '').toLowerCase().includes(q) || (i.company || '').toLowerCase().includes(q)).slice(0, 8);
  }, [items, form.itemSearch, form.selectedItem]);

  const filtered = useMemo(() => {
    if (!search.trim()) return discrepancies;
    const q = search.toLowerCase();
    return discrepancies.filter(d =>
      (d.itemName || '').toLowerCase().includes(q) ||
      (d.reason || '').toLowerCase().includes(q) ||
      (d.notes || '').toLowerCase().includes(q)
    );
  }, [discrepancies, search]);

  const resetForm = () => setForm({ itemSearch: '', selectedItem: null, reason: DISC_REASONS[0], expectedQty: '', actualQty: '', notes: '', date: todayStr() });

  const openAdd = () => { resetForm(); setEditingId(null); setIsFormOpen(true); };
  const openEdit = (disc) => {
    setForm({
      itemSearch: disc.itemName,
      selectedItem: { id: disc.itemId, name: disc.itemName },
      reason: disc.reason,
      expectedQty: disc.expectedQty,
      actualQty: disc.actualQty,
      notes: disc.notes || '',
      date: disc.date || todayStr(),
    });
    setEditingId(disc.id);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.selectedItem) { toast.error('يرجى اختيار الصنف'); return; }
    if (!form.expectedQty || !form.actualQty) { toast.error('يرجى إدخال الكميتين'); return; }
    setLoading(true);
    const payload = {
      itemId: form.selectedItem.id || '',
      itemName: form.selectedItem.name || form.itemSearch,
      reason: form.reason,
      expectedQty: Number(form.expectedQty),
      actualQty: Number(form.actualQty),
      diff: Number(form.actualQty) - Number(form.expectedQty),
      notes: form.notes.trim(),
      date: form.date,
      status: 'pending',
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'discrepancies', editingId), payload);
        toast.success('تم تعديل الفارق');
      } else {
        await addDoc(collection(db, 'discrepancies'), { ...payload, createdAt: serverTimestamp() });
        toast.success('تم تسجيل الفارق بنجاح');
      }
      resetForm();
      setIsFormOpen(false);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفارق؟')) return;
    await deleteDoc(doc(db, 'discrepancies', id));
    toast.success('تم الحذف');
  };

  const handleResolve = async (disc) => {
    await updateDoc(doc(db, 'discrepancies', disc.id), { status: 'resolved' });
    toast.success('تم وضع علامة محلول ✅');
  };

  // Stats
  const pending = discrepancies.filter(d => d.status === 'pending');
  const resolved = discrepancies.filter(d => d.status === 'resolved');
  const totalMissing = pending.filter(d => d.diff < 0).reduce((s, d) => s + Math.abs(d.diff), 0);

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <StatCard label="فوارق معلقة" value={pending.length} icon={AlertTriangle} color="rose" />
        <StatCard label="فوارق محلولة" value={resolved.length} icon={CheckCircle} color="emerald" />
        <StatCard label="إجمالي النقص (وحدة)" value={totalMissing} icon={TrendingDown} color="amber" />
        <StatCard label="إجمالي الفوارق" value={discrepancies.length} icon={ClipboardList} color="violet" />
      </div>

      {/* Inventory hint banner */}
      {pending.length > 0 && (
        <div className="shrink-0 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
            يوجد <strong>{pending.length}</strong> فارق معلق — راجعها قبل تشغيل الجرد الرسمي للحصول على أرقام دقيقة.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الفوارق..."
            className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>
        {!isViewer && (
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-500/25 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={16} />
            <span>تسجيل فارق</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-2xl shadow-inner">
        <div className="h-full overflow-x-auto overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400 dark:text-slate-500">
              <CheckCircle size={40} className="mb-3 opacity-40" />
              <p className="font-bold text-sm">لا توجد فوارق مسجلة</p>
              <p className="text-xs mt-1 opacity-70">استخدم زر "تسجيل فارق" لإضافة ملاحظة</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-right text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-black text-xs">
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">الصنف</th>
                  <th className="px-4 py-3">السبب</th>
                  <th className="px-4 py-3 text-center">المتوقع</th>
                  <th className="px-4 py-3 text-center">الفعلي</th>
                  <th className="px-4 py-3 text-center">الفارق</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">ملاحظات</th>
                  <th className="px-4 py-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                <AnimatePresence>
                  {filtered.map((disc) => {
                    const diff = disc.diff ?? (disc.actualQty - disc.expectedQty);
                    const isNeg = diff < 0;
                    const isPending = disc.status === 'pending';
                    return (
                      <motion.tr
                        key={disc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`transition-colors ${isPending ? 'hover:bg-red-50/30 dark:hover:bg-rose-500/5' : 'hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 opacity-70'}`}
                      >
                        <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{disc.date || fmtDate(disc.createdAt)}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 max-w-[150px] truncate">{disc.itemName}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">{disc.reason}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300">{disc.expectedQty}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300">{disc.actualQty}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black inline-block ${
                            diff === 0
                              ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                              : isNeg
                              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                            isPending
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                          }`}>
                            {isPending ? 'معلق' : 'محلول'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[120px] truncate">{disc.notes || '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            {!isViewer && isPending && (
                              <button type="button" onClick={() => handleResolve(disc)} title="وضع علامة محلول"
                                className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors">
                                <CheckCircle size={14} />
                              </button>
                            )}
                            {!isViewer && (
                              <>
                                <button type="button" onClick={() => openEdit(disc)} title="تعديل"
                                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                                  <Edit3 size={14} />
                                </button>
                                <button type="button" onClick={() => handleDelete(disc.id)} title="حذف"
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            dir="rtl"
            onMouseDown={() => { setIsFormOpen(false); setEditingId(null); resetForm(); }}
          >
            <motion.div
              onMouseDown={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  {editingId ? 'تعديل فارق' : 'تسجيل فارق جديد'}
                </h3>
                <button type="button" onClick={() => { setIsFormOpen(false); setEditingId(null); resetForm(); }}
                  className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Item search */}
                <div className="relative">
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">اسم الصنف <span className="text-rose-500">*</span></label>
                  {form.selectedItem ? (
                    <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 rounded-xl px-3 py-2.5 text-sm font-bold">
                      <span>{form.selectedItem.name}</span>
                      <button type="button" onClick={() => setForm(f => ({ ...f, selectedItem: null, itemSearch: '' }))}>
                        <X size={13} className="opacity-70 hover:opacity-100" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={form.itemSearch}
                        onChange={(e) => setForm(f => ({ ...f, itemSearch: e.target.value, selectedItem: null }))}
                        placeholder="ابحث عن صنف..."
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none"
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                          {suggestions.map(i => (
                            <button key={i.id} type="button"
                              onMouseDown={() => setForm(f => ({ ...f, selectedItem: i, itemSearch: i.name }))}
                              className="w-full text-right px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700/50 last:border-0 flex flex-col">
                              <span>{i.name}</span>
                              <span className="text-[10px] text-slate-400">{i.company || 'بدون شركة'} — الرصيد: {i.stockQty ?? '—'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Expected Qty */}
                  <div>
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">الكمية المتوقعة <span className="text-rose-500">*</span></label>
                    <input type="number" min="0" value={form.expectedQty}
                      onChange={(e) => setForm(f => ({ ...f, expectedQty: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none text-center" />
                  </div>
                  {/* Actual Qty */}
                  <div>
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">الكمية الفعلية <span className="text-rose-500">*</span></label>
                    <input type="number" min="0" value={form.actualQty}
                      onChange={(e) => setForm(f => ({ ...f, actualQty: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none text-center" />
                  </div>
                </div>

                {/* diff preview */}
                {form.expectedQty !== '' && form.actualQty !== '' && (
                  <div className={`text-center text-sm font-black rounded-xl py-2 ${
                    Number(form.actualQty) < Number(form.expectedQty)
                      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : Number(form.actualQty) > Number(form.expectedQty)
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    الفارق: {Number(form.actualQty) - Number(form.expectedQty) > 0 ? '+' : ''}{Number(form.actualQty) - Number(form.expectedQty)} وحدة
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">سبب الفارق</label>
                  <select value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none">
                    {DISC_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Date & Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">التاريخ</label>
                    <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">ملاحظات</label>
                    <input type="text" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="اختياري..."
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setIsFormOpen(false); setEditingId(null); resetForm(); }}
                    className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm">
                    إلغاء
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25 hover:scale-[1.02] active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                    {editingId ? 'حفظ التعديلات' : 'تسجيل الفارق'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
