import { MarketingFooter } from "@/components/MarketingFooter";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "AvoVibe terms of service. Terms for using our free calorie and macro tracker.",
  alternates: { canonical: `${domain}/terms` },
};

export default function TermsPage() {
  return (
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
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Terms of Service</h1>
        <p style={{ color: "#555", marginBottom: "1rem" }}>
          Summary of terms for using AvoVibe. Full legal text is available in the app.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Use of the service
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          By using AvoVibe, you agree to use the app in line with these terms and applicable
          law. The app is provided “as is” for personal, non-commercial use.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Health disclaimer
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          AvoVibe is for general tracking only and is not medical or dietary advice. Consult
          a professional for health or nutrition decisions.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Full terms
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          The complete terms of service are available inside the app at{" "}
          <Link href="/legal/terms" style={{ color: "#B8553F" }}>Legal → Terms</Link> (after signing in).
        </p>

        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/contact" style={{ color: "#B8553F" }}>Contact us</Link> with any questions.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
