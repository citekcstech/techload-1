-- ============================================================
-- TechLoad – Supabase Schema
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT        NOT NULL,
  full_name     TEXT        NOT NULL DEFAULT '',
  roles         TEXT[]      NOT NULL DEFAULT ARRAY['technical'],
  active_role   TEXT        NOT NULL DEFAULT 'technical',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TEAMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id            UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT,
  created_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TEAM_MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE team_members (
  id                      UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id                 UUID          REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id                 UUID          REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  working_hours_per_day   NUMERIC(4,1)  NOT NULL DEFAULT 8
                                          CHECK (working_hours_per_day > 0 AND working_hours_per_day <= 8),
  created_at              TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Migration cho DB đã tồn tại: giới hạn giờ làm tối đa 8h/ngày
UPDATE team_members SET working_hours_per_day = 8 WHERE working_hours_per_day > 8;
UPDATE team_members SET working_hours_per_day = 1 WHERE working_hours_per_day <= 0;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_working_hours_per_day_check;
ALTER TABLE team_members
  ADD CONSTRAINT team_members_working_hours_per_day_check
  CHECK (working_hours_per_day > 0 AND working_hours_per_day <= 8);

-- ────────────────────────────────────────────────────────────
-- PROJECTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id            UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT,
  team_id       UUID        REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'on_hold')),
  start_date    DATE,
  end_date      DATE,
  created_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- ESTIMATE_PARAMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE estimate_params (
  id                UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  name              TEXT          NOT NULL,
  description       TEXT,
  estimated_hours   NUMERIC(6,1)  NOT NULL,
  team_id           UUID          REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  created_by        UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TASKS
-- ────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id                  UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  title               TEXT          NOT NULL,
  description         TEXT,
  project_id          UUID          REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  assignee_id         UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_by          UUID          REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  status              TEXT          NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'in_progress', 'completed', 'reopened')),
  priority            TEXT          NOT NULL DEFAULT 'medium'
                                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  estimated_hours     NUMERIC(6,1)  NOT NULL DEFAULT 4,
  actual_hours        NUMERIC(6,1),
  deadline            TIMESTAMPTZ   NOT NULL,
  completed_at        TIMESTAMPTZ,
  projected_completion TIMESTAMPTZ,
  estimate_param_id   UUID          REFERENCES estimate_params(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

-- Migration cho DB đã tồn tại: thêm cột ngày hoàn thành dự kiến
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS projected_completion TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- TASK_REOPENS
-- ────────────────────────────────────────────────────────────
CREATE TABLE task_reopens (
  id                UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id           UUID          REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  reopened_by       UUID          REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  additional_hours  NUMERIC(6,1)  NOT NULL DEFAULT 0,
  reason            TEXT          NOT NULL,
  created_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- RLS (Row Level Security)
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reopens   ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select"  ON profiles FOR SELECT  USING (true);
CREATE POLICY "profiles_insert"  ON profiles FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update"  ON profiles FOR UPDATE  USING (auth.uid() = id);

-- Teams
CREATE POLICY "teams_select"     ON teams FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "teams_insert"     ON teams FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "teams_update"     ON teams FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "teams_delete"     ON teams FOR DELETE  USING (created_by = auth.uid());

-- Team members
CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "team_members_update" ON team_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "team_members_delete" ON team_members FOR DELETE USING (auth.role() = 'authenticated');

-- Projects
CREATE POLICY "projects_select"  ON projects FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "projects_insert"  ON projects FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "projects_update"  ON projects FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "projects_delete"  ON projects FOR DELETE  USING (auth.role() = 'authenticated');

-- Estimate params
CREATE POLICY "ep_select"  ON estimate_params FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "ep_insert"  ON estimate_params FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ep_update"  ON estimate_params FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "ep_delete"  ON estimate_params FOR DELETE  USING (auth.role() = 'authenticated');

-- Tasks
CREATE POLICY "tasks_select"  ON tasks FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_insert"  ON tasks FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tasks_update"  ON tasks FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_delete"  ON tasks FOR DELETE  USING (auth.role() = 'authenticated');

-- Task reopens
CREATE POLICY "tr_select"  ON task_reopens FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "tr_insert"  ON task_reopens FOR INSERT  WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- TRIGGER: auto-create profile when user signs up
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, roles, active_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    ARRAY['technical'],
    'technical'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- Migration: Chuẩn hóa đầu vào task (Step 1)
-- ────────────────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS request_type TEXT
  CHECK (request_type IN ('new_feature', 'bug', 'improvement', 'consultation', 'other'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT
  CHECK (source IN ('client', 'internal', 'qa', 'support', 'other'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requester TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS business_impact TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS severity TEXT
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- Mở rộng status đầy đủ vòng đời
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('backlog', 'pending', 'in_progress', 'blocked', 'ready_for_review', 'completed', 'reopened', 'cancelled'));

-- ────────────────────────────────────────────────────────────
-- Migration: Vòng đời status đầy đủ (Step 2)
-- ────────────────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_owner TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_follow_up_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- ────────────────────────────────────────────────────────────
-- Migration: Re-open root cause (Step 4)
-- ────────────────────────────────────────────────────────────
ALTER TABLE task_reopens ADD COLUMN IF NOT EXISTS root_cause TEXT
  CHECK (root_cause IN ('missing_requirement','technical_bug','scope_change','external_dependency','estimate_error','other'));

-- ────────────────────────────────────────────────────────────
-- Migration: Work logs + Estimate logs (Step 3)
-- ────────────────────────────────────────────────────────────

-- Cột mới trên tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS baseline_estimated_hours NUMERIC(6,1);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Khởi tạo baseline = estimated_hours cho task cũ
UPDATE tasks SET baseline_estimated_hours = estimated_hours WHERE baseline_estimated_hours IS NULL;

-- Work logs: ghi giờ từng lần làm việc
CREATE TABLE IF NOT EXISTS task_work_logs (
  id          UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id     UUID          REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  work_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  hours       NUMERIC(5,1)  NOT NULL CHECK (hours > 0),
  note        TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE task_work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wl_select" ON task_work_logs;
CREATE POLICY "wl_select" ON task_work_logs FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "wl_insert" ON task_work_logs;
CREATE POLICY "wl_insert" ON task_work_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "wl_delete" ON task_work_logs;
CREATE POLICY "wl_delete" ON task_work_logs FOR DELETE USING (user_id = auth.uid());

-- Estimate logs: audit lịch sử thay đổi estimate/deadline
CREATE TABLE IF NOT EXISTS task_estimate_logs (
  id                  UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id             UUID          REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  changed_by          UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  old_estimated_hours NUMERIC(6,1),
  new_estimated_hours NUMERIC(6,1),
  old_deadline        TIMESTAMPTZ,
  new_deadline        TIMESTAMPTZ,
  reason              TEXT,
  is_scope_change     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE task_estimate_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "el_select" ON task_estimate_logs;
CREATE POLICY "el_select" ON task_estimate_logs FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "el_insert" ON task_estimate_logs;
CREATE POLICY "el_insert" ON task_estimate_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER set_updated_at_profiles    BEFORE UPDATE ON profiles       FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at_teams       BEFORE UPDATE ON teams          FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at_projects    BEFORE UPDATE ON projects       FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at_estimate_params BEFORE UPDATE ON estimate_params FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at_tasks       BEFORE UPDATE ON tasks          FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- Migration: Subtasks / Checklist (Step 5)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtasks (
  id           UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id      UUID          REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  title        TEXT          NOT NULL,
  done         BOOLEAN       NOT NULL DEFAULT FALSE,
  assignee_id  UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  estimated_hours NUMERIC(5,1),
  sort_order   INT           NOT NULL DEFAULT 0,
  created_by   UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_select" ON subtasks;
CREATE POLICY "sub_select" ON subtasks FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "sub_insert" ON subtasks;
CREATE POLICY "sub_insert" ON subtasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "sub_update" ON subtasks;
CREATE POLICY "sub_update" ON subtasks FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "sub_delete" ON subtasks;
CREATE POLICY "sub_delete" ON subtasks FOR DELETE USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- Migration: Task Comments (Step 8)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id    UUID        REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  type       TEXT        NOT NULL DEFAULT 'note'
               CHECK (type IN ('note', 'question', 'decision', 'blocker_update')),
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tc_select" ON task_comments;
CREATE POLICY "tc_select" ON task_comments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "tc_insert" ON task_comments;
CREATE POLICY "tc_insert" ON task_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "tc_update" ON task_comments;
CREATE POLICY "tc_update" ON task_comments FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "tc_delete" ON task_comments;
CREATE POLICY "tc_delete" ON task_comments FOR DELETE USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- Migration: Notifications (Step 9)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  task_id    UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  type       TEXT        NOT NULL
               CHECK (type IN ('assigned','near_deadline','overdue','blocked','reopened','review_needed','completed')),
  message    TEXT        NOT NULL,
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE USING (user_id = auth.uid());
