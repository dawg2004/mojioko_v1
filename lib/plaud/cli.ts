import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 30_000;
const AUDIO_URL_TIMEOUT_MS = 60_000;

export type PlaudRecording = {
  id: string;
  name: string;
  createdAt: string | null;
  duration: string | null;
  raw: string;
};

export type PlaudAudioReference = {
  fileId: string;
  name: string;
  audioUrl: string;
  contentType: string | null;
  contentLength: number | null;
};

export async function listPlaudRecordings(pageSize = 20) {
  const output = await runPlaud(["files", "--page-size", String(pageSize)]);
  return {
    recordings: parsePlaudFiles(output.stdout),
    rawOutput: output.stdout.trim(),
  };
}

export async function getPlaudAudioReference(fileId: string): Promise<PlaudAudioReference> {
  assertPlaudFileId(fileId);

  const [fileOutput, audioOutput] = await Promise.all([
    runPlaud(["file", fileId]).catch(() => ({ stdout: "" })),
    runPlaud(["audio", fileId], AUDIO_URL_TIMEOUT_MS),
  ]);

  const audioUrl = extractUrl(audioOutput.stdout);
  if (!audioUrl) {
    throw new Error("PLAUD音声URLを取得できませんでした。`plaud audio <id>` の出力を確認してください。");
  }

  const metadata = parsePlaudFileMetadata(fileOutput.stdout);
  const headers = await readAudioHeaders(audioUrl);

  return {
    fileId,
    name: metadata.name ?? `plaud-${fileId}.mp3`,
    audioUrl,
    contentType: headers.contentType,
    contentLength: headers.contentLength,
  };
}

export async function downloadPlaudAudio(reference: PlaudAudioReference) {
  const response = await fetch(reference.audioUrl);
  if (!response.ok) {
    throw new Error(`PLAUD音声のダウンロードに失敗しました。HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new File([arrayBuffer], reference.name, {
    type: response.headers.get("content-type") ?? reference.contentType ?? "application/octet-stream",
  });
}

async function runPlaud(args: string[], timeout = DEFAULT_TIMEOUT_MS) {
  const bin = process.env.PLAUD_CLI_BIN || "plaud";

  try {
    return await execFileAsync(bin, args, {
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PLAUD CLIの実行に失敗しました。";
    throw new Error(formatPlaudCliError(message));
  }
}

function assertPlaudFileId(fileId: string) {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(fileId)) {
    throw new Error("PLAUD録音IDの形式が不正です。");
  }
}

function parsePlaudFiles(output: string): PlaudRecording[] {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^id\s+/i.test(line) && !/^[-+| ]+$/.test(line));

  return lines
    .map((line) => {
      const columns = line.includes("|")
        ? line
            .split("|")
            .map((column) => column.trim())
            .filter(Boolean)
        : line.split(/\s{2,}/).map((column) => column.trim());

      const id = columns[0]?.match(/[A-Za-z0-9._:-]{8,}/)?.[0];
      if (!id) return null;

      return {
        id,
        name: columns[1] || `PLAUD録音 ${id}`,
        createdAt: columns.find((column) => /\d{4}-\d{2}-\d{2}/.test(column)) ?? null,
        duration: columns.find((column) => /\d+:\d{2}/.test(column) || /\d+\s*(min|sec|s|m)/i.test(column)) ?? null,
        raw: line,
      };
    })
    .filter((recording): recording is PlaudRecording => Boolean(recording));
}

function parsePlaudFileMetadata(output: string) {
  const name =
    output.match(/(?:name|title)\s*[:|]\s*(.+)$/im)?.[1]?.trim() ||
    output
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.includes("://"));

  return { name: name ? sanitizeFileName(name) : null };
}

function extractUrl(output: string) {
  return output.match(/https?:\/\/\S+/)?.[0]?.replace(/[)>.,]+$/, "") ?? null;
}

async function readAudioHeaders(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return {
      contentType: response.headers.get("content-type"),
      contentLength: parseContentLength(response.headers.get("content-length")),
    };
  } catch {
    return { contentType: null, contentLength: null };
  }
}

function parseContentLength(value: string | null) {
  if (!value) return null;
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : null;
}

function sanitizeFileName(value: string) {
  const base = value.replace(/[\\/:*?"<>|]/g, "_").trim();
  return /\.(mp3|m4a|wav|mp4|webm)$/i.test(base) ? base : `${base || "plaud-recording"}.mp3`;
}

function formatPlaudCliError(message: string) {
  if (message.includes("ENOENT")) {
    return "PLAUD CLIが見つかりません。`npm install -g @plaud-ai/cli` を実行してください。";
  }

  if (/auth|login|sign in|unauthorized/i.test(message)) {
    return "PLAUD CLIが未ログインです。サーバー環境で `plaud login` を実行してください。";
  }

  return message;
}
