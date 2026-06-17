'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Task,
  TeamMember,
  Team,
  Project,
  WeekBucket,
  MemberWeekRow,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/types';
import { buildWeeklyWorkload, overloadBg, overloadColor } from '@/lib/utils/workload';
import { startOfWeek, endOfWeek, addWeeks, format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
} from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-600',
  pending: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  blocked: 'bg-red-100 text-red-700',
  ready_for_review: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  reopened: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

const ACTIVE = ['pending', 'in_progress', 'reopened'];

export default function DashboardPage() {
  const { profile, activeRole } = useAuth();
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ row: MemberWeekRow; weekIndex: number } | null>(null);

  useEffect(() => {
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

      const teamsQuery = supabase.from('teams').select('*');
      const { data: teamsData } = await (isLead ? teamsQuery : teamsQuery.in('id', teamIds));
      setTeams(teamsData ?? []);
      if (teamsData?.[0]) setSelectedTeamId(teamsData[0].id);

      const projsQuery = supabase.from('projects').select('*, team:teams(name)');
      const { data: projs } = await (isLead ? projsQuery : projsQuery.in('team_id', teamIds));
      setProjects(projs ?? []);

      const membersQuery = supabase.from('team_members').select('*, profile:profiles(id, full_name, email, roles, active_role)');
      const { data: members } = await (isLead ? membersQuery : membersQuery.in('team_id', teamIds));
      setTeamMembers(members ?? []);

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
  }, [profile?.id, activeRole]);

  // Mốc thời gian — tính 1 lần, ổn định trong suốt phiên render
  const now = useMemo(() => new Date(), []);

  // 3 tuần (Thứ 2 → Chủ nhật) quanh anchor: tuần trước | tuần này | tuần sau
  const weeks = useMemo<WeekBucket[]>(() => {
    const thisStart = startOfWeek(anchor, { weekStartsOn: 1 });
    const meta: { key: WeekBucket['key']; label: string; offset: number }[] = [
      { key: 'prev', label: 'Tuần trước', offset: -1 },
      { key: 'this', label: 'Tuần này', offset: 0 },
      { key: 'next', label: 'Tuần sau', offset: 1 },
    ];
    return meta.map(({ key, label, offset }) => {
      const start = addWeeks(thisStart, offset);
      return { key, label, start, end: endOfWeek(start, { weekStartsOn: 1 }) };
    });
  }, [anchor]);

  // Thành viên đang xem: lọc theo team đã chọn; role technical chỉ thấy chính mình
  const visibleMembers = useMemo(() => {
    let ms = teamMembers.filter((m) => !selectedTeamId || m.team_id === selectedTeamId);
    if (activeRole === 'technical') ms = ms.filter((m) => m.user_id === profile?.id);
    return ms;
  }, [teamMembers, selectedTeamId, activeRole, profile?.id]);

  const { rows, summaries } = useMemo(
    () => buildWeeklyWorkload(visibleMembers, tasks, weeks, now),
    [visibleMembers, tasks, weeks, now]
  );

  // Task quá hạn nằm trong cửa sổ 3 tuần đang xem
  const windowStart = weeks[0].start;
  const windowEnd = weeks[2].end;
  const overdueTasks = useMemo(() => {
    const memberIds = new Set(visibleMembers.map((m) => m.user_id));
    return tasks
      .filter((t) => {
        if (!t.assignee_id || !memberIds.has(t.assignee_id)) return false;
        if (!ACTIVE.includes(t.status)) return false;
        const d = new Date(t.deadline);
        return d >= windowStart && d <= windowEnd && d < now;
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  }, [tasks, visibleMembers, windowStart, windowEnd, now]);

  const monthLabel = `Tháng ${anchor.getMonth() + 1}/${anchor.getFullYear()}`;
  const isCurrentWeek = startOfWeek(anchor, { weekStartsOn: 1 }).getTime() === startOfWeek(now, { weekStartsOn: 1 }).getTime();

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
      {/* Header + điều hướng tháng/tuần */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan tải trọng</h1>
          <p className="text-gray-500 text-sm mt-0.5">Xin chào, {profile?.full_name} 👋</p>
        </div>
        <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
            <button
              onClick={() => setAnchor((d) => addWeeks(d, -1))}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"
              aria-label="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[110px] text-center flex items-center justify-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              {monthLabel}
            </span>
            <button
              onClick={() => setAnchor((d) => addWeeks(d, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"
              aria-label="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {!isCurrentWeek && (
            <button onClick={() => setAnchor(new Date())} className="btn-secondary text-sm py-1.5">
              Hôm nay
            </button>
          )}
        </div>
      </div>

      {/* Thống kê tổng hợp theo từng tuần */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {weeks.map((w, i) => {
          const s = summaries[i];
          const isThis = w.key === 'this';
          return (
            <div
              key={w.key}
              className={`card p-4 ${isThis ? 'ring-2 ring-blue-500 border-blue-200' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`text-sm font-semibold ${isThis ? 'text-blue-700' : 'text-gray-900'}`}>
                    {w.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(w.start, 'dd/MM')} – {format(w.end, 'dd/MM')}
                  </p>
                </div>
                {s.overloadedMembers > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {s.overloadedMembers} quá tải
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span><b>{s.taskCount}</b> task · {Math.round(s.totalHours)}h</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span><b>{s.doneCount}</b> xong</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${s.overdueCount > 0 ? 'text-red-500' : 'text-gray-300'}`} />
                  <span className={s.overdueCount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                    {s.overdueCount} quá hạn
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">{rows.length} thành viên</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bảng tải trọng: thành viên × tuần */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Tải trọng theo thành viên</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Giờ cần (dự phòng 20%) / năng lực mỗi tuần · ⚠ = lịch dự kiến sẽ trễ deadline
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Chưa có thành viên trong team</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-3 font-medium w-32">Thành viên</th>
                  {weeks.map((w) => {
                    const isThis = w.key === 'this';
                    return (
                      <th
                        key={w.key}
                        className={`px-4 py-3 ${isThis ? 'bg-blue-100 text-blue-800 border-x-2 border-blue-400 text-sm font-bold' : 'font-medium'}`}
                      >
                        {w.label}
                        <span className={`block normal-case ${isThis ? 'font-medium text-blue-600' : 'font-normal text-gray-400'}`}>
                          {format(w.start, 'dd/MM')}–{format(w.end, 'dd/MM')}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.userId} className="hover:bg-gray-50">
                    <td className="px-3 py-3 w-32">
                      <p className="font-medium text-gray-900 truncate max-w-[120px]" title={row.userName}>{row.userName}</p>
                      <p className="text-xs text-gray-400">{row.workingHoursPerDay}h/ngày</p>
                    </td>
                    {row.cells.map((c, i) => {
                      const isThis = weeks[i].key === 'this';
                      const hasTasks = c.weekTasks.length > 0;
                      if (!hasTasks) {
                        return (
                          <td key={i} className={`px-4 py-3 text-gray-300 ${isThis ? 'bg-blue-50 border-x-2 border-blue-400' : ''}`}>
                            —
                          </td>
                        );
                      }
                      const pct = Math.min(c.ratio * 100, 100);
                      return (
                        <td
                          key={i}
                          onClick={() => setSelected({ row, weekIndex: i })}
                          className={`px-4 py-3 align-top cursor-pointer ${isThis ? 'bg-blue-50 border-x-2 border-blue-400 hover:bg-blue-100' : 'hover:bg-blue-100/60'}`}
                          title="Bấm để xem chi tiết task"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`font-semibold ${overloadColor(c.ratio)}`}>
                              {Math.round(c.demandHours)}h
                              <span className="text-gray-400 font-normal"> / {Math.round(c.capacityHours)}h</span>
                            </span>
                            {c.willMissCount > 0 && (
                              <span
                                className="text-xs text-red-600 flex items-center gap-0.5"
                                title={`${c.willMissCount} task dự kiến trễ deadline`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />{c.willMissCount}
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-1.5 rounded-full ${overloadBg(c.ratio)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {c.taskCount} task
                            {c.doneCount > 0 && <span className="text-green-500"> · {c.doneCount} xong</span>}
                          </p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task quá hạn trong cửa sổ đang xem */}
      {overdueTasks.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Task quá hạn ({overdueTasks.length})
          </h2>
          <div className="space-y-2">
            {overdueTasks.slice(0, 10).map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(t.project as Project | undefined)?.name} • {(t.assignee as { full_name?: string } | undefined)?.full_name ?? 'Chưa assign'}
                  </p>
                </div>
                <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                  {format(new Date(t.deadline), 'dd/MM/yyyy')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Dự án đang hoạt động */}
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
                    <p className="text-xs text-gray-500 mt-0.5">{(p.team as Team | undefined)?.name}</p>
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

      {/* Modal chi tiết task của 1 thành viên trong 1 tuần */}
      {selected && (() => {
        const cell = selected.row.cells[selected.weekIndex];
        const week = weeks[selected.weekIndex];
        return (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-900">{selected.row.userName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {week.label} ({format(week.start, 'dd/MM')}–{format(week.end, 'dd/MM')}) ·{' '}
                    <span className={overloadColor(cell.ratio)}>
                      {Math.round(cell.demandHours)}h / {Math.round(cell.capacityHours)}h
                    </span>
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-md text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-3 space-y-2">
                {cell.weekTasks.map((t) => {
                  const willMiss =
                    ACTIVE.includes(t.status) &&
                    !!t.projected_completion &&
                    new Date(t.projected_completion) > new Date(t.deadline);
                  return (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{t.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[t.status]}`}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                        <span>Ưu tiên: {PRIORITY_LABELS[t.priority]}</span>
                        <span>{t.estimated_hours}h</span>
                        <span className={willMiss ? 'text-red-600 font-medium' : ''}>
                          Hạn: {format(new Date(t.deadline), 'dd/MM/yyyy')}
                        </span>
                        {willMiss && (
                          <span className="text-red-600 flex items-center gap-0.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> dự kiến trễ
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
