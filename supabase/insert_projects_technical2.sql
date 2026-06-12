-- Insert 14 projects vào team "Technical 2"
-- Chạy trong Supabase SQL Editor

DO $$
DECLARE
  v_team_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_team_id FROM teams WHERE name = 'Technical 2' LIMIT 1;
  SELECT id INTO v_user_id FROM profiles WHERE email = 'trang.tran@citek.vn' LIMIT 1;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy team "Technical 2"';
  END IF;

  INSERT INTO projects (name, team_id, status, created_by) VALUES
    ('ACG',        v_team_id, 'active', v_user_id),
    ('AVN',        v_team_id, 'active', v_user_id),
    ('DMCL',       v_team_id, 'active', v_user_id),
    ('NAMILUX',    v_team_id, 'active', v_user_id),
    ('NANOGEN',    v_team_id, 'active', v_user_id),
    ('PINACO',     v_team_id, 'active', v_user_id),
    ('SMC',        v_team_id, 'active', v_user_id),
    ('VASG',       v_team_id, 'active', v_user_id),
    ('APA',        v_team_id, 'active', v_user_id),
    ('HOANG LONG', v_team_id, 'active', v_user_id),
    ('CADIVI',     v_team_id, 'active', v_user_id),
    ('EMIC',       v_team_id, 'active', v_user_id),
    ('TTK',        v_team_id, 'active', v_user_id),
    ('WBG',        v_team_id, 'active', v_user_id);

  RAISE NOTICE 'Đã thêm 14 dự án vào team_id = %', v_team_id;
END $$;
