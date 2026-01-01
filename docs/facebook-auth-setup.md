# Facebook OAuth setup (Supabase + Vercel web)

This project uses Supabase OAuth redirects for Facebook/Google on the web.

## 1) Supabase settings

In your Supabase project dashboard:

1. Go to **Authentication → Providers** and enable **Facebook**.
2. Set **Site URL** to your Vercel production origin (example: `https://yourdomain.com`).
3. Add **Redirect URLs**:
   - `https://yourdomain.com/auth/callback`
   - `http://localhost:8081/auth/callback` (or your local Expo web dev origin)
4. Identity linking configuration:
   - Disable **automatic identity linking by email** (so users cannot silently create/merge accounts across providers).
   - Enable **manual linking** (required for `supabase.auth.linkIdentity`).

## 2) Facebook developer console

In your Facebook App settings:

- Add the same callback URLs as valid OAuth redirect URIs:
  - `https://yourdomain.com/auth/callback`
  - `http://localhost:8081/auth/callback`

## 3) App env flag

Set this environment variable so the Facebook button is enabled:

- `EXPO_PUBLIC_FACEBOOK_ENABLED=true`


