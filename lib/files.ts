export const ACCEPTED_AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "mp4", "webm"] as const;

export const ACCEPTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "video/mp4",
  "audio/webm",
  "video/webm",
];

export const TARGET_UPLOAD_SIZE_BYTES = 3 * 1024 * 1024 * 1024;
export const FREE_PLAN_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_BYTES = getUploadLimitBytes();
export const OPENAI_AUDIO_FILE_LIMIT_BYTES = 25 * 1024 * 1024;

export function isSupportedAudioFile(fileName: string, mimeType?: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const extensionOk = Boolean(extension && ACCEPTED_AUDIO_EXTENSIONS.includes(extension as (typeof ACCEPTED_AUDIO_EXTENSIONS)[number]));
  const mimeOk = mimeType ? ACCEPTED_AUDIO_MIME_TYPES.includes(mimeType) : false;

  return extensionOk || mimeOk;
}

export function safeFileName(fileName: string) {
  const normalized = fileName.normalize("NFKC").replace(/[^\w.\-]+/g, "_");
  return normalized || `audio-${Date.now()}`;
}

export function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").trim() || "無題の録音";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getUploadLimitBytes() {
  const configured = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_BYTES);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return TARGET_UPLOAD_SIZE_BYTES;
}
