import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Warehouse, 
  FileText, 
  Archive,
  Settings, 
  LogOut,
  X,
  ChevronDown,
  Circle,
  ClipboardList,
  Activity,
  Eye,
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
  {
    id: 'warehouse-insights-group',
    label: 'المراقبة والتقارير',
    icon: Eye,
    subItems: [
      { id: 'warehouse-insights', label: 'نظرة المستودع', view: 'warehouse-insights' },
      { id: 'warehouse-logs', label: 'سجلات المستودع', view: 'warehouse-logs' },
      { id: 'reps', label: 'المناديب', view: 'reps' },
    ]
  },
  {
    id: 'archive',
    label: 'الجرد والأرشيف',
    icon: Archive,
    subItems: [
      { id: 'inventory', label: 'جرد المراقبة', view: 'inventory' },
      { id: 'invoices', label: 'الفواتير', view: 'invoices' },
      { id: 'reports', label: 'التقارير', view: 'reports' },
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
          className="fixed inset-y-0 right-0 z-50 h-full min-h-screen w-full max-w-[20rem] lg:w-64 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] flex flex-col transition-colors duration-500 font-['Cairo']"
        >
          <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="flex flex-col text-right">
              <span className="font-black text-xl text-slate-800 dark:text-white tracking-tight leading-tight">القائمة الرئيسية</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold tracking-wider">تصفح النظام</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar" dir="rtl">
            {menuGroups.map((group) => {
              const Icon = group.icon;
              const isActive = isGroupActive(group);
              const isOpen = openGroup === group.id;

              return (
                <div key={group.id} className="flex flex-col rounded-2xl overflow-hidden">
                  <button
                    onClick={() => group.isStatic ? handleStaticClick(group.view) : toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-2xl transition-all group/btn ${
                      isActive && !group.isStatic && !isOpen
                        ? 'bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                        : isActive && group.isStatic
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : isOpen
                        ? 'bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <Icon size={20} className={`${
                        isActive && group.isStatic
                          ? 'text-white'
                          : isActive && !isOpen
                          ? 'text-blue-500'
                          : isOpen
                          ? 'text-slate-800 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500 group-hover/btn:text-blue-500 dark:group-hover/btn:text-blue-400'
                      } transition-colors`} />
                      <span className="font-bold text-sm text-right">{group.label}</span>
                    </div>
                    
                    {!group.isStatic && (
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} 
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
                          <div className="flex flex-col py-1 mt-1 pr-11 border-r-2 border-slate-100 dark:border-slate-700/50 mr-6">
                            {group.subItems.map((sub) => {
                              const isSubActive = activeView === sub.view;
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => handleSubItemClick(sub.view)}
                                  className={`w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-xl transition-colors text-sm font-bold ${
                                    isSubActive
                                      ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:text-slate-800 dark:hover:text-slate-200'
                                  }`}
                                >
                                  <span className="text-right flex-1">{sub.label}</span>
                                  {isSubActive && (
                                    <Circle size={6} className="fill-current text-blue-600 dark:text-blue-400 ml-1" />
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
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0 space-y-1">
            {isAdmin && (
              <button 
                onClick={() => setActiveView('settings')} 
                className={`w-full flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${
                  activeView === 'settings'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Settings size={18} />
                <span>إعدادات</span>
              </button>
            )}

            <button 
              onClick={logout} 
              className="w-full flex items-center justify-center space-x-2 space-x-reverse px-4 py-3 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all font-bold text-sm"
            >
              <LogOut size={18} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
