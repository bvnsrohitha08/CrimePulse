import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextInstance';
import {
  loginUser,
  registerUser,
  getCurrentUser,
} from '../services/apiService';
import { getToken, setToken as persistToken, clearToken } from '../services/tokenService';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore and validate session on initial application load
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = getToken();
      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        // Query backend GET /api/auth/me as the single source of truth
        const response = await getCurrentUser(storedToken);
        if (isMounted) {
          if (response && response.user) {
            setUser(response.user);
            setTokenState(storedToken);
          } else {
            clearToken();
            setUser(null);
            setTokenState(null);
          }
        }
      } catch {
        // Token is invalid, expired, or rejected
        clearToken();
        if (isMounted) {
          setUser(null);
          setTokenState(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const result = await loginUser({ email, password });
    if (result && result.token && result.user) {
      persistToken(result.token);
      setTokenState(result.token);
      setUser(result.user);
      return result;
    }
    throw new Error('Malformed login response received from server.');
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const result = await registerUser({ name, email, password });
    if (result && result.token && result.user) {
      persistToken(result.token);
      setTokenState(result.token);
      setUser(result.user);
      return result;
    }
    throw new Error('Malformed registration response received from server.');
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
