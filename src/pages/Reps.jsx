import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, Pencil, Trash2, User, Users,
  AlertTriangle, TrendingUp, TrendingDown, RotateCcw,
  ChevronDown, Phone, MapPin, Package, ArrowUpRight,
  Calendar, Activity, Star, LogOut
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
const avatarColor = (name = '') => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};


/* ─── empty form (outside component to avoid re-creation) ─── */
const emptyForm = { name: '', phone: '', zone: '' };

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function Reps({ setActiveView }) {
  const { playSuccess, playWarning } = useAudio();
  const { isViewer } = useAuth();

  const [reps, setReps] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRep, setSelectedRep] = useState(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ ...emptyForm });

  /* live Supabase sync */
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: repsData } = await supabase.from('reps').select('id, name, phone, zone, created_at').order('created_at', { ascending: false });
      if (repsData) setReps(repsData.map(d => ({ ...d, createdAt: d.created_at })));

      const { data: transData } = await supabase.from('transactions').select('id, type, timestamp, rep, qty, date, item_id, item, balance_after').order('timestamp', { ascending: false });
      if (transData) setTransactions(transData);
    };

    window._refreshReps = fetchInitialData; // Expose for manual refresh
    fetchInitialData();

    const channels = [
      supabase.channel('public:reps').on('postgres_changes', { event: '*', schema: 'public', table: 'reps' }, fetchInitialData).subscribe(),
      supabase.channel('public:transactions:reps').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchInitialData).subscribe()
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);


  const filtered = useMemo(() => {
    if (!reps || !Array.isArray(reps)) return [];
    const q = (searchQuery || '').trim() ? normalizeArabic(searchQuery) : '';
    
    const result = reps.filter((r) => {
      if (!q) return true;
      const searchString = normalizeArabic(`${r.name || ''} ${r.phone || ''} ${r.zone || ''}`);
      return searchString.includes(q);
    });

    console.log('Reps Sync Check:', { total: reps.length, filtered: result.length, query: q });
    return result;
  }, [reps, searchQuery]);

  /* CRUD */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم المندوب'); try { playWarning?.(); } catch(_) {} return; }
    if (reps.some((r) => r.name.trim() === form.name.trim())) {
      toast.error('مندوب بهذا الاسم موجود بالفعل'); try { playWarning?.(); } catch(_) {} return;
    }
    setLoading(true);
    try {
      const payload = { name: form.name.trim() };
      if (form.phone?.trim()) payload.phone = form.phone.trim();
      if (form.zone?.trim()) payload.zone = form.zone.trim();
      
      const { data, error } = await supabase.from('reps').insert([payload]).select();
      console.log('✅ Insert result:', { data, error });
      if (error) throw error;
      
      toast.success('✅ تم إضافة المندوب بنجاح');
      try { playSuccess?.(); } catch(_) {}
      setIsAddOpen(false);
      setForm({ ...emptyForm });
      if (window._refreshReps) window._refreshReps();
    } catch (err) {
      console.error('❌ Supabase insert error:', err);
      toast.error(`خطأ: ${err?.message || 'حدث خطأ غير متوقع'}`);
      try { playWarning?.(); } catch(_) {}
    }
    finally { setLoading(false); }
  };

  const openEdit = (rep) => {
    setSelectedRep(rep);
    setForm({ name: rep.name || '', phone: rep.phone || '', zone: rep.zone || '' });
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
      if (window._refreshReps) window._refreshReps();
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


  return (
    <div className="flex-1 min-h-0 w-full flex flex-col font-['Cairo'] text-slate-800 dark:text-slate-100 overflow-hidden" dir="rtl">

      {/* ── PREMIUM HEADER ── */}
      <div className="mx-6 mt-6 shrink-0 z-20 mb-6">
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/60 rounded-[1.5rem] p-3 flex flex-col lg:flex-row items-center justify-between shadow-sm gap-4 lg:gap-0">
          
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start lg:pl-4 lg:border-l border-slate-200 dark:border-slate-700 shrink-0">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
                   <Users size={20} />
                </div>
                <div className="flex flex-col">
                   <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">سجل المناديب</h2>
                   <p className="text-[10px] text-slate-400 font-bold mt-1">إدارة فريق المبيعات</p>
                </div>
             </div>
             <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-xl mr-2">
               <Users size={12} className="text-violet-500" />
               <span className="text-[11px] font-black text-violet-600 dark:text-violet-400">{reps.length} مندوب</span>
             </div>
          </div>

          <div className="flex-1 w-full lg:w-auto lg:px-4 relative group flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
              <input 
                type="text" 
                placeholder="البحث بالاسم أو المنطقة أو رقم الهاتف..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 text-[13px] font-bold rounded-[14px] pr-12 pl-10 h-11 outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-violet-500/20 shadow-inner" 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
             {!isViewer && (
               <button
                 onClick={() => { setForm(emptyForm); setIsAddOpen(true); }}
                 className="flex-1 lg:flex-none flex items-center justify-center space-x-2 space-x-reverse px-5 h-11 bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-[14px] font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-violet-500/25"
               >
                 <Plus size={18} />
                 <span>إضافة مندوب</span>
               </button>
             )}
             <button 
               onClick={() => setActiveView && setActiveView('dashboard')}
               className="w-11 h-11 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:text-rose-600 rounded-[14px] flex items-center justify-center transition-all border border-rose-100 dark:border-rose-500/20 group shadow-sm shadow-rose-500/10 shrink-0"
               title="العودة للرئيسية"
             >
                <LogOut size={20} className="group-hover:-translate-x-1 transition-transform rotate-180" />
             </button>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
            {filtered.map((rep, index) => {
              const [gradient, shadow] = avatarColor(rep.name);
              const initials = rep.name?.trim().charAt(0) || '؟';

              return (
                <div
                  key={rep.id}
                  className="animate-fade-in-up group relative flex flex-col bg-white dark:bg-slate-800/40 backdrop-blur-xl border border-slate-100 dark:border-slate-700/50 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300 overflow-hidden"
                  style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
                >
                  {/* Card body */}
                  <div className="p-6 flex flex-col gap-4 flex-1">
                    {/* Top row: avatar + name + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 bg-gradient-to-br ${gradient} rounded-[1.25rem] flex items-center justify-center text-white font-black text-xl shadow-lg ${shadow} shrink-0`}>
                          {initials}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {rep.name}
                          </h3>
                          {rep.zone && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mt-1">
                              <MapPin size={13} className="text-slate-400" />
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
                      <div className="flex items-center gap-2.5 text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-[14px] border border-slate-100 dark:border-slate-700/50 w-max mt-auto">
                        <Phone size={15} className="text-violet-500" />
                        <span dir="ltr" className="tracking-wide">{rep.phone}</span>
                      </div>
                    )}

                  </div>

                  {/* Accent bar */}
                  <div className={`absolute bottom-0 right-0 w-0 h-1 bg-gradient-to-r ${gradient} group-hover:w-full transition-all duration-500 ease-out`} />
                </div>
              );
            })}
          </div>
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
    </div>
  );
}

