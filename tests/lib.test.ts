import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { zonedToUtc, slotsForDate, isSlotFree, intervalsForDate, addDays, weekdayName, dayBoundsUtc, type Schedule } from "../src/lib/availability";
import { mapAnswers } from "../src/lib/answers";
import { verifySignature } from "../src/lib/calendly";
import { handleCalendlyEvent, type LeadRow, type LeadStore } from "../src/lib/webhook";

const iso = (ms: number) => new Date(ms).toISOString();
const T = (s: string) => Date.parse(s);

describe("time zones", () => {
  it("converts wall-clock to UTC", () => {
    expect(iso(zonedToUtc("2026-10-15", "10:30", "Asia/Kolkata"))).toBe("2026-10-15T05:00:00.000Z");
    expect(iso(zonedToUtc("2026-10-15", "10:30", "America/New_York"))).toBe("2026-10-15T14:30:00.000Z");
    expect(iso(zonedToUtc("2026-11-02", "10:00", "America/New_York"))).toBe("2026-11-02T15:00:00.000Z"); // after DST ends
  });
  it("weekday / addDays", () => {
    expect(weekdayName("2026-10-15")).toBe("thursday");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("day bounds for India are 24h", () => {
    const b = dayBoundsUtc("2026-10-15", "Asia/Kolkata");
    expect(b.end - b.start).toBe(24 * 3600000);
  });
});

describe("availability", () => {
  const sch: Schedule = {
    timezone: "Asia/Kolkata",
    rules: [
      { type: "wday", wday: "thursday", intervals: [{ from: "10:00", to: "14:00" }, { from: "15:00", to: "17:00" }] },
      { type: "wday", wday: "friday", intervals: [{ from: "09:00", to: "18:00" }] },
      { type: "date", date: "2026-10-16", intervals: [{ from: "10:00", to: "12:00" }] },
      { type: "wday", wday: "saturday", intervals: [] },
    ],
  };
  it("builds slots, honours date overrides and days off", () => {
    expect(slotsForDate(sch, "2026-10-15", 60)).toHaveLength(6);
    expect(slotsForDate(sch, "2026-10-16", 60)).toHaveLength(2);
    expect(slotsForDate(sch, "2026-10-17", 60)).toHaveLength(0);
    expect(slotsForDate(sch, "2026-10-15", 30)).toHaveLength(12);
    expect(intervalsForDate(sch, "2026-10-18")).toEqual([]); // sunday: no rule
  });
  it("removes slots that overlap busy periods or are in the past", () => {
    const slots = slotsForDate(sch, "2026-10-15", 60);
    const busy = [
      { start: T("2026-10-15T05:30:00Z"), end: T("2026-10-15T06:30:00Z") }, // 11:00-12:00 IST
      { start: T("2026-10-15T10:00:00Z"), end: T("2026-10-15T10:45:00Z") }, // 15:30-16:15 IST
    ];
    const free = slots.filter((t) => isSlotFree(t, busy, T("2026-10-15T00:00:00Z"), 60)).map((t) => new Date(t + 19800000).toISOString().slice(11, 16));
    expect(free).toEqual(["10:00", "12:00", "13:00"]);
    const late = slots.filter((t) => isSlotFree(t, [], T("2026-10-15T07:30:00Z"), 60)).map((t) => new Date(t + 19800000).toISOString().slice(11, 16));
    expect(late).toEqual(["13:00", "15:00", "16:00"]); // now = 13:00 IST
  });
});

describe("answers", () => {
  it("maps by question text, any order", () => {
    const qa = [
      { question: "What is your approximate investment capacity for starting an Export-Import business? (Enter your capital correctly...)", answer: "1 L- 3 L" },
      { question: "Email", answer: "Foo@Bar.com" },
      { question: "Name", answer: "Foo Bar" },
      { question: "Whatsapp Number", answer: "+91 75988 98202" },
      { question: "Where are you currently located?", answer: "Outside India" },
      { question: "What Describes you best ?", answer: "Business Owner" },
      { question: "Have you previously done any Export or Import?", answer: "No – Completely new" },
      { question: "What is your primary goal with starting or scaling an Export-Import business?", answer: "Grow" },
      { question: "What is your expected monthly income target from this business within 6 months?", answer: "3-7 Lakhs" },
      { question: "How much time can you dedicate weekly to building this business? ( *Note - Min we need 2-3 hours* )", answer: "5-7 hours" },
      { question: "What challenges are stopping you from starting or scaling in Export-Import?", answer: "Money" },
      { question: "If we give you a clear roadmap, are you willing to take action immediately?", answer: "Yes" },
      { question: "This call will take place over a 30-45mins over Zoom. If you do NOT show up for the call , you will not be able to reschedule with us.", answer: "Yes , i will make sure" },
    ];
    const m = mapAnswers(qa);
    expect(m).toMatchObject({
      name: "Foo Bar", email: "Foo@Bar.com", whatsapp: "+91 75988 98202", location: "Outside India",
      describes_best: "Business Owner", previously_done: "No – Completely new", investment: "1 L- 3 L", goal: "Grow",
      income_target: "3-7 Lakhs", weekly_time: "5-7 hours", challenges: "Money", roadmap: "Yes",
    });
    expect(m.commitment).toContain("Yes");
  });
  it("flattens multi-select answers", () => {
    expect(mapAnswers([{ question: "What is your approximate investment capacity", answer: "75,000 - 1 L\n1 L- 3 L" }]).investment).toBe("75,000 - 1 L, 1 L- 3 L");
  });
});

describe("webhook signature", () => {
  const key = "secret", body = '{"event":"x"}';
  const sign = (t: number) => `t=${t},v1=${crypto.createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
  it("accepts a valid signature and rejects bad / stale ones", () => {
    const now = 1_700_000_000_000, t = now / 1000;
    expect(verifySignature(body, sign(t), key, now)).toBe(true);
    expect(verifySignature(body + " ", sign(t), key, now)).toBe(false);
    expect(verifySignature(body, sign(t), "other", now)).toBe(false);
    expect(verifySignature(body, sign(t - 3600), key, now)).toBe(false);
    expect(verifySignature(body, null, key, now)).toBe(false);
    expect(verifySignature(body, "garbage", key, now)).toBe(false);
  });
});

function memStore(): LeadStore & { rows: LeadRow[] } {
  const rows: LeadRow[] = [];
  let n = 0;
  return {
    rows,
    async findBySubmission(u) { return rows.find((r) => r.submission_uri === u) ?? null; },
    async findByInvitee(u) { return rows.find((r) => r.invitee_uri === u) ?? null; },
    async findOpenLeadByEmail(e) {
      return rows.filter((r) => r.email === e && !r.invitee_uri).sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0] ?? null;
    },
    async insert(r) { rows.push({ ...r, id: String(++n) }); },
    async update(id, p) { Object.assign(rows.find((r) => r.id === id)!, p); },
  };
}

describe("webhook flow", () => {
  const form = {
    event: "routing_form_submission.created",
    payload: {
      uri: "https://api.calendly.com/routing_form_submissions/S1",
      created_at: "2026-10-11T04:00:00Z",
      questions_and_answers: [
        { question: "Name", answer: "Ronald T" }, { question: "Email", answer: "Ronald@Gmail.com" },
        { question: "Where are you currently located?", answer: "India" },
      ],
      result: { type: "event_type", value: "https://calendly.com/x/strategy-call-mid" },
    },
  };
  const booked = (extra: any = {}) => ({
    event: "invitee.created",
    payload: {
      uri: "https://api.calendly.com/scheduled_events/E1/invitees/I1", email: "ronald@gmail.com", name: "Ronald T",
      scheduled_event: {
        uri: "https://api.calendly.com/scheduled_events/E1", name: "Strategy Call (1-1) Mid",
        start_time: "2026-10-15T05:00:00Z", end_time: "2026-10-15T06:00:00Z",
        location: { join_url: "https://meet.google.com/abc" },
        event_memberships: [{ user: "https://api.calendly.com/users/U1", user_name: "Sravani", user_email: "Sravani@Altira.com" }],
      },
      ...extra,
    },
  });

  it("creates a lead, then links the booking and assigns the host", async () => {
    const s = memStore();
    expect(await handleCalendlyEvent(form, s)).toBe("lead_created");
    expect(await handleCalendlyEvent(form, s)).toBe("duplicate_submission"); // redelivery
    expect(s.rows[0]).toMatchObject({ name: "Ronald T", email: "ronald@gmail.com", status: "submitted" });
    expect(await handleCalendlyEvent(booked(), s)).toBe("booking_linked");
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ status: "booked", host_name: "Sravani", host_email: "sravani@altira.com", call_start: "2026-10-15T05:00:00Z", meeting_url: "https://meet.google.com/abc" });
    expect(await handleCalendlyEvent(booked(), s)).toBe("booking_linked"); // redelivery is idempotent
    expect(s.rows).toHaveLength(1);
  });
  it("handles reschedule and cancel", async () => {
    const s = memStore();
    await handleCalendlyEvent(form, s);
    await handleCalendlyEvent(booked(), s);
    const re = booked({ uri: "https://api.calendly.com/scheduled_events/E2/invitees/I2", old_invitee: "https://api.calendly.com/scheduled_events/E1/invitees/I1", rescheduled: true });
    re.payload.scheduled_event.start_time = "2026-10-16T05:00:00Z";
    expect(await handleCalendlyEvent(re, s)).toBe("booking_rescheduled");
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].call_start).toBe("2026-10-16T05:00:00Z");
    // the old invitee's cancel (flagged as reschedule) must not cancel the lead
    expect(await handleCalendlyEvent({ event: "invitee.canceled", payload: { uri: "https://api.calendly.com/scheduled_events/E1/invitees/I1", rescheduled: true } }, s)).toBe("ignored_reschedule_cancel");
    expect(s.rows[0].status).toBe("booked");
    expect(await handleCalendlyEvent({ event: "invitee.canceled", payload: { uri: "https://api.calendly.com/scheduled_events/E2/invitees/I2", rescheduled: false } }, s)).toBe("booking_canceled");
    expect(s.rows[0].status).toBe("canceled");
  });
  it("keeps a booking that has no form", async () => {
    const s = memStore();
    expect(await handleCalendlyEvent(booked(), s)).toBe("booking_without_form");
    expect(s.rows[0]).toMatchObject({ email: "ronald@gmail.com", status: "booked", host_email: "sravani@altira.com" });
  });
  it("a second form from the same person after booking creates a new open lead", async () => {
    const s = memStore();
    await handleCalendlyEvent(form, s);
    await handleCalendlyEvent(booked(), s);
    const form2 = JSON.parse(JSON.stringify(form)); form2.payload.uri += "b"; form2.payload.created_at = "2026-10-20T04:00:00Z";
    await handleCalendlyEvent(form2, s);
    expect(s.rows).toHaveLength(2);
    expect(s.rows[1].status).toBe("submitted");
  });
});
