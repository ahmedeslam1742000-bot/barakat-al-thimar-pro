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
  ChevronDown
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
  const { currentUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isMuted, toggleMute } = useAudio();
  const { settings } = useSettings();
  
  const [criticalItems, setCriticalItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const alertsRef = useRef(null);

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

  // Close alerts dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setIsAlertsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex font-['Cairo'] transition-colors duration-500" dir="rtl">
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Content Area */}
      <main 
        className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ease-spring ${isSidebarOpen ? 'lg:mr-64' : 'mr-0'}`}
      >
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-700 shadow-sm shrink-0 z-40 flex items-center justify-between px-6 lg:px-8 transition-colors duration-500">
          <div className="flex items-center space-x-5 space-x-reverse">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors p-2 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="flex flex-col border-r-4 border-blue-600 pr-3 py-0.5">
              <h1 className="text-lg font-black text-slate-800 dark:text-white leading-tight tracking-tight">
                بركة الثمار
              </h1>
              <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-widest">
                PRO VISION
              </span>
            </div>
          </div>
          
          {/* Middle: Global Search & Clock */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-6 items-center space-x-4 space-x-reverse">
            {/* Search */}
            <div className="relative flex-1 group">
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Search size={16} />
               </div>
               <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="ابحث عن أصناف، شركات، أو أكواد..." 
                  className="w-full bg-slate-50 border-0 dark:bg-slate-900/50 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold rounded-xl pr-10 pl-4 py-2 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
               />
               
               {/* Search Dropdown */}
               <AnimatePresence>
                 {searchQuery && isSearchFocused && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                     className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl rounded-2xl overflow-hidden z-50 max-h-64 overflow-y-auto custom-scrollbar"
                   >
                     {allItems.filter(i => (i.name + i.company + i.cat).toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                       allItems.filter(i => (i.name + i.company + i.cat).toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map((item, idx) => (
                         <div key={idx} onMouseDown={() => {}} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center group/item text-right">
                           <div className="flex flex-col">
                             <span className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors">{item.name}</span>
                             <span className="text-[10px] text-slate-400">{item.company || 'بدون شركة'} • {item.cat}</span>
                           </div>
                           <div className="bg-slate-100 dark:bg-slate-900/50 px-2 py-1 rounded-md text-xs font-black text-slate-600 dark:text-slate-300">
                             {item.stockQty} {item.unit}
                           </div>
                         </div>
                       ))
                     ) : (
                       <div className="p-4 text-center pb-6">
                         <Search size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2 mt-2" />
                         <span className="text-xs font-bold text-slate-500">لا توجد نتائج مطابقة</span>
                       </div>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            {/* Clock */}
            <div className="hidden lg:flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900/50 px-4 py-1.5 rounded-xl shadow-inner shrink-0 text-center select-none h-full">
               <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none mb-1 shadow-sm" dir="ltr">{currentTime.toLocaleDateString('en-GB')}</span>
               <div className="flex items-center space-x-1.5 space-x-reverse text-slate-700 dark:text-slate-200">
                 <Clock size={12} className="text-slate-400 dark:text-slate-500" />
                 <span className="text-sm font-black leading-none" dir="ltr">{currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
               </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-5 space-x-reverse relative">
            
            {/* Audio Toggle */}
            <button 
              onClick={toggleMute}
              className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-all"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-all"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={alertsRef}>
              <button 
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className={`relative p-2 rounded-xl transition-all ${isAlertsOpen ? 'bg-slate-100 dark:bg-slate-700 text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
              >
                <Bell size={20} />
                {criticalItems.length > 0 && (
                  <span className="absolute top-1.5 left-1.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shrink-0">
                    {criticalItems.length}
                  </span>
                )}
              </button>

              {/* Alerts Dropdown */}
              <AnimatePresence>
                {isAlertsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-[120%] left-0 w-72 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-2xl rounded-2xl overflow-hidden z-50 text-right"
                  >
                    <div className="p-3 border-b border-slate-50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                      <span className="text-[10px] bg-red-100 text-red-600 dark:bg-rose-500/20 dark:text-rose-400 px-2 py-0.5 rounded-lg font-bold">{criticalItems.length} أصناف</span>
                      <h4 className="font-black text-sm text-slate-800 dark:text-white">تنبيهات سريعة</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {criticalItems.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs font-bold">
                          المخزون آمن ولا يوجد نواقص
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-50 dark:divide-slate-700/50 p-1">
                          {criticalItems.map(item => (
                            <div key={item.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-center justify-between group rounded-xl">
                              <div className="flex items-center space-x-3 space-x-reverse">
                                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500">
                                   <AlertOctagon size={14} />
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{item.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400">{item.company || 'بدون شركة'}</p>
                                </div>
                              </div>
                              <div className="text-center font-black text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-lg">
                                {item.stockQty}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
            
            <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 p-1 pl-3 sm:pr-3 rounded-full border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center space-x-1 space-x-reverse">
                   <span>{currentUser?.username || currentUser?.displayName || 'مدير النظام'}</span>
                   <ChevronDown size={14} className="text-slate-400" />
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {currentUser?.role === 'Admin' ? 'مدير النظام' : currentUser?.role === 'Storekeeper' ? 'أمين مستودع' : 'مراقب'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-600 relative z-10 shrink-0">
                <User size={18} />
                <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
              </div>
            </div>
          </div>
        </header>

        {/* ── System Freeze Banner ── */}
        {settings?.systemFrozen && (
          <div className="shrink-0 flex items-center gap-3 px-6 py-2.5 bg-rose-500 text-white text-xs font-black z-30">
            <span className="text-sm">⛔</span>
            <span className="flex-1">النظام مجمَّد — جميع عمليات الإدخال معطّلة حتى يتم إلغاء التجميد من صفحة الإعدادات</span>
            <button type="button" onClick={() => setActiveView('settings')} className="shrink-0 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">الإعدادات</button>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-[#080d17] p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
