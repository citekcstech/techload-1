'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Task, TaskReopen, Profile, Project, Team, TeamMember, ReopenRootCause, ROOT_CAUSE_LABELS } from '@/types';
import { BarChart2, RefreshCw, AlertTriangle, TrendingUp, Target, Users, Download } from 'lucide-react';

// Xuất dữ liệu ra CSV (UTF-8 có BOM) — Excel mở trực tiếp, hiển thị đúng tiếng Việt
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const BOM = '﻿'; // BOM giúp Excel nhận diện UTF-8
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Rework types ─────────────────────────────────────────────────────────────

interface ReopenWithTask extends TaskReopen {
  task?: Task & { project?: Project };
  profile?: Profile;
}

interface ProjectStat {
  projectId: string;
  projectName: string;
  totalTasks: number;
  reopenedTasks: number;
  reopenCount: number;
  rate: number;
}

interface AssigneeStat {
  userId: string;
  userName: string;
  totalTasks: number;
  reopenedTasks: number;
  reopenCount: number;
  rate: number;
}

interface RootCauseStat {
  cause: ReopenRootCause | 'unknown';
  label: string;
  count: number;
  pct: number;
}

// ─── Estimate Accuracy types ──────────────────────────────────────────────────

interface AccuracyTask {
  id: string;
  title: string;
  estimated_hours: number;
  actual_hours: number;
  baseline_estimated_hours: number | null;
  status: string;
  assignee: { full_name: string } | null;
  project: { name: string } | null;
}

// ─── Utilization types ────────────────────────────────────────────────────────

interface UtilizationMember {
  userId: string;
  userName: string;
  teamName: string;
  totalActualHours: number;
  totalEstimatedHours: number;
  taskCount: number;
}

