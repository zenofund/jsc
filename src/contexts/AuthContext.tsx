import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/entities';
import { authAPI, settingsAPI } from '../lib/api-client';

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    password: string,
    totpCode?: string,
  ) => Promise<{ status: 'success' | 'totp_required' | 'totp_setup_required' | 'error'; message?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Check for stored user session
      const storedUser = localStorage.getItem('jsc_user');
      const token = localStorage.getItem('jsc_auth_token');

      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
      } else {
        // If no token, clear any stale user data
        localStorage.removeItem('jsc_user');
        setUser(null);
      }

      if (token) {
        try {
          // Refresh user data from backend to ensure we have latest structure/permissions
          const freshUser = await authAPI.getCurrentUser();
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('jsc_user', JSON.stringify(freshUser));
          }
        } catch (error) {
          console.error('Error refreshing user session:', error);
          // Optional: handle token expiration
        }
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Periodically check session validity (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    const checkSession = async () => {
      try {
        const freshUser = await authAPI.getCurrentUser();
        if (freshUser) {
          // Only update if data changed to avoid unnecessary re-renders
          // We exclude created_at from comparison as it might cause false positives if format differs
          const currentStr = JSON.stringify({ ...user, created_at: '' });
          const freshStr = JSON.stringify({ ...freshUser, created_at: '' });
          
          if (currentStr !== freshStr) {
            setUser(freshUser);
            localStorage.setItem('jsc_user', JSON.stringify(freshUser));
          }
        }
      } catch (error) {
        // Errors are handled by api-client (401 triggers reload)
        console.error('Session check failed:', error);
      }
    };

    const intervalId = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let timerId: number | null = null;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    const clearTimer = () => {
      if (timerId) window.clearTimeout(timerId);
      timerId = null;
    };

    const start = async () => {
      let minutes = 0;
      try {
        const settings = await settingsAPI.getSettings({ headers: { 'X-Skip-Auth-Handler': 'true' } as any });
        minutes = Number(settings?.inactivity_logout_minutes || 0);
      } catch {
        minutes = 0;
      }

      if (!Number.isFinite(minutes) || minutes <= 0) return;

      const reset = () => {
        clearTimer();
        timerId = window.setTimeout(() => {
          logout();
        }, minutes * 60 * 1000);
      };

      for (const evt of events) window.addEventListener(evt, reset, { passive: true } as any);
      reset();

      return () => {
        clearTimer();
        for (const evt of events) window.removeEventListener(evt, reset as any);
      };
    };

    let cleanup: undefined | (() => void) = undefined;
    start().then((fn) => {
      cleanup = fn || undefined;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [user]);

  const login = async (
    email: string,
    password: string,
    totpCode?: string,
  ): Promise<{ status: 'success' | 'totp_required' | 'totp_setup_required' | 'error'; message?: string }> => {
    try {
      const result = await authAPI.login(email, password, totpCode);
      if (result.status === 'success') {
        setUser(result.user);
        localStorage.setItem('jsc_user', JSON.stringify(result.user));
        return { status: 'success' };
      }
      return result;
    } catch (error) {
      console.error('Login error:', error);
      return { status: 'error', message: 'Login failed' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('jsc_user');
    localStorage.removeItem('jsc_auth_token');
    // Call API logout to clean up any other session data
    authAPI.logout().catch(console.error);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      login: async () => ({ status: 'error' as const }),
      logout: () => {},
      isLoading: true,
    } as any;
  }
  return context;
}
