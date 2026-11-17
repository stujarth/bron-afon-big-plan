"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage("");
    const domain = email.trim().toLowerCase().split("@")[1] ?? "";
    if (domain !== "bronafon.org.uk") { setMessage("Use your Bron Afon email address."); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setMessage(error.message.toLowerCase().includes("invalid") ? "Email or password not recognised." : "Could not sign you in. Try again in a minute."); return; }
    router.replace("/"); router.refresh();
  }

  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex gap-0.5" aria-hidden="true"><i className="block h-6 w-1.5 rounded bg-blue" /><i className="block h-6 w-1.5 rounded bg-green" /><i className="block h-6 w-1.5 rounded bg-maroon" /></span>
          <div><h1 className="text-lg font-bold text-navy leading-tight">One Bron Afon Plan</h1><p className="text-xs text-slate-600">The Big Plan</p></div>
        </div>
        <form onSubmit={submit} noValidate>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1">Bron Afon email address</label>
          <input id="email" type="email" required autoComplete="username" className="field mb-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@bronafon.org.uk" />
          <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="field mb-4" value={password} onChange={(e) => setPassword(e.target.value)} />
          {message && <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="mt-4 text-xs text-slate-600">Accounts are set up by the plan owner. Forgotten your password? Contact Stuart Arthur.</p>
        </form>
      </div>
    </main>
  );
}
