# mojioko_v1 desktop handoff

## Current branch

```bash
feature/transcription-mvp
```

## Latest pushed commit

```bash
f0c4783 feat: add PLAUD CLI import
```

## GitHub

```text
https://github.com/dawg2004/mojioko_v1
```

## Current implementation status

- Next.js / TypeScript / Tailwind app is implemented.
- Audio upload is browser-to-Google Drive resumable upload.
- Transcript history and generated output are stored in Notion.
- OpenAI Audio API is used for files up to 25MB.
- Files larger than 25MB are saved as `uploaded` for a future ffmpeg split worker.
- PLAUD CLI import UI was added to the top page.

## Added PLAUD CLI import

Files:

- `components/plaud-import-panel.tsx`
- `app/api/plaud/files/route.ts`
- `app/api/plaud/import/route.ts`
- `lib/plaud/cli.ts`

Behavior:

- `GET /api/plaud/files` runs:

```bash
plaud files --page-size 20
```

- `POST /api/plaud/import` runs:

```bash
plaud file <id>
plaud audio <id>
```

- It saves the PLAUD audio URL to Notion.
- If the audio is 25MB or smaller, it downloads the audio and runs OpenAI transcription and summary generation.
- If larger than 25MB, it saves the record for a future split worker.

## Important limitation

PLAUD CLI/MCP is suitable for local desktop or self-hosted use first.

Vercel Serverless does not reliably keep the interactive `plaud login` state. For production-grade direct PLAUD integration, switch to the official PLAUD Developer Platform API/OAuth once access is available.

## Verification already done

```bash
npm run build
npm run lint
```

Both passed before commit `f0c4783`.

## Desktop continuation commands

Run these in the desktop terminal:

```bash
cd /Users/dawg/vscode/mojioko_v1/mojioko_v1
git fetch origin
git switch feature/transcription-mvp
git pull origin feature/transcription-mvp
npm install
npm install -g @plaud-ai/cli
plaud login
plaud files
npm run dev
```

Then open:

```text
http://localhost:3000
```

Use the top page section:

```text
PLAUDから取り込み
```

## Vercel / env status

Vercel currently has:

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_MAX_UPLOAD_SIZE_BYTES=3221225472`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`

Google OAuth Client ID still needs to be replaced if the browser shows:

```text
no registered origin
Error 401: invalid_client
```

Create a Google Cloud OAuth client of type `Web application` and add:

```text
https://mojioko-v1.vercel.app
http://localhost:3000
```

Then replace `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel.

## Notion note

The original Notion URL was a page URL, not a database URL. A database named `mojioko transcripts` was created under that page and Vercel `NOTION_DATABASE_ID` was replaced with the created database ID.

## GitHub auth note

The push succeeded after switching to `dawg2004`.

`luxewave0002-svg` was not removed because it may be used later.

## Good next task

Validate local PLAUD CLI import:

1. Confirm `plaud files` returns recordings.
2. Start `npm run dev`.
3. Click `PLAUDから取り込み`.
4. Confirm `/api/plaud/files` returns recordings.
5. Import one small recording.
6. Confirm Notion receives the record.
7. Confirm OpenAI transcription runs for files <=25MB.
