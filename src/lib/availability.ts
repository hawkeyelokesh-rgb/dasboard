// Pure availability maths. Free time = Calendly schedule intervals minus busy periods.

export type Interval = { from: string; to: string };
export type Rule = { type: "wday" | "date"; wday?: string; date?: string; intervals: Interval[] };
export type Schedule = { timezone: string; rules: Rule[]; default?: boolean };
export type Busy = { start: number; end: number };

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Offset of `tz` from UTC in ms at instant `ms`. */
export function tzOffsetMs(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date(ms));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? "0", 10)) * 60000;
}

/** Wall-clock date ("YYYY-MM-DD") + "HH:mm" in `tz` -> UTC instant (ms). */
export function zonedToUtc(dateStr: string, hhmm: string, tz: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off1 = tzOffsetMs(guess, tz);
  const res = guess - off1;
  const off2 = tzOffsetMs(res, tz);
  return guess - off2;
}

export function weekdayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Working intervals for a date. A specific-date rule overrides the weekday rule. */
export function intervalsForDate(schedule: Schedule, dateStr: string): Interval[] {
  const dateRule = schedule.rules.find((r) => r.type === "date" && r.date === dateStr);
  if (dateRule) return dateRule.intervals ?? [];
  const wd = weekdayName(dateStr);
  const wRule = schedule.rules.find((r) => r.type === "wday" && r.wday === wd);
  return wRule?.intervals ?? [];
}

/** Every slot start (UTC ms) for the date, stepping by slotMin inside each working interval. */
export function slotsForDate(schedule: Schedule, dateStr: string, slotMin: number): number[] {
  const slotMs = slotMin * 60000;
  const out: number[] = [];
  for (const iv of intervalsForDate(schedule, dateStr)) {
    const from = zonedToUtc(dateStr, iv.from, schedule.timezone);
    const to = zonedToUtc(dateStr, iv.to, schedule.timezone);
    for (let t = from; t + slotMs <= to; t += slotMs) out.push(t);
  }
  return out;
}

/** True when the slot starts in the future and overlaps no busy period. */
export function isSlotFree(t: number, busy: Busy[], nowMs: number, slotMin: number): boolean {
  if (t < nowMs) return false;
  const end = t + slotMin * 60000;
  return !busy.some((b) => b.start < end && b.end > t);
}

export function dayBoundsUtc(dateStr: string, tz: string): { start: number; end: number } {
  return { start: zonedToUtc(dateStr, "00:00", tz), end: zonedToUtc(addDays(dateStr, 1), "00:00", tz) };
}
