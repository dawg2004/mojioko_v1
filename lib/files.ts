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
