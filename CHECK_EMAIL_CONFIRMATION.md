# Important: Check Email Confirmation Settings

The RLS error might be happening because **email confirmation is enabled** in Supabase, which means users aren't fully authenticated immediately after signup.

## To Fix:

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Find **"Enable email confirmations"**
3. **Turn it OFF** (for development/testing)
4. Save the settings

## Why This Matters:

When email confirmation is enabled:
- Users sign up but aren't authenticated until they confirm their email
- RLS policies that require `authenticated` role will fail
- The profile insert will be blocked by RLS

After disabling email confirmation, users will be authenticated immediately after signup, and the RLS policies will work correctly.

