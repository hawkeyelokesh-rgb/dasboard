import { mapAnswers, type QA } from "./answers";

export type LeadRow = Record<string, any> & { id?: string };

/** Minimal storage interface so the logic can be tested without a database. */
export interface LeadStore {
  findBySubmission(uri: string): Promise<LeadRow | null>;
  findByInvitee(uri: string): Promise<LeadRow | null>;
  findOpenLeadByEmail(emailLower: string): Promise<LeadRow | null>;
  insert(row: LeadRow): Promise<void>;
  update(id: string, patch: LeadRow): Promise<void>;
  /** The host's display name override (set on the Team page), or `fallback` (Calendly's own name) if none is set. */
  resolveHostName(hostEmail: string | null, fallback: string | null): Promise<string | null>;
}

export type CalendlyEnvelope = { event: string; payload: any; created_at?: string };

export async function handleCalendlyEvent(env: CalendlyEnvelope, store: LeadStore): Promise<string> {
  const p = env.payload ?? {};

  if (env.event === "routing_form_submission.created") {
    if (p.uri && (await store.findBySubmission(p.uri))) return "duplicate_submission";
    const qa = (p.questions_and_answers ?? []) as QA[];
    const m = mapAnswers(qa);
    // Pre-screening/qualifier forms (e.g. a yes/no capital check before the real form)
    // never collect an email, so there's nothing to turn into a contactable lead.
    if (!m.email) return "ignored_no_email";
    await store.insert({
      submission_uri: p.uri ?? null,
      submitted_at: p.created_at ?? env.created_at ?? new Date().toISOString(),
      ...m,
      email: m.email ? m.email.toLowerCase() : null,
      answers: qa,
      routed_to: p.result?.value ?? null,
      status: "submitted",
    });
    return "lead_created";
  }

  if (env.event === "invitee.created") {
    const se = p.scheduled_event ?? {};
    const host = se.event_memberships?.[0];
    const hostEmail = host?.user_email ? String(host.user_email).toLowerCase() : null;
    const patch: LeadRow = {
      invitee_uri: p.uri ?? null,
      event_uri: se.uri ?? p.event ?? null,
      status: "booked",
      event_name: se.name ?? null,
      host_name: await store.resolveHostName(hostEmail, host?.user_name ?? null),
      host_email: hostEmail,
      call_start: se.start_time ?? null,
      call_end: se.end_time ?? null,
      meeting_url: se.location?.join_url ?? null,
    };
    const email = p.email ? String(p.email).toLowerCase() : null;

    let lead: LeadRow | null = null;
    if (p.old_invitee) lead = await store.findByInvitee(p.old_invitee); // reschedule
    if (!lead && p.uri) lead = await store.findByInvitee(p.uri); // webhook redelivery
    if (!lead && email) lead = await store.findOpenLeadByEmail(email);

    if (lead?.id) {
      await store.update(lead.id, patch);
      return p.old_invitee ? "booking_rescheduled" : "booking_linked";
    }
    await store.insert({
      ...patch,
      name: p.name ?? null,
      email,
      submitted_at: p.created_at ?? new Date().toISOString(),
      answers: [],
    });
    return "booking_without_form";
  }

  if (env.event === "invitee.canceled") {
    if (p.rescheduled) return "ignored_reschedule_cancel"; // the new booking arrives as invitee.created
    const lead = p.uri ? await store.findByInvitee(p.uri) : null;
    if (lead?.id) {
      await store.update(lead.id, { status: "canceled" });
      return "booking_canceled";
    }
    return "cancel_no_match";
  }

  return "ignored";
}
