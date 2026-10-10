import { apiClient } from './client';

export const adminApi = {
  listUsers: (params) => apiClient.get('/admin/users', { params }),
  getUser: (id) => apiClient.get(`/admin/users/${id}`),
  updateUserStatus: (id, status) => apiClient.patch(`/admin/users/${id}/status`, { status }),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
  getAnalyticsOverview: () => apiClient.get('/admin/analytics/overview')
};
