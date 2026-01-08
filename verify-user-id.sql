-- ============================================
-- /admin/add で作成した jobs の user_id がUUIDになっているか確認
-- ============================================

-- 1. 最新のjobsレコードを確認（user_idがUUID形式かチェック）
SELECT 
  id,
  title,
  company,
  user_id,
  CASE 
    WHEN user_id IS NULL THEN '✗ NULL（トリガーが動作していない可能性）'
    WHEN user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN '✓ 有効なUUID'
    ELSE '✗ 無効な形式'
  END as user_id_status,
  created_at
FROM public.jobs
ORDER BY created_at DESC
LIMIT 10;

-- 2. user_idがNULLのレコード数を確認
SELECT 
  COUNT(*) as total_jobs,
  COUNT(user_id) as jobs_with_user_id,
  COUNT(*) - COUNT(user_id) as jobs_without_user_id
FROM public.jobs;

-- 3. 各ユーザーが作成した案件数を確認
SELECT 
  user_id,
  COUNT(*) as job_count,
  MAX(created_at) as latest_created_at
FROM public.jobs
WHERE user_id IS NOT NULL
GROUP BY user_id
ORDER BY latest_created_at DESC;

-- 4. auth.usersテーブルと照合（外部キー制約の確認）
SELECT 
  j.id as job_id,
  j.title,
  j.user_id,
  u.email as user_email,
  CASE 
    WHEN u.id IS NULL THEN '✗ ユーザーが存在しない'
    ELSE '✓ 有効なユーザー'
  END as user_status
FROM public.jobs j
LEFT JOIN auth.users u ON j.user_id = u.id
ORDER BY j.created_at DESC
LIMIT 10;

