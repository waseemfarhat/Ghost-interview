import { apiClient } from './client';

export const reportsApi = {
  getBySession: (sessionId) => apiClient.get(`/reports/session/${sessionId}`),
  list: (params) => apiClient.get('/reports', { params })
};
