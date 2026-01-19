# Engineering Guidelines (Web + Native)

## Applicability Legend
- [ALL] = Applies to Web + Native
- [WEB] = Web only
- [NATIVE] = Native only
- [iOS] = iOS only
- [ANDROID] = Android only
- Tags may be combined, e.g. [NATIVE][ANDROID]

## Ready-to-merge Checklist (run after every batch)
- Diff is only in intended scope (e.g. apps/native/** for native work)
- No component calls Supabase directly
- One Supabase client + one AuthProvider
- React Query used for all reads; useMutation for writes
- Query keys include user_id where applicable
- No hardcoded numeric limits (constraints module only)
- Validation centralized (no inline regex/business rules)
- [NATIVE] No browser globals (window/document/localStorage)
- Loading / error / empty states handled
- Works in light and dark mode
- Accessibility basics met (labels, tap targets, no clipped text)
- Platform sanity check (iOS + Android for native; responsive for web)

---

## Shared Engineering Rules
Unless explicitly tagged otherwise below, **all rules in this document are [ALL] (Web + Native)**.

CURSOR ENGINEERING RULES (AUTHORITATIVE SUMMARY)

1. Components NEVER call Supabase directly.
   All reads/writes go through shared services or React Query hooks.

2. There is ONE Supabase client and ONE AuthProvider.

3. ALL UI data is loaded with React Query.
   - No useEffect data fetching.
   - No manual loading state for data already cached.

4. Startup-critical data (profile + ALL goals/targets) MUST:
   - be persistently cached (TTL 180 days)
   - hydrate on app startup
   - render immediately if cached
   - refetch silently in background

5. Persistent cache rules:
   - Access ONLY via lib/persistentCache.ts
   - Cache keys MUST include user_id
   - TTL defaults to 180 days
   - Cached data is never authoritative forever

6. Home and Settings MUST share the same cached profile/config query.
   No duplicate profile/goal queries allowed.

7. Writes use useMutation.
   - setQueryData immediately
   - invalidate dependent queries
   - never rely on remounts

8. All numeric limits come from constants/constraints.ts.
   All validation lives in utils/validation.ts.

9. Precomputed tables are mandatory for stats (frequent/recent, streaks).
   No historical scans.

10. UI must NEVER block rendering if cached data exists.


ENGINEERING GUIDELINES

--------------------------------------------------
1. TECH STACK FOUNDATIONS
--------------------------------------------------
Frontend: React (Expo / React Native)
Backend: Supabase (Postgres)
Data: React Query + one shared Supabase client
Auth: One AuthProvider

Rule:
All code should be refactored toward these assumptions.

--------------------------------------------------
2. SUPABASE CLIENT AND AUTH
--------------------------------------------------
• Only ONE Supabase client instance is allowed.
• [ALL] It must live in the platform’s canonical supabase client module (web: src/lib/supabaseClient.ts; native: apps/native/**/supabaseClient.ts).
• Components must never create or import Supabase clients directly.

AuthProvider:
• One AuthProvider manages all auth state.
• Exposes user and session via context.
• Navigation must not remount on auth changes.

--------------------------------------------------
3. DATA ACCESS (SINGLE SOURCE OF TRUTH)
--------------------------------------------------
• Components must NEVER call Supabase directly.
• All reads and writes go through:
  – src/services (data access)
  – src/data or shared React Query hooks
• Service functions must return typed domain objects, not raw DB rows.

SQL rules:
• Select only required columns.
• Paginate or limit any growing list.
• Avoid N+1 queries.
• Queries with filters/sorts must document required indexes.

--------------------------------------------------
4. REACT QUERY (MANDATORY)
--------------------------------------------------
4.1 Reads
• All UI data must be loaded via React Query.
• Query keys must be stable and descriptive.
• Use stale-while-revalidate.
• Default staleTime ≥ 60s.
• Default gcTime ≥ 5 minutes unless overridden.

Startup rule (IMPORTANT):
• Startup‑critical data (profile, goals, targets) MUST render from cache if available.
• UI must NOT block while cached data refetches in the background.

4.2 Writes
• All writes must use useMutation.
• On success:
  – update cache with setQueryData
  – invalidate dependent queries
• Screen remounting must never be relied upon to refresh data.

--------------------------------------------------
5. PERSISTENT CACHING (AUTHORITATIVE)
--------------------------------------------------

Storage backend (platform-specific):
• [WEB] Persistence uses browser storage (e.g. localStorage) via the approved persister.
• [NATIVE] Persistence uses AsyncStorage via the approved persister. localStorage is forbidden.
• Persistent caching is mandatory for repeatedly-read user data:
  – profile / user config (ALL goals & targets)
  – daily entries
  – water, exercise, meds
  – recent & frequent foods

Rules:
• Persistent storage must ONLY be accessed via lib/persistentCache.ts.
• Hooks must hydrate from persistent cache on startup using initialData or placeholderData.
• Persistent cache TTL defaults to 180 days.
• Any TTL override must be justified in code comments.
• Persistent cache is never authoritative forever — live DB refetch must always occur in background.
• Cache keys must include user_id and any critical parameters (e.g. date).

--------------------------------------------------
6. PROFILE & CURRENT METRIC RULES
--------------------------------------------------
• profiles.weight_lb may update only if the row is the most recent weighed_at.
• profiles.body_fat_percent may update only if it is the most recent non-null body fat entry.

