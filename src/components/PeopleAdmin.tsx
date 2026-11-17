"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Role } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { Help, SectionTitle } from "./ui";

export default function PeopleAdmin({ supabase, me }: { supabase: SupabaseClient; me: Profile }) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [role, setRole] = useState<Role>("elt");
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const load = async () => { const { data } = await supabase.from("profiles").select("id,email,full_name,role,must_change_password,created_at").order("full_name"); setPeople((data ?? []) as Profile[]); };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function add() {
    setErr(""); if (!email.trim() || !name.trim()) return setErr("Enter a name and a Bron Afon email address.");
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_user", { p_email: email.trim().toLowerCase(), p_name: name.trim(), p_role: role });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?: /, ""));
    setIssued({ email: email.trim().toLowerCase(), password: data as string }); setEmail(""); setName(""); load();
  }
  async function setRoleFor(p: Profile, r: Role) { const { error } = await supabase.rpc("admin_set_role", { p_email: p.email, p_role: r }); if (error) setErr(error.message); load(); }
  async function reset(p: Profile) {
    if (!confirm(`Give ${p.full_name ?? p.email} a new temporary password? Their current one will stop working.`)) return;
    const { data, error } = await supabase.rpc("admin_reset_password", { p_email: p.email }); if (error) return setErr(error.message); setIssued({ email: p.email, password: data as string }); load();
  }

  return (
    <section>
      <SectionTitle sub="Add the people who should use the plan and choose what each can do.">Manage people</SectionTitle>
      <Help>Only Bron Afon email addresses can be added. Each new person gets a temporary password, shown once below — pass it on by phone or Teams, not email. They are asked to choose their own password the first time they sign in.</Help>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div><label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="pn">Name</label><input id="pn" className="field !w-[220px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
        <div><label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="pe">Email</label><input id="pe" type="email" className="field !w-[280px]" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@bronafon.org.uk" /></div>
        <div><label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="pr">Can</label><select id="pr" className="field !w-auto" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></div>
        <button className="btn btn-primary" onClick={add} disabled={busy}>{busy ? "Adding…" : "Add person"}</button>
        {err && <p role="alert" className="w-full text-sm text-red-800">{err}</p>}
      </div>
      {issued && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
          <strong>Temporary password for {issued.email}:</strong> <code className="rounded bg-white px-2 py-0.5 font-mono text-base">{issued.password}</code>
          <p className="mt-1 text-xs text-emerald-900">Shown once. They sign in with it and are asked to choose their own straight away.</p>
          <button className="btn btn-quiet mt-1 !py-1" onClick={() => setIssued(null)}>Dismiss</button>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="text-left text-xs text-slate-600"><th className="border-b border-slate-200 px-3 py-2">Name</th><th className="border-b border-slate-200 px-3 py-2">Email</th><th className="border-b border-slate-200 px-3 py-2">Can</th><th className="border-b border-slate-200 px-3 py-2">Signed in yet?</th><th className="border-b border-slate-200 px-3 py-2"></th></tr></thead>
          <tbody>{people.map((p) => (
            <tr key={p.id}>
              <td className="border-b border-slate-200 px-3 py-1.5 font-semibold">{p.full_name ?? "—"}{p.id === me.id && <span className="ml-2 text-xs font-normal text-slate-600">(you)</span>}</td>
              <td className="border-b border-slate-200 px-3 py-1.5">{p.email}</td>
              <td className="border-b border-slate-200 px-3 py-1.5"><select className="field !w-auto !py-1" value={p.role} disabled={p.id === me.id} onChange={(e) => setRoleFor(p, e.target.value as Role)} aria-label={`Role for ${p.email}`}>{ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></td>
              <td className="border-b border-slate-200 px-3 py-1.5 text-xs">{p.must_change_password ? <span className="pill bg-amber-100 text-amber-900">Not yet</span> : <span className="pill bg-emerald-100 text-emerald-900">Yes</span>}</td>
              <td className="border-b border-slate-200 px-3 py-1.5 text-right"><button className="btn btn-quiet !py-1" onClick={() => reset(p)}>Reset password</button></td>
            </tr>))}</tbody>
        </table>
      </div>
    </section>
  );
}
