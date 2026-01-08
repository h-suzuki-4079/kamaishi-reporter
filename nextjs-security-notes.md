# Next.js + Supabase セキュリティ実装ガイド

## 目的
Next.js App RouterとSupabaseを組み合わせたアプリケーションで、RLS（Row Level Security）を安全に実装するためのガイド

## 対象
- Next.js 14+ (App Router)
- Supabase (PostgreSQL + Auth)
- TypeScript

## 注意点
- **重要**: 現在のアプリケーションには認証機能がないため、RLSを有効化するとアプリが動作しなくなる
- **重要**: `service_role`キーは絶対にブラウザに公開してはいけない
- 本番環境に適用する前に、必ず開発環境でテストすること

---

## 1. 環境変数の使い分け

### クライアント側（ブラウザ）: `anon`キーを使用

```typescript
// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**重要ポイント:**
- ✅ `NEXT_PUBLIC_`プレフィックスが付いた環境変数はブラウザに公開される
- ✅ `anon`キーは公開されても問題ない（RLSで保護されているため）
- ✅ ユーザー認証が必要な場合は、`supabase.auth.signIn()`でログインする
- ✅ ログイン後、`auth.uid()`が自動的にRLSポリシーで使用される

### サーバー側（API Routes / Server Components）: `service_role`キーを使用

```typescript
// lib/supabaseServer.ts（新規作成）
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// ⚠️ NEXT_PUBLIC_を付けない（ブラウザに公開されないように）
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
```

**重要ポイント:**
- ⚠️ `service_role`キーは**絶対に**ブラウザに公開してはいけない
- ⚠️ `NEXT_PUBLIC_`プレフィックスを**付けない**
- ⚠️ `.env.local`に保存し、`.gitignore`で除外する
- ⚠️ `service_role`キーはRLSを**バイパス**するため、管理者専用の処理でのみ使用
- ⚠️ Vercelなどのホスティング環境では、環境変数設定画面で`NEXT_PUBLIC_`なしで設定する

---

## 2. RLS移行手順

### ⚠️ 重要: 現在のアプリケーションの問題点

現在のアプリケーションは認証機能がなく、`localStorage`でワーカーの案件を管理しています。
**RLSを有効化すると、認証なしではアクセスできなくなり、アプリが動作しなくなります。**

### 移行手順（段階的実装）

#### ステップ1: 認証機能の導入

```typescript
// app/login/page.tsx（新規作成）
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      alert('ログインに失敗しました: ' + error.message);
      return;
    }
    
    router.push('/');
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
        required
      />
      <button type="submit">ログイン</button>
    </form>
  );
}
```

#### ステップ2: user_idカラムの追加と既存データの移行

```sql
-- 1. user_idカラムを追加
ALTER TABLE public.jobs ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.reports ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- 2. 既存データにuser_idを設定
-- ⚠️ 実際の運用では、適切なユーザーIDを設定してください
UPDATE public.jobs 
SET user_id = (SELECT id FROM auth.users WHERE email = '適切なメールアドレス')
WHERE user_id IS NULL;

UPDATE public.reports 
SET user_id = (SELECT id FROM auth.users WHERE email = '適切なメールアドレス')
WHERE user_id IS NULL;
```

#### ステップ3: コードの修正（user_idを自動設定）

```typescript
// app/admin/add/page.tsx の修正例
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // 現在のユーザーを取得
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    alert('ログインが必要です');
    router.push('/login');
    return;
  }

  const { error } = await supabase
    .from('jobs')
    .insert([
      {
        title: formData.title,
        company: formData.company,
        location: formData.location,
        reward: formData.reward,
        description: formData.description,
        status: 'open',
        user_id: user.id, // 自動設定
      },
    ]);
  // ...
};
```

#### ステップ4: RLS有効化

```sql
-- supabase-rls-setup.sql を実行
-- この時点で、認証なしのアクセスはできなくなる
```

#### ステップ5: テスト

- 通常ユーザーでログインして動作確認
- 管理者ユーザーでログインして動作確認
- 未ログイン状態でアクセスできないことを確認

---

## 3. ハマりやすいポイント

### ポイント1: 環境変数の設定ミス

```bash
# ❌ 間違い: service_roleキーにNEXT_PUBLIC_を付ける
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=xxx
# → ブラウザに公開され、セキュリティリスク

# ✅ 正しい: service_roleキーにはNEXT_PUBLIC_を付けない
SUPABASE_SERVICE_ROLE_KEY=xxx
# → サーバー側でのみ使用可能
```

**確認方法**:
- ブラウザの開発者ツール > Networkタブで、リクエストヘッダーを確認
- `apikey`ヘッダーに`service_role`キーが含まれていないことを確認

### ポイント2: クライアントコンポーネントでservice_roleキーを使う

```typescript
// ❌ 絶対にやってはいけない
'use client';
const supabase = createClient(url, serviceRoleKey); // ブラウザに公開される！

// ✅ 正しい
'use client';
const supabase = createClient(url, anonKey); // anonキーは公開OK
```

### ポイント3: RLS有効化後の認証コンテキスト

```typescript
// ❌ 認証なしでアクセスしようとするとエラー
const { data } = await supabase.from('jobs').select('*');
// エラー: "new row violates row-level security policy"

