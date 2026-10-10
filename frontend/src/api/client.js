import axios from 'axios';
import { tokenStore } from './tokenStore';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true, // send the httpOnly refresh cookie
  headers: {
    'X-Requested-With': 'GhostInterview'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

/**
 * On a 401 (expired access token), silently exchange the refresh cookie
 * for a new access token exactly once, then retry the original request.
 * Concurrent 401s share a single in-flight refresh call instead of each
 * firing their own.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthEndpoint = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh');

    if (response?.status === 401 && !config._retry && !isAuthEndpoint) {
      config._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = apiClient.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        }
        const { data } = await refreshPromise;
        tokenStore.set(data.data.accessToken);
        config.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(config);
      } catch (refreshError) {
        tokenStore.clear();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/** Normalizes backend error responses into a plain message + field details. */
export function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.details && Array.isArray(data.details) && data.details.length && data.details[0]?.field) {
    return data.details.map((d) => d.message).join(', ');
  }
  return data?.message || error?.message || 'Something went wrong. Please try again.';
}

export function extractFieldErrors(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((acc, d) => {
    if (d.field) acc[d.field] = d.message;
    return acc;
  }, {});
}
