import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  User,
  Bell,
  Sun,
  Moon,
  AlertOctagon,
  Volume2,
  VolumeX,
  Search,
  Clock,
  ChevronDown,
  Warehouse,
  Settings,
  LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio } from '../contexts/AudioContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import Sidebar from './Sidebar';

export default function MainLayout({ children, activeView, setActiveView }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { currentUser, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isMuted, toggleMute } = useAudio();
  const { settings } = useSettings();
  
  const [criticalItems, setCriticalItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const alertsRef = useRef(null);
  const profileRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch critical items for the bell notification
  useEffect(() => {
    if (!db) return;
    const qItems = query(collection(db, 'items'));
    const unsubscribe = onSnapshot(qItems, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const threshold = settings?.lowStockThreshold ?? 50;
      setCriticalItems(itemsData.filter(i => i.stockQty < threshold));
      setAllItems(itemsData);
    });
    return () => unsubscribe();
  }, [settings?.lowStockThreshold]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setIsAlertsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-800 flex font-readex transition-colors duration-300" dir="rtl">
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Content Area */}
      <main 
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:mr-72' : 'mr-0'}`}
      >
        {/* Top Navbar - Slimmer and more functional */}
        <header className="w-full h-12 bg-white border-b border-slate-100 shrink-0 z-40 flex items-center justify-between px-4 sm:px-6 transition-all duration-300">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-all"
              >
                <Menu size={18} />
              </button>
            )}
            
            {/* Logo area when sidebar is closed */}
            {!isSidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white shadow-sm">
                  <Warehouse size={16} />
                </div>
                <h1 className="text-base font-bold font-tajawal hidden sm:block tracking-tight">بركة الثمار</h1>
              </div>
            )}
          </div>
          
          {/* Middle: Global Search - More prominent and rounded */}
          <div className="flex-1 max-w-2xl mx-4 sm:mx-10">
            <div className="relative group">
               <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <Search size={14} />
               </div>
               <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="ابحث عن أصناف، شركات، أو أكواد..." 
                  className={`w-full bg-slate-100/50 border border-transparent focus:bg-white text-slate-800 text-xs rounded-full pr-10 pl-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-300 ${isSearchFocused ? 'scale-[1.02]' : ''}`}
               />
               
               {/* Search Dropdown */}
               <AnimatePresence>
                 {searchQuery && isSearchFocused && (
                   <motion.div 
                     initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                     className="absolute top-full mt-2 w-full bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-50 max-h-80 overflow-y-auto custom-scrollbar"
                   >
                     <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                       <span className="text-[10px] font-bold text-slate-400 uppercase px-2">نتائج البحث</span>
                     </div>
                     {allItems.filter(i => (i.name + i.company + i.cat).toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                       allItems.filter(i => (i.name + i.company + i.cat).toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8).map((item, idx) => (
                         <div key={idx} onMouseDown={() => {}} className="p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 flex justify-between items-center group/item text-right">
                           <div className="flex flex-col">
                             <span className="text-sm font-bold text-slate-800 group-hover/item:text-primary transition-colors">{item.name}</span>
                             <span className="text-[10px] text-slate-400">{item.company || 'بدون شركة'} • {item.cat}</span>
                           </div>
                           <div className="bg-slate-100 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-500 border border-slate-100">
                             {item.stockQty} {item.unit}
                           </div>
                         </div>
                       ))
                     ) : (
                       <div className="p-6 text-center">
                         <Search size={24} className="mx-auto text-slate-200 mb-2" />
                         <span className="text-xs font-bold text-slate-400">لا توجد نتائج مطابقة لـ "{searchQuery}"</span>
                       </div>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Quick Actions Group */}
            <div className="hidden md:flex items-center gap-1 border-l border-slate-100 ml-2 pl-2">
              {/* Audio Toggle */}
              <button 
                onClick={toggleMute}
                className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-all group"
                title="كتم الصوت"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={alertsRef}>
              <button 
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className={`p-2 rounded-lg transition-all ${isAlertsOpen ? 'bg-primary/10 text-primary shadow-inner' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'}`}
              >
                <Bell size={18} />
                {criticalItems.length > 0 && (
                  <span className="absolute top-1.5 left-1.5 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {criticalItems.length}
                  </span>
                )}
              </button>

              {/* Alerts Dropdown */}
              <AnimatePresence>
                {isAlertsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute left-0 mt-3 w-80 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="font-bold text-sm">التنبيهات</span>
                      <span className="bg-rose-50 text-rose-600 text-[10px] px-2.5 py-1 rounded-full font-black border border-rose-100 shadow-sm">
                        {criticalItems.length} تنبيه حرج
                      </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {criticalItems.length > 0 ? (
                        criticalItems.map((item, idx) => (
                          <div key={idx} className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 flex items-start gap-3 group/alert">
                            <div className="mt-0.5 p-2 bg-rose-50 rounded-xl group-hover/alert:bg-rose-100 transition-colors">
                              <AlertOctagon size={16} className="text-rose-500" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-black text-slate-800 group-hover/alert:text-rose-600 transition-colors">{item.name}</p>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                المخزون الحالي: <span className="font-black text-rose-600 bg-rose-50 px-1.5 rounded">{item.stockQty} {item.unit}</span>
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-10 text-center">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell size={24} className="text-slate-200" />
                          </div>
                          <p className="text-sm font-medium text-slate-400">لا توجد تنبيهات حالية</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Menu */}
            <div className="relative mr-1" ref={profileRef}>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-2 p-1 pl-2 hover:bg-slate-50 rounded-full transition-all border border-transparent ${isProfileOpen ? 'bg-slate-50 border-slate-100' : ''}`}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-slate-800 flex items-center justify-center text-white text-[10px] font-bold shadow-md border border-white/20">
                  {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="hidden sm:flex flex-col items-start ml-1 leading-none text-right">
                  <span className="text-[10px] font-black text-slate-800 truncate max-w-[80px]">{currentUser?.email?.split('@')[0]}</span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black">مسؤول</span>
                </div>
                <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute left-0 mt-3 w-56 bg-white border border-slate-100 shadow-2xl rounded-xl overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">المستخدم الحالي</p>
                      <p className="text-xs font-black truncate text-primary">{currentUser?.email}</p>
                    </div>
                    <div className="p-1">
                      <button 
                        onClick={() => { setActiveView('settings'); setIsProfileOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <Settings size={16} className="text-slate-400" />
                        إعدادات الحساب
                      </button>
                      <button 
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-500 font-bold hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <LogOut size={16} />
                        تسجيل الخروج
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ── System Freeze Banner ── */}
        {settings?.systemFrozen && (
          <div className="shrink-0 flex items-center gap-3 px-6 py-2.5 bg-rose-600 text-white text-xs font-black z-30 shadow-lg shadow-rose-600/20">
            <AlertOctagon size={16} className="animate-pulse" />
            <span className="flex-1">النظام مجمَّد — جميع عمليات الإدخال معطّلة حتى يتم إلغاء التجميد من صفحة الإعدادات</span>
            <button type="button" onClick={() => setActiveView('settings')} className="shrink-0 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors border border-white/20">الإعدادات</button>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30 p-4 sm:p-6 lg:p-8 overflow-hidden">
          <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
