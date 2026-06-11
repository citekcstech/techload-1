'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EstimateParam, Team } from '@/types';
import { Sliders, Plus, Pencil, Trash2, X, Clock } from 'lucide-react';

export default function EstimateParamsPage() {
  const { profile, activeRole } = useAuth();
  const supabase = createClient();

  const [params, setParams] = useState<EstimateParam[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', estimated_hours: 4, team_id: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: teamsData } = await supabase.from('teams').select('*');
    setTeams(teamsData ?? []);
    const { data: paramsData } = await supabase
      .from('estimate_params').select('*, team:teams(name)').order('name');
    setParams(paramsData ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id, activeRole]);

  const openCreate = () => {
    setForm({ name: '', description: '', estimated_hours: 4, team_id: teams[0]?.id ?? '' });
    setEditingId(null); setShowForm(true);
  };

  const openEdit = (p: EstimateParam) => {
    setForm({ name: p.name, description: p.description ?? '', estimated_hours: p.estimated_hours, team_id: p.team_id });
    setEditingId(p.id); setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.team_id || !profile) return;
    setSaving(true);
    const payload = { name: form.name.trim(), description: form.description.trim() || null, estimated_hours: form.estimated_hours, team_id: form.team_id };
    if (editingId) {
      await supabase.from('estimate_params').update(payload).eq('id', editingId);
    } else {
      await supabase.from('estimate_params').insert({ ...payload, created_by: profile.id });
    }
    setShowForm(false); setSaving(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Xóa estimate param này?')) return;
    await supabase.from('estimate_params').delete().eq('id', id);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimate Params</h1>
          <p className="text-gray-500 text-sm mt-0.5">Định nghĩa thời gian chuẩn cho từng loại task</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Thêm param
        </button>
      </div>

      {/* Examples hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 Ví dụ estimate params:</p>
        <ul className="space-y-0.5 text-blue-700">
          <li>• Thêm 1–3 field vào màn hình → 4 giờ</li>
          <li>• Enhance thêm field TCode chuẩn → 6 giờ</li>
          <li>• Tạo report đơn giản → 8 giờ</li>
          <li>• Tích hợp API bên thứ 3 → 16 giờ</li>
        </ul>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? 'Sửa param' : 'Thêm estimate param'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên loại task *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Thêm 1-3 field vào màn hình" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Điều kiện áp dụng, phạm vi..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số giờ ước tính chuẩn *</label>
                <input type="number" className="input" min={0.5} step={0.5} value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Áp dụng cho team</label>
                <select className="input" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
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

      {params.length === 0 ? (
        <div className="card p-12 text-center">
          <Sliders className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Chưa có estimate param nào. Hãy thêm loại task đầu tiên!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {params.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{p.name}</h3>
              {p.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>}
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-purple-700">{p.estimated_hours}h</span>
                <span className="text-xs text-gray-400">{(p as any).team?.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
