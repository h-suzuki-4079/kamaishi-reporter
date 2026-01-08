-- ============================================
-- 目的: Supabase RLS導入前の現状確認
-- 対象: public.jobs, public.reports テーブル
-- 注意点: 実行前に必ずこのSQLで現状を把握すること
-- ============================================

BEGIN;

-- ============================================
-- 1. RLS状態の確認
-- ============================================
-- relrowsecurity: RLSが有効かどうか
-- relforcerowsecurity: FORCE RLSが有効かどうか（スーパーユーザーもRLS適用）
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN 'RLS有効'
    ELSE 'RLS無効'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('jobs', 'reports')
ORDER BY tablename;

-- ============================================
-- 2. 既存ポリシーの確認
-- ============================================
-- 既存ポリシーがある場合は、RLS有効化前に削除が必要
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,  -- PERMISSIVE または RESTRICTIVE
  roles,       -- 適用されるロール
  cmd,         -- SELECT, INSERT, UPDATE, DELETE, ALL
  qual,        -- USING句（既存行のチェック）
  with_check   -- WITH CHECK句（新規/更新行のチェック）
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('jobs', 'reports')
ORDER BY tablename, policyname;

-- ポリシーが存在するかどうかの簡易チェック
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('jobs', 'reports')
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- 3. テーブル構造の確認（カラム一覧）
-- ============================================
-- user_id, owner_id, created_by などの所有者カラムの有無を確認
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name IN ('user_id', 'owner_id', 'created_by', 'worker_id') 
    THEN '★所有者カラム候補'
    ELSE ''
  END as note
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('jobs', 'reports')
ORDER BY table_name, ordinal_position;

-- ============================================
-- 4. user_id / owner_id の有無チェック（重要）
-- ============================================
-- RLSポリシーで使用する所有者カラムが存在するか確認
SELECT 
  table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = t.table_name 
        AND column_name = 'user_id'
    ) THEN '✓ user_id あり'
    ELSE '✗ user_id なし（追加が必要）'
  END as user_id_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = t.table_name 
        AND column_name = 'owner_id'
    ) THEN '✓ owner_id あり'
    ELSE '✗ owner_id なし'
  END as owner_id_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = t.table_name 
        AND column_name = 'created_by'
    ) THEN '✓ created_by あり'
    ELSE '✗ created_by なし'
  END as created_by_check
FROM (SELECT DISTINCT table_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name IN ('jobs', 'reports')) t
ORDER BY table_name;

-- ============================================
-- 5. 外部キー制約の確認
-- ============================================
-- auth.users への参照があるか確認
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE 
    WHEN ccu.table_name = 'users' AND ccu.table_schema = 'auth' 
    THEN '★auth.users参照あり'
    ELSE ''
  END as note
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('jobs', 'reports')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- 6. インデックスの確認
-- ============================================
-- user_id カラムにインデックスがあるか確認（パフォーマンス重要）
SELECT
  tablename,
  indexname,
  indexdef,
  CASE 
    WHEN indexdef LIKE '%user_id%' THEN '★user_id関連インデックス'
    ELSE ''
  END as note
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jobs', 'reports')
ORDER BY tablename, indexname;

-- ============================================
-- 7. 既存データの確認
-- ============================================
-- 既存データがある場合、user_idがNULLの行が存在するか確認
-- 重要: user_idがNULLの行は、RLS有効化後にアクセスできなくなる可能性がある
SELECT 
  'jobs' as table_name,
  COUNT(*) as total_rows,
  COUNT(user_id) as rows_with_user_id,
  COUNT(*) - COUNT(user_id) as rows_without_user_id
FROM public.jobs
UNION ALL
SELECT 
  'reports' as table_name,
  COUNT(*) as total_rows,
  COUNT(user_id) as rows_with_user_id,
  COUNT(*) - COUNT(user_id) as rows_without_user_id
FROM public.reports;

-- ============================================
-- 8. auth.users テーブルの確認（認証が有効か）
-- ============================================
-- 認証が有効でない場合、RLSポリシーは動作しない
SELECT 
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) as auth_users_table_exists,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN '✓ 認証テーブル存在'
    ELSE '✗ 認証テーブルなし（認証機能が無効）'
  END as auth_status;

COMMIT;

-- ============================================
-- 確認結果の解釈
-- ============================================
-- 1. rls_enabled = false の場合 → RLS有効化が必要
-- 2. policy_count > 0 の場合 → 既存ポリシーを削除してから新規作成
-- 3. user_id カラムがない場合 → カラム追加が必要（既存データの移行も必要）
-- 4. rows_without_user_id > 0 の場合 → 既存データにuser_idを設定する必要がある
-- 5. auth_users_table_exists = false の場合 → 認証機能を有効化する必要がある
