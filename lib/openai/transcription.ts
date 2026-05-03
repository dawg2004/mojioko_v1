import OpenAI from "openai";
import type { GeneratedNotes } from "@/lib/types";

const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const SUMMARY_MODEL = "gpt-4o-mini";

export async function transcribeAudio(file: File) {
  const openai = getOpenAI();
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: TRANSCRIPTION_MODEL,
    language: "ja",
  });

  return transcription.text;
}

export async function generateNotes(transcriptText: string): Promise<GeneratedNotes> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: SUMMARY_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "あなたは日本語の議事録作成アシスタントです。必ずJSONだけを返してください。キーはsummary, minutes, todosです。",
      },
      {
        role: "user",
        content: [
          "以下の文字起こしから、要約・議事録・TODOを日本語で作成してください。",
          "",
          "要約: 3〜7行で簡潔にまとめる。",
          "議事録: 日時、概要、主要トピック、決定事項、懸念点を含める。",
          "TODO: 担当者、タスク、期限、優先度を含める。担当者・期限が不明な場合は「未確認」と記載する。",
          "",
          "文字起こし:",
          transcriptText,
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("要約生成結果が空です。");
  }

  const parsed = JSON.parse(content) as Partial<GeneratedNotes>;
  return {
    summary: normalizeText(parsed.summary, "要約を生成できませんでした。"),
    minutes: normalizeText(parsed.minutes, "議事録を生成できませんでした。"),
    todos: normalizeText(parsed.todos, "TODOを生成できませんでした。"),
  };
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey });
}

function normalizeText(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return fallback;
}
