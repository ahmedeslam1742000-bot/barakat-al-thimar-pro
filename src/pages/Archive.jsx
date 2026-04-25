import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, FileText, ArrowUpRight, ArrowDownLeft, RotateCcw, Package, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { useAudio } from '../contexts/AudioContext';

export default function Archive() {
  const { playSuccess } = useAudio();
  const [dailyArchives, setDailyArchives] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState('الكل');

  // Load archives on mount
  useEffect(() => {
    loadArchives();
    runDailyPurgeCheck();
  }, []);

  // Load all archived daily summaries
  const loadArchives = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('daily_archives').select('id, date_key, timestamp, date_text, day_name').order('date_key', { ascending: false });
      if (error) throw error;
      setDailyArchives(data.map(d => ({ ...d, dateKey: d.date_key, date: d.date_text, dayName: d.day_name })));
    } catch (err) {
      console.error('Error loading archives:', err);
    }
    setLoading(false);
  };

  // Run daily purge check on first login each day
  const runDailyPurgeCheck = async () => {
    const today = new Date();
    const todayKey = today.toISOString().split('T')[0];
    const lastPurgeDate = localStorage.getItem('lastPurgeDate');
    
    if (lastPurgeDate !== todayKey) {
      await archiveTodayAndPurge(todayKey);
      localStorage.setItem('lastPurgeDate', todayKey);
    }
  };

  // Archive today's transactions and purge from main collection
  const archiveTodayAndPurge = async (dateKey) => {
    try {
      const startOfDay = `${dateKey}T00:00:00Z`;
      const endOfDay = `${dateKey}T23:59:59Z`;

      // Get today's transactions
      const { data: todayTx, error: txError } = await supabase
        .from('transactions')
        .select('id, type, item_id, balance_after, is_invoice, batch_id, source_voucher_id, timestamp, item, rep, loc, supplier, qty, invoiced, documentary, isFunctional, voucherGroupId, deducted, status, total_qty, is_new_item, beneficiary, recipient, receipt_type, receipt_number, receipt_image, unit, cat, company, date')
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay);

      if (txError) throw txError;
      if (!todayTx || todayTx.length === 0) return;

      // Categorize transactions
      const inbound = todayTx.filter(tx => tx.type === 'وارد' || tx.type === 'Restock' || tx.type === 'سند إدخال');
      const outbound = todayTx.filter(tx => tx.type === 'صادر' || tx.type === 'Issue');
      const returns = todayTx.filter(tx => tx.type === 'Return' || tx.type === 'مرتجع');
      const newItems = todayTx.filter(tx => tx.is_new_item === true);

      const today = new Date();
      // Create archive document
      const archiveData = {
        date_key: dateKey,
        date_text: today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        day_name: today.toLocaleDateString('ar-SA', { weekday: 'long' }),
        transactions: todayTx,
        inbound,
        outbound,
        returns,
        new_items: newItems,
        stats: {
          total: todayTx.length,
          inbound: inbound.length,
          outbound: outbound.length,
          returns: returns.length,
          newItems: newItems.length
        }
      };

      // Save to daily_archives collection
      const { error: insError } = await supabase.from('daily_archives').upsert([archiveData]);
      if (insError) throw insError;
      
      // Delete archived transactions from main collection
      const ids = todayTx.map(tx => tx.id);
      const { error: delError } = await supabase.from('transactions').delete().in('id', ids);
      if (delError) throw delError;

      toast.success(`تم أرشفة ${todayTx.length} عملية من اليوم بنجاح ✅`);
      playSuccess();
      loadArchives();
    } catch (err) {
      console.error('Error during daily purge:', err);
    }
  };

  // Filter archives by year/month
  const filteredArchives = useMemo(() => {
    return dailyArchives.filter(archive => {
      if (!archive.dateKey) return false;
      const date = new Date(archive.dateKey);
      if (date.getFullYear() !== filterYear) return false;
      if (filterMonth !== 'الكل') {
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const monthIndex = monthNames.indexOf(filterMonth);
        if (date.getMonth() !== monthIndex) return false;
      }
      return true;
    });
  }, [dailyArchives, filterYear, filterMonth]);

  // Group archives by month for ledger view
  const groupedByMonth = useMemo(() => {
    const groups = {};
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    filteredArchives.forEach(archive => {
      const date = new Date(archive.dateKey);
      const monthName = monthNames[date.getMonth()];
      if (!groups[monthName]) groups[monthName] = [];
      groups[monthName].push(archive);
    });
    
    return groups;
  }, [filteredArchives]);

  return (
    <div className="flex-1 min-h-0 h-full w-full flex flex-col gap-5 bg-transparent text-text-primary-light dark:text-text-primary-dark overflow-hidden box-border">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[26px] font-bold text-[#0F2747] font-tajawal leading-tight">أرشيف التعاملات</h1>
          <p className="text-[13px] text-slate-400 font-readex mt-1">سجل كامل لجميع الحركات المخزنية</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
          <Calendar size={14} className="text-slate-400" />
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="text-xs bg-transparent outline-none text-slate-700 font-bold font-tajawal"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none text-slate-700 font-bold font-tajawal"
        >
          <option value="الكل">الكل</option>
          {['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Daily Ledger View */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-300">
            <p className="text-sm font-semibold">جاري التحميل...</p>
          </div>
        ) : Object.keys(groupedByMonth).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <FileText size={48} strokeWidth={1.2} className="mb-3" />
            <p className="text-sm font-semibold">لا توجد أرشيفات</p>
            <p className="text-xs text-slate-400 mt-1">سيتم الأرشفة تلقائياً في نهاية كل يوم</p>
          </div>
        ) : (
          Object.entries(groupedByMonth).map(([monthName, archives]) => (
            <div key={monthName} className="mb-6">
              <h3 className="text-sm font-bold text-slate-500 font-tajawal mb-3 px-2">{monthName}</h3>
              <div className="space-y-1">
                {archives.map(archive => (
                  <motion.div
                    key={archive.id}
                    whileHover={{ scale: 1.005, backgroundColor: '#F8FAFC' }}
                    onClick={() => setSelectedDay(archive)}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0F2747] font-tajawal">{archive.date || archive.dateKey}</p>
                        <p className="text-[10px] text-slate-400 font-readex">{archive.dayName || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {archive.stats && (
                        <>
                          <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                            وارد: {archive.stats.inbound}
                          </span>
                          <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded-lg">
                            صادر: {archive.stats.outbound}
                          </span>
                          <span className="text-xs text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-lg">
                            مرتجع: {archive.stats.returns}
                          </span>
                        </>
                      )}
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                        {archive.stats?.total || archive.transactions?.length || 0} عملية
                      </span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Day-in-Review Full-Screen Modal */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-50 overflow-y-auto"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0F2747] font-tajawal">ملخص اليوم</h2>
                  <p className="text-xs text-slate-500 font-readex">{selectedDay.date || selectedDay.dateKey}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Day-in-Review Content */}
            <div className="max-w-7xl mx-auto p-6">
              {/* Inventory Gains Section */}
              <DayInSection
                title="المكاسب المخزنية"
                subtitle="الوارد + سندات إدخال"
                color="emerald"
                transactions={selectedDay.inbound || selectedDay.transactions?.filter(tx => tx.type === 'وارد' || tx.type === 'Restock') || []}
              />

              {/* Inventory Reductions Section */}
              <DayInSection
                title="الاستقطاعات المخزنية"
                subtitle="الصادر + فواتير + سندات إخراج"
                color="red"
                transactions={selectedDay.outbound || selectedDay.transactions?.filter(tx => tx.type === 'صادر' || tx.type === 'Issue') || []}
              />

              {/* Corrections Section */}
              <DayInSection
                title="التصحيحات"
                subtitle="المرتجع"
                color="purple"
                transactions={selectedDay.returns || selectedDay.transactions?.filter(tx => tx.type === 'Return' || tx.type === 'مرتجع') || []}
              />

              {/* Registry Section */}
              <DayInSection
                title="الأصناف الجديدة"
                subtitle="الأصناف المعرفة"
                color="blue"
                transactions={selectedDay.newItems || selectedDay.transactions?.filter(tx => tx.isNewItem) || []}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Day-in-Review Section Component
function DayInSection({ title, subtitle, color, transactions }) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', count: 'text-emerald-600' },
    red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-700', count: 'text-red-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', count: 'text-purple-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', count: 'text-blue-600' },
  };
  const c = colorMap[color];

  return (
    <div className="mb-6 bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Section Header */}
      <div className={`px-6 py-4 ${c.bg} border-b ${c.border} flex items-center justify-between`}>
        <div>
          <h3 className={`text-base font-bold ${c.text} font-tajawal`}>{title}</h3>
          <p className="text-[10px] text-slate-500 font-readex">{subtitle}</p>
        </div>
        <span className={`text-sm font-bold ${c.count} ${c.badge} px-3 py-1.5 rounded-lg`}>
          {transactions?.length || 0} عملية
        </span>
      </div>

      {/* Transaction Table */}
      {transactions?.length === 0 ? (
        <div className="px-6 py-8 text-center text-slate-400 text-xs">لا توجد عمليات</div>
      ) : (
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50">
            <tr className="text-[10px] font-bold text-slate-600 border-b border-slate-100">
              <th className="px-4 py-2.5 text-center w-10">#</th>
              <th className="px-4 py-2.5">الصنف</th>
              <th className="px-4 py-2.5 text-center w-24">القسم</th>
              <th className="px-4 py-2.5 text-center w-20">الكمية</th>
              <th className="px-4 py-2.5 text-center w-24">النوع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {transactions?.map((tx, idx) => (
              <tr key={tx.id || idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-[10px] font-bold text-slate-500 text-center">{idx + 1}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-800">{tx.item || tx.name || '-'}</td>
                <td className="px-4 py-3 text-[10px] text-center">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{tx.cat || '-'}</span>
                </td>
                <td className={`px-4 py-3 text-xs font-bold text-center ${color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : 'text-slate-600'}`}>
                  {tx.qty || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${c.badge}`}>
                    {tx.type || '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
