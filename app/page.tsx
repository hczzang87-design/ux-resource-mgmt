import Link from "next/link";
import WeekPageClient from "./WeekPageClient";
import type { TimeEntry } from "@/features/time-entries/types";
import { supabaseServer } from "@/lib/supabaseServer";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfWeekMonday(today = new Date()) {
  const d = new Date(today);
  const day = d.getDay(); // 0(일)~6(토)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type PageProps = { searchParams?: Promise<{ from?: string; to?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  let monday: Date;
  let from: string;
  let to: string;

  if (params?.from && params?.to) {
    from = params.from;
    to = params.to;
    const [y, m, d] = from.split("-").map(Number);
    monday = new Date(y, m - 1, d);
  } else {
    monday = startOfWeekMonday(new Date());
    const friday = addDays(monday, 4);
    from = toYMD(monday);
    to = toYMD(friday);
  }

  const weekDates = [
    from,
    toYMD(addDays(monday, 1)),
    toYMD(addDays(monday, 2)),
    toYMD(addDays(monday, 3)),
    to,
  ];
  const weekRangeLabel = `${from} ~ ${to}`;

  // ✅ 월간 링크는 "이번 주의 from" 기준 월로 이동 (주간 탐색과 자연스럽게 연결)
  const [fy, fm] = from.split("-").map(Number);
  const monthHref = `/month?year=${fy}&month=${fm}`;

  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("member_name", { ascending: true })
    .order("date", { ascending: true })
    .order("category", { ascending: true })
    .order("task_name", { ascending: true });

  if (error) {
    console.error("Failed to load time_entries:", error);
  }

  const savedEntries = (data ?? []) as TimeEntry[];

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">주간 입력</div>
          <div className="mt-1 text-sm text-zinc-600">{weekRangeLabel}</div>
        </div>

        <Link
          href={monthHref}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          월간 내역 보기
        </Link>
      </div>

      <WeekPageClient
        weekDates={weekDates}
        weekRangeLabel={weekRangeLabel}
        savedEntries={savedEntries}
      />
    </div>
  );
}