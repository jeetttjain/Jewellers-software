import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client.js';
import { useAuth } from './AuthContext.js';

interface OwnerModeContextType {
  isOwnerModeUnlocked: boolean;
  verifyOwnerPin: (pin: string) => Promise<boolean>;
  setupOwnerPin: (pin: string) => Promise<boolean>;
  lockOwnerMode: () => void;
  promptOwnerPin: () => void;
  isPinModalOpen: boolean;
  closePinModal: () => void;
}

const OwnerModeContext = createContext<OwnerModeContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes auto-lock

export const OwnerModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isOwnerModeUnlocked, setIsOwnerModeUnlocked] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  const lockOwnerMode = useCallback(() => {
    setIsOwnerModeUnlocked(false);
  }, []);

  // Lock Owner Mode when user logs out or switches accounts
  useEffect(() => {
    if (!user) {
      lockOwnerMode();
    }
  }, [user, lockOwnerMode]);

  // Auto-lock after inactivity
  useEffect(() => {
    if (!isOwnerModeUnlocked) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
        lockOwnerMode();
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearInterval(interval);
    };
  }, [isOwnerModeUnlocked, lastActivity, lockOwnerMode]);

  const verifyOwnerPin = async (pin: string): Promise<boolean> => {
    try {
      const res = await api.post<{ verified: boolean }>('/settings/owner-pin/verify', { pin });
      if (res.verified) {
        setIsOwnerModeUnlocked(true);
        setIsPinModalOpen(false);
        setLastActivity(Date.now());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const setupOwnerPin = async (pin: string): Promise<boolean> => {
    try {
      await api.post('/settings/owner-pin/setup', { pin });
      setIsOwnerModeUnlocked(true);
      setIsPinModalOpen(false);
      setLastActivity(Date.now());
      return true;
    } catch {
      return false;
    }
  };

  const promptOwnerPin = () => {
    setIsPinModalOpen(true);
  };

  const closePinModal = () => {
    setIsPinModalOpen(false);
  };

  return (
    <OwnerModeContext.Provider
      value={{
        isOwnerModeUnlocked,
        verifyOwnerPin,
        setupOwnerPin,
        lockOwnerMode,
        promptOwnerPin,
        isPinModalOpen,
        closePinModal
      }}
    >
      {children}
    </OwnerModeContext.Provider>
  );
};

export const useOwnerMode = () => {
  const context = useContext(OwnerModeContext);
  if (!context) throw new Error('useOwnerMode must be used within OwnerModeProvider');
  return context;
};
