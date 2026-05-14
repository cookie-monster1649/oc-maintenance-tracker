const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | null {
  return (cache.get(key) as T) ?? null;
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, data);
}
