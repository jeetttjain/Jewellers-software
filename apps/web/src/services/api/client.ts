import { ApiResponse } from '@jewellery-pos/shared';

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ShowroomApiClient {
  private getBaseUrl(): string {
    const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '';
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      const trimmed = envUrl.trim().replace(/\/+$/, '');
      return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
    }
    return '/api/v1';
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const baseUrl = this.getBaseUrl();
    const isAbsolute = baseUrl.startsWith('http://') || baseUrl.startsWith('https://');
    const url = isAbsolute
      ? new URL(`${baseUrl}${cleanEndpoint}`)
      : new URL(`${baseUrl}${cleanEndpoint}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return isAbsolute ? url.toString() : url.pathname + url.search;
  }

  public async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Failed to parse server response' }
    }));

    if (!res.ok || !json.success) {
      throw new ApiError(
        json.error?.message || `HTTP ${res.status}: ${res.statusText}`,
        json.error?.code || 'API_ERROR',
        res.status,
        json.error?.details
      );
    }

    return json.data as T;
  }

  public async post<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    // Auto-attach Idempotency-Key if provided or generate for transactional endpoints
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Failed to parse server response' }
    }));

    if (!res.ok || !json.success) {
      throw new ApiError(
        json.error?.message || `HTTP ${res.status}: ${res.statusText}`,
        json.error?.code || 'API_ERROR',
        res.status,
        json.error?.details
      );
    }

    return json.data as T;
  }

  public async put<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const res = await fetch(url, {
      ...options,
      method: 'PUT',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Failed to parse server response' }
    }));

    if (!res.ok || !json.success) {
      throw new ApiError(
        json.error?.message || `HTTP ${res.status}: ${res.statusText}`,
        json.error?.code || 'API_ERROR',
        res.status,
        json.error?.details
      );
    }

    return json.data as T;
  }

  public async patch<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const res = await fetch(url, {
      ...options,
      method: 'PATCH',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Failed to parse server response' }
    }));

    if (!res.ok || !json.success) {
      throw new ApiError(
        json.error?.message || `HTTP ${res.status}: ${res.statusText}`,
        json.error?.code || 'API_ERROR',
        res.status,
        json.error?.details
      );
    }

    return json.data as T;
  }

  public async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const res = await fetch(url, {
      ...options,
      method: 'DELETE',
      headers,
      credentials: 'include'
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Failed to parse server response' }
    }));

    if (!res.ok || !json.success) {
      throw new ApiError(
        json.error?.message || `HTTP ${res.status}: ${res.statusText}`,
        json.error?.code || 'API_ERROR',
        res.status,
        json.error?.details
      );
    }

    return json.data as T;
  }

  public async postBlob(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<{ blob: Blob; filename?: string }> {
    const url = this.buildUrl(endpoint, options.params);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/octet-stream, application/json, */*',
      ...(options.headers as Record<string, string> || {})
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const res = await fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({
        success: false,
        error: { code: 'API_ERROR', message: `HTTP ${res.status}: ${res.statusText}` }
      }));
      throw new ApiError(
        json.error?.message || `HTTP ${res.status}: ${res.statusText}`,
        json.error?.code || 'API_ERROR',
        res.status,
        json.error?.details
      );
    }

    const filename = res.headers.get('X-Backup-Filename') || undefined;
    const blob = await res.blob();
    return { blob, filename };
  }
}

export const api = new ShowroomApiClient();
