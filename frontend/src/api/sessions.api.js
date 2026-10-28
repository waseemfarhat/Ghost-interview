import { apiClient } from './client';

export const sessionsApi = {
  start: (jobRoleId) => apiClient.post('/sessions', { jobRoleId }),
  get: (id) => apiClient.get(`/sessions/${id}`),
  getQuestionVoice: (id) => apiClient.get(`/sessions/${id}/voice`, { responseType: 'blob' }),
  transcribeAudio: (id, audio) =>
    apiClient.post(`/sessions/${id}/transcribe`, audio, { headers: { 'Content-Type': audio.type || 'audio/webm' } }),
  list: (params) => apiClient.get('/sessions', { params }),
  submitAnswer: (id, transcript, questionIndex) =>
    apiClient.post(`/sessions/${id}/responses`, { transcript, questionIndex }),
  submitEmotionBatch: (id, readings) => apiClient.post(`/sessions/${id}/emotion`, { readings }),
  complete: (id) => apiClient.post(`/sessions/${id}/complete`),
  terminate: (id) => apiClient.post(`/sessions/${id}/terminate`)
};
