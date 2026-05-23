import { NextResponse } from "next/server";
import { generateNotes, transcribeAudio } from "@/lib/openai/transcription";
import { getNotionTranscript, updateNotionTranscript } from "@/lib/notion/transcripts";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteProps = {
  params: Promise<{ id: string }>;
};

type ProcessRequest = {
  accessToken?: string;
};

export async function POST(request: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    const body = (await request.json()) as ProcessRequest;
    const accessToken = body.accessToken?.trim();
    const transcript = await getNotionTranscript(id);

    if (!transcript) {
      return NextResponse.json({ error: "録音履歴が見つかりません。" }, { status: 404 });
    }

    if (!accessToken) {
      return NextResponse.json({ error: "Google Driveアクセストークンがありません。" }, { status: 400 });
    }

    if (!transcript.storage_path || !transcript.original_file_name) {
      return NextResponse.json({ error: "Google Driveファイル情報が不足しています。" }, { status: 400 });
    }

    await updateNotionTranscript(id, { status: "transcribing" });
    const audioFile = await downloadDriveFile({
      fileId: transcript.storage_path,
      accessToken,
      fileName: transcript.original_file_name,
    });
    const transcriptText = await transcribeAudio(audioFile);

    await updateNotionTranscript(id, {
      status: "summarizing",
      transcriptText,
    });

    const notes = await generateNotes(transcriptText);
    const updated = await updateNotionTranscript(id, {
      status: "completed",
      transcriptText,
      summary: notes.summary,
      minutes: notes.minutes,
      todos: notes.todos,
    });

    return NextResponse.json({ transcript: updated });
  } catch (error) {
    await updateNotionTranscript(id, {
      status: "failed",
      summary: error instanceof Error ? error.message : "文字起こし処理に失敗しました。",
    }).catch(() => null);

    const message = error instanceof Error ? error.message : "文字起こし処理に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function downloadDriveFile({
  fileId,
  accessToken,
  fileName,
}: {
  fileId: string;
  accessToken: string;
  fileName: string;
}) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Driveから音声を取得できませんでした。HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new File([arrayBuffer], fileName, {
    type: response.headers.get("content-type") ?? "application/octet-stream",
  });
}
