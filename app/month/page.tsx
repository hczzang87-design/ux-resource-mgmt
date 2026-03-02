// app/month/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

type MonthSummaryResponse = {
  range: {
    year: number;
    month: number;
    start: string;
    end: string;
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

function getDefaultYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function monthLabel(year: number, month: number) {
  return `${year}년 ${month}월`;
}

async function getBaseUrlFromRequest() {
  // 1) env 우선
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");

  // 2) env 없으면 요청 헤더로 구성
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Cannot determine host for server-side fetch.");
  return `${proto}://${host}`;
}

async function fetchMonth(year: number, month: number) {
  const qs = new URLSearchParams({ year: String(year), month: String(month) });
  const base = await getBaseUrlFromRequest();
  const url = `${base}/api/time-entries/month?${qs.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to load month summary: ${res.status} ${txt}`);
  }
  return (await res.json()) as MonthSummaryResponse;
}

export default async function MonthPage({
    searchParams,
  }: {
    searchParams?: Promise<{ year?: string; month?: string }>;
  }) {
    const params = await searchParams;
  
    const def = getDefaultYearMonth();
  
    const yearRaw = Number(params?.year ?? 2026);
    const monthRaw = Number(params?.month ?? def.month);
  
    const year = Number.isInteger(yearRaw) ? yearRaw : 2026;
    const month =
      Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
        ? monthRaw
        : def.month;
        function pad2(n: number) {
            return String(n).padStart(2, "0");
          }
          function toYMD(d: Date) {
            return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          }
          function startOfWeekMonday(date: Date) {
            const d = new Date(date);
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
          
          // 선택 월의 "1일"을 기준으로 그 주의 월요일~금요일 계산
          const firstDay = new Date(year, month - 1, 1);
          const monday = startOfWeekMonday(firstDay);
          const friday = addDays(monday, 4);
          
          const weekBackHref = `/?from=${toYMD(monday)}&to=${toYMD(friday)}`;
  
    const data = await fetchMonth(year, month);
  
    // ⬇️ 아래 렌더링 코드는 기존 그대로 두면 돼
  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={weekBackHref}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          ← 주간 입력으로
        </Link>
        <h1 className="text-lg font-semibold">월간 내역 보기</h1>
        <div className="w-[110px]" />
      </div>

      {/* Month selector (A안) */}
      <div className="mb-6 rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-zinc-600">연도</div>
          <div className="font-medium">{year}</div>
        </div>

        <div className="text-sm text-zinc-600">월</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => {
            const m = i + 1;
            const active = m === month;
            return (
              <Link
                key={m}
                href={`/month?year=${year}&month=${m}`}
                className={[
                  "rounded-lg border px-3 py-2 text-sm",
                  active
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "hover:bg-zinc-50",
                ].join(" ")}
              >
                {m}월
              </Link>
            );
          })}
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          범위: {data.range.start} ~ {data.range.end} ({data.range.daysInMonth}일)
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4">
          <div className="text-sm text-zinc-600">총 md</div>
          <div className="mt-1 text-2xl font-semibold">{data.totals.md}</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-sm text-zinc-600">총 OT</div>
          <div className="mt-1 text-2xl font-semibold">{data.totals.ot}</div>
        </div>
      </div>

      {/* Members */}
      {data.members.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-zinc-600">
          {monthLabel(year, month)}에 저장된 데이터가 없어요.
        </div>
      ) : (
        <div className="space-y-4">
          {data.members.map((m) => (
  <details
    key={m.member_name}
    className="rounded-xl border"
    open
  >
    <summary className="flex cursor-pointer list-none items-center justify-between p-4">
      <div className="text-base font-semibold">{m.member_name}</div>

      <div className="flex items-center gap-3 text-sm text-zinc-700">
        <div>
          md <span className="font-semibold">{m.totals.md}</span> · OT{" "}
          <span className="font-semibold">{m.totals.ot}</span>
        </div>

        {/* caret */}
        <span className="select-none text-zinc-400">▾</span>
      </div>
    </summary>

    {/* divider */}
    <div className="border-t" />

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            <th className="px-4 py-3 text-left">업무명</th>
            <th className="px-4 py-3 text-right">md</th>
            <th className="px-4 py-3 text-right">OT</th>
          </tr>
        </thead>
        <tbody>
          {m.tasks.map((t, idx) => (
            <tr
              key={`${t.category}||${t.task_name}||${idx}`}
              className="border-t"
            >
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <div className="font-medium">{t.task_name}</div>
                  <div className="text-xs text-zinc-500">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5">
                      {t.category}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{t.md}</td>
              <td className="px-4 py-3 text-right tabular-nums">{t.ot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
))}
        </div>
      )}
    </div>
  );
}