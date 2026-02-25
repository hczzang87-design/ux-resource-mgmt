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
    <WeekPageClient
      weekDates={weekDates}
      weekRangeLabel={weekRangeLabel}
      savedEntries={savedEntries}
    />
  );
}