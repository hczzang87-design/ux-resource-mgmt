"use client";

import React, { useMemo, useState } from "react";

import TimeEntryGrid from "../features/time-entries/components/TimeEntryGrid";
import { useDraft } from "../features/time-entries/hooks/useDraft";
import { makeKey } from "../features/time-entries/lib/key";
import type { TimeEntry } from "../features/time-entries/types";

type SavedMember = { member_name: string; mdTotal: number; otTotal: number };

type Props = {
  weekDates: string[]; // ["2026-02-23", ...] (월~금)
  weekRangeLabel: string; // "2026-02-23 ~ 2026-02-27"
  onPrevWeek: () => void;
  onNextWeek: () => void;

  // 서버에서 불러온 “이번 주” TimeEntry들
  savedEntries: TimeEntry[];

  // 저장 API 호출
  onSaveWeek: (memberName: string, entries: TimeEntry[]) => Promise<void>;

  // 기존 UI 유지용
  savedMembers?: SavedMember[];
  onDeleteAll?: () => void;
};

type RowSeed = { task_name: string; category?: string };

// ✅ Refactoring: SummaryRow 타입을 컴포넌트 밖으로 분리
type SummaryRow = {
  task_name: string;
  category?: string;
  totalMd: number;
  totalOt: number;
};

// rowId는 훅 key랑 분리(단순 row grouping key)
function makeRowId(task_name: string, category?: string) {
  return `${task_name}|||${category ?? ""}`;
}

