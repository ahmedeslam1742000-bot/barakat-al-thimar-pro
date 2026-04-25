import React, { useState } from 'react';
import MainLayout from './components/MainLayout';
import Dashboard from './components/Dashboard';
import Items from './components/Items';
import StockOut from './components/StockOut';
import Returns from './pages/Returns';
import CashIn from './pages/CashIn';
import CashOut from './pages/CashOut';
import Reps from './pages/Reps';
import WarehouseInsights from './pages/WarehouseInsights';
import WarehouseLogs from './pages/WarehouseLogs';
import Settings from './pages/Settings';
import StockInventory from './pages/StockInventory';
import Archive from './pages/Archive';
import InboundRecords from './pages/InboundRecords';
import InboundItems from './pages/InboundItems';
import Placeholder from './components/Placeholder';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Toaster } from 'sonner';
import { Package, Truck, ArrowUpRight, RotateCcw, Download, Upload, User, FileStack, BookOpen, ClipboardList, Activity, Settings as SettingsIcon, Archive as ArchiveIcon, BarChart3, Tags, History, TrendingUp } from 'lucide-react';

const viewConfig = {
  'dashboard': { component: Dashboard },
  'items': { component: Items },
  'stock-in': { component: InboundItems, title: 'الوارد', icon: TrendingUp },
  'stock-out': { component: StockOut, title: 'صادر', icon: ArrowUpRight },
  'returns': { component: Returns, title: 'مرتجع', icon: RotateCcw },
  'voucher-in': { component: CashIn, title: 'سند إدخال', icon: Download },
  'voucher-outward': { component: CashOut, title: 'سند إخراج', icon: Upload },
  'warehouse-insights': { component: WarehouseInsights },
  'warehouse-logs': { component: WarehouseLogs, title: 'سجلات المستودع', icon: Activity },
  'reps': { component: Reps, title: 'المناديب', icon: User },
  'invoices': { title: 'الفواتير', icon: FileStack },
  'reports': { title: 'التقارير', icon: BarChart3 },
  'inventory': { component: StockInventory, title: 'المخزون الحالي', icon: ClipboardList },
  'archive': { component: Archive, title: 'أرشيف التعاملات', icon: ArchiveIcon },
  'inbound-records': { component: InboundRecords, title: 'أذونات الواردات', icon: History },
  'price-list': { title: 'الأسعار', icon: Tags },
  'settings': { component: Settings },
};

function AuthenticatedApp() {
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');

  if (!currentUser) {
    return <Login />;
  }

  const renderView = () => {
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
