## Web-wrapped onboarding plan

Overview: Make native onboarding route redirect to a dedicated WebView wrapper (`/web-onboarding`) while keeping Login as the only true-native screen. Preserve existing iOS/Android safe-area + status bar behavior and keep web `/login` + `/auth` blocked from ever rendering inside the wrapper.

## Context from repo

- Native wrapper WebView lives at [`apps/native/app/web.tsx`](../apps/native/app/web.tsx) and already enforces:
  - unauthenticated users can’t access `/web` (redirects to `/post-login-gate`)
  - `isBlockedPath()` prevents loading `"/login"`, `"/auth"`, and `"/onboarding"` (see [`apps/native/lib/webWrapper/webConfig.ts`](../apps/native/lib/webWrapper/webConfig.ts))
- Post-login routing is centralized in [`apps/native/app/post-login-gate.tsx`](../apps/native/app/post-login-gate.tsx):
  - `onboardingComplete === false` currently redirects to native `/onboarding`
- Web onboarding exists at [`app/onboarding.tsx`](../app/onboarding.tsx) and currently blocks running inside the wrapper when `(window as any).__AVOVIBE_CONTAINER__?.type === 'native'`.

## Implementation approach

### 1) Add dedicated native route: `/web-onboarding`

- Create [`apps/native/app/web-onboarding.tsx`](../apps/native/app/web-onboarding.tsx).
- It renders the same wrapped WebView as `/web`, but forces `initialPath="/onboarding"` and enables onboarding paths.
- **MUST** set the injected container type to `"native_onboarding"` (wrapper-only) so the web onboarding screen doesn’t trip its current `type === "native"` block.
- **Injection requirement (non-optional)**:
  - `/web` continues to inject: `window.__AVOVIBE_CONTAINER__ = { type: "native", platform: ... }`
  - `/web-onboarding` **MUST** inject: `window.__AVOVIBE_CONTAINER__ = { type: "native_onboarding", platform: ... }`

### 2) Refactor `apps/native/app/web.tsx` into a reusable component

- Extract most of `WebWrapperScreen` into an exported component, e.g.:
  - `export function WrappedWebView({ initialPath, allowOnboardingPaths, containerType }: {...})`
- Keep default export for `/web` behaving exactly as today:
  - initial path sourced from `?path=` param (existing `coercePathParam`)
  - `allowOnboardingPaths=false`
  - `containerType="native"`
- **SafeArea / StatusBar (single authoritative rule block; regression-sensitive)**:
  - **Android StatusBar is controlled in the native wrapper**. Keep it `translucent={false}` (do not “edge-to-edge” it), otherwise we risk unreadable status bar / top-gap regressions.
  - Use `SafeAreaView` `edges={["top"]}` on **both iOS and Android** (no platform conditional).
  - Bottom padding continues to be handled manually via `insets.bottom` (as per the current wrapper).
  - Do **not** reintroduce safe-area top padding in the **web header** when running inside the native wrapper; keep prior web-only safe-area-top disable intact.

#### Implementation choice (risk reduction)

- Either:
  - refactor the WebView wrapper into a shared component used by both `/web` and `/web-onboarding`, **or**
  - duplicate the minimal wrapper screen code to add `/web-onboarding` with as little touch to proven wrapper logic as possible.
- Prefer the **lowest-risk option** (minimal duplication) if a refactor would touch lots of wrapper logic (guards, injected JS, StatusBar/SafeArea behavior).

### 3) Allow onboarding paths only for `/web-onboarding`

- Update [`apps/native/lib/webWrapper/webConfig.ts`](../apps/native/lib/webWrapper/webConfig.ts) so `isBlockedPath()` can optionally allow onboarding:
  - keep `"/login"` and `"/auth"` ALWAYS blocked
  - treat `"/onboarding"` as blocked unless `{ allowOnboardingPaths: true }` is provided
- Update `apps/native/app/web.tsx` WebView guards to call `isBlockedPath(path, { allowOnboardingPaths })` in both places:
  - the initial guard on `requestedPath`
  - `onShouldStartLoadWithRequest` navigation interception

### 4) Redirect native onboarding route to the new wrapper route

- Replace the native onboarding UI with an immediate redirect in [`apps/native/app/onboarding.tsx`](../apps/native/app/onboarding.tsx):
  - `export default function Onboarding() { return <Redirect href="/web-onboarding" />; }`
- This preserves legacy deep links to `/onboarding` while ensuring onboarding is now web-wrapped.

### 5) Update post-login routing

- Update [`apps/native/app/post-login-gate.tsx`](../apps/native/app/post-login-gate.tsx):
  - change `onboardingComplete === false` from `"/onboarding"` → `"/web-onboarding"`
- Keep “returning users” behavior unchanged (`/web?path=DEFAULT_WEB_PATH`).

### 6) Keep "native must never show web login" enforced

- Do not relax `/login` or `/auth` WebView blocking.
- Keep the existing behavior in `onShouldStartLoadWithRequest`:
  - if web tries `/login` or `/auth` and native has a session, send native session and block navigation
  - otherwise bounce to native `/login`

### 7) Web-side wrapper auth bridge: recognize `native_onboarding`

- Minimal wrapper-only change in [`lib/nativeWrapperAuth.ts`](../lib/nativeWrapperAuth.ts):
  - broaden `isNativeWrapperRuntime()` from `container.type === "native"` to allow `"native" | "native_onboarding"` (or `type.startsWith("native")`).
- This keeps pure web behavior unchanged (this code is a no-op unless `__AVOVIBE_CONTAINER__` is present).

### 8) Wire the new route into native stack

- Update [`apps/native/app/_layout.tsx`](../apps/native/app/_layout.tsx) to add `Stack.Screen name="web-onboarding"`.

## Acceptance checks (manual)

- Fresh user: native app → native `/login` → `/web-onboarding` loads `/onboarding` (wrapped) → completes onboarding → lands in wrapped app (no web login UI).
- Returning user: native `/login` → `/post-login-gate` → `/web`.
- Safety: in both wrappers, attempts to load web `/login` or `/auth` never render; off-origin opens externally.
- Hard failure: if `/web-onboarding` injects `type="native"` by mistake, web onboarding will remain blocked — treat this as a test failure.
- Android status bar readability unchanged; iOS safe-area behavior unchanged.
