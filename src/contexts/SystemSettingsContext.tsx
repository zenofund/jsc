import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SystemSettings } from '../types/entities';
import { settingsAPI } from '../lib/api-client';

type SystemSettingsContextValue = {
  settings: SystemSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  loanManagementEnabled: boolean;
  cooperativeManagementEnabled: boolean;
};

const SystemSettingsContext = createContext<SystemSettingsContextValue | null>(null);

export function SystemSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await settingsAPI.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load system settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<SystemSettingsContextValue>(() => ({
    settings,
    loading,
    refresh,
    loanManagementEnabled: settings?.loan_management_enabled !== false,
    cooperativeManagementEnabled: settings?.cooperative_management_enabled !== false,
  }), [loading, refresh, settings]);

  return (
    <SystemSettingsContext.Provider value={value}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
}
