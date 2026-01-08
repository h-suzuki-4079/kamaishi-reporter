# Supabase RLS テスト手順

## 目的
RLS有効化後、各ロール（通常ユーザー、管理者、anon）で期待どおりの動作を確認する

## 対象
- public.jobs テーブル
- public.reports テーブル

## 注意点
- テストは本番環境ではなく、開発環境で実施すること
- 既存データがある場合、user_idの移行が必要
- 認証機能が有効でない場合、RLSは動作しない

---

## テスト前の準備

### 1. Supabaseダッシュボードで認証ユーザーを作成

1. Supabase Dashboard > Authentication > Users に移動
2. 「Add user」をクリック
3. 以下の2つのユーザーを作成：
   - **通常ユーザー**: `test-user@example.com` / パスワード: `testpass123`
   - **管理者ユーザー**: `admin@example.com` / パスワード: `adminpass123`

### 2. 管理者ユーザーの設定

#### Option A: profilesテーブル方式（推奨）

```sql
-- 管理者フラグを設定
INSERT INTO public.profiles (id, is_admin)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
  TRUE
)
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;

-- 確認
SELECT id, is_admin FROM public.profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

#### Option B: app_metadata方式

1. Supabase Dashboard > Authentication > Users に移動
2. `admin@example.com` のユーザーを選択
3. 「Edit user」をクリック
4. 「Raw App Meta Data」に以下を追加：
```json
{
  "role": "admin"
}
```

または、Management APIを使用：
```bash
curl -X PUT 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users/USER_ID' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"app_metadata": {"role": "admin"}}'
```

### 3. 既存データの移行（重要）

**既存データがある場合、user_idを設定する必要があります。**

```sql
-- 既存データの確認
SELECT COUNT(*) as total, COUNT(user_id) as with_user_id 
FROM public.jobs;
SELECT COUNT(*) as total, COUNT(user_id) as with_user_id 
FROM public.reports;

-- 既存データにuser_idを設定（例：最初のユーザーに紐付ける）
-- ⚠️ 実際の運用では、適切なユーザーIDを設定してください
UPDATE public.jobs 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

UPDATE public.reports 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;
```

---

## テスト手順

### 1. RLS有効化の確認

```sql
-- RLSが有効になっているか確認
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN '✓ RLS有効' ELSE '✗ RLS無効' END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('jobs', 'reports')
ORDER BY tablename;
```

**期待結果**: `rls_enabled = true` が表示される

### 2. ポリシーの確認

```sql
-- ポリシー一覧を確認
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN '閲覧'
    WHEN cmd = 'INSERT' THEN '作成'
    WHEN cmd = 'UPDATE' THEN '更新'
    WHEN cmd = 'DELETE' THEN '削除'
    ELSE cmd
  END as operation
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('jobs', 'reports')
ORDER BY tablename, cmd, policyname;
```

**期待結果**: 
- jobsテーブル: 6つのポリシー（SELECT×2, INSERT×2, UPDATE×2）
- reportsテーブル: 6つのポリシー（SELECT×2, INSERT×2, UPDATE×2）

### 3. 通常ユーザーでのテスト

**重要**: Supabase SQL Editorでは認証コンテキストがないため、実際のアプリケーションからテストする必要があります。

#### 3-1. アプリケーションでのテスト手順

1. 通常ユーザー（`test-user@example.com`）でログイン
2. 以下の操作を確認：

```typescript
// 自分の案件のみ閲覧可能か確認
const { data: myJobs } = await supabase
  .from('jobs')
  .select('*');
// 期待: user_id = 現在のユーザーID の案件のみ取得される

// 自分の案件を作成可能か確認
const { data: newJob, error } = await supabase
  .from('jobs')
  .insert({
    title: 'テスト案件',
    company: 'テスト会社',
    location: 'テスト場所',
    reward: '1000',
    description: 'テスト説明',
    status: 'open',
    user_id: (await supabase.auth.getUser()).data.user?.id
  });
// 期待: エラーなく作成される

// 自分の案件を更新可能か確認
const { data: updatedJob, error } = await supabase
  .from('jobs')
  .update({ status: 'assigned' })
  .eq('id', newJob[0].id);
