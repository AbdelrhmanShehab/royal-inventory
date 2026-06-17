import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://192.168.50.5:3000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    if (!error.response) {
      console.error('Centralized API Handler: Network connection refused or timeout. Base URL:', api.defaults.baseURL);
    } else {
      const { status, data } = error.response;
      if (status === 401) {
        console.warn('Centralized API Handler: Session expired or invalid token (401).');
      } else if (status === 403) {
        console.error('Centralized API Handler: Access forbidden (403).');
      } else if (status >= 500) {
        console.error('Centralized API Handler: Server Internal Error (500+):', data || error.message);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
