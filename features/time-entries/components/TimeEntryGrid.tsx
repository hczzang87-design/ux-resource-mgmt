"use client";

import React, { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  mdToHours,
  hoursToMd,
  formatMd,
  HOURS_STEP,
  MAX_DAILY_HOURS,
} from "../lib/hours";

type Row = {
  id: string;
  task_name: string;
  category?: string;
  mdByDate: Record<string, number>;
  ot: number;
};

type Props = {
  weekDates: string[];
  rows: Row[];
  onChangeCell: (rowId: string, date: string, nextMd: number) => void;
  onChangeOt: (rowId: string, nextOt: number) => void;
  onAddRow: (row: { task_name: string; category?: string }) => void;
  onDeleteRow?: (rowId: string) => void;
  onSave: () => void;
  canSave?: boolean;
  isSaving?: boolean;
  addRowDisabled?: boolean;
  saveStatus?: "idle" | "saving" | "success";
};

const CATEGORY_OPTIONS = [
  { label: "프로덕트 UX", value: "프로덕트 UX" },
  { label: "UX 리퀘스트", value: "UX 리퀘스트" },
  { label: "기타", value: "기타" },
];

/** 카테고리 미선택 시 테이블 표시용 */
function displayCategoryLabel(category?: string) {
  const t = category?.trim();
  return t ? t : "없음";
}

/** 표시·스테퍼용 정수 시간 (소수 시간 입력 없음) */
function intH(n: number) {
  return Math.round(n);
}

