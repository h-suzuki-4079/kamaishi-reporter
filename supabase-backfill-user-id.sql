-- ============================================
-- 目的: 既存データのuser_idを埋める（RLS有効化前の移行用）
-- 対象: public.jobs, public.reports テーブル
-- 注意点: 
--   1. 実行前に <ADMIN_USER_UUID> を実際の管理者ユーザーIDに置換すること
--   2. RLS有効化前に実行すること
--   3. 既存データのuser_idがNULLの行のみ更新する
--   4. 実行後、user_idがNULLの行が0件になることを確認すること
-- ============================================

-- ============================================
-- ⚠️ 重要: 実行前の準備
-- ============================================
-- 1. 以下の <ADMIN_USER_UUID> を実際の管理者ユーザーIDに置換してください
--    例: '550e8400-e29b-41d4-a716-446655440000'
--
-- 2. 管理者ユーザーIDの取得方法:
--    SELECT id, email FROM auth.users WHERE email = 'admin@example.com';
--
-- 3. このSQLを実行すると、既存データのuser_idがNULLの行が全て管理者ユーザーに紐付けられます
--    適切なユーザーIDを設定してください

-- ============================================
-- プレースホルダー（置換が必要）
-- ============================================
-- 以下の <ADMIN_USER_UUID> を実際の管理者ユーザーIDに置換してください
\set admin_user_id '<ADMIN_USER_UUID>'

-- PostgreSQLの変数が使えない場合は、以下のSQLを直接編集してください：
-- UPDATE public.jobs SET user_id = '実際のUUID' WHERE user_id IS NULL;
-- UPDATE public.reports SET user_id = '実際のUUID' WHERE user_id IS NULL;

-- ============================================
-- 実行前の確認（現状把握）
-- ============================================
SELECT 
  'jobs' as table_name,
  COUNT(*) as total_rows,
  COUNT(user_id) as rows_with_user_id,
  COUNT(*) - COUNT(user_id) as rows_without_user_id,
  ROUND(100.0 * COUNT(user_id) / COUNT(*), 2) as percentage_with_user_id
FROM public.jobs
UNION ALL
SELECT 
  'reports' as table_name,
  COUNT(*) as total_rows,
  COUNT(user_id) as rows_with_user_id,
  COUNT(*) - COUNT(user_id) as rows_without_user_id,
  ROUND(100.0 * COUNT(user_id) / NULLIF(COUNT(*), 0), 2) as percentage_with_user_id
FROM public.reports
ORDER BY table_name;

-- ============================================
-- 移行処理
-- ============================================

BEGIN;

-- jobsテーブルのuser_idがNULLの行を更新
-- ⚠️ <ADMIN_USER_UUID> を実際の管理者ユーザーIDに置換してください
UPDATE public.jobs 
SET user_id = '<ADMIN_USER_UUID>'::UUID
WHERE user_id IS NULL;

-- reportsテーブルのuser_idがNULLの行を更新
-- ⚠️ <ADMIN_USER_UUID> を実際の管理者ユーザーIDに置換してください
UPDATE public.reports 
SET user_id = '<ADMIN_USER_UUID>'::UUID
WHERE user_id IS NULL;

COMMIT;

-- ============================================
-- 実行後の確認（移行結果の検証）
-- ============================================
SELECT 
  'jobs' as table_name,
  COUNT(*) as total_rows,
  COUNT(user_id) as rows_with_user_id,
  COUNT(*) - COUNT(user_id) as rows_without_user_id,
  CASE 
    WHEN COUNT(*) - COUNT(user_id) = 0 THEN '✓ 移行完了'
    ELSE '✗ 未移行データあり'
  END as status
FROM public.jobs
UNION ALL
SELECT 
  'reports' as table_name,
  COUNT(*) as total_rows,
  COUNT(user_id) as rows_with_user_id,
  COUNT(*) - COUNT(user_id) as rows_without_user_id,
  CASE 
    WHEN COUNT(*) - COUNT(user_id) = 0 THEN '✓ 移行完了'
    ELSE '✗ 未移行データあり'
  END as status
FROM public.reports
ORDER BY table_name;

-- ============================================
-- 詳細確認（更新された行の確認）
-- ============================================
-- 管理者ユーザーに紐付けられた行数を確認
SELECT 
  'jobs' as table_name,
  user_id,
  COUNT(*) as row_count
FROM public.jobs
WHERE user_id = '<ADMIN_USER_UUID>'::UUID
GROUP BY user_id
UNION ALL
SELECT 
  'reports' as table_name,
  user_id,
  COUNT(*) as row_count
FROM public.reports
WHERE user_id = '<ADMIN_USER_UUID>'::UUID
GROUP BY user_id
ORDER BY table_name;

-- ============================================
-- 外部キー制約の確認
-- ============================================
-- 更新したuser_idがauth.usersに存在するか確認
SELECT 
  'jobs' as table_name,
  COUNT(*) as total_rows,
  COUNT(j.user_id) as valid_user_ids,
  COUNT(*) - COUNT(j.user_id) as invalid_user_ids
FROM public.jobs j
LEFT JOIN auth.users u ON j.user_id = u.id
UNION ALL
SELECT 
  'reports' as table_name,
  COUNT(*) as total_rows,
  COUNT(r.user_id) as valid_user_ids,
  COUNT(*) - COUNT(r.user_id) as invalid_user_ids
FROM public.reports r
LEFT JOIN auth.users u ON r.user_id = u.id
ORDER BY table_name;

-- ============================================
-- 手動実行用のSQL（プレースホルダーを使わない場合）
-- ============================================
-- 以下のSQLをコピーして、'実際のUUID' の部分を置換して実行することもできます：
--
-- BEGIN;
--
-- UPDATE public.jobs 
-- SET user_id = '実際のUUID'::UUID
-- WHERE user_id IS NULL;
--
-- UPDATE public.reports 
-- SET user_id = '実際のUUID'::UUID
-- WHERE user_id IS NULL;
--
-- COMMIT;

-- ============================================
-- 実行前のチェックリスト
-- ============================================
-- [ ] <ADMIN_USER_UUID> を実際の管理者ユーザーIDに置換した
-- [ ] 管理者ユーザーIDが正しいことを確認した（auth.usersテーブルで確認）
-- [ ] 実行前の確認SQLで現状を把握した
-- [ ] バックアップを取得した（本番環境の場合）
-- [ ] 開発環境でテストした（本番環境の場合）

-- ============================================
-- 実行後のチェックリスト
-- ============================================
-- [ ] 実行後の確認SQLで、rows_without_user_id が 0 であることを確認した
-- [ ] 外部キー制約の確認SQLで、invalid_user_ids が 0 であることを確認した
-- [ ] 更新された行数が期待通りであることを確認した
-- [ ] RLS有効化の準備が整った

