"use client";

import { useMemo, useState } from "react";
import type { DraftStats, EntryKey, TimeEntry, ValidationError } from "../types";
import { makeKey, parseKey } from "../lib/key";
import { validateDailyLimit } from "../lib/validate";

type DraftPatch =
  | { kind: "upsert"; value: TimeEntry }
  | { kind: "delete" };

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function useDraft(baseEntries: TimeEntry[]) {
  const baseMap = useMemo(() => {
    const m = new Map<EntryKey, TimeEntry>();
    for (const e of baseEntries) m.set(makeKey(e), e);
    return m;
  }, [baseEntries]);

  const [patches, setPatches] = useState<Map<EntryKey, DraftPatch>>(() => new Map());

  const merged: TimeEntry[] = useMemo(() => {
    const map = new Map(baseMap);

    for (const [key, p] of patches.entries()) {
      if (p.kind === "delete") {
        map.delete(key);
      } else {
        map.set(key, p.value);
      }
    }
    return Array.from(map.values());
  }, [baseMap, patches]);

  const validationErrors: ValidationError[] = useMemo(() => {
    return validateDailyLimit(merged, 1.0);
  }, [merged]);

  const draftStats: DraftStats = useMemo(() => {
    let added = 0;
    let edited = 0;
    let deleted = 0;

    for (const [key, p] of patches.entries()) {
      const base = baseMap.get(key);
      if (p.kind === "delete") {
        // 베이스에 없던 걸 delete한 경우는 무시
        if (base) deleted += 1;
      } else {
        if (!base) added += 1;
        else {
          // 단순 비교
          const b = base;
          const v = p.value;
          const changed =
            b.md !== v.md ||
            b.overtime_md !== v.overtime_md ||
            b.category !== v.category ||
            b.task_name !== v.task_name ||
            b.member_name !== v.member_name ||
            b.date !== v.date;
          if (changed) edited += 1;
        }
      }
    }

    return { dirty: patches.size > 0, added, edited, deleted };
  }, [patches, baseMap]);

  const actions = useMemo(() => {
    return {
      setMd: (key: EntryKey, md: number) => {
        const { member_name, date, category, task_name } = parseKey(key);
        const base = baseMap.get(key);

        const next: TimeEntry = {
          id: base?.id,
          created_at: base?.created_at,
          member_name,
          date,
          category: category || "기타",
          task_name,
          md: round1(clamp01(md)),
          overtime_md: Number(base?.overtime_md ?? 0),
        };

        setPatches((prev) => {
          const m = new Map(prev);
          m.set(key, { kind: "upsert", value: next });
          return m;
        });
      },

      setOvertime: (key: EntryKey, overtime_md: number) => {
        const { member_name, date, category, task_name } = parseKey(key);
        const base = baseMap.get(key);

        const next: TimeEntry = {
          id: base?.id,
          created_at: base?.created_at,
          member_name,
          date,
          category: category || "기타",
          task_name,
          md: Number(base?.md ?? 0),
          overtime_md: Math.max(0, round1(Number(overtime_md ?? 0))),
        };

        setPatches((prev) => {
          const m = new Map(prev);
          m.set(key, { kind: "upsert", value: next });
          return m;
        });
      },

      deleteKey: (key: EntryKey) => {
        setPatches((prev) => {
          const m = new Map(prev);
          // base에 없는 건 그냥 patch에서 제거
          if (!baseMap.get(key)) {
            m.delete(key);
          } else {
            m.set(key, { kind: "delete" });
          }
          return m;
        });
      },

      resetDraft: () => setPatches(new Map()),
    };
  }, [baseMap]);

  return { merged, validationErrors, draftStats, actions };
}