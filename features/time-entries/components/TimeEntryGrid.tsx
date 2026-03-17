"use client";

import React, { useMemo, useState } from "react";

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
      {/* Add row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-10 w-full max-w-[520px] rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 disabled:placeholder:text-zinc-300"
          placeholder="업무명 (예: 리서치)"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          disabled={addRowDisabled}
        />

        <select
          className="h-10 w-[180px] rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
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

        <button
          className="ui-btn h-10 px-4"
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
        </button>
      </div>

      {/* Table */}
      <div className="ui-card mt-3 overflow-x-auto">
        <table className="min-w-[1040px] w-full table-fixed border-collapse">
          <thead className="bg-zinc-50">
            <tr className="text-left text-xs text-zinc-600">
              <th className="px-2 py-3 w-[48px]"></th>
              <th className="px-4 py-3 w-[192px] whitespace-nowrap">업무</th>
              <th className="px-4 py-3 w-[128px] whitespace-nowrap">카테고리</th>
              <th className="px-4 py-3 w-[90px]">총 md</th>

              {headerDates.map((d) => (
                <th
                  key={d.iso}
                  className="px-[17px] py-3 w-[90px] text-center whitespace-nowrap"
                >
                  <span className="font-medium text-zinc-800 whitespace-nowrap text-xs">
                    {d.mmdd} ({d.dow})
                  </span>
                </th>
              ))}

              <th className="px-4 py-3 w-[110px]">초과 근무 (OT)</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-500" colSpan={4 + weekDates.length + 1}>
                  내용 없음
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const total = rowTotals[r.id] ?? 0;

                return (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td className="px-2 py-3">
                      {onDeleteRow && (
                        <button
                          type="button"
                          className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          title="이 행 삭제"
                          onClick={() => onDeleteRow(r.id)}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 whitespace-nowrap">
                      <div className="truncate" title={r.task_name}>
                        {r.task_name}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-700 whitespace-nowrap">
                      <span
                        className="inline-flex max-w-[200px] truncate rounded-full bg-zinc-100 px-2 py-1 text-xs"
                        title={r.category || "—"}
                      >
                        {r.category || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-900">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{total.toFixed(1)}</span>
                        <span className="text-[10px] text-zinc-500">md</span>
                      </div>
                    </td>

                    {weekDates.map((d) => {
                      const v = r.mdByDate[d] ?? 0;
                      const k = cellKey(r.id, d);
                      const draft = cellDrafts[k];
                      const shown = typeof draft === "string" ? draft : fmt1(v);
                      const maxAllowed = maxAllowedForCell(r.id, d, v);
                      const isError = cellErrors[k] === true;

                      return (
                        <td key={d} className="px-[17px] py-3">
                          <div
                            className={[
                              "flex w-[88px] items-center gap-0.5 rounded-lg border bg-white",
                              isError ? "border-red-500" : "border-zinc-200",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                              title="0.1 감소"
                              onClick={() => onChangeCell(r.id, d, Math.max(0, round1(v - 0.1)))}
                            >
                              −
                            </button>
                            <input
                              inputMode="decimal"
                              className="h-8 min-w-8 flex-1 bg-transparent text-center text-sm font-medium text-zinc-900 outline-none"
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
                            <button
                              type="button"
                              className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                              title="0.1 증가"
                              onClick={() => onChangeCell(r.id, d, round1(v + 0.1))}
                            >
                              +
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-4 py-3">
                      {(() => {
                        const k = r.id;
                        const draft = otDrafts[k];
                        const shown = typeof draft === "string" ? draft : fmt1(r.ot);
                        const isError = otErrors[k] === true;

                        return (
                          <div
                            className={[
                              "flex w-[100px] items-center gap-0.5 rounded-lg border bg-white",
                              isError ? "border-red-500" : "border-zinc-200",
                            ].join(" ")}
                          >
                        <button
                          type="button"
                          className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          title="0.1 감소"
                          onClick={() => onChangeOt(r.id, Math.max(0, round1(r.ot - 0.1)))}
                        >
                          −
                        </button>
                        <input
                          inputMode="decimal"
                          className="h-8 min-w-10 flex-1 bg-transparent text-center text-sm font-medium text-zinc-900 outline-none"
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
                        <button
                          type="button"
                          className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          title="0.1 증가"
                          onClick={() => onChangeOt(r.id, round1(r.ot + 0.1))}
                        >
                          +
                        </button>
                      </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Actions (moved under '업무' section / table) */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div />

        <div className="flex items-center gap-2">
          <button
            className="ui-btn ui-btn-primary h-10 px-4 disabled:opacity-60"
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
          </button>
        </div>
      </div>
    </div>
  );
}