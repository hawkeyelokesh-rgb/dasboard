import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { mapAnswers } from "../src/lib/answers";
import { verifySignature } from "../src/lib/calendly";
import { handleCalendlyEvent, type LeadRow, type LeadStore } from "../src/lib/webhook";

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
    async resolveHostName(_email, fallback) { return fallback; },
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
  it("ignores a pre-screening form submission with no email", async () => {
    const s = memStore();
    const noEmail = { event: "routing_form_submission.created", payload: {
      uri: "https://api.calendly.com/routing_form_submissions/S2", created_at: "2026-10-13T04:00:00Z",
      questions_and_answers: [{ question: "Please choose one", answer: "I can arrange ₹50,000 now." }],
      result: { type: "no_match", value: null },
    } };
    expect(await handleCalendlyEvent(noEmail, s)).toBe("ignored_no_email");
    expect(s.rows).toHaveLength(0);
  });
});
