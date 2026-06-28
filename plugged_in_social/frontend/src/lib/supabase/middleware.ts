/**
 * Supabase middleware helper — refreshes auth tokens on every request.
 *
 * This ensures the Supabase session stays fresh and cookies are
 * updated before the response is sent to the browser.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Skip Supabase auth when not configured (local dev with custom JWT)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "https://xxxx.supabase.co") {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is the critical call
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /admin routes — redirect to /login if not authenticated
  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from /login
  if (user && request.nextUrl.pathname === "/login") {
    const redirect = request.nextUrl.searchParams.get("redirect") || "/admin";
    const url = request.nextUrl.clone();
    url.pathname = redirect;
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
