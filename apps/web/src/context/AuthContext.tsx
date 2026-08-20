import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, Role } from '@jewellery-pos/shared';
import { api } from '../services/api/client.js';
import { restoreDefaultBranding } from '../utils/branding.js';

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  switchPin: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check active session on mount
  useEffect(() => {
    let mounted = true;
    api
      .get<UserSession>('/auth/me')
      .then((session) => {
        if (mounted && session) {
          setUser(session);
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await api.post<{ session: UserSession; token: string } | UserSession>('/auth/login', {
        email,
        password: pass
      });
      const sessionData = (res as any).session || res;
      setUser(sessionData);
      return true;
    } catch (err) {
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchPin = async (pin: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await api.post<{ session: UserSession; token: string } | UserSession>('/auth/pin-login', { pin });
      const sessionData = (res as any).session || res;
      setUser(sessionData);
      return true;
    } catch (err) {
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore
    }
    setUser(null);
    restoreDefaultBranding();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, switchPin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
