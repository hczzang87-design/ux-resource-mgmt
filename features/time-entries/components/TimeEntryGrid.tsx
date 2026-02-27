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
  canSave
  
}: Props) {
  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");

  const headerDates = useMemo(
    () =>
      weekDates.map((d) => ({
        iso: d,
        mmdd: d.slice(5),
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

  return (
    <div className="mt-3">
      {/* Add row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-10 w-full max-w-[520px] rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="업무명 (예: 리서치)"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
        />

        <select
          className="h-10 w-[180px] rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        >
          <option value="">카테고리 (선택)</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          onClick={() => {
            const task_name = newTask.trim();
            if (!task_name) return;

            const category = newCategory.trim() || undefined;
            onAddRow({ task_name, category });

            setNewTask("");
            setNewCategory("");
          }}
        >
          행 추가
        </button>
      </div>

      {/* Table */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-[980px] w-full border-collapse">
          <thead className="bg-zinc-50">
            <tr className="text-left text-xs text-zinc-600">
              <th className="px-2 py-3 w-[48px]"></th>
              <th className="px-4 py-3 w-[260px]">업무</th>
              <th className="px-4 py-3 w-[160px]">카테고리</th>
              <th className="px-4 py-3 w-[90px]">총 md</th>

              {headerDates.map((d) => (
                <th key={d.iso} className="px-4 py-3 w-[90px]">
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium text-zinc-800">{d.mmdd}</span>
                    <span className="text-[10px] text-zinc-500">md</span>
                  </div>
                </th>
              ))}

              <th className="px-4 py-3 w-[110px]">초과(overtime)</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-500" colSpan={4 + weekDates.length + 1}>
                  변경사항 없음
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
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{r.task_name}</td>

                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-1 text-xs">
                        {r.category || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-900">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{total}</span>
                        <span className="text-[10px] text-zinc-500">md</span>
                      </div>
                    </td>

                    {weekDates.map((d) => {
                      const v = r.mdByDate[d] ?? 0;

                      return (
                        <td key={d} className="px-4 py-3">
                          <div className="flex w-[88px] items-center gap-0.5 rounded-lg border border-zinc-200 bg-white">
                            <button
                              type="button"
                              className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                              title="0.1 감소"
                              onClick={() => onChangeCell(r.id, d, Math.max(0, round1(v - 0.1)))}
                            >
                              −
                            </button>
                            <span className="min-w-8 flex-1 text-center text-sm font-medium text-zinc-900">
                              {v.toFixed(1)}
                            </span>
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
                      <div className="flex w-[100px] items-center gap-0.5 rounded-lg border border-zinc-200 bg-white">
                        <button
                          type="button"
                          className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          title="0.1 감소"
                          onClick={() => onChangeOt(r.id, Math.max(0, round1(r.ot - 0.1)))}
                        >
                          −
                        </button>
                        <span className="min-w-10 flex-1 text-center text-sm font-medium text-zinc-900">
                          {r.ot.toFixed(1)}
                        </span>
                        <button
                          type="button"
                          className="flex h-8 w-7 shrink-0 items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          title="0.1 증가"
                          onClick={() => onChangeOt(r.id, round1(r.ot + 0.1))}
                        >
                          +
                        </button>
                      </div>
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
        <div className="flex flex-col gap-1 text-xs text-zinc-500">
          <p>* 날짜별 md 합계는 1.0 초과 불가.</p>
          <p>* 초과(OT)는 제한 없음.</p>
          <p>* overtime은 현재 “월요일 row에 모아 저장”으로 임시 처리 중(다음 단계에서 날짜 분배/별도 입력 개선 가능)</p>
        </div>

        <div className="flex items-center gap-2">
        <button
              className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              onClick={onSave}
              disabled={isSaving || canSave === false}
            >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}