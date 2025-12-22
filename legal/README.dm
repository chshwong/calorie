# Legal Documents

Source-of-truth legal text lives in this folder.

## Structure
- `/legal/en/` is the authoritative English source.
- Other locales (e.g. `/legal/fr/`, `/legal/zh/`) will be added later.

## Files per locale
- `terms-of-service.md`
- `privacy-policy.md`
- `health-medical-disclaimer.md`

## Versioning
When legal text changes, bump the version stored in the database and require re-acceptance.
Do not edit old versions in-place once published.

## Updating Legal Documents (Operations Runbook)

This app stores legal documents in two places:
1) Source-of-truth Markdown files in this repo: `/legal/<locale>/...`
2) Versioned rows in Supabase `legal_documents` (what the app reads)



-----------------------------------------------------------------------------------------
When updating legal text, NEVER edit an already-published version in place. Always create a new version and require re-acceptance.

### Step-by-step (English first)

1. **Edit the Markdown files**
   - Update one or more of:
     - `/legal/en/terms-of-service.md`
     - `/legal/en/privacy-policy.md`
     - `/legal/en/health-medical-disclaimer.md`

2. **Choose a new version**
   - Pick a new version string (recommended: `YYYY-MM-DD`, e.g. `2026-03-15`)
   - Use the same version for all three docs unless you have a reason to split versions.

3. **Update the seed script version**
   - In `scripts/seed-legal-docs.ts`, change:
     - `const version = '...'`
     - to the new version string.

4. **Seed Supabase**
   - Run:
     - `npm run seed:legal`
   - Result:
     - The script sets previous active docs to `is_active=false`
     - Inserts the new docs with `is_active=true`

5. **Verify in Supabase**
   - Confirm `legal_documents` has:
     - 3 rows with `is_active=true`
     - the new `version`
   - Optional SQL check:
     - `select doc_type, version, is_active from legal_documents order by doc_type;`

6. **Force re-acceptance (automatic)**
   - Users must accept the latest active versions.
   - The app should check at app start (or onboarding entry) whether the user has acceptance rows for the current active `version` of each doc type.
   - If not accepted, redirect to the Legal Agreement screen.

### Notes
- Keep older versions in Supabase for audit/history.
- Never store the service role key in Vercel or client builds.
- Translations:
  - Update `/legal/en` first.
  - Later copy to `/legal/<locale>` and seed translated versions when you add locale support.
