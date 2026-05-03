# mojioko

PLAUD録音ファイルをアップロードして、AIで文字起こし・要約・議事録化するWeb Appです。Supabase Storageに音声を保存し、OpenAI Audio APIで文字起こし、GPTで要約・議事録・TODOを生成してSupabase Databaseに保存します。

## 技術構成

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Database
- Supabase Storage
- OpenAI Audio API / GPT
- Vercel

## MVP機能

- mp3 / m4a / wav / mp4 / webm のアップロード
- Supabase TUS resumable upload による最大3GBの大容量アップロード
- ドラッグ&ドロップまたはファイル選択
- Supabase Storage `audio-files` bucket への保存
- `transcripts` テーブルへの履歴保存
- 25MB以下の音声はOpenAI `gpt-4o-mini-transcribe` による文字起こし
- GPTによる日本語の要約・議事録・TODO抽出
- `/transcripts` の履歴一覧
- `/transcripts/[id]` の詳細表示、タブ切り替え、コピー、元音声リンク

## セットアップ

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

ローカル起動後、`http://localhost:3000` を開きます。

## 環境変数

`.env.local` に以下を設定してください。`.env.local` はGit管理しません。

```bash
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` はサーバー側APIでのみ使用します。ブラウザに露出しないよう、`NEXT_PUBLIC_` を付けないでください。

## Supabase設定

対象プロジェクト:

https://supabase.com/dashboard/project/culbricxbybfrkeqxllc

### Storage bucket

Supabase Dashboardで Storage bucket を作成します。

- Bucket name: `audio-files`
- Public bucket: 詳細ページから元音声を開きたい場合はON
- File size limit: `3GB` 以上

3GBの録音ファイルを扱う場合、SupabaseプロジェクトはPro以上を推奨します。FreeプランのStorage上限では3GBファイルを保存できません。

Private bucketで運用する場合は、詳細ページの元音声リンクを署名付きURLに変更してください。

### 大容量ファイルの処理方針

Vercel Functionはリクエスト本文サイズの上限があるため、音声ファイルはNext.js APIを経由せず、ブラウザからSupabase StorageへTUS resumable uploadで直接送信します。

OpenAI Audio APIは1回の音声ファイルアップロードが25MBまでのため、25MBを超える録音はアップロード後に `uploaded` のまま保存されます。3時間公演などの大容量音声を文字起こしするには、別途ワーカーで以下の処理を追加してください。

1. Supabase Storageから音声を取得
2. ffmpegで音声を圧縮または25MB未満のチャンクへ分割
3. 各チャンクをOpenAI Audio APIで文字起こし
4. チャンク結果を結合
5. 要約・議事録・TODOを生成
6. `transcripts` テーブルを `completed` に更新

### Database SQL

Supabase SQL Editorで以下を実行します。同じSQLは `supabase/transcripts.sql` にも置いています。

```sql
create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  title text,
  original_file_name text,
  original_file_url text,
  storage_path text,
  file_size_bytes bigint,
  transcript_text text,
  summary text,
  minutes text,
  todos text,
  status text default 'uploaded',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists transcripts_created_at_idx
on transcripts (created_at desc);

create index if not exists transcripts_status_idx
on transcripts (status);

alter table transcripts
add column if not exists storage_path text;

alter table transcripts
add column if not exists file_size_bytes bigint;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists transcripts_set_updated_at on transcripts;

create trigger transcripts_set_updated_at
before update on transcripts
for each row execute function set_updated_at();
```

## Vercelデプロイ

対象プロジェクト:

https://vercel.com/dawg2004s-projects/mojioko-v1

1. GitHubリポジトリ `https://github.com/dawg2004/mojioko_v1` をVercelプロジェクトに接続します。
2. Vercel Project Settings の Environment Variables に `.env.local.example` と同じキーを設定します。
3. Build Command は `npm run build`、Install Command は `npm install`、Output Directory は `.next` で動作します。リポジトリの `vercel.json` でも同じ設定を明示しています。
4. デプロイ後、SupabaseのURLとStorage bucket設定を確認します。

音声が長い場合、Vercel Functionの実行時間制限に達する可能性があります。MVPでは同期処理ですが、本番運用ではキュー、Webhook、Supabase Edge Functions、またはバックグラウンドジョブへの分離を推奨します。

## 今後の追加予定

- 話者分離
- Notion連携
- Google Drive連携
- PLAUDファイル一括アップロード
- フォルダ監視
- 検索機能
- タグ管理
- 顧客別管理
- PDF出力
- 議事録テンプレート切り替え
