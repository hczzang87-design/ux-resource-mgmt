"use client";

import { useMemo, useState } from "react";
import type { TimeEntry } from "@/features/time-entries/types";
import { useDraft } from "@/features/time-entries/hooks/useDraft";
import {
  getWeekStartMonday,
  getWorkingDatesMonToFri,
} from "@/features/time-entries/hooks/useWeekRange";
import { TimeEntryGrid } from "@/features/time-entries/components/TimeEntryGrid";
import { DraftPanel } from "@/features/time-entries/components/DraftPanel";
import { SaveBar } from "@/features/time-entries/components/SaveBar";

export default function MainWeekClient({
  baseEntries,
}: {
  baseEntries: TimeEntry[];
}) {
  const [memberName, setMemberName] = useState("Tori");
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStartMonday(new Date())
  );

  const weekDates = useMemo(
    () => getWorkingDatesMonToFri(weekStart),
    [weekStart]
  );

  const { merged, validationErrors, draftStats, actions } =
    useDraft(baseEntries);

  const [saving, setSaving] = useState(false);

  function shiftWeek(deltaWeeks: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaWeeks * 7);
    setWeekStart(d);
  }

  async function onSave() {
    // ✅ 다음 단계에서 실제 저장 API로 교체 예정
    // 지금은 “빌드/UX 흐름 확인”을 위해 draft만 reset
    setSaving(true);
    try {
      if (validationErrors.length > 0) {
        alert("저장 불가: 일일 합계가 1.0을 초과했어.");
        return;
      }
      actions.resetDraft();
      alert("저장 API 연결 전: draft만 초기화했어.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>
            리소스 매니지먼트
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
            주간은 월~일 기준이지만 입력은 워킹데이(월~금)만
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => shiftWeek(-1)}>← 이전 주</button>
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            {weekDates[0]} ~ {weekDates[4]}
          </div>
          <button onClick={() => shiftWeek(1)}>다음 주 →</button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 14 }}>멤버</label>
        <input
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          style={{
            padding: 8,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            width: 220,
          }}
        />
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <TimeEntryGrid
          memberName={memberName}
          weekDates={weekDates}
          mergedEntries={merged}
          onChangeMd={actions.setMd}
          onChangeOt={actions.setOvertime}
          onDelete={actions.deleteKey}
          onAddRow={(row) => {
            // 행 추가 = 해당 주 월~금에 기본 0 row 생성
            // (실제 값은 사용자가 입력하면서 채움)
            weekDates.forEach((date) => {
              const keySeed = {
                member_name: memberName,
                date,
                category: row.category,
                task_name: row.task_name,
              };
              // setMd는 key로 동작하므로 0으로 먼저 박아두기
              // (useDraft 내부가 key 기반이기 때문에 이렇게 맞춰줌)
              // key 생성은 TimeEntryGrid 내부와 동일하게 makeKey 로직을 사용함
              // => setMd에서 parseKey 하므로 seed값이 key로 잘 들어가야 함
              actions.setMd(
                `${memberName}|${date}|${row.category.replaceAll("|", "¦")}|${row.task_name.replaceAll("|", "¦")}`,
                0
              );
            });
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DraftPanel
            added={draftStats.added}
            edited={draftStats.edited}
            deleted={draftStats.deleted}
            errorsCount={validationErrors.length}
          />

          {validationErrors.length > 0 && (
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8, color: "crimson" }}>
                저장 불가 사유
              </div>
              {validationErrors.slice(0, 10).map((e, idx) => (
                <div key={idx}>
                  {e.member_name} / {e.date}: {e.totalMd} &gt; {e.limit}
                </div>
              ))}
              {validationErrors.length > 10 && <div>…</div>}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <SaveBar
          dirty={draftStats.dirty}
          saving={saving}
          errors={validationErrors}
          onSave={onSave}
          onReset={actions.resetDraft}
        />
      </div>
    </main>
  );
}