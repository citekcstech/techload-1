-- Chạy trong Supabase SQL Editor

CREATE TABLE IF NOT EXISTS email_templates (
  id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  subject     TEXT        NOT NULL DEFAULT '',
  html_body   TEXT        NOT NULL DEFAULT '',
  updated_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read email_templates"
  ON email_templates FOR SELECT USING (true);

CREATE POLICY "Write email_templates (lead_technical)"
  ON email_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND 'lead_technical' = ANY(roles))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND 'lead_technical' = ANY(roles))
  );
