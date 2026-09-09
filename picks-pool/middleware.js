import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Keeps Supabase sessions fresh on every request. Standard @supabase/ssr plumbing.
export async function middleware(request) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  await supabase.auth.getUser();
  // Remember the league you were in, so the home page can take you straight back.
  const m = request.nextUrl.pathname.match(/^\/l\/([0-9a-f-]{36})(\/|$)/i);
  if (m) response.cookies.set('pp_last_league', m[1], { path: '/', maxAge: 60 * 60 * 24 * 90, sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|api/cron|dev).*)'],
};
