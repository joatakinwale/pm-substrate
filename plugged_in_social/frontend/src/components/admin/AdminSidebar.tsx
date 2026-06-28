"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  FileText,
  BookOpen,
  Mail,
  Settings,
  LogOut,
  Menu,
  X,
  DollarSign,
  FileSignature,
  FolderKanban,
  Briefcase,
  Send,
  ClipboardList,
  Workflow,
  Share2,
  Sparkles,
  Video,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/pages", label: "Pages", icon: FileText },
  { href: "/admin/blog", label: "Blog", icon: BookOpen },
  { href: "/admin/proposals", label: "Proposals", icon: FileSignature },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/work", label: "Work", icon: Briefcase },
  { href: "/admin/billing", label: "Billing", icon: DollarSign },
  { href: "/admin/email", label: "Email", icon: Send },
  { href: "/admin/forms", label: "Forms", icon: ClipboardList },
  { href: "/admin/automations", label: "Automations", icon: Workflow },
  { href: "/admin/social", label: "Social", icon: Share2 },
  { href: "/admin/ai-content", label: "AI Content", icon: Sparkles },
  { href: "/admin/video", label: "Video", icon: Video },
  { href: "/admin/contacts", label: "Contacts", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

// AdminSidebar now self-fetches the user instead of receiving it as
// props from the (formerly server-rendered) admin/layout.tsx. This was
// required to make the layout a pure structural component so admin/*
// pages can render statically and not balloon the Pages bundle. Auth
// gating is unchanged — middleware redirects unauthed /admin/* → /login
// before any of this renders.
export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (cancelled || !user) return;
      const email: string = user.email ?? "";
      const fullName = user.user_metadata?.full_name;
      const name: string =
        (typeof fullName === "string" && fullName) ||
        email.split("@")[0] ||
        "User";
      setUserEmail(email);
      setUserName(name);
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const sidebarContent = (
    <>
      {/* Logo — Margo Beuys */}
      <div className="p-5 border-b border-border">
        <Link href="/" className="font-margo text-xl tracking-tight">
          stevie<span className="text-stevie-green">.</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-stevie-green/10 text-stevie-green font-medium"
                  : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-stevie-green/10 flex items-center justify-center text-stevie-green text-xs font-bold">
            {/* Guard for the brief mount window before the client-side
                getUser() resolves — empty string would crash charAt(0). */}
            {userName ? userName.charAt(0).toUpperCase() : "·"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName || "Loading…"}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail || " "}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-lg text-sm text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-border h-full">
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed left-4 top-2 z-40 p-2 bg-white border border-border rounded-lg shadow-sm"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
