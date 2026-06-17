'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Role, ROLE_LABELS } from '@/types';
import { Shield, Edit2, Key, X, Check, Loader2 } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  active_role: Role;
  created_at: string;
}

const ALL_ROLES: Role[] = ['technical', 'lead_technical', 'consulting', 'admin'];

const ROLE_BADGE: Record<Role, string> = {
  technical: 'bg-blue-100 text-blue-700',
  lead_technical: 'bg-orange-100 text-orange-700',
  consulting: 'bg-green-100 text-green-700',
  admin: 'bg-red-100 text-red-700',
};

export default function AdminPage() {
  const { activeRole, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);

  // Modal state
  const [editRoleUser, setEditRoleUser] = useState<UserRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);

  const [editPassUser, setEditPassUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!loading && activeRole !== 'admin') router.replace('/dashboard');
  }, [loading, activeRole, router]);

  useEffect(() => {
    if (activeRole !== 'admin') return;
    supabase
      .from('profiles')
      .select('id, email, full_name, roles, active_role, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setUsers((data as UserRow[]) ?? []);
        setFetching(false);
      });
  }, [activeRole]);

  function openEditRoles(user: UserRow) {
    setEditRoleUser(user);
    setSelectedRoles([...user.roles]);
    setError('');
    setSuccess('');
  }

  function toggleRole(role: Role) {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  async function saveRoles() {
    if (!editRoleUser) return;
    if (selectedRoles.length === 0) { setError('Phải chọn ít nhất 1 role'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_roles', userId: editRoleUser.id, roles: selectedRoles }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error); return; }
    setUsers(prev => prev.map(u => u.id === editRoleUser.id ? { ...u, roles: selectedRoles } : u));
    setSuccess('Cập nhật role thành công');
    setTimeout(() => { setEditRoleUser(null); setSuccess(''); }, 1000);
  }

  function openEditPass(user: UserRow) {
    setEditPassUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }

  async function savePassword() {
    if (!editPassUser) return;
    if (newPassword.length < 6) { setError('Mật khẩu phải ít nhất 6 ký tự'); return; }
    if (newPassword !== confirmPassword) { setError('Mật khẩu xác nhận không khớp'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_password', userId: editPassUser.id, password: newPassword }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error); return; }
    setSuccess('Đổi mật khẩu thành công');
    setTimeout(() => { setEditPassUser(null); setSuccess(''); }, 1000);
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản trị hệ thống</h1>
          <p className="text-sm text-gray-500">{users.length} người dùng</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Họ tên</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Roles</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Active role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{user.full_name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map(r => (
                      <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[r]}`}>
                        {ROLE_LABELS[r]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[user.active_role]}`}>
                    {ROLE_LABELS[user.active_role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEditRoles(user)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Chỉnh role"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditPass(user)}
                      className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Đổi mật khẩu"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Chưa có người dùng nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Edit roles */}
      {editRoleUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Phân quyền: {editRoleUser.full_name || editRoleUser.email}</h2>
              <button onClick={() => setEditRoleUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2">
              {ALL_ROLES.map(role => (
                <label key={role} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[role]}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </label>
              ))}
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-2"><Check className="w-4 h-4" />{success}</p>}
            </div>
            <div className="flex gap-2 justify-end px-6 pb-6">
              <button onClick={() => setEditRoleUser(null)} className="btn-secondary">Hủy</button>
              <button onClick={saveRoles} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change password */}
      {editPassUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Đổi mật khẩu: {editPassUser.full_name || editPassUser.email}</h2>
              <button onClick={() => setEditPassUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  className="input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-2"><Check className="w-4 h-4" />{success}</p>}
            </div>
            <div className="flex gap-2 justify-end px-6 pb-6">
              <button onClick={() => setEditPassUser(null)} className="btn-secondary">Hủy</button>
              <button onClick={savePassword} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Đổi mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
