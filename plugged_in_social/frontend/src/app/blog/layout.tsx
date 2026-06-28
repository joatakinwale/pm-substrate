export const runtime = 'edge';

import type { Metadata } from "next";

// FE-22 + FE-24: metadata for the blog listing route lives in a layout
// because /blog/page.tsx is a client component ("use client" for pagination
// + fetch state) and client components cannot export metadata. The layout
// runs on the server, so Metadata from here applies to /blog. Individual
// posts at /blog/[slug] override via their own generateMetadata.
export const metadata: Metadata = {
  title: "Blog",
  description:
    "Strategy and lessons from brands people actually trust. Field notes from the Stevie Social team on The Compound Method.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Stevie Social Blog",
    description:
      "Strategy and lessons from brands people actually trust. Field notes on The Compound Method.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
