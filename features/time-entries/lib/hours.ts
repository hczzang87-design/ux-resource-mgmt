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

export const HOURS_STEP = 0.5;
export const MAX_DAILY_HOURS = 8;
export { HOURS_PER_MD };
