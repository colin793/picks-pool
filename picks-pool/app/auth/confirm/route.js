import { NextResponse } from 'next/server';
import { sb } from '../../../lib/supabase';

export async function GET(request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') ?? 'email';
  const next = url.searchParams.get('next') ?? '/';

  if (token_hash) {
    const { error } = await sb().auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
