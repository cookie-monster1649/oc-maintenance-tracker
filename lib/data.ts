import { useState, useEffect } from "react";

// Cache in memory across navigations
const cache = new Map<string, unknown>();
const fetchPromises = new Map<string, Promise<unknown>>();

export function useCachedData(endpoint: string, refreshTrigger?: number) {
  const [data, setData] = useState<unknown>(() => cache.get(endpoint) || null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsRefreshing(true);

    (async () => {
      // Deduplicate concurrent requests but keep setData in this component's closure
      if (!fetchPromises.has(endpoint)) {
        fetchPromises.set(
          endpoint,
          fetch(endpoint)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((freshData) => {
              cache.set(endpoint, freshData);
              fetchPromises.delete(endpoint);
              return freshData;
            })
            .catch((error) => {
              console.error(`Failed to fetch ${endpoint}:`, error);
              fetchPromises.delete(endpoint);
              throw error;
            }),
        );
      }

      try {
        const freshData = await fetchPromises.get(endpoint);
        if (!cancelled) {
          setData(freshData);
          setIsRefreshing(false);
        }
      } catch {
        if (!cancelled) setIsRefreshing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [endpoint, refreshTrigger]);

  return { data, isRefreshing };
}

export function invalidateCache(endpoint: string) {
  cache.delete(endpoint);
  fetchPromises.delete(endpoint);
}
