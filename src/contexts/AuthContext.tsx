import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../api/axiosInstance';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    console.log('🔍 Starting authentication check...');
    
    try {
      console.log('🌐 Making session check request...');
      const response = await apiClient.get('/session');
      console.log('📊 Session check response status:', response.status);
      
      const isAuth = response.status === 200;
      console.log('🔐 Setting authentication state:', isAuth);
      setIsAuthenticated(isAuth);
    } catch (error) {
      console.error('❌ Session check failed:', error);
      console.log('🚫 Setting authentication to false');
      setIsAuthenticated(false);
    } finally {
      console.log('⏰ Setting loading to false');
      setIsLoading(false);
    }
  };

  const login = async (password: string): Promise<boolean> => {
    try {
      console.log('Attempting login with password:', password.substring(0, 3) + '***');
      const response = await apiClient.post('/login', { password });
      console.log('Login response:', response);
      
      if (response.status === 200 && response.data?.success) {
        console.log('Login successful');
        setIsAuthenticated(true);
        return true;
      }
      console.log('Login failed: Invalid response', response);
      return false;
    } catch (error) {
      console.error('Login failed with error:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};