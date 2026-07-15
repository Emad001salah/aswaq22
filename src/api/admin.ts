// src/api/admin.ts
/**
 * Helper functions for Admin Panel API interactions.
 * All functions return JSON data or throw on error.
 */

export const getAuthHeaders = (email?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (email) {
    headers['x-user-email'] = email;
  }
  return headers;
};

export const fetchNotifications = async (email?: string) => {
  const res = await fetch('/api/admin/notifications', {
    method: 'GET',
    headers: getAuthHeaders(email)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch notifications: ${res.status} ${err}`);
  }
  return await res.json();
};

export const fetchReports = async () => {
  const res = await fetch('/api/reports');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch reports: ${res.status} ${err}`);
  }
  return await res.json();
};
