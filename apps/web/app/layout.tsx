import { SeoJsonLd } from "@/components/SeoJsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import {
    descriptionDefault,
    domain,
    keywords,
    ogImage,
    siteName,
    titleDefault,
    twitterHandle,
} from "@/lib/seo/site";
import type { Metadata, Viewport } from "next";

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(domain),
  title: {
    default: titleDefault,
    template: "%s | AvoVibe",
  },
  description: descriptionDefault,
  keywords: keywords,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    url: domain,
    siteName,
    title: titleDefault,
    description: descriptionDefault,
    images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }],
  },
  twitter: {
    card: "summary_large_image",
    title: titleDefault,
    description: descriptionDefault,
    ...(twitterHandle ? { site: twitterHandle } : {}),
  },
  alternates: {
    canonical: domain,
  },
  ...((googleVerification || bingVerification) && {
    verification: {
      ...(googleVerification ? { google: googleVerification } : {}),
      ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
    },
  }),
};

export const viewport: Viewport = {
  themeColor: "#B8553F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const schemas = [organizationJsonLd(), websiteJsonLd()];
  return (
    <html lang="en">
      <head />
      <body>
        <SeoJsonLd schema={schemas} />
        {children}
      </body>
    </html>
  );
}
