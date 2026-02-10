import { domain } from "@/lib/seo/site";
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/auth",
          "/login",
          "/signup",
          "/onboarding",
          "/settings",
          "/account",
          "/api",
          "/_next",
          "/debug",
          "/preview",
          "/test",
        ],
      },
    ],
    sitemap: `${domain}/sitemap.xml`,
  };
}
