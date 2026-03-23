// app/month/page.tsx
import Link from "next/link";
import { headers } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mdToHours, formatMd } from "@/features/time-entries/lib/hours";

import { MonthDashboardCharts } from "./MonthDashboardCharts";
import { MonthInsightCardBody } from "./MonthInsightCardBody";
import { computeMonthDashboardDerived } from "./_monthDashboardDerived";

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
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");

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

function roundH(n: number) {
  return Math.round(n * 10) / 10;
}

function fmtH(hours: number) {
  return roundH(hours).toFixed(1);
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
    const day = d.getDay();
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

  const firstDay = new Date(year, month - 1, 1);
  const monday = startOfWeekMonday(firstDay);
  const friday = addDays(monday, 4);

  const weekBackHref = `/?from=${toYMD(monday)}&to=${toYMD(friday)}`;

  const data = await fetchMonth(year, month);

  const totalHours = roundH(mdToHours(data.totals.md));
  const totalOtHours = roundH(mdToHours(data.totals.ot));

  const dashboardDerived =
    data.members.length > 0 ? computeMonthDashboardDerived(data) : null;

  return (
    <div className="page-container-month">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href={weekBackHref}>← 주간 입력으로</Link>
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          월간 인사이트 대시보드
        </h1>
        <div className="w-[110px]" />
      </div>

      {/* Month selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">월</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }).map((_, i) => {
              const m = i + 1;
              const active = m === month;
              return (
                <Button key={m} variant={active ? "default" : "outline"} size="sm" asChild>
                  <Link href={`/month?year=${year}&month=${m}`}>
                    {m}월
                  </Link>
                </Button>
              );
            })}
          </div>
          <CardDescription className="mt-3 text-xs">
            범위: {data.range.start} ~ {data.range.end} ({data.range.daysInMonth}일)
          </CardDescription>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              총 투입 시간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {fmtH(totalHours)}h
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {formatMd(data.totals.md)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              총 OT 시간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {fmtH(totalOtHours)}h
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {formatMd(data.totals.ot)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              투입 인원
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {data.members.length}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">명</div>
          </CardContent>
        </Card>
      </div>

      {/* 핵심 인사이트 */}
      {dashboardDerived && dashboardDerived.insights.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
            핵심 인사이트
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboardDerived.insights.map((insight) => (
              <Card key={insight.key}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{insight.title}</CardTitle>
                    <Badge
                      variant={
                        insight.id === "overtime-load"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px] font-medium uppercase tracking-wide"
                    >
                      {insight.id === "resource-external"
                        ? "외부"
                        : insight.id === "resource-misc"
                          ? "기타"
                          : insight.id === "overtime-load"
                            ? "OT"
                            : "집중"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="sr-only">{insight.description}</span>
                  <div className="text-sm leading-relaxed text-muted-foreground">
                    <MonthInsightCardBody body={insight.richBody} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* 차트 */}
      {dashboardDerived ? (
        <div className="mb-10">
          <MonthDashboardCharts
            chartCaptions={dashboardDerived.chartCaptions}
            categoryDonut={dashboardDerived.categoryDonut}
            memberBars={dashboardDerived.memberBars}
            taskBars={dashboardDerived.taskBars}
          />
        </div>
      ) : null}

      {/* Members */}
      {data.members.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {monthLabel(year, month)}에 저장된 데이터가 없어요.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            인원별 상세
          </h2>
          {data.members.map((m) => {
            const mHours = roundH(mdToHours(m.totals.md));
            const mOtHours = roundH(mdToHours(m.totals.ot));
            return (
            <Card key={m.member_name} className="group">
              <details open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-base font-semibold text-foreground">
                      {m.member_name}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground">
                        <span className="text-muted-foreground">시간</span>
                        <span className="font-semibold tabular-nums">{fmtH(mHours)}h</span>
                        <span className="text-muted-foreground text-[10px]">({formatMd(m.totals.md)})</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground">
                        <span className="text-muted-foreground">OT</span>
                        <span className="font-semibold tabular-nums">{fmtH(mOtHours)}h</span>
                        <span className="text-muted-foreground text-[10px]">({formatMd(m.totals.ot)})</span>
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                    <span className="hidden sm:inline">상세</span>
                    <svg
                      className="h-4 w-4 transition-transform group-open:rotate-180"
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
                </summary>
                <div className="border-t border-border px-4 pb-5 pt-2 sm:px-6">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>업무명</TableHead>
                        <TableHead className="w-[140px] text-right">시간 (m/d)</TableHead>
                        <TableHead className="w-[140px] text-right">OT 시간 (m/d)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.tasks.map((t, idx) => {
                        const tH = roundH(mdToHours(t.md));
                        const tOtH = roundH(mdToHours(t.ot));
                        return (
                        <TableRow key={`${t.category}||${t.task_name}||${idx}`}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="truncate font-medium" title={t.task_name}>
                                {t.task_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="rounded-full bg-muted px-2 py-0.5">
                                  {t.category}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="font-medium">{fmtH(tH)}h</span>
                            <span className="ml-1 text-xs text-muted-foreground">({formatMd(t.md)})</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="font-medium">{fmtH(tOtH)}h</span>
                            <span className="ml-1 text-xs text-muted-foreground">({formatMd(t.ot)})</span>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
