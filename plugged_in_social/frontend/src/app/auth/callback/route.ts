export const runtime = 'edge';

/**
 * Auth callback route — handles OAuth redirects, magic links,
 * email confirmations, and password resets from Supabase.
 *
 * Supabase redirects here with a ?code= param. We exchange it
 * for a session, then redirect to the appropriate page.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password recovery — redirect to reset page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/admin/settings?reset=true`);
      }
      // Invite flow — the Supabase user exists but has no password yet.
      // Route them to the onboarding page where they set one and land
      // in the admin dashboard. Matches the redirect_to we set in the
      // backend generate_link call.
      if (type === "invite") {
        return NextResponse.redirect(`${origin}/admin/onboarding`);
      }
      // Normal login/signup — go to admin dashboard
      return NextResponse.redirect(`${origin}/admin`);
    }
  }

  // Something went wrong — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
