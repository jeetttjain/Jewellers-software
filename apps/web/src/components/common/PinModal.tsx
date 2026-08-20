import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Shield, KeyRound, X } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({ isOpen, onClose }) => {
  const [pin, setPin] = useState('');
  const { switchPin } = useAuth();
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const submitPin = async (code: string) => {
    const ok = await switchPin(code);
    if (ok) {
      addToast('Staff switched successfully', 'success');
      setPin('');
      onClose();
    } else {
      addToast('Invalid 4-digit PIN', 'error');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full p-6 text-center border border-surface-200 animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-surface-900 font-bold text-sm">
            <KeyRound className="w-4 h-4 text-gold-600" />
            <span>Counter PIN Switch</span>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-surface-600 mb-4">
          Enter 4-digit Counter Staff PIN (e.g. 1234 Owner, 5678 Mgr, 9999 Cashier)
        </p>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border ${
                pin.length > idx ? 'bg-gold-600 border-gold-600 scale-110' : 'bg-surface-100 border-surface-300'
              } transition-all duration-100`}
            />
          ))}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
            <button
              key={btn}
              onClick={() => {
                if (btn === 'C') setPin('');
                else if (btn === '⌫') setPin((p) => p.slice(0, -1));
                else handleDigit(btn);
              }}
              className="h-11 bg-surface-50 hover:bg-surface-100 active:bg-surface-200 text-surface-900 font-bold rounded-lg border border-surface-200 text-sm transition-colors focus:outline-none"
            >
              {btn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
