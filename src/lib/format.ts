const TZ = "Asia/Kolkata";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}
export function fmtTime(iso: string | number): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
/** Today's date in India as YYYY-MM-DD. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
/** UTC ISO bounds of an India calendar day. */
export function istDayBounds(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}
