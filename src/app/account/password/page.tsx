"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage("");
    if (pw.length < 12) return setMessage("Use at least 12 characters — a short phrase works well.");
    if (pw !== pw2) return setMessage("The two passwords don't match.");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setBusy(false); return setMessage(error.message.includes("different") ? "Choose a password you haven't used here before." : "Could not change the password. Try again."); }
    await supabase.rpc("mark_password_changed");
    setBusy(false); router.replace("/"); router.refresh();
  }

  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold text-navy mb-1">Choose your password</h1>
        <p className="text-sm text-slate-600 mb-5">You signed in with a temporary password. Set your own before continuing.</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="pw" className="block text-xs font-semibold text-slate-600 mb-1">New password</label>
          <input id="pw" type="password" autoComplete="new-password" className="field mb-3" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pw-help" />
          <label htmlFor="pw2" className="block text-xs font-semibold text-slate-600 mb-1">Confirm new password</label>
          <input id="pw2" type="password" autoComplete="new-password" className="field mb-2" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <p id="pw-help" className="text-xs text-slate-600 mb-4">At least 12 characters. Three unrelated words is easier to remember than symbols.</p>
          {message && <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
        </form>
      </div>
    </main>
  );
}
