"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileAudio2, Loader2, UploadCloud } from "lucide-react";
import { ACCEPTED_AUDIO_EXTENSIONS, isSupportedAudioFile } from "@/lib/files";

type UploadState = "idle" | "ready" | "uploading" | "success" | "error";

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string>("音声ファイルを選択またはドラッグ&ドロップ");

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

    setFile(nextFile);
    setState("ready");
    setMessage(nextFile.name);
  }

  async function upload() {
    if (!file) {
      setState("error");
      setMessage("音声ファイルを選択してください。");
      return;
    }

    setState("uploading");
    setMessage("アップロード、文字起こし、要約を実行しています。大きな音声は少し時間がかかります。");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/transcripts", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !result.id) {
        throw new Error(result.error ?? "アップロードに失敗しました。");
      }

      setState("success");
      setMessage("処理が完了しました。詳細ページへ移動します。");
      router.push(`/transcripts/${result.id}`);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "アップロードに失敗しました。");
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
          <p className="mt-2 text-sm text-ink/60">対応形式: mp3 / m4a / wav / mp4 / webm</p>
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
