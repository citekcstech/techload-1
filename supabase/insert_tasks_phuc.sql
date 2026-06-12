-- Insert 3 tasks assign cho Phúc Nguyễn (f1dcd491-6824-4ec0-96a0-5c68246bcca0)
-- Chạy trong Supabase SQL Editor

DO $$
DECLARE
  v_assignee UUID := 'f1dcd491-6824-4ec0-96a0-5c68246bcca0';
  v_creator  UUID;
  v_proj_vasg UUID;
  v_proj_apa  UUID;
BEGIN
  SELECT id INTO v_creator  FROM profiles WHERE email = 'trang.tran@citek.vn' LIMIT 1;
  SELECT id INTO v_proj_vasg FROM projects WHERE name = 'VASG' LIMIT 1;
  SELECT id INTO v_proj_apa  FROM projects WHERE name = 'APA'  LIMIT 1;

  IF v_proj_vasg IS NULL THEN RAISE EXCEPTION 'Không tìm thấy project VASG'; END IF;
  IF v_proj_apa  IS NULL THEN RAISE EXCEPTION 'Không tìm thấy project APA';  END IF;
  IF v_creator   IS NULL THEN RAISE EXCEPTION 'Không tìm thấy user trang.tran@citek.vn'; END IF;

  INSERT INTO tasks (
    title, project_id, assignee_id, created_by,
    status, priority, severity, request_type,
    module, source, requester, business_impact,
    estimated_hours, deadline
  ) VALUES
  (
    '#34101 - Bổ sung/điều chỉnh Enhance field và chỉ tiêu báo cáo FBL5N',
    v_proj_vasg, v_assignee, v_creator,
    'pending', 'medium', 'medium', 'improvement',
    'FBL5N', 'client', 'Nhi Nguyen', 'Trung bình',
    4, '2026-06-10 17:30:00+07'
  ),
  (
    '#34761 - Điều Chỉnh Form In Excel, PDF Phiếu Xuất Nguyên Liệu ZPI04B',
    v_proj_apa, v_assignee, v_creator,
    'pending', 'medium', 'medium', 'other',
    'ZPI04B', 'client', 'Huy Nguyen', 'Trung bình',
    4, '2026-06-10 17:30:00+07'
  ),
  (
    '#35076 - Bổ sung thêm trường thông tin và kiểm tra logic ZPI07',
    v_proj_apa, v_assignee, v_creator,
    'pending', 'medium', 'medium', 'other',
    'ZPI07', 'client', 'Ai Nguyen', 'Trung bình',
    4, '2026-06-12 17:30:00+07'
  );

  RAISE NOTICE 'Đã thêm 3 tasks cho assignee %', v_assignee;
END $$;
