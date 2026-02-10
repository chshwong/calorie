import { MarketingFooter } from "@/components/MarketingFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { softwareApplicationJsonLd } from "@/lib/seo/jsonld";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Macro Tracker",
  description:
    "Free macro tracker. Log protein, carbs, fat, and fiber with no paywalls. Set daily targets and track progress.",
  alternates: { canonical: `${domain}/macro-tracker` },
};

export default function MacroTrackerPage() {
  const schema = softwareApplicationJsonLd({ url: `${domain}/macro-tracker` });
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
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Macro Tracker</h1>
          <p style={{ color: "#555", marginBottom: "1rem" }}>
            Track protein, carbs, fat, and fiber daily. Free, with no premium lock-in.
          </p>
          <p style={{ marginBottom: "1rem" }}>
            Set your macro targets and log food to see how you’re doing. AvoVibe includes
            calorie tracking and water logging in one app.
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
