'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Activity } from 'lucide-react';

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errCode = params.get('error_code');
    if (errCode === 'otp_expired') {
      setTokenError('Link đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu gửi lại.');
      return;
    }
    if (params.get('error')) {
      setTokenError('Link không hợp lệ. Vui lòng yêu cầu gửi lại.');
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setError('');
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-4">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TechLoad</h1>
          <p className="text-blue-200 mt-1">Đặt lại mật khẩu</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Tạo mật khẩu mới</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              <p className="font-medium">Đổi mật khẩu thành công!</p>
              <p className="mt-1">Đang chuyển hướng về trang chủ...</p>
            </div>
          ) : tokenError ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <p className="font-medium mb-2">{tokenError}</p>
              <a href="/forgot-password" className="text-blue-600 font-medium hover:underline">
                Gửi lại email đặt lại mật khẩu
              </a>
            </div>
          ) : !ready ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm">
              <p className="font-medium">Đang xác thực link...</p>
              <p className="mt-1">Nếu trang này không phản hồi, vui lòng nhấn lại link trong email.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Tối thiểu 6 ký tự"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                  placeholder="Nhập lại mật khẩu"
                  minLength={6}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
