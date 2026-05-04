import React, { useState } from 'react';
import MainLayout from './components/MainLayout';
import Dashboard from './components/Dashboard';
import Items from './components/Items';
import StockOut from './components/StockOut';
import Returns from './pages/Returns';
import VoucherOutward from './pages/VoucherOutward';
import Reps from './pages/Reps';
import Settings from './pages/Settings';
import StockInventory from './pages/StockInventory';
import InboundRecords from './pages/InboundRecords';
import InboundItems from './pages/InboundItems';
import StockCard from './pages/StockCard';
import PriceList from './pages/PriceList';
import ReceiptVouchers from './pages/ReceiptVouchers';
import Placeholder from './components/Placeholder';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Toaster } from 'sonner';
import { Package, Truck, ArrowUpRight, RotateCcw, Download, Upload, User, FileStack, BookOpen, ClipboardList, Activity, Settings as SettingsIcon, BarChart3, Tags, History, TrendingUp, Banknote, ShieldOff } from 'lucide-react';

const viewConfig = {
  'dashboard': { component: Dashboard },
  'items': { component: Items },
  'stock-in': { component: InboundItems, title: 'الوارد', icon: TrendingUp },
  'stock-out': { component: StockOut, title: 'الفواتير', icon: FileStack },
  'returns': { component: Returns, title: 'مرتجع', icon: RotateCcw },
  'voucher-outward': { component: VoucherOutward, title: 'سند إخراج', icon: Upload },
  'reps': { component: Reps, title: 'المناديب', icon: User },
  'receipt-vouchers': { component: ReceiptVouchers, title: 'سندات قبض', icon: Banknote },
  'inventory': { component: StockInventory, title: 'المخزون الحالي', icon: ClipboardList },
  'inbound-records': { component: InboundRecords, title: 'أذونات الواردات', icon: History },
  'stock-card': { component: StockCard, title: 'الرصيد التراكمي', icon: History },
  'price-list': { component: PriceList, title: 'الأسعار', icon: Tags },
  'settings': { component: Settings },
};

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4" dir="rtl">
      <div className="w-20 h-20 bg-rose-100 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-rose-600 mb-6">
        <ShieldOff size={40} />
      </div>
      <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 font-tajawal">هذه الصفحة تحتاج إلى صلاحيات</h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md font-readex">
        عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذا القسم. يرجى التواصل مع المدير العام (أحمد إسلام) لطلب الصلاحية.
      </p>
    </div>
  );
}

function AuthenticatedApp() {
  const { currentUser, canAccess } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');

  if (!currentUser) {
    return <Login />;
  }

  const renderView = () => {
    // Permission Check
    if (!canAccess(activeView)) {
      return <AccessDenied />;
    }

    const config = viewConfig[activeView];
    if (!config) return <Dashboard />;
    if (config.component) {
      const Component = config.component;
      return <Component setActiveView={setActiveView} activeView={activeView} />;
    }
    return <Placeholder title={config.title} icon={config.icon} />;
  };

  return (
    <MainLayout activeView={activeView} setActiveView={setActiveView}>
      {renderView()}
    </MainLayout>
  );
}

import { AudioProvider } from './contexts/AudioContext';

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AudioProvider>
          <AuthProvider>
            <AuthenticatedApp />
            <Toaster position="top-center" richColors theme="light" />
          </AuthProvider>
        </AudioProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
