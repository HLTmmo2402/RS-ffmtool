import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Supabase client cho Server Components / Route Handlers (Next 14: cookies() đồng bộ).
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Gọi từ Server Component -> bỏ qua; middleware sẽ refresh session.
          }
        },
      },
    }
  );
}

// getUser() dùng chung, cache trong 1 request (React cache) -> layout + page KHÔNG gọi lại 2-3 lần.
export const getCurrentUser = cache(async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
