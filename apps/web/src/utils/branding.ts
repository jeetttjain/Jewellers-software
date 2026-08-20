export interface ShopBrandingInfo {
  name?: string | null;
  logoUrl?: string | null;
}

const DEFAULT_TITLE = 'Kamal Jewellers — POS & Inventory';
const DEFAULT_FAVICON = '/favicon.ico';

/**
 * Updates the browser tab title and dynamic favicon based on the authenticated shop profile.
 */
export function updateDynamicBranding(shop?: ShopBrandingInfo | null) {
  if (typeof document === 'undefined') return;

  // 1. Update Document Title
  if (shop?.name && shop.name.trim()) {
    document.title = `${shop.name.trim()} — POS & Inventory`;
  } else {
    document.title = DEFAULT_TITLE;
  }

  // 2. Update Browser Favicon Link
  let faviconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    document.head.appendChild(faviconLink);
  }

  if (shop?.logoUrl && shop.logoUrl.trim()) {
    const rawUrl = shop.logoUrl.trim();
    const cacheBustedUrl = rawUrl.includes('?')
      ? `${rawUrl}&v=${Date.now()}`
      : `${rawUrl}?v=${Date.now()}`;

    faviconLink.href = cacheBustedUrl;
  } else {
    faviconLink.href = DEFAULT_FAVICON;
  }
}

/**
 * Restores the default application title and favicon upon logout or unauthenticated state.
 */
export function restoreDefaultBranding() {
  if (typeof document === 'undefined') return;

  document.title = DEFAULT_TITLE;

  const faviconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (faviconLink) {
    faviconLink.href = DEFAULT_FAVICON;
  }
}
