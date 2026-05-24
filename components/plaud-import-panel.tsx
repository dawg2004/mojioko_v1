"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, Loader2, RefreshCw, Search } from "lucide-react";

type PlaudRecording = {
  id: string;
  name: string;
  createdAt: string | null;
  duration: string | null;
  raw: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";
type ImportState = "idle" | "importing" | "error";

export function PlaudImportPanel() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<PlaudRecording[]>([]);
  const [manualId, setManualId] = useState("");
  const [message, setMessage] = useState("PLAUD CLIでログイン済みの録音を取り込めます。");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [importState, setImportState] = useState<ImportState>("idle");

  async function loadRecordings() {
    setLoadState("loading");
    setMessage("PLAUD録音一覧を取得しています。");

    try {
      const response = await fetch("/api/plaud/files", { cache: "no-store" });
      const result = (await response.json()) as { recordings?: PlaudRecording[]; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "PLAUD録音一覧の取得に失敗しました。");
      }

      setRecordings(result.recordings ?? []);
      setLoadState("ready");
      setMessage(result.recordings?.length ? "取り込む録音を選択してください。" : "録音一覧を解析できませんでした。録音IDを手入力してください。");
    } catch (error) {
      setLoadState("error");
      setMessage(error instanceof Error ? error.message : "PLAUD録音一覧の取得に失敗しました。");
    }
  }

  async function importRecording(fileId: string) {
    const targetId = fileId.trim();
    if (!targetId) {
      setImportState("error");
      setMessage("PLAUD録音IDを入力してください。");
      return;
    }

    setImportState("importing");
    setMessage("PLAUD音声URLを取得してNotionに保存しています。");

    try {
      const response = await fetch("/api/plaud/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: targetId, processNow: true }),
      });
      const result = (await response.json()) as { transcript?: { id: string }; error?: string };

      if (!response.ok || !result.transcript?.id) {
        throw new Error(result.error ?? "PLAUD録音の取り込みに失敗しました。");
      }

      router.push(`/transcripts/${result.transcript.id}`);
      router.refresh();
    } catch (error) {
      setImportState("error");
      setMessage(error instanceof Error ? error.message : "PLAUD録音の取り込みに失敗しました。");
    }
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">PLAUDから取り込み</h2>
          <p className="mt-1 text-sm text-ink/60">{message}</p>
        </div>
        <button
          type="button"
          onClick={loadRecordings}
          disabled={loadState === "loading" || importState === "importing"}
          className="inline-flex items-center gap-2 rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm font-semibold text-ink transition hover:bg-leaf/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          一覧取得
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" aria-hidden="true" />
          <input
            value={manualId}
            onChange={(event) => setManualId(event.target.value)}
            placeholder="PLAUD録音IDを手入力"
            className="w-full rounded-lg border border-ink/10 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-leaf"
          />
        </div>
        <button
          type="button"
          onClick={() => importRecording(manualId)}
          disabled={importState === "importing"}
          className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white transition hover:bg-leaf/90 disabled:cursor-not-allowed disabled:bg-ink/30"
        >
          {importState === "importing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <DownloadCloud className="h-4 w-4" aria-hidden="true" />}
          取り込み
        </button>
      </div>

      {recordings.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {recordings.map((recording) => (
            <button
              key={recording.id}
              type="button"
              onClick={() => importRecording(recording.id)}
              disabled={importState === "importing"}
              className="rounded-lg border border-ink/10 bg-white p-3 text-left transition hover:border-leaf/40 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-ink">{recording.name}</span>
              <span className="mt-1 block break-all text-xs text-ink/55">
                {recording.id}
                {recording.createdAt ? ` / ${recording.createdAt}` : ""}
                {recording.duration ? ` / ${recording.duration}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-ink/55">
        事前にサーバー環境で <code className="rounded bg-mist px-1 py-0.5">npm install -g @plaud-ai/cli</code> と{" "}
        <code className="rounded bg-mist px-1 py-0.5">plaud login</code> が必要です。
      </p>
    </div>
  );
}
