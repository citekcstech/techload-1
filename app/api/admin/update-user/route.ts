import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

async function getCallerProfile() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
  return data;
}

export async function POST(req: NextRequest) {
  const caller = await getCallerProfile();
  if (!caller || !caller.roles?.includes('admin')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const body = await req.json();
  const { action, userId, roles, password } = body;

  const adminClient = createAdminClient();

  if (action === 'update_roles') {
    if (!userId || !Array.isArray(roles)) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
    }
    const { error } = await adminClient
      .from('profiles')
      .update({ roles })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'update_password') {
    if (!userId || !password || password.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu phải ít nhất 6 ký tự' }, { status: 400 });
    }
    const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
}
