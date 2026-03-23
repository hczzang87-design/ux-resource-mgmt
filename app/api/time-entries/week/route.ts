import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { TimeEntry } from "@/features/time-entries/types";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { from, to } = body ?? {};

    if (!from || !to) {
      return NextResponse.json({ error: "from/to required" }, { status: 400 });
    }

    const supabase = supabaseServer(); // ✅ 추가

    // 이번 주 범위 전체 삭제 (모든 멤버)
    const del = await supabase
      .from("time_entries")
      .delete()
      .gte("date", from)
      .lte("date", to);

    if (del.error) throw del.error;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { from, to, member_name, entries } = body as {
      from: string;
      to: string;
      member_name: string;
      entries: TimeEntry[];
    };

    if (!from || !to || !member_name) {
      return NextResponse.json(
        { error: "from/to/member_name required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // ✅ 해당 멤버 + 해당 주간만 삭제 (중요)
    const del = await supabase
      .from("time_entries")
      .delete()
      .eq("member_name", member_name)
      .gte("date", from)
      .lte("date", to);

    if (del.error) throw del.error;

    const rows = (entries ?? []).map((e) => ({
      member_name: e.member_name,
      date: e.date,
      category: (e.category || "기타").replace(/\s+/g, " ").trim(),
      task_name: (e.task_name || "").replace(/\s+/g, " ").trim(),
      md: Number(e.md || 0),
      overtime_md: Number(e.overtime_md || 0),
    }));

    if (rows.some((r) => !r.task_name)) {
      return NextResponse.json(
        { error: "task_name is required" },
        { status: 400 }
      );
    }

    if (rows.length > 0) {
      const ins = await supabase.from("time_entries").insert(rows);
      if (ins.error) throw ins.error;
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}