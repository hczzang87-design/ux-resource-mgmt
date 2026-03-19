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

type Row = {
  id: string;
  task_name: string;
  category?: string;
  // date(YYYY-MM-DD) => md
  mdByDate: Record<string, number>;
  ot: number;
};

type Props = {
  weekDates: string[]; // ["2026-02-23", ...]
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
  { label: "프로덕트 디자인", value: "프로덕트 디자인" },
  { label: "외부 리퀘스트", value: "외부 리퀘스트" },
  { label: "기타", value: "기타" },
];

function round1(n: number) {
  return Math.round(n * 10) / 10;
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
  saveStatus = "idle"
  
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

  const rowTotals = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, r) => {
      const total = weekDates.reduce((sum, d) => sum + (r.mdByDate[d] ?? 0), 0);
      acc[r.id] = round1(total);
      return acc;
    }, {});
  }, [rows, weekDates]);

  const dateTotals = useMemo(() => {
    return weekDates.reduce<Record<string, number>>((acc, d) => {
      acc[d] = round1(rows.reduce((sum, r) => sum + (r.mdByDate[d] ?? 0), 0));
      return acc;
    }, {});
  }, [rows, weekDates]);

  const cellKey = (rowId: string, date: string) => `${rowId}||${date}`;
  const fmt1 = (n: number) => Number(n ?? 0).toFixed(1);

  const maxAllowedForCell = (rowId: string, date: string, currentValue: number) => {
    const totalForDate = dateTotals[date] ?? 0;
    const remaining = 1.0 - (totalForDate - Number(currentValue ?? 0));
    return round1(Math.max(0, remaining));
  };

  const parseMd = (s: string) => {
    const cleaned = s.replace(/[^\d.]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
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
              <TableHead className="w-[90px] px-4 py-3">총 md</TableHead>
              {headerDates.map((d) => (
                <TableHead
                  key={d.iso}
                  className="w-[100px] min-w-[100px] px-2 py-3 text-center whitespace-nowrap text-xs"
                >
                  {d.mmdd} ({d.dow})
                </TableHead>
              ))}
              <TableHead className="w-[110px] px-4 py-3">초과 근무 (OT)</TableHead>
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
                const total = rowTotals[r.id] ?? 0;

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
                        title={r.category || "—"}
                      >
                        {r.category || "—"}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{total.toFixed(1)}</span>
                        <span className="text-[10px] text-muted-foreground">md</span>
                      </div>
                    </TableCell>

                    {weekDates.map((d) => {
                      const v = r.mdByDate[d] ?? 0;
                      const k = cellKey(r.id, d);
                      const draft = cellDrafts[k];
                      const shown = typeof draft === "string" ? draft : fmt1(v);
                      const maxAllowed = maxAllowedForCell(r.id, d, v);
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
                              title="0.1 감소"
                              onClick={() => onChangeCell(r.id, d, Math.max(0, round1(v - 0.1)))}
                            >
                              −
                            </Button>
                            <Input
                              inputMode="decimal"
                              className="h-8 min-w-11 flex-1 border-0 bg-transparent px-1 py-0 text-center text-sm font-medium shadow-none focus-visible:ring-0"
                              value={shown}
                              title={
                                isError
                                  ? `하루 합계는 1.0을 초과할 수 없어요. (최대 입력 가능: ${fmt1(maxAllowed)})`
                                  : "0.0 ~ 1.0 직접 입력 가능"
                              }
                              onChange={(e) => {
                                const next = e.target.value;
                                setCellDrafts((prev) => ({ ...prev, [k]: next }));

                                const n = parseMd(next);
                                if (n === null) {
                                  setCellErrors((prev) => ({ ...prev, [k]: false }));
                                  return;
                                }

                                const nextRounded = round1(n);
                                const nextError =
                                  nextRounded < 0 || nextRounded > maxAllowed + 1e-9 || nextRounded > 1.0 + 1e-9;
                                setCellErrors((prev) => ({ ...prev, [k]: nextError }));

                                if (!nextError) {
                                  onChangeCell(r.id, d, nextRounded);
                                }
                              }}
                              onBlur={() => {
                                // 입력값이 유효하지 않으면, 현재 값으로 되돌림
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
                              title="0.1 증가"
                              onClick={() => onChangeCell(r.id, d, round1(v + 0.1))}
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                      );
                    })}

                    <TableCell className="px-4 py-3">
                      {(() => {
                        const k = r.id;
                        const draft = otDrafts[k];
                        const shown = typeof draft === "string" ? draft : fmt1(r.ot);
                        const isError = otErrors[k] === true;

                        return (
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
                          title="0.1 감소"
                          onClick={() => onChangeOt(r.id, Math.max(0, round1(r.ot - 0.1)))}
                        >
                          −
                        </Button>
                        <Input
                          inputMode="decimal"
                          className="h-8 min-w-11 flex-1 border-0 bg-transparent px-1 py-0 text-center text-sm font-medium shadow-none focus-visible:ring-0"
                          value={shown}
                          title={isError ? "초과(OT)는 0 이상이어야 해요." : "초과(OT) 직접 입력 가능"}
                          onChange={(e) => {
                            const next = e.target.value;
                            setOtDrafts((prev) => ({ ...prev, [k]: next }));

                            const n = parseMd(next);
                            if (n === null) {
                              setOtErrors((prev) => ({ ...prev, [k]: false }));
                              return;
                            }

                            const nextRounded = round1(n);
                            const nextError = nextRounded < 0;
                            setOtErrors((prev) => ({ ...prev, [k]: nextError }));
                            if (!nextError) onChangeOt(r.id, nextRounded);
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
                          title="0.1 증가"
                          onClick={() => onChangeOt(r.id, round1(r.ot + 0.1))}
                        >
                          +
                        </Button>
                      </div>
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
        <div />

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
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
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