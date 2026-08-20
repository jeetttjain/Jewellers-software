import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './client.js';

describe('SHARED API CLIENT — DELETE METHOD SUITE (TESTS 1 - 8)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('TEST 1: api.delete method exists', () => {
    expect(typeof api.delete).toBe('function');
  });

  it('TEST 2: api.delete sends DELETE request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { deleted: true } })
    });
    globalThis.fetch = mockFetch;

    await api.delete('/test-endpoint');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/test-endpoint');
    expect(options.method).toBe('DELETE');
  });

  it('TEST 3: api.delete preserves credentials/authentication behavior', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ok: true } })
    });
    globalThis.fetch = mockFetch;

    await api.delete('/test-auth');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.credentials).toBe('include');
    expect(options.headers['Accept']).toBe('application/json');
  });

  it('TEST 4: api.delete parses successful response correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { removed: true, imageId: 'img-123' } })
    });
    globalThis.fetch = mockFetch;

    const res = await api.delete<{ removed: boolean; imageId: string }>('/items/item-1/images/img-123');

    expect(res).toEqual({ removed: true, imageId: 'img-123' });
  });

  it('TEST 5: api.delete handles HTTP 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
    });
    globalThis.fetch = mockFetch;

    await expect(api.delete('/protected')).rejects.toThrow(ApiError);
    await expect(api.delete('/protected')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  });

  it('TEST 6: api.delete handles HTTP 403', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Tenant access denied' }
      })
    });
    globalThis.fetch = mockFetch;

    await expect(api.delete('/shop-b-resource')).rejects.toThrow(ApiError);
    await expect(api.delete('/shop-b-resource')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN'
    });
  });

  it('TEST 7: api.delete handles HTTP 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Image not found' }
      })
    });
    globalThis.fetch = mockFetch;

    await expect(api.delete('/items/missing/images/missing')).rejects.toThrow(ApiError);
    await expect(api.delete('/items/missing/images/missing')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND'
    });
  });

  it('TEST 8: api.delete handles HTTP 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Storage deletion failed' }
      })
    });
    globalThis.fetch = mockFetch;

    await expect(api.delete('/error-endpoint')).rejects.toThrow(ApiError);
    await expect(api.delete('/error-endpoint')).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR'
    });
  });
});
