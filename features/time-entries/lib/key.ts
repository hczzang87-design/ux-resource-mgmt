import type { EntryKey, TimeEntry } from "../types";

export function makeKey(
  e: Pick<TimeEntry, "member_name" | "date" | "category" | "task_name">
): EntryKey {
  const esc = (s: string | undefined) => String(s ?? "").replaceAll("|", "¦").trim();
  return `${esc(e.member_name)}|${esc(e.date)}|${esc(e.category)}|${esc(
    e.task_name
  )}`;
}

export function parseKey(key: EntryKey) {
  const [member_name, date, category, task_name] = key
    .split("|")
    .map((s) => s.replaceAll("¦", "|"));
  return { member_name, date, category, task_name };
}

// ✅ 모듈 강제 인식 안전장치
export {};