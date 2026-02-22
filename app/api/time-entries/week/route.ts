import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { TimeEntry } from "@/features/time-entries/types";

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

    // 1) 해당 멤버 + 주간 범위 삭제
    const del = await supabase
      .from("time_entries")
      .delete()
      .eq("member_name", member_name)
      .gte("date", from)
      .lte("date", to);

    if (del.error) throw del.error;

    // 2) 삽입(필드 정리)
    const rows = (entries ?? []).map((e) => ({
      member_name: e.member_name,
      date: e.date,
      category: (e.category || "기타").trim(),
      task_name: (e.task_name || "").trim(),
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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}