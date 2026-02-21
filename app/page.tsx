import MainWeekClient from "./MainWeekClient";
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

export default async function Page() {
  const monday = startOfWeekMonday(new Date());
  const friday = addDays(monday, 4);

  const from = toYMD(monday);
  const to = toYMD(friday);

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
    // 서버 로그에서 바로 보이게
    console.error("Failed to load time_entries:", error);
  }

  const baseEntries = (data ?? []) as TimeEntry[];

  return <MainWeekClient baseEntries={baseEntries} />;
}