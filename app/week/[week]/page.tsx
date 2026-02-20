"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Entry = {
  id: string;
  created_at: string;
  member_name: string;
  date: string;
  category: string;
  task_name: string;
  md: number;
  overtime_md: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysYMD(ymd: string, plusDays: number) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const t = Date.UTC(y, m - 1, d + plusDays);
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type Grouped = {
  key: string;
  task_name: string;
  category: string;
  byDate: Record<string, { md: number; overtime_md: number }>;
  mdTotal: number;
  otTotal: number;
};

type MemberGrouped = {
  member_name: string;
  grouped: Grouped[];
  totals: { md: number; ot: number };
};

export default function WeekDetailPage() {
  const params = useParams(); // ✅ 여기서는 무조건 잡힘
  const raw = (params?.week ?? "") as string;

  const from = decodeURIComponent(String(raw)).replace(/\/+$/, "").trim();
  const to = useMemo(() => (isYMD(from) ? addDaysYMD(from, 4) : ""), [from]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberGrouped[]>([]);

  useEffect(() => {
    async function run() {
      setError(null);
      setMembers([]);

      if (!isYMD(from)) {
        setError(`잘못된 날짜 형식이야: "${from}"`);
        return;
      }

      setLoading(true);
      try {
        const qs = new URLSearchParams({ from, to });
        const res = await fetch(`/api/entries?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? `Failed to load (status ${res.status})`);

        const entries: Entry[] = (json?.data ?? []) as Entry[];

        const memberMap = new Map<string, Map<string, Grouped>>();

        for (const e of entries) {
          const m = (e.member_name || "").trim() || "(이름없음)";
          if (!memberMap.has(m)) memberMap.set(m, new Map());

          const task = (e.task_name || "").trim();
          const cat = (e.category || "").trim();
          const key = `${task}||${cat}`;

          const taskMap = memberMap.get(m)!;
          const g =
            taskMap.get(key) ?? {
              key,
              task_name: task,
              category: cat,
              byDate: {},
              mdTotal: 0,
              otTotal: 0,
            };

          const prev = g.byDate[e.date] ?? { md: 0, overtime_md: 0 };
          g.byDate[e.date] = {
            md: round2(prev.md + Number(e.md || 0)),
            overtime_md: round2(prev.overtime_md + Number(e.overtime_md || 0)),
          };

          g.mdTotal = round2(g.mdTotal + Number(e.md || 0));
          g.otTotal = round2(g.otTotal + Number(e.overtime_md || 0));

          taskMap.set(key, g);
        }

        const out: MemberGrouped[] = [...memberMap.entries()]
          .map(([member_name, taskMap]) => {
            const grouped = [...taskMap.values()].sort((a, b) => b.mdTotal - a.mdTotal);
            const md = round2(grouped.reduce((acc, g) => acc + g.mdTotal, 0));
            const ot = round2(grouped.reduce((acc, g) => acc + g.otTotal, 0));
            return { member_name, grouped, totals: { md, ot } };
          })
          .sort((a, b) => b.totals.md - a.totals.md);

        setMembers(out);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [from, to]);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>[NEW] 주간 입력 목록</h1>
      <p style={{ marginTop: 8, opacity: 0.7 }}>{isYMD(from) ? `${from} ~ ${to}` : ""}</p>

      {loading && <p style={{ marginTop: 16, opacity: 0.7 }}>불러오는 중...</p>}

      {error && (
        <div style={{ marginTop: 16 }}>
          <p style={{ opacity: 0.9 }}>{error}</p>
          <p style={{ marginTop: 8, opacity: 0.7 }}>
            기대하는 형식: <b>YYYY-MM-DD</b> (예: 2026-02-16)
          </p>
        </div>
      )}

      {!loading && !error && members.length === 0 && (
        <p style={{ marginTop: 16, opacity: 0.7 }}>데이터가 없어.</p>
      )}

      {!loading && !error && members.length > 0 && (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {members.map((m) => (
            <section
              key={m.member_name}
              style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{m.member_name}</div>
                <div style={{ opacity: 0.8, fontWeight: 700 }}>
                  총 md {m.totals.md} / 총 초과 {m.totals.ot}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {m.grouped.map((g) => (
                  <div key={g.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700 }}>{g.task_name}</div>
                      <div style={{ opacity: 0.8 }}>
                        총 md {g.mdTotal} / 총 초과 {g.otTotal}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Object.entries(g.byDate)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([date, v]) => (
                          <span
                            key={date}
                            style={{
                              background: "#f4f4f5",
                              borderRadius: 999,
                              padding: "4px 8px",
                              fontSize: 12,
                            }}
                          >
                            {date.slice(5)} md {v.md} / 초과 {v.overtime_md}
                          </span>
                        ))}
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
                      카테고리: {g.category || "기타"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}