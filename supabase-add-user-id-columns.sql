-- ============================================
-- 目的: jobs/reportsテーブルにuser_idカラムを追加
-- 対象: public.jobs, public.reports テーブル
-- 注意点: 
--   1. このSQLはスキーマ変更のみ（RLSは有効化しない）
--   2. user_idはnullableで追加（既存データへの影響を避けるため）
--   3. 既存データがある場合、後でuser_idを設定する必要がある
--   4. 外部キー制約により、存在しないユーザーIDは設定できない
-- ============================================

BEGIN;

-- ============================================
-- 1. jobsテーブルにuser_idカラムを追加
-- ============================================
-- 既存データへの影響:
--   - 既存の全レコードのuser_idはNULLになる
--   - RLS有効化前に、既存データに適切なuser_idを設定する必要がある
--   - user_idがNULLのレコードは、RLS有効化後にアクセスできなくなる可能性がある

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- コメントを追加（カラムの説明）
COMMENT ON COLUMN public.jobs.user_id IS 
  '案件の所有者（ワーカー）のユーザーID。NULLの場合は未割り当て。RLS有効化前に設定が必要。';

-- ============================================
-- 2. reportsテーブルにuser_idカラムを追加
-- ============================================
-- 既存データへの影響:
--   - 既存の全レコードのuser_idはNULLになる
--   - RLS有効化前に、既存データに適切なuser_idを設定する必要がある
--   - user_idがNULLのレコードは、RLS有効化後にアクセスできなくなる可能性がある

ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- コメントを追加（カラムの説明）
COMMENT ON COLUMN public.reports.user_id IS 
  '報告を作成したワーカーのユーザーID。NULLの場合は未割り当て。RLS有効化前に設定が必要。';

-- ============================================
-- 3. インデックスの追加（パフォーマンス向上）
-- ============================================
-- user_idカラムにインデックスを追加することで、RLSポリシーのパフォーマンスが向上します

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);

-- ============================================
-- 4. 既存データの確認
-- ============================================
-- 実行後に、以下のSQLで既存データのuser_idがNULLであることを確認してください：
--
-- SELECT 
--   'jobs' as table_name,
--   COUNT(*) as total_rows,
--   COUNT(user_id) as rows_with_user_id,
--   COUNT(*) - COUNT(user_id) as rows_without_user_id
-- FROM public.jobs
-- UNION ALL
-- SELECT 
--   'reports' as table_name,
--   COUNT(*) as total_rows,
--   COUNT(user_id) as rows_with_user_id,
--   COUNT(*) - COUNT(user_id) as rows_without_user_id
-- FROM public.reports;

COMMIT;

-- ============================================
-- 実行後の確認
-- ============================================
-- 以下のSQLで、カラムが正しく追加されたか確認してください：
--
-- SELECT 
--   table_name,
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name IN ('jobs', 'reports')
--   AND column_name = 'user_id'
-- ORDER BY table_name;

-- ============================================
-- 次のステップ
-- ============================================
-- 1. 既存データにuser_idを設定する（移行SQLを実行）
-- 2. アプリケーションコードを修正して、INSERT時にuser_idを設定する
-- 3. 十分にテストした後、supabase-rls-setup.sqlを実行してRLSを有効化する

-- ============================================
-- 既存データの移行例（参考）
-- ============================================
-- 既存データがある場合、以下のようなSQLでuser_idを設定します：
--
-- -- 例1: 特定のユーザーに紐付ける
-- UPDATE public.jobs 
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com')
-- WHERE user_id IS NULL;
--
-- -- 例2: 既存のlocalStorageのmy_jobsと連携する場合
-- -- （この場合は、localStorageのjob_idとauth.usersのIDをマッピングする必要がある）
--
-- -- 例3: 管理者が作成した案件の場合
-- UPDATE public.jobs 
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com')
-- WHERE user_id IS NULL AND status = 'open';
--
-- ⚠️ 注意: 実際の移行方法は、アプリケーションの要件に応じて決定してください。

