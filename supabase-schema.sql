-- Supabaseデータベースのテーブル作成SQL
-- SupabaseのSQL Editorで実行してください

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  reward TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_image TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスの追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Row Level Security (RLS) を有効化（必要に応じて）
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み取り可能にするポリシー（必要に応じて）
CREATE POLICY "Allow public read access" ON jobs
  FOR SELECT
  USING (true);

-- 全ユーザーが挿入可能にするポリシー（必要に応じて）
CREATE POLICY "Allow public insert access" ON jobs
  FOR INSERT
  WITH CHECK (true);

-- 既存のテーブルに reference_image カラムを追加する場合（テーブルが既に存在する場合）
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reference_image TEXT;

