"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import type { Transcript } from "@/lib/types";

const tabs = [
  { key: "transcript", label: "全文" },
  { key: "summary", label: "要約" },
  { key: "minutes", label: "議事録" },
  { key: "todos", label: "TODO" },
  { key: "copy", label: "コピペ用" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function TranscriptTabs({ transcript }: { transcript: Transcript }) {
  const [active, setActive] = useState<TabKey>("summary");
  const [copied, setCopied] = useState(false);

  const copyText = useMemo(
    () =>
      [
        "【要約】",
        transcript.summary ?? "未生成",
        "",
        "【議事録】",
        transcript.minutes ?? "未生成",
        "",
        "【TODO】",
        transcript.todos ?? "未生成",
      ].join("\n"),
    [transcript.minutes, transcript.summary, transcript.todos],
  );

  const content = getContent(active, transcript, copyText);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="rounded-lg border border-ink/10 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-ink/10 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${
                active === tab.key ? "bg-leaf text-white" : "text-ink/65 hover:bg-mist hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/10 px-3 py-2 text-sm font-semibold hover:bg-mist"
        >
          {copied ? <Check className="h-4 w-4 text-leaf" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}
          {copied ? "コピー済み" : "コピー"}
        </button>
      </div>
      <pre className="min-h-96 whitespace-pre-wrap break-words p-5 text-sm leading-7 text-ink/85">
        {content}
      </pre>
    </section>
  );
}

function getContent(active: TabKey, transcript: Transcript, copyText: string) {
  if (active === "transcript") return transcript.transcript_text ?? "文字起こしはまだ生成されていません。";
  if (active === "summary") return transcript.summary ?? "要約はまだ生成されていません。";
  if (active === "minutes") return transcript.minutes ?? "議事録はまだ生成されていません。";
  if (active === "todos") return transcript.todos ?? "TODOはまだ生成されていません。";
  return copyText;
}
