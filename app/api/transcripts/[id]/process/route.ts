import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { OPENAI_AUDIO_FILE_LIMIT_BYTES, formatBytes } from "@/lib/files";
import { processTranscript } from "@/lib/transcripts/process";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("transcripts")
      .select("id,storage_path,original_file_name,file_size_bytes")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "録音履歴が見つかりません。" }, { status: 404 });
    }

    if (!data.storage_path || !data.original_file_name) {
      return NextResponse.json({ error: "Storage上の音声ファイル情報が不足しています。" }, { status: 400 });
    }

    if (Number(data.file_size_bytes ?? 0) > OPENAI_AUDIO_FILE_LIMIT_BYTES) {
      return NextResponse.json(
        {
          skipped: true,
          message: `${formatBytes(Number(data.file_size_bytes))} のファイルはOpenAI Audio APIの1回25MB制限を超えるため、分割処理ワーカーが必要です。`,
        },
        { status: 202 },
      );
    }

    await processTranscript(id, data.storage_path, data.original_file_name);
    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文字起こし処理に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
