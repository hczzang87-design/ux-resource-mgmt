import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const supabase = supabaseServer();

    const { searchParams } = new URL(request.url);
    const member = searchParams.get("member");
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = supabase
      .from("time_entries")
      .select("*")
      .order("date", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);

    if (member) query = query.eq("member_name", member);

    // 단일 날짜
    if (date) query = query.eq("date", date);

    // 기간(from~to, inclusive)
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = supabaseServer();

    // bulk 형태: { member_name, entries: [...] }
    if (Array.isArray(body?.entries)) {
      const memberName = String(body.member_name ?? "").trim();
      if (!memberName) {
        return NextResponse.json({ error: "member_name is required" }, { status: 400 });
      }

      const rows = body.entries.map((e: any) => ({
        member_name: memberName,
        date: e.date, // YYYY-MM-DD
        category: (e.category && String(e.category).trim()) || "기타",
        task_name: String(e.task_name ?? "").trim(),
        md: Number(e.md),
        overtime_md: Number(e.overtime_md ?? 0),
      }));

      // 최소 검증
      for (const r of rows) {
        if (!r.date || !r.task_name) {
          return NextResponse.json({ error: "date and task_name are required" }, { status: 400 });
        }
        if (!(r.md > 0)) {
          return NextResponse.json({ error: "md must be > 0" }, { status: 400 });
        }
        if (r.overtime_md < 0) {
          return NextResponse.json({ error: "overtime_md must be >= 0" }, { status: 400 });
        }
      }

      const { data, error } = await supabase
        .from("time_entries")
        .insert(rows)
        .select("*");

      if (error) {
        return NextResponse.json(
          { error: error.message, code: error.code, hint: error.hint },
          { status: 500 }
        );
      }

      return NextResponse.json({ data }, { status: 201 });
    }

    // 단건 형태(기존): { member_name, date, ... }
    const row = {
      member_name: String(body.member_name ?? "").trim(),
      date: body.date,
      category: (body.category && String(body.category).trim()) || "기타",
      task_name: String(body.task_name ?? "").trim(),
      md: Number(body.md),
      overtime_md: Number(body.overtime_md ?? 0),
    };

    if (!row.member_name || !row.date || !row.task_name) {
      return NextResponse.json(
        { error: "member_name, date, task_name are required" },
        { status: 400 }
      );
    }
    if (!(row.md > 0)) return NextResponse.json({ error: "md must be > 0" }, { status: 400 });

    const { data, error } = await supabase
      .from("time_entries")
      .insert([row])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { error } = await supabase.from("time_entries").delete().eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
