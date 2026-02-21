import type { TimeEntry, ValidationError } from "../types";

export function validateDailyLimit(entries: TimeEntry[], limit = 1.0): ValidationError[] {
  const map = new Map<string, number>(); // member|date -> total md

  for (const e of entries) {
    const key = `${e.member_name}|${e.date}`;
    const next = (map.get(key) ?? 0) + Number(e.md ?? 0);
    map.set(key, Math.round(next * 100) / 100);
  }

  const errors: ValidationError[] = [];
  for (const [k, totalMd] of map.entries()) {
    if (totalMd > limit + 1e-9) {
      const [member_name, date] = k.split("|");
      errors.push({ member_name, date, totalMd, limit });
    }
  }
  return errors;
}