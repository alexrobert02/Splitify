import { storage } from './storage';
import type {
  AuthResponse,
  UserDto,
  GroupDto,
  ReceiptDto,
  ReceiptItemDto,
  ReceiptSummaryDto,
  AssigneeEntry,
  NotificationDto,
  RecurringExpenseDto,
} from '@/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

async function request<T>(path: string, options: RequestInit & { noAuth?: boolean } = {}): Promise<T> {
  const { noAuth, ...fetchOptions } = options;
  const token = noAuth ? null : await storage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers });

  if (response.status === 401 || response.status === 403) {
    if (token) {
      unauthorizedHandler?.();
      throw new Error('Session expired');
    }
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Unauthorized');
  }

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
        noAuth: true,
      }),
    register: (email: string, name: string, password: string) =>
      request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, name, password }),
        noAuth: true,
      }),
  },

  currency: {
    rates: (base: string) =>
      request<Record<string, number>>(`/api/currency/rates?base=${encodeURIComponent(base)}`),
  },

  users: {
    me: () => request<UserDto>('/api/users/me'),
    update: (data: { name?: string; revolutTag?: string; preferredCurrency?: string }) =>
      request<UserDto>('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    updatePushToken: (pushToken: string) =>
      request<void>('/api/users/me/push-token', {
        method: 'PUT',
        body: JSON.stringify(pushToken),
      }),
    clearPushToken: (pushToken: string) =>
      request<void>('/api/users/me/push-token', {
        method: 'DELETE',
        body: JSON.stringify(pushToken),
      }),
  },

  notifications: {
    list: () => request<NotificationDto[]>('/api/notifications'),
    unreadCount: () => request<number>('/api/notifications/unread-count'),
    markRead: (id: string) => request<void>(`/api/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request<void>('/api/notifications/read-all', { method: 'PUT' }),
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
        body: JSON.stringify(email),
      }),
    removeMember: (groupId: string, userId: string) =>
      request<void>(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
    delete: (groupId: string) =>
      request<void>(`/api/groups/${groupId}`, { method: 'DELETE' }),
  },

  receipts: {
    list: () => request<ReceiptDto[]>('/api/receipts'),
    listByGroup: (groupId: string, unpaidOnly?: boolean) =>
      request<ReceiptDto[]>(`/api/receipts/group/${groupId}${unpaidOnly ? '?unpaidOnly=true' : ''}`),
    get: (id: string) => request<ReceiptDto>(`/api/receipts/${id}`),
    createReceipt: (title: string, groupId?: string, category?: string, currency?: string) => {
      const params = new URLSearchParams();
      params.append('title', title);
      if (groupId) params.append('groupId', groupId);
      if (category) params.append('category', category);
      if (currency) params.append('currency', currency);
      return request<ReceiptDto>(`/api/receipts/create?${params}`, { method: 'POST' });
    },
    scan: async (
      imageUri: string,
      title: string,
      groupId?: string,
      currency?: string
    ): Promise<ReceiptDto> => {
      const token = await storage.getToken();
      const formData = new FormData();
      const filename = imageUri.split('/').pop() ?? 'receipt.jpg';
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      formData.append('image', { uri: imageUri, name: filename, type: mimeType } as any);
      formData.append('title', title);
      if (groupId) formData.append('groupId', groupId);
      if (currency) formData.append('currency', currency);

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
    update: (id: string, data: { title?: string; currency?: string; groupId?: string; category?: string }) =>
      request<ReceiptDto>(`/api/receipts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    addItem: (receiptId: string, data: { name: string; quantity: number; unitPrice: number }) =>
      request<ReceiptItemDto>(`/api/receipts/${receiptId}/items`, {
        method: 'POST',
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
    deleteItem: (receiptId: string, itemId: string) =>
      request<void>(`/api/receipts/${receiptId}/items/${itemId}`, { method: 'DELETE' }),
    assignItem: (receiptId: string, itemId: string, assignees: AssigneeEntry[]) =>
      request<ReceiptItemDto>(`/api/receipts/${receiptId}/items/${itemId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignees }),
      }),
    confirmReview: (id: string) => request<ReceiptDto>(`/api/receipts/${id}/confirm-review`, { method: 'POST' }),
    finalize: (id: string) => request<ReceiptDto>(`/api/receipts/${id}/finalize`, { method: 'POST' }),
    summary: (id: string) => request<ReceiptSummaryDto>(`/api/receipts/${id}/summary`),
    markPaid: (receiptId: string, userId: string) =>
      request<void>(`/api/receipts/${receiptId}/participants/${userId}/pay`, { method: 'POST' }),
    delete: (id: string) => request<void>(`/api/receipts/${id}`, { method: 'DELETE' }),
  },

  recurring: {
    list: () => request<RecurringExpenseDto[]>('/api/recurring'),
    get: (id: string) => request<RecurringExpenseDto>(`/api/recurring/${id}`),
    create: (data: {
      title: string;
      totalAmount: number;
      currency: string;
      category?: string;
      groupId?: string;
      frequency: string;
      startDate: string;
      participants: { userId: string; splitType: string; splitValue?: number }[];
    }) =>
      request<RecurringExpenseDto>('/api/recurring', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    toggle: (id: string) =>
      request<RecurringExpenseDto>(`/api/recurring/${id}/toggle`, { method: 'PUT' }),
    delete: (id: string) => request<void>(`/api/recurring/${id}`, { method: 'DELETE' }),
  },
};
