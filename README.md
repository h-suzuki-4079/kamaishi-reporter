# Reporter's Note - 取材代行マッチングアプリ

地方創生を目的とした取材代行マッチングアプリケーションのMVPです。

## 技術スタック

- Framework: Next.js 16 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Database: Supabase (PostgreSQL)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトのルートディレクトリに `.env.local` ファイルを作成し、以下の内容を記述してください：

```env
NEXT_PUBLIC_SUPABASE_URL=https://hxlpwyhydpjqawktweio.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jvVLgu6NifyqbErkOeCvng_wVhZVBIp
```

### 3. Supabaseデータベースのセットアップ

1. Supabaseのダッシュボードにログイン
2. SQL Editorを開く
3. `supabase-schema.sql` ファイルの内容をコピー＆ペーストして実行

これにより、`jobs` テーブルが作成されます。

**既存のテーブルがある場合:**
既存のテーブルに `reference_image` カラムを追加する場合は、SQL Editorで以下を実行してください：
```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reference_image TEXT;
```

### 4. Supabase Storageのセットアップ

1. Supabaseのダッシュボードで「Storage」を開く
2. 「Create a new bucket」をクリック
3. バケット名に `images` を入力
4. 「Public bucket」にチェックを入れて作成
5. バケット作成後、以下のポリシーを設定（SQL Editorで実行）：
   ```sql
   -- Storage バケットへのアップロードを許可
   CREATE POLICY "Allow public uploads" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'images');
   
   -- Storage バケットからの読み取りを許可
   CREATE POLICY "Allow public reads" ON storage.objects
   FOR SELECT USING (bucket_id = 'images');
   ```

### 5. 認証機能のセットアップ

Supabase Dashboard > Authentication > Settings で以下を確認：
- Email認証が有効になっていること
- Email確認を必須にするかどうか（開発環境では無効推奨）

### 6. 開発サーバーの起動

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 7. 初回ログイン

1. `/signup` でアカウントを作成
2. 作成後、自動的にログインされます
3. ヘッダーにメールアドレスとログアウトボタンが表示されます

## 機能

- **認証機能**: ログイン/サインアップ/ログアウト（Supabase Auth）
- **案件一覧**: 募集中の案件を一覧表示（管理者モードでは確認中の案件も表示）
- **案件詳細**: 案件の詳細情報と見本画像を表示
- **案件登録**: 管理者が新しい案件を登録（見本画像のアップロード対応）
- **報告フォーム**: ワーカーが取材結果を報告（写真2枚とメモを送信）
- **報告確認**: 管理者が報告内容を確認し、承認して検収完了とする

## データベーステーブル

### jobs テーブル
- `id`: 主キー
- `title`: タイトル
- `company`: 企業名
- `location`: 場所
- `reward`: 報酬
- `description`: 指示内容
- `reference_image`: 見本画像URL（任意）
- `status`: ステータス（'open', 'review', 'completed'）
- `created_at`: 作成日時

### reports テーブル
- `id`: 主キー
- `job_id`: 案件ID（外部キー）
- `photo1_url`: 写真1のURL
- `photo2_url`: 写真2のURL
- `notes`: 取材メモ
- `created_at`: 作成日時
