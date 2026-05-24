import { NextResponse } from "next/server";
import { listPlaudRecordings } from "@/lib/plaud/cli";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageSize = Number(searchParams.get("pageSize") ?? 20);
    const result = await listPlaudRecordings(Math.min(Math.max(pageSize, 10), 100));

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PLAUD録音一覧の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
