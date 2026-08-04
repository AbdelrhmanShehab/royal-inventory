import React, { createContext, useContext, useState, useEffect } from 'react';
import authApi from '../api/auth.api';
import type { AppUser } from '../types/user';
import { isTokenExpired } from '../utils/verification';
import { queryClient } from '../providers/QueryProvider';

interface AuthContextType {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string | string[]) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const hasPermission = (permission: string): boolean => {
    if (user?.role === 'admin') return true;
    return user?.permissions?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (user?.role === 'admin') return true;
    return permissions.some(perm => user?.permissions?.includes(perm));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (user?.role === 'admin') return true;
    return permissions.every(perm => user?.permissions?.includes(perm));
  };

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  const checkAuth = async () => {
    const storedToken = localStorage.getItem('token');

    if (!storedToken || isTokenExpired(storedToken)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      setLoading(false);
      queryClient.clear();
      return;
    }

    try {
      // Call GET /auth/me to restore session
      const userData = await authApi.getMe();

      setUser(userData);
      setToken(storedToken);
      setIsAuthenticated(true);

      // Update local storage user just in case details changed
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Session restoration failed:', error);
      // Clear token and user on error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      queryClient.clear();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      queryClient.clear();
      const response = await authApi.login({ username, password });

      // Based on axios interceptor, the response is response.data.data
      // which has accessToken and user
      const { accessToken, user: loggedUser } = response;

      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));

      setToken(accessToken);
      setUser(loggedUser);
      setIsAuthenticated(true);
    } catch (error) {
      // Re-throw so page can display the error
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Call POST /auth/logout
      await authApi.logout();
    } catch (error) {
      console.error('Backend logout call failed:', error);
    } finally {
      // Always clear local session even if backend call fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      setLoading(false);
      queryClient.clear();
    }
  };

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        loading,
        login,
        logout,
        checkAuth,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
