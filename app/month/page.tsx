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

  const fmt1 = (n: number) => Number(n ?? 0).toFixed(1);

  return (
    <div className="page-container">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={weekBackHref}
          className="ui-btn"
        >
          ← 주간 입력으로
        </Link>
        <h1 className="text-lg font-semibold">월간 내역 보기</h1>
        <div className="w-[110px]" />
      </div>

      {/* Month selector (A안) */}
      <div className="ui-card ui-card-pad mb-6">
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
                  "ui-btn",
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
        <div className="ui-card ui-card-pad">
          <div className="text-sm text-zinc-600">총 MD</div>
          <div className="mt-1 text-2xl font-semibold">{fmt1(data.totals.md)}</div>
        </div>
        <div className="ui-card ui-card-pad">
          <div className="text-sm text-zinc-600">총 OT</div>
          <div className="mt-1 text-2xl font-semibold">{fmt1(data.totals.ot)}</div>
        </div>
      </div>

      {/* Members */}
      {data.members.length === 0 ? (
        <div className="ui-card p-10 text-center text-zinc-600">
          {monthLabel(year, month)}에 저장된 데이터가 없어요.
        </div>
      ) : (
        <div className="space-y-4">
          {data.members.map((m) => (
  <details
    key={m.member_name}
    className="ui-card group"
    open
  >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 hover:bg-zinc-50">
      <div className="flex min-w-0 items-center gap-2">
        <div className="truncate text-base font-semibold">{m.member_name}</div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700">
            <span className="text-zinc-500">MD</span>
            <span className="font-semibold tabular-nums">{fmt1(m.totals.md)}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700">
            <span className="text-zinc-500">OT</span>
            <span className="font-semibold tabular-nums">{fmt1(m.totals.ot)}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-zinc-700">
        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
          <span className="hidden sm:inline">상세</span>
          <svg
            className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 8l4 4 4-4" />
          </svg>
        </span>
      </div>
    </summary>

    {/* divider */}
    <div className="border-t border-zinc-100" />

    <div className="overflow-x-auto">
      <div className="overflow-hidden">
      <table className="ui-table table-fixed">
        <colgroup>
          <col />
          <col className="w-[96px]" />
          <col className="w-[96px]" />
        </colgroup>
        <thead className="ui-thead">
          <tr>
            <th className="ui-th">업무명</th>
            <th className="ui-th text-right">MD</th>
            <th className="ui-th text-right">OT</th>
          </tr>
        </thead>
        <tbody>
          {m.tasks.map((t, idx) => (
            <tr
              key={`${t.category}||${t.task_name}||${idx}`}
              className="border-t border-zinc-100"
            >
              <td className="ui-td">
                <div className="flex flex-col gap-1">
                  <div className="truncate font-medium" title={t.task_name}>
                    {t.task_name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5">
                      {t.category}
                    </span>
                  </div>
                </div>
              </td>
              <td className="ui-td text-right tabular-nums">{fmt1(t.md)}</td>
              <td className="ui-td text-right tabular-nums">{fmt1(t.ot)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  </details>
))}
        </div>
      )}
    </div>
  );
}