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

  // ✅ 서버에서 불러온 “이번 주” TimeEntry들 (멤버 전체일 수도 있음)
  savedEntries: TimeEntry[];

  // ✅ 저장 API 호출 (기존 app/page.tsx에서 내려주는 함수에 맞춰 연결)
  onSaveWeek: (memberName: string, entries: TimeEntry[]) => Promise<void>;

  // 아래는 기존 UI 유지용(있으면 보여주고 없으면 무시)
  savedMembers?: SavedMember[];
  onDeleteAll?: () => void;
};

type RowSeed = { task_name: string; category?: string };

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

  const { merged, actions } = useDraft(savedEntries);
  // “행 추가”로 만든 빈 행을 유지하기 위한 로컬 state
  const [rowSeeds, setRowSeeds] = useState<RowSeed[]>([]);

  // 칩으로 선택한 멤버의 entry만 화면에 사용 (멤버 필드 입력만으로는 불러오지 않음)
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

      // overtime 정책: 현재는 “월요일 entry에 모아 저장”이라고 했으니,
      // 화면에는 row 단위로 합산해서 보여주되, 수정은 월요일 key에 setOvertime 적용
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

  // ✅ 행 추가: 훅에 addRow가 없으므로 rowSeeds에만 추가
  const handleAddRow = (row: { task_name: string; category?: string }) => {
    const task_name = row.task_name.trim();
    if (!task_name) return;

    const id = makeRowId(task_name, row.category);
    setRowSeeds((prev) => {
      if (prev.some((p) => makeRowId(p.task_name, p.category) === id)) return prev;
      return [...prev, { task_name, category: row.category }];
    });
  };

  // 날짜별 MD 합계 1.0 제한 (해당 날짜 컬럼 세로 합이 1.0 초과 불가)
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
    const currentSum = entriesForDate.reduce(
      (sum, e) => sum + (Number(e.md) ?? 0),
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

  // ✅ overtime: setOvertime(key, overtime_md)
  // 정책상 월요일(weekDates[0])에 저장한다고 했으니 그 key로만 변경 적용
  const handleChangeOt = (rowId: string, nextOt: number) => {
    const name = memberName.trim();
    if (!name) return;

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

  const _handleReset = () => {
    actions.resetDraft();
    setRowSeeds([]); // “행 추가로 만든 빈 행”도 같이 초기화
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const name = memberName.trim();
    if (!name) return;

    setIsSaving(true);
    try {
      // merged는 draft 반영된 상태라고 가정
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

          {/* Member input: 입력만으로는 저장된 데이터를 불러오지 않음. 아래 칩 클릭 시 로드 */}
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
                멤버: <span className="font-medium text-zinc-800">{memberName || "—"}</span> · 월~금만 입력
              </p>
            </div>
          </div>

          {/* ✅ Draft 영역 제거 */}
          <TimeEntryGrid
            weekDates={weekDates}
            rows={rows}
            onChangeCell={handleChangeCell}
            onChangeOt={handleChangeOt}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </section>

        {/* Saved section (그대로 유지) */}
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

            {/* 칩 선택 시 해당 멤버 저장 데이터 테이블 */}
            {selectedMemberFromChip && currentEntries.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-zinc-700">
                  {selectedMemberFromChip} — 저장된 데이터
                </h4>
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="min-w-[400px] w-full border-collapse text-sm">
                    <thead className="bg-zinc-50">
                      <tr className="text-left text-xs text-zinc-600">
                        <th className="px-3 py-2">업무</th>
                        <th className="px-3 py-2">카테고리</th>
                        <th className="px-3 py-2">날짜</th>
                        <th className="px-3 py-2 w-16">md</th>
                        <th className="px-3 py-2 w-16">OT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEntries
                        .slice()
                        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.task_name ?? "").localeCompare(b.task_name ?? ""))
                        .map((e, i) => (
                          <tr key={e.date + (e.task_name ?? "") + (e.category ?? "") + i} className="border-t border-zinc-100">
                            <td className="px-3 py-2 font-medium text-zinc-900">{e.task_name ?? "—"}</td>
                            <td className="px-3 py-2 text-zinc-600">{e.category ?? "—"}</td>
                            <td className="px-3 py-2 text-zinc-600">{e.date ?? "—"}</td>
                            <td className="px-3 py-2 text-zinc-900">{Number(e.md ?? 0).toFixed(1)}</td>
                            <td className="px-3 py-2 text-zinc-900">{Number(e.overtime_md ?? 0).toFixed(1)}</td>
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