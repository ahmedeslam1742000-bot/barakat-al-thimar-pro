import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const LS_KEY = 'wms_app_settings_v3';

export const DEFAULT_SETTINGS = {
  // ─── 1. Default Values
  orgEmoji:        '🌿',
  orgName:         'مؤسسة بركة الثمار',
  orgSubtitle:     'للتجارة والتوزيع الغذائي',
  orgContact:      '',
  defaultUnit:     'كرتونة',
  defaultBrand:    '',

  // ─── 2. System Freeze
  systemFrozen:    false,

  // ─── 3. Template Customizer
  voucherCustomAccent: '',       // '' = use per-kind default (#10b981 / #3b82f6)
  voucherFontSize:     'medium', // 'small' | 'medium' | 'large'

  // ─── 4. Smart Alerts
  lowStockThreshold: 50,

  // ─── 5. Print columns (from previous settings)
  voucherShowCompany:   true,
  voucherShowNotes:     true,

  // ─── 6. UI Toggles
  uiShowSignatureBox:   true,
  uiShowVoucherCode:    true,
  uiShowUnit:           true,

  // ─── 7. Export filename format
  filenameFormat: 'code_date', // 'code_date' | 'name_date' | 'date_code'

  // ─── 8. Meta (Performance + Backup)
  lastCleanupDate: null,
  lastBackupDate:  null,

  // ─── 9. Custom Dictionary (Overrides)
  labels: {
    voucherIn: 'سند إدخال',
    voucherOut: 'سند إخراج',
    stockIn: 'وارد',
    stockOut: 'صادر',
    returns: 'مرتجع',
  },
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'system', 'settings');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateSettings = async (patch) => {
    const newSettings = { ...settings, ...patch };
    setSettings(newSettings);
    await setDoc(doc(db, 'system', 'settings'), newSettings, { merge: true });
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    await setDoc(doc(db, 'system', 'settings'), DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {!loading && children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside <SettingsProvider>');
  return ctx;
}
