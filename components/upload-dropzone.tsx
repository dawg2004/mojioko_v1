"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { AlertCircle, CheckCircle2, FileAudio2, Loader2, UploadCloud } from "lucide-react";
import {
  ACCEPTED_AUDIO_EXTENSIONS,
  formatBytes,
  isSupportedAudioFile,
  MAX_UPLOAD_SIZE_BYTES,
  OPENAI_AUDIO_FILE_LIMIT_BYTES,
  TARGET_UPLOAD_SIZE_BYTES,
} from "@/lib/files";

type UploadState = "idle" | "ready" | "uploading" | "success" | "error";

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string>("音声ファイルを選択またはドラッグ&ドロップ");
  const [progress, setProgress] = useState<number>(0);

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
      setMessage(`${formatBytes(MAX_UPLOAD_SIZE_BYTES)}以下の音声ファイルを選択してください。選択中: ${formatBytes(nextFile.size)}`);
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

    setState("uploading");
    setMessage("アップロード、文字起こし、要約を実行しています。大きな音声は少し時間がかかります。");

    try {
      const signed = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });
      const uploadConfig = (await readJsonResponse(signed)) as {
        transcriptId?: string;
        storagePath?: string;
        token?: string;
        projectId?: string;
        bucketName?: string;
        error?: string;
      };

      if (!signed.ok || !uploadConfig.transcriptId || !uploadConfig.storagePath || !uploadConfig.token || !uploadConfig.projectId || !uploadConfig.bucketName) {
        throw new Error(uploadConfig.error ?? "アップロード準備に失敗しました。");
      }

      const tusConfig = {
        token: uploadConfig.token,
        projectId: uploadConfig.projectId,
        bucketName: uploadConfig.bucketName,
        storagePath: uploadConfig.storagePath,
      };

      await uploadWithTus(file, tusConfig, setProgress);

      if (file.size <= OPENAI_AUDIO_FILE_LIMIT_BYTES) {
        setMessage("アップロード完了。文字起こしと要約を実行しています。");
        const processResponse = await fetch(`/api/transcripts/${uploadConfig.transcriptId}/process`, { method: "POST" });
        const processResult = (await readJsonResponse(processResponse)) as { error?: string };
        if (!processResponse.ok) {
          throw new Error(processResult.error ?? "文字起こし処理に失敗しました。");
        }
      } else {
        setMessage("アップロード完了。25MB超のため、分割処理ワーカーの対象として保存しました。");
      }

      setState("success");
      router.push(`/transcripts/${uploadConfig.transcriptId}`);
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
            対応形式: mp3 / m4a / wav / mp4 / webm、最大{formatBytes(MAX_UPLOAD_SIZE_BYTES)}
          </p>
          {MAX_UPLOAD_SIZE_BYTES < TARGET_UPLOAD_SIZE_BYTES ? (
            <p className="mt-2 text-xs text-coral">3GB対応にはSupabase Pro以上とStorage上限設定が必要です。</p>
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
        音声アップロード
      </button>
    </div>
  );
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

  if (message.includes("413") || message.toLowerCase().includes("maximum size exceeded")) {
    return `Supabase Storageの現在上限を超えています。${formatBytes(MAX_UPLOAD_SIZE_BYTES)}以下にするか、SupabaseをPro以上にしてStorage上限を3GB以上に設定してください。`;
  }

  return message;
}

function uploadWithTus(
  file: File,
  config: {
    token: string;
    projectId: string;
    bucketName: string;
    storagePath: string;
  },
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      reject(new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。"));
      return;
    }

    const upload = new tus.Upload(file, {
      endpoint: `https://${config.projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${anonKey}`,
        "x-signature": config.token,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: config.bucketName,
        objectName: config.storagePath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress((bytesUploaded / bytesTotal) * 100);
      },
      onSuccess() {
        onProgress(100);
        resolve();
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    });
  });
}
