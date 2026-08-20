import { describe, it, expect } from 'vitest';
import { sanitizeToastInput, isBlankString } from './ToastContext.js';

describe('TOAST SYSTEM & BLANK NOTIFICATION PREVENTION ENGINE', () => {
  it('1. Correctly identifies blank/null/undefined/whitespace strings', () => {
    expect(isBlankString(null)).toBe(true);
    expect(isBlankString(undefined)).toBe(true);
    expect(isBlankString('')).toBe(true);
    expect(isBlankString('   ')).toBe(true);
    expect(isBlankString('\n\t')).toBe(true);
    expect(isBlankString('Valid Message')).toBe(false);
  });

  it('2. NEVER creates toast for empty, null, or undefined message inputs', () => {
    expect(sanitizeToastInput('')).toBeNull();
    expect(sanitizeToastInput(null)).toBeNull();
    expect(sanitizeToastInput(undefined)).toBeNull();
    expect(sanitizeToastInput('   ')).toBeNull();
    expect(sanitizeToastInput({ title: '', message: '  ' })).toBeNull();
    expect(sanitizeToastInput({ title: '   ' })).toBeNull();
  });

  it('3. Correctly handles positional string call: addToast("Settings Saved", "success")', () => {
    const toast = sanitizeToastInput('Settings Saved', 'success');

    expect(toast).not.toBeNull();
    expect(toast!.title).toBe('Settings Saved');
    expect(toast!.type).toBe('success');
    expect(toast!.message).toBeUndefined();
  });

  it('4. Correctly handles object call: addToast({ title: "Template Saved", type: "info" })', () => {
    const toast = sanitizeToastInput({ title: 'Template Saved', type: 'info' });

    expect(toast).not.toBeNull();
    expect(toast!.title).toBe('Template Saved');
    expect(toast!.type).toBe('info');
  });

  it('5. Correctly handles error messages and defaults unrecognized types to info', () => {
    const toast = sanitizeToastInput('Server Unavailable', 'invalid-type' as any);

    expect(toast).not.toBeNull();
    expect(toast!.title).toBe('Server Unavailable');
    expect(toast!.type).toBe('info');
  });

  it('6. Preserves valid messages: "Configuration saved successfully", "Invalid GSTIN", "Server unavailable"', () => {
    const t1 = sanitizeToastInput('Configuration saved successfully', 'success');
    const t2 = sanitizeToastInput('Invalid GSTIN', 'error');
    const t3 = sanitizeToastInput('Server unavailable', 'error');

    expect(t1!.title).toBe('Configuration saved successfully');
    expect(t1!.type).toBe('success');

    expect(t2!.title).toBe('Invalid GSTIN');
    expect(t2!.type).toBe('error');

    expect(t3!.title).toBe('Server unavailable');
    expect(t3!.type).toBe('error');
  });
});
