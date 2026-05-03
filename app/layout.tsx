import type { Metadata } from "next";
import Link from "next/link";
import { FileAudio2 } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "mojioko",
  description: "PLAUD録音ファイルをAIで文字起こし・要約・議事録化するWeb App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-ink/10 bg-linen/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-leaf text-white">
                <FileAudio2 className="h-5 w-5" aria-hidden="true" />
              </span>
              mojioko
            </Link>
            <nav className="flex items-center gap-2 text-sm font-medium text-ink/70">
              <Link className="rounded-md px-3 py-2 hover:bg-mist hover:text-ink" href="/transcripts">
                履歴一覧
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
