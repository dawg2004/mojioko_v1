import { NextResponse } from "next/server";
import { AUDIO_BUCKET, getServerSupabase } from "@/lib/supabase/server";
import { isSupportedAudioFile, safeFileName, titleFromFileName } from "@/lib/files";
import { processTranscript } from "@/lib/transcripts/process";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = getServerSupabase();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "音声ファイルを選択してください。" }, { status: 400 });
    }

    if (!isSupportedAudioFile(file.name, file.type)) {
      return NextResponse.json(
        { error: "非対応形式です。mp3, m4a, wav, mp4, webm の音声ファイルを選択してください。" },
        { status: 400 },
      );
    }

    const transcriptId = crypto.randomUUID();
    const fileName = safeFileName(file.name);
    const storagePath = `${transcriptId}/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: `Supabaseアップロードに失敗しました: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
    const title = titleFromFileName(file.name);

    const { error: insertError } = await supabase.from("transcripts").insert({
      id: transcriptId,
      title,
      original_file_name: file.name,
      original_file_url: publicUrlData.publicUrl,
      storage_path: storagePath,
      file_size_bytes: file.size,
      status: "uploaded",
    });

    if (insertError) {
      await supabase.storage.from(AUDIO_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: `DB保存に失敗しました: ${insertError.message}` }, { status: 500 });
    }

    await processTranscript(transcriptId, storagePath, file.name);

    return NextResponse.json({ id: transcriptId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "アップロードまたは文字起こし処理に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
