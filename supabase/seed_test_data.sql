-- ============================================================
-- TechLoad – Seed dữ liệu test tuần 09–13/06/2026
-- Chạy trong Supabase SQL Editor (postgres user)
-- ============================================================
-- UUID quy ước:
--   Users    aa000001..aa000008
--   Team     bb000001
--   Projects cc000001..cc000010  (TNG, TTK, HPDQ, PNC, NKG, CADIVI, ACG, WBG, AVN, CDV)
--   Tasks    dd000001..dd000020
-- Mật khẩu đăng nhập test: Citek@2026
-- ============================================================

-- ─── 1. AUTH USERS ──────────────────────────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_super_admin, is_sso_user
) VALUES
  ('00000000-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','authenticated','authenticated','nghia.huynh@citek.vn',  crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Nghĩa Huỳnh"}',  NOW(),NOW(),false,false),
  ('00000000-0000-0000-0000-000000000000','aa000002-0000-0000-0000-000000000000','authenticated','authenticated','linh.nguyen@citek.vn',   crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Linh Nguyễn"}',   NOW(),NOW(),false,false),
  ('00000000-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000','authenticated','authenticated','ngan.nguyen@citek.vn',   crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Ngân Nguyễn"}',   NOW(),NOW(),false,false),
  ('00000000-0000-0000-0000-000000000000','aa000004-0000-0000-0000-000000000000','authenticated','authenticated','thu.ho@citek.vn',         crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Thu Hồ"}',         NOW(),NOW(),false,false),
  ('00000000-0000-0000-0000-000000000000','aa000005-0000-0000-0000-000000000000','authenticated','authenticated','thuong.quang@citek.vn',   crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Thương Quang"}',   NOW(),NOW(),false,false),
  ('00000000-0000-0000-0000-000000000000','aa000006-0000-0000-0000-000000000000','authenticated','authenticated','chi.thai@citek.vn',        crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Chi Thái"}',        NOW(),NOW(),false,false),
  ('00000000-0000-0000-0000-000000000000','aa000007-0000-0000-0000-000000000000','authenticated','authenticated','thu.nguyen@citek.vn',     crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Thu Nguyễn"}',     NOW(),NOW(),false,false),
  ('00000000-0000-0000-0000-000000000000','aa000008-0000-0000-0000-000000000000','authenticated','authenticated','minh.ha@citek.vn',         crypt('Citek@2026',gen_salt('bf')),NOW(),'{"provider":"email","providers":["email"]}','{"full_name":"Minh Hà"}',         NOW(),NOW(),false,false)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. PROFILES (fallback nếu trigger không chạy) ──────────
INSERT INTO profiles (id, email, full_name) VALUES
  ('aa000001-0000-0000-0000-000000000000','nghia.huynh@citek.vn', 'Nghĩa Huỳnh'),
  ('aa000002-0000-0000-0000-000000000000','linh.nguyen@citek.vn',  'Linh Nguyễn'),
  ('aa000003-0000-0000-0000-000000000000','ngan.nguyen@citek.vn',  'Ngân Nguyễn'),
  ('aa000004-0000-0000-0000-000000000000','thu.ho@citek.vn',        'Thu Hồ'),
  ('aa000005-0000-0000-0000-000000000000','thuong.quang@citek.vn',  'Thương Quang'),
  ('aa000006-0000-0000-0000-000000000000','chi.thai@citek.vn',       'Chi Thái'),
  ('aa000007-0000-0000-0000-000000000000','thu.nguyen@citek.vn',    'Thu Nguyễn'),
  ('aa000008-0000-0000-0000-000000000000','minh.ha@citek.vn',        'Minh Hà')
ON CONFLICT (id) DO NOTHING;

-- ─── 3. CẬP NHẬT ROLES ──────────────────────────────────────
UPDATE profiles
SET roles = ARRAY['technical','lead_technical'], active_role = 'lead_technical'
WHERE id = 'aa000001-0000-0000-0000-000000000000';

UPDATE profiles
SET roles = ARRAY['consultant'], active_role = 'consultant'
WHERE id IN (
  'aa000002-0000-0000-0000-000000000000',
  'aa000003-0000-0000-0000-000000000000',
  'aa000004-0000-0000-0000-000000000000',
  'aa000005-0000-0000-0000-000000000000',
  'aa000006-0000-0000-0000-000000000000',
  'aa000007-0000-0000-0000-000000000000',
  'aa000008-0000-0000-0000-000000000000'
);

-- ─── 4. TEAM ────────────────────────────────────────────────
INSERT INTO teams (id, name, description, created_by) VALUES
  ('bb000001-0000-0000-0000-000000000000',
   'CITEK Technical Team',
   'Đội phát triển SAP ABAP – CITEK',
   'aa000001-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;

-- ─── 5. TEAM MEMBERS ────────────────────────────────────────
INSERT INTO team_members (team_id, user_id, working_hours_per_day) VALUES
  ('bb000001-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000',8),
  ('bb000001-0000-0000-0000-000000000000','aa000002-0000-0000-0000-000000000000',8),
  ('bb000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000',8),
  ('bb000001-0000-0000-0000-000000000000','aa000004-0000-0000-0000-000000000000',8),
  ('bb000001-0000-0000-0000-000000000000','aa000005-0000-0000-0000-000000000000',8),
  ('bb000001-0000-0000-0000-000000000000','aa000006-0000-0000-0000-000000000000',8),
  ('bb000001-0000-0000-0000-000000000000','aa000007-0000-0000-0000-000000000000',8),
  ('bb000001-0000-0000-0000-000000000000','aa000008-0000-0000-0000-000000000000',8)
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ─── 6. PROJECTS (10 khách hàng) ────────────────────────────
INSERT INTO projects (id, name, description, team_id, status, start_date, end_date, created_by) VALUES
  ('cc000001-0000-0000-0000-000000000000','TNG',    'Tập đoàn Dệt May TNG',       'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000002-0000-0000-0000-000000000000','TTK',    'Công ty TTK',                 'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000003-0000-0000-0000-000000000000','HPDQ',   'Haprodimex Đắk Quy',         'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000004-0000-0000-0000-000000000000','PNC',    'Công ty PNC',                 'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000005-0000-0000-0000-000000000000','NKG',    'Thép Nam Kim Group',          'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000006-0000-0000-0000-000000000000','CADIVI', 'Công ty Dây Cáp CADIVI',      'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000007-0000-0000-0000-000000000000','ACG',    'Công ty ACG',                 'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000008-0000-0000-0000-000000000000','WBG',    'Công ty WBG',                 'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000009-0000-0000-0000-000000000000','AVN',    'Công ty AVN',                 'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000'),
  ('cc000010-0000-0000-0000-000000000000','CDV',    'Công ty CDV',                 'bb000001-0000-0000-0000-000000000000','active','2025-01-01','2026-12-31','aa000001-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;

-- ─── 7. TASKS (20 tasks – trải đều T2–T6 tuần 09–13/06) ─────
INSERT INTO tasks (
  id, title, description,
  project_id, assignee_id, created_by,
  status, priority, estimated_hours,
  deadline, completed_at,
  request_type, module, source
) VALUES

-- ── THỨ 2 – 09/06 (3 tasks) ──────────────────────────────────
('dd000001-0000-0000-0000-000000000000',
 '#34313 – Move báo cáo ZGL09 [TNG]',
 'Move báo cáo ZGL09. BN: ZPK_FI_ZGL09 / FN: ZPK_FI_ZGL09_FE (Space 4)',
 'cc000001-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000002-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-09 18:00:00+07','2026-06-09 15:30:00+07',
 'improvement','ZGL09','client'),

('dd000002-0000-0000-0000-000000000000',
 '#34313 – Move báo cáo ZGL09 [TTK]',
 'Move báo cáo ZGL09 cho dự án TTK',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000002-0000-0000-0000-000000000000',
 'completed','medium',4,
 '2026-06-09 18:00:00+07','2026-06-09 16:00:00+07',
 'improvement','ZGL09','client'),

('dd000015-0000-0000-0000-000000000000',
 '#34763 – ZHANMUC: Thêm cột tổng vay dài hạn [CADIVI]',
 'CADIVI_FI_ZHANMUC – Thêm cột tổng vay dài hạn, cột tổng số dư vay',
 'cc000006-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000004-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-09 18:00:00+07','2026-06-09 14:00:00+07',
 'improvement','ZHANMUC','client'),

-- ── THỨ 3 – 10/06 (4 tasks) ──────────────────────────────────
('dd000003-0000-0000-0000-000000000000',
 '#34360 – ZWM11: Điều chỉnh phân cách số lượng [TNG]',
 'Điều chỉnh phân cách hàng nghìn và đơn vị của Field Số lượng – Biên Bản Giao Nhận (ZWM11). BN: ZPK_WM_BBGN / FN: zwm_bbgn',
 'cc000001-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000002-0000-0000-0000-000000000000',
 'completed','medium',4,
 '2026-06-10 18:00:00+07','2026-06-10 10:00:00+07',
 'improvement','ZWM11','client'),

('dd000004-0000-0000-0000-000000000000',
 '#33867 – Custom logic chặn reset cây duyệt SO [TTK]',
 'Bổ sung Custom Logic để chặn việc reset cây duyệt SO trong các trường hợp chỉnh sửa',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000008-0000-0000-0000-000000000000',
 'completed','medium',16,
 '2026-06-10 18:00:00+07','2026-06-10 17:00:00+07',
 'new_feature',NULL,'client'),

('dd000014-0000-0000-0000-000000000000',
 '#32013 – Kiểm tra lỗi tích hợp AR Invoice [WBG]',
 'WBG_#32013 – Kiểm tra và xử lý lỗi tích hợp AR Invoice',
 'cc000008-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000007-0000-0000-0000-000000000000',
 'completed','medium',16,
 '2026-06-10 18:00:00+07','2026-06-10 16:00:00+07',
 'other',NULL,'client'),

('dd000016-0000-0000-0000-000000000000',
 '#34851 – APP Phiếu Xuất Kho chạy chậm [TTK]',
 'TTK_#34851 – Phân tích và tối ưu hiệu năng APP Phiếu Xuất Kho',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000008-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-10 18:00:00+07','2026-06-10 15:00:00+07',
 'bug',NULL,'client'),

-- ── THỨ 4 – 11/06 (5 tasks) ──────────────────────────────────
('dd000005-0000-0000-0000-000000000000',
 '#34457 – ZAP15_P: Bank Account & Ngân hàng thụ hưởng [HPDQ]',
 'Bank Account: cho phép chỉnh sửa + bổ sung Search Help. Ngân hàng thụ hưởng: tự động thay đổi theo Bank Account được chọn',
 'cc000003-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000004-0000-0000-0000-000000000000',
 'completed','medium',12,
 '2026-06-11 18:00:00+07','2026-06-11 14:00:00+07',
 'improvement','ZAP15_P','client'),

('dd000006-0000-0000-0000-000000000000',
 '#34430 – ZSD01: Lỗi form in Commercial Invoice [TTK]',
 'Lỗi form in Commercial Invoice không theo OD',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-11 18:00:00+07','2026-06-11 11:00:00+07',
 'bug','ZSD01','client'),

('dd000007-0000-0000-0000-000000000000',
 '#34483 – ZTAX: Bổ sung field CCCD [PNC]',
 'Bổ sung field CCCD trên màn hình ALV và form in Excel ở option Output Tax',
 'cc000004-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000005-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-11 18:00:00+07','2026-06-11 16:00:00+07',
 'improvement','ZTAX','client'),

('dd000013-0000-0000-0000-000000000000',
 '#34790 – ZAP12: Tạo mới ĐNTT [ACG]',
 'ACG_#34790_FI – Liên quan tới tạo mới Đề Nghị Thanh Toán tại ZAP12',
 'cc000007-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000006-0000-0000-0000-000000000000',
 'completed','medium',12,
 '2026-06-11 18:00:00+07','2026-06-11 17:00:00+07',
 'improvement','ZAP12','client'),

('dd000017-0000-0000-0000-000000000000',
 'ZUTGB02: Chỉnh sửa yêu cầu sau UAT [CDV]',
 'CDV_UTGB – Chỉnh sửa các yêu cầu phát sinh sau UAT',
 'cc000010-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000',
 'completed','medium',12,
 '2026-06-11 18:00:00+07','2026-06-11 15:00:00+07',
 'improvement','ZUTGB02','client'),

-- ── THỨ 5 – 12/06 (4 tasks) ──────────────────────────────────
('dd000008-0000-0000-0000-000000000000',
 '#34635 – ZSD05B: Bổ sung 2 cột báo cáo [TTK]',
 'Bổ sung 2 cột trên màn hình tham số và báo cáo ZSD05B',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-12 18:00:00+07','2026-06-12 14:00:00+07',
 'improvement','ZSD05B','client'),

('dd000011-0000-0000-0000-000000000000',
 '#34513 – Bổ sung logic mẫu số ký hiệu hóa đơn điện tử [NKG]',
 'Bổ sung logic lấy mẫu số ký hiệu chức năng phát hành hoá đơn điện tử',
 'cc000005-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000005-0000-0000-0000-000000000000',
 'completed','medium',12,
 '2026-06-12 18:00:00+07','2026-06-12 16:00:00+07',
 'new_feature',NULL,'client'),

('dd000012-0000-0000-0000-000000000000',
 '#34588 – VF01: Chặn tạo Billing nếu Báo giá hết hiệu lực [CADIVI]',
 'Enhance Tcode VF01 – Báo message chặn tạo Billing nếu Báo giá hết hiệu lực',
 'cc000006-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-12 18:00:00+07','2026-06-12 11:00:00+07',
 'improvement','VF01','client'),

('dd000018-0000-0000-0000-000000000000',
 '#34872 – YMD00: Điều chỉnh logic xét MRP Area [AVN]',
 'Điều chỉnh logic upload: xét MRP AREA theo màn hình tham số thay vì hard code 4100-2000. FS: AVN_FS_YMD00_UpdateMasterData_MRP.xlsx',
 'cc000009-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000',
 'completed','medium',8,
 '2026-06-12 18:00:00+07','2026-06-12 15:00:00+07',
 'improvement','YMD00','client'),

-- ── THỨ 6 – 13/06 (4 tasks) ──────────────────────────────────
('dd000009-0000-0000-0000-000000000000',
 'Nghiên cứu mô hình MCP – AI Agents',
 'Tự nghiên cứu và đánh giá khả năng ứng dụng MCP và AI Agents vào quy trình phát triển SAP ABAP',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000',
 'in_progress','medium',16,
 '2026-06-13 18:00:00+07',NULL,
 'consultation',NULL,'internal'),

('dd000010-0000-0000-0000-000000000000',
 '#33754 – ZSD05B: Lọc theo ký tự "*" [TTK]',
 'Màn hình tham số ZSD05B – Lọc theo kiểu "*" đối với 2 tham số OD và Delivery Date. Đang chờ user chốt phương án.',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000',
 'pending','medium',8,
 '2026-06-13 18:00:00+07',NULL,
 'improvement','ZSD05B','client'),

('dd000019-0000-0000-0000-000000000000',
 'ZSD07 – Báo cáo doanh thu theo khách hàng [TTK]',
 'Bổ sung báo cáo doanh thu chi tiết theo khách hàng, lọc theo khoảng thời gian và nhóm hàng',
 'cc000002-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000003-0000-0000-0000-000000000000',
 'in_progress','medium',16,
 '2026-06-13 18:00:00+07',NULL,
 'improvement','ZSD07','client'),

('dd000020-0000-0000-0000-000000000000',
 'ZFI10 – Báo cáo công nợ phải thu [TNG]',
 'Phát triển mới báo cáo công nợ phải thu theo dự án, bổ sung cột phân loại quá hạn',
 'cc000001-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000','aa000002-0000-0000-0000-000000000000',
 'pending','medium',12,
 '2026-06-13 18:00:00+07',NULL,
 'new_feature','ZFI10','client')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Xóa dữ liệu test (chạy khi cần reset):
-- ============================================================
-- DELETE FROM tasks        WHERE id LIKE 'dd0000%';
-- DELETE FROM projects     WHERE id LIKE 'cc0000%';
-- DELETE FROM team_members WHERE team_id = 'bb000001-0000-0000-0000-000000000000';
-- DELETE FROM teams        WHERE id = 'bb000001-0000-0000-0000-000000000000';
-- DELETE FROM profiles     WHERE id LIKE 'aa0000%';
-- DELETE FROM auth.users   WHERE id LIKE 'aa0000%';
-- ============================================================
