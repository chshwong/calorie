/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only rewrite app routes (Expo SPA) to SPA_ORIGIN. Next owns marketing/SEO routes.
  async rewrites() {
    const spaOrigin = process.env.SPA_ORIGIN || process.env.NEXT_PUBLIC_SPA_ORIGIN;
    if (!spaOrigin) return [];
    const base = spaOrigin.replace(/\/$/, '');
    return [
      { source: '/login', destination: `${base}/login` },
      { source: '/signup', destination: `${base}/signup` },
      { source: '/auth/:path*', destination: `${base}/auth/:path*` },
      { source: '/onboarding/:path*', destination: `${base}/onboarding/:path*` },
      { source: '/settings/:path*', destination: `${base}/settings/:path*` },
      { source: '/account/:path*', destination: `${base}/account/:path*` },
      { source: '/app/:path*', destination: `${base}/app/:path*` },
      { source: '/legal/:path*', destination: `${base}/legal/:path*` },
      { source: '/inbox/:path*', destination: `${base}/inbox/:path*` },
      { source: '/support/:path*', destination: `${base}/support/:path*` },
      { source: '/data-deletion', destination: `${base}/data-deletion` },
      { source: '/post-login-gate', destination: `${base}/post-login-gate` },
      // Tab and logged-in routes (Expo router paths)
      { source: '/mealtype-log', destination: `${base}/mealtype-log` },
      { source: '/mealtype-log-screen', destination: `${base}/mealtype-log-screen` },
      { source: '/quick-log', destination: `${base}/quick-log` },
      { source: '/create-custom-food', destination: `${base}/create-custom-food` },
      { source: '/create-bundle', destination: `${base}/create-bundle` },
      { source: '/merge-food', destination: `${base}/merge-food` },
      { source: '/food-edit', destination: `${base}/food-edit` },
      { source: '/scanned-item', destination: `${base}/scanned-item` },
      { source: '/my-goals', destination: `${base}/my-goals` },
      { source: '/edit-profile', destination: `${base}/edit-profile` },
      { source: '/user-360', destination: `${base}/user-360` },
      { source: '/admin-page', destination: `${base}/admin-page` },
      { source: '/external-cache-food-promotion', destination: `${base}/external-cache-food-promotion` },
      { source: '/modal', destination: `${base}/modal` },
      // (tabs) routes - Expo uses segments like /(tabs)/dashboard
      { source: '/dashboard', destination: `${base}/dashboard` },
      { source: '/exercise', destination: `${base}/exercise` },
      { source: '/exercise/settings', destination: `${base}/exercise/settings` },
      { source: '/explore', destination: `${base}/explore` },
      { source: '/friends', destination: `${base}/friends` },
      { source: '/more', destination: `${base}/more` },
      { source: '/water', destination: `${base}/water` },
      { source: '/meds', destination: `${base}/meds` },
      { source: '/weight', destination: `${base}/weight` },
      { source: '/weight/day', destination: `${base}/weight/day` },
      { source: '/weight/entry', destination: `${base}/weight/entry` },
    ];
  },
};

module.exports = nextConfig;
