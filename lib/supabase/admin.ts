import { createClient } from '@supabase/supabase-js';

// Lọc BOM (U+FEFF), zero-width và khoảng trắng thừa khỏi giá trị env
// — chống lỗi ByteString khi env bị nhiễm BOM lúc cấu hình trên Vercel
export function cleanEnv(value: string | undefined): string {
  return (value ?? '').replace(/[﻿​-‍]/g, '').trim();
}

// Service role client — chỉ dùng trong API routes (server-side), không bao giờ expose ra client
export function createAdminClient() {
  return createClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
