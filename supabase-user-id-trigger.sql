-- ============================================
-- 目的: jobs/reportsテーブルへのINSERT時にuser_idを自動設定
-- 対象: public.jobs, public.reports テーブル
-- 注意点: 
--   1. user_idカラムが存在する前提
--   2. user_idがNULLの場合のみ、auth.uid()を自動設定
--   3. UPDATE時は書き換えない（INSERT時のみ）
--   4. 既にuser_idが設定されている場合はそのまま使用
-- ============================================

BEGIN;

-- ============================================
-- 1. jobsテーブル用のトリガー関数
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_id_on_jobs_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- user_idがNULLの場合のみ、auth.uid()を設定
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. reportsテーブル用のトリガー関数
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_id_on_reports_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- user_idがNULLの場合のみ、auth.uid()を設定
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 3. jobsテーブルにトリガーを追加
-- ============================================
DROP TRIGGER IF EXISTS trigger_set_user_id_on_jobs_insert ON public.jobs;

CREATE TRIGGER trigger_set_user_id_on_jobs_insert
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_on_jobs_insert();

-- ============================================
-- 4. reportsテーブルにトリガーを追加
-- ============================================
DROP TRIGGER IF EXISTS trigger_set_user_id_on_reports_insert ON public.reports;

CREATE TRIGGER trigger_set_user_id_on_reports_insert
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_on_reports_insert();

COMMIT;

-- ============================================
-- 実行後の確認SQL
-- ============================================

-- 1. トリガー関数の存在確認
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'set_user_id_on_jobs_insert',
    'set_user_id_on_reports_insert'
  )
ORDER BY routine_name;

-- 2. トリガーの存在確認
SELECT 
  trigger_name,
  event_object_table as table_name,
  event_manipulation as event,
  action_timing as timing,
  action_statement as function
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('jobs', 'reports')
  AND trigger_name LIKE '%user_id%'
ORDER BY event_object_table, trigger_name;

-- 3. 簡易テスト手順
-- ============================================
-- 注意: 実際のテストは認証済みユーザーでログインした状態で行う必要があります
-- 
-- テスト1: user_idがNULLの場合、自動設定されるか確認
-- アプリケーションから以下のようにINSERT（user_idを省略）:
--   INSERT INTO public.jobs (title, company, location, reward, description, status)
--   VALUES ('テスト案件', 'テスト会社', 'テスト場所', '1000', 'テスト説明', 'open');
-- 期待結果: user_idが現在のユーザーID（auth.uid()）に自動設定される
--
-- テスト2: user_idが既に設定されている場合、そのまま使用されるか確認
--   INSERT INTO public.jobs (title, company, location, reward, description, status, user_id)
--   VALUES ('テスト案件2', 'テスト会社', 'テスト場所', '1000', 'テスト説明', 'open', '指定されたUUID'::UUID);
-- 期待結果: user_idが指定されたUUIDのまま（書き換えられない）
--
-- テスト3: UPDATE時はトリガーが発動しないことを確認
--   UPDATE public.jobs SET user_id = NULL WHERE id = 1;
-- 期待結果: user_idがNULLに書き換えられる（トリガーは発動しない）
--
-- 確認SQL:
--   SELECT id, title, user_id, created_at 
--   FROM public.jobs 
--   WHERE title LIKE 'テスト案件%' 
--   ORDER BY created_at DESC;
--
-- テストデータの削除:
--   DELETE FROM public.jobs WHERE title LIKE 'テスト案件%';

-- ============================================
-- 動作説明
-- ============================================
-- このトリガーは以下のように動作します：
--
-- 1. INSERT時にuser_idがNULLの場合:
--    - auth.uid()（現在ログインしているユーザーのID）を自動設定
--    - 認証されていない場合（auth.uid()がNULL）は、user_idもNULLのまま
--
-- 2. INSERT時にuser_idが既に設定されている場合:
--    - 指定されたuser_idをそのまま使用（書き換えない）
--    - 管理者が他のユーザーに紐付ける場合などに有効
--
-- 3. UPDATE時:
--    - トリガーは発動しないため、user_idは手動で変更可能
--
-- 4. 注意事項:
--    - 認証されていない状態でINSERTすると、user_idはNULLのまま
--    - RLS有効化後は、user_idがNULLのレコードはアクセスできなくなる可能性がある

