# Navigation Data Fetching Pattern

## Problem

Tab navigation (Tasks/Vendors/Costs) caused visual flash: "going to target, back to current page, then to target very quickly." This was caused by `"use client"` pages showing "Loading..." text while fetching data.

## Architecture Decision

**All pages must remain `"use client"`** because they require:
- Form state and mutations (POST/PUT/DELETE)
- Modal/dropdown interactivity  
- Dynamic URL parameters (`useParams`, `useRouter`)
- Complex client-side filtering

Server component conversion is not viable.

## Solution: Stale-While-Revalidate Pattern

Pages render immediately with cached/stale data while fetching fresh data in the background. No "Loading..." state.

### Implementation

**Create `lib/data.ts`** — Single source of truth for all data fetching:

```tsx
// Cache in memory across navigations
const cache = new Map<string, unknown>();
const fetchPromises = new Map<string, Promise<unknown>>();

export function useCachedData(endpoint: string) {
  const [data, setData] = useState(() => cache.get(endpoint) || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    // Return cached data immediately
    if (cache.has(endpoint)) {
      setData(cache.get(endpoint));
    }
    
    // Fetch fresh data in background
    if (!fetchPromises.has(endpoint)) {
      fetchPromises.set(endpoint, 
        fetch(endpoint)
          .then(res => res.json())
          .then(freshData => {
            cache.set(endpoint, freshData);
            setData(freshData);
            setIsRefreshing(false);
            fetchPromises.delete(endpoint);
            return freshData;
          })
      );
    }
    
    setIsRefreshing(true);
    fetchPromises.get(endpoint)?.finally(() => {
      setIsRefreshing(false);
    });
  }, [endpoint]);
  
  return { data, isRefreshing };
}
```

### Per-Page Changes

For each page (Tasks, Vendors, Costs, Archived, Detail pages):

**Before:**
```tsx
const [tasks, setTasks] = useState<Task[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchAll();
}, []);

return loading ? <p>Loading...</p> : <main>...</main>;
```

**After:**
```tsx
const { data: tasks, isRefreshing } = useCachedData('/api/tasks');

return (
  <main className={isRefreshing ? 'opacity-75' : ''}>
    {/* Render immediately, even if tasks is null or stale */}
  </main>
);
```

## UX Result

- **Instant tab navigation:** No "Loading..." flash
- **Seamless updates:** Stale data briefly visible → smoothly replaced by fresh data
- **Perceived performance:** Zero-latency navigation like Gmail/Slack

## Implementation Notes

- Cache persists during session (survives one tab switch to another and back)
- Mutations (POST/PUT/DELETE) should invalidate relevant cache entries
- Optional: Add subtle visual feedback during refresh (e.g., `opacity-75` or border-top gradient)
- Fallback: If cache is empty and fetch fails, show error state (not loading state)

## Files Modified

- Create: `app/lib/data.ts`
- Update: 6 page files + TaskCard component
- Total change: ~150 LOC net (add caching logic, remove loading conditionals)
