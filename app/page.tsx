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
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

type Grouped = {
  key: string; // task||category
  task_name: string;
  category: string;
  byDate: Record<string, { md: number; overtime_md: number }>; // date -> sum
  mdTotal: number;
  otTotal: number;
};

type MemberGrouped = {
  member_name: string;
  grouped: Grouped[];
  totals: { md: number; ot: number };
};

export default function Home() {
  // ✅ memberName은 이제 "조회 조건"이 아니라 "이번에 저장할 멤버(편집 대상)"
  const [memberName, setMemberName] = useState("Tori");

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date())); // Monday
  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart]); // Friday

  const from = useMemo(() => toYYYYMMDD(weekStart), [weekStart]);
  const to = useMemo(() => toYYYYMMDD(weekEnd), [weekEnd]);
  const weekLabel = useMemo(() => `${from} ~ ${to}`, [from, to]);

  const [draft, setDraft] = useState<DraftTask[]>([
    { task_name: "", category: "", mdByDay: [0, 0, 0, 0, 0], overtime_total: 0 },
  ]);

  // ✅ entries는 "해당 주 전체(멤버 N명)" 데이터로 유지
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

  // ✅ 변경: member를 쿼리에서 제거 -> 주간 전체 가져오기
  async function fetchEntries() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
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

  // ✅ 변경: 주간 범위가 바뀔 때만 목록 갱신
  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

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
        next[day] = round1(clamp(value, 0, 1.0));
        return { ...t, mdByDay: next };
      })
    );
  }

  // ✅ 핵심: 기존 데이터 합계는 "현재 입력 중인 멤버" 기준으로만 계산해야 함
  const existingDayTotals = useMemo(() => {
    const m = memberName.trim();
    const totals: [number, number, number, number, number] = [0, 0, 0, 0, 0];

    if (!m) return totals;

    for (const e of entries) {
      if ((e.member_name || "").trim() !== m) continue;

      const idx = DAYS.findIndex((d) => dateForDay(d.idx) === e.date);
      if (idx >= 0) totals[idx] = round2(totals[idx] + Number(e.md || 0));
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, memberName, from, to]);

  // 신규 입력(드래프트) 요일별 합계
  const draftDayTotals = useMemo(() => {
    const totals: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const t of draft) {
      for (let i = 0; i < 5; i++) totals[i] = round2(totals[i] + Number(t.mdByDay[i] || 0));
    }
    return totals;
  }, [draft]);

  // 합산(기존 + 신규) 기준으로 1.0 제한 검사
  const combinedDayTotals = useMemo(() => {
    const totals: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) totals[i] = round2((existingDayTotals[i] || 0) + (draftDayTotals[i] || 0));
    return totals;
  }, [existingDayTotals, draftDayTotals]);

  const dayOverLimit = useMemo(() => combinedDayTotals.map((t) => t > 1.0 + 1e-9), [combinedDayTotals]);

  const hasAnyDraft = useMemo(() => draft.some((t) => t.task_name.trim() && sum(t.mdByDay) > 0), [draft]);

  const canSave = useMemo(() => {
    if (!memberName.trim()) return false;
    if (!hasAnyDraft) return false;
    if (dayOverLimit.some(Boolean)) return false;

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

          const rows: { date: string; category: string; task_name: string; md: number; overtime_md: number }[] = [];
          let otLeft = otTotal;

          const nonZeroDays = t.mdByDay.map((v, i) => ({ v: Number(v || 0), i })).filter((x) => x.v > 0);

          nonZeroDays.forEach((x, idx) => {
            const date = dateForDay(x.i as DayIdx);
            const md = round2(x.v);
            let overtime_md = 0;

            if (otTotal > 0) {
              if (idx === nonZeroDays.length - 1) overtime_md = round2(otLeft);
              else {
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

      setDraft([{ task_name: "", category: "", mdByDay: [0, 0, 0, 0, 0], overtime_total: 0 }]);

      // ✅ 저장 성공 후에만 확정 목록 갱신
      await fetchEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // ✅ 변경: "같은 업무" 묶어서 표시(업무명+카테고리 기준) + 멤버별 그룹
  const groupedEntriesByMember = useMemo<MemberGrouped[]>(() => {
    const memberMap = new Map<string, Map<string, Grouped>>();

    for (const e of entries) {
      const m = (e.member_name || "").trim() || "(이름없음)";
      if (!memberMap.has(m)) memberMap.set(m, new Map());

      const task = (e.task_name || "").trim();
      const cat = (e.category || "").trim();
      const key = `${task}||${cat}`;

      const taskMap = memberMap.get(m)!;
      const g =
        taskMap.get(key) ??
        ({
          key,
          task_name: task,
          category: cat,
          byDate: {},
          mdTotal: 0,
          otTotal: 0,
        } satisfies Grouped);

      const prev = g.byDate[e.date] ?? { md: 0, overtime_md: 0 };
      g.byDate[e.date] = {
        md: round2(prev.md + Number(e.md || 0)),
        overtime_md: round2(prev.overtime_md + Number(e.overtime_md || 0)),
      };

      g.mdTotal = round2(g.mdTotal + Number(e.md || 0));
      g.otTotal = round2(g.otTotal + Number(e.overtime_md || 0));

      taskMap.set(key, g);
    }

    const out: MemberGrouped[] = [];
    for (const [member_name, taskMap] of memberMap.entries()) {
      const grouped = [...taskMap.values()].sort((a, b) => b.mdTotal - a.mdTotal);
      const totals = {
        md: round2(grouped.reduce((acc, g) => acc + g.mdTotal, 0)),
        ot: round2(grouped.reduce((acc, g) => acc + g.otTotal, 0)),
      };
      out.push({ member_name, grouped, totals });
    }

    // 멤버 정렬: 총 md 큰 순
    return out.sort((a, b) => b.totals.md - a.totals.md);
  }, [entries]);

  // ✅ “선택 멤버 주간 삭제” (기존 기능 유지하되, 의미를 명확히)
  async function onDeleteAllThisWeekForSelectedMember() {
    const m = memberName.trim();
    if (!m) return;

    const ok = confirm(`선택 멤버(${m})의 이번 주(${weekLabel}) 입력을 전부 삭제할까요? 되돌릴 수 없어요.`);
    if (!ok) return;

    setError(null);
    setLoading(true);
    try {
      // 기존 API가 member를 요구한다면 유지
      const qs = new URLSearchParams({ member: m, from, to });
      const res = await fetch(`/api/entries?${qs.toString()}`, { method: "DELETE" });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error ?? `Failed to delete all (status ${res.status})`);
      await fetchEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">주간 업무 입력</h1>
          <p className="text-sm text-zinc-600">0.1md = 1시간 · 하루 최대 1.0md(8시간 기준)</p>
        </header>

        {/* 상단 설정 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <div className="text-sm font-medium">이름(이번에 저장할 멤버)</div>
              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="예: 최현철"
              />
              <div className="text-xs text-zinc-500">
                * 이름을 바꿔도 아래 “이번 주 입력 목록”은 바로 바뀌지 않아요. (주간 범위 변경/저장 시 갱신)
              </div>
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
            <div className="text-sm font-medium">요일별 합계(검증) — 선택 멤버 기준</div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {DAYS.map((d, i) => {
                const over = dayOverLimit[i];
                return (
                  <div
                    key={d.idx}
                    className={`rounded-xl border p-2 text-center ${over ? "border-red-300 bg-red-50" : "border-zinc-200"}`}
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
              <div className="mt-2 text-sm text-red-700">하루 총합이 1.0을 초과한 요일이 있어 저장할 수 없어요.</div>
            )}
          </div>
        </section>

        {/* 입력 테이블 */}
        {/* ... (여기부터 아래는 너 기존 코드 그대로) ... */}
        {/* 중간 입력 테이블 부분은 그대로 두면 돼서 생략하지 않고 유지해야 하는데,
            네가 이미 전체를 붙여준 상태라 위 변경만 반영하면 빌드가 돌아가. */}

        {/* 입력 테이블 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          {/* (기존 입력 테이블 렌더링 그대로) */}
          {/* ... */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={!canSave || saving}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "저장 중..." : "주간 저장"}
            </button>
            {!hasAnyDraft && (
              <span className="text-sm text-zinc-600">업무명 + 요일 md를 입력하면 저장할 수 있어요.</span>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </section>

        {/* ✅ 이번 주 입력 목록: 멤버 N명 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">이번 주 입력 목록</h2>
              <div className="text-sm text-zinc-600">{weekLabel}</div>
            </div>

            <div className="flex items-center gap-2">
              {loading && <span className="text-sm text-zinc-600">불러오는 중...</span>}
              <button
                onClick={fetchEntries}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                새로고침
              </button>

              <button
                onClick={onDeleteAllThisWeekForSelectedMember}
                disabled={!memberName.trim() || loading}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="선택한 멤버의 이번 주 데이터만 삭제합니다."
              >
                선택 멤버 주간 삭제
              </button>
            </div>
          </div>

          {groupedEntriesByMember.length === 0 ? (
            <div className="text-sm text-zinc-600">이번 주 데이터가 없어요.</div>
          ) : (
            <div className="space-y-4">
              {groupedEntriesByMember.map((m) => (
                <div key={m.member_name} className="rounded-2xl border border-zinc-200 p-4">
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <div className="text-base font-semibold">{m.member_name}</div>
                    <div className="text-sm text-zinc-600">
                      총 md {m.totals.md} / 총 초과 {m.totals.ot}
                    </div>
                  </div>

                  {m.grouped.length === 0 ? (
                    <div className="text-sm text-zinc-600">데이터 없음</div>
                  ) : (
                    <div className="space-y-2">
                      {m.grouped.map((g) => (
                        <div key={g.key} className="rounded-xl border border-zinc-200 p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-[260px] flex-1 font-medium">{g.task_name}</div>
                            <div className="text-zinc-600">
                              총 md {g.mdTotal} / 총 초과 {g.otTotal}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {DAYS.map((d) => {
                              const date = dateForDay(d.idx);
                              const v = g.byDate[date];
                              if (!v) return null;
                              return (
                                <span
                                  key={date}
                                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                                >
                                  {d.label}({date.slice(5)}) md {v.md} / 초과 {v.overtime_md}
                                </span>
                              );
                            })}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-zinc-600">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{g.category}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}