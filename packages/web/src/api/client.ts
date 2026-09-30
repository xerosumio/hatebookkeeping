import axios from 'axios';
import { apiUrl } from './base';
import { clearWebToken, getWebToken, shouldRedirectToLogin } from './session';

const api = axios.create({
  baseURL: apiUrl(''),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getWebToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    if (status === 401 && shouldRedirectToLogin(pathname)) {
      clearWebToken();
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${apiUrl('/auth/login')}?returnTo=${returnTo}`;
    }
    return Promise.reject(error);
  },
);

export default api;
