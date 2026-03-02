import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type MonthSummaryResponse = {
  range: {
    year: number;
    month: number; // 1~12
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
    daysInMonth: number;
  };
  totals: { md: number; ot: number };
  members: Array<{
    member_name: string;
    totals: { md: number; ot: number };
    tasks: Array<{
      category: string;
      task_name: string;
      md: number;
      ot: number;
    }>;
  }>;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(year: number, month1to12: number, day: number) {
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}
function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    const dim = daysInMonth(year, month);
    const start = ymd(year, month, 1);
    const end = ymd(year, month, dim);

    const supabase = getSupabaseServerClient();

    // ✅ overtime_md 확정 컬럼
    const { data, error } = await supabase
      .from("time_entries")
      .select("date, member_name, category, task_name, md, overtime_md")
      .gte("date", start)
      .lte("date", end);

    if (error) {
      return NextResponse.json(
        { error: `Supabase query failed: ${error.message}` },
        { status: 500 }
      );
    }

    type Row = {
      date: string;
      member_name: string | null;
      category: string | null;
      task_name: string | null;
      md: number | null;
      overtime_md: number | null;
    };

    const rows = (data ?? []) as Row[];

    const memberMap = new Map<
      string,
      {
        member_name: string;
        totals: { md: number; ot: number };
        taskMap: Map<string, { category: string; task_name: string; md: number; ot: number }>;
      }
    >();

    let totalMd = 0;
    let totalOt = 0;

    for (const r of rows) {
      const member_name = (r.member_name || "").trim() || "unknown";
      const category = (r.category || "").trim() || "기타";
      const task_name = (r.task_name || "").trim() || "(업무명 없음)";

      const md = Number(r.md || 0);
      const ot = Number(r.overtime_md || 0);

      totalMd += md;
      totalOt += ot;

      if (!memberMap.has(member_name)) {
        memberMap.set(member_name, {
          member_name,
          totals: { md: 0, ot: 0 },
          taskMap: new Map(),
        });
      }

      const m = memberMap.get(member_name)!;
      m.totals.md += md;
      m.totals.ot += ot;

      const key = `${category}||${task_name}`;
      if (!m.taskMap.has(key)) {
        m.taskMap.set(key, { category, task_name, md: 0, ot: 0 });
      }
      const t = m.taskMap.get(key)!;
      t.md += md;
      t.ot += ot;
    }

    const members = Array.from(memberMap.values())
      .map((m) => {
        const tasks = Array.from(m.taskMap.values())
          .map((t) => ({
            category: t.category,
            task_name: t.task_name,
            md: round2(t.md),
            ot: round2(t.ot),
          }))
          .sort((a, b) => {
            if (b.md !== a.md) return b.md - a.md; // md desc
            return a.task_name.localeCompare(b.task_name);
          });

        return {
          member_name: m.member_name,
          totals: { md: round2(m.totals.md), ot: round2(m.totals.ot) },
          tasks,
        };
      })
      .sort((a, b) => a.member_name.localeCompare(b.member_name));

    const out: MonthSummaryResponse = {
      range: { year, month, start, end, daysInMonth: dim },
      totals: { md: round2(totalMd), ot: round2(totalOt) },
      members,
    };

    return NextResponse.json(out);
  } catch (e: any) {
    console.error("MONTH API ERROR:", e);
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}