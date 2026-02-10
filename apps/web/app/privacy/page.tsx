import { MarketingFooter } from "@/components/MarketingFooter";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "AvoVibe privacy policy. How we handle your data when you use our calorie and macro tracker.",
  alternates: { canonical: `${domain}/privacy` },
};

export default function PrivacyPage() {
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
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Privacy Policy</h1>
        <p style={{ color: "#555", marginBottom: "1rem" }}>
          Summary of how AvoVibe handles your data. Full legal text is available in the app.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          What we collect
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          We collect information you provide when you use the app: account details, food logs,
          and settings. We use this to run the service and improve the product.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          How we use it
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          Your data is used to provide the calorie and macro tracking features, sync across
          devices, and support you. We do not sell your personal information.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Full policy
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          The complete privacy policy is available inside the app at{" "}
          <Link href="/legal/privacy" style={{ color: "#B8553F" }}>Legal → Privacy</Link> (after signing in).
        </p>

        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/contact" style={{ color: "#B8553F" }}>Contact us</Link> with any privacy questions.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
