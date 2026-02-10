/**
 * JSON-LD structured data (invisible SEO). Returns plain objects for script injection.
 */

import { descriptionDefault, domain, siteName } from "./site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: domain,
    description: descriptionDefault,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: domain,
    description: descriptionDefault,
  };
}

export function softwareApplicationJsonLd(options?: { url?: string }) {
  const url = options?.url ?? domain;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteName,
    applicationCategory: "HealthApplication",
    operatingSystem: "Web, iOS, Android",
    url,
    description: descriptionDefault,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function webPageJsonLd(options: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: options.name,
    description: options.description,
    url: options.url,
  };
}

export function faqPageJsonLd(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}
