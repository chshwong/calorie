import { MarketingFooter } from "@/components/MarketingFooter";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How AvoVibe protects your data. Security practices for our calorie and macro tracker.",
  alternates: { canonical: `${domain}/security` },
};

export default function SecurityPage() {
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
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Security</h1>
        <p style={{ color: "#555", marginBottom: "1rem" }}>
          How we help keep your data secure when you use AvoVibe.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Data in transit
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          We use HTTPS for all traffic so your data is encrypted when sent between your
          device and our servers.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Authentication
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          Sign-in is handled via secure authentication providers. We do not store your
          password; we rely on industry-standard OAuth and email-based login where applicable.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Your data
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          Your logs and settings are stored in a secure environment. We follow practices to
          limit access and protect against unauthorized use. For details on what we collect
          and how we use it, see our <Link href="/privacy" style={{ color: "#B8553F" }}>Privacy Policy</Link>.
        </p>

        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/contact" style={{ color: "#B8553F" }}>Contact us</Link> to report a security concern.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
