-- ============================================
-- 目的: Supabase RLS有効化とポリシー設定
-- 対象: public.jobs, public.reports テーブル
-- 注意点: 
--   1. 実行前に supabase-security-check.sql で現状確認すること
--   2. user_id カラムが存在しない場合は、このSQLの冒頭でカラム追加が必要
--   3. 既存データがある場合、user_id の移行が必要（このSQLでは行わない）
--   4. 認証機能が有効でない場合、RLSは動作しない
-- ============================================

BEGIN;

-- ============================================
-- ⚠️ 重要: 実行前の確認事項
-- ============================================
-- 以下のSQLを実行して、user_idカラムの有無を確認してください：
-- 
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('jobs', 'reports') 
--   AND column_name = 'user_id';
--
-- user_idカラムが存在しない場合、以下のSQLを実行してから続行してください：
-- 
-- ALTER TABLE public.jobs ADD COLUMN user_id UUID REFERENCES auth.users(id);
-- ALTER TABLE public.reports ADD COLUMN user_id UUID REFERENCES auth.users(id);
--
-- 既存データがある場合、user_idを設定する必要があります：
-- UPDATE public.jobs SET user_id = '適切なUUID' WHERE user_id IS NULL;
-- UPDATE public.reports SET user_id = '適切なUUID' WHERE user_id IS NULL;

-- ============================================
-- 既存ポリシーの削除
-- ============================================
-- 既存のポリシーがある場合は、先に削除する
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('jobs', 'reports')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================
-- オプションA: profilesテーブル方式（推奨）
-- ============================================
-- 推奨理由:
-- 1. クエリパフォーマンスが良い（インデックスが効く）
-- 2. 管理者フラグの変更が容易（SQLで直接更新可能）
-- 3. 将来的にユーザー情報を拡張しやすい
-- 4. Supabaseダッシュボードから直接編集可能

-- 1. profilesテーブルの作成
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. profilesテーブルのRLS設定
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- profilesテーブルの既存ポリシー削除
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- profilesテーブルのポリシー
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 3. インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
  ON public.profiles(is_admin) 
  WHERE is_admin = TRUE;

-- 4. 管理者判定用関数（Option A用）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
$$;

-- ============================================
-- オプションB: app_metadata方式
-- ============================================
-- 以下のコメントを外して使用する場合は、Option Aのis_admin()関数を削除してください
-- 
-- CREATE OR REPLACE FUNCTION public.is_admin()
-- RETURNS BOOLEAN
-- LANGUAGE sql
-- SECURITY DEFINER
-- STABLE
-- AS $$
--   SELECT (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin';
-- $$;

-- ============================================
-- jobsテーブルのRLS設定
-- ============================================

-- RLS有効化
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- ポリシー: 認証済みユーザーは自分の案件を閲覧可能
CREATE POLICY "Users can view own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

-- ポリシー: 管理者は全案件を閲覧可能
CREATE POLICY "Admins can view all jobs"
  ON public.jobs FOR SELECT
  USING (public.is_admin());

-- ポリシー: 認証済みユーザーは自分の案件を作成可能
CREATE POLICY "Users can create own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ポリシー: 管理者は全案件を作成可能
CREATE POLICY "Admins can create any jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (public.is_admin());

-- ポリシー: 認証済みユーザーは自分の案件を更新可能
CREATE POLICY "Users can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ポリシー: 管理者は全案件を更新可能
CREATE POLICY "Admins can update all jobs"
  ON public.jobs FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ポリシー: 認証済みユーザーは自分の案件を削除可能（必要に応じて）
-- CREATE POLICY "Users can delete own jobs"
--   ON public.jobs FOR DELETE
--   USING (auth.uid() = user_id);

-- ポリシー: 管理者は全案件を削除可能（必要に応じて）
-- CREATE POLICY "Admins can delete all jobs"
--   ON public.jobs FOR DELETE
--   USING (public.is_admin());

-- ============================================
-- reportsテーブルのRLS設定
-- ============================================

-- RLS有効化
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_job_id ON public.reports(job_id);

-- ポリシー: 認証済みユーザーは自分の報告を閲覧可能
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

-- ポリシー: 管理者は全報告を閲覧可能
CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  USING (public.is_admin());

-- ポリシー: 認証済みユーザーは自分の報告を作成可能
CREATE POLICY "Users can create own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ポリシー: 管理者は全報告を作成可能
CREATE POLICY "Admins can create any reports"
  ON public.reports FOR INSERT
  WITH CHECK (public.is_admin());

-- ポリシー: 認証済みユーザーは自分の報告を更新可能
CREATE POLICY "Users can update own reports"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ポリシー: 管理者は全報告を更新可能
CREATE POLICY "Admins can update all reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ポリシー: 認証済みユーザーは自分の報告を削除可能（必要に応じて）
-- CREATE POLICY "Users can delete own reports"
--   ON public.reports FOR DELETE
--   USING (auth.uid() = user_id);

-- ポリシー: 管理者は全報告を削除可能（必要に応じて）
-- CREATE POLICY "Admins can delete all reports"
--   ON public.reports FOR DELETE
--   USING (public.is_admin());

COMMIT;

-- ============================================
-- 実行後の確認
-- ============================================
-- 以下のSQLでRLSとポリシーが正しく設定されたか確認してください：
--
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN ('jobs', 'reports');
--
-- SELECT tablename, policyname, cmd FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename IN ('jobs', 'reports')
-- ORDER BY tablename, policyname;
