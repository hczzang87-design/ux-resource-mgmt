"use client";

import type { EntryKey, TimeEntry } from "../types";
import { makeKey } from "../lib/key";
const CATEGORY_OPTIONS = [
  "프로덕트 디자인",
  "외부 리퀘스트",
  "기타",
];

type Props = {
  memberName: string;
  weekDates: string[]; // Mon..Fri (YYYY-MM-DD)
  mergedEntries: TimeEntry[]; // draft merged 결과
  onChangeMd: (key: EntryKey, md: number) => void;
  onChangeOt: (key: EntryKey, overtime_md: number) => void;
  onDelete: (key: EntryKey) => void;
  onAddRow: (row: { category?: string; task_name: string }) => void;
};

type Row = {
  category?: string;
  task_name: string;
};

export function TimeEntryGrid({
  memberName,
  weekDates,
  mergedEntries,
  onChangeMd,
  onChangeOt,
  onDelete,
  onAddRow,
}: Props) {
  // 현재 멤버 + 현재 주(월~금)만 필터링
  const entries = mergedEntries.filter(
    (e) => e.member_name === memberName && weekDates.includes(e.date)
  );

  // 행(업무) 단위로 group: category+task_name
  const rowMap = new Map<string, Row>();
  for (const e of entries) {
    rowMap.set(`${e.category}||${e.task_name}`, { category: e.category, task_name: e.task_name });
  }
  const rows = Array.from(rowMap.values());

  // 그리드 조회용: key(member|date|cat|task) -> entry
  const cellMap = new Map<string, TimeEntry>();
  for (const e of entries) {
    cellMap.set(makeKey(e), e);
  }

  // 신규 row 입력 상태(간단)
  // (원하면 모달/인라인으로 확장 가능)
  let newCategory = "";
  let newTask = "";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>주간 입력</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            멤버: <b>{memberName}</b> · 월~금만 입력 (주말은 제외)
          </div>
        </div>
      </div>

      {/* Add row */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* 업무명 */}
          <input
            placeholder="업무명 (예: 리서치)"
            style={{
              padding: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              width: 260,
            }}
            onChange={(e) => (newTask = e.target.value)}
          />

          {/* ✅ 카테고리 드롭다운 */}
          <select
            defaultValue=""
            style={{
              padding: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              width: 180,
              fontSize: 14,
              background: "white",
            }}
            onChange={(e) => (newCategory = e.target.value)}
          >
            <option value="">카테고리 (선택)</option>
            <option value="프로덕트 디자인">프로덕트 디자인</option>
            <option value="외부 리퀘스트">외부 리퀘스트</option>
            <option value="기타">기타</option>
          </select>

          <button
            onClick={() => {
              const category = (newCategory || "").trim() || undefined; // ✅ optional 유지
              const task_name = (newTask || "").trim();
              if (!task_name) return;

              onAddRow({ category, task_name });

              // 입력값 초기화 (UX 개선)
              newTask = "";
              newCategory = "";
            }}
          >
            행 추가
          </button>
        </div>

      {/* Grid */}
      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={th}>카테고리</th>
              <th style={th}>업무</th>
              {weekDates.map((d) => (
                <th key={d} style={th}>
                  {d.slice(5)} <div style={{ fontSize: 11, opacity: 0.6 }}>md</div>
                </th>
              ))}
              <th style={th}>초과(overtime)</th>
              <th style={th}></th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={td} colSpan={weekDates.length + 5}>
                  아직 입력된 업무가 없어요. 위에서 행을 추가해줘.
                </td>
              </tr>
            )}

            {rows.map((r) => {
              // overtime은 업무(행) 단위 총합으로 편의상 보여주고 편집
              const otKey = makeKey({
                member_name: memberName,
                date: weekDates[0], // 대표키(ot를 행 단위로 저장하려면 schema가 바뀌어야 함)
                category: r.category,
                task_name: r.task_name,
              } as any);

              // ⚠️ 주의:
              // 현재 DB는 overtime_md가 "날짜별 row"에 붙어 있음.
              // UX에서 "행 단위 overtime"은 실제 저장 로직에서 날짜에 어떻게 분배할지 규칙이 필요함.
              // 일단 여기서는 "월요일 row에 overtime을 모아 저장"으로 단순화하고, 다음 단계에서 규칙을 개선.
              const otValue =
                cellMap.get(otKey)?.overtime_md ??
                0;

              return (
                <tr key={`${r.category}||${r.task_name}`}>
                  <td style={td}>{r.category}</td>
                  <td style={td}>{r.task_name}</td>

                  {weekDates.map((date) => {
                    const key = makeKey({
                      member_name: memberName,
                      date,
                      category: r.category,
                      task_name: r.task_name,
                    } as any);

                    const val = cellMap.get(key)?.md ?? 0;

                    return (
                      <td key={date} style={td}>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={1}
                          value={val}
                          onChange={(e) => onChangeMd(key, Number(e.target.value))}
                          style={num}
                        />
                      </td>
                    );
                  })}

                  <td style={td}>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={otValue}
                      onChange={(e) => onChangeOt(otKey, Number(e.target.value))}
                      style={num}
                    />
                  </td>

                  <td style={td}>
                    <button
                      onClick={() => {
                        // 행 삭제 = 해당 주의 모든 날짜 key 삭제
                        weekDates.forEach((date) => {
                          const key = makeKey({
                            member_name: memberName,
                            date,
                            category: r.category,
                            task_name: r.task_name,
                          } as any);
                          onDelete(key);
                        });
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        * overtime은 현재 “월요일 row에 모아 저장”으로 임시 처리중. (다음 단계에서 날짜 분배/별도 입력으로 개선 가능)
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #eee",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #f1f1f1",
  verticalAlign: "top",
  fontSize: 13,
};

const num: React.CSSProperties = {
  width: 80,
  padding: 6,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};