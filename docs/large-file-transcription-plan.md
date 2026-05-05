# 3GB音声メディア対応 文字起こしWebApp 実装計画

このドキュメントは、`mojioko` を **最大3GBの音声メディア（wav / mp4 など）を安定的に文字起こしできる構成** に拡張するための実装計画です。

## 1. 要件

- 対応フォーマット: `mp3`, `m4a`, `wav`, `mp4`, `webm`
- 最大アップロードサイズ: `3GB`
- 大容量ファイルはブラウザからGoogle Driveへ直接アップロード（resumable upload）
- 25MB超ファイルは非同期ワーカーで分割文字起こし
- 進捗表示（`uploaded -> processing -> completed / failed`）

## 2. なぜ非同期が必要か

OpenAI Audio API は1回の音声アップロード上限があるため、3GB音声を1回で処理できません。
そのため、以下のパイプラインに分割します。

1. Google Driveへ保存
2. ワーカーがDriveから取得
3. ffmpegで音声抽出・分割
4. 分割片ごとに文字起こし
5. 全文結合
6. 要約・議事録・TODO生成

## 3. 推奨アーキテクチャ

- **Frontend (Next.js App Router)**
  - アップロードUI
  - 処理状態表示
- **Storage (Google Drive)**
  - 元ファイル（最大3GB）保管
- **Queue**
  - `transcript_jobs` キュー（例: Cloud Tasks / Upstash QStash / SQS）
- **Worker**
  - ffmpeg利用
  - 分割文字起こし
  - 再試行
- **Metadata (Notion DB)**
  - 状態、文字起こし本文、要約、議事録、TODOを保存

## 4. 分割方針

- まず `ffprobe` で長さ・ビットレート確認
- 分割時は「重なり」を持たせる（例: 前後2〜5秒）
- 分割結果を時系列結合
- 結合後に軽い整形（重複文の除去）

## 5. エラーハンドリング

- チャンク単位で再試行（指数バックオフ）
- 失敗時はジョブ全体を `failed`
- 再実行ボタンで `uploaded` または `failed` から再投入

## 6. 実装ステップ

1. ジョブ投入API追加（`uploaded` をキュー投入）
2. ワーカー雛形作成（Drive取得 / ffmpeg分割）
3. チャンク文字起こしと結合
4. 要約・議事録・TODO生成
5. UI進捗表示と再実行導線
6. 負荷試験（1GB/2GB/3GB）

## 7. 受け入れ基準

- 3GB wav/mp4 をアップロード可能
- 25MB超ファイルが非同期で最終的に `completed`
- 失敗時に再実行可能
- `/transcripts/[id]` で全文・要約・議事録・TODOを表示できる
