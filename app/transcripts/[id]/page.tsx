import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { TranscriptTabs } from "@/components/transcript-tabs";
import { getServerSupabase } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function TranscriptDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("transcripts").select("*").eq("id", id).single();

  if (error || !data) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/transcripts" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-ink/65 hover:text-leaf">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        履歴一覧へ戻る
      </Link>

      <section className="mb-6 rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={data.status} />
              <span className="text-xs text-ink/45">{formatDate(data.created_at)}</span>
            </div>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{data.title ?? "無題の録音"}</h1>
            <p className="mt-2 truncate text-sm text-ink/60">{data.original_file_name}</p>
          </div>
          {data.original_file_url ? (
            <a
              href={data.original_file_url}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink/10 px-4 py-2 text-sm font-semibold hover:bg-mist"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              元音声
            </a>
          ) : null}
        </div>
      </section>

      <TranscriptTabs transcript={data} />
    </main>
  );
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
