'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import {
  CommentType,
  TaskComment,
  COMMENT_TYPE_LABELS,
  COMMENT_TYPE_COLORS,
} from '@/types';

interface Props {
  taskId: string;
  currentUserId: string;
}

type CommentWithProfile = TaskComment & {
  profile: { id: string; full_name: string; email: string } | null;
};

export default function CommentsPanel({ taskId, currentUserId }: Props) {
  const supabase = createClient();

  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newType, setNewType] = useState<CommentType>('note');
  const [newBody, setNewBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('task_comments')
      .select('*, profile:profiles(id, full_name, email)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setComments((data as CommentWithProfile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleDelete(commentId: string) {
    const { error: deleteError } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newBody.trim()) return;
    setSaving(true);
    setSubmitError('');

    const { error: insertError } = await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: currentUserId,
      type: newType,
      body: newBody.trim(),
    });

    setSaving(false);
    if (insertError) {
      setSubmitError(insertError.message);
      return;
    }
    setNewBody('');
    setNewType('note');
    await load();
  }

  function getInitial(name: string | undefined | null): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-blue-600" />
        <h3 className="font-semibold text-gray-800">Trao đổi & Ghi chú</h3>
        <span className="ml-auto text-sm text-gray-400">{comments.length} bình luận</span>
      </div>

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          Chưa có trao đổi nào. Hãy để lại ghi chú hoặc quyết định đầu tiên.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              {/* Avatar */}
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {getInitial(comment.profile?.full_name)}
              </div>

              {/* Body */}
              <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">
                    {comment.profile?.full_name ?? comment.profile?.email ?? 'Người dùng'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${COMMENT_TYPE_COLORS[comment.type]}`}
                  >
                    {COMMENT_TYPE_LABELS[comment.type]}
                  </span>

                  {comment.user_id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      className="ml-auto text-gray-300 transition hover:text-red-500"
                      title="Xóa bình luận"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        {submitError && (
          <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</div>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="comment-type" className="text-sm font-medium text-gray-600 whitespace-nowrap">
            Loại
          </label>
          <select
            id="comment-type"
            className="input text-sm"
            value={newType}
            onChange={(e) => setNewType(e.target.value as CommentType)}
          >
            {(Object.keys(COMMENT_TYPE_LABELS) as CommentType[]).map((key) => (
              <option key={key} value={key}>
                {COMMENT_TYPE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={3}
          className="input resize-none text-sm"
          placeholder="Nhập nội dung..."
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!newBody.trim() || saving}
            className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Gửi
          </button>
        </div>
      </form>
    </div>
  );
}
