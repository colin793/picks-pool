import { NextResponse } from 'next/server';
import { sb } from '../../../lib/supabase';

export async function GET(request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') ?? 'email';
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const supabase = sb();

  // Edited templates land here with token_hash (works from any device).
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  // Default templates land here with ?code= after Supabase verifies remotely
  // (works when the link is opened in the same browser that requested it).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
