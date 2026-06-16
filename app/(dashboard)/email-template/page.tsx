'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Save, Mail, Eye, Code2, RefreshCw } from 'lucide-react';

const VARIABLES = [
  { key: '{{employeeName}}', label: 'Tên người nhận' },
  { key: '{{taskTitle}}', label: 'Tiêu đề task' },
  { key: '{{deadlineStr}}', label: 'Deadline' },
  { key: '{{hours}}', label: 'Số giờ' },
  { key: '{{priority}}', label: 'Ưu tiên' },
  { key: '{{taskLink}}', label: 'Link task' },
];

const PREVIEW_VARS: Record<string, string> = {
  '{{employeeName}}': 'Nguyễn Văn A',
  '{{taskTitle}}': 'Xử lý lỗi màn hình báo cáo tháng',
  '{{deadlineStr}}': '31/12/2025 17:00',
  '{{hours}}': '4',
  '{{priority}}': 'Cao',
  '{{taskLink}}': '#',
};

const DEFAULT_SUBJECT = 'RE: {{taskTitle}}';

const DEFAULT_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #333; }
  .greeting { color: #005870; font-weight: bold; font-size: 16px; }
  .link a { color: #005870; text-decoration: underline; }
  .signature { margin-top: 30px; }
  .citek { color: #005870; font-weight: bold; font-size: 22px; margin: 4px 0; }
  .task-info { background: #f0f9fb; border-left: 4px solid #005870; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
  .task-info p { margin: 4px 0; font-size: 13px; color: #333; }
  .task-title { font-weight: bold; font-size: 15px; color: #005870; margin-bottom: 8px !important; }
</style></head><body>
<p class="greeting">Dear {{employeeName}},</p>
<p>Bạn được assign một task mới. Vui lòng nhấn vào link bên dưới để xem chi tiết.</p>
<div class="task-info">
  <p class="task-title">{{taskTitle}}</p>
  <p>Deadline: <strong>{{deadlineStr}}</strong></p>
  <p>Số giờ ước tính: <strong>{{hours}}h</strong></p>
  <p>Ưu tiên: <strong>{{priority}}</strong></p>
</div>
<p class="link"><a href="{{taskLink}}" target="_blank">{{taskLink}}</a></p>
<div class="signature">
  <p>Thanks &amp; Best Regards,</p>
  <p class="citek">Citek</p>
  <p style="font-size:12px; color:#666;">
    Address: No. 75, Str. 41, Van Phuc City, Hiep Binh Phuoc Ward,
    Thu Duc City, Ho Chi Minh City, Vietnam<br>
    Website: <a href="https://www.citek.vn">www.citek.vn</a>
  </p>
</div>
</body></html>`;

function applyVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(k, v), template);
}

export default function EmailTemplatePage() {
  const { profile, activeRole } = useAuth();
  const supabase = createClient();

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML);
  const [tab, setTab] = useState<'editor' | 'preview'>('editor');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const isLead = activeRole === 'lead_technical';

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('email_templates')
        .select('subject, html_body, updated_at')
        .eq('name', 'default')
        .single();
      if (data) {
        setSubject(data.subject);
        setHtmlBody(data.html_body);
        setSavedAt(data.updated_at);
      }
      setLoading(false);
    };
    load();
  }, []);

  const previewHtml = useMemo(() => applyVars(htmlBody, PREVIEW_VARS), [htmlBody]);
  const previewSubject = useMemo(() => applyVars(subject, PREVIEW_VARS), [subject]);

  const insertVar = (key: string) => {
    setHtmlBody((prev) => prev + key);
  };

  const save = async () => {
    if (!profile || !isLead) return;
    setSaving(true);
    setMsg('');
    const { error } = await supabase.from('email_templates').upsert(
      { name: 'default', subject, html_body: htmlBody, updated_by: profile.id, updated_at: new Date().toISOString() },
      { onConflict: 'name' }
    );
    setSaving(false);
    if (error) {
      setMsg('Lưu thất bại: ' + error.message);
    } else {
      setSavedAt(new Date().toISOString());
      setMsg('Đã lưu thành công.');
    }
  };

  const reset = () => {
    setSubject(DEFAULT_SUBJECT);
    setHtmlBody(DEFAULT_HTML);
    setMsg('');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" /> Mẫu email thông báo task
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Template được dùng khi tạo task. Dùng{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">{'{{variable}}'}</code>{' '}
            để chèn dữ liệu động.
            {savedAt && (
              <span className="ml-2 text-gray-400">
                · Cập nhật lần cuối: {new Date(savedAt).toLocaleString('vi-VN')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLead && (
            <button onClick={reset} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Khôi phục mặc định
            </button>
          )}
          {isLead && (
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu template'}
            </button>
          )}
        </div>
      </div>

      {!isLead && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg p-3">
          Bạn đang xem template email. Chỉ <strong>Lead Technical</strong> mới có thể chỉnh sửa.
        </div>
      )}

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${msg.startsWith('Đã') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg}
        </div>
      )}

      {/* Subject */}
      <div className="card p-4 space-y-2">
        <label className="block text-sm font-medium text-gray-700">Tiêu đề email</label>
        <input
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={!isLead}
          placeholder="RE: {{taskTitle}}"
        />
        <p className="text-xs text-gray-400">Preview: <span className="text-gray-700">{previewSubject}</span></p>
      </div>

      {/* Variables */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Biến có thể dùng trong nội dung</p>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => isLead && insertVar(key)}
              disabled={!isLead}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-mono hover:bg-blue-100 disabled:cursor-default disabled:opacity-60 transition-colors"
              title={label}
            >
              {key}
              <span className="font-sans text-blue-500 font-normal">— {label}</span>
            </button>
          ))}
        </div>
        {isLead && <p className="text-xs text-gray-400 mt-2">Click để chèn vào cuối nội dung HTML.</p>}
      </div>

      {/* Editor / Preview tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('editor')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'editor' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code2 className="w-4 h-4" /> Soạn thảo HTML
          </button>
          <button
            onClick={() => setTab('preview')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'preview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye className="w-4 h-4" /> Xem trước
          </button>
        </div>

        {tab === 'editor' ? (
          <div className="p-4">
            <textarea
              className="input font-mono text-xs resize-y w-full"
              rows={24}
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              disabled={!isLead}
              spellCheck={false}
              placeholder="Nhập nội dung HTML..."
            />
          </div>
        ) : (
          <div>
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex gap-4">
              <span><span className="font-medium">Tiêu đề:</span> {previewSubject}</span>
              <span className="text-gray-400">· Dữ liệu mẫu</span>
            </div>
            <div className="p-6">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
