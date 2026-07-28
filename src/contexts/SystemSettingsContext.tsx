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

const SYSTEM_SETTINGS_CACHE_KEY = 'system_settings_cache_v1';

function loadCachedSettings(): SystemSettings | null {
  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as SystemSettings;
  } catch {
    return null;
  }
}

function persistCachedSettings(settings: SystemSettings) {
  try {
    localStorage.setItem(SYSTEM_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {}
}

export function SystemSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings | null>(() => loadCachedSettings());
  const [loading, setLoading] = useState(settings === null);
  const [loadedOnce, setLoadedOnce] = useState(settings !== null);

  const refresh = useCallback(async () => {
    const shouldShowLoading = !loadedOnce && settings === null;
    try {
      const data = await settingsAPI.getSettings();
      setSettings(data);
      persistCachedSettings(data);
    } catch (error) {
      console.error('Failed to load system settings:', error);
    } finally {
      setLoadedOnce(true);
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  }, [loadedOnce, settings]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<SystemSettingsContextValue>(() => ({
    settings,
    loading,
    refresh,
    loanManagementEnabled: loadedOnce && settings?.loan_management_enabled !== false,
    cooperativeManagementEnabled: loadedOnce && settings?.cooperative_management_enabled !== false,
  }), [loadedOnce, loading, refresh, settings]);

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
