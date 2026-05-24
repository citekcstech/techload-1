'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Task, Project, Profile, EstimateParam, TeamMember, TaskStatus, TaskPriority, ROLE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/types';
import { buildWorkloadMembers, suggestDeadline, suggestAssignees } from '@/lib/utils/workload';
import { format, addDays } from 'date-fns';
import { CheckSquare, Plus, X, Clock, AlertTriangle, Info, Search } from 'lucide-react';
import Link from 'next/link';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  reopened: 'bg-orange-100 text-orange-700',
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

  // Create task form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', project_id: '', assignee_id: '', priority: 'medium' as TaskPriority,
    estimated_hours: 4, deadline: format(addDays(new Date(), 3), 'yyyy-MM-dd\'T\'HH:mm'),
    estimate_param_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [suggestedDeadline, setSuggestedDeadline] = useState<string | null>(null);
  const [suggestedAssignees, setSuggestedAssignees] = useState<any[]>([]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: memberOf } = await supabase.from('team_members').select('team_id').eq('user_id', profile.id);
    const teamIds = memberOf?.map((m) => m.team_id) ?? [];
    if (teamIds.length === 0) { setLoading(false); return; }

    const { data: projs } = await supabase.from('projects').select('*, team:teams(name)').in('team_id', teamIds);
    setProjects(projs ?? []);

    const { data: members } = await supabase
      .from('team_members').select('*, profile:profiles(id, full_name, email, roles, active_role)').in('team_id', teamIds);
    setTeamMembers(members ?? []);

    const { data: params } = await supabase.from('estimate_params').select('*').in('team_id', teamIds);
    setEstimateParams(params ?? []);

    const projIds = (projs ?? []).map((p) => p.id);
    if (projIds.length > 0) {
      let query = supabase.from('tasks')
        .select('*, project:projects(id,name,team_id), assignee:profiles!tasks_assignee_id_fkey(id,full_name,email), creator:profiles!tasks_created_by_fkey(id,full_name), task_reopens(id,additional_hours,reason,created_at)')
        .in('project_id', projIds)
        .order('created_at', { ascending: false });

      // Technical only sees their assigned tasks
      if (activeRole === 'technical') {
        query = query.eq('assignee_id', profile.id);
      }

      const { data: taskData } = await query;
      setTasks(taskData ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id, activeRole]);

  // Auto-suggest when form changes
  useEffect(() => {
    if (!form.estimated_hours || !form.deadline || !form.project_id) return;
    const projectTeam = projects.find((p) => p.id === form.project_id)?.team_id;
    if (!projectTeam) return;
    const projMembers = teamMembers.filter((m) => m.team_id === projectTeam);
    const workload = buildWorkloadMembers(projMembers, tasks);
    const dl = new Date(form.deadline);

    // Suggest assignees
    const suggestions = suggestAssignees(workload, dl, form.estimated_hours, 3);
    setSuggestedAssignees(suggestions);

    // Suggest deadline for selected assignee
    if (form.assignee_id) {
      const member = workload.find((m) => m.userId === form.assignee_id);
      if (member) {
        const suggested = suggestDeadline(member, form.estimated_hours);
        setSuggestedDeadline(format(suggested, 'yyyy-MM-dd\'T\'HH:mm'));
      }
    }
  }, [form.estimated_hours, form.deadline, form.project_id, form.assignee_id]);

  const handleParamSelect = (paramId: string) => {
    const param = estimateParams.find((p) => p.id === paramId);
    if (param) setForm((f) => ({ ...f, estimate_param_id: paramId, estimated_hours: param.estimated_hours }));
    else setForm((f) => ({ ...f, estimate_param_id: '' }));
  };

  const createTask = async () => {
    if (!form.title.trim() || !form.project_id || !profile) return;
    setSaving(true);
    await supabase.from('tasks').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      project_id: form.project_id,
      assignee_id: form.assignee_id || null,
      created_by: profile.id,
      priority: form.priority,
      estimated_hours: form.estimated_hours,
      deadline: form.deadline,
      estimate_param_id: form.estimate_param_id || null,
      status: 'pending',
    });
    setShowForm(false); setSaving(false);
    load();
  };

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterProject !== 'all' && t.project_id !== filterProject) return false;
    if (filterAssignee !== 'all' && t.assignee_id !== filterAssignee) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, filterStatus, filterProject, filterAssignee, search]);

  const canCreate = activeRole === 'consultant' || activeRole === 'lead_technical';

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} / {tasks.length} task</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
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
            {teamMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>{(m as any).profile?.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Không có task nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
            const reopenCount = task.task_reopens?.length ?? 0;
            return (
              <Link key={task.id} href={`/tasks/${task.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-gray-900">{task.title}</span>
                        {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        {reopenCount > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                            Re-open ×{reopenCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
                        <span>{(task.project as any)?.name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {task.estimated_hours}h
                        </span>
                        <span>•</span>
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {format(new Date(task.deadline), 'dd/MM/yyyy')}
                        </span>
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
          })}
        </div>
      )}

      {/* Create task modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Tạo task mới</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mô tả ngắn yêu cầu..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dự án *</label>
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">-- Chọn dự án --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
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
                  <input type="datetime-local" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                  {suggestedDeadline && suggestedDeadline !== form.deadline && (
                    <button
                      className="mt-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
                      onClick={() => setForm({ ...form, deadline: suggestedDeadline })}
                    >
                      <Info className="w-3 h-3" />
                      Đề xuất: {format(new Date(suggestedDeadline), 'dd/MM/yyyy HH:mm')}
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ưu tiên</label>
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
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
                  {teamMembers
                    .filter((m) => !form.project_id || projects.find((p) => p.id === form.project_id)?.team_id === m.team_id)
                    .map((m) => {
                      const suggested = suggestedAssignees.find((s) => s.userId === m.user_id);
                      const label = suggested
                        ? `${(m as any).profile?.full_name} ✓ tải ${Math.round(suggested.ratioAfterAssign * 100)}%`
                        : (m as any).profile?.full_name;
                      return <option key={m.user_id} value={m.user_id}>{label}</option>;
                    })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Yêu cầu chi tiết, acceptance criteria..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end px-6 pb-6">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Hủy</button>
              <button onClick={createTask} disabled={saving || !form.title.trim() || !form.project_id} className="btn-primary">
                {saving ? 'Đang tạo...' : 'Tạo task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
