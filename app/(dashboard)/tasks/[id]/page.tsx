'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Task, TaskStatus, TaskPriority, TeamMember, ReopenRootCause,
  PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, SEVERITY_LABELS, REQUEST_TYPE_LABELS, SOURCE_LABELS, ROOT_CAUSE_LABELS,
} from '@/types';
import { scheduleMapForAssignee, buildWorkloadMembers, checkCapacityOnAdd, addWorkingHours } from '@/lib/utils/workload';
import { BUFFER_FACTOR } from '@/types';
import { format } from 'date-fns';
import {
  ArrowLeft, Clock, Calendar, User, RefreshCw, CheckCircle, PlayCircle,
  AlertTriangle, X, Tag, Layers, PauseCircle, Eye, Ban, Plus, History,
  ListChecks, MessageSquare, Mail,
} from 'lucide-react';
import Link from 'next/link';
import SubtaskPanel from './SubtaskPanel';
import CommentsPanel from './CommentsPanel';

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: 'bg-purple-100 text-purple-700',
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
  ready_for_review: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-700',
  reopened: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-200 text-gray-500',
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, activeRole } = useAuth();
  const supabase = createClient();

  const [task, setTask] = useState<Task | null>(null);
  const [loadError, setLoadError] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assigneeTasks, setAssigneeTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Re-estimate
  const [showReestimate, setShowReestimate] = useState(false);
  const [newHours, setNewHours] = useState(0);
  const [newDeadline, setNewDeadline] = useState('');
  const [reestDeadlineEdited, setReestDeadlineEdited] = useState(false);
  const [reestimateReason, setReestimateReason] = useState('');
  const [reestimateScopeChange, setReestimateScopeChange] = useState(false);

  // Re-open
  const [showReopen, setShowReopen] = useState(false);
  const [reopenHours, setReopenHours] = useState(2);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenRootCause, setReopenRootCause] = useState<ReopenRootCause | ''>('');

  // Assign
  const [showAssign, setShowAssign] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');

  // Hoàn thành
  const [showComplete, setShowComplete] = useState(false);
  const [completeActual, setCompleteActual] = useState(0);
  const [completionNote, setCompletionNote] = useState('');

  // Work log
  const [showWorkLog, setShowWorkLog] = useState(false);
  const [workLogDate, setWorkLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workLogHours, setWorkLogHours] = useState(1);
  const [workLogNote, setWorkLogNote] = useState('');

  // Blocked modal
  const [showBlock, setShowBlock] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockOwner, setBlockOwner] = useState('');
  const [blockFollowUp, setBlockFollowUp] = useState('');

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Resend email
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'comments' | 'history'>('details');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select(`*,
        project:projects(id, name, team_id, team:teams(name)),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, email),
        creator:profiles!tasks_created_by_fkey(id, full_name, email),
        task_reopens(*, profile:profiles(full_name))
      `)
      .eq('id', id)
      .single();
    if (fetchError) {
      setLoadError(fetchError.message);
      setLoading(false);
      return;
    }
    if (data) {
      // Load work logs và estimate logs riêng (bảng có thể chưa tồn tại)
      const [wlResult, elResult] = await Promise.all([
        supabase.from('task_work_logs').select('*, profile:profiles(full_name)').eq('task_id', id).order('work_date', { ascending: false }),
        supabase.from('task_estimate_logs').select('*, profile:profiles(full_name)').eq('task_id', id).order('created_at', { ascending: false }),
      ]);
      const workLogs = wlResult.data ?? [];
      const estimateLogs = elResult.data ?? [];

      const enrichedData = {
        ...data,
        task_work_logs: workLogs,
        task_estimate_logs: estimateLogs,
      };

      setTask(enrichedData as unknown as Task);
      setNewHours(data.estimated_hours);
      setNewDeadline(format(new Date(data.deadline), "yyyy-MM-dd'T'HH:mm"));
      const totalLogged = workLogs.reduce((s: number, l: any) => s + (l.hours ?? 0), 0);
      setCompleteActual(totalLogged > 0 ? totalLogged : (data.actual_hours ?? data.estimated_hours));

      const { data: members } = await supabase
        .from('team_members')
        .select('*, profile:profiles(id, full_name, email)')
        .eq('team_id', data.project?.team_id);
      setTeamMembers(members ?? []);

      if (data.assignee_id) {
        const { data: at } = await supabase
          .from('tasks')
          .select('*')
          .eq('assignee_id', data.assignee_id)
          .in('status', ['pending', 'in_progress', 'reopened']);
        setAssigneeTasks(at ?? []);
      } else {
        setAssigneeTasks([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const persistScheduleFor = async (assigneeId: string | null | undefined) => {
    if (!assigneeId) return;
    const tm = teamMembers.find((m) => m.user_id === assigneeId);
    const dailyHours = tm?.working_hours_per_day ?? 8;
    const { data: mine } = await supabase
      .from('tasks')
      .select('*')
      .eq('assignee_id', assigneeId)
      .in('status', ['pending', 'in_progress', 'reopened']);
    if (!mine) return;
    const map = scheduleMapForAssignee(mine as Task[], dailyHours);
    await Promise.all(
      Object.entries(map).map(([tid, pc]) =>
        supabase.from('tasks').update({ projected_completion: pc }).eq('id', tid))
    );
  };

  const updateStatus = async (status: TaskStatus) => {
    setSaving(true);
    const clearProjected = ['completed', 'blocked', 'ready_for_review', 'cancelled', 'backlog'].includes(status);
    await supabase.from('tasks').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      projected_completion: clearProjected ? null : undefined,
    }).eq('id', id);
    await persistScheduleFor(task?.assignee_id);
    setSaving(false);
    load();
  };

  const doComplete = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from('tasks').update({
      status: 'completed',
      actual_hours: completeActual,
      completion_note: completionNote.trim() || null,
      completed_by: profile.id,
      completed_at: new Date().toISOString(),
      projected_completion: null,
    }).eq('id', id);
    await persistScheduleFor(task?.assignee_id);
    setShowComplete(false);
    setSaving(false);
    load();
  };

  const doLogWork = async () => {
    if (!profile || workLogHours <= 0) return;
    setSaving(true);
    await supabase.from('task_work_logs').insert({
      task_id: id,
      user_id: profile.id,
      work_date: workLogDate,
      hours: workLogHours,
      note: workLogNote.trim() || null,
    });
    const { data: logs } = await supabase
      .from('task_work_logs')
      .select('hours')
      .eq('task_id', id);
    const total = (logs ?? []).reduce((s, l) => s + (l.hours ?? 0), 0);
    await supabase.from('tasks').update({ actual_hours: total }).eq('id', id);
    await persistScheduleFor(task?.assignee_id);
    setShowWorkLog(false);
    setWorkLogHours(1);
    setWorkLogNote('');
    setSaving(false);
    load();
  };

  // Tự tính lại deadline trong giờ làm việc khi đổi số giờ (trừ khi sửa tay)
  const computeReestDeadline = (hours: number) =>
    format(addWorkingHours(new Date(), hours), "yyyy-MM-dd'T'HH:mm");

  useEffect(() => {
    if (!showReestimate || reestDeadlineEdited) return;
    setNewDeadline(computeReestDeadline(newHours));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newHours, showReestimate]);

  const saveReestimate = async () => {
    if (!profile || !reestimateReason.trim()) return;
    setSaving(true);
    await supabase.from('task_estimate_logs').insert({
      task_id: id,
      changed_by: profile.id,
      old_estimated_hours: task?.estimated_hours,
      new_estimated_hours: newHours,
      old_deadline: task?.deadline,
      new_deadline: addWorkingHours(new Date(newDeadline), newHours * (BUFFER_FACTOR - 1)).toISOString(),
      reason: reestimateReason.trim(),
      is_scope_change: reestimateScopeChange,
    });
    await supabase.from('tasks').update({
      estimated_hours: newHours,
      deadline: addWorkingHours(new Date(newDeadline), newHours * (BUFFER_FACTOR - 1)).toISOString(),
    }).eq('id', id);
    await persistScheduleFor(task?.assignee_id);
    setShowReestimate(false);
    setReestimateReason('');
    setReestimateScopeChange(false);
    setSaving(false);
    load();
  };

  const doReopen = async () => {
    if (!reopenReason.trim() || !profile) return;
    setSaving(true);
    await supabase.from('task_reopens').insert({
      task_id: id,
      reopened_by: profile.id,
      additional_hours: reopenHours,
      reason: reopenReason.trim(),
      root_cause: reopenRootCause || null,
    });
    await supabase.from('tasks').update({
      status: 'reopened',
      estimated_hours: (task?.estimated_hours ?? 0) + reopenHours,
      completed_at: null,
      completed_by: null,
      completion_note: null,
    }).eq('id', id);
    await persistScheduleFor(task?.assignee_id);
    setShowReopen(false); setReopenReason(''); setReopenRootCause(''); setSaving(false);
    load();
  };

  const doAssign = async () => {
    if (!selectedAssignee) return;
    setSaving(true);
    const oldAssignee = task?.assignee_id;
    await supabase.from('tasks').update({ assignee_id: selectedAssignee }).eq('id', id);
    if (oldAssignee && oldAssignee !== selectedAssignee) await persistScheduleFor(oldAssignee);
    await persistScheduleFor(selectedAssignee);
    setShowAssign(false); setSaving(false);
    load();
  };

  const doBlock = async () => {
    if (!blockReason.trim()) return;
    setSaving(true);
    await supabase.from('tasks').update({
      status: 'blocked',
      blocked_reason: blockReason.trim(),
      blocked_owner: blockOwner.trim() || null,
      blocked_follow_up_date: blockFollowUp || null,
      projected_completion: null,
    }).eq('id', id);
    await persistScheduleFor(task?.assignee_id);
    setShowBlock(false); setBlockReason(''); setBlockOwner(''); setBlockFollowUp('');
    setSaving(false);
    load();
  };

  const doCancel = async () => {
    if (!cancelReason.trim()) return;
    setSaving(true);
    await supabase.from('tasks').update({
      status: 'cancelled',
      cancelled_reason: cancelReason.trim(),
      projected_completion: null,
    }).eq('id', id);
    await persistScheduleFor(task?.assignee_id);
    setShowCancel(false); setCancelReason('');
    setSaving(false);
    load();
  };

  const savePriority = async (priority: TaskPriority) => {
    if (!task || priority === task.priority) return;
    setSaving(true);
    await supabase.from('tasks').update({ priority }).eq('id', id);
    setSaving(false);
    load();
  };

  const doResendEmail = async () => {
    if (!task || !task.assignee_id) return;
    const assignee = (task.assignee as any);
    if (!assignee?.email) return;
    setSendingEmail(true);
    setEmailError('');
    const taskLink = `${window.location.origin}/tasks/${task.id}`;
    const receiveEmail = Array.from(new Set([
      'citek.cs.tech@citek.vn',
      assignee.email as string,
      task.requester ?? '',
    ].filter((e): e is string => !!e)));

    const vars: Record<string, string> = {
      '{{employeeName}}': assignee.full_name ?? '',
      '{{taskTitle}}': task.title,
      '{{deadlineStr}}': format(new Date(task.projected_completion ?? task.deadline), 'dd/MM/yyyy HH:mm'),
      '{{hours}}': String(task.estimated_hours),
      '{{priority}}': PRIORITY_LABELS[task.priority],
      '{{taskLink}}': taskLink,
    };
    const applyVars = (s: string) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(k, v), s);

    const { data: tpl, error: tplError } = await supabase
      .from('email_templates').select('subject, html_body').eq('name', 'default').single();
    console.log('[ResendEmail] tpl:', tpl, 'error:', tplError);

    const fallbackHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;font-size:14px;color:#333}.greeting{color:#005870;font-weight:bold;font-size:16px}.link a{color:#005870;text-decoration:underline}.signature{margin-top:30px}.citek{color:#005870;font-weight:bold;font-size:22px;margin:4px 0}.task-info{background:#f0f9fb;border-left:4px solid #005870;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0}.task-info p{margin:4px 0;font-size:13px;color:#333}.task-title{font-weight:bold;font-size:15px;color:#005870}</style>
</head><body>
<p class="greeting">Dear {{employeeName}},</p>
<p>Bạn được assign một task mới. Vui lòng nhấn vào link bên dưới để xem chi tiết.</p>
<div class="task-info"><p class="task-title">{{taskTitle}}</p><p>Deadline: <strong>{{deadlineStr}}</strong></p><p>Số giờ ước tính: <strong>{{hours}}h</strong></p><p>Ưu tiên: <strong>{{priority}}</strong></p></div>
<p class="link"><a href="{{taskLink}}" target="_blank">{{taskLink}}</a></p>
<div class="signature"><p>Thanks &amp; Best Regards,</p><p class="citek">Citek</p><p style="font-size:12px;color:#666">Address: No. 75, Str. 41, Van Phuc City, Hiep Binh Phuoc Ward, Thu Duc City, Ho Chi Minh City, Vietnam<br>Website: <a href="https://www.citek.vn">www.citek.vn</a></p></div>
</body></html>`;

    const htmlBody = applyVars(tpl?.html_body || fallbackHtml);
    const subject = applyVars(tpl?.subject || `RE: ${task.title}`);
    console.log('[ResendEmail] htmlBody length:', htmlBody.length, 'subject:', subject);

    const bytes = new TextEncoder().encode(htmlBody);
    const contentHtmlBase64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    console.log('[ResendEmail] contentHtmlBase64 length:', contentHtmlBase64.length);

    try {
      const res = await fetch('/api/notify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, receive_email: receiveEmail, task_link: taskLink, employee_name: assignee.full_name ?? '', contentHtmlBase64 }),
      });
      const text = await res.text();
      if (!res.ok) {
        setEmailError(`Lỗi ${res.status}: ${text || 'Không có phản hồi'}`);
      } else {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 3000);
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="card p-6 text-center space-y-3">
          <p className="text-red-600 font-medium">Không thể tải task</p>
          <p className="text-sm text-gray-500">{loadError}</p>
          {loadError.includes('does not exist') && (
            <p className="text-xs text-gray-400">Bảng dữ liệu chưa được tạo — hãy chạy migration trong Supabase SQL Editor.</p>
          )}
          <button onClick={load} className="btn-primary text-sm">Thử lại</button>
        </div>
      </div>
    );
  }

  if (loading || !task) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const workLogs = (task as any).task_work_logs ?? [];
  const estimateLogs = (task as any).task_estimate_logs ?? [];
  const totalLogged = workLogs.reduce((s: number, l: any) => s + (l.hours ?? 0), 0);
  const isOverdue = new Date(task.deadline) < new Date() && !['completed', 'cancelled'].includes(task.status);
  const willMiss = task.projected_completion != null && task.status !== 'completed' &&
    new Date(task.projected_completion) > new Date(task.deadline);
  const isAssignee = profile?.id === task.assignee_id;
  const canManage = activeRole === 'lead_technical';
  const isTechnical = activeRole === 'technical';
  const isTerminal = task.status === 'completed' || task.status === 'cancelled';
  const isStarted = ['in_progress', 'blocked', 'ready_for_review', 'reopened'].includes(task.status);
  const canEdit = canManage && !isTerminal;
  const baselineHours = task.baseline_estimated_hours ?? task.estimated_hours;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tasks" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${task.status === 'cancelled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {task.title}
          </h1>
          <p className="text-sm text-gray-500">{(task.project as any)?.name} › {(task.project as any)?.team?.name}</p>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          { key: 'details', label: 'Chi tiết' },
          { key: 'subtasks', label: 'Subtasks' },
          { key: 'comments', label: 'Trao đổi' },
          { key: 'history', label: 'Lịch sử' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === key
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (<>

        {/* Action buttons */}
        <div className="card p-4 flex flex-wrap gap-3">
          {isTechnical && isAssignee && (
            <>
              {(task.status === 'pending' || task.status === 'reopened') && (
                <button onClick={() => updateStatus('in_progress')} disabled={saving} className="btn-primary flex items-center gap-2">
                  <PlayCircle className="w-4 h-4" /> Bắt đầu xử lý
                </button>
              )}
              {task.status === 'in_progress' && (
                <>
                  <button onClick={() => setShowComplete(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                    <CheckCircle className="w-4 h-4" /> Hoàn thành
                  </button>
                  <button onClick={() => updateStatus('ready_for_review')} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors">
                    <Eye className="w-4 h-4" /> Gửi review
                  </button>
                  <button onClick={() => setShowBlock(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors">
                    <PauseCircle className="w-4 h-4" /> Báo blocked
                  </button>
                  <button onClick={() => setShowWorkLog(true)} className="btn-secondary flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Ghi giờ
                  </button>
                  <button onClick={() => { setReestDeadlineEdited(false); setShowReestimate(true); }} className="btn-secondary flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Re-estimate
                  </button>
                </>
              )}
              {task.status === 'blocked' && (
                <button onClick={() => updateStatus('in_progress')} disabled={saving} className="btn-primary flex items-center gap-2">
                  <PlayCircle className="w-4 h-4" /> Tiếp tục xử lý
                </button>
              )}
              {task.status === 'completed' && (
                <button onClick={() => setShowReopen(true)} className="btn-secondary flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                  <RefreshCw className="w-4 h-4" /> Re-open
                </button>
              )}
            </>
          )}

          {canManage && (
            <>
              {task.status === 'backlog' && (
                <button onClick={() => updateStatus('pending')} disabled={saving} className="btn-primary flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Triage → Chờ xử lý
                </button>
              )}
              {task.status === 'ready_for_review' && (
                <>
                  <button onClick={() => setShowComplete(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                    <CheckCircle className="w-4 h-4" /> Xác nhận hoàn thành
                  </button>
                  <button onClick={() => setShowReopen(true)} disabled={saving} className="btn-secondary flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                    <RefreshCw className="w-4 h-4" /> Yêu cầu làm lại
                  </button>
                </>
              )}
              {task.status === 'completed' && (
                <button onClick={() => setShowReopen(true)} className="btn-secondary flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                  <RefreshCw className="w-4 h-4" /> Re-open
                </button>
              )}
              {canEdit && (
                <button onClick={() => setShowAssign(true)} className="btn-secondary flex items-center gap-2">
                  <User className="w-4 h-4" /> {task.assignee_id ? 'Đổi assignee' : 'Assign'}
                </button>
              )}
              {canEdit && (
                <button onClick={() => { setReestDeadlineEdited(false); setShowReestimate(true); }} className="btn-secondary flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Chỉnh estimate
                </button>
              )}
              {!isTerminal && (activeRole === 'lead_technical' || !isStarted) && (
                <button onClick={() => setShowCancel(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 hover:bg-red-50 rounded-lg font-medium transition-colors text-sm">
                  <Ban className="w-4 h-4" /> Hủy task
                </button>
              )}
            </>
          )}

          {!isTechnical && !!task.assignee_id && (
            <div className="flex flex-col gap-1">
              <button
                onClick={doResendEmail}
                disabled={sendingEmail}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                  emailSent
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : emailError
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'btn-secondary'
                }`}
              >
                <Mail className="w-4 h-4" />
                {sendingEmail ? 'Đang gửi...' : emailSent ? 'Đã gửi!' : 'Gửi lại email'}
              </button>
              {emailError && (
                <p className="text-xs text-red-600 max-w-xs">{emailError}</p>
              )}
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="card p-6 space-y-4">
          {/* Metadata nghiệp vụ */}
          {(task.request_type || task.severity || task.module || task.source || task.requester) && (
            <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
              {task.request_type && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                  <Tag className="w-3 h-3" /> {REQUEST_TYPE_LABELS[task.request_type]}
                </span>
              )}
              {task.severity && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${task.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  task.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    task.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                  }`}>
                  Severity: {SEVERITY_LABELS[task.severity]}
                </span>
              )}
              {task.module && (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  <Layers className="w-3 h-3" /> {task.module}
                </span>
              )}
              {task.source && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  Nguồn: {SOURCE_LABELS[task.source]}
                </span>
              )}
              {task.requester && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  YC bởi: {task.requester}
                </span>
              )}
            </div>
          )}

          {task.description && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Mô tả</p>
              <p className="text-gray-800 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Ước tính</p>
              <p className="font-semibold text-gray-900">
                {task.estimated_hours}h
                {baselineHours !== task.estimated_hours && (
                  <span className="text-xs text-gray-400 ml-1 line-through">{baselineHours}h</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Deadline</p>
              <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                {format(new Date(task.deadline), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> HT dự kiến</p>
              {task.projected_completion && task.status !== 'completed' ? (
                <p className={`font-semibold flex items-center gap-1 ${willMiss ? 'text-red-600' : 'text-gray-900'}`}>
                  {format(new Date(task.projected_completion), 'dd/MM/yyyy HH:mm')}
                  {willMiss && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Trễ</span>}
                </p>
              ) : (
                <p className="font-semibold text-gray-400">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Ưu tiên</p>
              {canEdit ? (
                <select
                  className="input py-0.5 text-sm font-semibold"
                  value={task.priority}
                  onChange={(e) => savePriority(e.target.value as TaskPriority)}
                  disabled={saving}
                >
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              ) : isTechnical && isAssignee && !isTerminal ? (
                <select
                  className="input py-0.5 text-sm font-semibold"
                  value={task.priority}
                  onChange={(e) => savePriority(e.target.value as TaskPriority)}
                  disabled={saving}
                  title="Dev chỉ có thể hạ độ ưu tiên"
                >
                  {Object.entries(PRIORITY_LABELS)
                    .filter(([v]) => PRIORITY_ORDER[v as TaskPriority] >= PRIORITY_ORDER[task.priority])
                    .map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                </select>
              ) : (
                <p className="font-semibold text-gray-900">{PRIORITY_LABELS[task.priority]}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Assign</p>
              <p className="font-semibold text-gray-900">
                {(task.assignee as any)?.full_name ?? <span className="text-gray-400">Chưa assign</span>}
              </p>
            </div>
          </div>

          {/* Tiến độ giờ */}
          {(() => {
            const actual = totalLogged > 0 ? totalLogged : (task.actual_hours ?? 0);
            if (actual === 0 && task.status === 'pending') return null;
            const est = task.estimated_hours || 1;
            const pct = Math.round((actual / est) * 100);
            const over = actual > est;
            return (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">
                    Giờ làm thực tế
                    {totalLogged > 0 && <span className="text-gray-400 ml-1">({workLogs.length} lần log)</span>}
                  </span>
                  <span className={`font-medium ${over ? 'text-red-600' : 'text-gray-700'}`}>
                    {actual}h / {task.estimated_hours}h ({pct}%)
                    {over && <span className="text-red-500 ml-1">+{(actual - est).toFixed(1)}h vượt</span>}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full transition-all ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })()}

          {/* Completion note */}
          {task.status === 'completed' && task.completion_note && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Ghi chú hoàn thành
              </p>
              <p className="text-sm text-gray-800">{task.completion_note}</p>
            </div>
          )}

          {/* Blocked info */}
          {task.status === 'blocked' && task.blocked_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <PauseCircle className="w-4 h-4" /> Lý do bị chặn
              </p>
              <p className="text-sm text-red-800">{task.blocked_reason}</p>
              {task.blocked_owner && (
                <p className="text-xs text-red-600">Cần giải quyết bởi: <span className="font-medium">{task.blocked_owner}</span></p>
              )}
              {task.blocked_follow_up_date && (
                <p className="text-xs text-red-600">
                  Follow-up: <span className="font-medium">{format(new Date(task.blocked_follow_up_date), 'dd/MM/yyyy HH:mm')}</span>
                </p>
              )}
            </div>
          )}

          {/* Cancelled info */}
          {task.status === 'cancelled' && task.cancelled_reason && (
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                <Ban className="w-4 h-4" /> Lý do hủy
              </p>
              <p className="text-sm text-gray-700 mt-1">{task.cancelled_reason}</p>
            </div>
          )}

          {/* Ready for review */}
          {task.status === 'ready_for_review' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-sm text-yellow-800">
              <Eye className="w-4 h-4 flex-shrink-0" />
              Task đã sẵn sàng để review / UAT — đang chờ Lead Technical xác nhận hoàn thành.
            </div>
          )}

          {task.acceptance_criteria && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Acceptance Criteria</p>
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                {task.acceptance_criteria}
              </div>
            </div>
          )}

          {task.business_impact && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Ảnh hưởng nghiệp vụ</p>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{task.business_impact}</p>
            </div>
          )}

          <div className="text-xs text-gray-400">
            Tạo bởi {(task.creator as any)?.full_name} • {format(new Date(task.created_at), 'dd/MM/yyyy HH:mm')}
            {task.completed_at && ` • Hoàn thành: ${format(new Date(task.completed_at), 'dd/MM/yyyy HH:mm')}`}
          </div>
        </div>

      </>)}

      {activeTab === 'subtasks' && <SubtaskPanel taskId={id} canEdit={activeRole === 'lead_technical'} />}

      {activeTab === 'comments' && <CommentsPanel taskId={id} currentUserId={profile?.id ?? ''} />}

      {activeTab === 'history' && (<>

        {/* Work logs */}
        {workLogs.length > 0 && (
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Lịch sử giờ làm
              <span className="text-sm font-normal text-gray-500">({totalLogged}h tổng)</span>
            </h2>
            <div className="divide-y divide-gray-100">
              {[...workLogs]
                .sort((a: any, b: any) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime())
                .map((log: any) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-800">{log.note || <span className="text-gray-400 italic">—</span>}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {log.profile?.full_name} • {format(new Date(log.work_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-blue-700 flex-shrink-0">{log.hours}h</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Estimate logs */}
        {estimateLogs.length > 0 && (
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-purple-500" /> Lịch sử estimate
            </h2>
            <div className="space-y-2">
              {[...estimateLogs]
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((log: any) => (
                  <div key={log.id} className={`p-3 rounded-lg border text-sm ${log.is_scope_change ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <div className="flex items-center gap-2">
                        {log.is_scope_change && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Scope change</span>
                        )}
                        <span className="text-gray-700">{log.reason}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {log.profile?.full_name} • {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    {log.old_estimated_hours !== log.new_estimated_hours && (
                      <p className="text-xs text-gray-500">
                        Giờ: <span className="line-through">{log.old_estimated_hours}h</span> → <span className="font-medium text-gray-700">{log.new_estimated_hours}h</span>
                      </p>
                    )}
                    {log.old_deadline !== log.new_deadline && log.new_deadline && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Deadline: <span className="line-through">{log.old_deadline ? format(new Date(log.old_deadline), 'dd/MM/yyyy') : '—'}</span>
                        {' → '}<span className="font-medium text-gray-700">{format(new Date(log.new_deadline), 'dd/MM/yyyy')}</span>
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

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

      </>)}

      {/* ── MODALS ─────────────────────────────────────────── */}

      {/* Ghi giờ làm */}
      {showWorkLog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> Ghi giờ làm
              </h2>
              <button onClick={() => setShowWorkLog(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày làm *</label>
                  <input type="date" className="input" value={workLogDate}
                    onChange={(e) => setWorkLogDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số giờ *</label>
                  <input type="number" className="input" min={0.5} step={0.5} value={workLogHours}
                    onChange={(e) => setWorkLogHours(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <input className="input" value={workLogNote}
                  onChange={(e) => setWorkLogNote(e.target.value)}
                  placeholder="Đã làm gì trong session này..." />
              </div>
              <p className="text-xs text-gray-500">
                Đã ghi: {totalLogged}h / {task.estimated_hours}h ước tính
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowWorkLog(false)} className="btn-secondary">Hủy</button>
                <button onClick={doLogWork} disabled={saving || workLogHours <= 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Lưu giờ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hoàn thành */}
      {showComplete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Hoàn thành task
              </h2>
              <button onClick={() => setShowComplete(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số giờ thực tế *</label>
                <input type="number" className="input" min={0} step={0.5} value={completeActual}
                  onChange={(e) => setCompleteActual(Number(e.target.value))} />
                <p className="text-xs text-gray-500 mt-1">
                  Ước tính: {task.estimated_hours}h
                  {totalLogged > 0 && ` • Đã log: ${totalLogged}h`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú hoàn thành</label>
                <textarea className="input resize-none" rows={3} value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Kết quả đạt được, lưu ý cho người tiếp nhận..." />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowComplete(false)} className="btn-secondary">Hủy</button>
                <button onClick={doComplete} disabled={saving || completeActual <= 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" /> Xác nhận hoàn thành
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Re-estimate */}
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
                <input type="number" className="input" min={0.5} step={0.5} value={newHours}
                  onChange={(e) => setNewHours(Number(e.target.value))} />
                <p className="text-xs text-gray-400 mt-1">Baseline: {baselineHours}h</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline mới</label>
                <input type="datetime-local" className="input" value={newDeadline}
                  onChange={(e) => { setReestDeadlineEdited(true); setNewDeadline(e.target.value); }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do thay đổi *</label>
                <textarea className="input resize-none" rows={2} value={reestimateReason}
                  onChange={(e) => setReestimateReason(e.target.value)}
                  placeholder="Phát sinh thêm yêu cầu, estimate ban đầu sai..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reestimateScopeChange}
                  onChange={(e) => setReestimateScopeChange(e.target.checked)}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">Đây là scope change (phát sinh phạm vi mới)</span>
              </label>
              {(() => {
                if (!task.assignee_id) return null;
                const tm = teamMembers.find((m) => m.user_id === task.assignee_id);
                if (!tm?.profile) return null;
                const others = assigneeTasks.filter((t) => t.id !== task.id);
                const [member] = buildWorkloadMembers([tm], others);
                if (!member) return null;
                const dl = newDeadline ? new Date(newDeadline) : new Date(task.deadline);
                const { projectedCompletion, willMiss: pm } = checkCapacityOnAdd(member, newHours, dl, task.priority);
                return (
                  <div className={`text-sm rounded-lg p-3 flex items-start gap-2 ${pm ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      HT dự kiến: <span className="font-medium">{format(projectedCompletion, 'dd/MM/yyyy HH:mm')}</span>
                      {pm && ' — trễ deadline'}
                    </span>
                  </div>
                );
              })()}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowReestimate(false)} className="btn-secondary">Hủy</button>
                <button onClick={saveReestimate} disabled={saving || !reestimateReason.trim()}
                  className="btn-primary disabled:opacity-50">Lưu</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocked */}
      {showBlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                <PauseCircle className="w-5 h-5" /> Báo blocked
              </h2>
              <button onClick={() => setShowBlock(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do bị chặn *</label>
                <textarea className="input resize-none" rows={3} value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Đang chờ phản hồi từ..., phụ thuộc vào task #..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cần giải quyết bởi</label>
                <input className="input" value={blockOwner} onChange={(e) => setBlockOwner(e.target.value)}
                  placeholder="Tên người / team / bên ngoài..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày follow-up</label>
                <input type="datetime-local" className="input" value={blockFollowUp}
                  onChange={(e) => setBlockFollowUp(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowBlock(false)} className="btn-secondary">Hủy</button>
                <button onClick={doBlock} disabled={saving || !blockReason.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50">
                  <PauseCircle className="w-4 h-4" /> Xác nhận blocked
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Ban className="w-5 h-5" /> Hủy task
              </h2>
              <button onClick={() => setShowCancel(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do hủy *</label>
                <textarea className="input resize-none" rows={3} value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Yêu cầu đã thay đổi, không còn cần thiết..." />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCancel(false)} className="btn-secondary">Quay lại</button>
                <button onClick={doCancel} disabled={saving || !cancelReason.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium disabled:opacity-50">
                  <Ban className="w-4 h-4" /> Xác nhận hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Re-open */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Nguyên nhân gốc *</label>
                <select className="input" value={reopenRootCause}
                  onChange={(e) => setReopenRootCause(e.target.value as ReopenRootCause | '')}>
                  <option value="">-- Chọn nguyên nhân --</option>
                  {Object.entries(ROOT_CAUSE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết *</label>
                <textarea className="input resize-none" rows={3} value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Mô tả cụ thể vấn đề phát sinh..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thêm giờ ước tính</label>
                <input type="number" className="input" min={0} step={0.5} value={reopenHours}
                  onChange={(e) => setReopenHours(Number(e.target.value))} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowReopen(false)} className="btn-secondary">Hủy</button>
                <button onClick={doReopen} disabled={saving || !reopenReason.trim() || !reopenRootCause}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-50">
                  <RefreshCw className="w-4 h-4" /> Re-open
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign */}
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
