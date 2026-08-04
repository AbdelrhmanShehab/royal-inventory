import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
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

  // Automatic Request Scoping for warehouse isolation
  const rawUser = localStorage.getItem('user');
  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      const nodeId = user?.nodeId ?? user?.node_id;
      const isAdmin = user?.role === 'admin';

      if (!isAdmin && nodeId) {
        config.params = config.params || {};
        // If query parameters exist, scope nodeId if not specified explicitly
        if (!config.params.nodeId && !config.params.fromNodeId && !config.params.toNodeId) {
          config.params.nodeId = nodeId;
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
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
      if (status === 401 && !error.config?.url?.includes('/auth/login')) {
        console.warn('Centralized API Handler: Session expired or invalid token (401).');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('auth:unauthorized', {
              detail: { message: 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول.' },
            })
          );
        }
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
