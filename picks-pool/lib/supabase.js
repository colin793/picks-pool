import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// User-scoped client for server components, actions, and route handlers.
// RLS applies, which is the point: the database enforces the rules.
export function sb() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server components can't set cookies; middleware refreshes sessions.
          }
        },
      },
    }
  );
}

// Service-role client. Server only. Bypasses RLS: score sync, joins, recap.
export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function currentUser() {
  const { data } = await sb().auth.getUser();
  return data?.user ?? null;
}
