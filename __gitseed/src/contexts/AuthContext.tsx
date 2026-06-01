import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/entities';
import { authAPI } from '../lib/api-client';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
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

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const loggedInUser = await authAPI.login(email, password);
      if (loggedInUser) {
        setUser(loggedInUser);
        localStorage.setItem('jsc_user', JSON.stringify(loggedInUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
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
      login: async () => false,
      logout: () => {},
      isLoading: true,
    } as any;
  }
  return context;
}
