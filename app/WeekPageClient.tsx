"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import MainWeekClient from "./MainWeekClient";
import type { TimeEntry } from "@/features/time-entries/types";

type SavedMember = { member_name: string; mdTotal: number; otTotal: number };

type Props = {
  weekDates: string[];
  weekRangeLabel: string;
  savedEntries: TimeEntry[];
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function WeekPageClient({
  weekDates,
  weekRangeLabel,
  savedEntries,
}: Props) {
  const router = useRouter();

  // savedEntries를 멤버별 md/ot 합계로 집계 → 이번 주 저장된 멤버 목록
  const savedMembers: SavedMember[] = useMemo(() => {
    const byMember = new Map<string, { mdTotal: number; otTotal: number }>();
    for (const e of savedEntries) {
      const name = e.member_name ?? "";
      if (!name) continue;
      const cur = byMember.get(name) ?? { mdTotal: 0, otTotal: 0 };
      cur.mdTotal = round1(cur.mdTotal + Number(e.md ?? 0));
      cur.otTotal = round1(cur.otTotal + Number(e.overtime_md ?? 0));
      byMember.set(name, cur);
    }
    return Array.from(byMember.entries()).map(([member_name, t]) => ({
      member_name,
      mdTotal: t.mdTotal,
      otTotal: t.otTotal,
    }));
  }, [savedEntries]);

  const onPrevWeek = () => {
    const [y, m, d] = weekDates[0].split("-").map(Number);
    const monday = new Date(y, m - 1, d);
    monday.setDate(monday.getDate() - 7);
    const from = toYMD(monday);
    const friday = addDays(monday, 4);
    const to = toYMD(friday);
    router.push(`/?from=${from}&to=${to}`);
  };

  const onNextWeek = () => {
    const [y, m, d] = weekDates[0].split("-").map(Number);
    const monday = new Date(y, m - 1, d);
    monday.setDate(monday.getDate() + 7);
    const from = toYMD(monday);
    const friday = addDays(monday, 4);
    const to = toYMD(friday);
    router.push(`/?from=${from}&to=${to}`);
  };

  const onSaveWeek = async (memberName: string, entries: TimeEntry[]) => {
    const from = weekDates[0];
    const to = weekDates[weekDates.length - 1];
    const res = await fetch("/api/time-entries/week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, member_name: memberName, entries }),
    });
    if (!res.ok) throw new Error(await res.text());
    router.refresh();
  };

  const onDeleteAll = async () => {
    if (!confirm("이번 주 저장된 데이터를 모두 삭제할까요?")) return;
    const from = weekDates[0];
    const to = weekDates[weekDates.length - 1];
    const res = await fetch("/api/time-entries/week", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    if (!res.ok) throw new Error(await res.text());
    router.refresh();
  };

  return (
    <MainWeekClient
      weekDates={weekDates}
      weekRangeLabel={weekRangeLabel}
      onPrevWeek={onPrevWeek}
      onNextWeek={onNextWeek}
      savedEntries={savedEntries}
      onSaveWeek={onSaveWeek}
      savedMembers={savedMembers}
      onDeleteAll={onDeleteAll}
    />
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
