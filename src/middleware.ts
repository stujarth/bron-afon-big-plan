import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the auth session on every request and keeps unauthenticated visitors on /login. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        all.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        all.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth/");
  if (!user && !isPublic) {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && path.startsWith("/login")) {
    const url = request.nextUrl.clone(); url.pathname = "/";
    return NextResponse.redirect(url);
  }
  // Temporary passwords must be replaced before anything else is reachable.
  if (user && !path.startsWith("/account/password") && !path.startsWith("/auth/")) {
    const { data } = await supabase.from("profiles").select("must_change_password").eq("id", user.id).maybeSingle();
    if (data?.must_change_password) {
      const url = request.nextUrl.clone(); url.pathname = "/account/password"; url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"] };
