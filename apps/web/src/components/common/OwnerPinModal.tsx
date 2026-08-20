import React, { useState } from 'react';
import { useOwnerMode } from '../../context/OwnerModeContext.js';
import { useToast } from '../../context/ToastContext.js';
import { ShieldCheck, Lock, X, KeyRound } from 'lucide-react';

interface OwnerPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSetupMode?: boolean;
  onSuccess?: () => void;
}

export const OwnerPinModal: React.FC<OwnerPinModalProps> = ({
  isOpen,
  onClose,
  isSetupMode = false,
  onSuccess
}) => {
  const { verifyOwnerPin, setupOwnerPin } = useOwnerMode();
  const { addToast } = useToast();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!/^\d{6}$/.test(pin)) {
      setErrorMsg('Owner PIN must consist of exactly 6 numeric digits');
      return;
    }

    if (isSetupMode && pin !== confirmPin) {
      setErrorMsg('PIN and Confirm PIN do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSetupMode) {
        const ok = await setupOwnerPin(pin);
        if (ok) {
          addToast('Owner 6-Digit Security PIN successfully created!', 'success');
          if (onSuccess) onSuccess();
          onClose();
        } else {
          setErrorMsg('Failed to set Owner PIN. Please try again.');
        }
      } else {
        const ok = await verifyOwnerPin(pin);
        if (ok) {
          addToast('Owner Mode Unlocked', 'success');
          if (onSuccess) onSuccess();
          onClose();
        } else {
          setErrorMsg('Incorrect Owner PIN. Please try again.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authorization failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span>{isSetupMode ? 'Create Owner 6-Digit PIN' : 'Owner Authorization Required'}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          {isSetupMode
            ? 'Set a confidential 6-digit numeric PIN to protect business-critical configuration.'
            : 'Enter your confidential 6-digit Owner PIN to access protected settings.'}
        </p>

        {errorMsg && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
              {isSetupMode ? 'New 6-Digit Owner PIN' : 'Enter 6-Digit Owner PIN'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="******"
                aria-label={isSetupMode ? 'New 6-Digit Owner PIN' : 'Enter 6-Digit Owner PIN'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-center font-mono text-lg tracking-widest font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {isSetupMode && (
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Confirm 6-Digit Owner PIN
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="******"
                  aria-label="Confirm 6-Digit Owner PIN"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-center font-mono text-lg tracking-widest font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || pin.length !== 6 || (isSetupMode && confirmPin.length !== 6)}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-md shadow-amber-500/20"
            >
              {isSubmitting ? 'Verifying...' : isSetupMode ? 'Save PIN' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
