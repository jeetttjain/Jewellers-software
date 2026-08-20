import React from 'react';
import { useToast, ToastType } from '../../context/ToastContext.js';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
};

const styles: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-950',
  error: 'bg-red-50 border-red-200 text-red-950',
  warning: 'bg-amber-50 border-amber-200 text-amber-950',
  info: 'bg-blue-50 border-blue-200 text-blue-950'
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  const validToasts = toasts.filter(
    (t) =>
      t &&
      ((typeof t.title === 'string' && t.title.trim().length > 0) ||
        (typeof t.message === 'string' && t.message.trim().length > 0))
  );

  if (validToasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 md:bottom-4 md:right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {validToasts.map((toast) => {
        const toastType: ToastType = ['success', 'error', 'warning', 'info'].includes(toast.type)
          ? toast.type
          : 'info';

        const displayTitle = toast.title?.trim() || toast.message?.trim() || '';

        if (!displayTitle) return null;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all animate-in slide-in-from-bottom-2 ${styles[toastType]}`}
            role="alert"
          >
            {icons[toastType]}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold">{displayTitle}</h4>
              {toast.message && toast.message.trim() !== displayTitle && (
                <p className="text-xs mt-0.5 opacity-90">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:opacity-75 rounded transition-opacity"
              aria-label="Close notification"
            >
              <X className="w-4 h-4 opacity-60 hover:opacity-100" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
