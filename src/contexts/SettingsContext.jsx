import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      if (error) {
        console.error("error fetching settings:", error);
      }

      if (data && data.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setLoading(false);
    };

    fetchSettings();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'id=eq.00000000-0000-0000-0000-000000000001',
        },
        (payload) => {
          setSettings({ ...DEFAULT_SETTINGS, ...payload.new.settings });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = async (patch) => {
    const newSettings = { ...settings, ...patch };
    setSettings(newSettings);

    await supabase
      .from('system_settings')
      .update({ settings: newSettings, updated_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000001');
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    await supabase
      .from('system_settings')
      .update({ settings: DEFAULT_SETTINGS, updated_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000001');
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
