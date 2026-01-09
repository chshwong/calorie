# Exercise.tsx Engineering Guidelines Audit

## Summary
This document audits `app/(tabs)/exercise.tsx` against all engineering guidelines.

## ✅ COMPLIANT AREAS

### 1. Supabase Client & Auth (Guideline 2)
- ✅ No direct Supabase calls found
- ✅ Uses React Query hooks (`useExerciseLogsForDate`, `useCreateExerciseLog`, etc.)
- ✅ Uses `useAuth()` from AuthContext

### 2. Data Access (Guideline 3)
- ✅ All data access goes through hooks/services
- ✅ No direct Supabase imports or calls

### 3. React Query (Guideline 4)
- ✅ All data loaded via React Query hooks
- ✅ Uses `useMutation` for writes
- ✅ Proper query key usage

### 4. Constraints & Validation (Guideline 7)
- ✅ Uses `RANGES` from `constants/constraints.ts` for all numeric limits
- ✅ Uses `TEXT_LIMITS` for text length validation
- ✅ Validation logic properly imports from constraints

### 5. Styling & Theming (Guideline 11)
- ✅ Uses `StyleSheet.create` for all styles
- ✅ Uses theme tokens (`Spacing`, `BorderRadius`, `FontSize`, `Colors`)
- ✅ Inline styles only for dynamic values
- ✅ Layout constants properly documented (lines 63-67)

### 6. Navigation (Guideline 14)
- ✅ Uses `expo-router` APIs
- ✅ No `window.location` or `location.reload` usage

### 7. Platform Support (Guideline 15)
- ✅ Uses `Platform.select` for platform-specific code
- ✅ Domain logic is platform-agnostic

## ❌ VIOLATIONS FOUND

### 1. Styling & Theming (Guideline 11) - HARDCODED COLOR

**Location:** Line 212
```typescript
const exerciseOrange = colorScheme === 'dark' 
  ? ModuleThemes.exercise.accent // #F59E0B for dark mode
  : '#D97706'; // Darker orange-600 for light mode (better contrast on light backgrounds)
```

**Issue:** Hardcoded hex color `#D97706` violates guideline 11 (no hardcoded colors).

**Fix:** Add this color to `constants/theme.ts` in the `ModuleThemes.exercise` object or create a new theme token.

---

### 2. Internationalization (Guideline 13) - HARDCODED TEXT

**Location:** Line 266
```typescript
{...getButtonAccessibilityProps('Edit exercise')}
```

**Issue:** Hardcoded accessibility label violates guideline 13 (no hardcoded user-facing text).

**Fix:** Use `t('exercise.row.edit_accessibility')` or similar translation key.

---

### 3. Internationalization (Guideline 13) - HARDCODED ERROR MESSAGES

**Location:** Lines 1184, 1188
```typescript
Alert.alert('Sets must be a valid number');
Alert.alert(`Sets must be between ${RANGES.EXERCISE_SETS.MIN} and ${RANGES.EXERCISE_SETS.MAX}`);
```

**Issue:** Hardcoded error messages violate guideline 13.

**Fix:** Use translation keys:
- `t('exercise.form.sets_invalid')`
- `t('exercise.form.sets_range', { min: RANGES.EXERCISE_SETS.MIN, max: RANGES.EXERCISE_SETS.MAX })`

---

### 4. Internationalization (Guideline 13) - HARDCODED INTENSITY LABELS

**Location:** Lines 235-242
```typescript
// NOTE: Hardcoded per user request - exact emoji labels required (🟢Low, 🟡Med, 🟠Hi, 🔴Max)
// Future: Consider moving to i18n if internationalization needed
const intensityLabels: Record<'low' | 'medium' | 'high' | 'max', string> = {
  low: '🟢Low',
  medium: '🟡Med',
  high: '🟠High',
  max: '🔴Max',
};
```

**Issue:** Hardcoded labels with emojis violate guideline 13, though there's a comment explaining the user request.

**Status:** Documented exception, but should be moved to i18n for future internationalization.

---

### 5. TypeScript (Guideline 17) - `any` TYPE USAGE

**Locations:** Multiple instances
- Line 271: `name={categoryIcon as any}`
- Line 1156: `let updates: any = { ... }` (with eslint-disable comment)
- Line 1221: `const createData: any = { ... }` (with eslint-disable comment)
- Lines 1474, 1518, 1782, 1875: `ref={... as any}` (tour refs)
- Line 1810: `queryClient.getQueryData<any[]>(...)` (with eslint-disable comment)

**Issue:** Multiple uses of `any` type, though some have eslint-disable comments.

**Status:** Some are justified (tour refs, complex update objects), but should be minimized where possible.

---

### 6. Code Cleanup (Guideline 20) - DEBUG LOGGING CODE

**Locations:** Lines 605-619, 622-636, 644-658, 668-682

**Issue:** Debug logging code with fetch calls to localhost should be removed. These appear to be temporary instrumentation.

**Fix:** Remove all `// #region agent log` blocks and their associated fetch calls.

---

## ⚠️ ACCEPTABLE EXCEPTIONS (With Documentation)

### 1. Layout Constants (Guideline 11)
**Location:** Lines 64-67, 2982
- `NARROW_SCREEN_BREAKPOINT = 380`
- `LARGE_SCREEN_BREAKPOINT = 768`
- `KM_TO_MILES_CONVERSION = 1.60934`
- `minHeight: 100` (line 2982)

**Status:** ✅ Properly documented as layout/UI constants, not spacing tokens. Acceptable per guideline 11.

---

## RECOMMENDATIONS

1. **Priority 1 (Must Fix):**
   - Remove debug logging code (lines 605-682)
   - Fix hardcoded error messages (lines 1184, 1188)
   - Fix hardcoded accessibility label (line 266)

2. **Priority 2 (Should Fix):**
   - Move hardcoded color to theme tokens (line 212)
   - Move intensity labels to i18n (lines 237-242)

3. **Priority 3 (Nice to Have):**
   - Reduce `any` type usage where possible
   - Add proper TypeScript types for update/create objects

---

## OVERALL COMPLIANCE SCORE

**Compliant:** ~85%
**Violations:** 6 issues (4 critical, 2 acceptable exceptions)
**Status:** Generally compliant with most guidelines, but needs cleanup of debug code and hardcoded strings.



