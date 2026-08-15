import axios from 'axios';
import { getCachedResponse } from './apiCache';

const API_BASE_URLS = Array.from(
  new Set(
    [
      // 'http://localhost:5002/api',
      // 'http://127.0.0.1:5002/api',
      'http://localhost:5001/api',
      'http://127.0.0.1:5001/api',
      import.meta.env.VITE_API_URL,
    ].filter(Boolean) as string[]
  )
);

async function requestWithFallback(method: 'get' | 'post' | 'put' | 'delete', url: string, config?: Record<string, unknown>) {
  let lastError: unknown;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await axios({
        method,
        url: `${baseUrl}${url}`,
        ...config,
      });
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export interface ContactRecord {
  _id: string;
  customerId: string;
  customerName: string;
  contactName: string;
  designation: string;
  contactNumber: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactPayload {
  customerId?: string;
  customerName: string;
  contactName: string;
  designation: string;
  contactNumber: string;
  email: string;
}

export async function fetchContacts(params: { search?: string; page?: number; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const cacheKey = `contacts:${query.toString()}`;
  return getCachedResponse(cacheKey, async () => {
    const response = await requestWithFallback('get', '/contacts', {
      params: {
        search: params.search || '',
        page: params.page ?? '',
        limit: params.limit ?? '',
      },
    });
    return response.data ?? { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
  }, 30_000);
}

export async function fetchContactById(id: string) {
  const response = await requestWithFallback('get', `/contacts/${id}`);
  return response.data?.data ?? null;
}

export async function createContact(payload: ContactPayload) {
  const response = await requestWithFallback('post', '/contacts', { data: payload });
  return response.data;
}

export async function updateContact(id: string, payload: ContactPayload) {
  const response = await requestWithFallback('put', `/contacts/${id}`, { data: payload });
  return response.data;
}

export async function deleteContact(id: string) {
  const response = await requestWithFallback('delete', `/contacts/${id}`);
  return response.data;
}

export async function fetchCustomersForContacts() {
  const response = await requestWithFallback('get', '/customers?limit=1000');
  return response.data?.data ?? [];
}
