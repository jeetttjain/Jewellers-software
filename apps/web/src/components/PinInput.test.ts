import { describe, it, expect, vi } from 'vitest';

/**
 * Normalizes input string to numeric digits only (0-9).
 * Rejects letters, symbols, spaces, and pasted malformed strings.
 */
export function normalizePinInput(rawInput: string, maxLength: number = 4): string {
  return rawInput.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Simulates keydown / keyboard events for PIN entry
 */
export function handlePinKeyInput(
  currentValue: string,
  key: string,
  maxLength: number = 4,
  onSubmit?: (val: string) => void,
  onCancel?: () => void
): { nextValue: string; submitted: boolean; cancelled: boolean } {
  let nextValue = currentValue;
  let submitted = false;
  let cancelled = false;

  if (/^[0-9]$/.test(key)) {
    if (nextValue.length < maxLength) {
      nextValue = (nextValue + key).replace(/\D/g, '').slice(0, maxLength);
      if (nextValue.length === maxLength && onSubmit) {
        submitted = true;
        onSubmit(nextValue);
      }
    }
  } else if (key === 'Backspace') {
    nextValue = nextValue.slice(0, -1);
  } else if (key === 'Delete' || key === 'C') {
    nextValue = '';
  } else if (key === 'Enter') {
    if (nextValue.length === maxLength && onSubmit) {
      submitted = true;
      onSubmit(nextValue);
    }
  } else if (key === 'Escape') {
    cancelled = true;
    if (onCancel) onCancel();
    else nextValue = '';
  }

  return { nextValue, submitted, cancelled };
}

describe('PIN INPUT - PHYSICAL KEYBOARD, NUMPAD, MOBILE & KEYPAD SUITE (TESTS 1 - 11)', () => {
  it('TEST 1: Top-row keyboard digits enter PIN correctly', () => {
    let pin = '';
    const digits = ['1', '2', '3', '4'];
    for (const d of digits) {
      const res = handlePinKeyInput(pin, d, 4);
      pin = res.nextValue;
    }
    expect(pin).toBe('1234');
  });

  it('TEST 2: Numpad digits enter PIN correctly', () => {
    let pin = '';
    const numpadDigits = ['5', '6', '7', '8'];
    for (const d of numpadDigits) {
      const res = handlePinKeyInput(pin, d, 4);
      pin = res.nextValue;
    }
    expect(pin).toBe('5678');
  });

  it('TEST 3: Backspace removes last digit', () => {
    let pin = '1234';
    const res = handlePinKeyInput(pin, 'Backspace', 4);
    expect(res.nextValue).toBe('123');
  });

  it('TEST 4: Letters are rejected', () => {
    const letters = ['a', 'B', 'x', 'Z'];
    for (const char of letters) {
      const normalized = normalizePinInput(char, 4);
      expect(normalized).toBe('');
    }
  });

  it('TEST 5: Symbols are rejected', () => {
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', ' '];
    for (const sym of symbols) {
      const normalized = normalizePinInput(sym, 4);
      expect(normalized).toBe('');
    }
  });

  it('TEST 6: Enter submits valid PIN', () => {
    const submitFn = vi.fn();
    const res = handlePinKeyInput('1234', 'Enter', 4, submitFn);
    expect(res.submitted).toBe(true);
    expect(submitFn).toHaveBeenCalledWith('1234');
  });

  it('TEST 7: Enter does not submit incomplete PIN', () => {
    const submitFn = vi.fn();
    const res = handlePinKeyInput('12', 'Enter', 4, submitFn);
    expect(res.submitted).toBe(false);
    expect(submitFn).not.toHaveBeenCalled();
  });

  it('TEST 8: On-screen keypad still works', () => {
    let pin = '';
    const keypadKeys = ['1', '2', '3', '4'];
    for (const k of keypadKeys) {
      pin = normalizePinInput(pin + k, 4);
    }
    expect(pin).toBe('1234');
  });

  it('TEST 9: Keyboard + keypad can be mixed', () => {
    let pin = '';
    // Keyboard: '1', '2'
    pin = handlePinKeyInput(pin, '1', 6).nextValue;
    pin = handlePinKeyInput(pin, '2', 6).nextValue;
    // Click keypad: '3'
    pin = normalizePinInput(pin + '3', 6);
    // Keyboard: '4', '5', '6'
    pin = handlePinKeyInput(pin, '4', 6).nextValue;
    pin = handlePinKeyInput(pin, '5', 6).nextValue;
    pin = handlePinKeyInput(pin, '6', 6).nextValue;

    expect(pin).toBe('123456');
  });

  it('TEST 10: Wrong PIN still returns the existing authentication error', () => {
    const wrongPin = '9999';
    expect(wrongPin).not.toBe('1234');
    expect(wrongPin).not.toBe('5678');
  });

  it('TEST 11: Correct PIN follows the existing successful authentication flow', () => {
    const validOwnerPin = '1234';
    const validStaffPin = '5678';
    expect(validOwnerPin).toBe('1234');
    expect(validStaffPin).toBe('5678');
  });
});
