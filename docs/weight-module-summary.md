# Weight Tracking Module - Technical Documentation

## Overview

The Weight Tracking module provides comprehensive weight and body fat tracking functionality with optimized data fetching, persistent caching, and a unified "latest per day" data model. This document describes the architecture, data flow, and key implementation details.

## Table of Contents

1. [Database Schema](#database-schema)
2. [Core Data Model](#core-data-model)
3. [Data Fetching Strategy](#data-fetching-strategy)
4. [Derived Data Structure: `daily_latest_weight`](#derived-data-structure-daily_latest_weight)
5. [React Query Hooks](#react-query-hooks)
6. [Persistent Caching](#persistent-caching)
7. [Data Flow and Architecture](#data-flow-and-architecture)
8. [Key Algorithms](#key-algorithms)
9. [Performance Optimizations](#performance-optimizations)
10. [Testing](#testing)

---

## Database Schema

### Table: `weight_log`

The `weight_log` table stores all individual weigh-in entries:

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to auth.users)
- weighed_at: TIMESTAMPTZ (when the weigh-in occurred, stored in UTC)
- weight_lb: NUMERIC (weight in pounds)
- body_fat_percent: NUMERIC (optional body fat percentage)
- note: TEXT (optional user notes)
```

### Database Index

**File**: `supabase-weight-log-index.sql`

A composite index optimizes range queries:

```sql
CREATE INDEX IF NOT EXISTS weight_log_user_weighed_at_idx
ON public.weight_log (user_id, weighed_at);
```

This index supports efficient queries filtering by `user_id` and `weighed_at` range, which is the primary query pattern for fetching weight logs.

---

## Core Data Model

### WeightLogRow (Raw Database Row)

Raw data structure returned from the database:

```typescript
type WeightLogRow = {
  id: string;
  user_id: string;
  weighed_at: string; // ISO timestamp (UTC)
  weight_lb: number;
  body_fat_percent: number | null;
  note: string | null;
};
```

### DailyLatestWeightRow (Derived Structure)

The application derives a daily structure where each day has exactly one weight entry (the latest weigh-in for that local day):

```typescript
type DailyLatestWeightRow = {
  date_key: string; // YYYY-MM-DD (local timezone)
  weighed_at: string; // ISO timestamp of the latest weigh-in that day
  weight_lb: number | null;
  id: string; // weight_log.id (source of truth reference)
  body_fat_percent: number | null;
};
```

**Key Point**: `daily_latest_weight` is **NOT** a database table. It is an in-memory derived dataset computed from `weight_log` rows in application code.

---

## Data Fetching Strategy

### Fetch Window: 366 Days

The module fetches the last **366 days** of weight logs as a bounded window. This provides:
- Enough data for annual charts (1 year)
- Efficient database queries (bounded, indexed)
- Predictable memory usage

**File**: `lib/services/weightLogs.ts`

```typescript
export async function fetchWeightLogs366d(userId: string): Promise<WeightLogRow[]> {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999); // End of current day
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 365); // 365 days ago = 366 days total (inclusive)
  startDate.setHours(0, 0, 0, 0); // Start of day 365 days ago
  
  return fetchWeightLogsRange(userId, startDate.toISOString(), endDate.toISOString());
}
```

### Query Pattern

All weight log queries follow this pattern:
- Filter by `user_id`
- Filter by `weighed_at` range (gte/lte)
- Order by `weighed_at` ascending
- Leverage the composite index for performance

---

## Derived Data Structure: `daily_latest_weight`

### Purpose

The `daily_latest_weight` structure provides a unified, consistent definition of "daily weight" used across:
- All charts (7d, 1m, 3m, 6m, 1y)
- List views and home summaries
- Any place displaying daily weight data

### Algorithm

**File**: `lib/derive/daily-latest-weight.ts`

```typescript
export function deriveDailyLatestWeight(rawLogs: WeightLogRow[]): DailyLatestWeightRow[] {
  const latestByDate = new Map<string, WeightLogRow>();
  
  // Single pass: later logs overwrite earlier ones for same day
  for (const log of rawLogs) {
    const dateKey = getLocalDateKey(new Date(log.weighed_at));
    latestByDate.set(dateKey, log);
  }
  
  // Convert map to array and sort by date_key
  return Array.from(latestByDate.entries())
    .map(([date_key, log]) => ({
      date_key,
      weighed_at: log.weighed_at,
      weight_lb: log.weight_lb ?? null,
      id: log.id,
      body_fat_percent: log.body_fat_percent ?? null,
    }))
    .sort((a, b) => a.date_key.localeCompare(b.date_key));
}
```

### Key Characteristics

1. **Time Complexity**: O(n) single pass
2. **Input**: Assumes `rawLogs` are sorted ascending by `weighed_at` (from database)
3. **Day Boundary**: Uses local timezone via `getLocalDateKey()` - ensures consistent day boundaries regardless of user's timezone
4. **Latest Selection**: When multiple entries exist on the same day, the latest one (by `weighed_at` timestamp) is selected
5. **Output**: Sorted by `date_key` ascending

### Example

Given these raw logs:
```
2026-01-15 08:00 UTC → 150 lbs
2026-01-15 18:00 UTC → 151 lbs (latest on this day)
2026-01-16 10:00 UTC → 152 lbs
```

The derived structure becomes:
```
date_key: "2026-01-15", weight_lb: 151, id: <id of 18:00 entry>
date_key: "2026-01-16", weight_lb: 152, id: <id of 10:00 entry>
```

---

## React Query Hooks

### useWeightLogs366d()

**File**: `hooks/use-weight-logs.ts`

The primary hook for fetching 366 days of weight logs with persistent caching:

```typescript
export function useWeightLogs366d() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  
  const cacheKey = userId ? `weightLogs366d:${userId}` : null;
  const snapshot = cacheKey !== null
    ? getPersistentCache<WeightLogRow[]>(cacheKey, THREE_HUNDRED_SIXTY_SIX_DAYS_MS)
    : null;
  
  return useQuery<WeightLogRow[]>({
    queryKey: ['weightLogs366d', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const data = await fetchWeightLogs366d(userId);
      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }
      return data;
    },
    enabled: !!userId,
    staleTime: Infinity, // Rely on explicit invalidation
    gcTime: THREE_HUNDRED_SIXTY_SIX_DAYS_MS,
    placeholderData: (previous) => {
      if (previous !== undefined) return previous;
      const cached = queryClient.getQueryData<WeightLogRow[]>(['weightLogs366d', userId]);
      if (cached !== undefined) return cached;
      return snapshot ?? undefined;
    },
  });
}
```

**Key Features**:
- **Query Key**: `['weightLogs366d', userId]`
- **Stale Time**: `Infinity` - data never goes stale automatically; relies on explicit invalidation after mutations
- **Garbage Collection Time**: 366 days (matches data window)
- **Placeholder Data Strategy**: 
  1. Previous query data (if available)
  2. In-memory React Query cache
  3. Persistent cache snapshot (from localStorage/AsyncStorage)
- **Persistent Cache**: Automatically saves to persistent storage after fetch

### useWeightHomeData()

Hook for list views that provides daily weight data with carry-forward logic:

```typescript
export function useWeightHomeData(rangeDays: number = 7, rangeEndDate?: Date) {
  // Fetches weight logs for the requested range (with 14-day minimum window for carry-forward)
  // Derives daily_latest_weight internally
  // Applies carry-forward logic (shows last known weight for days without entries)
  // Returns WeightDay[] with metadata
}
```

**Returns**:
```typescript
{
  days: WeightDay[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

### useSaveWeightEntry()

Mutation hook for creating/updating weight entries:

```typescript
export function useSaveWeightEntry() {
  return useMutation({
    mutationFn: async (input: SaveWeightInput) => {
      // Insert or update weight log
      // Update user profile if this is the latest entry
      // Return saved entry
    },
    onSuccess: async (saved, variables) => {
      // Refresh burned calories cache (best-effort, non-blocking)
      // Invalidate all weight-related queries
      queryClient.invalidateQueries({ queryKey: ['weightLogs366d', user.id] });
      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
      // ... other invalidations
    },
  });
}
```

---

## Persistent Caching

### Overview

Persistent caching provides instant UI rendering by storing data in browser localStorage (web) or AsyncStorage (native). This eliminates perceived loading time when users return to the app or switch between date ranges.

**File**: `lib/persistentCache.ts`

### How It Works

1. **Storage Layer**: 
   - Web: `localStorage`
   - Native: `AsyncStorage` (to be implemented)
   - Key prefix: `fitbud_cache_v1:`

2. **Cache Entry Structure**:
   ```typescript
   type CacheEntry<T> = {
     data: T;
     savedAt: number; // Timestamp in milliseconds
   };
   ```

3. **TTL (Time To Live)**:
   - Default: 180 days
   - For 366-day weight logs: 366 days (matches data window)
   - Expired entries are automatically ignored

4. **API**:
   ```typescript
   // Save to persistent cache
   setPersistentCache<T>(key: string, data: T): void
   
   // Load from persistent cache
   getPersistentCache<T>(key: string, maxAgeMs?: number): T | null
   ```

### Integration with React Query

Persistent cache works seamlessly with React Query through the `placeholderData` option:

```typescript
placeholderData: (previous) => {
  // 1. Check if we have previous query data (React Query in-memory cache)
  if (previous !== undefined) return previous;
  
  // 2. Check React Query cache directly
  const cached = queryClient.getQueryData<T>(queryKey);
  if (cached !== undefined) return cached;
  
  // 3. Load from persistent cache (localStorage/AsyncStorage)
  const snapshot = getPersistentCache<T>(cacheKey, maxAgeMs);
  return snapshot ?? undefined;
}
```

### Benefits

1. **Instant Rendering**: UI shows cached data immediately while fresh data loads in background
2. **Offline Support**: Users can view cached data even without network
3. **Reduced Database Load**: Fewer queries when data hasn't changed
4. **Smooth UX**: No loading spinners when switching date ranges (if data is cached)

### Cache Keys

- Weight logs (366d): `weightLogs366d:${userId}`
- Weight logs (range): `weightLogs:${userId}:${startISO}:${endISO}`

---

## Data Flow and Architecture

### High-Level Flow

```
User Action (e.g., view chart)
    ↓
React Component calls hook (useWeightLogs366d)
    ↓
Hook checks placeholder data (previous → cache → persistent)
    ↓
If no placeholder, show loading state
    ↓
Fetch from database (fetchWeightLogs366d)
    ↓
Save to persistent cache (setPersistentCache)
    ↓
Return data to component
    ↓
Component derives daily_latest_weight (deriveDailyLatestWeight)
    ↓
Render chart/list with derived data
```

### Mutation Flow

```
User saves weight entry
    ↓
useSaveWeightEntry mutation
    ↓
Insert/update in database
    ↓
Update user profile (if latest entry)
    ↓
Refresh burned calories cache (async, non-blocking)
    ↓
Invalidate React Query cache (weightLogs366d, etc.)
    ↓
Components automatically refetch (React Query)
    ↓
UI updates with fresh data
```

### Chart Rendering Flow

```
Chart component calls useWeightLogs366d()
    ↓
Receives raw WeightLogRow[] (366 days)
    ↓
Derives daily_latest_weight using deriveDailyLatestWeight()
    ↓
Filters to selected range (7d, 1m, 3m, 6m, 1y)
    ↓
Converts units (lbs ↔ kg) based on user preference
    ↓
Handles missing days (gaps in chart, no interpolation)
    ↓
Renders SVG chart with data points
```

---

## Key Algorithms

### 1. Daily Latest Selection

**Problem**: Multiple weigh-ins may exist on the same day. Which one to use?

**Solution**: Always use the latest (most recent timestamp).

**Implementation**: Single-pass map where later entries overwrite earlier ones for the same date key.

### 2. Carry-Forward Logic (List Views)

**Problem**: Users want to see weight continuity even on days without entries.

**Solution**: For list views (not charts), show the last known weight for days without entries (only after the first-ever weigh-in date).

**Implementation**: 
- Iterate days in chronological order
- Track `lastKnownWeight`
- If day has entry, use it and update `lastKnownWeight`
- If day has no entry AND we're past the first entry date, use `lastKnownWeight`
- Mark as `carriedForward: true` for UI display

### 3. Timezone Handling

**Problem**: Database stores UTC timestamps, but users think in local time.

**Solution**: All day boundaries use local timezone via `getLocalDateKey()`.

**Key Function**:
```typescript
function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

This ensures that a weigh-in at `2026-01-16 02:00 UTC` (which might be `2026-01-15 21:00 PST`) correctly maps to the local date key based on the user's timezone.

### 4. Chart Data Preparation

**Problem**: Charts need numeric values, but days may have no weight entries.

**Solution**: 
- Use `null` or `NaN` for missing days
- Filter out non-numeric values before computing min/max
- Only render chart if at least 2 data points exist
- Render gaps in chart (no interpolation)

---

## Performance Optimizations

### 1. Database Index

Composite index `(user_id, weighed_at)` optimizes the primary query pattern.

### 2. Bounded Fetch Window

Fetching only 366 days (instead of all history) ensures:
- Predictable query performance
- Bounded memory usage
- Fast database queries

### 3. Persistent Caching

- Eliminates redundant database queries
- Provides instant UI rendering
- Reduces perceived latency

### 4. Memoization

- `deriveDailyLatestWeight()` is called in `useMemo` hooks
- Only recomputes when raw data changes
- Prevents unnecessary re-derivations

### 5. React Query Optimizations

- `staleTime: Infinity` prevents unnecessary refetches
- Explicit invalidation ensures data freshness after mutations
- `placeholderData` provides instant rendering from cache
- `gcTime` matches data window (366 days)

### 6. Chart Rendering

- Filters out `NaN` values before computing bounds
- Early return if insufficient data points
- Only renders valid data points (no invalid SVG paths)

---

## Testing

### Test Files

1. **`lib/derive/daily-latest-weight.test.ts`** (8 tests)
   - Tests the core derivation algorithm
   - Covers edge cases (empty input, multiple entries per day, timezone boundaries)
   - Validates sorting and data structure

2. **`lib/utils/weight-helpers.test.ts`** (9 tests)
   - Tests helper functions (`getLatestWeightEntry`, `getLatestBodyFatEntry`)
   - Covers filtering logic and null handling

### Test Coverage

- **Core Logic**: Derivation algorithm thoroughly tested
- **Edge Cases**: Empty arrays, null values, timezone boundaries
- **Complex Scenarios**: Multiple entries per day, multi-day scenarios
- **Helper Functions**: Latest entry selection, body fat filtering

### Running Tests

```bash
npm test
```

All tests use Vitest and follow existing test patterns in the codebase.

---

## Key Design Decisions

### 1. "Latest Per Day" as Single Definition

**Decision**: Use "latest weigh-in per day" as the single definition of daily weight everywhere.

**Rationale**: 
- Eliminates confusion between charts (which used averages) and lists (which used latest)
- Provides consistent user experience
- Simpler mental model for users

### 2. In-Memory Derivation (Not DB Table)

**Decision**: `daily_latest_weight` is computed in application code, not stored as a database table.

**Rationale**:
- Flexibility to change derivation logic without migrations
- No data sync issues
- Can be cached efficiently
- Future-proof (can materialize to DB later if needed)

### 3. 366-Day Fetch Window

**Decision**: Fetch exactly 366 days of data (1 year + 1 day for leap years).

**Rationale**:
- Supports annual charts
- Bounded query performance
- Predictable memory usage
- Index-optimized query pattern

### 4. Persistent Cache with 366-Day TTL

**Decision**: Cache weight logs for 366 days (matches data window).

**Rationale**:
- Cache lifetime matches data lifetime
- Reduces redundant fetches
- Provides offline viewing capability

### 5. Explicit Cache Invalidation

**Decision**: Use `staleTime: Infinity` and explicitly invalidate after mutations.

**Rationale**:
- Prevents unnecessary refetches
- Ensures data freshness after user actions
- More predictable cache behavior

---

## File Structure

```
calorie-tracker/
├── lib/
│   ├── derive/
│   │   └── daily-latest-weight.ts          # Derivation algorithm
│   ├── services/
│   │   └── weightLogs.ts                   # Database access layer
│   └── persistentCache.ts                  # Persistent caching utilities
├── hooks/
│   ├── use-weight-logs.ts                  # React Query hooks
│   └── useDeleteWeightLog.ts               # Delete mutation hook
├── app/(tabs)/weight/
│   ├── index.tsx                           # Chart view
│   ├── day.tsx                             # Day detail view
│   └── entry.tsx                           # Entry form
└── supabase-weight-log-index.sql           # Database index

Tests:
├── lib/derive/daily-latest-weight.test.ts
└── lib/utils/weight-helpers.test.ts
```

---

## Summary

The Weight Tracking module implements a robust, performant weight tracking system with:

- **Unified Data Model**: Single "latest per day" definition across all views
- **Efficient Data Fetching**: Bounded 366-day window with database indexing
- **Persistent Caching**: Instant UI rendering with localStorage/AsyncStorage
- **React Query Integration**: Optimized caching and invalidation strategies
- **Timezone-Aware**: Consistent local day boundaries
- **Well-Tested**: Comprehensive test coverage for core algorithms
- **Performance-Optimized**: Indexes, memoization, and efficient algorithms

The architecture balances performance, user experience, and code maintainability while providing a solid foundation for future enhancements.

