"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Receipt, ClipboardCheck } from "lucide-react";
import BrandStyleInjector from "@/components/BrandStyleInjector";

const NAV_ITEMS = [
  { href: "/portal", label: "Dashboard", icon: Home },
  { href: "/portal/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/proposals", label: "Proposals", icon: FileText },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Auth page gets no chrome
  if (pathname === "/portal/auth") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandStyleInjector />
      {/* Top nav bar */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-margo)] text-xl tracking-tight">
              Stevie Social
            </span>
            <span className="text-xs text-muted-foreground bg-stevie-lavender/20 px-2 py-0.5 rounded-full">
              Client Portal
            </span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/portal"
                  ? pathname === "/portal"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition ${
                    isActive
                      ? "bg-foreground text-white"
                      : "text-muted-foreground hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
