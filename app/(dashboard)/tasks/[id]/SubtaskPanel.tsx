'use client';

import { useEffect, useState } from 'react';
import { CheckSquare, Square, Plus, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Subtask } from '@/types';

interface Props {
  taskId: string;
  canEdit: boolean;
}

export default function SubtaskPanel({ taskId, canEdit }: Props) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from('subtasks')
      .select('*, assignee:profiles!subtasks_assignee_id_fkey(id, full_name)')
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setSubtasks((data as Subtask[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function toggleDone(subtask: Subtask) {
    setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('subtasks')
      .update({ done: !subtask.done })
      .eq('id', subtask.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  async function deleteSubtask(id: string) {
    setError('');
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await load();
  }

  async function addSubtask() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    setError('');
    const supabase = createClient();
    const { error: insertError } = await supabase.from('subtasks').insert({
      task_id: taskId,
      title,
      done: false,
      sort_order: subtasks.length,
    });

    if (insertError) {
      setError(insertError.message);
      setAdding(false);
      return;
    }
    setNewTitle('');
    setAdding(false);
    await load();
  }

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.done).length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-800 mb-3">Subtasks</h3>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Đang tải...</span>
        </div>
      ) : (
        <>
          {error && (
            <p className="text-red-600 text-sm mb-3">{error}</p>
          )}

          {total > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>{done}/{total} hoàn thành</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {total === 0 && !canEdit && (
            <p className="text-gray-500 text-sm py-2">Chưa có subtask nào.</p>
          )}

          {total === 0 && canEdit && (
            <p className="text-gray-500 text-sm py-2">
              Chưa có subtask. Thêm subtask để theo dõi tiến độ chi tiết.
            </p>
          )}

          {total > 0 && (
            <ul className="space-y-2 mb-3">
              {subtasks.map((subtask) => (
                <li
                  key={subtask.id}
                  className="flex items-center gap-2 group"
                >
                  <button
                    type="button"
                    onClick={() => toggleDone(subtask)}
                    className="flex-shrink-0 text-gray-500 hover:text-green-600 transition-colors"
                    aria-label={subtask.done ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
                  >
                    {subtask.done ? (
                      <CheckSquare className="w-5 h-5 text-green-500" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <span
                    className={`flex-1 text-sm ${
                      subtask.done ? 'line-through text-gray-400' : 'text-gray-700'
                    }`}
                  >
                    {subtask.title}
                  </span>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => deleteSubtask(subtask.id)}
                      className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Xóa subtask"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                className="input flex-1 text-sm"
                placeholder="Tiêu đề subtask..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSubtask();
                }}
                disabled={adding}
              />
              <button
                type="button"
                onClick={addSubtask}
                disabled={adding || !newTitle.trim()}
                className="btn-primary flex items-center gap-1 text-sm px-3 py-1.5 disabled:opacity-50"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Thêm
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
