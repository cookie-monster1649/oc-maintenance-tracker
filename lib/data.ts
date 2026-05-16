import { useState, useEffect } from "react";

// Cache in memory across navigations
const cache = new Map<string, unknown>();
const fetchPromises = new Map<string, Promise<unknown>>();

export function useCachedData(endpoint: string, refreshTrigger?: number) {
  const [data, setData] = useState<unknown>(() => cache.get(endpoint) || null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Return cached data immediately
    if (cache.has(endpoint)) {
      setData(cache.get(endpoint));
    }

    // Fetch fresh data in background
    if (!fetchPromises.has(endpoint)) {
      fetchPromises.set(
        endpoint,
        fetch(endpoint)
          .then((res) => res.json())
          .then((freshData) => {
            cache.set(endpoint, freshData);
            setData(freshData);
            setIsRefreshing(false);
            fetchPromises.delete(endpoint);
            return freshData;
          }),
      );
    }

    setIsRefreshing(true);
    fetchPromises.get(endpoint)?.finally(() => {
      setIsRefreshing(false);
    });
  }, [endpoint, refreshTrigger]);

  return { data, isRefreshing };
}

export function invalidateCache(endpoint: string) {
  cache.delete(endpoint);
  fetchPromises.delete(endpoint);
}
