import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import OpenAI from "openai";
import type { GeneratedNotes } from "@/lib/types";

const SUMMARY_MODEL = "gpt-4o-mini";

export async function transcribeAudio(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "mojioko-whisper-"));
  const audioPath = path.join(tmpDir, file.name || "audio.webm");
  const outputDir = path.join(tmpDir, "output");

  try {
    await writeFile(audioPath, buffer);
    await runWhisper(audioPath, outputDir);

    const stem = path.parse(audioPath).name;
    const transcriptPath = path.join(outputDir, `${stem}.txt`);
    const transcript = await readFile(transcriptPath, "utf-8");
    return transcript.trim();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
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

async function runWhisper(audioPath: string, outputDir: string) {
  const whisperCommand = process.env.WHISPER_COMMAND?.trim() || "python3 -m whisper";
  const whisperModel = process.env.WHISPER_MODEL?.trim() || "small";
  const whisperLanguage = process.env.WHISPER_LANGUAGE?.trim() || "ja";
  const extraArgs = splitArgs(process.env.WHISPER_EXTRA_ARGS);

  const commandArgs = splitArgs(whisperCommand);
  if (commandArgs.length === 0) {
    throw new Error("WHISPER_COMMAND is empty.");
  }

  const [bin, ...baseArgs] = commandArgs;
  const args = [
    ...baseArgs,
    audioPath,
    "--model",
    whisperModel,
    "--language",
    whisperLanguage,
    "--output_dir",
    outputDir,
    "--output_format",
    "txt",
    ...extraArgs,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Whisper command failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Whisper command exited with code ${code}. ${stderr.trim()}`.trim()));
    });
  });
}

function splitArgs(value?: string) {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter(Boolean);
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
