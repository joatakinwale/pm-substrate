import type { Metadata } from "next";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Brand font: Clash Display Variable for body copy (weight 550 per brand guide)
const clashDisplay = localFont({
  src: "../fonts/ClashDisplay-Variable.woff2",
  variable: "--font-clash",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

// Brand font: Margo Beuys for logotype + select headlines
const margoBeuys = localFont({
  src: "../fonts/MargoBeuys.otf",
  variable: "--font-margo",
  display: "swap",
  weight: "400",
  fallback: ["system-ui", "sans-serif"],
});

// Fallback: Plus Jakarta Sans (web-safe alternative when brand fonts unavailable)
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// FE-22 + FE-24: root metadata. The `template` ("%s | Stevie Social") is
// appended to child-route titles that export a string title. That's why
// every page-level `title` is just the page name (e.g. "About"), not
// "About | Stevie Social" — the template handles the suffix. `default` is
// used only at "/" (homepage has no page-level title export).
//
// alternates.canonical here sets the root-relative canonical for "/".
// Child routes override with their own `alternates.canonical` — next.js
// resolves all canonicals against `metadataBase`.
export const metadata: Metadata = {
  title: {
    default: "Stevie Social — Social That Speaks",
    template: "%s | Stevie Social",
  },
  description:
    "Strategic content creation and social management for established brands ready to stop chasing trends and start building trust.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://stevie.social"
  ),
  alternates: { canonical: "/" },
  keywords: [
    "social media agency",
    "content strategy",
    "social media management",
    "B2B social media",
    "brand strategy",
    "established brands",
    "compound method",
  ],
  openGraph: {
    title: "Stevie Social — Social That Speaks",
    description:
      "Strategic content creation and social management for established brands.",
    url: "/",
    siteName: "Stevie Social",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stevie Social — Social That Speaks",
    description:
      "Strategic content creation and social management for established brands.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// FE-19: Organization JSON-LD. Injected as a <script type="application/ld+json">
// in the document <head> via next/script with strategy="beforeInteractive"
// would also work, but the simplest + rehydration-safe path is a plain
// <script> tag inside the layout tree. Keep the URL absolute (sameAs and @id
// should always be URLs, not path-relative) so crawlers interpret them
// correctly when served from any subdomain or preview URL.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stevie.social";
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Stevie Social",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    "Strategic content creation and social management for established brands ready to stop chasing trends and start building trust.",
  // sameAs: populate once social profiles are live. Leaving empty for now
  // rather than pointing at placeholder or 404 URLs — a broken sameAs is
  // worse for trust signals than an absent one.
  sameAs: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${clashDisplay.variable} ${margoBeuys.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-clash)]" style={{ fontWeight: 550 }}>
        {/* FE-19: Organization JSON-LD. Kept in body (not head) because
            React guarantees this renders once SSR — same output as head
            injection for crawlers, but no hydration mismatch risk. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
        />
        {children}
      </body>
    </html>
  );
}
