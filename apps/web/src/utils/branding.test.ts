import { describe, it, expect, beforeEach } from 'vitest';
import { updateDynamicBranding, restoreDefaultBranding } from './branding.js';

// Setup node DOM shim for unit testing
if (typeof global.document === 'undefined') {
  const headElements: any[] = [];
  (global as any).document = {
    title: '',
    head: {
      appendChild: (el: any) => {
        headElements.push(el);
        return el;
      }
    },
    querySelector: (selector: string) => {
      if (selector.includes("link[rel~='icon']")) {
        return headElements.find((e) => e.rel === 'icon') || null;
      }
      return null;
    },
    createElement: (tag: string) => {
      return { tag, rel: '', href: '' };
    }
  };
}

describe('DYNAMIC BROWSER FAVICON & DOCUMENT TITLE ENGINE', () => {
  beforeEach(() => {
    document.title = 'Default Title';
    const existing = document.querySelector("link[rel~='icon']") as any;
    if (existing) {
      existing.href = '/favicon.ico';
    }
  });

  it('1. Updates document.title to "${shop.name} — POS & Inventory"', () => {
    updateDynamicBranding({ name: 'Shree Ram Jewellers', logoUrl: null });
    expect(document.title).toBe('Shree Ram Jewellers — POS & Inventory');
  });

  it('2. Dynamically creates/updates <link rel="icon"> with cache-busting query parameter', () => {
    updateDynamicBranding({ name: 'OM Jewellers', logoUrl: '/uploads/logos/logo_shop1.png' });

    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(link).not.toBeNull();
    expect(link!.href).toContain('/uploads/logos/logo_shop1.png?v=');
  });

  it('3. Uses default favicon when logoUrl is null or empty', () => {
    updateDynamicBranding({ name: 'Kamal Jewellers', logoUrl: null });

    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(link).not.toBeNull();
    expect(link!.href).toContain('/favicon.ico');
  });

  it('4. Restores default title and favicon upon logout', () => {
    updateDynamicBranding({ name: 'Shree Ram Jewellers', logoUrl: '/uploads/logos/logo_shop2.png' });
    restoreDefaultBranding();

    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(document.title).toBe('Kamal Jewellers — POS & Inventory');
    expect(link!.href).toContain('/favicon.ico');
  });

  it('5. Branding reload/remount: Restores correct shop favicon and document title on AppShell remount path', () => {
    // 1. Initial authenticated shop branding
    updateDynamicBranding({ name: 'Kamal Flagship', logoUrl: '/uploads/logos/logo_kamal.png' });
    expect(document.title).toBe('Kamal Flagship — POS & Inventory');
    const link1 = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(link1!.href).toContain('/uploads/logos/logo_kamal.png?v=');

    // 2. Execute initialization/remount path used by AppShell
    updateDynamicBranding({ name: 'Kamal Flagship', logoUrl: '/uploads/logos/logo_kamal.png' });

    // 3. Assert correct shop favicon and document title are restored
    expect(document.title).toBe('Kamal Flagship — POS & Inventory');
    const link2 = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(link2!.href).toContain('/uploads/logos/logo_kamal.png?v=');
  });
});
