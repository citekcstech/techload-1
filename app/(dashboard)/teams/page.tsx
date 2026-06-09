'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Team, TeamMember, Profile } from '@/types';
import { Users, Plus, Trash2, UserPlus, X } from 'lucide-react';

export default function TeamsPage() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<(TeamMember & { profile: Profile })[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showAddMember, setShowAddMember] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [workingHours, setWorkingHours] = useState(8);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    const { data: memberOf } = await supabase
      .from('team_members').select('team_id').eq('user_id', profile.id);
    const teamIds = memberOf?.map((m) => m.team_id) ?? [];

    if (teamIds.length > 0) {
      const { data: teamsData } = await supabase.from('teams').select('*').in('id', teamIds);
      setTeams(teamsData ?? []);

      const { data: membersData } = await supabase
        .from('team_members')
        .select('*, profile:profiles(id, full_name, email, roles, active_role)')
        .in('team_id', teamIds);
      setMembers(membersData as any ?? []);
    }

    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, roles, active_role');
    setAllProfiles(profiles as Profile[] ?? []);

    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const createTeam = async () => {
    if (!teamName.trim() || !profile) return;
    setSaving(true);
    const { data: team } = await supabase
      .from('teams')
      .insert({ name: teamName.trim(), description: teamDesc.trim() || null, created_by: profile.id })
      .select()
      .single();
    if (team) {
      await supabase.from('team_members').insert({
        team_id: team.id, user_id: profile.id, working_hours_per_day: 8,
      });
    }
    setTeamName(''); setTeamDesc(''); setShowCreateTeam(false); setSaving(false);
    load();
  };

  const addMember = async (teamId: string) => {
    if (!selectedUserId) return;
    setSaving(true);
    const normalizedWorkingHours = Math.max(1, Math.min(workingHours, 8));
    await supabase.from('team_members').upsert({
      team_id: teamId, user_id: selectedUserId, working_hours_per_day: normalizedWorkingHours,
    }, { onConflict: 'team_id,user_id' });
    setSelectedUserId(''); setShowAddMember(null); setSaving(false);
    load();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Xóa thành viên khỏi team?')) return;
    await supabase.from('team_members').delete().eq('id', memberId);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams & Thành viên</h1>
          <p className="text-gray-500 text-sm mt-0.5">{teams.length} team</p>
        </div>
        <button onClick={() => setShowCreateTeam(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tạo team
        </button>
      </div>

      {/* Create team modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Tạo team mới</h2>
              <button onClick={() => setShowCreateTeam(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên team *</label>
                <input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="VD: Team S4HANA" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea className="input resize-none" rows={3} value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} placeholder="Mô tả ngắn về team..." />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreateTeam(false)} className="btn-secondary">Hủy</button>
                <button onClick={createTeam} disabled={saving || !teamName.trim()} className="btn-primary">
                  {saving ? 'Đang tạo...' : 'Tạo team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Bạn chưa thuộc team nào. Hãy tạo team đầu tiên!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const teamMembers = members.filter((m) => m.team_id === team.id);
            return (
              <div key={team.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{team.name}</h2>
                    {team.description && <p className="text-sm text-gray-500 mt-0.5">{team.description}</p>}
                  </div>
                  <button
                    onClick={() => setShowAddMember(team.id)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <UserPlus className="w-4 h-4" /> Thêm thành viên
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teamMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700">
                        {m.profile?.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.profile?.full_name}</p>
                        <p className="text-xs text-gray-500">{m.working_hours_per_day}h/ngày</p>
                      </div>
                      <button onClick={() => removeMember(m.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add member modal */}
                {showAddMember === team.id && (
                  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Thêm thành viên</h2>
                        <button onClick={() => setShowAddMember(null)}><X className="w-5 h-5 text-gray-400" /></button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Chọn người dùng</label>
                          <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                            <option value="">-- Chọn --</option>
                            {allProfiles
                              .filter((p) => !teamMembers.some((m) => m.user_id === p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Giờ làm việc / ngày</label>
                          <input type="number" className="input" min={1} max={8} value={workingHours} onChange={(e) => setWorkingHours(Math.max(1, Math.min(Number(e.target.value), 8)))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowAddMember(null)} className="btn-secondary">Hủy</button>
                          <button onClick={() => addMember(team.id)} disabled={saving || !selectedUserId} className="btn-primary">
                            {saving ? 'Đang thêm...' : 'Thêm'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
