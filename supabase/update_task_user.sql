-- 1. Xem UUID thật của user đang dùng
SELECT id, email FROM auth.users ORDER BY created_at;
 
select * from teams;
 
-- 2. Nếu UUID thật khác aa000001-..., thêm user thật vào team
INSERT INTO team_members (team_id, user_id, working_hours_per_day)
VALUES (
  'bb000001-0000-0000-0000-000000000000',
  '<UUID_THẬT_CỦA_BẠN>',  -- lấy từ kết quả query trên
  8
)
ON CONFLICT (team_id, user_id) DO NOTHING;