import React, { useRef, useEffect } from 'react';

export interface PinKeypadInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onSubmit?: (pinValue: string) => void;
  onCancel?: () => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export const PinKeypadInput: React.FC<PinKeypadInputProps> = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  length = 4,
  autoFocus = true,
  disabled = false,
  ariaLabel,
  className = ''
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = raw.replace(/\D/g, '').slice(0, length);
    onChange(normalized);
    if (normalized.length === length && onSubmit) {
      onSubmit(normalized);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (value.length === length && onSubmit) {
        e.preventDefault();
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      if (onCancel) {
        e.preventDefault();
        onCancel();
      } else {
        onChange('');
      }
    }
  };

  const handleKeypadClick = (k: string) => {
    if (disabled) return;

    if (k === 'C') {
      onChange('');
    } else if (k === '⌫') {
      onChange(value.slice(0, -1));
    } else {
      if (value.length < length) {
        const nextValue = (value + k).replace(/\D/g, '').slice(0, length);
        onChange(nextValue);
        if (nextValue.length === length && onSubmit) {
          onSubmit(nextValue);
        }
      }
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Visual PIN Masked Dots Container */}
      <div 
        onClick={() => inputRef.current?.focus()}
        className="relative cursor-pointer group flex flex-col items-center justify-center p-3 rounded-2xl transition-all"
      >
        {/* Real Accessible Native Numeric Input */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={length}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel || `Enter ${length}-digit PIN`}
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
        />

        {/* Masked Dots */}
        <div className="flex justify-center gap-3 relative z-0 py-2 px-4 rounded-xl group-focus-within:ring-2 group-focus-within:ring-amber-400 group-focus-within:bg-slate-900/60 transition-all">
          {Array.from({ length }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                value.length > i
                  ? 'bg-amber-400 border-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                  : 'border-slate-700 bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* On-Screen Keypad Grid */}
      <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => {
          let ariaKeyLabel = `Digit ${k}`;
          if (k === 'C') ariaKeyLabel = 'Clear PIN';
          if (k === '⌫') ariaKeyLabel = 'Backspace';

          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => handleKeypadClick(k)}
              aria-label={ariaKeyLabel}
              className="h-12 bg-slate-800/80 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-mono font-bold text-lg rounded-xl border border-slate-700/60 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 flex items-center justify-center shadow-xs"
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
};