export default function TimeEntryGrid({
  weekDates,
  rows,
  onChangeCell,
  onChangeOt,
  onAddRow,
  onDeleteRow,
  onSave,
  isSaving,
  canSave = false,
  addRowDisabled,
  saveStatus = "idle",
}: Props) {
  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, boolean>>({});
  const [otDrafts, setOtDrafts] = useState<Record<string, string>>({});
  const [otErrors, setOtErrors] = useState<Record<string, boolean>>({});

  const headerDates = useMemo(
    () =>
      weekDates.map((d) => ({
        iso: d,
        mmdd: d.slice(5),
        dow: (() => {
          const [y, m, day] = d.split("-").map(Number);
          const dt = new Date(y, m - 1, day);
          const ko = ["일", "월", "화", "수", "목", "금", "토"] as const;
          return ko[dt.getDay()];
        })(),
      })),
    [weekDates]
  );

  const rowTotalsHours = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, r) => {
      const totalMd = weekDates.reduce((sum, d) => sum + (r.mdByDate[d] ?? 0), 0);
      acc[r.id] = intH(mdToHours(totalMd));
      return acc;
    }, {});
  }, [rows, weekDates]);

  const rowTotalsMd = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, r) => {
      const totalMd = weekDates.reduce((sum, d) => sum + (r.mdByDate[d] ?? 0), 0);
      acc[r.id] = Math.round(totalMd * 100) / 100;
      return acc;
    }, {});
  }, [rows, weekDates]);

  const dateTotalsMd = useMemo(() => {
    return weekDates.reduce<Record<string, number>>((acc, d) => {
      acc[d] = rows.reduce((sum, r) => sum + (r.mdByDate[d] ?? 0), 0);
      return acc;
    }, {});
  }, [rows, weekDates]);

  const cellKey = (rowId: string, date: string) => `${rowId}||${date}`;
  const fmtH = (hours: number) => String(intH(hours));

  const maxAllowedHoursForCell = (rowId: string, date: string, currentMd: number) => {
    const totalMdForDate = dateTotalsMd[date] ?? 0;
    const remainingMd = 1.0 - (totalMdForDate - currentMd);
    return Math.min(MAX_DAILY_HOURS, Math.floor(mdToHours(Math.max(0, remainingMd)) + 1e-9));
  };

  const parseHoursInput = (s: string) => {
    const cleaned = s.replace(/[^\d]/g, "");
    if (!cleaned) return null;
    const n = parseInt(cleaned, 10);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[520px]">
          <Label htmlFor="new-task" className="sr-only">업무명</Label>
          <Input
            id="new-task"
            className="h-10"
            placeholder="업무명 (예: 리서치)"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            disabled={addRowDisabled}
          />
        </div>

        <div className="w-[180px]">
          <Label htmlFor="new-category" className="sr-only">카테고리</Label>
          <select
            id="new-category"
            className="flex h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            disabled={addRowDisabled}
          >
            <option value="">카테고리 (선택)</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          className="h-10 px-4"
          onClick={() => {
            const task_name = newTask.trim();
            if (!task_name) return;
            const category = newCategory.trim() || undefined;
            onAddRow({ task_name, category });
            setNewTask("");
            setNewCategory("");
          }}
          disabled={addRowDisabled}
        >
          행 추가
        </Button>
      </div>

      <Card className="mt-3 overflow-x-auto">
        <CardContent className="p-0">
        <Table className="min-w-[1040px] w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[48px] px-2 py-3"></TableHead>
              <TableHead className="w-[192px] whitespace-nowrap px-4 py-3">업무</TableHead>
              <TableHead className="w-[128px] whitespace-nowrap px-4 py-3">카테고리</TableHead>
              <TableHead className="w-[110px] px-4 py-3">
                <div className="flex flex-col leading-tight">
                  <span>투입 시간</span>
                </div>
              </TableHead>
              {headerDates.map((d) => {
                const dayMd = dateTotalsMd[d.iso] ?? 0;
                const dayH = intH(mdToHours(dayMd));
                return (
                  <TableHead
                    key={d.iso}
                    className="w-[110px] min-w-[110px] px-2 py-3 text-center whitespace-nowrap text-xs"
                  >
                    <div className="flex flex-col items-center gap-0.5 leading-tight">
                      <span>
                        {d.mmdd} ({d.dow})
                      </span>
                      <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                        {dayH}/{MAX_DAILY_HOURS}
                      </span>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="w-[120px] px-4 py-3">
                <div className="flex flex-col leading-tight">
                  <span>초과 근무</span>
                  <span className="text-[10px] text-muted-foreground">OT(h)</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="px-4 py-6 text-sm text-muted-foreground" colSpan={4 + weekDates.length + 1}>
                  내용 없음
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const totalH = rowTotalsHours[r.id] ?? 0;
                const totalMd = rowTotalsMd[r.id] ?? 0;

                return (
                  <TableRow key={r.id}>
                    <TableCell className="px-2 py-3">
                      {onDeleteRow && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="이 행 삭제"
                          onClick={() => onDeleteRow(r.id)}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                      <div className="truncate" title={r.task_name}>
                        {r.task_name}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      <span
                        className="inline-flex max-w-[200px] truncate rounded-full bg-muted px-2 py-1 text-xs"
                        title={displayCategoryLabel(r.category)}
                      >
                        {displayCategoryLabel(r.category)}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{fmtH(totalH)}h</span>
                        <span className="text-[10px] text-muted-foreground">{formatMd(totalMd)}</span>
                      </div>
                    </TableCell>

                    {weekDates.map((d) => {
                      const md = r.mdByDate[d] ?? 0;
                      const hours = intH(mdToHours(md));
                      const k = cellKey(r.id, d);
                      const draft = cellDrafts[k];
                      const shown = typeof draft === "string" ? draft : fmtH(hours);
                      const maxH = maxAllowedHoursForCell(r.id, d, md);
                      const isError = cellErrors[k] === true;

                      return (
                        <TableCell key={d} className="px-2 py-3">
                          <div
                            className={
                              "flex min-w-[100px] items-center gap-0.5 rounded-lg border bg-background " +
                              (isError ? "border-destructive" : "border-input")
                            }
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="h-8 w-7 shrink-0"
                              title={`${HOURS_STEP}h 감소`}
                              onClick={() => {
                                const nextH = Math.max(0, hours - HOURS_STEP);
                                onChangeCell(r.id, d, hoursToMd(nextH));
                              }}
                            >
                              −
                            </Button>
                            <Input
                              inputMode="numeric"
                              className="h-8 min-w-11 flex-1 border-0 bg-transparent px-1 py-0 text-center text-sm font-medium shadow-none focus-visible:ring-0"
                              value={shown}
                              title={
                                isError
                                  ? `하루 합계는 ${MAX_DAILY_HOURS}h를 초과할 수 없어요 (최대: ${fmtH(maxH)}h)`
                                  : `0 ~ ${MAX_DAILY_HOURS}h 입력`
                              }
                              onChange={(e) => {
                                const next = e.target.value;
                                setCellDrafts((prev) => ({ ...prev, [k]: next }));

                                const n = parseHoursInput(next);
                                if (n === null) {
                                  setCellErrors((prev) => ({ ...prev, [k]: false }));
                                  return;
                                }

                                const nextRoundedH = n;
                                const nextError =
                                  nextRoundedH < 0 || nextRoundedH > maxH || nextRoundedH > MAX_DAILY_HOURS;
                                setCellErrors((prev) => ({ ...prev, [k]: nextError }));

                                if (!nextError) {
                                  onChangeCell(r.id, d, hoursToMd(nextRoundedH));
                                }
                              }}
                              onBlur={() => {
                                setCellDrafts((prev) => {
                                  const m = { ...prev };
                                  delete m[k];
                                  return m;
                                });
                                setCellErrors((prev) => ({ ...prev, [k]: false }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                if (e.key === "Escape") (e.currentTarget as HTMLInputElement).blur();
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="h-8 w-7 shrink-0"
                              title={`${HOURS_STEP}h 증가`}
                              onClick={() => {
                                const nextH = hours + HOURS_STEP;
                                onChangeCell(r.id, d, hoursToMd(nextH));
                              }}
                            >
                              +
                            </Button>
                          </div>
                          <div className="mt-0.5 text-center text-[10px] text-muted-foreground">
                            {formatMd(md)}
                          </div>
                        </TableCell>
                      );
                    })}

                    <TableCell className="px-4 py-3">
                      {(() => {
                        const otMd = r.ot;
                        const otH = intH(mdToHours(otMd));
                        const k = r.id;
                        const draft = otDrafts[k];
                        const shown = typeof draft === "string" ? draft : fmtH(otH);
                        const isError = otErrors[k] === true;

                        return (
                          <>
                          <div
                            className={
                              "flex min-w-[100px] items-center gap-0.5 rounded-lg border bg-background " +
                              (isError ? "border-destructive" : "border-input")
                            }
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="h-8 w-7 shrink-0"
                              title={`${HOURS_STEP}h 감소`}
                              onClick={() => {
                                const nextH = Math.max(0, otH - HOURS_STEP);
                                onChangeOt(r.id, hoursToMd(nextH));
                              }}
                            >
                              −
                            </Button>
                            <Input
                              inputMode="numeric"
                              className="h-8 min-w-11 flex-1 border-0 bg-transparent px-1 py-0 text-center text-sm font-medium shadow-none focus-visible:ring-0"
                              value={shown}
                              title={isError ? "OT는 0 이상이어야 해요." : "초과(OT) 시간 입력"}
                              onChange={(e) => {
                                const next = e.target.value;
                                setOtDrafts((prev) => ({ ...prev, [k]: next }));

                                const n = parseHoursInput(next);
                                if (n === null) {
                                  setOtErrors((prev) => ({ ...prev, [k]: false }));
                                  return;
                                }

                                const nextRoundedH = n;
                                const nextError = nextRoundedH < 0;
                                setOtErrors((prev) => ({ ...prev, [k]: nextError }));
                                if (!nextError) onChangeOt(r.id, hoursToMd(nextRoundedH));
                              }}
                              onBlur={() => {
                                setOtDrafts((prev) => {
                                  const m = { ...prev };
                                  delete m[k];
                                  return m;
                                });
                                setOtErrors((prev) => ({ ...prev, [k]: false }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                if (e.key === "Escape") (e.currentTarget as HTMLInputElement).blur();
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="h-8 w-7 shrink-0"
                              title={`${HOURS_STEP}h 증가`}
                              onClick={() => {
                                const nextH = otH + HOURS_STEP;
                                onChangeOt(r.id, hoursToMd(nextH));
                              }}
                            >
                              +
                            </Button>
                          </div>
                          <div className="mt-0.5 text-center text-[10px] text-muted-foreground">
                            {formatMd(otMd)}
                          </div>
                          </>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          * 8h = 1.0 m/d · 스테퍼 단위: {HOURS_STEP}h · 하루 최대 {MAX_DAILY_HOURS}h · OT 제한 없음
        </p>
        <div className="flex items-center gap-2">
          <Button
            className="h-10 px-4"
            onClick={onSave}
            disabled={isSaving || !canSave}
          >
            {isSaving || saveStatus === "saving" ? (
              "저장 중..."
            ) : saveStatus === "success" ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 10l4 4 8-8" />
                </svg>
                저장 완료
              </span>
            ) : (
              "저장"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
