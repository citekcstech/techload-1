'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Task, Project, EstimateParam, TeamMember,
  TaskStatus, TaskPriority, TaskSeverity, RequestType, TaskSource,
  STATUS_LABELS, PRIORITY_LABELS, SEVERITY_LABELS, REQUEST_TYPE_LABELS, SOURCE_LABELS,
} from '@/types';
import { buildWorkloadMembers, suggestDeadline, suggestAssignees, checkCapacityOnAdd, sortByExecution, scheduleMapForAssignee } from '@/lib/utils/workload';
import { format, addDays, isValid, parse } from 'date-fns';
import { CheckSquare, Plus, X, Clock, AlertTriangle, Info, Search, Calendar, CheckCircle, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import Link from 'next/link';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: 'bg-purple-100 text-purple-700',
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
  ready_for_review: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-700',
  reopened: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-200 text-gray-500',
};

const STORAGE_DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm";
const DISPLAY_DATE_TIME_FORMAT = 'dd/MM/yyyy HH:mm';

const toDisplayDeadline = (value: string) => format(new Date(value), DISPLAY_DATE_TIME_FORMAT);

const parseDisplayDeadline = (value: string) => {
  const parsed = parse(value.trim(), DISPLAY_DATE_TIME_FORMAT, new Date());
  return isValid(parsed) ? format(parsed, STORAGE_DATE_TIME_FORMAT) : null;
};

type CreateCapacityWarning = {
  name: string;
  projectedCompletion: Date;
  deadline: Date;
  affectedTasksCount: number;
  willMiss: boolean;
  workingHoursPerDay: number;
};

type FormState = {
  title: string;
  description: string;
  project_id: string;
  assignee_id: string;
  priority: TaskPriority;
  severity: TaskSeverity | '';
  request_type: RequestType | '';
  module: string;
  source: TaskSource | '';
  requester: string;
  business_impact: string;
  acceptance_criteria: string;
  estimated_hours: number;
  deadline: string;
  estimate_param_id: string;
};

