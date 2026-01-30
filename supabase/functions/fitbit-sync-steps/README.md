# fitbit-sync-steps

Edge Function that syncs Fitbit steps into `daily_sum_exercises` for the last 7 days. Used when the user taps **Sync** on the Dashboard or Exercise screen (when steps sync is enabled).

## CORS

If you see a browser error like:

> Access to fetch at '.../fitbit-sync-steps' from origin 'http://localhost:8081' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: It does not have HTTP ok status.

then the **preflight (OPTIONS) request is not getting a 2xx response**. Common causes:

1. **Function not deployed** – The function must be deployed to your Supabase project so the gateway invokes it. Otherwise the gateway returns 404/502 and those responses do not include CORS headers.
2. **Runtime error before OPTIONS handler** – If the function crashes on cold start (e.g. missing env, import error), the platform may return 500 before your handler runs.

## Deploy

```bash
npx supabase functions deploy fitbit-sync-steps
```

Set required secrets (e.g. Supabase URL/keys are usually automatic; add Fitbit-related env if this function needs them via your project’s function secrets).

## Verify

After deploying, in the browser Network tab:

- OPTIONS request to `.../fitbit-sync-steps` should return **204** (or 200) with headers including `Access-Control-Allow-Origin`.
- Then the POST request can proceed.
