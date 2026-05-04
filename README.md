# mojioko

PLAUD録音ファイルをアップロードして、AIで文字起こし・要約・議事録化するWeb Appです。音声ファイルはGoogle Driveに保存し、履歴・要約・議事録・TODOはNotion Databaseで管理します。

## 技術構成

- Next.js App Router
- TypeScript
- Tailwind CSS
- Google Drive API
- Google Identity Services
- Notion API
- OpenAI Audio API / GPT
- Vercel

## MVP機能

- mp3 / m4a / wav / mp4 / webm のアップロード
- Google Drive resumable upload による最大3GBの大容量アップロード
- ドラッグ&ドロップまたはファイル選択
- Google Driveへの音声保存
- Notion Databaseへの履歴保存
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
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID=
NEXT_PUBLIC_MAX_UPLOAD_SIZE_BYTES=3221225472
NOTION_TOKEN=
NOTION_DATABASE_ID=
```

`NOTION_TOKEN` と `OPENAI_API_KEY` はサーバー側APIでのみ使用します。ブラウザに露出しないよう、`NEXT_PUBLIC_` を付けないでください。

## Google Drive設定

3GB音声ファイルはGoogle Driveに保存します。

1. Google Cloud Consoleでプロジェクトを作成します。
2. Google Drive APIを有効化します。
3. OAuth同意画面を設定します。
4. Web ApplicationのOAuth Client IDを作成します。
5. Authorized JavaScript originsにローカルと本番URLを追加します。
   - `http://localhost:3000`
   - `https://mojioko-v1.vercel.app`
6. Client IDを `NEXT_PUBLIC_GOOGLE_CLIENT_ID` に設定します。
7. 保存先フォルダを固定したい場合はGoogle DriveフォルダIDを `NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID` に設定します。

Google Driveは通常ファイルを最大5TBまで保存できます。Drive APIのresumable uploadを使うため、Vercel Functionのリクエストサイズ制限を回避できます。

## Notion設定

履歴・要約・議事録・TODOはNotion Databaseに保存します。

1. NotionでDatabaseを作成します。
2. Notion Integrationを作成し、Internal Integration Tokenを取得します。
3. DatabaseをIntegrationに共有します。
4. Database IDを `NOTION_DATABASE_ID` に設定します。
5. Integration Tokenを `NOTION_TOKEN` に設定します。

アプリは初回保存時に以下のプロパティをDatabaseへ追加します。

- `Status`
- `Original File Name`
- `Drive File ID`
- `Drive File URL`
- `File Size Bytes`
- `Transcript Text`
- `Summary`
- `Minutes`
- `TODO`

## 旧Supabase設定

Supabase Storage / Databaseは現在の本線から外しました。過去のMVP SQLは `supabase/transcripts.sql` に残しています。

## 大容量ファイルの処理方針

Vercel Functionはリクエスト本文サイズの上限があるため、音声ファイルはNext.js APIを経由せず、ブラウザからGoogle Driveへresumable uploadで直接送信します。

OpenAI Audio APIは1回の音声ファイルアップロードが25MBまでのため、25MBを超える録音はアップロード後に `uploaded` のまま保存されます。3時間公演などの大容量音声を文字起こしするには、別途ワーカーで以下の処理を追加してください。

1. Google Driveから音声を取得
2. ffmpegで音声を圧縮または25MB未満のチャンクへ分割
3. 各チャンクをOpenAI Audio APIで文字起こし
4. チャンク結果を結合
5. 要約・議事録・TODOを生成
6. Notionページを `completed` に更新

### 旧Database SQL

Supabase版へ戻す場合のみ使います。同じSQLは `supabase/transcripts.sql` にも置いています。

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
4. デプロイ後、Google Drive OAuthとNotion Databaseの設定を確認します。

25MB以下の音声は同期処理で文字起こしします。25MB超の長時間音声は、Google Drive上のファイルをバックグラウンドワーカーで分割処理する構成を推奨します。

## 実装計画ドキュメント

3GB音声の分割文字起こしパイプライン実装計画は以下を参照してください。

- `docs/large-file-transcription-plan.md`

## 今後の追加予定

- 話者分離
- Google Drive音声分割ワーカー
- Notionテンプレート連携
- PLAUDファイル一括アップロード
- フォルダ監視
- 検索機能
- タグ管理
- 顧客別管理
- PDF出力
- 議事録テンプレート切り替え
