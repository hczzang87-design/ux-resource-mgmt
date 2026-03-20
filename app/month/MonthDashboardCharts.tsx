"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthChartCaptions } from "./_monthDashboardDerived";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export type MonthDashboardChartsProps = {
  chartCaptions: MonthChartCaptions;
  categoryDonut: { name: string; value: number }[];
  memberBars: {
    name: string;
    hours: number;
    otHours: number;
    hasOtAlert: boolean;
  }[];
  taskBars: { name: string; hours: number }[];
};

function buildDonutConfig(data: { name: string }[]): ChartConfig {
  const c: ChartConfig = {};
  data.forEach((d, i) => {
    c[d.name] = {
      label: d.name,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    };
  });
  return c;
}

function buildTaskConfig(data: { name: string }[]): ChartConfig {
  const c: ChartConfig = {};
  data.forEach((d, i) => {
    c[d.name] = {
      label: d.name,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    };
  });
  return c;
}

export function MonthDashboardCharts({
  chartCaptions,
  categoryDonut,
  memberBars,
  taskBars,
}: MonthDashboardChartsProps) {
  const donutConfig = React.useMemo(
    () => buildDonutConfig(categoryDonut),
    [categoryDonut]
  );

  const taskConfig = React.useMemo(() => buildTaskConfig(taskBars), [taskBars]);

  const memberChartConfig = React.useMemo(
    () =>
      ({
        hours: { label: "투입 시간 (h)", color: "var(--chart-1)" },
        hoursHighlight: {
          label: "투입 (OT 발생)",
          color: "var(--destructive)",
        },
      }) satisfies ChartConfig,
    []
  );

  const donutHasData = categoryDonut.some((d) => d.value > 0);
  const memberHasData = memberBars.some((d) => d.hours > 0);
  const taskHasData = taskBars.some((d) => d.hours > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
          차트
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 리소스 분배 */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">리소스 분배</CardTitle>
              <CardDescription className="text-xs">
                카테고리별 투입 시간 비중
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col pt-0">
              {donutHasData ? (
                <ChartContainer
                  config={donutConfig}
                  className="mx-auto aspect-square max-h-[260px] w-full"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel nameKey="name" />}
                    />
                    <Pie
                      data={categoryDonut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={80}
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      {categoryDonut.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={
                            donutConfig[entry.name]?.color ??
                            CHART_PALETTE[i % CHART_PALETTE.length]
                          }
                        />
                      ))}
                    </Pie>
                    <ChartLegend
                      content={<ChartLegendContent nameKey="name" />}
                    />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  표시할 카테고리 데이터가 없습니다.
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t bg-transparent pt-3 text-xs leading-relaxed text-muted-foreground">
              {chartCaptions.resourceDistribution}
            </CardFooter>
          </Card>

          {/* 인원 부하 */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">인원 부하</CardTitle>
              <CardDescription className="text-xs">
                인원별 투입 시간 · OT 발생 시 막대 색으로 강조
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col pt-0">
              {memberHasData ? (
                <ChartContainer
                  config={memberChartConfig}
                  className="h-[280px] w-full"
                >
                  <BarChart
                    data={memberBars}
                    layout="vertical"
                    margin={{ left: 4, right: 12, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={72}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, item) => {
                            const payload = item?.payload as
                              | (typeof memberBars)[0]
                              | undefined;
                            if (!payload) return null;
                            return (
                              <div className="flex w-full flex-col gap-0.5">
                                <span className="font-medium">
                                  {payload.name}
                                </span>
                                <span className="tabular-nums">
                                  투입: {Number(value).toFixed(1)}h
                                </span>
                                <span className="text-muted-foreground tabular-nums">
                                  OT: {payload.otHours.toFixed(1)}h
                                </span>
                                {payload.hasOtAlert ? (
                                  <span className="text-destructive text-xs">
                                    OT 발생
                                  </span>
                                ) : null}
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Bar dataKey="hours" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {memberBars.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.hasOtAlert
                              ? "var(--destructive)"
                              : "var(--chart-1)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  표시할 인원 데이터가 없습니다.
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t bg-transparent pt-3 text-xs leading-relaxed text-muted-foreground">
              {chartCaptions.memberLoad}
            </CardFooter>
          </Card>

          {/* 업무 집중도 */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">업무 집중도</CardTitle>
              <CardDescription className="text-xs">
                업무별 투입 시간 상위 3개 및 기타
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col pt-0">
              {taskHasData ? (
                <ChartContainer
                  config={taskConfig}
                  className="h-[280px] w-full"
                >
                  <BarChart
                    data={taskBars}
                    layout="vertical"
                    margin={{ left: 4, right: 12, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={88}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value) => (
                            <span className="tabular-nums">
                              {Number(value).toFixed(1)}h
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="hours" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {taskBars.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={
                            taskConfig[entry.name]?.color ??
                            CHART_PALETTE[i % CHART_PALETTE.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  표시할 업무 데이터가 없습니다.
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t bg-transparent pt-3 text-xs leading-relaxed text-muted-foreground">
              {chartCaptions.taskFocus}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