// ✅ 認証後にアクセス
await supabase.auth.signInWithPassword({ email, password });
const { data } = await supabase.from('jobs').select('*');
// 成功: 自分の案件のみ取得される
```

### ポイント4: user_idの自動設定

```typescript
// ❌ user_idを設定しないとRLSポリシーに引っかかる
await supabase.from('jobs').insert({ title: '案件' });

// ✅ user_idを明示的に設定
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('jobs').insert({ 
  title: '案件',
  user_id: user?.id // 必須
});
```

### ポイント5: 管理者判定のタイミング

```typescript
// ❌ クライアント側で管理者判定（セキュリティリスク）
const isAdmin = await checkAdminStatus(); // クライアント側の判定は信頼できない

// ✅ サーバー側で管理者判定
// API RouteまたはServer Componentで判定
```

### ポイント6: 既存データのuser_idがNULL

```typescript
// 問題: 既存データのuser_idがNULLの場合、RLS有効化後にアクセスできなくなる

// 解決: 移行SQLを実行してuser_idを設定
// UPDATE public.jobs SET user_id = '適切なUUID' WHERE user_id IS NULL;
```

---

## 4. 実装パターン

### パターン1: クライアント側で認証済みユーザーの操作

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function MyComponent() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // ログイン状態を確認
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
    });
  }, [router]);

  const handleCreate = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('jobs')
      .insert({
        title: '案件',
        user_id: user.id, // 必須
        // ... 他のフィールド
      });

    if (error) {
      console.error('Error:', error);
      return;
    }
    // 成功処理
  };

  return <div>...</div>;
}
```

### パターン2: サーバー側で管理者操作

```typescript
// app/api/admin/jobs/route.ts
import { supabaseServer } from '@/lib/supabaseServer';
import { createRouteHandlerClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  // 認証チェック（anonキーを使用）
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // 管理者チェック（service_roleキーを使用）
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  
  if (!profile?.is_admin) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // 管理者として全件取得（service_roleキーでRLSバイパス）
  const { data } = await supabaseServer
    .from('jobs')
    .select('*');
  
  return Response.json(data);
}
```

---

## 5. 最小チェックリスト

### 環境変数
- [ ] `.env.local`に`SUPABASE_SERVICE_ROLE_KEY`が設定されている（`NEXT_PUBLIC_`なし）
- [ ] `service_role`キーがブラウザに公開されていない（Networkタブで確認）
- [ ] `NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`が設定されている

### コード実装
- [ ] クライアントコンポーネントでは`anon`キーのみ使用
- [ ] サーバーコンポーネント/API Routesでのみ`service_role`キーを使用
- [ ] INSERT時に`user_id`が正しく設定されている
- [ ] 認証が必要な操作では、ユーザーがログインしていることを確認

### RLS設定
- [ ] RLSポリシーが正しく動作している（テスト手順を実行）
- [ ] 通常ユーザーは自分の行のみアクセス可能
- [ ] 管理者は全件アクセス可能
- [ ] anonユーザーはアクセス不可

### データ移行
- [ ] 既存データに`user_id`が設定されている
- [ ] `user_id`がNULLの行がない（または適切に処理されている）
- [ ] 管理者フラグが正しく設定されている（profilesテーブルまたはapp_metadata）

---

## 6. 次のステップ

RLS導入を完了するために、以下の順序で作業を進めてください：

1. **現状確認**
   - `supabase-security-check.sql`を実行して現状を把握
   - `user_id`カラムの有無を確認
   - 既存データの有無を確認

2. **認証機能の導入**（必須）
   - ログイン/ログアウト機能を実装
   - ユーザー登録機能を実装（必要に応じて）
   - 認証状態の管理（セッション管理）

3. **データ移行**
   - `user_id`カラムを追加（存在しない場合）
   - 既存データに`user_id`を設定
   - 管理者ユーザーの設定（profilesテーブルまたはapp_metadata）

4. **コード修正**
   - INSERT時に`user_id`を自動設定
   - 認証チェックを追加
   - エラーハンドリングの実装

5. **RLS有効化**
   - `supabase-rls-setup.sql`を実行
   - 既存ポリシーを削除（存在する場合）
   - 新規ポリシーを作成

6. **テスト**
   - `supabase-test-procedures.md`に従ってテスト
   - 通常ユーザー、管理者、anonユーザーで動作確認
   - エラーケースのテスト

7. **本番環境への適用**
   - 開発環境で十分にテストした後、本番環境に適用
   - 本番データのバックアップを取得
   - 段階的にロールアウト（可能であれば）

---

## 7. 緊急時の対応

### RLSを一時的に無効化する場合

```sql
-- ⚠️ 緊急時のみ使用（セキュリティリスクあり）
ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
```

**警告**: この操作はセキュリティリスクが高いため、本番環境では使用しないこと。
問題を解決したら、すぐにRLSを再有効化すること。

### 一時的にanonアクセスを許可する場合

```sql
-- ⚠️ 緊急時のみ使用（セキュリティリスクあり）
CREATE POLICY "Temporary anon access"
  ON public.jobs FOR SELECT
  USING (true);
```

**警告**: この方法はセキュリティリスクが高いため、本番環境では使用しないこと。
認証機能を導入して、適切なRLSポリシーを設定すること。
