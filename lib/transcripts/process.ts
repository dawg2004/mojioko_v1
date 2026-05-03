import { AUDIO_BUCKET, getServerSupabase } from "@/lib/supabase/server";
import { generateNotes, transcribeAudio } from "@/lib/openai/transcription";

export async function processTranscript(transcriptId: string, storagePath: string, fileName: string) {
  const supabase = getServerSupabase();

  try {
    await updateStatus(transcriptId, "transcribing");

    const { data: blob, error: downloadError } = await supabase.storage.from(AUDIO_BUCKET).download(storagePath);
    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? "Supabase Storageから音声ファイルを取得できませんでした。");
    }

    const audioFile = new File([await blob.arrayBuffer()], fileName, {
      type: blob.type || "application/octet-stream",
    });
    const transcriptText = await transcribeAudio(audioFile);

    const { error: transcriptError } = await supabase
      .from("transcripts")
      .update({ transcript_text: transcriptText, status: "summarizing" })
      .eq("id", transcriptId);

    if (transcriptError) {
      throw new Error(`文字起こし結果の保存に失敗しました: ${transcriptError.message}`);
    }

    const notes = await generateNotes(transcriptText);

    const { error: notesError } = await supabase
      .from("transcripts")
      .update({
        summary: notes.summary,
        minutes: notes.minutes,
        todos: notes.todos,
        status: "completed",
      })
      .eq("id", transcriptId);

    if (notesError) {
      throw new Error(`要約結果の保存に失敗しました: ${notesError.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "文字起こし処理に失敗しました。";
    await supabase
      .from("transcripts")
      .update({
        status: "failed",
        summary: message,
      })
      .eq("id", transcriptId);
    throw error;
  }
}

async function updateStatus(transcriptId: string, status: string) {
  const supabase = getServerSupabase();
  const { error } = await supabase.from("transcripts").update({ status }).eq("id", transcriptId);

  if (error) {
    throw new Error(`ステータス更新に失敗しました: ${error.message}`);
  }
}
