/**
 * Server-side Supabase client for Server Components, Route Handlers,
 * and Server Actions.
 *
 * Creates a new client per request using cookies for session management.
 * This is the recommended pattern from Supabase's Next.js guide.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll is called from Server Components where cookies
          // can't be set. This is expected and safe to ignore —
          // middleware handles the refresh.
        }
      },
    },
  });
}
