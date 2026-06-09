'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Activity } from 'lucide-react';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      const msg = resetError.message.toLowerCase();
      if (msg.includes('rate limit') || msg.includes('email rate limit') || msg.includes('too many requests')) {
        setError('Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ vài phút trước khi thử lại.');
      } else {
        setError(resetError.message);
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Quên mật khẩu?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Nhập email của bạn và chúng tôi sẽ gửi link đặt lại mật khẩu.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              <p className="font-medium mb-1">Đã gửi email!</p>
              <p>Kiểm tra hộp thư <strong>{email}</strong> và nhấn vào link để đặt lại mật khẩu.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-600 mt-6">
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Quay lại đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
