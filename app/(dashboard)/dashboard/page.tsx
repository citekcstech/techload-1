'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Task, TeamMember, Team, Project } from '@/types';
import { buildWorkloadMembers, overloadBg, overloadColor } from '@/lib/utils/workload';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, Users, TrendingUp, FolderOpen } from 'lucide-react';

export default function DashboardPage() {
  const { profile, activeRole } = useAuth();
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      setLoading(true);

      // Load teams user belongs to
      const { data: memberOf } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', profile.id);
      const teamIds = memberOf?.map((m) => m.team_id) ?? [];

      if (teamIds.length === 0) { setLoading(false); return; }

      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);
      setTeams(teamsData ?? []);
      if (teamsData?.[0]) setSelectedTeamId(teamsData[0].id);

      // Load all projects for these teams
      const { data: projs } = await supabase
        .from('projects')
        .select('*, team:teams(name)')
        .in('team_id', teamIds);
      setProjects(projs ?? []);

      // Load team members with profiles
      const { data: members } = await supabase
        .from('team_members')
        .select('*, profile:profiles(id, full_name, email, roles, active_role)')
        .in('team_id', teamIds);
      setTeamMembers(members ?? []);

      // Load all tasks for these projects
      const projIds = (projs ?? []).map((p) => p.id);
      if (projIds.length > 0) {
        const { data: taskData } = await supabase
          .from('tasks')
          .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, email), project:projects(id, name, team_id)')
          .in('project_id', projIds);
        setTasks(taskData ?? []);
      }

      setLoading(false);
    };
    load();
  }, [profile?.id]);

  const filteredMembers = useMemo(
    () => teamMembers.filter((m) => !selectedTeamId || m.team_id === selectedTeamId),
    [teamMembers, selectedTeamId]
  );

  const workloadMembers = useMemo(
    () => buildWorkloadMembers(filteredMembers, tasks),
    [filteredMembers, tasks]
  );

  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const stats = useMemo(() => {
    const active = tasks.filter((t) => ['pending', 'in_progress', 'reopened'].includes(t.status));
    const done = tasks.filter((t) => t.status === 'completed');
    const overdue = active.filter((t) => new Date(t.deadline) < now);
    const overloaded = workloadMembers.filter((m) => m.hasOverdue);
    return { active: active.length, done: done.length, overdue: overdue.length, overloaded: overloaded.length };
  }, [tasks, workloadMembers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
          <p className="text-gray-500 text-sm mt-0.5">Xin chào, {profile?.full_name} 👋</p>
        </div>
        {teams.length > 1 && (
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="input w-auto"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tasks đang mở', value: stats.active, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Hoàn thành', value: stats.done, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Quá hạn', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Overloaded', value: stats.overloaded, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workload chart */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Tải trọng thành viên
          <span className="text-sm font-normal text-gray-500 ml-2">(7 ngày tới)</span>
        </h2>
        {workloadMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Chưa có thành viên trong team</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workloadMembers.map((m) => {
              const ratio = m.overloadRatio(nextWeek);
              const pct = Math.min(ratio * 100, 150);
              const avail = m.availableHoursUntil(nextWeek);
              const active = m.totalEstimatedHours;
              return (
                <div key={m.userId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{m.userName}</span>
                      <span className="text-xs text-gray-400 ml-2">{m.activeTasks.length} task</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${overloadColor(ratio)}`}>
                        {active}h / {avail}h
                      </span>
                      {m.hasOverdue && (
                        <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          Có task trễ lịch
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all ${overloadBg(ratio)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Overdue tasks */}
      {tasks.filter((t) => ['pending', 'in_progress', 'reopened'].includes(t.status) && new Date(t.deadline) < now).length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Tasks quá hạn
          </h2>
          <div className="space-y-2">
            {tasks
              .filter((t) => ['pending', 'in_progress', 'reopened'].includes(t.status) && new Date(t.deadline) < now)
              .slice(0, 10)
              .map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{(t.project as any)?.name} • {(t.assignee as any)?.full_name ?? 'Chưa assign'}</p>
                  </div>
                  <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                    {format(new Date(t.deadline), 'dd/MM/yyyy')}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Projects summary */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-gray-400" /> Dự án đang hoạt động
        </h2>
        {projects.filter((p) => p.status === 'active').length === 0 ? (
          <p className="text-gray-400 text-sm">Chưa có dự án nào</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects
              .filter((p) => p.status === 'active')
              .map((p) => {
                const projTasks = tasks.filter((t) => t.project_id === p.id);
                const done = projTasks.filter((t) => t.status === 'completed').length;
                const total = projTasks.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={p.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{(p.team as any)?.name}</p>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{done}/{total} tasks</span><span>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
