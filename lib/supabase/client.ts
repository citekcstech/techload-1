import { createBrowserClient } from '@supabase/ssr';

// Lọc BOM (U+FEFF), zero-width và khoảng trắng thừa khỏi env
// — chống lỗi fetch "String contains non ISO-8859-1 code point" khi env bị nhiễm BOM
function cleanEnv(value: string | undefined): string {
  return (value ?? '').replace(/[﻿​-‍]/g, '').trim();
}

export function createClient() {
  return createBrowserClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}
