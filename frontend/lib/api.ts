import { storage } from './storage';
import type {
  AuthResponse,
  UserDto,
  GroupDto,
  ReceiptDto,
  ReceiptItemDto,
  ReceiptSummaryDto,
  AssigneeEntry,
} from '@/types';

const BASE_URL = 'http://192.168.0.18:8080';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null as T;
  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, name: string, password: string) =>
      request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, name, password }),
      }),
  },

  users: {
    me: () => request<UserDto>('/api/users/me'),
    update: (name: string) =>
      request<UserDto>('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }),
  },

  groups: {
    list: () => request<GroupDto[]>('/api/groups'),
    get: (id: string) => request<GroupDto>(`/api/groups/${id}`),
    create: (name: string, description?: string) =>
      request<GroupDto>('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }),
    addMember: (groupId: string, email: string) =>
      request<GroupDto>(`/api/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    removeMember: (groupId: string, userId: string) =>
      request<void>(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
    delete: (groupId: string) =>
      request<void>(`/api/groups/${groupId}`, { method: 'DELETE' }),
  },

  receipts: {
    list: () => request<ReceiptDto[]>('/api/receipts'),
    listByGroup: (groupId: string) =>
      request<ReceiptDto[]>(`/api/receipts/group/${groupId}`),
    get: (id: string) => request<ReceiptDto>(`/api/receipts/${id}`),
    scan: async (
      imageUri: string,
      title?: string,
      groupId?: string
    ): Promise<ReceiptDto> => {
      const token = await storage.getToken();
      const formData = new FormData();
      const filename = imageUri.split('/').pop() ?? 'receipt.jpg';
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      formData.append('image', { uri: imageUri, name: filename, type: mimeType } as any);
      if (title) formData.append('title', title);
      if (groupId) formData.append('groupId', groupId);

      const response = await fetch(`${BASE_URL}/api/receipts/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${response.status}`);
      }
      return response.json();
    },
    update: (id: string, data: { title?: string; currency?: string; groupId?: string }) =>
      request<ReceiptDto>(`/api/receipts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    updateItem: (
      receiptId: string,
      itemId: string,
      data: { name?: string; quantity?: number; unitPrice?: number }
    ) =>
      request<ReceiptItemDto>(`/api/receipts/${receiptId}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    assignItem: (receiptId: string, itemId: string, assignees: AssigneeEntry[]) =>
      request<ReceiptItemDto>(`/api/receipts/${receiptId}/items/${itemId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignees }),
      }),
    summary: (id: string) => request<ReceiptSummaryDto>(`/api/receipts/${id}/summary`),
    delete: (id: string) => request<void>(`/api/receipts/${id}`, { method: 'DELETE' }),
  },
};
