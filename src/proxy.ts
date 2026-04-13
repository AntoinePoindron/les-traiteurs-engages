import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Routes publiques (auth)
  const publicRoutes = ["/login", "/register", "/reset-password"];
  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r));

  // Redirige vers login si non authentifié
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirige vers le bon dashboard si déjà connecté et sur une route publique
  if (user && isPublicRoute) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const typedProfile = profile as { role: string } | null;
    if (typedProfile) {
      return NextResponse.redirect(
        new URL(getDashboardPath(typedProfile.role), request.url)
      );
    }
  }

  return supabaseResponse;
}

function getDashboardPath(role: string): string {
  switch (role) {
    case "caterer":
      return "/caterer/dashboard";
    case "client_admin":
    case "client_user":
      return "/client/dashboard";
    case "super_admin":
      return "/admin/dashboard";
    default:
      return "/login";
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
