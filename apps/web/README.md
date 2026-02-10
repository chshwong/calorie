# AvoVibe Marketing / SEO (Next.js)

Next.js app for AvoVibe public and SEO: marketing pages, trust pages, programmatic landing pages, robots, sitemaps, and OG images. The Expo app remains the logged-in product; app routes are rewritten to the SPA when `SPA_ORIGIN` is set.

## Route ownership

- **Next.js (this app)** owns: `/`, `/calorie-tracker`, `/macro-tracker`, `/protein-tracker`, `/fiber-tracker`, `/water-tracker`, `/about`, `/contact`, `/privacy`, `/terms`, `/security`, `/p/*`, `/robots.txt`, `/sitemap.xml`, `/sitemap-*.xml`, and OG/Twitter image routes.
- **Expo SPA** owns: `/login`, `/signup`, `/auth/*`, `/onboarding/*`, `/settings/*`, tab and logged-in routes, `/legal/*`, etc.

## Setup

```bash
npm install
npm run dev
```

## Environment

- **`SPA_ORIGIN`** or **`NEXT_PUBLIC_SPA_ORIGIN`**: Full URL of the Expo SPA (e.g. `https://avovibe-app.vercel.app`). When set, app routes (login, auth, onboarding, settings, etc.) are rewritten to this origin. Leave unset for local dev without rewrites.
- **`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`**: Optional Google Search Console meta tag value.
- **`NEXT_PUBLIC_BING_SITE_VERIFICATION`**: Optional Bing Webmaster Tools meta tag value.
- **`NEXT_PUBLIC_SUPPORT_EMAIL`**: Contact email (default: avovibeapp@gmail.com).

## Deployment (Vercel)

1. Create a Vercel project with **Root Directory** = `apps/web` (or deploy from this directory).
2. Set **SPA_ORIGIN** to the URL of your deployed Expo app so app routes rewrite correctly.
3. Point the production domain (e.g. `avovibe.app`) to this Next.js project.
4. Keep the Expo app deployed separately (e.g. same repo with Root Directory = `.` for a second project, or a subdomain).

## QA checklist

- Visit `/`, `/calorie-tracker`, `/about`, `/privacy`, `/terms`.
- Visit `/robots.txt` and `/sitemap.xml`; open each sitemap part and confirm XML and absolute URLs.
- View page source on a marketing page: confirm canonical, OG/Twitter meta, and JSON-LD.
- If SPA_ORIGIN is set, visit `/login` and confirm it rewrites to the SPA; test auth callback.

## Search console

- **Google**: Add property for `https://avovibe.app`, verify (meta tag or DNS), submit sitemap `https://avovibe.app/sitemap.xml`.
- **Bing**: Add site in Bing Webmaster Tools, verify, submit sitemap.
