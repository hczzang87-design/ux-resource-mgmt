import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const supabase = supabaseServer();

  const { searchParams } = new URL(req.url);
  const member = searchParams.get("member");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!member || !from || !to) {
    return NextResponse.json({ error: "member/from/to required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("member_name", member)
    .gte("date", from)
    .lte("date", to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();

  const body = await req.json().catch(() => null);
  if (!body?.member_name || !Array.isArray(body?.entries)) {
    return NextResponse.json({ error: "member_name and entries required" }, { status: 400 });
  }

  const member_name = String(body.member_name);
  const entries = body.entries.map((x: any) => ({
    member_name,
    date: x.date,
    category: x.category,
    task_name: x.task_name,
    md: x.md,
    overtime_md: x.overtime_md,
  }));

  const { error } = await supabase.from("time_entries").insert(entries);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // 1) 단건 삭제: /api/entries?id=...
  if (id) {
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 2) 주간 전체 삭제: /api/entries?member=...&from=...&to=...
  const member = searchParams.get("member");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!member || !from || !to) {
    return NextResponse.json({ error: "id or member/from/to required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("member_name", member)
    .gte("date", from)
    .lte("date", to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
