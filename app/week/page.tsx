import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

type TimeEntryRow = Record<string, any>;

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 월요일(주 시작)을 구한다. (일요일=0 보정)
function startOfWeekMonday(today = new Date()) {
  const d = new Date(today);
  const day = d.getDay(); // 0(일)~6(토)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// row에서 날짜 컬럼명을 유연하게 찾는다 (스키마 확정 전 대응)
function pickDate(row: TimeEntryRow): string | null {
  return (
    row.date ??
    row.entry_date ??
    row.work_date ??
    row.day ??
    row.created_at?.slice?.(0, 10) ??
    null
  );
}

// row에서 md 컬럼명을 유연하게 찾는다
function pickMd(row: TimeEntryRow): number {
  const v =
    row.md ??
    row.man_days ??
    row.mandays ??
    row.man_day ??
    row.value ??
    row.amount ??
    0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default async function WeekPage() {
  const monday = startOfWeekMonday(new Date());

  // 월~금 5일
  const days = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const from = toYMD(days[0]);
  const toExclusive = (() => {
    const d = new Date(days[4]);
    d.setDate(d.getDate() + 1);
    return toYMD(d);
  })();

  // Supabase 조회
  const supabase = supabaseServer();

  // ⚠️ 테이블명: 주석에 time_entries가 보이니 일단 그걸로 간다.
  // 날짜 컬럼명이 확정되면 아래 .gte/.lt 대상 컬럼도 확정해서 바꾸면 됨.
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    // 우선 date 기준으로 시도 (스키마에 맞게 바꿀 것)
    .gte("date", from)
    .lt("date", toExclusive);

  // date 컬럼이 아니라면 여기서 터질 수 있어 (그땐 아래 “2) 스키마 맞추기”대로 조정)
  if (error) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>이번 주 현황</h1>
        <p style={{ marginTop: 12 }}>
          Supabase 조회 중 에러가 났어: <b>{error.message}</b>
        </p>
        <p style={{ marginTop: 8, opacity: 0.7 }}>
          힌트: time_entries 테이블의 날짜 컬럼명이 <code>date</code>가 아닐 가능성이
          있어. (entry_date, work_date 등)
        </p>
      </main>
    );
  }

  const rows: TimeEntryRow[] = data ?? [];

  // 날짜별 합계
  const sumByDate = new Map<string, number>();
  for (const row of rows) {
    const ymd = pickDate(row);
    if (!ymd) continue;
    sumByDate.set(ymd, (sumByDate.get(ymd) ?? 0) + pickMd(row));
  }

  const weekTotal = days.reduce((acc, d) => acc + (sumByDate.get(toYMD(d)) ?? 0), 0);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>이번 주 현황</h1>
      <p style={{ marginTop: 8, opacity: 0.7 }}>
        {from} ~ {toYMD(days[4])}
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {days.map((d) => {
          const ymd = toYMD(d);
          const sum = sumByDate.get(ymd) ?? 0;
          const isEmpty = sum === 0;

          return (
            <Link
              key={ymd}
              href={`/day/${ymd}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{ymd}</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                  {isEmpty ? "기록 없음" : "기록 있음"}
                </div>
              </div>
              <div style={{ fontWeight: 800 }}>{sum} md</div>
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>이번 주 총합</span>
          <span style={{ fontWeight: 900 }}>{weekTotal} md</span>
        </div>
      </div>
    </main>
  );
}