--------------------------------------------------
7. CONSTRAINTS & VALIDATION (SINGLE SOURCE)
--------------------------------------------------
• [ALL] All numeric ranges, limits, and policies live in the shared constraints module.
  - web: src/constants/constraints.ts
  - native: apps/native/**/constraints.ts

• [ALL] All validation logic lives in the centralized validation module.
  - web: utils/validation.ts
  - native: apps/native/**/validation/*.ts

Rules:
• No component, hook, or service may hardcode min/max values.
• Validators must import limits exclusively from constraints.ts.
• UI formatting may be local, but numeric correctness must be enforced centrally.
• App constraints may be stricter than DB constraints, but never looser.
• Any app/DB mismatch must be documented in constraints.ts.

--------------------------------------------------
8. SHARED DATA HOOKS
--------------------------------------------------
Canonical hooks (must be reused):
• useDailyEntries
• useCustomFoods
• useBundles
• useFrequentFoods
• useRecentFoods

Rules:
• Home and mealtype-log must share cached hook results.
• Switching tabs must never trigger new DB calls.
• All tab content reads from cached data only.

--------------------------------------------------
9. PRECOMPUTED STATS
--------------------------------------------------
• Frequent & Recent foods must come from precomputed tables (e.g. user_food_stats).
• Tables must be maintained by DB triggers.

Rules:
• Frequent = order by used_count
• Recent = order by last_used_at
• No historical scans of entries.
• All future analytics (streaks, summaries) must follow this pattern.

--------------------------------------------------
10. UI COMPONENT REUSE
--------------------------------------------------
• Reusable UI components must live in components/ui.
• No UI pattern may be reimplemented if a shared component exists.
• Any pattern used more than once must be extracted.

--------------------------------------------------
11. STYLING & THEMING
--------------------------------------------------
• All styles must use StyleSheet.create.
• Inline styles allowed only for dynamic values.
• No hardcoded colors, spacing, radii, or font sizes.
• [ALL] All tokens must come from the theme system (web theme.ts / native theme/tokens.ts).

Typography:
• Inter is the global font.
• Typography tokens must be used consistently.

--------------------------------------------------
12. ANIMATIONS
--------------------------------------------------
• Existing animation components must be reused.
• Animations must NEVER depend on live database queries.

--------------------------------------------------
13. INTERNATIONALIZATION
--------------------------------------------------

Canonical English source:
• [ALL] The single source of truth for English copy is /i18n/en.json.
• [ALL] Web and Native must import from the canonical file; do not create per-platform en.json copies.
• [NATIVE] If Metro ever stops allowing import of files outside apps/native, use a native-only sync script as fallback (generated copy), and document it.
• No user-facing text may be hardcoded.
• All UI text must come from i18n/en.json via t().
• Translation files must mirror en.json structure.
• Adding new languages must not require component changes.

--------------------------------------------------
14. NAVIGATION
--------------------------------------------------
• window.location and location.reload are forbidden.
• Raw anchor tags that reload the page are forbidden.
• All navigation must use router APIs.

--------------------------------------------------
15. PLATFORM & FUTURE SUPPORT
--------------------------------------------------
• Domain logic must be platform-agnostic.
• Services must not reference browser APIs.
• All persistent storage access must be centralized.
• Shared types define all core entities.
• Date/time logic must be centralized.

--------------------------------------------------
16. TESTING
--------------------------------------------------
• Domain logic must have unit tests.
• Critical services must have integration tests.
• Jest or Vitest allowed.
• React Testing Library required for components/hooks.

--------------------------------------------------
17. TYPESCRIPT & QUALITY
--------------------------------------------------
• TypeScript strict mode is required.
• any must be justified with comments.
• Shared types live in src/types or src/domain/types.
• ESLint & Prettier must pass cleanly.

--------------------------------------------------
18. ERROR HANDLING
--------------------------------------------------
• Global error boundary required.
• Supabase errors logged in development.
• User-friendly errors must be shown.
• Sensitive data must never be logged.

--------------------------------------------------
19. SECURITY
--------------------------------------------------
• Auth tokens must not be stored or logged manually.
• PII must never be logged.
• RLS must be enabled on all tables.
• client-provided user_id must never be trusted.

--------------------------------------------------
20. MODIFYING CODE
--------------------------------------------------
Any rule violation must include:
• an inline explanation
• the intended future fix


---

## Platform-specific Addendums

### [NATIVE]
- Persistent cache uses AsyncStorage (via React Query persister). Do not use localStorage.
- Browser globals are forbidden: window, document, location, localStorage.
- Core branding assets must live under apps/native/assets/** and be imported via require().
- Do not import or reuse web SVG assets directly in native.
- Date inputs (e.g. DOB) must use native pickers (Expo-supported).
- OAuth callbacks must use deep links / app scheme (Expo Router), never browser redirects.
- Permissions (camera, photos, notifications) must be handled via centralized wrappers.

### [WEB]
- DOM- and browser-dependent APIs (localStorage, cookies, IP-based region detection) are web-only.
- Web-specific routing (URL params, query strings) must not leak into native assumptions.

### [iOS]
- Apple-only auth (e.g. Sign in with Apple) must be isolated and optional.
- iOS-specific UI or permissions must not block Android builds.

### [ANDROID]
- Android back-button behavior must be centralized; no ad-hoc handling in screens.
- Notification channels (when added) must be defined explicitly.