// 期待: エラーなく更新される
```

#### 3-2. よくある失敗パターン

**失敗1: user_idがNULL**
```
エラー: "new row violates row-level security policy"
原因: INSERT時にuser_idが設定されていない
解決: user_id = auth.uid() を明示的に設定
```

**失敗2: 既存データが不可視**
```
現象: 既存の案件が表示されない
原因: 既存データのuser_idがNULL、または別のユーザーID
解決: 既存データにuser_idを設定（移行SQLを実行）
```

**失敗3: JWTが反映されない**
```
現象: 認証しているのにアクセスできない
原因: ブラウザのセッションが切れている、または認証トークンが無効
解決: 再ログイン、またはsupabase.auth.refreshSession()
```

### 4. 管理者ユーザーでのテスト

1. 管理者ユーザー（`admin@example.com`）でログイン
2. 以下の操作を確認：

```typescript
// 全案件を閲覧可能か確認
const { data: allJobs } = await supabase
  .from('jobs')
  .select('*');
// 期待: 全件取得できる（user_idに関係なく）

// 全案件を更新可能か確認
const { data: updatedJobs, error } = await supabase
  .from('jobs')
  .update({ status = 'open' })
  .eq('status', 'assigned');
// 期待: エラーなく更新される（他人の案件も含む）
```

### 5. 未認証ユーザー（anon）でのテスト

**重要**: anonユーザーは原則アクセス不可です。

```typescript
// ログアウト状態で実行
await supabase.auth.signOut();

// 案件を取得しようとすると...
const { data, error } = await supabase
  .from('jobs')
  .select('*');
// 期待: data = null, error = "permission denied" または空の配列
```

---

## トラブルシューティング

### エラー: "new row violates row-level security policy"

**原因**: 
- INSERT時に`user_id`が設定されていない
- `auth.uid()`がNULL（認証されていない）

**解決策**:
```typescript
// ❌ 間違い
await supabase.from('jobs').insert({ title: '案件' });

// ✅ 正しい
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('jobs').insert({ 
  title: '案件',
  user_id: user?.id 
});
```

### エラー: "permission denied for table"

**原因**: 
- RLSが有効だが、該当するポリシーがない
- 認証されていない状態でアクセスしている

**解決策**:
1. ポリシーが作成されているか確認（テスト手順2を実行）
2. ユーザーがログインしているか確認
3. `auth.uid()`が正しく取得できるか確認

### 管理者フラグが効かない

**原因**: 
- profilesテーブルにデータがない（Option A）
- app_metadataが設定されていない（Option B）
- JWTが更新されていない

**解決策**:

**Option Aの場合**:
```sql
-- 管理者フラグを確認
SELECT id, is_admin FROM public.profiles 
WHERE id = auth.uid();

-- 管理者フラグを設定
UPDATE public.profiles 
SET is_admin = TRUE 
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

**Option Bの場合**:
- Supabase Dashboardでapp_metadataを確認
- ユーザーを再ログインしてJWTを更新

### 既存データが表示されない

**原因**: 
- 既存データの`user_id`がNULL
- 既存データの`user_id`が現在のユーザーIDと一致しない

**解決策**:
```sql
-- 既存データのuser_idを確認
SELECT id, title, user_id FROM public.jobs WHERE user_id IS NULL;

-- 既存データにuser_idを設定（適切なユーザーIDに置き換える）
UPDATE public.jobs 
SET user_id = '適切なUUID' 
WHERE user_id IS NULL;
```

### JWTが反映されない

**原因**: 
- ブラウザのセッションが切れている
- 認証トークンが無効

**解決策**:
```typescript
// セッションをリフレッシュ
await supabase.auth.refreshSession();

// または再ログイン
await supabase.auth.signInWithPassword({ email, password });
```

---

## テスト完了チェックリスト

- [ ] RLSが有効になっている（jobs, reports）
- [ ] ポリシーが正しく作成されている（各テーブル6つ）
- [ ] 通常ユーザーで自分の案件のみ閲覧できる
- [ ] 通常ユーザーで自分の案件を作成できる
- [ ] 通常ユーザーで自分の案件を更新できる
- [ ] 通常ユーザーで他人の案件は閲覧できない
- [ ] 管理者で全案件を閲覧できる
- [ ] 管理者で全案件を更新できる
- [ ] anonユーザーはアクセスできない
- [ ] 既存データが正しく表示される（user_idが設定されている）

---

## 次のステップ

テストが完了したら、本番環境に適用する前に以下を確認：

1. 既存データの移行計画を立てる
2. 認証機能の導入（現在のアプリに認証がない場合）
3. エラーハンドリングの実装
4. ログイン/ログアウト機能の実装
5. 管理者画面の実装
