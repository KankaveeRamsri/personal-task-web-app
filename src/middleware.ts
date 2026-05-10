import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() refreshes the session via setAll if the access token is expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes: redirect unauthenticated users to sign-in with returnTo
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Auth pages: redirect authenticated users to returnTo or /dashboard
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/auth/sign-in") ||
      request.nextUrl.pathname.startsWith("/auth/sign-up"))
  ) {
    const url = request.nextUrl.clone();
    const returnTo = url.searchParams.get("returnTo");
    url.pathname = sanitizeReturnTo(returnTo);
    url.searchParams.delete("returnTo");
    return NextResponse.redirect(url);
  }

  // /auth/callback and other auth routes pass through
  return supabaseResponse;
}

function sanitizeReturnTo(returnTo: string | null): string {
  if (!returnTo) return "/dashboard";
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return "/dashboard";
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
