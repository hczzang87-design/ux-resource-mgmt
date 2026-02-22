"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { TimeEntry } from "@/features/time-entries/types";
import { useDraft } from "@/features/time-entries/hooks/useDraft";
import {
  getWeekStartMonday,
  getWorkingDatesMonToFri,
} from "@/features/time-entries/hooks/useWeekRange";
import { makeKey } from "@/features/time-entries/lib/key";

import { TimeEntryGrid } from "@/features/time-entries/components/TimeEntryGrid";
import { DraftPanel } from "@/features/time-entries/components/DraftPanel";
import { SaveBar } from "@/features/time-entries/components/SaveBar";

export default function MainWeekClient({ baseEntries }: { baseEntries: TimeEntry[] }) {
  const router = useRouter();

  const [memberName, setMemberName] = useState("Tori");     // ✅ 확정(적용) 값
  const [memberDraft, setMemberDraft] = useState("Tori");   // ✅ 입력 중 값

  const commitMember = () => {
    const next = memberDraft.trim();
    if (!next) return;          // 빈 값이면 적용 안 함(UX 안정)
    setMemberName(next);
  };
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStartMonday(new Date()));
  const [saving, setSaving] = useState(false);

  // ✅ 반드시 weekDates 라는 이름으로 유지
  const weekDates: string[] = useMemo(() => getWorkingDatesMonToFri(weekStart), [weekStart]);
   
  const from = weekDates[0];
  const to = weekDates[4];


  const { savedEntries, merged, validationErrors, draftStats, actions } = useDraft(baseEntries);

  function shiftWeek(deltaWeeks: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaWeeks * 7);
    setWeekStart(d);
  }

  async function onSave() {
    setSaving(true);
    try {
      // ✅ 0) 멤버 확정값 필수
      if (!memberName?.trim()) {
        alert("멤버 이름을 입력하고 적용한 뒤 저장해줘.");
        return;
      }
  
      // ✅ 1) 검증
      if (validationErrors.length > 0) {
        alert("저장 불가: 일일 합계가 1.0을 초과했어.");
        return;
      }

      // ✅ 2) 저장할 데이터: 현재 멤버 + 주간 범위만
      const toSave = merged.filter(
        (e) => e.member_name === memberName && e.date >= from && e.date <= to
      );
  
      const res = await fetch("/api/time-entries/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          member_name: memberName,
          entries: toSave,
        }),
      });
  
      // ✅ 3) 에러 처리 (응답이 비어있을 수도 있으니 안전하게)
      const json = await res
        .json()
        .catch(() => ({} as { error?: string }));
  
      if (!res.ok) throw new Error(json?.error ?? "save failed");
  
      // ✅ 4) 저장 성공 후: "새 세트 시작" UX 만들기
      actions.resetDraft();     // 현재 입력 그리드 초기화 (유지)
      setMemberDraft("");       // 다음 사람 입력 유도
      setMemberName("");        // 확정 멤버도 비움 (원하는 UX라면 이게 핵심)
  
      router.refresh();
      alert("저장 완료!");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0 }}>리소스 매니지먼트</h1>
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
          value={memberDraft}
          onChange={(e) => setMemberDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitMember();
          }}
          onBlur={commitMember}
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
            weekDates.forEach((date: string) => {
              const key = makeKey({
                member_name: memberName,
                date,
                category: row.category,
                task_name: row.task_name,
              });
              actions.setMd(key, 0);
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
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, fontSize: 12 }}>
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
  
      {/* ✅ 추가: 이번 주 저장된 멤버 섹션은 맨 아래 */}
      <div style={{ marginTop: 18 }}>
        <SavedWeekSection
          entries={savedEntries}
          from={from}
          to={to}
          onPickMember={(name) => {
            setMemberDraft(name);
            setMemberName(name);
          }}
          onClearAll={async () => {
            const ok = confirm("정말 이번 주 저장 데이터를 전부 삭제할까? (모든 멤버)");
            if (!ok) return;
  
            const res = await fetch("/api/time-entries/week", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ from, to }),
            });
  
            const json = await res.json().catch(() => ({} as any));
            if (!res.ok) {
              alert(json?.error ?? "전체 삭제 실패");
              return;
            }
  
            actions.resetDraft();
            router.refresh();
            alert("이번 주 저장 데이터 전체 삭제 완료");
          }}
        />
      </div>
    </main>
  );
}
function SavedWeekSection({
  entries,
  from,
  to,
  onPickMember,
  onClearAll,
}: {
  entries: TimeEntry[];
  from: string;
  to: string;
  onPickMember?: (name: string) => void;
  onClearAll?: () => void | Promise<void>;
}) {
  const week = useMemo(
    () => entries.filter((e) => e.date >= from && e.date <= to),
    [entries, from, to]
  );

  const byMember = useMemo(() => {
    const m = new Map<string, TimeEntry[]>();
    for (const e of week) {
      const arr = m.get(e.member_name) ?? [];
      arr.push(e);
      m.set(e.member_name, arr);
    }
    return m;
  }, [week]);

  const members = useMemo(() => Array.from(byMember.keys()).sort(), [byMember]);

  const Header = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 700 }}>이번 주 저장된 멤버</div>

      <button
        type="button"
        onClick={() => onClearAll?.()}
        disabled={!onClearAll || week.length === 0}
        style={{
          border: "1px solid #fca5a5",
          background: "white",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          cursor: !onClearAll || week.length === 0 ? "not-allowed" : "pointer",
          opacity: !onClearAll || week.length === 0 ? 0.5 : 1,
        }}
        title="이번 주 저장된 모든 멤버 데이터를 삭제"
      >
        전체 삭제
      </button>
    </div>
  );

  if (members.length === 0) {
    return (
      <div
        style={{
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#fafafa",
        }}
      >
        {Header}
        <div style={{ fontSize: 13, color: "#52525b" }}>아직 저장된 멤버가 없어.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      {Header}

      {/* 멤버 칩 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {members.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onPickMember?.(name)}
            style={{
              border: "1px solid #e5e7eb",
              background: "white",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 13,
              cursor: onPickMember ? "pointer" : "default",
            }}
            title={onPickMember ? "클릭하면 멤버 입력에 불러오기" : undefined}
          >
            {name} <span style={{ color: "#71717a" }}>({byMember.get(name)?.length ?? 0})</span>
          </button>
        ))}
      </div>

      {/* 멤버별 간단 요약 */}
      <div style={{ display: "grid", gap: 10 }}>
        {members.map((name) => {
          const list = byMember.get(name) ?? [];
          const md = list.reduce((acc, e) => acc + Number(e.md ?? 0), 0);
          const ot = list.reduce((acc, e) => acc + Number(e.overtime_md ?? 0), 0);

          return (
            <div
              key={name}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{name}</div>
                <div style={{ fontSize: 13, color: "#52525b" }}>
                  MD {Math.round(md * 10) / 10} · OT {Math.round(ot * 10) / 10}
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "#71717a" }}>
                (상세는 다음 단계에서 멤버 카드/테이블로 확장 가능)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}