import { useContext } from 'react';
import { AuthContext } from '../context/authContextInstance';

/**
 * Hook to access current authentication context.
 */
export function useAuth() {
  return useContext(AuthContext);
}
