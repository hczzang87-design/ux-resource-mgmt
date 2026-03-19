import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const supabase = supabaseServer();

  const { searchParams } = new URL(req.url);
  const member = searchParams.get("member"); // optional
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // ✅ 주간 상세는 member 없이도 조회해야 하므로 from/to만 필수
  if (!from || !to) {
    return NextResponse.json({ error: "from/to required" }, { status: 400 });
  }

  let q = supabase.from("time_entries").select("*").gte("date", from).lte("date", to);

  if (member && member.trim()) {
    q = q.eq("member_name", member.trim());
  }

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();

  const body = await req.json().catch(() => null);
  if (!body?.member_name || !Array.isArray(body?.entries)) {
    return NextResponse.json({ error: "member_name and entries required" }, { status: 400 });
  }

  const member_name = String(body.member_name).trim();
  if (!member_name) {
    return NextResponse.json({ error: "member_name required" }, { status: 400 });
  }

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

  // 2) 주간 삭제: member가 있으면 해당 멤버만, 없으면 주간 전체
  const member = searchParams.get("member"); // optional
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "id or from/to required" }, { status: 400 });
  }

  let q = supabase.from("time_entries").delete().gte("date", from).lte("date", to);

  if (member && member.trim()) {
    q = q.eq("member_name", member.trim());
  }

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}