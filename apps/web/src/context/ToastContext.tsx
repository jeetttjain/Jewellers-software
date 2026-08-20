import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export type ToastInput =
  | Omit<ToastItem, 'id'>
  | { title?: string; type?: ToastType; message?: string; duration?: number };

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (input: string | ToastInput, typeOrMessage?: ToastType | string, messageOrDuration?: string | number, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function isBlankString(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val !== 'string') return false;
  return val.trim().length === 0;
}

export function sanitizeToastInput(
  firstArg: any,
  secondArg?: any,
  thirdArg?: any,
  fourthArg?: any
): ToastItem | null {
  if (firstArg === null || firstArg === undefined) return null;

  let type: ToastType = 'info';
  let title = '';
  let message: string | undefined = undefined;
  let duration = 4000;

  const validTypes: ToastType[] = ['success', 'error', 'warning', 'info'];

  if (typeof firstArg === 'string') {
    title = firstArg.trim();

    if (typeof secondArg === 'string' && validTypes.includes(secondArg as ToastType)) {
      type = secondArg as ToastType;
      if (typeof thirdArg === 'string' && !isBlankString(thirdArg)) {
        message = thirdArg.trim();
      }
      if (typeof fourthArg === 'number') {
        duration = fourthArg;
      }
    } else if (typeof secondArg === 'string' && !isBlankString(secondArg)) {
      message = secondArg.trim();
      if (typeof thirdArg === 'number') {
        duration = thirdArg;
      }
    } else if (typeof secondArg === 'number') {
      duration = secondArg;
    }
  } else if (typeof firstArg === 'object') {
    const obj = firstArg as any;
    const rawTitle = typeof obj.title === 'string' ? obj.title.trim() : '';
    const rawMsg = typeof obj.message === 'string' ? obj.message.trim() : '';

    title = rawTitle || rawMsg;
    message = rawMsg && rawMsg !== title ? rawMsg : undefined;

    if (typeof obj.type === 'string' && validTypes.includes(obj.type as ToastType)) {
      type = obj.type as ToastType;
    }
    if (typeof obj.duration === 'number') {
      duration = obj.duration;
    }
  }

  // Strictly reject blank/empty/whitespace-only notifications
  if (isBlankString(title) && isBlankString(message)) {
    return null;
  }

  if (isBlankString(title) && !isBlankString(message)) {
    title = message!;
    message = undefined;
  }

  const id = Math.random().toString(36).substring(2, 9);
  return { id, type, title, message: isBlankString(message) ? undefined : message, duration };
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (firstArg: any, secondArg?: any, thirdArg?: any, fourthArg?: any) => {
      const sanitized = sanitizeToastInput(firstArg, secondArg, thirdArg, fourthArg);
      if (!sanitized) return;

      setToasts((prev) => {
        // Prevent duplicate notifications with identical type & content
        const isDuplicate = prev.some(
          (t) => t.type === sanitized.type && t.title === sanitized.title && t.message === sanitized.message
        );
        if (isDuplicate) return prev;

        return [...prev, sanitized];
      });

      if (sanitized.duration && sanitized.duration > 0) {
        setTimeout(() => {
          removeToast(sanitized.id);
        }, sanitized.duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => addToast(title, 'success', message), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast(title, 'error', message), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast(title, 'warning', message), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast(title, 'info', message), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
