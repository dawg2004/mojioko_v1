import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">ページが見つかりません</h1>
      <p className="mt-3 text-ink/65">指定された録音履歴を確認できませんでした。</p>
      <Link className="mt-6 inline-flex rounded-lg bg-leaf px-4 py-2 text-sm font-semibold text-white" href="/transcripts">
        履歴一覧へ
      </Link>
    </main>
  );
}
