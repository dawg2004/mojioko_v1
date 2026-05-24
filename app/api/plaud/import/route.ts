import { NextResponse } from "next/server";
import { titleFromFileName, formatBytes, MAX_UPLOAD_SIZE_BYTES, OPENAI_AUDIO_FILE_LIMIT_BYTES } from "@/lib/files";
import { createNotionTranscript, updateNotionTranscript } from "@/lib/notion/transcripts";
import { generateNotes, transcribeAudio } from "@/lib/openai/transcription";
import { downloadPlaudAudio, getPlaudAudioReference } from "@/lib/plaud/cli";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImportRequest = {
  fileId?: string;
  processNow?: boolean;
};

export async function POST(request: Request) {
  let transcriptId: string | null = null;

  try {
    const body = (await request.json()) as ImportRequest;
    const fileId = body.fileId?.trim();

    if (!fileId) {
      return NextResponse.json({ error: "PLAUD録音IDを入力してください。" }, { status: 400 });
    }

    const reference = await getPlaudAudioReference(fileId);
    const fileSizeBytes = reference.contentLength ?? 1;

    if (reference.contentLength && reference.contentLength > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `${formatBytes(MAX_UPLOAD_SIZE_BYTES)}以下のPLAUD音声のみ取り込めます。` },
        { status: 400 },
      );
    }

    const transcript = await createNotionTranscript({
      title: titleFromFileName(reference.name),
      originalFileName: reference.name,
      driveFileId: `plaud:${fileId}`,
      driveFileUrl: reference.audioUrl,
      fileSizeBytes,
    });
    transcriptId = transcript.id;

    if (!body.processNow || !reference.contentLength || reference.contentLength > OPENAI_AUDIO_FILE_LIMIT_BYTES) {
      return NextResponse.json({
        transcript,
        skipped: true,
        message: reference.contentLength
          ? `${formatBytes(reference.contentLength)} のため、25MB超の分割処理ワーカー対象として保存しました。`
          : "ファイルサイズを確認できないため、履歴のみ保存しました。",
      });
    }

    await updateNotionTranscript(transcript.id, { status: "transcribing" });
    const audioFile = await downloadPlaudAudio(reference);
    const transcriptText = await transcribeAudio(audioFile);

    await updateNotionTranscript(transcript.id, {
      status: "summarizing",
      transcriptText,
    });

    const notes = await generateNotes(transcriptText);
    const updated = await updateNotionTranscript(transcript.id, {
      status: "completed",
      transcriptText,
      summary: notes.summary,
      minutes: notes.minutes,
      todos: notes.todos,
    });

    return NextResponse.json({ transcript: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PLAUD録音の取り込みに失敗しました。";

    if (transcriptId) {
      await updateNotionTranscript(transcriptId, { status: "failed", summary: message }).catch(() => null);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