function parseRowId(rowId: string): { task_name: string; category?: string } {
  const [task_name, cat] = rowId.split("|||");
  return { task_name, category: cat ? cat : undefined };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function MainWeekClient({
  weekDates,
  weekRangeLabel,
  onPrevWeek,
  onNextWeek,
  savedEntries,
  onSaveWeek,
  savedMembers = [],
  onDeleteAll,
}: Props) {
  const [memberName, setMemberName] = useState("");
  const [selectedMemberFromChip, setSelectedMemberFromChip] = useState<string | null>(null);

  const { merged, actions, draftStats } = useDraft(savedEntries);
  const [rowSeeds, setRowSeeds] = useState<RowSeed[]>([]);
  
  // ✅ isSaving을 canSave보다 먼저 선언
  const [isSaving, setIsSaving] = useState(false); 

  const hasMember = memberName.trim().length > 0;
  const hasChanges = draftStats.dirty || rowSeeds.length > 0;
  
  // ✅ 저장 중이 아닐 때(!isSaving) 저장할 수 있도록 논리 수정
  const canSave = hasMember && hasChanges && !isSaving;

  // 칩으로 선택한 멤버의 entry만 화면에 사용
  const activeMember = selectedMemberFromChip || memberName.trim() || null;
  const currentEntries = useMemo(() => {
    if (!activeMember) return [] as TimeEntry[];
    return merged.filter(
      (e) =>
        e.member_name === activeMember &&
        e.date &&
        weekDates.includes(e.date) &&
        typeof e.task_name === "string"
    );
  }, [merged, activeMember, weekDates]);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();

    for (const e of currentEntries) {
      const task = e.task_name ?? "—";
      const cat = e.category ?? undefined;

      // 같은 업무+카테고리는 합산
      const key = `${task}|||${cat ?? ""}`;

      if (!map.has(key)) {
        map.set(key, { task_name: task, category: cat, totalMd: 0, totalOt: 0 });
      }

      const row = map.get(key)!;
      row.totalMd += Number(e.md ?? 0);
      row.totalOt += Number(e.overtime_md ?? 0);
    }

    // ✅ Refactoring: 중복 선언되어 있던 round1 함수 제거하고 외부 함수 사용
    return Array.from(map.values()).map((r) => ({
      ...r,
      totalMd: round1(r.totalMd),
      totalOt: round1(r.totalOt),
    }));
  }, [currentEntries]);

  // task+category별로 rows 구성 (총md/요일/ot 표시용)
  const rows = useMemo(() => {
    if (!activeMember) {
      // 멤버 입력 전에도 “행 추가”한 rowSeeds는 보여주게
      return rowSeeds.map((s) => ({
        id: makeRowId(s.task_name, s.category),
        task_name: s.task_name,
        category: s.category,
        mdByDate: Object.fromEntries(weekDates.map((d) => [d, 0])),
        ot: 0,
      }));
    }
    // 1) entries로부터 그룹 만들기
    const byRow = new Map<
      string,
      {
        id: string;
        task_name: string;
        category?: string;
        mdByDate: Record<string, number>;
        ot: number;
      }
    >();

    for (const e of currentEntries) {
      const rowId = makeRowId(e.task_name, e.category ?? undefined);
      if (!byRow.has(rowId)) {
        byRow.set(rowId, {
          id: rowId,
          task_name: e.task_name,
          category: e.category ?? undefined,
          mdByDate: Object.fromEntries(weekDates.map((d) => [d, 0])),
          ot: 0,
        });
      }
      const row = byRow.get(rowId)!;

      // md
      if (e.date && weekDates.includes(e.date)) {
        row.mdByDate[e.date] = round1((row.mdByDate[e.date] ?? 0) + (e.md ?? 0));
      }

      // overtime 정책: 현재는 “월요일 entry에 모아 저장”
      row.ot = round1(row.ot + (e.overtime_md ?? 0));
    }

    // 2) rowSeeds로 “빈 행”도 포함시키기
    for (const s of rowSeeds) {
      const rowId = makeRowId(s.task_name, s.category);
      if (!byRow.has(rowId)) {
        byRow.set(rowId, {
          id: rowId,
          task_name: s.task_name,
          category: s.category,
          mdByDate: Object.fromEntries(weekDates.map((d) => [d, 0])),
          ot: 0,
        });
      }
    }

    return Array.from(byRow.values());
  }, [currentEntries, rowSeeds, weekDates, activeMember]);

  // 행 추가
  const handleAddRow = (row: { task_name: string; category?: string }) => {
    const task_name = row.task_name.trim();
    if (!task_name) return;

    const id = makeRowId(task_name, row.category);
    setRowSeeds((prev) => {
      if (prev.some((p) => makeRowId(p.task_name, p.category) === id)) return prev;
      return [...prev, { task_name, category: row.category }];
    });
  };

  // 날짜별 MD 합계 1.0 제한
  const handleChangeCell = (rowId: string, date: string, nextMd: number) => {
    const name = memberName.trim();
    if (!name) return;

    const { task_name, category } = parseRowId(rowId);
    const cat = category ?? "";

    const key = makeKey({
      member_name: name,
      date,
      task_name,
      category: cat,
    });

    const entriesForDate = merged.filter(
      (e) => e.member_name === name && e.date === date
    );
    
    // ✅ Bug Fix: Number(e.md ?? 0) 로 괄호 위치를 수정하여 NaN 오류 방지
    const currentSum = entriesForDate.reduce(
      (sum, e) => sum + Number(e.md ?? 0),
      0
    );
    
    const normCat = cat || "기타";
    const currentCellEntry = merged.find(
      (e) =>
        e.member_name === name &&
        e.date === date &&
        (e.task_name ?? "") === task_name &&
        (e.category ?? "기타") === normCat
    );
    const currentCellNum = Number(currentCellEntry?.md ?? 0);

    const maxAllowed = round1(
      Math.max(0, 1.0 - round1(currentSum - currentCellNum))
    );
    const clamped = round1(Math.max(0, Math.min(nextMd, maxAllowed)));

    actions.setMd(key, clamped);
  };

  // overtime 저장 로직
  const handleChangeOt = (rowId: string, nextOt: number) => {
    const name = memberName.trim();
    if (!name) return;
    
    // ✅ Safety: weekDates 배열이 비어있을 경우에 대한 방어 로직 추가
    if (!weekDates.length) return;

    const monday = weekDates[0];
    const { task_name, category } = parseRowId(rowId);

    const key = makeKey({
      member_name: name,
      date: monday,
      task_name,
      category: category ?? "",
    });

    actions.setOvertime(key, nextOt);
  };

  const handleDeleteRow = (rowId: string) => {
    const name = memberName.trim();
    const { task_name, category } = parseRowId(rowId);
    const cat = category ?? "";
    if (name) {
      for (const date of weekDates) {
        actions.deleteKey(makeKey({ member_name: name, date, task_name, category: cat }));
      }
    }
    setRowSeeds((prev) => prev.filter((s) => makeRowId(s.task_name, s.category) !== rowId));
  };

  // ✅ Refactoring: 데드 코드였던 _handleReset 함수 제거


  const handleSave = async () => {
    const name = memberName.trim();
    if (!name) return;

    setIsSaving(true);
    try {
      const entriesToSave = merged.filter(
        (e) => e.member_name === name && e.date && weekDates.includes(e.date)
      );
      await onSaveWeek(name, entriesToSave);
      actions.resetDraft();
      setRowSeeds([]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
                리소스 매니지먼트
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                주간은 월~일 기준이지만 입력은 워킹데이(월~금)만
              </p>
            </div>
  
            <div className="flex items-center gap-3">
              <button
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
                onClick={onPrevWeek}
              >
                ← 이전 주
              </button>
              <div className="text-sm font-medium text-zinc-800">{weekRangeLabel}</div>
              <button
                className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
                onClick={onNextWeek}
              >
                다음 주 →
              </button>
            </div>
          </div>

          {/* Member input */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-zinc-800">멤버</label>
            <input
              className="h-10 w-[220px] rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="예: 최현철"
              value={memberName}
              onChange={(e) => {
                setMemberName(e.target.value);
                setSelectedMemberFromChip(null);
              }}
            />
          </div>
        </div>

        {/* Weekly input */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">주간 입력</h2>
              <p className="mt-1 text-sm text-zinc-500">
                멤버:{" "}
                <span className="font-medium text-zinc-800">{memberName || "—"}</span> · 월~금만 입력
              </p>
            </div>
          </div>

          <TimeEntryGrid
            weekDates={weekDates}
            rows={rows}
            onChangeCell={handleChangeCell}
            onChangeOt={handleChangeOt}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            onSave={handleSave}
            isSaving={isSaving}
            canSave={canSave}
          />
        </section>

        {/* Saved section */}
        <section className="mt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900">이번 주 저장된 멤버</h3>
            </div>

            {onDeleteAll && (
              <button
                className="h-9 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                onClick={onDeleteAll}
              >
                전체 삭제
              </button>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4">
            {savedMembers.length === 0 ? (
              <div className="text-sm text-zinc-500">저장된 멤버가 없습니다.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {savedMembers.map((m) => (
                  <button
                    key={m.member_name}
                    type="button"
                    onClick={() => {
                      setSelectedMemberFromChip(m.member_name);
                      setMemberName(m.member_name);
                    }}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                      selectedMemberFromChip === m.member_name
                        ? "border-zinc-900 bg-zinc-100 ring-2 ring-zinc-400"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <span className="font-medium text-zinc-900">{m.member_name}</span>
                    <span className="text-zinc-500">MD {m.mdTotal}</span>
                    <span className="text-zinc-500">OT {m.otTotal}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ✅ Feature: 업무 요약 테이블 UI 구현 */}
            {summaryRows.length > 0 && activeMember && (
              <div className="mt-6 border-t border-zinc-200 pt-4">
                <h4 className="mb-3 text-sm font-bold text-zinc-800">
                  {activeMember}님의 업무 요약
                </h4>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">업무명</th>
                        <th className="px-4 py-2 font-medium">카테고리</th>
                        <th className="px-4 py-2 text-right font-medium">MD 합계</th>
                        <th className="px-4 py-2 text-right font-medium">OT 합계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {summaryRows.map((row) => (
                        <tr key={`${row.task_name}|||${row.category}`}>
                          <td className="px-4 py-2 text-zinc-900">{row.task_name}</td>
                          <td className="px-4 py-2 text-zinc-500">{row.category || "—"}</td>
                          <td className="px-4 py-2 text-right font-medium text-zinc-900">
                            {row.totalMd}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-zinc-900">
                            {row.totalOt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}