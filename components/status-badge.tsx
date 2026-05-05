import type { TranscriptStatus } from "@/lib/types";

const styles: Record<TranscriptStatus, string> = {
  uploaded: "bg-sky-50 text-sky-700 ring-sky-200",
  queued: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  transcribing: "bg-amber-50 text-amber-700 ring-amber-200",
  summarizing: "bg-violet-50 text-violet-700 ring-violet-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

const labels: Record<TranscriptStatus, string> = {
  uploaded: "アップロード済み",
  queued: "分割待ち",
  transcribing: "文字起こし中",
  summarizing: "要約中",
  completed: "完了",
  failed: "失敗",
};

export function StatusBadge({ status }: { status: string | null }) {
  const key = isTranscriptStatus(status) ? status : "uploaded";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[key]}`}>
      {labels[key]}
    </span>
  );
}

function isTranscriptStatus(status: string | null): status is TranscriptStatus {
  return status === "uploaded" || status === "queued" || status === "transcribing" || status === "summarizing" || status === "completed" || status === "failed";
}
