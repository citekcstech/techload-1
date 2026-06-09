'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  UserPlus,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Notification, NotificationType } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Icon theo loại thông báo
// ─────────────────────────────────────────────────────────────────────────────
function NotificationIcon({ type }: { type: NotificationType }) {
  const base = 'w-5 h-5 shrink-0';
  switch (type) {
    case 'assigned':
      return <UserPlus className={`${base} text-blue-500`} />;
    case 'near_deadline':
    case 'overdue':
      return <AlertTriangle className={`${base} text-orange-500`} />;
    case 'blocked':
      return <AlertOctagon className={`${base} text-red-500`} />;
    case 'reopened':
      return <RefreshCw className={`${base} text-purple-500`} />;
    case 'review_needed':
      return <Eye className={`${base} text-yellow-500`} />;
    case 'completed':
      return <CheckCircle className={`${base} text-green-500`} />;
    default:
      return <Bell className={`${base} text-gray-400`} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('*, task:tasks(id, title)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Đánh dấu tất cả đã đọc ────────────────────────────────────────────────
  async function markAllRead() {
    if (!profile || unreadCount === 0) return;
    setMarking(true);

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false);

    if (updateError) {
      setError(updateError.message);
      setMarking(false);
      return;
    }

    setMarking(false);
    load();
  }

  // ── Click vào 1 thông báo ─────────────────────────────────────────────────
  async function handleClick(notif: Notification) {
    if (!notif.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notif.id);
    }

    if (notif.task_id) {
      router.push(`/tasks/${notif.task_id}`);
    } else {
      // cập nhật local state cho phản hồi ngay lập tức
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Thông báo</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {unreadCount} chưa đọc
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {marking ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Bell className="w-12 h-12" />
          <p className="text-base">Không có thông báo nào.</p>
        </div>
      )}

      {/* List */}
      {!loading && notifications.length > 0 && (
        <ul className="space-y-2">
          {notifications.map((notif) => {
            const isUnread = !notif.read;
            const timeAgo = formatDistanceToNow(new Date(notif.created_at), {
              addSuffix: true,
              locale: vi,
            });

            return (
              <li key={notif.id}>
                <button
                  onClick={() => handleClick(notif)}
                  className={[
                    'w-full text-left flex items-start gap-3 p-4 rounded-xl border transition-colors',
                    isUnread
                      ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                      : 'bg-white border-gray-100 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {/* Icon */}
                  <div className="mt-0.5">
                    <NotificationIcon type={notif.type} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={[
                        'text-sm leading-snug',
                        isUnread ? 'font-semibold text-gray-900' : 'text-gray-700',
                      ].join(' ')}
                    >
                      {notif.message}
                    </p>

                    {/* Task link */}
                    {notif.task && (
                      <Link
                        href={`/tasks/${notif.task.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block mt-1 text-xs text-blue-600 hover:underline truncate max-w-full"
                      >
                        {notif.task.title}
                      </Link>
                    )}

                    <p className="mt-1 text-xs text-gray-400">{timeAgo}</p>
                  </div>

                  {/* Unread dot */}
                  {isUnread && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
