# Dashboard.tsx Engineering Guidelines Audit

## Summary
This document audits `app/(tabs)/dashboard.tsx` against all engineering guidelines.

## ✅ COMPLIANT AREAS

### 1. Supabase Client & Auth (Guideline 2)
- ✅ No direct Supabase calls found
- ✅ Uses React Query hooks (`useDailyFoodSummary`, `useWeeklyCalInVsOut`, etc.)
- ✅ Uses `useAuth()` from AuthContext

### 2. Data Access (Guideline 3)
- ✅ All data access goes through hooks/services
- ✅ No direct Supabase imports or calls

### 3. React Query (Guideline 4)
- ✅ All data loaded via React Query hooks
- ✅ Proper query key usage

### 4. Constraints & Validation (Guideline 7)
- ✅ No hardcoded numeric limits found
- ✅ Uses theme tokens for styling

### 5. Styling & Theming (Guideline 11)
- ✅ Uses `StyleSheet.create` for all styles
- ✅ Uses theme tokens (`Spacing`, `BorderRadius`, `FontSize`, `Colors`)
- ✅ Inline styles only for dynamic values

### 6. Navigation (Guideline 14)
- ✅ Uses `expo-router` APIs
- ✅ No `window.location` or `location.reload` usage

### 7. Platform Support (Guideline 15)
- ✅ Uses `Platform.OS` checks for platform-specific code
- ✅ Domain logic is platform-agnostic

### 8. Accessibility
- ✅ Uses `getButtonAccessibilityProps` and `getMinTouchTargetStyle`
- ✅ Proper accessibility labels and hints

## ❌ VIOLATIONS FOUND

### 1. Performance - Unused Variables

**Location:** Multiple locations

**Issues:**
- Line 60: `userConfig` in `DashboardFoodSection` is declared but never used
- Line 208: `userConfig` in `DashboardExerciseSection` is declared but never used  
- Line 688: `weeklyFood` in `DashboardScreen` is declared but never used

**Fix:** Remove unused variable declarations.

---

### 2. Performance - Missing Memoization

**Location:** Line 63-76 (`getGoalLabel` function in `DashboardFoodSection`)

**Issue:** Function is recreated on every render. Should be memoized with `useMemo` or `useCallback`.

**Current:**
```typescript
const getGoalLabel = () => {
  switch (goalType) {
    // ...
  }
};
```

**Fix:**
```typescript
const getGoalLabel = useMemo(() => {
  switch (goalType) {
    case 'lose':
      return t('onboarding.goal.lose_weight.label');
    // ...
  }
}, [goalType, t]);
```

---

### 3. Performance - Inline Calculations in JSX

**Location:** Lines 170-187 (Average calculation in `DashboardFoodSection`)

**Issue:** Complex calculation done inline in JSX with IIFE. Should be memoized.

**Current:**
```typescript
{weeklyCalInVsOut.data.length > 0 && (() => {
  const eatenValues = weeklyCalInVsOut.data.filter(d => d.caloriesIn > 0).map(d => d.caloriesIn);
  // ... calculations
  return <ThemedText>...</ThemedText>;
})()}
```

**Fix:** Extract to `useMemo`:
```typescript
const avgStats = useMemo(() => {
  if (weeklyCalInVsOut.data.length === 0) return null;
  const eatenValues = weeklyCalInVsOut.data.filter(d => d.caloriesIn > 0).map(d => d.caloriesIn);
  const burnedValues = weeklyCalInVsOut.data.filter(d => d.caloriesOut > 0).map(d => d.caloriesOut);
  
  const avgEaten = eatenValues.length > 0 
    ? Math.round(eatenValues.reduce((sum, val) => sum + val, 0) / eatenValues.length)
    : 0;
  const avgBurned = burnedValues.length > 0
    ? Math.round(burnedValues.reduce((sum, val) => sum + val, 0) / burnedValues.length)
    : 0;
  
  return { avgEaten, avgBurned };
}, [weeklyCalInVsOut.data]);
```

---

### 4. Performance - Date Formatting in JSX

**Location:** Lines 730-751 (Date formatting in `DashboardScreen`)

**Issue:** Complex date formatting logic runs on every render via IIFE. Should be memoized.

**Current:**
```typescript
dateText={(() => {
  const todayDate = new Date();
  // ... complex formatting logic
  return formattedDate;
})()}
```

**Fix:** Extract to `useMemo`:
```typescript
const formattedDateText = useMemo(() => {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const currentYear = todayDate.getFullYear();
  const selectedYear = selectedDate.getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  const dateOptions: Intl.DateTimeFormatOptions = {
    ...(isToday || selectedDate.getTime() === yesterday.getTime() ? {} : { weekday: 'short' }),
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  };
  const formattedDate = selectedDate.toLocaleDateString('en-US', dateOptions);
  return isToday
    ? `${t('common.today')}, ${formattedDate}`
    : selectedDate.getTime() === yesterday.getTime()
    ? `${t('common.yesterday')}, ${formattedDate}`
    : formattedDate;
}, [selectedDate, isToday, t]);
```

---

### 5. Code Organization - Unused Import

**Location:** Line 20 (`useWeeklyFoodCalories`)

**Issue:** Imported but never used (variable `weeklyFood` is declared but unused).

**Fix:** Remove unused import if not needed, or use the variable if it was intended to be used.

---

## RECOMMENDATIONS

1. **Memoize expensive calculations** - All inline calculations in JSX should be extracted to `useMemo` hooks
2. **Remove unused variables** - Clean up unused declarations to improve code clarity
3. **Memoize helper functions** - Functions that depend on props/state should use `useMemo` or `useCallback`
4. **Consider extracting complex logic** - The date formatting logic could be extracted to a utility function for reusability

## PRIORITY

- **High:** Remove unused variables (simple cleanup)
- **Medium:** Memoize calculations (performance improvement)
- **Low:** Extract date formatting utility (code organization)
