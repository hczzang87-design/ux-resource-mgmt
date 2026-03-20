const HOURS_PER_MD = 8;

export function hoursToMd(hours: number): number {
  return Math.round((hours / HOURS_PER_MD) * 10000) / 10000;
}

export function mdToHours(md: number): number {
  return Math.round(md * HOURS_PER_MD * 100) / 100;
}

export function formatHours(hours: number): string {
  const h = Math.round(hours * 10) / 10;
  return `${h}h`;
}

export function formatMd(md: number): string {
  const m = Math.round(md * 100) / 100;
  return `${m.toFixed(2)} m/d`;
}

export function formatHoursMd(hours: number): string {
  return `${formatHours(hours)} (${formatMd(hoursToMd(hours))})`;
}

export function formatMdHours(md: number): string {
  return `${formatHours(mdToHours(md))} (${formatMd(md)})`;
}

/** 날짜별·OT 입력 스테퍼/직접입력 단위 (정수 시간) */
export const HOURS_STEP = 1;
export const MAX_DAILY_HOURS = 8;
export { HOURS_PER_MD };

/** 하루 0~8시간 → m/d (정수 시간만 허용) */
export function mdFromDailyIntegerHours(hours: number): number {
  const h = Math.max(0, Math.min(MAX_DAILY_HOURS, Math.round(Number(hours))));
  return hoursToMd(h);
}

/** OT: 0 이상 정수 시간 → m/d */
export function mdFromOtIntegerHours(hours: number): number {
  const h = Math.max(0, Math.round(Number(hours)));
  return hoursToMd(h);
}

export function snapDailyMdToIntegerHours(md: number): number {
  return mdFromDailyIntegerHours(mdToHours(md));
}

export function snapOtMdToIntegerHours(md: number): number {
  return mdFromOtIntegerHours(mdToHours(md));
}
