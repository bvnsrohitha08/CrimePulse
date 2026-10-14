import { useState, useEffect } from 'react';
import { checkBackendHealth } from '../services/apiService';

/**
 * Hook to retrieve system health status from the backend gateway.
 */
export function useSystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchHealth() {
      try {
        const data = await checkBackendHealth();
        if (isMounted) {
          setHealth(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setHealth({ status: 'error', message: err.message });
          setLoading(false);
        }
      }
    }

    fetchHealth();
    return () => {
      isMounted = false;
    };
  }, []);

  return { health, loading };
}
