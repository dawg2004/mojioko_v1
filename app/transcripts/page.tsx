import Link from "next/link";
import { CalendarDays, ChevronRight, FileAudio2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { listNotionTranscripts } from "@/lib/notion/transcripts";

export const dynamic = "force-dynamic";

export default async function TranscriptsPage() {
  const result = await listTranscriptsSafely();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">履歴一覧</h1>
          <p className="mt-2 text-sm text-ink/65">アップロードした録音と処理ステータスを確認できます。</p>
        </div>
        <Link className="rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white hover:bg-leaf/90" href="/">
          新規アップロード
        </Link>
      </div>

      {result.error ? (
        <div className="rounded-lg border border-coral/30 bg-coral/10 p-4 text-sm text-coral">
          履歴の取得に失敗しました: {result.error}
        </div>
      ) : null}

      {!result.error && result.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/20 bg-white p-8 text-center">
          <FileAudio2 className="mx-auto h-10 w-10 text-leaf" aria-hidden="true" />
          <p className="mt-3 font-semibold">まだ録音がありません</p>
          <p className="mt-1 text-sm text-ink/60">トップページからPLAUD録音ファイルをアップロードしてください。</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        {result.data.map((item) => (
          <Link
            key={item.id}
            href={`/transcripts/${item.id}`}
            className="group rounded-lg border border-ink/10 bg-white p-4 shadow-sm transition hover:border-leaf/40 hover:shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{item.title ?? "無題の録音"}</h2>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-2 truncate text-sm text-ink/60">{item.original_file_name ?? "ファイル名未設定"}</p>
                <p className="mt-3 flex items-center gap-1 text-xs text-ink/50">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(item.created_at)}
                </p>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink/35 transition group-hover:translate-x-0.5 group-hover:text-leaf" />
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

async function listTranscriptsSafely() {
  try {
    return { data: await listNotionTranscripts(), error: null as string | null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "Notionから履歴を取得できませんでした。" };
  }
}

function formatDate(value: string | null) {
  if (!value) return "日時未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
