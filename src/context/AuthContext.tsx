import React, { createContext, useContext, useState, useEffect } from 'react';
import authApi from '../api/auth.api';
import type { AppUser } from '../types/user';

interface AuthContextType {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    const storedToken = localStorage.getItem('token');

    if (!storedToken) {
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
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
    }
  };

  useEffect(() => {
    checkAuth();
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
