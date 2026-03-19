export function pad2(n: number) {
    return String(n).padStart(2, "0");
  }
  
  export function toYMD(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  
  export function getWeekStartMonday(today = new Date()) {
    const d = new Date(today);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  
  export function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  
  export function getWorkingDatesMonToFri(weekStart: Date): string[] {
    return Array.from({ length: 5 }).map((_, idx) =>
      toYMD(addDays(weekStart, idx))
    );
  }