'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Role, ROLE_LABELS } from '@/types';
import { User, Lock, Shield, Save } from 'lucide-react';

export default function SettingsPage() {
  const { profile, refreshProfile, switchRole } = useAuth();
  const supabase = createClient();

  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  const saveProfile = async () => {
    if (!profile || !fullName.trim()) return;
    setSavingProfile(true);
    await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id);
    await refreshProfile();
    setProfileMsg('Đã lưu!'); setSavingProfile(false);
    setTimeout(() => setProfileMsg(''), 3000);
  };

  const changePassword = async () => {
    setPwError(''); setPwMsg('');
    if (newPw !== confirmPw) { setPwError('Mật khẩu xác nhận không khớp'); return; }
    if (newPw.length < 6) { setPwError('Mật khẩu tối thiểu 6 ký tự'); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setPwError(error.message); }
    else { setPwMsg('Đã đổi mật khẩu!'); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    setSavingPw(false);
    setTimeout(() => setPwMsg(''), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-gray-500 text-sm mt-0.5">Quản lý tài khoản của bạn</p>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-gray-400" /> Thông tin cá nhân
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="input" value={profile?.email ?? ''} disabled />
            <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi</p>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
            {profileMsg && <span className="text-sm text-green-600 font-medium">✓ {profileMsg}</span>}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-gray-400" /> Đổi mật khẩu
        </h2>
        <div className="space-y-4">
          {pwError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{pwError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
            <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
            <input type="password" className="input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={changePassword} disabled={savingPw || !newPw || !confirmPw} className="btn-primary flex items-center gap-2">
              <Lock className="w-4 h-4" /> {savingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
            {pwMsg && <span className="text-sm text-green-600 font-medium">✓ {pwMsg}</span>}
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-gray-400" /> Vai trò hiện tại
        </h2>
        <div className="flex flex-wrap gap-2">
          {(profile?.roles ?? []).map((role) => (
            <span
              key={role}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                profile?.active_role === role
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              {ROLE_LABELS[role as Role]}
              {profile?.active_role === role && <span className="ml-1.5 text-xs opacity-75">(đang dùng)</span>}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Chuyển vai trò bằng cách chọn trong menu sidebar.</p>
      </div>
    </div>
  );
}
