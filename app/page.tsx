import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";

export default function Home() {
  return (
    <main className="surface-grid min-h-[calc(100vh-73px)]">
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_430px] lg:py-16">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-sm font-semibold text-leaf">PLAUD recording transcription</p>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-6xl">mojioko</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/70">
            PLAUD録音ファイルをアップロードして、AIで文字起こし・要約・議事録化するWeb App
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#upload"
              className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-leaf/90"
            >
              音声をアップロード
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href="/transcripts"
              className="inline-flex items-center gap-2 rounded-lg border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              履歴一覧を見る
            </Link>
          </div>
        </div>
        <div id="upload" className="scroll-mt-8">
          <UploadDropzone />
        </div>
      </section>
    </main>
  );
}
