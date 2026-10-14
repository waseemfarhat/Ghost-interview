import { apiClient } from './client';

export const jobRolesApi = {
  list: (params) => apiClient.get('/job-roles', { params }),
  get: (id) => apiClient.get(`/job-roles/${id}`),
  generate: (roleName) => apiClient.post('/job-roles/generate', { roleName }),
  create: (payload) => apiClient.post('/job-roles', payload),
  update: (id, payload) => apiClient.put(`/job-roles/${id}`, payload),
  remove: (id) => apiClient.delete(`/job-roles/${id}`)
};