export default function TasksPage() {
  const { profile, activeRole } = useAuth();
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [estimateParams, setEstimateParams] = useState<EstimateParam[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showBacklog, setShowBacklog] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);

  // Create task form
  const defaultDeadline = format(addDays(new Date(), 3), STORAGE_DATE_TIME_FORMAT);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: '', description: '', project_id: '', assignee_id: '',
    priority: 'medium', severity: 'medium', request_type: 'consultation', module: '',
    source: 'client', requester: '', business_impact: 'Trung bình', acceptance_criteria: '',
    estimated_hours: 4, deadline: defaultDeadline, estimate_param_id: '',
  });
  const [deadlineInput, setDeadlineInput] = useState(toDisplayDeadline(defaultDeadline));
  const [deadlineError, setDeadlineError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [projectMembers, setProjectMembers] = useState<TeamMember[]>([]);
  const [suggestedDeadline, setSuggestedDeadline] = useState<string | null>(null);
  const [suggestedAssignees, setSuggestedAssignees] = useState<any[]>([]);
  const [capacityWarning, setCapacityWarning] = useState<CreateCapacityWarning | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const isLead = activeRole === 'lead_technical';

    let teamIds: string[] = [];
    if (!isLead) {
      const { data: memberOf } = await supabase.from('team_members').select('team_id').eq('user_id', profile.id);
      teamIds = memberOf?.map((m) => m.team_id) ?? [];
      if (teamIds.length === 0) { setLoading(false); return; }
    }

    const projsQuery = supabase.from('projects').select('*, team:teams(name)');
    const { data: projs } = await (isLead ? projsQuery : projsQuery.in('team_id', teamIds));
    setProjects(projs ?? []);

    const membersQuery = supabase.from('team_members').select('*, profile:profiles(id, full_name, email, roles, active_role)');
    const { data: members } = await (isLead ? membersQuery : membersQuery.in('team_id', teamIds));
    setTeamMembers(members ?? []);

    const { data: params } = await supabase.from('estimate_params').select('*');
    setEstimateParams(params ?? []);

    const projIds = (projs ?? []).map((p) => p.id);
    if (projIds.length > 0) {
      let query = supabase.from('tasks')
        .select('*, project:projects(id,name,team_id), assignee:profiles!tasks_assignee_id_fkey(id,full_name,email), creator:profiles!tasks_created_by_fkey(id,full_name), task_reopens(id,additional_hours,reason,created_at)')
        .in('project_id', projIds)
        .order('created_at', { ascending: false });

      if (activeRole === 'technical') {
        query = query.eq('assignee_id', profile.id);
      }

      const { data: taskData } = await query;
      setTasks(taskData ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id, activeRole]);

  const buildCreateCapacityWarning = (deadlineValue: string | Date = form.deadline): CreateCapacityWarning | null => {
    if (!form.assignee_id || !form.project_id || !form.estimated_hours) return null;
    const deadline = deadlineValue instanceof Date ? deadlineValue : new Date(deadlineValue);
    if (Number.isNaN(deadline.getTime())) return null;
    const workload = buildWorkloadMembers(projectMembers, tasks);
    const member = workload.find((m) => m.userId === form.assignee_id);
    if (!member) return null;
    const check = checkCapacityOnAdd(member, form.estimated_hours, deadline, form.priority);
    if (!check.willMiss && check.affectedTasks.length === 0) return null;
    return {
      name: member.userName,
      projectedCompletion: check.projectedCompletion,
      deadline,
      affectedTasksCount: check.affectedTasks.length,
      willMiss: check.willMiss,
      workingHoursPerDay: member.workingHoursPerDay,
    };
  };

  useEffect(() => {
    if (!form.estimated_hours || !form.deadline || !form.project_id) {
      setSuggestedAssignees([]);
      setSuggestedDeadline(null);
      setCapacityWarning(null);
      return;
    }
    if (projectMembers.length === 0) {
      setSuggestedAssignees([]);
      setSuggestedDeadline(null);
      setCapacityWarning(null);
      return;
    }
    const workload = buildWorkloadMembers(projectMembers, tasks);
    const dl = new Date(form.deadline);
    const suggestions = suggestAssignees(workload, dl, form.estimated_hours, 3, form.priority);
    setSuggestedAssignees(suggestions);
    if (form.assignee_id) {
      const member = workload.find((m) => m.userId === form.assignee_id);
      if (member) {
        const suggested = suggestDeadline(member, form.estimated_hours);
        setSuggestedDeadline(format(suggested, "yyyy-MM-dd'T'HH:mm"));
        setCapacityWarning(buildCreateCapacityWarning(dl));
      } else {
        setSuggestedDeadline(null);
        setCapacityWarning(null);
      }
    } else {
      setSuggestedDeadline(null);
      setCapacityWarning(null);
    }
  }, [form.estimated_hours, form.deadline, form.project_id, form.assignee_id, form.priority, projectMembers, tasks]);

  const handleParamSelect = (paramId: string) => {
    const param = estimateParams.find((p) => p.id === paramId);
    if (param) setForm((f) => ({ ...f, estimate_param_id: paramId, estimated_hours: param.estimated_hours }));
    else setForm((f) => ({ ...f, estimate_param_id: '' }));
  };

  const handleDeadlineInputChange = (value: string) => {
    setDeadlineInput(value);
    const parsed = parseDisplayDeadline(value);
    if (parsed) {
      setForm((f) => ({ ...f, deadline: parsed }));
      setDeadlineError('');
    } else {
      setSuggestedDeadline(null);
      setCapacityWarning(null);
    }
  };

  const applyDeadline = (deadline: string) => {
    setForm((f) => ({ ...f, deadline }));
    setDeadlineInput(toDisplayDeadline(deadline));
    setDeadlineError('');
  };

  const persistSchedule = async (assigneeId: string, allTasks: Task[]) => {
    const tm = teamMembers.find((m) => m.user_id === assigneeId);
    if (!tm) return;
    const mine = allTasks.filter(
      (t) => t.assignee_id === assigneeId && ['pending', 'in_progress', 'reopened'].includes(t.status)
    );
    const map = scheduleMapForAssignee(mine, tm.working_hours_per_day);
    await Promise.all(
      Object.entries(map).map(([id, pc]) =>
        supabase.from('tasks').update({ projected_completion: pc }).eq('id', id)
      )
    );
  };

  const loadProjectMembers = async (projectId: string) => {
    if (!projectId) { setProjectMembers([]); return; }
    const project = projects.find((p) => p.id === projectId);
    const teamId = project?.team_id ?? (
      await supabase.from('projects').select('team_id').eq('id', projectId).single()
        .then(({ data }) => data?.team_id)
    );
    if (!teamId) { setProjectMembers([]); return; }
    const { data: members } = await supabase
      .from('team_members')
      .select('*, profile:profiles(id, full_name, email, roles, active_role)')
      .eq('team_id', teamId);
    setProjectMembers(members ?? []);
    if (activeRole === 'technical' && profile?.id) {
      setForm((f) => ({ ...f, assignee_id: profile.id }));
    }
  };

  const resetForm = () => {
    setProjectMembers([]);
    setForm({
      title: '', description: '', project_id: '', assignee_id: '',
      priority: 'medium', severity: 'medium', request_type: 'consultation', module: '',
      source: 'client', requester: '', business_impact: 'Trung bình', acceptance_criteria: '',
      estimated_hours: 4, deadline: defaultDeadline, estimate_param_id: '',
    });
    setDeadlineInput(toDisplayDeadline(defaultDeadline));
    setDeadlineError('');
    setFormError('');
    setCapacityWarning(null);
  };

  const createTask = async (asBacklog = false) => {
    if (!form.title.trim() || !form.project_id || !profile) return;
    setFormError('');

    const parsedDeadline = parseDisplayDeadline(deadlineInput);
    if (!parsedDeadline) {
      setDeadlineError('Nhập deadline theo định dạng dd/MM/yyyy HH:mm');
      return;
    }

    if (!asBacklog) {
      if (!form.acceptance_criteria.trim()) {
        setFormError('Vui lòng nhập acceptance criteria. Hoặc bấm "Lưu tạm (Backlog)" nếu chưa đủ thông tin.');
        return;
      }
      const latestWarning = buildCreateCapacityWarning(new Date(parsedDeadline));
      if (latestWarning) {
        const sameWarning =
          capacityWarning?.name === latestWarning.name &&
          capacityWarning?.projectedCompletion.getTime() === latestWarning.projectedCompletion.getTime() &&
          capacityWarning?.deadline.getTime() === latestWarning.deadline.getTime() &&
          capacityWarning?.affectedTasksCount === latestWarning.affectedTasksCount;
        setCapacityWarning(latestWarning);
        if (!sameWarning) return;
      } else {
        setCapacityWarning(null);
      }
    }

    setSaving(true);
    const { data: inserted, error } = await supabase.from('tasks').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      project_id: form.project_id,
      assignee_id: form.assignee_id || null,
      created_by: profile.id,
      priority: form.priority,
      severity: form.severity || null,
      request_type: form.request_type || null,
      module: form.module.trim() || null,
      source: form.source || null,
      requester: form.requester.trim() || null,
      business_impact: form.business_impact.trim() || null,
      acceptance_criteria: form.acceptance_criteria.trim() || null,
      estimated_hours: form.estimated_hours,
      deadline: parsedDeadline,
      estimate_param_id: form.estimate_param_id || null,
      status: asBacklog ? 'backlog' : 'pending',
    }).select().single();

    if (!error && inserted && form.assignee_id && !asBacklog) {
      await persistSchedule(form.assignee_id, [...tasks, inserted as Task]);

      const assigneeMember = projectMembers.find((m) => m.user_id === form.assignee_id);
      if (assigneeMember?.profile) {
        const taskLink = `${window.location.origin}/tasks/${inserted.id}`;
        const emails = Array.from(new Set([
          'citek.cs.tech@citek.vn',
          assigneeMember.profile.email,
          profile.email,
        ].filter((e): e is string => !!e)));
        fetch('/api/notify-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: `RE: ${form.title.trim()}`,
            receiveEmail: emails,
            taskLink,
            employeeName: assigneeMember.profile.full_name,
          }),
        }).catch((err) => console.error('[notify-task] create task error:', err));
      }
    }
    setShowForm(false);
    setSaving(false);
    setCapacityWarning(null);
    resetForm();
    load();
  };

  const baseFiltered = useMemo(() => tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterProject !== 'all' && t.project_id !== filterProject) return false;
    if (filterAssignee !== 'all' && t.assignee_id !== filterAssignee) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, filterStatus, filterProject, filterAssignee, search]);

  const backlogList = useMemo(
    () => baseFiltered.filter((t) => t.status === 'backlog')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [baseFiltered]
  );

  const activeList = useMemo(
    () => sortByExecution(baseFiltered.filter((t) => !['completed', 'backlog', 'cancelled'].includes(t.status))),
    [baseFiltered]
  );

  const cancelledList = useMemo(
    () => baseFiltered
      .filter((t) => t.status === 'cancelled')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [baseFiltered]
  );

  const completedList = useMemo(
    () => baseFiltered
      .filter((t) => t.status === 'completed')
      .sort((a, b) =>
        new Date(b.completed_at ?? b.updated_at).getTime() -
        new Date(a.completed_at ?? a.updated_at).getTime()
      ),
    [baseFiltered]
  );

  const canCreate = activeRole === 'lead_technical' || activeRole === 'technical';

  const renderTaskCard = (task: Task) => {
    const isCompleted = task.status === 'completed';
    const isBacklog = task.status === 'backlog';
    const isOverdue = new Date(task.deadline) < new Date() && !isCompleted && !isBacklog;
    const reopenCount = task.task_reopens?.length ?? 0;
    const willMiss = task.projected_completion != null && !isCompleted &&
      new Date(task.projected_completion) > new Date(task.deadline);
    return (
      <Link key={task.id} href={`/tasks/${task.id}`}>
        <div className={`card p-4 hover:shadow-md transition-shadow cursor-pointer ${isCompleted ? 'opacity-70' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`font-medium text-gray-900 ${isCompleted ? 'line-through text-gray-500' : ''}`}>{task.title}</span>
                {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                {!task.acceptance_criteria && !isCompleted && !isBacklog && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Thiếu AC</span>
                )}
                {task.status === 'blocked' && (
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Blocked</span>
                )}
                {task.status === 'ready_for_review' && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">Chờ review</span>
                )}
                {reopenCount > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                    Re-open ×{reopenCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                <span>{(task.project as any)?.name}</span>
                {task.request_type && (
                  <>
                    <span>•</span>
                    <span>{REQUEST_TYPE_LABELS[task.request_type]}</span>
                  </>
                )}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {task.estimated_hours}h
                </span>
                <span>•</span>
                {isCompleted ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    HT {task.completed_at ? format(new Date(task.completed_at), 'dd/MM/yyyy') : ''}
                  </span>
                ) : (
                  <>
                    <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                      {format(new Date(task.deadline), 'dd/MM/yyyy')}
                    </span>
                    {task.projected_completion && !isBacklog && (
                      <>
                        <span>•</span>
                        <span className={willMiss ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          HT dự kiến {format(new Date(task.projected_completion), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </>
                    )}
                    {willMiss && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Trễ</span>
                    )}
                  </>
                )}
                {task.assignee && <span>• {(task.assignee as any).full_name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                {STATUS_LABELS[task.status]}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {backlogList.length > 0 && `${backlogList.length} backlog • `}
            {activeList.length} đang xử lý • {completedList.length} hoàn thành
            {cancelledList.length > 0 && ` • ${cancelledList.length} đã hủy`}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tạo task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Tìm task..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input w-auto" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
          <option value="all">Tất cả dự án</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {activeRole !== 'technical' && (
          <select className="input w-auto" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="all">Tất cả thành viên</option>
            {teamMembers
              .filter((m, i, arr) => arr.findIndex((x) => x.user_id === m.user_id) === i)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>{(m as any).profile?.full_name}</option>
              ))}
          </select>
        )}
      </div>

      {/* Backlog section */}
      {backlogList.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowBacklog((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900 transition-colors"
          >
            {showBacklog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Inbox className="w-4 h-4" />
            Backlog — chờ triage ({backlogList.length})
            <span className="text-xs font-normal text-purple-500">· Cần bổ sung acceptance criteria</span>
          </button>
          {showBacklog && (
            <div className="space-y-2">
              {backlogList.map(renderTaskCard)}
            </div>
          )}
        </div>
      )}

      {/* Task đang xử lý */}
      {activeList.length === 0 && completedList.length === 0 && backlogList.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Không có task nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeList.length === 0 && backlogList.length === 0 ? null : activeList.length === 0 ? null : (
            activeList.map(renderTaskCard)
          )}
        </div>
      )}

      {/* Task đã hoàn thành (thu gọn) */}
      {completedList.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showCompleted ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <CheckCircle className="w-4 h-4 text-green-600" />
            Đã hoàn thành ({completedList.length})
          </button>
          {showCompleted && (
            <div className="space-y-2">
              {completedList.map(renderTaskCard)}
            </div>
          )}
        </div>
      )}

      {/* Task đã hủy (thu gọn) */}
      {cancelledList.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showCancelled ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span className="w-4 h-4 text-gray-400">✕</span>
            Đã hủy ({cancelledList.length})
          </button>
          {showCancelled && (
            <div className="space-y-2 opacity-60">
              {cancelledList.map(renderTaskCard)}
            </div>
          )}
        </div>
      )}

      {/* Create task modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Tạo task mới</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {capacityWarning && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{capacityWarning.name}</span> sẽ hoàn thành dự kiến{' '}
                    <span className="font-medium">{format(capacityWarning.projectedCompletion, 'dd/MM/yyyy HH:mm')}</span>
                    {capacityWarning.willMiss && (
                      <> sau deadline <span className="font-medium">{format(capacityWarning.deadline, 'dd/MM/yyyy HH:mm')}</span></>
                    )}
                    {capacityWarning.affectedTasksCount > 0 && (
                      <> và có thể đẩy {capacityWarning.affectedTasksCount} task khác sang trễ</>
                    )}.
                    {suggestedDeadline && (
                      <> Đề xuất dời deadline sang {format(new Date(suggestedDeadline), 'dd/MM/yyyy HH:mm')} hoặc giao cho thành viên khác.</>
                    )}
                    <div className="text-xs mt-0.5 text-red-500">
                      Lịch được chia tối đa {capacityWarning.workingHoursPerDay}h/ngày, không xếp sau 17:30.
                    </div>
                  </div>
                </div>
              )}
              {formError && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg p-3">
                  {formError}
                </div>
              )}

              {/* Thông tin cơ bản */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mô tả ngắn yêu cầu..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dự án *</label>
                <select className="input" value={form.project_id} onChange={(e) => {
                  setForm({ ...form, project_id: e.target.value, assignee_id: '' });
                  loadProjectMembers(e.target.value);
                }}>
                  <option value="">-- Chọn dự án --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Phân loại yêu cầu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại yêu cầu</label>
                  <select className="input" value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value as RequestType | '' })}>
                    <option value="">-- Chọn loại --</option>
                    {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mức ảnh hưởng (Severity)</label>
                  <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as TaskSeverity | '' })}>
                    <option value="">-- Chọn mức --</option>
                    {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tcode</label>
                  <input className="input" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} placeholder="VD: Tcode dự án" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nguồn yêu cầu</label>
                  <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as TaskSource | '' })}>
                    <option value="">-- Chọn nguồn --</option>
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người yêu cầu</label>
                <input className="input" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder="Tên người hoặc bộ phận yêu cầu..." />
              </div>

              {/* Estimate & deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimate từ param</label>
                  <select className="input" value={form.estimate_param_id} onChange={(e) => handleParamSelect(e.target.value)}>
                    <option value="">-- Chọn hoặc tự nhập --</option>
                    {estimateParams.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.estimated_hours}h)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số giờ ước tính *</label>
                  <input type="number" className="input" min={0.5} step={0.5} value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input pr-10"
                      value={deadlineInput}
                      onChange={(e) => handleDeadlineInputChange(e.target.value)}
                      onBlur={() => {
                        if (!parseDisplayDeadline(deadlineInput)) setDeadlineError('Nhập deadline theo định dạng dd/MM/yyyy HH:mm');
                      }}
                      placeholder="dd/MM/yyyy HH:mm"
                    />
                    <input
                      type="datetime-local"
                      className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
                      value={form.deadline}
                      onChange={(e) => applyDeadline(e.target.value)}
                      aria-label="Chọn deadline"
                    />
                    <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                  {deadlineError && <p className="mt-1 text-xs text-red-600">{deadlineError}</p>}
                  {suggestedDeadline && suggestedDeadline !== form.deadline && (
                    <button
                      className="mt-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
                      onClick={() => applyDeadline(suggestedDeadline)}
                    >
                      <Info className="w-3 h-3" />
                      Đề xuất: {format(new Date(suggestedDeadline), 'dd/MM/yyyy HH:mm')}
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ưu tiên (Priority)</label>
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {activeRole === 'lead_technical' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign cho
                    {suggestedAssignees.length > 0 && (
                      <span className="text-blue-600 font-normal ml-2 text-xs">
                        Gợi ý: {suggestedAssignees.slice(0, 2).map((a) => a.userName).join(', ')}
                      </span>
                    )}
                  </label>
                  <select className="input" value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
                    <option value="">-- Chưa assign --</option>
                    {projectMembers.map((m) => {
                      const suggested = suggestedAssignees.find((s) => s.userId === m.user_id);
                      const label = suggested
                        ? `${(m as any).profile?.full_name} — HT dự kiến ${format(suggested.projectedCompletion, 'dd/MM/yyyy HH:mm')}${suggested.willMiss ? ' ⚠ trễ' : ' ✓'}`
                        : (m as any).profile?.full_name;
                      return <option key={m.user_id} value={m.user_id}>{label}</option>;
                    })}
                  </select>
                </div>
              )}

              {/* Nội dung chi tiết */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Acceptance Criteria *
                  <span className="font-normal text-gray-500 ml-1 text-xs">(bắt buộc để tạo task, bỏ trống để lưu backlog)</span>
                </label>
                <textarea
                  className={`input resize-none ${formError && !form.acceptance_criteria.trim() ? 'border-yellow-400' : ''}`}
                  rows={3}
                  value={form.acceptance_criteria}
                  onChange={(e) => { setForm({ ...form, acceptance_criteria: e.target.value }); if (formError) setFormError(''); }}
                  placeholder="Điều kiện để task được coi là hoàn thành..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh hưởng nghiệp vụ</label>
                <textarea className="input resize-none" rows={2} value={form.business_impact} onChange={(e) => setForm({ ...form, business_impact: e.target.value })} placeholder="Nghiệp vụ nào bị ảnh hưởng nếu không làm / làm sai..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Chi tiết kỹ thuật, context bổ sung..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end px-6 pb-6">
              <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary">Hủy</button>
              <button
                onClick={() => createTask(true)}
                disabled={saving || !form.title.trim() || !form.project_id}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
              >
                Lưu tạm (Backlog)
              </button>
              <button
                onClick={() => createTask(false)}
                disabled={saving || !form.title.trim() || !form.project_id}
                className="btn-primary"
              >
                {saving ? 'Đang tạo...' : capacityWarning ? 'Tạo dù cảnh báo' : 'Tạo task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
