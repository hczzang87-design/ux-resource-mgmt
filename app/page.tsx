"use client";

import { useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  created_at: string;
  member_name: string;
  date: string; // YYYY-MM-DD
  category: string;
  task_name: string;
  md: number;
  overtime_md: number;
};

type DayIdx = 0 | 1 | 2 | 3 | 4;

type DraftTask = {
  task_name: string;
  category: string; // optional UX지만 DB는 not null -> 기본값 "기타"로 처리
  mdByDay: [number, number, number, number, number]; // Mon..Fri
  overtime_total: number; // 업무(행) 단위 초과
};

const DAYS: { idx: DayIdx; label: string }[] = [
  { idx: 0, label: "월" },
  { idx: 1, label: "화" },
  { idx: 2, label: "수" },
  { idx: 3, label: "목" },
  { idx: 4, label: "금" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// 로컬 기준 "해당 주 월요일" 계산
function getMonday(d = new Date()) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const day = dt.getDay(); // Sun 0 ... Sat 6
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function round1(n: number) {
  // 0.1 단위 라운딩
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

export default function Home() {
  const [memberName, setMemberName] = useState("Tori");

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date())); // Monday
  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart]); // Friday

  const from = useMemo(() => toYYYYMMDD(weekStart), [weekStart]);
  const to = useMemo(() => toYYYYMMDD(weekEnd), [weekEnd]);
  const weekLabel = useMemo(() => `${from} ~ ${to}`, [from, to]);

  const [draft, setDraft] = useState<DraftTask[]>([
    { task_name: "", category: "", mdByDay: [0, 0, 0, 0, 0], overtime_total: 0 },
  ]);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function dateForDay(day: DayIdx) {
    return toYYYYMMDD(addDays(weekStart, day));
  }

  const dateLabelByDay = useMemo(() => {
    return DAYS.map((d) => dateForDay(d.idx).slice(5)); // MM-DD
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function fetchEntries() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ member: memberName, from, to });
      const res = await fetch(`/api/entries?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load entries");
      setEntries(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!memberName.trim()) return;
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberName, from, to]);

  function addTaskRow() {
    setDraft((prev) => [
      ...prev,
      { task_name: "", category: "", mdByDay: [0, 0, 0, 0, 0], overtime_total: 0 },
    ]);
  }

  function removeTaskRow(idx: number) {
    setDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function updateTask(idx: number, patch: Partial<DraftTask>) {
    setDraft((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function updateCell(idx: number, day: DayIdx, value: number) {
    setDraft((prev) =>
      prev.map((t, i) => {
        if (i !== idx) return t;
        const next = [...t.mdByDay] as DraftTask["mdByDay"];
        // 0~1.0, 0.1 단위
        next[day] = round1(clamp(value, 0, 1.0));
        return { ...t, mdByDay: next };
      })
    );
  }

  // 기존 데이터(이번 주) 요일별 합계
  const existingDayTotals = useMemo(() => {
    const totals: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const e of entries) {
      const idx = DAYS.findIndex((d) => dateForDay(d.idx) === e.date);
      if (idx >= 0) {
        totals[idx] = round2(totals[idx] + Number(e.md || 0)); // 초과는 근무시간 제한에 포함할지 애매 → 여기서는 md만 제한 기준으로 봄
      }
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, from, to]);

  // 신규 입력(드래프트) 요일별 합계
  const draftDayTotals = useMemo(() => {
    const totals: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const t of draft) {
      for (let i = 0; i < 5; i++) {
        totals[i] = round2(totals[i] + Number(t.mdByDay[i] || 0));
      }
    }
    return totals;
  }, [draft]);

  // 합산(기존 + 신규) 기준으로 1.0 제한 검사
  const combinedDayTotals = useMemo(() => {
    const totals: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) {
      totals[i] = round2((existingDayTotals[i] || 0) + (draftDayTotals[i] || 0));
    }
    return totals;
  }, [existingDayTotals, draftDayTotals]);

  const dayOverLimit = useMemo(() => {
    return combinedDayTotals.map((t) => t > 1.0 + 1e-9);
  }, [combinedDayTotals]);

  const hasAnyDraft = useMemo(() => {
    return draft.some((t) => t.task_name.trim() && sum(t.mdByDay) > 0);
  }, [draft]);

  const canSave = useMemo(() => {
    if (!memberName.trim()) return false;
    if (!hasAnyDraft) return false;
    if (dayOverLimit.some(Boolean)) return false;

    // 최소 검증: 업무명 있는 행은 md 합이 > 0 이어야 함
    for (const t of draft) {
      if (!t.task_name.trim()) continue;
      if (!(sum(t.mdByDay) > 0)) return false;
      if (t.overtime_total < 0) return false;
    }
    return true;
  }, [memberName, hasAnyDraft, dayOverLimit, draft]);

  async function onSave() {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    try {
      const bulk = draft
        .filter((t) => t.task_name.trim() && sum(t.mdByDay) > 0)
        .flatMap((t) => {
          const category = (t.category || "").trim() || "기타";
          const taskName = t.task_name.trim();
          const mdTotal = sum(t.mdByDay);
          const otTotal = Number(t.overtime_total || 0);

          // 초과는 "업무 단위" → md 비율대로 분배(해당 업무가 있는 요일에만)
          // (mdTotal이 0이면 여기 들어오지 않음)
          const rows: {
            date: string;
            category: string;
            task_name: string;
            md: number;
            overtime_md: number;
          }[] = [];

          // 분배 오차를 줄이기 위해 마지막 날에 잔여를 몰아줌
          let otLeft = otTotal;

          const nonZeroDays = t.mdByDay
            .map((v, i) => ({ v: Number(v || 0), i }))
            .filter((x) => x.v > 0);

          nonZeroDays.forEach((x, idx) => {
            const date = dateForDay(x.i as DayIdx);
            const md = round2(x.v);
            let overtime_md = 0;

            if (otTotal > 0) {
              if (idx === nonZeroDays.length - 1) {
                overtime_md = round2(otLeft);
              } else {
                const share = (otTotal * x.v) / mdTotal;
                overtime_md = round2(share);
                otLeft = round2(otLeft - overtime_md);
              }
            }

            rows.push({ date, category, task_name: taskName, md, overtime_md });
          });

          return rows;
        });

      const payload = { member_name: memberName.trim(), entries: bulk };

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error ?? `Failed to save (status ${res.status})`);

      // 초기화
      setDraft([{ task_name: "", category: "", mdByDay: [0, 0, 0, 0, 0], overtime_total: 0 }]);
      await fetchEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteEntry(id: string) {
    const ok = confirm("이 항목을 삭제할까요?");
    if (!ok) return;

    setError(null);
    try {
      const res = await fetch(`/api/entries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error ?? `Failed to delete (status ${res.status})`);
      await fetchEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  const entriesSorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.date === b.date) return b.created_at.localeCompare(a.created_at);
      return a.date.localeCompare(b.date);
    });
  }, [entries]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">주간 업무 입력</h1>
          <p className="text-sm text-zinc-600">
            0.1md = 1시간 · 하루 최대 1.0md(8시간 기준)
          </p>
        </header>

        {/* 상단 설정 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <div className="text-sm font-medium">이름</div>
              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="예: Tori"
              />
            </label>

            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-medium">주간 범위 (월~금)</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setWeekStart(getMonday(new Date(e.target.value)))}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                  title="아무 날짜를 선택해도 해당 주의 월요일로 자동 보정돼요"
                />
                <button
                  onClick={() => setWeekStart((d) => addDays(d, -7))}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  이전 주
                </button>
                <button
                  onClick={() => setWeekStart(() => getMonday(new Date()))}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  이번 주
                </button>
                <button
                  onClick={() => setWeekStart((d) => addDays(d, 7))}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  다음 주
                </button>
                <span className="rounded-xl bg-zinc-100 px-3 py-2 text-sm">{weekLabel}</span>
              </div>
            </div>
          </div>

          {/* 요일 합계(검증용) */}
          <div className="mt-4 rounded-xl border border-zinc-200 p-3">
            <div className="text-sm font-medium">요일별 합계(검증)</div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {DAYS.map((d, i) => {
                const over = dayOverLimit[i];
                return (
                  <div
                    key={d.idx}
                    className={`rounded-xl border p-2 text-center ${
                      over ? "border-red-300 bg-red-50" : "border-zinc-200"
                    }`}
                  >
                    <div className="text-sm font-medium">
                      {d.label} <span className="text-xs text-zinc-500">({dateLabelByDay[i]})</span>
                    </div>
                    <div className={`mt-1 text-sm ${over ? "text-red-700" : "text-zinc-700"}`}>
                      {combinedDayTotals[i]} / 1.0
                    </div>
                    {over && <div className="text-xs text-red-700">초과</div>}
                  </div>
                );
              })}
            </div>
            {dayOverLimit.some(Boolean) && (
              <div className="mt-2 text-sm text-red-700">
                하루 총합이 1.0을 초과한 요일이 있어 저장할 수 없어요.
              </div>
            )}
          </div>
        </section>

        {/* 입력 테이블 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">업무 입력</h2>
            <button
              onClick={addTaskRow}
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              + 업무 추가
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-sm text-zinc-600">
                  <th className="sticky left-0 z-10 bg-white border-b border-zinc-200 p-2 w-[320px]">
                    업무
                  </th>
                  {DAYS.map((d, i) => (
                    <th key={d.idx} className="border-b border-zinc-200 p-2 w-[100px] text-center">
                      {d.label}
                      <div className="text-xs text-zinc-400">{dateLabelByDay[i]}</div>
                    </th>
                  ))}
                  <th className="border-b border-zinc-200 p-2 w-[90px] text-center">합계</th>
                  <th className="border-b border-zinc-200 p-2 w-[120px] text-center">초과</th>
                  <th className="border-b border-zinc-200 p-2 w-[110px] text-center">카테고리</th>
                  <th className="border-b border-zinc-200 p-2 w-[80px] text-center">삭제</th>
                </tr>
              </thead>

              <tbody>
                {draft.map((t, rowIdx) => {
                  const rowSum = round2(sum(t.mdByDay));
                  return (
                    <tr key={rowIdx} className="text-sm">
                      {/* 업무명(고정) */}
                      <td className="sticky left-0 z-10 bg-white border-b border-zinc-100 p-2 align-top">
                        <input
                          value={t.task_name}
                          onChange={(e) => updateTask(rowIdx, { task_name: e.target.value })}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
                          placeholder="예: 대시보드 설계"
                        />
                      </td>

                      {/* 월~금 */}
                      {DAYS.map((d) => (
                        <td key={d.idx} className="border-b border-zinc-100 p-2 text-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1.0"
                            value={t.mdByDay[d.idx] || 0}
                            onChange={(e) => updateCell(rowIdx, d.idx, Number(e.target.value))}
                            className="w-20 rounded-xl border border-zinc-200 px-2 py-2 text-center outline-none focus:ring-2 focus:ring-zinc-300"
                            title="0.1md = 1시간, 최대 1.0"
                          />
                          <div className="mt-1 flex justify-center gap-1">
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
                              onClick={() =>
                                updateCell(rowIdx, d.idx, (t.mdByDay[d.idx] || 0) + 0.1)
                              }
                              title="+0.1 (1시간)"
                            >
                              +0.1
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
                              onClick={() =>
                                updateCell(rowIdx, d.idx, (t.mdByDay[d.idx] || 0) - 0.1)
                              }
                              title="-0.1"
                            >
                              -0.1
                            </button>
                          </div>
                        </td>
                      ))}

                      {/* 합계 */}
                      <td className="border-b border-zinc-100 p-2 text-center align-top">
                        <div className="mt-2 font-medium">{rowSum}</div>
                        <div className="text-xs text-zinc-500">m/d</div>
                      </td>

                      {/* 초과(업무 단위) */}
                      <td className="border-b border-zinc-100 p-2 text-center align-top">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={t.overtime_total || 0}
                          onChange={(e) =>
                            updateTask(rowIdx, { overtime_total: Math.max(0, Number(e.target.value)) })
                          }
                          className="w-24 rounded-xl border border-zinc-200 px-2 py-2 text-center outline-none focus:ring-2 focus:ring-zinc-300"
                          title="업무 단위 초과(제한 없음). 저장 시 해당 업무의 md 비율로 요일에 분배돼요."
                        />
                      </td>

                      {/* 카테고리(옵션) */}
                      <td className="border-b border-zinc-100 p-2 text-center align-top">
                        <input
                          value={t.category}
                          onChange={(e) => updateTask(rowIdx, { category: e.target.value })}
                          className="w-24 rounded-xl border border-zinc-200 px-2 py-2 text-center outline-none focus:ring-2 focus:ring-zinc-300"
                          placeholder="(옵션)"
                        />
                        <div className="mt-1 text-xs text-zinc-500">미입력 시 기타</div>
                      </td>

                      {/* 삭제 */}
                      <td className="border-b border-zinc-100 p-2 text-center align-top">
                        <button
                          type="button"
                          onClick={() => removeTaskRow(rowIdx)}
                          disabled={draft.length === 1}
                          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title={draft.length === 1 ? "최소 1줄은 남겨야 해요" : "행 삭제"}
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

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={!canSave || saving}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "저장 중..." : "주간 저장"}
            </button>
            {!hasAnyDraft && (
              <span className="text-sm text-zinc-600">
                업무명 + 요일 md를 입력하면 저장할 수 있어요.
              </span>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        {/* 이번 주 입력 목록 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">이번 주 입력 목록</h2>
              <div className="text-sm text-zinc-600">
                <span className="font-medium">{memberName}</span> · {weekLabel}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {loading && <span className="text-sm text-zinc-600">불러오는 중...</span>}
              <button
                onClick={fetchEntries}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                새로고침
              </button>
            </div>
          </div>

          {entriesSorted.length === 0 ? (
            <div className="text-sm text-zinc-600">이번 주 데이터가 없어요.</div>
          ) : (
            <div className="space-y-2">
              {entriesSorted.map((e) => (
                <div key={e.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[260px] flex-1 font-medium">{e.task_name}</div>
                    <div className="flex items-center gap-2 text-zinc-600">
                      <span>
                        md {e.md} / 초과 {e.overtime_md}
                      </span>
                      <button
                        onClick={() => onDeleteEntry(e.id)}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-zinc-600">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                      {e.date.slice(5)}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                      {e.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
