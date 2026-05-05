"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileAudio2, Loader2, UploadCloud } from "lucide-react";
import {
  ACCEPTED_AUDIO_EXTENSIONS,
  formatBytes,
  isSupportedAudioFile,
  MAX_UPLOAD_SIZE_BYTES,
  OPENAI_AUDIO_FILE_LIMIT_BYTES,
} from "@/lib/files";

type UploadState = "idle" | "ready" | "uploading" | "success" | "error";

type GoogleDriveFile = {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  mimeType?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_CHUNK_SIZE = 8 * 1024 * 1024;

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string>("音声ファイルを選択またはドラッグ&ドロップ");
  const [progress, setProgress] = useState<number>(0);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const driveFolderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;
  const isGoogleConfigured = Boolean(googleClientId);

  const limitLabel = useMemo(() => formatBytes(MAX_UPLOAD_SIZE_BYTES), []);

  function selectFile(nextFile: File | null) {
    if (!nextFile) {
      setFile(null);
      setState("idle");
      setMessage("音声ファイルを選択またはドラッグ&ドロップ");
      return;
    }

    if (!isSupportedAudioFile(nextFile.name, nextFile.type)) {
      setFile(null);
      setState("error");
      setMessage("非対応形式です。mp3, m4a, wav, mp4, webm を選択してください。");
      return;
    }

    if (nextFile.size > MAX_UPLOAD_SIZE_BYTES) {
      setFile(null);
      setState("error");
      setMessage(`${limitLabel}以下の音声ファイルを選択してください。選択中: ${formatBytes(nextFile.size)}`);
      return;
    }

    setFile(nextFile);
    setState("ready");
    setProgress(0);
    setMessage(`${nextFile.name} (${formatBytes(nextFile.size)})`);
  }

  async function upload() {
    if (!file) {
      setState("error");
      setMessage("音声ファイルを選択してください。");
      return;
    }

    if (!googleClientId) {
      setState("error");
      setMessage("NEXT_PUBLIC_GOOGLE_CLIENT_ID が未設定です。Google DriveアップロードにはGoogle OAuth Client IDが必要です。");
      return;
    }

    setState("uploading");
    setProgress(0);
    setMessage("Google Driveへアップロードしています。大きな音声は時間がかかります。");

    try {
      const accessToken = await requestGoogleAccessToken(googleClientId);
      const driveFile = await uploadToGoogleDrive(file, accessToken, driveFolderId, setProgress);

      setMessage("Google Driveアップロード完了。Notionへ履歴を保存しています。");
      const recordResponse = await fetch("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalFileName: file.name,
          driveFileId: driveFile.id,
          driveFileUrl: driveFile.webViewLink ?? `https://drive.google.com/file/d/${driveFile.id}/view`,
          fileSizeBytes: file.size,
          mimeType: file.type || driveFile.mimeType,
        }),
      });
      const recordResult = (await readJsonResponse(recordResponse)) as { transcript?: { id: string }; error?: string };

      if (!recordResponse.ok || !recordResult.transcript?.id) {
        throw new Error(recordResult.error ?? "Notionへの履歴保存に失敗しました。");
      }

      if (file.size <= OPENAI_AUDIO_FILE_LIMIT_BYTES) {
        setMessage("文字起こしと要約を実行しています。");
        const processResponse = await fetch(`/api/transcripts/${recordResult.transcript.id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const processResult = (await readJsonResponse(processResponse)) as { error?: string };
        if (!processResponse.ok) {
          throw new Error(processResult.error ?? "文字起こし処理に失敗しました。");
        }
      } else {
        setMessage("アップロード完了。25MB超のため、分割処理ワーカーの対象としてNotionに保存しました。");
      }

      setState("success");
      router.push(`/transcripts/${recordResult.transcript.id}`);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(formatUploadError(error));
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        className="grid min-h-72 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-leaf/25 bg-mist/60 p-6 text-center transition hover:border-leaf/50 hover:bg-mist"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
          onChange={onInputChange}
        />
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-white text-leaf shadow-sm">
            {state === "uploading" ? (
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
            ) : state === "success" ? (
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            ) : state === "error" ? (
              <AlertCircle className="h-7 w-7 text-coral" aria-hidden="true" />
            ) : file ? (
              <FileAudio2 className="h-7 w-7" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-7 w-7" aria-hidden="true" />
            )}
          </div>
          <p className="mt-4 text-base font-semibold">{message}</p>
          <p className="mt-2 text-sm text-ink/60">
            対応形式: mp3 / m4a / wav / mp4 / webm、最大{limitLabel}
          </p>
          {!isGoogleConfigured ? (
            <p className="mt-2 text-xs text-coral">Google DriveアップロードにはOAuth Client IDの設定が必要です。</p>
          ) : null}
          {state === "uploading" ? (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          {state === "uploading" ? <p className="mt-2 text-xs font-medium text-ink/55">{progress.toFixed(1)}%</p> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={upload}
        disabled={state === "uploading"}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 text-sm font-semibold text-white transition hover:bg-leaf/90 disabled:cursor-not-allowed disabled:bg-ink/30"
      >
        {state === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
        Google Driveへアップロード
      </button>
    </div>
  );
}

async function requestGoogleAccessToken(clientId: string) {
  await loadGoogleIdentityServices();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Google認証に失敗しました。"));
          return;
        }

        resolve(response.access_token);
      },
    });

    if (!tokenClient) {
      reject(new Error("Google認証ライブラリを初期化できませんでした。"));
      return;
    }

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

function loadGoogleIdentityServices() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google認証ライブラリの読み込みに失敗しました。")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google認証ライブラリの読み込みに失敗しました。"));
    document.head.appendChild(script);
  });
}

async function uploadToGoogleDrive(
  file: File,
  accessToken: string,
  folderId: string | undefined,
  onProgress: (progress: number) => void,
) {
  const metadata: Record<string, unknown> = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const createResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink,size,mimeType",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!createResponse.ok) {
    throw new Error(`Google Driveアップロード開始に失敗しました。HTTP ${createResponse.status}`);
  }

  const uploadUrl = createResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Google DriveのアップロードURLを取得できませんでした。");
  }

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + DRIVE_CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.size),
        "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
      },
      body: chunk,
    });

    if (response.status === 308) {
      offset = parseGoogleRange(response.headers.get("Range")) + 1 || end;
      onProgress((offset / file.size) * 100);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Google Driveアップロードに失敗しました。HTTP ${response.status}`);
    }

    onProgress(100);
    return (await response.json()) as GoogleDriveFile;
  }

  throw new Error("Google Driveアップロードの完了レスポンスを取得できませんでした。");
}

