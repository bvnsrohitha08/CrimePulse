import { createContext } from 'react';

/**
 * Authentication Context instance with default properties.
 */
export const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});
