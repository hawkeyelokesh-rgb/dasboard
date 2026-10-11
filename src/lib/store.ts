import { adminClient } from "./supabase/admin";
import type { LeadRow, LeadStore } from "./webhook";

export function supabaseStore(): LeadStore {
  const db = adminClient();
  const one = async (q: PromiseLike<{ data: any; error: any }>) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data?.[0] as LeadRow | undefined) ?? null;
  };
  return {
    findBySubmission: (uri) => one(db.from("leads").select("*").eq("submission_uri", uri).limit(1)),
    findByInvitee: (uri) => one(db.from("leads").select("*").eq("invitee_uri", uri).limit(1)),
    findOpenLeadByEmail: (email) =>
      one(db.from("leads").select("*").eq("email", email).is("invitee_uri", null).order("submitted_at", { ascending: false }).limit(1)),
    insert: async (row) => {
      const { error } = await db.from("leads").insert(row);
      if (error) throw new Error(error.message);
    },
    update: async (id, patch) => {
      const { error } = await db.from("leads").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
