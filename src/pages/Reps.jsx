import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Pencil, Trash2, User, Users,
  AlertTriangle, TrendingUp, TrendingDown, RotateCcw,
  ChevronDown, Phone, MapPin, Package, ArrowUpRight,
  Calendar, Activity, Star,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';
import { useAuth } from '../contexts/AuthContext';
import { normalizeArabic } from '../lib/arabicTextUtils';

/* ─── helpers ─── */
const fmt = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const InputClass =
  'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 block px-4 py-2.5 outline-none transition-all';
const LabelClass = 'block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5';

/* ─── modal wrapper ─── */
function ModalWrapper({ title, isOpen, onClose, children, onSubmit, maxWidth = 'max-w-md', submitLabel = 'حفظ', submitColor = 'violet', loading = false }) {
  const btnColor =
    submitColor === 'rose'
      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
      : 'bg-gradient-to-br from-violet-600 to-purple-700 shadow-violet-500/25';
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
          dir="rtl" onMouseDown={onClose}
        >
          <motion.div
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]`}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">{title}</h3>
              <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white rounded-full transition-colors">
                <X size={20} className="stroke-[3]" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto custom-scrollbar flex-1">{children}</div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex space-x-3 space-x-reverse justify-end shrink-0">
                <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  إلغاء
                </button>
                <button type="submit" disabled={loading} className={`px-6 py-2 rounded-xl font-bold text-white shadow-md disabled:opacity-50 ${btnColor}`}>
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

/* ─── avatar colour from name ─── */
const AVATAR_COLORS = [
  ['from-violet-500 to-purple-600', 'shadow-violet-500/30'],
  ['from-blue-500 to-indigo-600',   'shadow-blue-500/30'],
  ['from-emerald-500 to-teal-600',  'shadow-emerald-500/30'],
  ['from-amber-500 to-orange-500',  'shadow-amber-500/30'],
  ['from-rose-500 to-pink-600',     'shadow-rose-500/30'],
  ['from-cyan-500 to-sky-600',      'shadow-cyan-500/30'],
];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function Reps() {
  const { playSuccess, playWarning } = useAudio();
  const { isViewer } = useAuth();

  const [reps, setReps] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRep, setSelectedRep] = useState(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const emptyForm = { name: '', phone: '', zone: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  /* live Supabase sync */
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: repsData } = await supabase.from('reps').select('id, name, phone, area, created_at').order('created_at', { ascending: false });
      if (repsData) setReps(repsData.map(d => ({ ...d, createdAt: d.created_at })));

      const { data: transData } = await supabase.from('transactions').select('id, type, timestamp, rep, qty, date, item_id, item, balance_after').order('timestamp', { ascending: false });
      if (transData) setTransactions(transData);
    };

    fetchInitialData();

    const channels = [
      supabase.channel('public:reps').on('postgres_changes', { event: '*', schema: 'public', table: 'reps' }, fetchInitialData).subscribe(),
      supabase.channel('public:transactions:reps').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData).subscribe()
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  /* stats per rep — count stock-out and returns referencing rep by name */
  const repStats = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      const repName = tx.rep?.trim();
      if (!repName) return;
      if (!map[repName]) map[repName] = { out: 0, returns: 0, lastActivity: null };
      if (tx.type === 'صادر') map[repName].out += Number(tx.qty || 0);
      if (tx.type === 'مرتجع') map[repName].returns += Number(tx.qty || 0);
      const ts = tx.timestamp ? new Date(tx.timestamp) : (tx.date ? new Date(tx.date) : null);
      if (ts && (!map[repName].lastActivity || ts > map[repName].lastActivity))
        map[repName].lastActivity = ts;
    });
    return map;
  }, [transactions]);

  /* history for selected rep */
  const repHistory = useMemo(() => {
    if (!selectedRep) return [];
    return transactions.filter(
      (tx) => tx.rep?.trim() === selectedRep.name?.trim() &&
              (tx.type === 'صادر' || tx.type === 'مرتجع')
    );
  }, [transactions, selectedRep]);

  const filtered = useMemo(
    () =>
      reps.filter((r) => {
        const q = normalizeArabic(searchQuery);
        return normalizeArabic([r.name, r.phone, r.area, r.notes].join(' ')).includes(q);
      }),
    [reps, searchQuery]
  );

  /* CRUD */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم المندوب'); playWarning(); return; }
    if (reps.some((r) => r.name.trim() === form.name.trim())) {
      toast.error('مندوب بهذا الاسم موجود بالفعل'); playWarning(); return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('reps').insert([{ ...form, name: form.name.trim() }]);
      if (error) throw error;
      toast.success('✅ تم إضافة المندوب بنجاح');
      playSuccess();
      setIsAddOpen(false);
      setForm(emptyForm);
    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء الحفظ');
      playWarning();
    }
    finally { setLoading(false); }
  };

  const openEdit = (rep) => {
    setSelectedRep(rep);
    setForm({ name: rep.name || '', phone: rep.phone || '', zone: rep.zone || '', notes: rep.notes || '' });
    setIsEditOpen(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم المندوب'); playWarning(); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('reps').update({ ...form, name: form.name.trim() }).eq('id', selectedRep.id);
      if (error) throw error;
      toast.success('✅ تم تعديل بيانات المندوب');
      playSuccess();
      setIsEditOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء التعديل');
      playWarning();
    }
    finally { setLoading(false); }
  };

  const openDelete = (rep) => { setSelectedRep(rep); setIsDeleteOpen(true); };

  const handleDelete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('reps').delete().eq('id', selectedRep.id);
      if (error) throw error;
      toast.success('تم حذف المندوب 🗑️');
      playSuccess();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء الحذف');
      playWarning();
    }
    finally { setLoading(false); }
  };

  const openHistory = (rep) => { setSelectedRep(rep); setIsHistoryOpen(true); };

  /* animation */
  const cv = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const kv = {
    hidden: { opacity: 0, y: 16, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 24 } },
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-['Cairo'] text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">

      {/* ── HEADER ── */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-[2rem] p-4 sm:p-5 mb-6 shrink-0 z-20 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-4 space-x-reverse flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/30 shrink-0">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">سجل المناديب</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                إدارة فريق المبيعات — متابعة الأداء والحركات المرتبطة بكل مندوب
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-xl">
              <Users size={14} className="text-violet-500" />
              <span className="text-xs font-black text-violet-600 dark:text-violet-400">{reps.length} مندوب</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl">
              <ArrowUpRight size={14} className="text-blue-500" />
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                {transactions.filter((t) => t.type === 'صادر' && t.rep).length} عملية صادر
              </span>
            </div>
          </div>

          {!isViewer && (
            <button
              onClick={() => { setForm(emptyForm); setIsAddOpen(true); }}
              className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-violet-500/25 hover:shadow-[0_0_22px_rgba(139,92,246,0.5)] self-end lg:self-auto"
            >
              <Plus size={18} />
              <span>إضافة مندوب</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 transition-all shadow-inner group">
          <Search size={16} className="text-slate-400 group-focus-within:text-violet-500 transition-colors ml-3" />
          <input
            type="text"
            placeholder="البحث بالاسم أو المنطقة أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm font-bold focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── GRID ── */}
      <div className="flex-1 overflow-y-auto px-1 pb-10 custom-scrollbar">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-12 text-center bg-white/40 dark:bg-slate-800/20 backdrop-blur-md rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 mt-4 min-h-[24rem] sm:h-[50vh]"
          >
            <Users size={56} className="text-slate-300 dark:text-slate-600 mb-6" />
            <h3 className="text-xl font-black mb-2">لا يوجد مناديب مسجلون</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold max-w-sm mb-6">
              سجّل فريق المبيعات هنا وستظهر إحصائياتهم تلقائياً من حركات الصادر والمرتجع.
            </p>
            {!isViewer && (
              <button
                onClick={() => { setForm(emptyForm); setIsAddOpen(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-xl font-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-violet-500/25"
              >
                <Plus size={20} /> إضافة مندوب جديد
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div variants={cv} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((rep) => {
              const stats = repStats[rep.name?.trim()] || { out: 0, returns: 0, lastActivity: null };
              const [gradient, shadow] = avatarColor(rep.name);
              const initials = rep.name?.trim().split(' ').slice(0, 2).map((w) => w[0]).join('') || '؟';
              const returnRate = stats.out > 0 ? Math.round((stats.returns / stats.out) * 100) : 0;

              return (
                <motion.div
                  key={rep.id} variants={kv}
                  className="group relative flex flex-col bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 overflow-hidden"
                >
                  {/* Card body */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Top row: avatar + name + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center text-white font-black text-base shadow-lg ${shadow} shrink-0`}>
                          {initials}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 dark:text-white leading-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {rep.name}
                          </h3>
                          {rep.zone && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-0.5">
                              <MapPin size={9} />
                              <span>{rep.zone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Hover actions */}
                      {!isViewer && (
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity duration-200 shrink-0">
                          <button onClick={() => openEdit(rep)} className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-[0_0_15px_rgba(59,130,246,0.25)] transition-all">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openDelete(rep)} className="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-[0_0_15px_rgba(244,63,94,0.25)] transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phone */}
                    {rep.phone && (
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700/50 w-max">
                        <Phone size={11} className="text-violet-400" />
                        <span dir="ltr">{rep.phone}</span>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mt-auto">
                      <div className="flex flex-col items-center bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl py-2 px-1">
                        <ArrowUpRight size={13} className="text-blue-500 mb-0.5" />
                        <span className="text-base font-black text-blue-600 dark:text-blue-400 leading-none">{stats.out}</span>
                        <span className="text-[9px] font-bold text-blue-400 mt-0.5">صادر</span>
                      </div>
                      <div className="flex flex-col items-center bg-orange-50/70 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl py-2 px-1">
                        <RotateCcw size={13} className="text-orange-500 mb-0.5" />
                        <span className="text-base font-black text-orange-600 dark:text-orange-400 leading-none">{stats.returns}</span>
                        <span className="text-[9px] font-bold text-orange-400 mt-0.5">مرتجع</span>
                      </div>
                      <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 rounded-xl py-2 px-1">
                        <Activity size={13} className={`mb-0.5 ${returnRate > 30 ? 'text-rose-500' : 'text-emerald-500'}`} />
                        <span className={`text-base font-black leading-none ${returnRate > 30 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {returnRate}%
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">نسبة رجوع</span>
                      </div>
                    </div>

                    {/* Last activity */}
                    {stats.lastActivity && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <Calendar size={10} />
                        <span>آخر نشاط: {fmt(stats.lastActivity)}</span>
                      </div>
                    )}
                  </div>

                  {/* History button */}
                  <button
                    onClick={() => openHistory(rep)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-t border-slate-100 dark:border-slate-700/60 text-xs font-black text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
                  >
                    <Package size={13} />
                    عرض سجل الحركات
                    <ChevronDown size={13} />
                  </button>

                  {/* Accent bar */}
                  <div className={`absolute bottom-0 right-0 w-0 h-0.5 bg-gradient-to-r ${gradient} group-hover:w-full transition-all duration-500 ease-out`} />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ══ ADD MODAL ══ */}
      <ModalWrapper title="تسجيل مندوب جديد" isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSubmit={handleAdd} loading={loading} submitLabel="إضافة المندوب">
        <RepForm form={form} setForm={setForm} />
      </ModalWrapper>

      {/* ══ EDIT MODAL ══ */}
      <ModalWrapper title={`تعديل: ${selectedRep?.name || ''}`} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onSubmit={handleEdit} loading={loading} submitLabel="حفظ التعديلات">
        <RepForm form={form} setForm={setForm} />
      </ModalWrapper>

      {/* ══ DELETE MODAL ══ */}
      <ModalWrapper title="حذف المندوب" isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onSubmit={handleDelete} loading={loading} submitLabel="نعم، احذف" submitColor="rose">
        <div className="flex flex-col items-center text-center p-2 space-y-3">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
            <AlertTriangle size={28} />
          </div>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            هل أنت متأكد من حذف المندوب <span className="font-black text-rose-600 dark:text-rose-400">{selectedRep?.name}</span>؟
          </p>
          <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700">
            سيتم حذف بطاقة المندوب فقط — لن تتأثر حركات الصادر والمرتجع المرتبطة به.
          </p>
        </div>
      </ModalWrapper>

      {/* ══ HISTORY MODAL ══ */}
      <ModalWrapper
        title={`سجل حركات: ${selectedRep?.name || ''}`}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSubmit={(e) => { e.preventDefault(); setIsHistoryOpen(false); }}
        maxWidth="max-w-2xl"
        submitLabel="إغلاق"
      >
        <RepHistory history={repHistory} repName={selectedRep?.name} />
      </ModalWrapper>
    </div>
  );
}

/* ─── Rep form fields (shared Add/Edit) ─── */
function RepForm({ form, setForm }) {
  const f = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  return (
    <div className="space-y-4">
      <div>
        <label className={LabelClass}>الاسم الكامل <span className="text-rose-500">*</span></label>
        <div className="relative">
          <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" className={`${InputClass} pr-10`} placeholder="مثال: أحمد محمد علي" value={form.name} onChange={f('name')} required autoFocus />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LabelClass}>رقم الهاتف</label>
          <div className="relative">
            <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="tel" dir="ltr" className={`${InputClass} pr-10`} placeholder="05XXXXXXXX" value={form.phone} onChange={f('phone')} />
          </div>
        </div>
        <div>
          <label className={LabelClass}>المنطقة / الجهة</label>
          <div className="relative">
            <MapPin size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="text" className={`${InputClass} pr-10`} placeholder="مثال: شمال الرياض" value={form.zone} onChange={f('zone')} />
          </div>
        </div>
      </div>
      <div>
        <label className={LabelClass}>ملاحظات</label>
        <textarea className={`${InputClass} min-h-[72px] resize-y`} placeholder="أي ملاحظات إضافية عن المندوب..." value={form.notes} onChange={f('notes')} rows={2} />
      </div>
    </div>
  );
}

/* ─── Transaction history list ─── */
function RepHistory({ history, repName }) {
  const [typeFilter, setTypeFilter] = useState('الكل');

  const filtered = useMemo(() =>
    history.filter((tx) => typeFilter === 'الكل' || tx.type === typeFilter),
    [history, typeFilter]
  );

  const totalOut = history.filter((t) => t.type === 'صادر').reduce((a, t) => a + Number(t.qty || 0), 0);
  const totalRet = history.filter((t) => t.type === 'مرتجع').reduce((a, t) => a + Number(t.qty || 0), 0);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
        <Package size={40} className="mb-3 opacity-40" />
        <p className="font-bold text-sm">لا توجد حركات مسجّلة باسم <span className="text-violet-500">{repName}</span> بعد.</p>
        <p className="text-xs mt-1">تظهر هنا عمليات الصادر والمرتجع عند تسجيلها في الوحدات المختصة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-3">
          <Star size={14} className="text-violet-400 mb-1" />
          <span className="text-xl font-black text-slate-700 dark:text-slate-200">{history.length}</span>
          <span className="text-[10px] font-bold text-slate-400">إجمالي الحركات</span>
        </div>
        <div className="flex flex-col items-center bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-3">
          <TrendingUp size={14} className="text-blue-500 mb-1" />
          <span className="text-xl font-black text-blue-600 dark:text-blue-400">{totalOut}</span>
          <span className="text-[10px] font-bold text-blue-400">كرتونة صادر</span>
        </div>
        <div className="flex flex-col items-center bg-orange-50/70 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-2xl p-3">
          <TrendingDown size={14} className="text-orange-500 mb-1" />
          <span className="text-xl font-black text-orange-600 dark:text-orange-400">{totalRet}</span>
          <span className="text-[10px] font-bold text-orange-400">كرتونة مرتجع</span>
        </div>
      </div>

      {/* filter tabs */}
      <div className="flex gap-2">
        {['الكل', 'صادر', 'مرتجع'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-4 py-1.5 rounded-xl text-xs font-black border transition-all ${
              typeFilter === t
                ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/25'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {filtered.map((tx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="flex items-center justify-between gap-3 p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.type === 'صادر' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600'}`}>
                  {tx.type === 'صادر' ? <ArrowUpRight size={13} /> : <RotateCcw size={13} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{tx.item}</p>
                  <p className="text-[10px] font-bold text-slate-400">{tx.company || '—'} · {tx.date || fmt(tx.timestamp)}</p>
                </div>
              </div>
              <span className={`text-sm font-black px-2 py-0.5 rounded-lg shrink-0 ${tx.type === 'صادر' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'}`}>
                {tx.qty} {tx.unit}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <p className="text-center text-xs font-bold text-slate-400 py-4">لا توجد حركات من هذا النوع.</p>
        )}
      </div>
    </div>
  );
}
