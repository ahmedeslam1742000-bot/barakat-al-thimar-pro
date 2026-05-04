/**
 * Settings.jsx — Final Synchronized Version
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon, Users, Check, Plus, Trash2,
  Shield, Info, Save
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

const Spinner = () => <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />;
const inputCls = "w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right";

function Card({ title, subtitle, icon: Icon, accent = 'rose', number, children }) {
  const accents = { rose: 'from-rose-500 to-rose-600', blue: 'from-blue-500 to-indigo-600' };
  const badgeColors = { rose: 'text-rose-600 bg-rose-50', blue: 'text-blue-600 bg-blue-50' };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 flex items-center gap-4 justify-end">
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center gap-2 justify-end">
            {number && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeColors[accent]}`}>م{number}</span>}
            <h3 className="font-black text-base text-slate-800 dark:text-white font-tajawal">{title}</h3>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${accents[accent]}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="p-6 space-y-4 flex-1">{children}</div>
    </div>
  );
}

function S6Permissions({ users = [] }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const filteredUsers = (users || []).filter(u => u.email !== 'ahmed_eslam288@yahoo.com');

  const PAGES = [
    { id: 'dashboard', label: 'لوحة القيادة' }, { id: 'items', label: 'الأصناف' },
    { id: 'stock-in', label: 'الوارد' }, { id: 'stock-out', label: 'الفواتير' },
    { id: 'returns', label: 'المرتجع' }, { id: 'receipt-vouchers', label: 'سندات قبض' },
    { id: 'voucher-outward', label: 'سند إخراج' }, { id: 'inventory', label: 'جرد المستودع' },
    { id: 'inbound-records', label: 'أذونات الواردات' }, { id: 'stock-card', label: 'الرصيد التراكمي' },
    { id: 'reps', label: 'المناديب' }, { id: 'price-list', label: 'الأسعار' }, { id: 'settings', label: 'الإعدادات' }
  ];

  const fetchPerms = async (user) => {
    setSelectedUser(user);
    const { data } = await supabase.from('user_permissions').select('page_id, is_allowed').eq('user_id', user.id);
    setUserPerms(data || []);
  };

  const toggle = async (pageId, current) => {
    if (saving) return;
    setSaving(true);
    try {
      await supabase.from('user_permissions').upsert({ user_id: selectedUser.id, page_id: pageId, is_allowed: !current }, { onConflict: 'user_id, page_id' });
      setUserPerms(prev => {
        const exists = prev.find(p => p.page_id === pageId);
        if (exists) return prev.map(p => p.page_id === pageId ? { ...p, is_allowed: !current } : p);
        return [...prev, { page_id: pageId, is_allowed: !current }];
      });
      toast.success('تم تحديث الصلاحية');
    } catch { toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  return (
    <Card title="صلاحيات الوصول" subtitle="التحكم في صفحات المستخدمين" icon={Shield} accent="rose" number="1">
      <div className="space-y-4" dir="rtl">
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {filteredUsers.length === 0 ? (
            <p className="text-[10px] text-slate-400 font-bold">لا يوجد مستخدمين</p>
          ) : filteredUsers.map(u => (
            <button key={u.id} onClick={() => fetchPerms(u)} className={`px-4 py-2 rounded-xl text-xs font-black border whitespace-nowrap transition-all ${selectedUser?.id === u.id ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}>
              {u.username}
            </button>
          ))}
        </div>
        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
          {!selectedUser ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-30 text-slate-400">
              <Info size={40} />
              <p className="text-sm font-black mt-2">اختر مستخدماً لعرض صلاحياته</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
              {PAGES.map(p => {
                const ok = userPerms.find(x => x.page_id === p.id)?.is_allowed;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{p.label}</span>
                    <button onClick={() => toggle(p.id, !!ok)} disabled={saving} className={`w-10 h-5 rounded-full relative transition-all duration-300 ${ok ? 'bg-emerald-500 shadow-sm' : 'bg-slate-300'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${ok ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function S9Users({ users = [], onRefresh }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email, password: pass, options: { data: { username } } });
      if (authError) throw authError;
      if (data?.user) {
        await supabase.from('users').insert([{ id: data.user.id, email, username, role: 'User' }]);
        toast.success('✅ تمت إضافة المستخدم بنجاح');
        setEmail(''); setPass(''); setUsername('');
        onRefresh();
      }
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id, userEmail) => {
    if (userEmail === 'ahmed_eslam288@yahoo.com') return;
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) { toast.success('تم الحذف بنجاح'); onRefresh(); }
  };

  return (
    <Card title="إدارة الحسابات" subtitle="إضافة وحذف مستخدمي النظام" icon={Users} accent="blue" number="2">
      <form onSubmit={handleAdd} className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-700" dir="rtl" autoComplete="off">
        <input type="text" placeholder="اسم المستخدم" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} required autoComplete="none" />
        <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} required autoComplete="none" />
        <input type="password" placeholder="كلمة المرور" value={pass} onChange={e => setPass(e.target.value)} className={inputCls} required minLength={6} autoComplete="new-password" />
        <button type="submit" disabled={loading} className="w-full py-3 bg-[#0F2747] text-white font-black rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
          {loading ? <Spinner /> : <><Plus size={18} /> إضافة حساب جديد</>}
        </button>
      </form>
      <div className="flex-1 space-y-2 mt-4 max-h-[250px] overflow-y-auto custom-scrollbar pr-1" dir="rtl">
        {(users || []).map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl group transition-all">
            <div className="text-right">
              <p className="text-xs font-black text-slate-800 dark:text-white font-tajawal">{u.username}</p>
              <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
            </div>
            {u.email !== 'ahmed_eslam288@yahoo.com' && (
              <button onClick={() => handleDelete(u.id, u.email)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [usersList, setUsersList] = useState([]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (data) setUsersList(data);
  };

  useEffect(() => { fetchUsers(); }, []);
  const handleSave = () => { setSaved(true); toast.success('تم الحفظ'); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="flex-1 flex flex-col font-readex p-4 overflow-hidden" dir="rtl">
      <header className="mb-6 bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-slate-800 text-white rounded-2xl flex items-center justify-center shadow-lg"><SettingsIcon size={24} /></div>
          <div className="text-right">
            <h2 className="font-black text-xl font-tajawal text-slate-800 dark:text-white">إدارة الوصول والمستخدمين</h2>
            <p className="text-[11px] text-slate-400 font-bold">التحكم الكامل في حسابات النظام وصلاحيات الصفحات</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className={`px-8 py-2.5 rounded-2xl text-sm font-black text-white transition-all shadow-lg ${saved ? 'bg-emerald-500' : 'bg-[#0F2747] hover:scale-[1.02]'}`}>
            {saved ? '✅ تم الحفظ' : 'حفظ الإعدادات'}
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-10">
          <S9Users users={usersList} onRefresh={fetchUsers} />
          <S6Permissions users={usersList} />
        </div>
      </div>
    </div>
  );
}
