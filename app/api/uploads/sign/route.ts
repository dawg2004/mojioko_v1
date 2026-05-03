import { NextResponse } from "next/server";
import { AUDIO_BUCKET, getServerSupabase } from "@/lib/supabase/server";
import { formatBytes, isSupportedAudioFile, MAX_UPLOAD_SIZE_BYTES, safeFileName, titleFromFileName } from "@/lib/files";

export const runtime = "nodejs";

type SignUploadRequest = {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

export async function POST(request: Request) {
  try {
    const supabase = getServerSupabase();
    const body = (await request.json()) as SignUploadRequest;
    const fileName = body.fileName?.trim();
    const fileType = body.fileType?.trim() || "application/octet-stream";
    const fileSize = Number(body.fileSize ?? 0);

    if (!fileName) {
      return NextResponse.json({ error: "音声ファイルを選択してください。" }, { status: 400 });
    }

    if (!isSupportedAudioFile(fileName, fileType)) {
      return NextResponse.json(
        { error: "非対応形式です。mp3, m4a, wav, mp4, webm の音声ファイルを選択してください。" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "ファイルサイズを確認できませんでした。" }, { status: 400 });
    }

    if (fileSize > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: `${formatBytes(MAX_UPLOAD_SIZE_BYTES)}以下の音声ファイルを選択してください。` }, { status: 400 });
    }

    const transcriptId = crypto.randomUUID();
    const storagePath = `${transcriptId}/${safeFileName(fileName)}`;
    const { data: signedUpload, error: signedError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError || !signedUpload) {
      return NextResponse.json(
        { error: `SupabaseアップロードURLの作成に失敗しました: ${signedError?.message ?? "unknown error"}` },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
    const { error: insertError } = await supabase.from("transcripts").insert({
      id: transcriptId,
      title: titleFromFileName(fileName),
      original_file_name: fileName,
      original_file_url: publicUrlData.publicUrl,
      storage_path: storagePath,
      file_size_bytes: fileSize,
      status: "uploaded",
    });

    if (insertError) {
      return NextResponse.json({ error: `DB保存に失敗しました: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      transcriptId,
      storagePath,
      token: signedUpload.token,
      projectId: getSupabaseProjectId(),
      bucketName: AUDIO_BUCKET,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "アップロード準備に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getSupabaseProjectId() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  return new URL(url).hostname.split(".")[0];
}
