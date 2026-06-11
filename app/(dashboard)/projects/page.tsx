'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Project, Team, ProjectStatus } from '@/types';
import { FolderOpen, Plus, X, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  on_hold: 'bg-yellow-100 text-yellow-700',
};
const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Đang hoạt động',
  completed: 'Hoàn thành',
  on_hold: 'Tạm dừng',
};

export default function ProjectsPage() {
  const { profile, activeRole } = useAuth();
  const supabase = createClient();

  const [projects, setProjects] = useState<(Project & { team: Team })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', description: '', team_id: '', status: 'active' as ProjectStatus,
    start_date: '', end_date: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const isLead = activeRole === 'lead_technical';

    let teamIds: string[] = [];
    if (!isLead) {
      const { data: memberOf } = await supabase.from('team_members').select('team_id').eq('user_id', profile.id);
      teamIds = memberOf?.map((m) => m.team_id) ?? [];
    }

    if (isLead || teamIds.length > 0) {
      const teamsQuery = supabase.from('teams').select('*');
      const { data: teamsData } = await (isLead ? teamsQuery : teamsQuery.in('id', teamIds));
      setTeams(teamsData ?? []);

      const projsQuery = supabase.from('projects').select('*, team:teams(*)').order('created_at', { ascending: false });
      const { data: projs } = await (isLead ? projsQuery : projsQuery.in('team_id', teamIds));
      setProjects(projs as any ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id, activeRole]);

  const openCreate = () => {
    setForm({ name: '', description: '', team_id: teams[0]?.id ?? '', status: 'active', start_date: '', end_date: '' });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    setForm({
      name: p.name, description: p.description ?? '', team_id: p.team_id,
      status: p.status, start_date: p.start_date ?? '', end_date: p.end_date ?? '',
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.team_id || !profile) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      team_id: form.team_id,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    if (editingId) {
      await supabase.from('projects').update(payload).eq('id', editingId);
    } else {
      await supabase.from('projects').insert({ ...payload, created_by: profile.id });
    }
    setShowForm(false); setSaving(false);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dự án</h1>
          <p className="text-gray-500 text-sm mt-0.5">{projects.length} dự án</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Thêm dự án
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? 'Sửa dự án' : 'Thêm dự án mới'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên dự án *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: ERP Implementation Phase 1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team *</label>
                <select className="input" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                  <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                  <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="btn-secondary">Hủy</button>
                <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Chưa có dự án nào</p>
        </div>
      ) : activeRole === 'lead_technical' ? (
        <div className="space-y-8">
          {teams.map((team) => {
            const teamProjects = projects.filter((p) => p.team_id === team.id);
            if (teamProjects.length === 0) return null;
            return (
              <div key={team.id}>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-gray-900">{team.name}</h2>
                    {team.description && <p className="text-xs text-gray-500 truncate">{team.description}</p>}
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
                    {teamProjects.length} dự án
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamProjects.map((p) => (
                    <div key={p.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(p)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                          <FolderOpen className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{p.name}</h3>
                      {p.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{p.description}</p>}
                      {(p.start_date || p.end_date) && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {p.start_date && format(new Date(p.start_date), 'dd/MM/yyyy')}
                          {p.start_date && p.end_date && ' → '}
                          {p.end_date && format(new Date(p.end_date), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(p)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[p.status]}`}>
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{p.name}</h3>
              <p className="text-xs text-gray-500 mb-3">{p.team?.name}</p>
              {p.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{p.description}</p>}
              {(p.start_date || p.end_date) && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {p.start_date && format(new Date(p.start_date), 'dd/MM/yyyy')}
                  {p.start_date && p.end_date && ' → '}
                  {p.end_date && format(new Date(p.end_date), 'dd/MM/yyyy')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
