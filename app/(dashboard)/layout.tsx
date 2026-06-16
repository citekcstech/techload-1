'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Role, ROLE_LABELS } from '@/types';
import { createClient } from '@/lib/supabase/client';
import {
  Activity, LayoutDashboard, Users, FolderOpen,
  CheckSquare, Sliders, Settings, LogOut, ChevronDown,
  Menu, X, BarChart2, Bell, Mail,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, leadOnly: false },
  { href: '/teams', label: 'Teams & Members', icon: Users, leadOnly: false },
  { href: '/projects', label: 'Dự án', icon: FolderOpen, leadOnly: false },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare, leadOnly: false },
  { href: '/reports', label: 'Báo cáo', icon: BarChart2, leadOnly: false },
  { href: '/notifications', label: 'Thông báo', icon: Bell, leadOnly: false },
  { href: '/estimate-params', label: 'Estimate Params', icon: Sliders, leadOnly: false },
  { href: '/email-template', label: 'Mẫu email', icon: Mail, leadOnly: true },
  { href: '/settings', label: 'Cài đặt', icon: Settings, leadOnly: false },
];

const ROLE_COLORS: Record<Role, string> = {
  technical: 'bg-blue-100 text-blue-700',
  lead_technical: 'bg-orange-100 text-orange-700',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, activeRole, switchRole, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id).eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [profile]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Activity className="w-8 h-8 text-blue-600 animate-pulse mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  const handleSwitchRole = async (role: Role) => {
    await switchRole(role);
    setShowRoleMenu(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col
                    transform transition-transform duration-200 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0 lg:static lg:inset-auto`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">TechLoad</span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role switcher */}
        <div className="px-4 py-4 border-b border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Vai trò hiện tại</p>
          <div className="relative">
            <button
              onClick={() => profile.roles.length > 1 && setShowRoleMenu(!showRoleMenu)}
              className={`w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg transition-colors ${profile.roles.length > 1 ? 'hover:bg-gray-700 cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${activeRole ? ROLE_COLORS[activeRole] : ''}`}>
                {activeRole ? ROLE_LABELS[activeRole] : '—'}
              </span>
              {profile.roles.length > 1 && <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showRoleMenu && profile.roles.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg border border-gray-700 py-1 z-10">
                {profile.roles.filter((r): r is Role => r in ROLE_COLORS).map((role) => (
                  <button
                    key={role}
                    onClick={() => handleSwitchRole(role)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                      role === activeRole ? 'text-blue-400 font-medium' : 'text-gray-300'
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.filter(({ leadOnly }) => !leadOnly || activeRole === 'lead_technical').map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
                {href === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
              {profile.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{profile.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-900">TechLoad</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
