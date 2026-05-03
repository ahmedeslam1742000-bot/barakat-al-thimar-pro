import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Banknote, Search, Plus, Printer, Filter, 
  Download, Calendar, User, Hash, Info, 
  ArrowUpRight, Clock, CheckCircle2, ChevronRight,
  MoreHorizontal, FileText, CreditCard, Wallet, X,
  ChevronDown, Users, AlertTriangle, Pencil, Trash2,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

// Helper to format date to DD/MM/YYYY
const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export default function ReceiptVouchers({ setActiveView }) {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  
  // Reps for autocomplete
  const [reps, setReps] = useState([]);
  const [repSearchQuery, setRepSearchQuery] = useState('');
  const [isRepDropdownOpen, setIsRepDropdownOpen] = useState(false);

  // Form State
  const emptyForm = {
    date: '', 
    repName: '', // This will be synced with repSearchQuery during validation
    customerName: '',
    amount: '',
    type: 'نقدي',
    invoiceNo: '',
    voucherNo: ''
  };
  const [form, setForm] = useState(emptyForm);

  // Table Data — loaded from Supabase
  const [vouchers, setVouchers] = useState([]);

  // Fetch vouchers from Supabase
  const fetchVouchers = async () => {
    const { data, error } = await supabase
      .from('receipt_vouchers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('❌ fetchVouchers error:', error);
    } else {
      // Map snake_case columns to camelCase for UI
      setVouchers((data || []).map(r => ({
        id: r.id,
        date: r.date,
        repName: r.rep_name,
        customerName: r.customer_name,
        voucherNo: r.voucher_no,
        invoiceNo: r.invoice_no || '',
        amount: Number(r.amount),
        type: r.type,
      })));
    }
  };

  // Fetch vouchers on mount + real-time subscription
  useEffect(() => {
    fetchVouchers();
    const channel = supabase
      .channel('public:receipt_vouchers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_vouchers' }, fetchVouchers)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v =>
      (v.voucherNo || '').includes(searchTerm) ||
      (v.repName || '').includes(searchTerm) ||
      (v.customerName || '').includes(searchTerm)
    );
  }, [vouchers, searchTerm]);

  // Dirty check
  const isDirty = useMemo(() => {
    const { repName: _, ...formData } = form;
    const emptyData = { date: '', customerName: '', amount: '', type: 'نقدي', invoiceNo: '', voucherNo: '' };
    return JSON.stringify(formData) !== JSON.stringify(emptyData) || repSearchQuery !== '';
  }, [form, repSearchQuery]);

  // Fetch Reps
  useEffect(() => {
    const fetchReps = async () => {
      const { data } = await supabase.from('reps').select('name').order('name');
      if (data) setReps(data);
    };
    fetchReps();
  }, []);

  const filteredReps = useMemo(() => {
    if (!repSearchQuery) return reps;
    const q = repSearchQuery.toLowerCase();
    return reps.filter(r => r.name.toLowerCase().includes(q));
  }, [reps, repSearchQuery]);

  // Actions
  const handleSaveVoucher = () => {
    const finalRepName = repSearchQuery || form.repName;
    const currentForm = { ...form, repName: finalRepName };

    const requiredFields = ['date', 'repName', 'customerName', 'amount', 'type', 'invoiceNo', 'voucherNo'];
    for (const field of requiredFields) {
      if (!currentForm[field]) {
        toast.error(`يرجى إكمال الحقل: ${getLabelText(field)}`);
        return;
      }
    }

    const exists = reps.some(r => r.name === finalRepName);
    if (!exists) {
      toast.error('يرجى اختيار مندوب صالح من القائمة');
      return;
    }

    setIsConfirmSaveOpen(true);
  };

  const confirmSave = async () => {
    const finalRepName = repSearchQuery || form.repName;
    setLoading(true);
    try {
      const payload = {
        date: form.date,
        rep_name: finalRepName,
        customer_name: form.customerName,
        voucher_no: form.voucherNo,
        invoice_no: form.invoiceNo || '',
        amount: Number(form.amount),
        type: form.type,
      };

      if (editId) {
        const { error } = await supabase.from('receipt_vouchers').update(payload).eq('id', editId);
        if (error) throw error;
        toast.success('✅ تم التعديل بنجاح');
      } else {
        const { error } = await supabase.from('receipt_vouchers').insert([payload]);
        if (error) throw error;
        toast.success('✅ تم حفظ السند بنجاح');
      }

      await fetchVouchers();
    } catch (err) {
      console.error('❌ confirmSave error:', err);
      toast.error(`خطأ في الحفظ: ${err?.message || 'حدث خطأ غير متوقع'}`);
    } finally {
      setLoading(false);
      setIsConfirmSaveOpen(false);
      setIsModalOpen(false);
      setForm(emptyForm);
      setRepSearchQuery('');
      setEditId(null);
    }
  };

  const handleCloseModal = () => {
    if (isDirty) {
      setIsConfirmCloseOpen(true);
    } else {
      setIsModalOpen(false);
    }
  };

  const confirmExit = () => {
    setIsConfirmCloseOpen(false);
    setIsModalOpen(false);
    setForm(emptyForm);
    setRepSearchQuery('');
    setEditId(null);
  };

  const openEdit = (voucher) => {
    setForm({
      date: voucher.date,
      repName: voucher.repName,
      customerName: voucher.customerName,
      amount: voucher.amount,
      type: voucher.type,
      invoiceNo: voucher.invoiceNo,
      voucherNo: voucher.voucherNo
    });
    setRepSearchQuery(voucher.repName);
    setEditId(voucher.id);
    setIsModalOpen(true);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    // Group vouchers by type
    const groupedVouchers = filteredVouchers.reduce((acc, v) => {
      if (!acc[v.type]) acc[v.type] = [];
      acc[v.type].push(v);
      return acc;
    }, {});

    let contentHtml = '';
    let grandTotal = 0;

    const types = ['نقدي', 'شبكة', 'تحويل']; // Predefined order

    types.forEach(type => {
      const vouchersForType = groupedVouchers[type];
      if (!vouchersForType || vouchersForType.length === 0) return;

      const subtotal = vouchersForType.reduce((sum, v) => sum + Number(v.amount || 0), 0);
      grandTotal += subtotal;

      const tableRows = vouchersForType.map((v, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${formatDateToDisplay(v.date)}</td>
          <td class="font-bold">${v.repName}</td>
          <td>${v.customerName}</td>
          <td class="text-center">${v.voucherNo}</td>
          <td class="text-center">${v.invoiceNo}</td>
          <td class="text-center font-bold text-emerald">${v.amount.toLocaleString()} ر.س</td>
          <td class="text-center"><span class="badge ${type === 'نقدي' ? 'badge-cash' : type === 'شبكة' ? 'badge-card' : 'badge-transfer'}">${v.type}</span></td>
        </tr>
      `).join('');

      contentHtml += `
        <div class="section-title">محصلات الدفع: ${type}</div>
        <table>
          <thead>
            <tr>
              <th width="5%">م</th>
              <th width="12%">التاريخ</th>
              <th width="18%">المندوب</th>
              <th width="18%">العميل</th>
              <th width="12%">رقم السند</th>
              <th width="12%">رقم الفاتورة</th>
              <th width="15%">المبلغ</th>
              <th width="8%">نوع التحصيل</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="6" class="text-left font-bold" style="padding-left: 20px;">إجمالي (${type}):</td>
              <td class="text-center font-black text-emerald" style="font-size: 14px;">${subtotal.toLocaleString()} ر.س</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      `;
    });

    const html = `
      <html dir="rtl">
        <head>
          <title>تقرير سندات القبض</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
            
            :root {
              --primary: #059669;
              --primary-light: #d1fae5;
              --text-main: #1e293b;
              --text-muted: #64748b;
              --border-color: #e2e8f0;
              --bg-light: #f8fafc;
            }

            * { box-sizing: border-box; }
            body { 
              font-family: 'Cairo', sans-serif; 
              padding: 40px; 
              color: var(--text-main); 
              background-color: #fff;
              line-height: 1.5;
            }

            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid var(--primary-light);
            }

            .report-main-title {
              /* Defined below */
            }

            .section-title {
              font-size: 18px;
              font-weight: 800;
              color: #334155;
              margin: 30px 0 15px 0;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            
            .section-title::before {
              content: '';
              display: inline-block;
              width: 6px;
              height: 20px;
              background-color: var(--primary);
              border-radius: 4px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            table { 
              width: 100%; 
              border-collapse: separate; 
              border-spacing: 0;
              margin-bottom: 10px; 
              border: 1px solid var(--border-color);
              border-radius: 12px;
              overflow: hidden;
            }

            th, td { 
              padding: 10px 8px; 
              text-align: right; 
              font-size: 11px; 
            }

            th { 
              background-color: var(--bg-light); 
              font-weight: 800; 
              color: #475569; 
              border-bottom: 2px solid var(--border-color);
              white-space: nowrap;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            td {
              border-bottom: 1px solid var(--border-color);
              color: #334155;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 150px; /* safety for extremely long text */
            }

            tbody tr:last-child td {
              border-bottom: none;
            }

            tbody tr:nth-child(even) td {
              background-color: #fcfcfc;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            tfoot td {
              background-color: var(--bg-light);
              border-top: 2px solid var(--border-color);
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .text-emerald { color: #059669; }

            .badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 800;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .badge-cash { background: #d1fae5; color: #047857; }
            .badge-card { background: #dbeafe; color: #1d4ed8; }
            .badge-transfer { background: #f3e8ff; color: #7e22ce; }


            .report-main-title {
              font-size: 32px;
              font-weight: 900;
              color: var(--primary);
              letter-spacing: -0.5px;
              text-shadow: 2px 2px 0px rgba(5, 150, 105, 0.1);
              font-family: 'Cairo', sans-serif;
              position: relative;
              display: inline-block;
            }
            
            .report-main-title::after {
              content: '';
              position: absolute;
              bottom: -4px;
              right: 0;
              width: 50%;
              height: 4px;
              background-color: var(--primary);
              border-radius: 4px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .meta-info {
              text-align: left;
            }

            .meta-item {
              font-size: 14px;
              color: var(--text-muted);
            }
            .meta-item span {
              font-weight: 800;
              color: var(--text-main);
              margin-right: 8px;
              background-color: var(--bg-light);
              padding: 4px 12px;
              border-radius: 8px;
              border: 1px solid var(--border-color);
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            @media print {
              body { padding: 0; }
              table {
                break-inside: auto;
              }
              tr {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <div class="report-main-title">تقرير سندات القبض</div>
            </div>
            <div class="meta-info">
              <div class="meta-item">تاريخ الإصدار: <span>${new Date().toLocaleDateString('ar-SA')}</span></div>
            </div>
          </div>
          
          ${contentHtml || '<div class="text-center" style="padding: 40px; color: var(--text-muted);">لا توجد بيانات للعرض</div>'}
          
          <script>
            window.onload = () => {
              window.print();
            };
            window.onafterprint = () => {
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('receipt_vouchers').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم الحذف بنجاح');
      await fetchVouchers();
    } catch (err) {
      console.error('❌ handleDelete error:', err);
      toast.error('خطأ أثناء الحذف');
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isModalOpen && !isConfirmCloseOpen && !isConfirmSaveOpen) return;

      if (e.key === 'Escape') {
        if (isConfirmSaveOpen) setIsConfirmSaveOpen(false);
        else if (isConfirmCloseOpen) setIsConfirmCloseOpen(false);
        else handleCloseModal();
      }
      
      if (e.key === 'Enter') {
        if (isConfirmSaveOpen) {
          confirmSave();
        } 
        else if (isConfirmCloseOpen) {
          confirmExit();
        }
        else if (isModalOpen && !isRepDropdownOpen) {
          handleSaveVoucher();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isConfirmSaveOpen, isConfirmCloseOpen, isDirty, form, isRepDropdownOpen, repSearchQuery, reps]);

  const getLabelText = (key) => {
    const labels = {
      date: 'التاريخ',
      repName: 'اسم المندوب',
      customerName: 'اسم العميل',
      amount: 'المبلغ',
      type: 'نوع التحصيل',
      invoiceNo: 'رقم الفاتورة',
      voucherNo: 'رقم السند'
    };
    return labels[key] || key;
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 bg-[#f8fafc] dark:bg-slate-950 font-readex overflow-hidden" dir="rtl">
      
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-600/20 border border-white/20">
            <Banknote size={28} className="text-white drop-shadow-lg" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">سندات القبض</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إدارة التحصيل المالي</span>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 max-w-4xl">
          <div className="relative flex-1 w-full group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="البحث برقم السند، اسم المندوب، أو العميل..."
              className="w-full h-12 pr-11 pl-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs text-slate-700 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="h-12 px-5 flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
            <Calendar size={16} className="text-emerald-500" />
            <span className="hidden sm:inline">تصفية بالتاريخ</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => {
              setForm(emptyForm);
              setRepSearchQuery('');
              setEditId(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>إنشاء سند جديد</span>
          </button>
          <button 
            onClick={handlePrint}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 hover:text-emerald-500 transition-all shadow-sm"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={() => setActiveView && setActiveView('dashboard')}
            title="العودة للرئيسية"
            className="flex items-center justify-center w-11 h-11 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-2xl transition-all hover:bg-rose-100 hover:scale-105 active:scale-95"
          >
            <LogOut size={20} strokeWidth={2.5} className="rotate-180" />
          </button>
        </div>
      </div>



      {/* ═══ TABLE ═══ */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-right border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 w-16 text-center">م</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">التاريخ</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">اسم المندوب</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">اسم العميل</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">رقم السند</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">رقم الفاتورة</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 text-center">المبلغ</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 text-center">نوع التحصيل</th>
                <th className="bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 text-slate-500 font-black text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 text-center w-24">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredVouchers.map((voucher, idx) => (
                <tr style={{ animationDelay: `${idx * 0.05}s`, opacity: 0 }} key={voucher.id} className="animate-fade-in-up group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors">
                  <td className="px-6 py-5 text-center text-xs font-black text-slate-400 group-hover:text-emerald-500 transition-colors">{idx + 1}</td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-700 dark:text-white">{formatDateToDisplay(voucher.date)}</td>
                  <td className="px-6 py-5 text-xs font-black text-slate-700 dark:text-white truncate">
                    {voucher.repName}
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-600 dark:text-slate-300">{voucher.customerName}</td>
                  <td className="px-6 py-5">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black border border-slate-200/50 dark:border-slate-700">
                      {voucher.voucherNo}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-500 dark:text-slate-400">{voucher.invoiceNo}</td>
                  <td className="px-6 py-5 text-center text-sm font-black text-emerald-600 dark:text-emerald-400">{voucher.amount.toLocaleString()} <small className="text-[10px]">ر.س</small></td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black 
                      ${voucher.type === 'نقدي' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                        voucher.type === 'شبكة' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}
                    >
                      {voucher.type}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(voucher)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="تعديل">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(voucher.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" title="مسح">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MAIN MODAL ═══ */}
      <AnimatePresence>
        {isModalOpen && (
          <div key="main-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseModal} className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20"><Plus size={24} className="text-white" /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">
                      {editId ? 'تعديل سند قبض' : 'إنشاء سند قبض جديد'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">تعبئة بيانات التحصيل المالي الإجبارية</p>
                  </div>
                </div>
                <button onClick={handleCloseModal} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm"><X size={20} /></button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mr-1">التاريخ <span className="text-rose-500">*</span></label>
                    <div className="relative group">
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input type="date" required className="w-full h-12 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-700 dark:text-white" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mr-1">رقم السند <span className="text-rose-500">*</span></label>
                    <div className="relative group">
                      <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input type="text" required className="w-full h-12 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-700 dark:text-white" placeholder="مثال: 1001" value={form.voucherNo} onChange={(e) => setForm({...form, voucherNo: e.target.value})} />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 relative">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mr-1">اسم المندوب <span className="text-rose-500">*</span></label>
                    <div className="relative group">
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input type="text" required autoComplete="off" className="w-full h-12 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-700 dark:text-white" placeholder="ابحث عن المندوب..." value={repSearchQuery} onFocus={() => setIsRepDropdownOpen(true)} onBlur={() => setTimeout(() => setIsRepDropdownOpen(false), 200)} onChange={(e) => { setRepSearchQuery(e.target.value); setIsRepDropdownOpen(true); }} />
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                    <AnimatePresence>
                      {isRepDropdownOpen && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute z-20 top-[calc(100%+5px)] right-0 left-0 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-48 overflow-y-auto custom-scrollbar p-1">
                          {filteredReps.length > 0 ? filteredReps.map((r, i) => (
                            <button key={i} type="button" onMouseDown={(e) => { e.preventDefault(); setRepSearchQuery(r.name); setIsRepDropdownOpen(false); }} className="w-full text-right px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all">{r.name}</button>
                          )) : <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">لا يوجد نتائج</div>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mr-1">اسم العميل <span className="text-rose-500">*</span></label>
                    <div className="relative group">
                      <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input type="text" required className="w-full h-12 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-700 dark:text-white" placeholder="اسم المحل أو العميل..." value={form.customerName} onChange={(e) => setForm({...form, customerName: e.target.value})} />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mr-1">رقم الفاتورة <span className="text-rose-500">*</span></label>
                    <div className="relative group">
                      <FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input type="text" required className="w-full h-12 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-700 dark:text-white" placeholder="مثال: 5001" value={form.invoiceNo} onChange={(e) => setForm({...form, invoiceNo: e.target.value})} />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mr-1">المبلغ <span className="text-rose-500">*</span></label>
                    <div className="relative group">
                      <Wallet className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input type="number" required step="0.01" className="w-full h-12 pr-12 pl-12 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-700 dark:text-white" placeholder="0.00" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">ر.س</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 mr-1 text-center">نوع التحصيل <span className="text-rose-500">*</span></label>
                    <div className="grid grid-cols-3 gap-3">
                      {['نقدي', 'شبكة', 'تحويل'].map((t) => (
                        <button key={t} type="button" onClick={() => setForm({...form, type: t})} className={`h-12 rounded-xl font-black text-xs transition-all border ${form.type === t ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{t === 'نقدي' && <Wallet size={14} className="inline-block ml-2" />}{t === 'شبكة' && <CreditCard size={14} className="inline-block ml-2" />}{t === 'تحويل' && <ArrowUpRight size={14} className="inline-block ml-2" />}{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-3 shrink-0">
                <button type="button" onClick={handleCloseModal} className="px-6 py-3 font-bold text-xs text-slate-500 hover:text-rose-500 transition-colors">إلغاء</button>
                <button type="button" onClick={handleSaveVoucher} className="px-10 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-emerald-600/20 hover:scale-[1.03] active:scale-[0.98] transition-all">
                  {editId ? 'حفظ التعديلات' : 'حفظ السند'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ CONFIRMATION DIALOGS ═══ */}
      <AnimatePresence>
        {(isConfirmCloseOpen || isConfirmSaveOpen) && (
          <div key="confirm-modal" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsConfirmCloseOpen(false); setIsConfirmSaveOpen(false); }} className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-6 text-center">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isConfirmSaveOpen ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>{isConfirmSaveOpen ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}</div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">{isConfirmSaveOpen ? 'تأكيد حفظ السند' : 'إلغاء الإدخال؟'}</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{isConfirmSaveOpen ? 'هل أنت متأكد من صحة كافة البيانات المدخلة وتريد حفظ السند الآن؟' : 'لقد قمت بتغيير بعض البيانات، هل تريد الخروج دون حفظ التغييرات؟'}</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => { if (isConfirmSaveOpen) confirmSave(); else confirmExit(); }} className={`flex-1 py-3 rounded-xl font-black text-xs text-white shadow-lg ${isConfirmSaveOpen ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-600 shadow-rose-500/20'}`}>نعم، {isConfirmSaveOpen ? 'حفظ' : 'خروج'} (Enter)</button>
                <button type="button" onClick={() => { setIsConfirmCloseOpen(false); setIsConfirmSaveOpen(false); }} className="flex-1 py-3 rounded-xl font-black text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 transition-all">تراجع (Esc)</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
