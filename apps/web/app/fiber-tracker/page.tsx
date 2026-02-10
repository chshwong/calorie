import { MarketingFooter } from "@/components/MarketingFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { softwareApplicationJsonLd } from "@/lib/seo/jsonld";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fiber Tracker",
  description:
    "Track fiber intake daily. Free fiber tracker with calorie and macro logging. No paywalls.",
  alternates: { canonical: `${domain}/fiber-tracker` },
};

export default function FiberTrackerPage() {
  const schema = softwareApplicationJsonLd({ url: `${domain}/fiber-tracker` });
  return (
    <>
      <SeoJsonLd schema={schema} />
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <main
          style={{
            flex: 1,
            maxWidth: 720,
            margin: "0 auto",
            padding: "2rem 1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Fiber Tracker</h1>
          <p style={{ color: "#555", marginBottom: "1rem" }}>
            Track daily fiber intake and see progress toward your goal. Free to use.
          </p>
          <p style={{ marginBottom: "1rem" }}>
            Log meals and see fiber per day. AvoVibe tracks calories, macros, protein, water,
            and weight in one app with no paywalls.
          </p>
          <Link href="/" style={{ color: "#B8553F", fontWeight: 600 }}>
            Open AvoVibe →
          </Link>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
