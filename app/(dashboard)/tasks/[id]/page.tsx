'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Task, TaskStatus, Profile, EstimateParam, TeamMember, PRIORITY_LABELS, STATUS_LABELS } from '@/types';
import { format } from 'date-fns';
import { ArrowLeft, Clock, Calendar, User, RefreshCw, CheckCircle, PlayCircle, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  reopened: 'bg-orange-100 text-orange-700',
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, activeRole } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [task, setTask] = useState<Task | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-estimate form
  const [showReestimate, setShowReestimate] = useState(false);
  const [newHours, setNewHours] = useState(0);
  const [newDeadline, setNewDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-open form
  const [showReopen, setShowReopen] = useState(false);
  const [reopenHours, setReopenHours] = useState(2);
  const [reopenReason, setReopenReason] = useState('');

  // Assign form
  const [showAssign, setShowAssign] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select(`*, 
        project:projects(id, name, team_id, team:teams(name)), 
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, email),
        creator:profiles!tasks_created_by_fkey(id, full_name, email),
        task_reopens(*, profile:profiles(full_name))
      `)
      .eq('id', id)
      .single();
    if (data) {
      setTask(data as Task);
      setNewHours(data.estimated_hours);
      setNewDeadline(format(new Date(data.deadline), "yyyy-MM-dd'T'HH:mm"));

      // Load team members
      const { data: members } = await supabase
        .from('team_members')
        .select('*, profile:profiles(id, full_name, email)')
        .eq('team_id', data.project?.team_id);
      setTeamMembers(members ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: TaskStatus) => {
    setSaving(true);
    await supabase.from('tasks').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }).eq('id', id);
    setSaving(false);
    load();
  };

  const saveReestimate = async () => {
    setSaving(true);
    await supabase.from('tasks').update({
      estimated_hours: newHours,
      deadline: newDeadline,
    }).eq('id', id);
    setShowReestimate(false);
    setSaving(false);
    load();
  };

  const doReopen = async () => {
    if (!reopenReason.trim() || !profile) return;
    setSaving(true);
    await supabase.from('task_reopens').insert({
      task_id: id, reopened_by: profile.id,
      additional_hours: reopenHours, reason: reopenReason.trim(),
    });
    await supabase.from('tasks').update({
      status: 'reopened',
      estimated_hours: (task?.estimated_hours ?? 0) + reopenHours,
      completed_at: null,
    }).eq('id', id);
    setShowReopen(false); setReopenReason(''); setSaving(false);
    load();
  };

  const doAssign = async () => {
    if (!selectedAssignee) return;
    setSaving(true);
    await supabase.from('tasks').update({ assignee_id: selectedAssignee }).eq('id', id);
    setShowAssign(false); setSaving(false);
    load();
  };

  if (loading || !task) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
  const isAssignee = profile?.id === task.assignee_id;
  const canManage = activeRole === 'consultant' || activeRole === 'lead_technical';
  const isTechnical = activeRole === 'technical';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tasks" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          <p className="text-sm text-gray-500">{(task.project as any)?.name} › {(task.project as any)?.team?.name}</p>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      {/* Main info */}
      <div className="card p-6 space-y-4">
        {task.description && (
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Mô tả</p>
            <p className="text-gray-800 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Ước tính</p>
            <p className="font-semibold text-gray-900">{task.estimated_hours}h</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Deadline</p>
            <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
              {format(new Date(task.deadline), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Ưu tiên</p>
            <p className="font-semibold text-gray-900">{PRIORITY_LABELS[task.priority]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Assign</p>
            <p className="font-semibold text-gray-900">
              {(task.assignee as any)?.full_name ?? <span className="text-gray-400">Chưa assign</span>}
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-400">
          Tạo bởi {(task.creator as any)?.full_name} • {format(new Date(task.created_at), 'dd/MM/yyyy HH:mm')}
          {task.completed_at && ` • Hoàn thành: ${format(new Date(task.completed_at), 'dd/MM/yyyy HH:mm')}`}
        </div>
      </div>

      {/* Action buttons */}
      <div className="card p-4 flex flex-wrap gap-3">
        {/* Technical actions */}
        {(isTechnical && isAssignee) && (
          <>
            {task.status === 'pending' && (
              <button onClick={() => updateStatus('in_progress')} disabled={saving} className="btn-primary flex items-center gap-2">
                <PlayCircle className="w-4 h-4" /> Bắt đầu xử lý
              </button>
            )}
            {task.status === 'in_progress' && (
              <>
                <button onClick={() => updateStatus('completed')} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                  <CheckCircle className="w-4 h-4" /> Hoàn thành
                </button>
                <button onClick={() => setShowReestimate(true)} className="btn-secondary flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Re-estimate
                </button>
              </>
            )}
            {(task.status === 'completed' || task.status === 'in_progress') && (
              <button onClick={() => setShowReopen(true)} className="btn-secondary flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                <RefreshCw className="w-4 h-4" /> Re-open
              </button>
            )}
          </>
        )}

        {/* Consultant/Lead actions */}
        {canManage && (
          <>
            <button onClick={() => setShowAssign(true)} className="btn-secondary flex items-center gap-2">
              <User className="w-4 h-4" /> {task.assignee_id ? 'Đổi người assign' : 'Assign'}
            </button>
            {task.status !== 'completed' && (
              <button onClick={() => setShowReestimate(true)} className="btn-secondary flex items-center gap-2">
                <Clock className="w-4 h-4" /> Chỉnh estimate
              </button>
            )}
          </>
        )}
      </div>

      {/* Re-open history */}
      {task.task_reopens && task.task_reopens.length > 0 && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-orange-500" /> Lịch sử Re-open ({task.task_reopens.length})
          </h2>
          <div className="space-y-3">
            {task.task_reopens.map((r, i) => (
              <div key={r.id} className="flex gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center text-xs font-bold text-orange-700 flex-shrink-0">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm text-gray-800">{r.reason}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    +{r.additional_hours}h • {(r as any).profile?.full_name} • {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Re-estimate modal */}
      {showReestimate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Chỉnh estimate</h2>
              <button onClick={() => setShowReestimate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số giờ ước tính</label>
                <input type="number" className="input" min={0.5} step={0.5} value={newHours} onChange={(e) => setNewHours(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline mới</label>
                <input type="datetime-local" className="input" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowReestimate(false)} className="btn-secondary">Hủy</button>
                <button onClick={saveReestimate} disabled={saving} className="btn-primary">Lưu</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Re-open modal */}
      {showReopen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-orange-700 flex items-center gap-2">
                <RefreshCw className="w-5 h-5" /> Re-open task
              </h2>
              <button onClick={() => setShowReopen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thêm giờ</label>
                <input type="number" className="input" min={0} step={0.5} value={reopenHours} onChange={(e) => setReopenHours(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do re-open *</label>
                <textarea className="input resize-none" rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Mô tả vấn đề phát sinh..." />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowReopen(false)} className="btn-secondary">Hủy</button>
                <button onClick={doReopen} disabled={saving || !reopenReason.trim()} className="btn-danger flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Re-open
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assign task</h2>
              <button onClick={() => setShowAssign(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <select className="input" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)}>
                <option value="">-- Chưa assign --</option>
                {teamMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{(m as any).profile?.full_name}</option>
                ))}
              </select>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAssign(false)} className="btn-secondary">Hủy</button>
                <button onClick={doAssign} disabled={saving} className="btn-primary">Assign</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
