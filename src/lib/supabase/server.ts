import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Per-request client acting as the logged-in user, so row level security applies. */
export function serverClient() {
  const cookieStore = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component; middleware refreshes the session
        }
      },
    },
  });
}
