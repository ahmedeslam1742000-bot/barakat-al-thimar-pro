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
          className="fixed inset-y-0 right-0 z-50 h-full min-h-screen w-72 bg-sidebar flex flex-col font-readex"
        >
          {/* Brand Area */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 border border-white/10">
                <Warehouse size={20} className="text-white" />
              </div>
              <div className="flex flex-col text-right">
                <span className="font-tajawal font-bold text-base text-slate-800 tracking-tight leading-none">بركة الثمار</span>
                <span className="text-[9px] text-emerald-500 font-bold tracking-widest uppercase mt-0.5">Operational Pro</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar" dir="rtl">
            {menuGroups.map((group) => {
              const Icon = group.icon;
              const isActive = isGroupActive(group);
              const isOpen = openGroup === group.id;

              return (
                <div key={group.id} className="flex flex-col rounded-xl overflow-hidden mb-0.5">
                  <button
                    onClick={() => group.isStatic ? handleStaticClick(group.view) : toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-300 group/btn relative ${
                      isActive 
                        ? 'bg-primary/5 text-primary shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-800'
                    }`}
                  >
                    {/* Active Indicator Bar - More subtle */}
                    {isActive && (
                      <motion.div 
                        layoutId="activeIndicator"
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-l-full"
                      ></motion.div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg transition-colors duration-300 ${isActive ? 'bg-primary/10' : 'bg-transparent group-hover/btn:bg-slate-100'}`}>
                        <Icon size={18} className={`${
                          isActive 
                            ? 'text-primary' 
                            : 'text-slate-400 group-hover/btn:text-primary'
                        } transition-colors duration-300`} />
                      </div>
                      <span className={`font-medium text-sm text-right ${isActive ? 'font-bold' : ''}`}>{group.label}</span>
                    </div>
                    
                    {!group.isStatic && (
                      <ChevronDown 
                        size={14} 
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
                          <div className="flex flex-col py-0.5 mt-0.5 pr-11 space-y-0.5">
                            {group.subItems.map((sub) => {
                              const isSubActive = activeView === sub.view;
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => handleSubItemClick(sub.view)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 text-xs ${
                                    isSubActive
                                      ? 'bg-primary/5 text-primary font-bold'
                                      : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-800'
                                  }`}
                                >
                                  <span className="text-right flex-1">{sub.label}</span>
                                  {isSubActive && (
                                    <div className="w-1 h-1 rounded-full bg-primary ml-1 shadow-[0_0_8px_rgba(15,39,71,0.4)]"></div>
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
          
          <div className="p-4 border-t border-slate-100 shrink-0 space-y-1.5 bg-slate-50/30">
            {isAdmin && (
              <button 
                onClick={() => setActiveView('settings')} 
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                  activeView === 'settings'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-100/50'
                }`}
              >
                <div className={`p-1 rounded-lg ${activeView === 'settings' ? 'bg-white/10' : ''}`}>
                  <Settings size={18} />
                </div>
                <span>الإعدادات</span>
              </button>
            )}
            
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm text-rose-500 hover:bg-rose-50 group"
            >
              <div className="p-1 rounded-lg bg-rose-50 group-hover:bg-rose-100 transition-colors">
                <LogOut size={18} />
              </div>
              <span>تسجيل الخروج</span>
            </button>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Active
                </span>
              </div>
              <span className="text-[9px] font-medium text-slate-300">v2.4.0</span>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
