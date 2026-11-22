import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on load
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await authApi.getMe();
        setUser(data.user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const handleVerified = (userData) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        handleVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

