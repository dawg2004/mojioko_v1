import { NextResponse } from "next/server";
import { createNotionTranscript, listNotionTranscripts } from "@/lib/notion/transcripts";
import { isSupportedAudioFile, MAX_UPLOAD_SIZE_BYTES, OPENAI_AUDIO_FILE_LIMIT_BYTES, formatBytes, titleFromFileName } from "@/lib/files";

export const runtime = "nodejs";

type CreateRecordRequest = {
  originalFileName?: string;
  driveFileId?: string;
  driveFileUrl?: string;
  fileSizeBytes?: number;
  mimeType?: string;
};

export async function GET() {
  try {
    const transcripts = await listNotionTranscripts();
    return NextResponse.json({ transcripts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "履歴の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateRecordRequest;
    const originalFileName = body.originalFileName?.trim();
    const driveFileId = body.driveFileId?.trim();
    const driveFileUrl = body.driveFileUrl?.trim();
    const fileSizeBytes = Number(body.fileSizeBytes ?? 0);
    const mimeType = body.mimeType?.trim();

    if (!originalFileName || !driveFileId || !driveFileUrl) {
      return NextResponse.json({ error: "Google Driveファイル情報が不足しています。" }, { status: 400 });
    }

    if (!isSupportedAudioFile(originalFileName, mimeType)) {
      return NextResponse.json(
        { error: "非対応形式です。mp3, m4a, wav, mp4, webm の音声ファイルを選択してください。" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return NextResponse.json({ error: "ファイルサイズを確認できませんでした。" }, { status: 400 });
    }

    if (fileSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: `${formatBytes(MAX_UPLOAD_SIZE_BYTES)}以下の音声ファイルを選択してください。` }, { status: 400 });
    }

    const transcript = await createNotionTranscript({
      title: titleFromFileName(originalFileName),
      originalFileName,
      driveFileId,
      driveFileUrl,
      fileSizeBytes,
      status: fileSizeBytes > OPENAI_AUDIO_FILE_LIMIT_BYTES ? "queued" : "uploaded",
    });

    return NextResponse.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "履歴保存に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
