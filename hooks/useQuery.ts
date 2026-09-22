import { useEffect, useState } from 'react';

interface QueryOptions {
  /** Keep the last successful value visible while the same screen scope refreshes. */
  retainData?: boolean;
  /** Changing scope invalidates retained data, even when retainData is enabled. */
  scope?: unknown;
}

export function useQuery<T>(
  fetcher: () => Promise<T>,
  dependencies: readonly unknown[],
  options: QueryOptions = {},
) {
  const [state, setState] = useState<{
    key: string;
    scopeKey: string;
    data?: T;
    error: boolean;
  }>();
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...dependencies, attempt]);
  const scopeKey = JSON.stringify(options.scope);
  useEffect(() => {
    let alive = true;
    fetcher()
      .then((data) => {
        if (alive) setState({ key, scopeKey, data, error: false });
      })
      .catch(() => {
        if (alive)
          setState((previous) => ({
            key,
            scopeKey,
            data: previous?.scopeKey === scopeKey ? previous.data : undefined,
            error: true,
          }));
      });
    return () => {
      alive = false;
    };
    // Callers provide stable primitive query keys, just like a small query cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state?.key === key ? state : undefined;
  const retained = options.retainData && state?.scopeKey === scopeKey ? state.data : undefined;
  return {
    data: current?.data ?? retained,
    error: current?.error ?? false,
    loading: !current,
    reload: () => setAttempt((v) => v + 1),
  };
}