function parseGoogleRange(range: string | null) {
  const match = range?.match(/bytes=0-(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return { error: `サーバーから空のレスポンスが返りました。HTTP ${response.status}` };
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: `サーバーからJSONではないレスポンスが返りました。HTTP ${response.status}` };
  }
}

function formatUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : "アップロードに失敗しました。";
  const lower = message.toLowerCase();

  if (lower.includes("storagerelay") || lower.includes("native_desktop") || lower.includes("invalid_request")) {
    return "Google OAuth Client IDの種類が不正です。Google Cloud Consoleで『Web application』のClient IDを作成し、NEXT_PUBLIC_GOOGLE_CLIENT_IDに設定してください。";
  }

  if (lower.includes("no registered origin") || lower.includes("invalid_client") || lower.includes("401")) {
    const origin = typeof window !== "undefined" ? window.location.origin : "(unknown origin)";
    return `Google OAuth設定エラーです。Authorized JavaScript originsに ${origin} を追加し、Web applicationのClient IDをNEXT_PUBLIC_GOOGLE_CLIENT_IDへ設定してください。`;
  }

  if (message.includes("403")) {
    return "Google Driveへの権限が不足しています。Drive APIが有効か、OAuthスコープを確認してください。";
  }

  if (message.includes("413") || lower.includes("maximum size exceeded")) {
    return `アップロード上限を超えています。${formatBytes(MAX_UPLOAD_SIZE_BYTES)}以下のファイルを選択してください。`;
  }

  return message;
}