type ActiveTab = 'rework' | 'accuracy' | 'utilization';

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('rework');

  // Rework state
  const [reopens, setReopens] = useState<ReopenWithTask[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [reworkLoading, setReworkLoading] = useState(true);
  const [reworkError, setReworkError] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  // Accuracy state
  const [accuracyTasks, setAccuracyTasks] = useState<AccuracyTask[]>([]);
  const [accuracyLoading, setAccuracyLoading] = useState(false);
  const [accuracyError, setAccuracyError] = useState('');
  const [accuracyFilterProject, setAccuracyFilterProject] = useState('');
  const [accuracyLoaded, setAccuracyLoaded] = useState(false);

  // Utilization state
  const [utilMembers, setUtilMembers] = useState<UtilizationMember[]>([]);
  const [utilLoading, setUtilLoading] = useState(false);
  const [utilError, setUtilError] = useState('');
  const [utilLoaded, setUtilLoaded] = useState(false);

  // Load rework data on mount
  useEffect(() => {
    loadRework();
  }, []);

  // Lazy-load per tab
  useEffect(() => {
    if (activeTab === 'accuracy' && !accuracyLoaded) loadAccuracy();
    if (activeTab === 'utilization' && !utilLoaded) loadUtilization();
  }, [activeTab]);

  // ─── Rework loader ──────────────────────────────────────────────────────────

  async function loadRework() {
    setReworkLoading(true);
    setReworkError('');

    const { data: reopenData, error: e1 } = await supabase
      .from('task_reopens')
      .select(`
        *,
        profile:profiles(id, full_name, email),
        task:tasks(
          id, title, status, assignee_id,
          project:projects(id, name),
          assignee:profiles!tasks_assignee_id_fkey(id, full_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (e1) { setReworkError(e1.message); setReworkLoading(false); return; }

    const { data: taskData, error: e2 } = await supabase
      .from('tasks')
      .select('id, title, status, assignee_id, project_id, project:projects(id, name), assignee:profiles!tasks_assignee_id_fkey(id, full_name)');

    if (e2) { setReworkError(e2.message); setReworkLoading(false); return; }

    setReopens((reopenData ?? []) as ReopenWithTask[]);
    setAllTasks((taskData ?? []) as unknown as Task[]);
    setReworkLoading(false);
  }

  // ─── Accuracy loader ────────────────────────────────────────────────────────

  async function loadAccuracy() {
    setAccuracyLoading(true);
    setAccuracyError('');

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, estimated_hours, actual_hours, baseline_estimated_hours, status, assignee:profiles!tasks_assignee_id_fkey(full_name), project:projects(name)')
      .gt('actual_hours', 0)
      .order('created_at', { ascending: false });

    if (error) { setAccuracyError(error.message); setAccuracyLoading(false); return; }

    setAccuracyTasks((data ?? []) as unknown as AccuracyTask[]);
    setAccuracyLoaded(true);
    setAccuracyLoading(false);
  }

  // ─── Utilization loader ─────────────────────────────────────────────────────

  async function loadUtilization() {
    setUtilLoading(true);
    setUtilError('');

    const { data: memberData, error: e1 } = await supabase
      .from('team_members')
      .select('*, profile:profiles(id, full_name), team:teams(name)');

    if (e1) { setUtilError(e1.message); setUtilLoading(false); return; }

    const { data: taskData, error: e2 } = await supabase
      .from('tasks')
      .select('assignee_id, actual_hours, estimated_hours')
      .gt('actual_hours', 0);

    if (e2) { setUtilError(e2.message); setUtilLoading(false); return; }

    const members = (memberData ?? []) as (TeamMember & { profile: Profile; team: Team })[];
    const tasks = (taskData ?? []) as { assignee_id: string | null; actual_hours: number; estimated_hours: number }[];

    const result: UtilizationMember[] = members.map((m) => {
      const myTasks = tasks.filter((t) => t.assignee_id === m.user_id);
      return {
        userId: m.user_id,
        userName: m.profile?.full_name ?? 'Không rõ',
        teamName: m.team?.name ?? 'Không rõ',
        totalActualHours: myTasks.reduce((s, t) => s + (t.actual_hours ?? 0), 0),
        totalEstimatedHours: myTasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0),
        taskCount: myTasks.length,
      };
    });

    setUtilMembers(result.sort((a, b) => b.totalActualHours - a.totalActualHours));
    setUtilLoaded(true);
    setUtilLoading(false);
  }

  // ─── Rework derived data ────────────────────────────────────────────────────

  const reworkProjects = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((t) => { if (t.project) map.set(t.project.id, t.project.name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks]);

  const reworkAssignees = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((t) => { if (t.assignee_id && t.assignee) map.set(t.assignee_id, (t.assignee as Profile).full_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks]);

  const filteredReopens = useMemo(() => reopens.filter((r) => {
    if (filterProject && r.task?.project?.id !== filterProject) return false;
    if (filterAssignee && r.task?.assignee_id !== filterAssignee) return false;
    return true;
  }), [reopens, filterProject, filterAssignee]);

  const filteredTasks = useMemo(() => allTasks.filter((t) => {
    if (filterProject && t.project_id !== filterProject) return false;
    if (filterAssignee && t.assignee_id !== filterAssignee) return false;
    return true;
  }), [allTasks, filterProject, filterAssignee]);

  const projectStats = useMemo((): ProjectStat[] => {
    const map = new Map<string, ProjectStat>();
    filteredTasks.forEach((t) => {
      if (!t.project) return;
      const key = t.project.id;
      if (!map.has(key)) map.set(key, { projectId: key, projectName: t.project.name, totalTasks: 0, reopenedTasks: 0, reopenCount: 0, rate: 0 });
      map.get(key)!.totalTasks++;
      if (t.status === 'reopened') map.get(key)!.reopenedTasks++;
    });
    filteredReopens.forEach((r) => {
      if (!r.task?.project) return;
      const key = r.task.project.id;
      if (map.has(key)) map.get(key)!.reopenCount++;
    });
    return Array.from(map.values())
      .map((s) => ({ ...s, rate: s.totalTasks > 0 ? (s.reopenCount / s.totalTasks) * 100 : 0 }))
      .sort((a, b) => b.reopenCount - a.reopenCount);
  }, [filteredTasks, filteredReopens]);

  const assigneeStats = useMemo((): AssigneeStat[] => {
    const map = new Map<string, AssigneeStat>();
    filteredTasks.forEach((t) => {
      if (!t.assignee_id || !t.assignee) return;
      const key = t.assignee_id;
      if (!map.has(key)) map.set(key, { userId: key, userName: (t.assignee as Profile).full_name, totalTasks: 0, reopenedTasks: 0, reopenCount: 0, rate: 0 });
      map.get(key)!.totalTasks++;
      if (t.status === 'reopened') map.get(key)!.reopenedTasks++;
    });
    filteredReopens.forEach((r) => {
      if (!r.task?.assignee_id) return;
      const key = r.task.assignee_id;
      if (map.has(key)) map.get(key)!.reopenCount++;
    });
    return Array.from(map.values())
      .map((s) => ({ ...s, rate: s.totalTasks > 0 ? (s.reopenCount / s.totalTasks) * 100 : 0 }))
      .sort((a, b) => b.reopenCount - a.reopenCount);
  }, [filteredTasks, filteredReopens]);

  const rootCauseStats = useMemo((): RootCauseStat[] => {
    const map = new Map<string, number>();
    filteredReopens.forEach((r) => { const key = r.root_cause ?? 'unknown'; map.set(key, (map.get(key) ?? 0) + 1); });
    const total = filteredReopens.length;
    return Array.from(map.entries())
      .map(([cause, count]) => ({
        cause: cause as ReopenRootCause | 'unknown',
        label: cause === 'unknown' ? 'Chưa phân loại' : ROOT_CAUSE_LABELS[cause as ReopenRootCause],
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReopens]);

  const totalReopenRate = filteredTasks.length > 0 ? (filteredReopens.length / filteredTasks.length) * 100 : 0;

  // ─── Accuracy derived data ──────────────────────────────────────────────────

  const accuracyProjects = useMemo(() => {
    const map = new Map<string, string>();
    accuracyTasks.forEach((t) => { if (t.project?.name) map.set(t.project.name, t.project.name); });
    return Array.from(map.keys()).map((name) => ({ name }));
  }, [accuracyTasks]);

  const filteredAccuracyTasks = useMemo(() => {
    if (!accuracyFilterProject) return accuracyTasks;
    return accuracyTasks.filter((t) => t.project?.name === accuracyFilterProject);
  }, [accuracyTasks, accuracyFilterProject]);

  const accuracySummary = useMemo(() => {
    if (filteredAccuracyTasks.length === 0) return null;
    const deviations = filteredAccuracyTasks.map((t) => t.actual_hours - t.estimated_hours);
    const avgDeviation = deviations.reduce((s, d) => s + d, 0) / deviations.length;
    const pctDeviations = filteredAccuracyTasks.map((t) =>
      t.estimated_hours > 0 ? ((t.actual_hours - t.estimated_hours) / t.estimated_hours) * 100 : 0
    );
    const overCount = pctDeviations.filter((p) => p > 0).length;
    const underCount = pctDeviations.filter((p) => p <= 0).length;
    return {
      avgDeviation,
      pctOver: (overCount / filteredAccuracyTasks.length) * 100,
      pctUnder: (underCount / filteredAccuracyTasks.length) * 100,
    };
  }, [filteredAccuracyTasks]);

  // ─── Utilization derived data ───────────────────────────────────────────────

  const maxActualHours = useMemo(
    () => Math.max(...utilMembers.map((m) => m.totalActualHours), 1),
    [utilMembers]
  );

  // ─── Tab pill helpers ───────────────────────────────────────────────────────

  function tabClass(tab: ActiveTab) {
    return activeTab === tab
      ? 'px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white shadow-sm'
      : 'px-4 py-2 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100';
  }

  // ─── Xuất Excel theo tab đang xem ─────────────────────────────────────────────

  function exportCurrentTab() {
    if (activeTab === 'rework') {
      downloadCSV(
        'bao-cao-rework.csv',
        ['Task', 'Dự án', 'Assignee', 'Nguyên nhân', 'Lý do', 'Ngày re-open'],
        filteredReopens.map((r) => [
          r.task?.title ?? r.task_id,
          r.task?.project?.name ?? '',
          (r.profile as Profile | undefined)?.full_name ?? '',
          r.root_cause ? ROOT_CAUSE_LABELS[r.root_cause] : 'Chưa phân loại',
          r.reason ?? '',
          new Date(r.created_at).toLocaleDateString('vi-VN'),
        ])
      );
    } else if (activeTab === 'accuracy') {
      downloadCSV(
        'bao-cao-do-chinh-xac-estimate.csv',
        ['Task', 'Dự án', 'Assignee', 'Baseline (h)', 'Estimate (h)', 'Thực tế (h)', 'Sai lệch (h)', 'Sai lệch (%)'],
        filteredAccuracyTasks.map((t) => {
          const dev = t.actual_hours - t.estimated_hours;
          const pct = t.estimated_hours > 0 ? (dev / t.estimated_hours) * 100 : 0;
          return [
            t.title,
            t.project?.name ?? '',
            t.assignee?.full_name ?? '',
            t.baseline_estimated_hours ?? '',
            t.estimated_hours,
            t.actual_hours,
            dev.toFixed(1),
            pct.toFixed(1),
          ];
        })
      );
    } else {
      downloadCSV(
        'bao-cao-utilization.csv',
        ['Thành viên', 'Team', 'Giờ thực tế', 'Giờ estimate', 'Tổng tasks'],
        utilMembers.map((m) => [
          m.userName, m.teamName, m.totalActualHours.toFixed(1), m.totalEstimatedHours.toFixed(1), m.taskCount,
        ])
      );
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo</h1>
        </div>
        <button onClick={exportCurrentTab} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-full w-fit">
        <button onClick={() => setActiveTab('rework')} className={tabClass('rework')}>
          Rework
        </button>
        <button onClick={() => setActiveTab('accuracy')} className={tabClass('accuracy')}>
          Độ chính xác Estimate
        </button>
        <button onClick={() => setActiveTab('utilization')} className={tabClass('utilization')}>
          Utilization
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1 — REWORK
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rework' && (
        <>
          {reworkLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {reworkError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{reworkError}</div>
              )}

              {/* Filters */}
              <div className="card flex flex-wrap gap-4">
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dự án</label>
                  <select className="input text-sm" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                    <option value="">Tất cả dự án</option>
                    {reworkProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
                  <select className="input text-sm" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
                    <option value="">Tất cả</option>
                    {reworkAssignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setFilterProject(''); setFilterAssignee(''); }} className="btn-secondary text-sm">
                    Xóa bộ lọc
                  </button>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card text-center">
                  <p className="text-3xl font-bold text-gray-900">{filteredTasks.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Tổng tasks</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-orange-600">{filteredReopens.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Lần re-open</p>
                </div>
                <div className="card text-center">
                  <p className={`text-3xl font-bold ${totalReopenRate >= 20 ? 'text-red-600' : totalReopenRate >= 10 ? 'text-orange-500' : 'text-green-600'}`}>
                    {totalReopenRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Tỷ lệ rework</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {filteredReopens.filter((r) => r.root_cause).length}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Đã phân loại</p>
                </div>
              </div>

              {/* Root cause chart */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" /> Phân tích nguyên nhân gốc
                </h2>
                {rootCauseStats.length === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có dữ liệu re-open.</p>
                ) : (
                  <div className="space-y-3">
                    {rootCauseStats.map((s) => (
                      <div key={s.cause}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{s.label}</span>
                          <span className="text-gray-500">{s.count} lần ({s.pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-purple-500" style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Project stats */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" /> Rework theo dự án
                </h2>
                {projectStats.length === 0 ? (
                  <p className="text-sm text-gray-400">Không có dữ liệu.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-4 font-medium text-gray-600">Dự án</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Tasks</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Re-open</th>
                          <th className="text-right py-2 pl-2 font-medium text-gray-600">Tỷ lệ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectStats.map((s) => (
                          <tr key={s.projectId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 pr-4 text-gray-900">{s.projectName}</td>
                            <td className="py-2 px-2 text-right text-gray-600">{s.totalTasks}</td>
                            <td className="py-2 px-2 text-right font-medium text-orange-600">{s.reopenCount}</td>
                            <td className="py-2 pl-2 text-right">
                              <span className={`font-semibold ${s.rate >= 20 ? 'text-red-600' : s.rate >= 10 ? 'text-orange-500' : 'text-green-600'}`}>
                                {s.rate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Assignee stats */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-500" /> Rework theo assignee
                </h2>
                {assigneeStats.length === 0 ? (
                  <p className="text-sm text-gray-400">Không có dữ liệu.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-4 font-medium text-gray-600">Thành viên</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Tasks</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Re-open</th>
                          <th className="text-right py-2 pl-2 font-medium text-gray-600">Tỷ lệ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assigneeStats.map((s) => (
                          <tr key={s.userId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 pr-4 text-gray-900">{s.userName}</td>
                            <td className="py-2 px-2 text-right text-gray-600">{s.totalTasks}</td>
                            <td className="py-2 px-2 text-right font-medium text-orange-600">{s.reopenCount}</td>
                            <td className="py-2 pl-2 text-right">
                              <span className={`font-semibold ${s.rate >= 20 ? 'text-red-600' : s.rate >= 10 ? 'text-orange-500' : 'text-green-600'}`}>
                                {s.rate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent reopens log */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Lịch sử re-open gần đây</h2>
                {filteredReopens.length === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có re-open nào.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredReopens.slice(0, 20).map((r) => (
                      <div key={r.id} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <RefreshCw className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{r.task?.title ?? r.task_id}</p>
                          <p className="text-xs text-gray-500">{r.task?.project?.name} · {(r.profile as Profile | undefined)?.full_name ?? 'Không rõ'}</p>
                          {r.root_cause && (
                            <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {ROOT_CAUSE_LABELS[r.root_cause]}
                            </span>
                          )}
                          {r.reason && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.reason}</p>}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                          {new Date(r.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    ))}
                    {filteredReopens.length > 20 && (
                      <p className="text-xs text-gray-400 text-center pt-1">Chỉ hiển thị 20 gần nhất trong tổng {filteredReopens.length}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2 — ESTIMATE ACCURACY
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'accuracy' && (
        <>
          {accuracyLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {accuracyError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{accuracyError}</div>
              )}

              {/* Filter */}
              <div className="card flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Dự án</label>
                  <select className="input text-sm" value={accuracyFilterProject} onChange={(e) => setAccuracyFilterProject(e.target.value)}>
                    <option value="">Tất cả dự án</option>
                    {accuracyProjects.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <button onClick={() => setAccuracyFilterProject('')} className="btn-secondary text-sm">Xóa bộ lọc</button>
                </div>
              </div>

              {/* Summary KPI */}
              {accuracySummary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card text-center">
                    <p className={`text-3xl font-bold ${accuracySummary.avgDeviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {accuracySummary.avgDeviation > 0 ? '+' : ''}{accuracySummary.avgDeviation.toFixed(1)}h
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Sai lệch trung bình</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-3xl font-bold text-red-600">{accuracySummary.pctOver.toFixed(1)}%</p>
                    <p className="text-sm text-gray-500 mt-1">% tasks vượt estimate</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-3xl font-bold text-green-600">{accuracySummary.pctUnder.toFixed(1)}%</p>
                    <p className="text-sm text-gray-500 mt-1">% tasks dưới estimate</p>
                  </div>
                </div>
              )}

              {/* Detail table */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" /> Chi tiết sai lệch estimate
                </h2>
                {filteredAccuracyTasks.length === 0 ? (
                  <p className="text-sm text-gray-400">Không có task nào có giờ thực tế.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-3 font-medium text-gray-600">Task</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">Dự án</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">Assignee</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Baseline (h)</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Estimate (h)</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Thực tế (h)</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Sai lệch</th>
                          <th className="text-right py-2 pl-2 font-medium text-gray-600">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccuracyTasks.map((t) => {
                          const deviation = t.actual_hours - t.estimated_hours;
                          const pct = t.estimated_hours > 0 ? (deviation / t.estimated_hours) * 100 : 0;
                          const isOver = pct > 20;
                          const deviationClass = isOver ? 'text-red-600 font-semibold' : deviation > 0 ? 'text-orange-500' : 'text-green-600';
                          return (
                            <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 pr-3 text-gray-900 max-w-48 truncate">{t.title}</td>
                              <td className="py-2 px-2 text-gray-600">{t.project?.name ?? '—'}</td>
                              <td className="py-2 px-2 text-gray-600">{t.assignee?.full_name ?? '—'}</td>
                              <td className="py-2 px-2 text-right text-gray-500">
                                {t.baseline_estimated_hours != null ? t.baseline_estimated_hours : '—'}
                              </td>
                              <td className="py-2 px-2 text-right text-gray-700">{t.estimated_hours}</td>
                              <td className="py-2 px-2 text-right text-gray-700">{t.actual_hours}</td>
                              <td className={`py-2 px-2 text-right ${deviationClass}`}>
                                {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}h
                              </td>
                              <td className={`py-2 pl-2 text-right ${deviationClass}`}>
                                {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3 — UTILIZATION
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'utilization' && (
        <>
          {utilLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {utilError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{utilError}</div>
              )}

              {/* Table */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" /> Utilization theo thành viên
                </h2>
                {utilMembers.length === 0 ? (
                  <p className="text-sm text-gray-400">Không có dữ liệu.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-4 font-medium text-gray-600">Thành viên</th>
                          <th className="text-left py-2 px-2 font-medium text-gray-600">Team</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Giờ thực tế</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Giờ estimate</th>
                          <th className="text-right py-2 pl-2 font-medium text-gray-600">Tổng tasks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utilMembers.map((m) => (
                          <tr key={m.userId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 pr-4 text-gray-900 font-medium">{m.userName}</td>
                            <td className="py-2 px-2 text-gray-600">{m.teamName}</td>
                            <td className="py-2 px-2 text-right text-blue-700 font-semibold">{m.totalActualHours.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right text-gray-600">{m.totalEstimatedHours.toFixed(1)}</td>
                            <td className="py-2 pl-2 text-right text-gray-600">{m.taskCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bar chart */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Biểu đồ giờ thực tế</h2>
                {utilMembers.length === 0 ? (
                  <p className="text-sm text-gray-400">Không có dữ liệu.</p>
                ) : (
                  <div className="space-y-3">
                    {utilMembers.map((m) => {
                      const actualPct = maxActualHours > 0 ? (m.totalActualHours / maxActualHours) * 100 : 0;
                      const estimatedPct = maxActualHours > 0 ? (m.totalEstimatedHours / maxActualHours) * 100 : 0;
                      return (
                        <div key={m.userId}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700 font-medium">{m.userName}</span>
                            <span className="text-gray-500">
                              {m.totalActualHours.toFixed(1)}h thực tế / {m.totalEstimatedHours.toFixed(1)}h estimate
                            </span>
                          </div>
                          <div className="relative w-full bg-gray-100 rounded-full h-3">
                            {/* Estimated bar (background) */}
                            <div
                              className="absolute top-0 left-0 h-3 rounded-full bg-gray-300"
                              style={{ width: `${Math.min(estimatedPct, 100)}%` }}
                            />
                            {/* Actual bar (foreground) */}
                            <div
                              className="absolute top-0 left-0 h-3 rounded-full bg-blue-500"
                              style={{ width: `${Math.min(actualPct, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Giờ thực tế</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-gray-300" /> Giờ estimate</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
