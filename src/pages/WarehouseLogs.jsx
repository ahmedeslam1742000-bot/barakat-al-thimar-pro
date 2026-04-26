import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, Plus, Trash2, X, CheckCircle,
  TrendingDown, TrendingUp, RotateCcw, Package, Truck,
  ArrowUpRight, FileText, ClipboardList, ChevronDown, Search,
  Calendar, Clock, Edit3, Save, Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { normalizeArabic } from '../lib/arabicTextUtils';

// ─── helpers ────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const TX_TYPES = {
  'وارد': { label: 'وارد', color: 'emerald', icon: TrendingUp, bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  'صادر': { label: 'صادر', color: 'orange', icon: TrendingDown, bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  'مرتجع': { label: 'مرتجع', color: 'amber', icon: RotateCcw, bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  'سند إدخال': { label: 'سند إدخال', color: 'teal', icon: FileText, bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' },
  'سند إخراج': { label: 'سند إخراج', color: 'purple', icon: FileText, bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
};

const getTxStyle = (type) => TX_TYPES[type] || { label: type, color: 'slate', icon: Package, bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' };

const DISC_REASONS = ['نقص في العدد', 'تلف / كسر', 'انتهاء صلاحية', 'اختلاف في الوزن', 'سرقة مشتبه بها', 'خطأ في الإدخال', 'أخرى'];

// ─── main component ──────────────────────────────────────────────────────────
export default function WarehouseLogs() {
  const [activeTab, setActiveTab] = useState('daily');

  // ── shared data ──
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: transData } = await supabase.from('transactions').select('id, type, timestamp, item, company, qty, unit, lineNote, note, supplyNotes, date, balance_after, item_id, is_summary').order('timestamp', { ascending: false });
      if (transData) setTransactions(transData);

      const { data: itemsData } = await supabase.from('products').select('id, name, company, cat, unit, stock_qty');
      if (itemsData) setItems(itemsData.map(d => ({ ...d, stockQty: d.stock_qty })));

      const { data: discData } = await supabase.from('discrepancies').select('id, created_at, item_id, item_name, expected_qty, actual_qty, diff, note, status').order('created_at', { ascending: false });
      if (discData) setDiscrepancies(discData.map(d => ({ 
          ...d, 
          itemName: d.item_name, 
          itemId: d.item_id,
          expectedQty: d.expected_qty,
          actualQty: d.actual_qty,
          createdAt: d.created_at
      })));
    };

    fetchInitialData();

    const channels = [
      supabase.channel('public:transactions:logs').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData).subscribe(),
      supabase.channel('public:products:logs').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchInitialData).subscribe(),
      supabase.channel('public:discrepancies:logs').on('postgres_changes', { event: '*', schema: 'public', table: 'discrepancies' }, fetchInitialData).subscribe()
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col gap-6 animate-in fade-in duration-500 font-readex" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-violet-500/20 shrink-0">
            <ClipboardList size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">سجلات المستودع</h1>
            <p className="text-slate-400 mt-1 font-bold text-sm">مراقبة الحركة اليومية وتوثيق الفوارق قبل الجرد الرسمي</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1.5 bg-slate-100/50 p-1.5 rounded-2xl w-fit flex-wrap border border-slate-200/50">
          <TabButton id="daily" active={activeTab} icon={Activity} label="النشاط اليومي" onClick={setActiveTab} />
          <TabButton id="discrepancy" active={activeTab} icon={AlertTriangle} label="سجل الفوارق" onClick={setActiveTab} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'daily' && (
            <motion.div key="daily" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="h-full">
              <DailyActivity transactions={transactions} />
            </motion.div>
          )}
          {activeTab === 'discrepancy' && (
            <motion.div key="disc" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="h-full">
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
      className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-black text-sm transition-all duration-300 ${
        isActive
          ? 'bg-white text-violet-600 shadow-lg shadow-violet-500/5 border border-slate-200'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
      }`}
    >
      <Icon size={18} className={isActive ? 'text-violet-600' : 'text-slate-400'} />
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
      if (tx.is_summary === true) return false;
      const txDate = tx.date || (tx.timestamp ? new Date(tx.timestamp).toISOString().split('T')[0] : '');
      if (dateFilter && txDate !== dateFilter) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (search.trim()) {
        const q = normalizeArabic(search);
        const itemText = normalizeArabic(tx.item || '');
        const compText = normalizeArabic(tx.company || '');
        const typeText = normalizeArabic(tx.type || '');
        if (!itemText.includes(q) && !compText.includes(q) && !typeText.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, dateFilter, typeFilter, search]);

  // Stats for today
  const todayTxs = useMemo(() => transactions.filter((tx) => {
    if (tx.is_summary === true) return false;
    const txDate = tx.date || (tx.timestamp ? new Date(tx.timestamp).toISOString().split('T')[0] : '');
    return txDate === todayStr();
  }), [transactions]);

  const statsData = useMemo(() => {
    const inQty = todayTxs.filter(t => t.type === 'وارد').reduce((s, t) => s + (Number(t.qty) || 0), 0);
    const outQty = todayTxs.filter(t => t.type === 'صادر').reduce((s, t) => s + (Number(t.qty) || 0), 0);
    const retQty = todayTxs.filter(t => t.type === 'مرتجع').reduce((s, t) => s + (Number(t.qty) || 0), 0);
    return { total: todayTxs.length, inQty, outQty, retQty };
  }, [todayTxs]);

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Today Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <StatCard label="إجمالي العمليات اليوم" value={statsData.total} icon={Activity} color="violet" />
        <StatCard label="إجمالي الوارد" value={statsData.inQty} icon={TrendingUp} color="emerald" />
        <StatCard label="إجمالي الصادر" value={statsData.outQty} icon={TrendingDown} color="orange" />
        <StatCard label="إجمالي المرتجع" value={statsData.retQty} icon={RotateCcw} color="amber" />
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-100 p-5 rounded-[2rem] flex flex-col md:flex-row md:items-center gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-3 rounded-2xl border border-slate-200/50 flex-1 md:flex-none md:min-w-[200px]">
          <Calendar size={18} className="text-slate-400 shrink-0" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent text-sm font-black text-slate-800 outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-3 rounded-2xl border border-slate-200/50 flex-1 md:flex-none md:min-w-[200px]">
          <Filter size={18} className="text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent text-sm font-black text-slate-800 outline-none w-full cursor-pointer appearance-none"
          >
            <option value="all">كل أنواع الحركات</option>
            <option value="وارد">وارد</option>
            <option value="صادر">صادر</option>
            <option value="مرتجع">مرتجع</option>
            <option value="سند إدخال">سند إدخال</option>
            <option value="سند إخراج">سند إخراج</option>
          </select>
        </div>

        <div className="relative flex-1 group">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن صنف أو شركة..."
            className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 font-black text-sm rounded-2xl pr-11 pl-4 py-3 outline-none focus:bg-white focus:border-violet-500/20 focus:ring-4 focus:ring-violet-500/5 transition-all"
          />
        </div>

        <button
          type="button"
          onClick={() => { setDateFilter(todayStr()); setTypeFilter('all'); setSearch(''); }}
          className="text-xs font-black text-slate-400 hover:text-violet-600 transition-colors py-3 px-5 rounded-2xl hover:bg-violet-50 border border-transparent hover:border-violet-100"
        >
          إعادة ضبط
        </button>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden flex flex-col flex-1 shadow-sm">
        <div className="h-full overflow-x-auto overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                <Activity size={40} className="opacity-20 animate-pulse text-slate-400" />
              </div>
              <p className="font-black text-xl text-slate-800">لا توجد حركات مسجلة</p>
              <p className="text-sm mt-2 font-bold opacity-60">حاول تغيير معايير البحث أو التاريخ المختار</p>
            </div>
          ) : (
            <table className="w-full text-right text-sm whitespace-nowrap border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50/95 backdrop-blur-md border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider text-[11px]">
                  <th className="px-8 py-5 text-right rounded-tr-[2rem]">الوقت</th>
                  <th className="px-6 py-5">النوع</th>
                  <th className="px-6 py-5">اسم الصنف والمواصفات</th>
                  <th className="px-6 py-5 text-center">الكمية</th>
                  <th className="px-6 py-5">الوحدة</th>
                  <th className="px-8 py-5 text-right rounded-tl-[2rem]">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {filtered.map((tx, i) => {
                    const style = getTxStyle(tx.type);
                    const Icon = style.icon;
                    return (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-50/80 transition-all duration-300 group"
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2.5 text-xs font-black text-slate-400 group-hover:text-slate-600 transition-colors">
                            <Clock size={14} className="opacity-70" />
                            <span dir="ltr" className="tracking-tight">{fmtTime(tx.timestamp)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border shadow-sm ${style.bg} ${style.text} ${style.border}`}>
                            <Icon size={12} />
                            {style.label}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 group-hover:text-violet-600 transition-colors tracking-tight text-base">{tx.item || '—'}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{tx.company || '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-xl font-black text-sm shadow-sm ${style.bg} ${style.text} ${style.border}`}>
                            {tx.type === 'صادر' ? '-' : tx.type === 'وارد' ? '+' : ''}{tx.qty ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-black text-slate-500 text-xs">{tx.unit || '—'}</td>
                        <td className="px-8 py-5 text-[11px] font-bold text-slate-400 max-w-[250px] truncate italic group-hover:text-slate-600 transition-colors">
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
  violet: 'from-violet-600 to-indigo-700 shadow-violet-500/20',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
  orange: 'from-orange-500 to-rose-600 shadow-orange-500/20',
  amber: 'from-amber-500 to-orange-500 shadow-amber-500/20',
  rose: 'from-rose-500 to-rose-600 shadow-rose-500/20',
};

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-5 flex items-center gap-5 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${COLOR_MAP[color]} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-500`}>
        <Icon size={24} />
      </div>
      <div className="overflow-hidden">
        <p className="text-2xl font-black text-slate-800 leading-tight tracking-tight group-hover:translate-x-1 transition-transform duration-500">{value}</p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight mt-1">{label}</p>
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
    const q = normalizeArabic(form.itemSearch);
    return items.filter(i => normalizeArabic(i.name || '').includes(q) || normalizeArabic(i.company || '').includes(q)).slice(0, 8);
  }, [items, form.itemSearch, form.selectedItem]);

  const filtered = useMemo(() => {
    if (!search.trim()) return discrepancies;
    const q = normalizeArabic(search);
    return discrepancies.filter(d =>
      normalizeArabic(d.itemName || '').includes(q) ||
      normalizeArabic(d.reason   || '').includes(q) ||
      normalizeArabic(d.notes    || '').includes(q)
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
      item_id: form.selectedItem.id || null,
      item_name: form.selectedItem.name || form.itemSearch,
      reason: form.reason,
      expected_qty: Number(form.expectedQty),
      actual_qty: Number(form.actualQty),
      diff: Number(form.actualQty) - Number(form.expectedQty),
      notes: form.notes.trim(),
      date: form.date,
      status: 'pending',
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('discrepancies').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('تم تعديل الفارق');
      } else {
        const { error } = await supabase.from('discrepancies').insert(payload);
        if (error) throw error;
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
    const { error } = await supabase.from('discrepancies').delete().eq('id', id);
    if (error) throw error;
    toast.success('تم الحذف');
  };

  const handleResolve = async (disc) => {
    const { error } = await supabase.from('discrepancies').update({ status: 'resolved' }).eq('id', disc.id);
    if (error) throw error;
    toast.success('تم وضع علامة محلول ✅');
  };

  // Stats
  const pending = discrepancies.filter(d => d.status === 'pending');
  const resolved = discrepancies.filter(d => d.status === 'resolved');
  const totalMissing = pending.filter(d => d.diff < 0).reduce((s, d) => s + Math.abs(d.diff), 0);

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
        <StatCard label="فوارق معلقة" value={pending.length} icon={AlertTriangle} color="rose" />
        <StatCard label="فوارق محلولة" value={resolved.length} icon={CheckCircle} color="emerald" />
        <StatCard label="إجمالي النقص" value={totalMissing} icon={TrendingDown} color="amber" />
        <StatCard label="إجمالي الفوارق" value={discrepancies.length} icon={ClipboardList} color="violet" />
      </div>

      {/* Inventory hint banner */}
      {pending.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="shrink-0 bg-amber-50 border border-amber-200 rounded-[1.5rem] px-6 py-4 flex items-center gap-4 shadow-sm shadow-amber-500/5">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-500/20">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm font-black text-amber-800 tracking-tight leading-relaxed">
            يوجد <strong className="text-lg underline decoration-amber-300 decoration-2 underline-offset-4">{pending.length}</strong> فارق معلق — يرجى مراجعتها قبل تشغيل الجرد الرسمي لضمان دقة البيانات.
          </p>
        </motion.div>
      )}

      {/* Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[300px] bg-white border border-slate-100 rounded-2xl px-5 py-3 shadow-sm group">
          <Search size={18} className="text-slate-400 group-focus-within:text-violet-500 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الفوارق (الصنف، السبب، الملاحظات)..."
            className="w-full bg-transparent text-sm font-black text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal"
          />
        </div>
        {!isViewer && (
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-violet-500/25 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={20} />
            <span>تسجيل فارق جديد</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col">
        <div className="h-full overflow-x-auto overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                <CheckCircle size={40} className="opacity-20 text-slate-400" />
              </div>
              <p className="font-black text-xl text-slate-800">لا توجد فوارق مسجلة</p>
              <p className="text-sm mt-2 font-bold opacity-60">استخدم زر "تسجيل فارق" لإضافة ملاحظة جديدة</p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-right text-sm whitespace-nowrap border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50/95 backdrop-blur-md border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider text-[11px]">
                  <th className="px-8 py-5 rounded-tr-[2rem]">التاريخ</th>
                  <th className="px-6 py-5">الصنف</th>
                  <th className="px-6 py-5">السبب</th>
                  <th className="px-6 py-5 text-center">المتوقع</th>
                  <th className="px-6 py-5 text-center">الفعلي</th>
                  <th className="px-6 py-5 text-center">الفارق</th>
                  <th className="px-6 py-5">الحالة</th>
                  <th className="px-6 py-5">ملاحظات</th>
                  <th className="px-8 py-5 text-center rounded-tl-[2rem]">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
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
                        className={`transition-all duration-300 group ${isPending ? 'hover:bg-rose-50/50' : 'hover:bg-emerald-50/50 opacity-70'}`}
                      >
                        <td className="px-8 py-5 text-xs font-black text-slate-400 group-hover:text-slate-600 transition-colors">{disc.date || fmtDate(disc.createdAt)}</td>
                        <td className="px-6 py-5">
                          <span className="font-black text-slate-800 group-hover:text-violet-600 transition-colors text-base tracking-tight">{disc.itemName}</span>
                        </td>
                        <td className="px-6 py-5 text-xs font-black text-slate-600">{disc.reason}</td>
                        <td className="px-6 py-5 text-center font-black text-slate-500 text-base">{disc.expectedQty}</td>
                        <td className="px-6 py-5 text-center font-black text-slate-800 text-base">{disc.actualQty}</td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-xl font-black text-sm shadow-sm ${
                            diff === 0
                              ? 'bg-slate-100 text-slate-500 border border-slate-200'
                              : isNeg
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          }`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm ${
                            isPending
                              ? 'bg-amber-50 text-amber-600 border-amber-200'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {isPending ? 'معلق' : 'محلول'}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-[11px] font-bold text-slate-400 max-w-[150px] truncate italic group-hover:text-slate-600 transition-colors">{disc.notes || '—'}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isViewer && isPending && (
                              <button type="button" onClick={() => handleResolve(disc)} title="وضع علامة محلول"
                                className="p-2.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-emerald-100">
                                <CheckCircle size={16} />
                              </button>
                            )}
                            {!isViewer && (
                              <>
                                <button type="button" onClick={() => openEdit(disc)} title="تعديل"
                                  className="p-2.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-100">
                                  <Edit3 size={16} />
                                </button>
                                <button type="button" onClick={() => handleDelete(disc.id)} title="حذف"
                                  className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-100">
                                  <Trash2 size={16} />
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            dir="rtl"
            onMouseDown={() => { setIsFormOpen(false); setEditingId(null); resetForm(); }}
          >
            <motion.div
              onMouseDown={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    <AlertTriangle size={20} />
                  </div>
                  {editingId ? 'تعديل فارق مسجل' : 'تسجيل فارق جديد'}
                </h3>
                <button type="button" onClick={() => { setIsFormOpen(false); setEditingId(null); resetForm(); }}
                  className="p-2.5 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} className="stroke-[3]" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Item search */}
                <div className="relative">
                  <label className="block text-xs font-black text-slate-700 mb-2 mr-1">اسم الصنف المستهدف <span className="text-rose-500">*</span></label>
                  {form.selectedItem ? (
                    <div className="flex items-center justify-between bg-violet-50 border border-violet-200 text-violet-700 rounded-2xl px-4 py-3 text-sm font-black shadow-sm">
                      <span>{form.selectedItem.name}</span>
                      <button type="button" onClick={() => setForm(f => ({ ...f, selectedItem: null, itemSearch: '' }))} className="text-violet-400 hover:text-violet-600">
                        <X size={16} className="stroke-[3]" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative group">
                      <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                      <input
                        type="text"
                        value={form.itemSearch}
                        onChange={(e) => setForm(f => ({ ...f, itemSearch: e.target.value, selectedItem: null }))}
                        placeholder="ابحث عن صنف بالاسم أو المورد..."
                        className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 text-sm font-black rounded-2xl pr-11 pl-4 py-3.5 outline-none focus:bg-white focus:border-violet-500/20 focus:ring-4 focus:ring-violet-500/5 transition-all shadow-inner"
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute top-full right-0 left-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto p-1.5 animate-in slide-in-from-top-2 duration-200">
                          {suggestions.map(i => (
                            <button key={i.id} type="button"
                              onMouseDown={() => setForm(f => ({ ...f, selectedItem: i, itemSearch: i.name }))}
                              className="w-full text-right px-4 py-3 text-sm font-black text-slate-700 hover:bg-violet-50 hover:text-violet-700 rounded-xl border-b border-slate-50 last:border-0 flex flex-col gap-0.5 transition-colors">
                              <span>{i.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{i.company || 'بدون شركة'} — الرصيد الحالي: {i.stockQty ?? '—'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Expected Qty */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2 mr-1">الكمية المتوقعة (سستيم)</label>
                    <input type="number" min="0" value={form.expectedQty}
                      onChange={(e) => setForm(f => ({ ...f, expectedQty: e.target.value }))}
                      className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 text-base font-black rounded-2xl px-4 py-3.5 outline-none text-center focus:bg-white transition-all shadow-inner" />
                  </div>
                  {/* Actual Qty */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2 mr-1">الكمية الفعلية (رف)</label>
                    <input type="number" min="0" value={form.actualQty}
                      onChange={(e) => setForm(f => ({ ...f, actualQty: e.target.value }))}
                      className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 text-base font-black rounded-2xl px-4 py-3.5 outline-none text-center focus:bg-white transition-all shadow-inner" />
                  </div>
                </div>

                {/* diff preview */}
                {form.expectedQty !== '' && form.actualQty !== '' && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className={`text-center text-base font-black rounded-2xl py-3 border-2 border-dashed ${
                    Number(form.actualQty) < Number(form.expectedQty)
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : Number(form.actualQty) > Number(form.expectedQty)
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    محصلة الفارق: {Number(form.actualQty) - Number(form.expectedQty) > 0 ? '+' : ''}{Number(form.actualQty) - Number(form.expectedQty)} وحدة
                  </motion.div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2 mr-1">سبب هذا الفارق</label>
                  <select value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                    className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 text-sm font-black rounded-2xl px-4 py-3.5 outline-none cursor-pointer focus:bg-white transition-all shadow-inner appearance-none">
                    {DISC_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Date & Notes */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2 mr-1">تاريخ الملاحظة</label>
                    <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 text-sm font-black rounded-2xl px-4 py-3.5 outline-none focus:bg-white transition-all shadow-inner" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2 mr-1">ملاحظات إضافية</label>
                    <input type="text" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="اختياري..."
                      className="w-full bg-slate-100/50 border border-slate-200/50 text-slate-800 text-sm font-black rounded-2xl px-4 py-3.5 outline-none focus:bg-white transition-all shadow-inner" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => { setIsFormOpen(false); setEditingId(null); resetForm(); }}
                    className="flex-1 py-4 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all text-sm border border-transparent hover:border-slate-200">
                    إلغاء العملية
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-2 py-4 px-8 rounded-2xl font-black text-white bg-gradient-to-br from-violet-600 to-indigo-700 shadow-xl shadow-violet-500/25 hover:shadow-2xl hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-95 transition-all text-sm flex items-center justify-center gap-3 disabled:opacity-50">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                    {editingId ? 'حفظ التغييرات' : 'اعتماد تسجيل الفارق'}
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
