import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "Supabase Storage uploadは廃止しました。音声はGoogle Driveへ直接アップロードしてください。",
    },
    { status: 410 },
  );
}
