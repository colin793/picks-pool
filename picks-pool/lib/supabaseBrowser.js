'use client';
import { createBrowserClient } from '@supabase/ssr';

let client;
export function sbBrowser() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return client;
}
