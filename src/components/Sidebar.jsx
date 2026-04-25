import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Warehouse,
  FileText,
  FileStack,
  Archive,
  Settings,
  LogOut,
  X,
  ChevronDown,
  Circle,
  ClipboardList,
  Users,
  BarChart3,
  Tags,
  ChevronLeft,
  Box,
  TrendingUp,
  History
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const menuGroups = [
  {
    id: 'dashboard',
    label: 'لوحة القيادة',
    icon: LayoutDashboard,
    isStatic: true,
    view: 'dashboard'
  },
  {
    id: 'warehouse',
    label: 'المخزن',
    icon: Warehouse,
    subItems: [
      { id: 'items', label: 'الأصناف', view: 'items' },
      { id: 'stock-in', label: 'وارد', view: 'stock-in' },
      { id: 'stock-out', label: 'صادر', view: 'stock-out' },
      { id: 'returns', label: 'مرتجع', view: 'returns' },
    ]
  },
  {
    id: 'vouchers',
    label: 'سند',
    icon: FileText,
    subItems: [
      { id: 'voucher-in', label: 'إدخال', view: 'voucher-in' },
      { id: 'voucher-outward', label: 'إخراج', view: 'voucher-outward' },
    ]
  },
  // Standalone: الفواتير (Invoices)
  {
    id: 'invoices',
    label: 'الفواتير',
    icon: FileStack,
    isStatic: true,
    view: 'invoices'
  },
  // Standalone: الأسعار (Price List)
  {
    id: 'price-list',
    label: 'الأسعار',
    icon: Tags,
    isStatic: true,
    view: 'price-list'
  },
  // Unified Admin Dropdown: إدارة المستودع
  {
    id: 'warehouse-management',
    label: 'إدارة المستودع',
    icon: Archive,
    subItems: [
      { id: 'archive', label: 'أرشيف العمليات', view: 'archive' },
      { id: 'inbound-records', label: 'أذونات الواردات', view: 'inbound-records' },
      { id: 'inventory-check', label: 'جرد المستودع', view: 'inventory' },
      { id: 'reports', label: 'التقارير', view: 'reports' },
      { id: 'reps', label: 'إدارة المناديب', view: 'reps' },
    ]
  }
];

export default function Sidebar({ isSidebarOpen, setIsSidebarOpen, activeView, setActiveView }) {
  const { logout, isAdmin } = useAuth();
  const [openGroup, setOpenGroup] = useState(null);

  const toggleGroup = (groupId) => {
    setOpenGroup(openGroup === groupId ? null : groupId);
  };

  const handleStaticClick = (view) => {
    setActiveView(view);
    setOpenGroup(null);
  };

  const handleSubItemClick = (view) => {
    setActiveView(view);
  };

  const isGroupActive = (group) => {
    if (group.isStatic) return activeView === group.view;
    return group.subItems.some(sub => sub.view === activeView);
  };

  return (
    <AnimatePresence mode="wait">
      {isSidebarOpen && (
        <motion.aside
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed inset-y-0 right-0 z-50 h-full w-48 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-2xl shadow-primary/10 border-l border-slate-100 dark:border-slate-800 flex flex-col font-readex transition-all duration-300"
        >
          {/* Brand Area */}
          <div className="h-20 flex items-center justify-between px-5 border-b border-slate-100 shrink-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-emerald-400 rounded-xl flex items-center justify-center shadow-xl shadow-primary/20 border border-white/10">
                <Warehouse size={22} className="text-white drop-shadow-lg" />
              </div>
              <div className="flex flex-col text-right ml-1.5">
                <span className="font-tajawal font-extrabold text-base text-slate-900 dark:text-white tracking-tight leading-none drop-shadow">بركة الثمار</span>
                <span className="text-[9px] text-emerald-500 font-bold tracking-widest uppercase mt-0.5 drop-shadow">PRO</span>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-0.5 custom-scrollbar" dir="rtl">
            {menuGroups.map((group) => {
              const Icon = group.icon;
              const isActive = isGroupActive(group);
              const isOpen = openGroup === group.id;

              return (
                <div key={group.id} className="flex flex-col rounded-xl overflow-hidden mb-0.5 shadow-none group/sidebar transition-all duration-300">
                  <button
                    onClick={() => group.isStatic ? handleStaticClick(group.view) : toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-300 group/btn relative font-bold text-sm tracking-tight shadow-none border border-transparent backdrop-blur-xl
                      ${isActive
                        ? 'bg-gradient-to-l from-primary/10 to-white/60 dark:from-primary/20 dark:to-slate-900/60 text-primary shadow-lg border-primary/10'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 hover:text-primary border-transparent'}
                    `}
                  >
                    {/* Active Indicator Bar */}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary to-emerald-400 rounded-l-full shadow-lg"
                      ></motion.div>
                    )}

                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg transition-colors duration-300 shadow-sm ${isActive ? 'bg-primary/20' : 'bg-slate-100/60 dark:bg-slate-800/40 group-hover/btn:bg-primary/10'}`}>
                        <Icon size={18} className={`drop-shadow ${isActive ? 'text-primary' : 'text-slate-400 group-hover/btn:text-primary'} transition-colors duration-300`} />
                      </div>
                      <span className={`font-tajawal text-sm text-right ${isActive ? 'font-extrabold' : 'font-bold'}`}>{group.label}</span>
                    </div>

                    {!group.isStatic && (
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-slate-400'}`}
                      />
                    )}
                  </button>

                  {!group.isStatic && (
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col py-0.5 mt-0.5 pr-10 space-y-0.5">
                            {group.subItems.map((sub) => {
                              const isSubActive = activeView === sub.view;
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => handleSubItemClick(sub.view)}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-all duration-200 text-xs font-bold tracking-tight
                                    ${isSubActive
                                      ? 'bg-gradient-to-l from-primary/10 to-white/60 dark:from-primary/20 dark:to-slate-900/60 text-primary shadow border border-primary/10'
                                      : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 hover:text-primary border-transparent'}
                                  `}
                                >
                                  <span className="text-right flex-1 font-tajawal">{sub.label}</span>
                                  {isSubActive && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-primary to-emerald-400 ml-1.5 shadow-[0_0_6px_rgba(15,39,71,0.4)]"></div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100 shrink-0 space-y-1.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
            {isAdmin && (
              <button
                onClick={() => setActiveView('settings')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 font-medium text-xs ${
                  activeView === 'settings'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-100/50'
                }`}
              >
                <div className={`p-1 rounded-md ${activeView === 'settings' ? 'bg-white/10' : ''}`}>
                  <Settings size={16} />
                </div>
                <span>الإعدادات</span>
              </button>
            )}

            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 font-medium text-xs text-rose-500 hover:bg-rose-50 group"
            >
              <div className="p-1 rounded-md bg-rose-50 group-hover:bg-rose-100 transition-colors">
                <LogOut size={16} />
              </div>
              <span>تسجيل الخروج</span>
            </button>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between px-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]"></div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Active
                </span>
              </div>
              <span className="text-[8px] font-medium text-slate-300">v2.4.0</span>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
