export type TranscriptStatus = "uploaded" | "queued" | "transcribing" | "summarizing" | "completed" | "failed";

export type Transcript = {
  id: string;
  title: string | null;
  original_file_name: string | null;
  original_file_url: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  transcript_text: string | null;
  summary: string | null;
  minutes: string | null;
  todos: string | null;
  status: TranscriptStatus | string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type GeneratedNotes = {
  summary: string;
  minutes: string;
  todos: string;
};
