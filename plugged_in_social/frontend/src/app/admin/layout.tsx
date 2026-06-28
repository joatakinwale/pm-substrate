import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import BrandStyleInjector from "@/components/BrandStyleInjector";
import OnlineUsers from "@/components/OnlineUsers";

export const metadata: Metadata = {
  title: {
    template: "%s | Stevie Dashboard",
    default: "Dashboard | Stevie Social",
  },
  robots: { index: false, follow: false },
};

// Auth gating happens in src/middleware.ts (updateSession redirects
// unauthed /admin/* requests to /login BEFORE this layout renders).
// Doing the same getUser() call here was duplicative AND it pinned every
// admin/* page as a server-rendered edge function — which under
// @cloudflare/next-on-pages produced ~30 functions × ~1.7 MB each, far
// over Pages' 25 MiB bundle limit. By making this layout a pure
// structural component (no force-dynamic, no server data fetch), the
// admin/* tree can render statically and AdminSidebar fetches the user
// itself via the browser Supabase client.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <BrandStyleInjector />
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Org-wide online presence — mounted once at the layout level so
            heartbeat/SSE state survives navigation between admin pages. */}
        <div className="sticky top-0 z-30 flex min-h-14 items-center justify-end gap-3 border-b border-border/40 bg-gray-50/80 px-6 py-2 pl-16 backdrop-blur lg:min-h-0 lg:px-8">
          <OnlineUsers />
        </div>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
