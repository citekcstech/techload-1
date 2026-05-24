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
  working_hours_per_day   NUMERIC(4,1)  NOT NULL DEFAULT 8,
  created_at              TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

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
  estimate_param_id   UUID          REFERENCES estimate_params(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

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
