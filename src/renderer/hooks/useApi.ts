/**
 * Custom hook wrapping window.api calls with loading/error state.
 * Provides a consistent async data-fetching pattern across all views.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** Re-trigger the fetch manually */
  refetch: () => void;
}

/**
 * Fetches data from the main process via a window.api call.
 * Re-fetches when the fetch function reference changes (use useCallback to stabilise).
 *
 * @example
 * const { data, loading, error } = useApi(
 *   () => window.api.coworkSessions.getSummaryToday(),
 *   [today]
 * );
 */
export function useApi<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = []
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // Use a ref for the fetch function to avoid it needing to be a dependency itself
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchFnRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  return { data, loading, error, refetch };
}
