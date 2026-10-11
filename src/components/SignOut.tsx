"use client";
import { browserClient } from "@/lib/supabase/browser";

export default function SignOut() {
  return (
    <button className="text-sm underline" onClick={async () => { await browserClient().auth.signOut(); window.location.href = "/login"; }}>
      Sign out
    </button>
  );
}
