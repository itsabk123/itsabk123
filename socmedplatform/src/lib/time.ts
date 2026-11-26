/** Timezone helpers. Default market timezone is Asia/Dubai (UTC+4, no DST). */
export const DEFAULT_TZ = "Asia/Dubai";

export function formatDateTime(d: Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d) + ` (${tzShort(tz)})`;
}
export function formatDate(d: Date | null | undefined, tz = DEFAULT_TZ) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: tz }).format(d);
}
export function tzShort(tz: string) {
  return tz === DEFAULT_TZ ? "UAE" : tz.split("/").pop()?.replace("_", " ") ?? tz;
}

/** Offset in minutes of `tz` relative to UTC at instant `d` (e.g. +240 for Dubai). */
export function tzOffsetMinutes(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

/** Converts a wall-clock time in `tz` to a UTC Date. */
export function zonedToUtc(y: number, m: number, day: number, minuteOfDay: number, tz: string) {
  const guess = new Date(Date.UTC(y, m - 1, day, 0, minuteOfDay));
  const off = tzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - off * 60000);
}

export type Rule = { weekday: number; startMinute: number; endMinute: number; timezone: string };
export type Busy = { startsAt: Date; endsAt: Date };

/** Generates bookable slots for the next `days` days from weekly availability rules, minus existing bookings. */
export function generateSlots(rules: Rule[], busy: Busy[], opts: { days?: number; durationMin?: number; from?: Date; minLeadHours?: number } = {}) {
  const days = opts.days ?? 14;
  const dur = opts.durationMin ?? 60;
  const from = opts.from ?? new Date();
  const earliest = from.getTime() + (opts.minLeadHours ?? 24) * 3600_000;
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const dayUtc = new Date(from.getTime() + i * 86400_000);
    for (const r of rules) {
      const local = new Intl.DateTimeFormat("en-US", { timeZone: r.timezone, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(dayUtc);
      const get = (t: string) => local.find((p) => p.type === t)?.value ?? "";
      const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
      if (wd !== r.weekday) continue;
      for (let m = r.startMinute; m + dur <= r.endMinute; m += dur) {
        const s = zonedToUtc(+get("year"), +get("month"), +get("day"), m, r.timezone);
        const e = new Date(s.getTime() + dur * 60000);
        if (s.getTime() < earliest) continue;
        if (busy.some((b) => s < b.endsAt && e > b.startsAt)) continue;
        if (!slots.some((x) => x.startsAt.getTime() === s.getTime())) slots.push({ startsAt: s, endsAt: e });
      }
    }
  }
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const minutesToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const hhmmToMinutes = (s: string) => {
  const [h, mm] = s.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(mm) ? h * 60 + mm : null;
};
