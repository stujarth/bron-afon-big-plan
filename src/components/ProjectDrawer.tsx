"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EltDecision, HistoryRow, Project, ProjectStatus, Rag, Team } from "@/lib/types";
import { DECISIONS, DECISION_HELP, IMPACT_FIELDS, LEVELS, STATUSES } from "@/lib/types";
import { DateField, Segmented, TeamTag } from "./ui";

export interface ProjectDraft {
  id: string | null; ref: string | null; name: string; purpose: string; lead_team_id: string | null; owner: string;
  start_date: string | null; end_date: string | null; status: ProjectStatus;
  impact_regulatory: number; impact_financial: number; impact_customer: number; impact_foundations: number; impact_digital: number;
  decision: EltDecision | null; priority: number | null; rationale: string; notes: string; confirmed: boolean; rag: Rag; team_ids: string[];
}

const EMPTY: ProjectDraft = { id: null, ref: null, name: "", purpose: "", lead_team_id: null, owner: "", start_date: null, end_date: null, status: "Not started",
  impact_regulatory: 0, impact_financial: 0, impact_customer: 0, impact_foundations: 0, impact_digital: 0, decision: null, priority: null, rationale: "", notes: "", confirmed: true, rag: "Green", team_ids: [] };

const RAG_OPTS: { v: Rag; label: string; on: string; dot: string }[] = [
  { v: "Green", label: "On track", on: "border-emerald-600 bg-emerald-50 text-emerald-900", dot: "bg-emerald-600" },
  { v: "Amber", label: "At risk", on: "border-amber-500 bg-amber-50 text-amber-900", dot: "bg-amber-400" },
  { v: "Red", label: "In trouble", on: "border-red-600 bg-red-50 text-red-900", dot: "bg-red-600" },
];

export default function ProjectDrawer({ project, teams, canEdit, canDecide, canDelete, onClose, onSave, onDelete, supabase }: {
  project: Project | null; teams: Team[]; canEdit: boolean; canDecide: boolean; canDelete: boolean; onClose: () => void;
  onSave: (d: ProjectDraft) => Promise<string | null>; onDelete: (p: Project) => Promise<string | null>; supabase: SupabaseClient;
}) {
  const [d, setD] = useState<ProjectDraft>(() => (project ? pick(project) : EMPTY));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const isNew = !project;
  const score = IMPACT_FIELDS.reduce((s, [k]) => s + d[k], 0);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const addable = teams.filter((t) => t.active && t.id !== d.lead_team_id && !d.team_ids.includes(t.id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (!project) return;
    supabase.rpc("project_history_named", { p_project: project.id }).then(({ data }) => setHistory((data ?? []) as HistoryRow[]));
  }, [project, supabase]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (!d.name.trim()) return setErr("Give the project a name.");
    if (!d.lead_team_id) return setErr("Choose a lead team.");
    if (d.start_date && d.end_date && d.end_date < d.start_date) return setErr("The end date is before the start date.");
    setBusy(true);
    const error = await onSave({ ...d, name: d.name.trim(), ref: d.ref || null, team_ids: d.team_ids.filter((t) => t !== d.lead_team_id) });
    setBusy(false); if (error) setErr(error); else onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-navy/45" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[680px] flex-col bg-[#F6F8FA] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="dr-h">
        <header className="flex items-start gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{isNew ? "Add to the plan" : project.ref}</p>
            <h2 id="dr-h" className="text-xl font-bold text-navy">{isNew ? "New project" : project.name}</h2>
          </div>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <form className="flex-1 space-y-4 overflow-auto px-6 py-5" onSubmit={submit} id="drawer-form" noValidate>
          <fieldset disabled={!canEdit} className="space-y-4">
            <Card title="About the project">
              <Field label="Name" id="name" required><input id="name" className="field" value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={200} autoFocus={isNew} placeholder="e.g. Void turnaround improvement" /></Field>
              <Field label="What it delivers" hint="The benefit, in one line — not the activity." id="purpose"><input id="purpose" className="field" value={d.purpose} onChange={(e) => set("purpose", e.target.value)} maxLength={400} placeholder="e.g. Fewer empty homes and less lost rent" /></Field>
              <Field label="Status" id="status"><select id="status" className="field sm:!w-1/2" value={d.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="How is it going?" id="rag">
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How is it going?">
                  {RAG_OPTS.map((r) => (
                    <button type="button" key={r.v} role="radio" aria-checked={d.rag === r.v} onClick={() => set("rag", r.v)}
                      className={`flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border-2 px-2 text-sm font-semibold ${d.rag === r.v ? r.on : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                      <span className={`h-3 w-3 rounded-full ${r.dot}`} aria-hidden="true" />{r.label}</button>
                  ))}
                </div>
              </Field>
            </Card>

            <Card title="Who is involved">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lead team" id="lead" required><select id="lead" className="field" value={d.lead_team_id ?? ""} onChange={(e) => set("lead_team_id", e.target.value || null)}><option value="">Choose a team…</option>{teams.filter((t) => t.active || t.id === d.lead_team_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                <Field label="Accountable lead" id="owner" hint="Director or Head of Service"><input id="owner" className="field" value={d.owner} onChange={(e) => set("owner", e.target.value)} maxLength={120} placeholder="Name" /></Field>
              </div>
              <Field label="Other teams whose time it needs" id="addteam" hint="Choose Whole organisation if it touches everyone.">
                {d.team_ids.length > 0 && (
                  <ul className="mb-2 flex flex-wrap gap-2">{d.team_ids.map((id) => (
                    <li key={id} className="flex items-center gap-1 rounded-full border border-slate-300 bg-white py-0.5 pl-1 pr-1">
                      <TeamTag team={teamById.get(id)} />
                      <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label={`Remove ${teamById.get(id)?.name}`} onClick={() => set("team_ids", d.team_ids.filter((x) => x !== id))}>✕</button>
                    </li>))}</ul>
                )}
                <select id="addteam" className="field" value="" onChange={(e) => e.target.value && set("team_ids", [...d.team_ids, e.target.value])}>
                  <option value="">{d.team_ids.length ? "Add another team…" : "Add a team…"}</option>
                  {addable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </Card>

            <Card title="When">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start" id="start"><DateField id="start" value={d.start_date} onChange={(v) => set("start_date", v)} /></Field>
                <Field label="End" id="end"><DateField id="end" value={d.end_date} onChange={(v) => set("end_date", v)} /></Field>
              </div>
              <p className="text-sm text-slate-600">Not sure yet? Leave the dates blank — the project stays on the list but won&apos;t appear on the roadmap until it has both.</p>
            </Card>

            <Card title="Impact" aside={<span className="rounded-full bg-lblue px-3 py-1 text-sm font-bold text-blue">Score {score} / 15</span>}>
              <p className="-mt-1 text-sm text-slate-600">A prompt for discussion, not a verdict. Higher scores rise to the top of ELT&apos;s list.</p>
              <div className="divide-y divide-slate-100">
                {IMPACT_FIELDS.map(([k, label]) => (
                  <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span id={`${k}-l`} className="font-semibold">{label}</span>
                    <Segmented labelledBy={`${k}-l`} value={d[k]} onChange={(v) => set(k, v)} options={LEVELS.map((lv, i) => ({ v: i, label: i === 0 ? "None" : lv }))} />
                  </div>))}
              </div>
            </Card>

            <Card title="Notes">
              <Field label="Dependencies, risks, anything ELT should know" id="notes"><textarea id="notes" className="field !h-auto min-h-[96px] py-2" value={d.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} /></Field>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 ${d.confirmed ? "border-emerald-600 bg-emerald-50" : "border-amber-400 bg-amber-50"}`}>
                <input type="checkbox" className="mt-0.5 h-5 w-5" checked={d.confirmed} onChange={(e) => set("confirmed", e.target.checked)} />
                <span><strong>Confirmed by the lead</strong><span className="block text-sm text-slate-700">Tick when this row is correct and up to date.</span></span>
              </label>
            </Card>
          </fieldset>

          {!isNew && (
            <fieldset disabled={!canDecide}>
              <Card title="ELT decision" aside={!canDecide ? <span className="text-sm text-slate-600">ELT only</span> : undefined}>
                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <Field label="Decision" id="dec" hint={d.decision ? DECISION_HELP[d.decision] : "Not yet reviewed by ELT."}><select id="dec" className="field" value={d.decision ?? ""} onChange={(e) => set("decision", (e.target.value || null) as EltDecision | null)}><option value="">Not yet reviewed</option>{DECISIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Priority" id="pri" hint="1 = highest"><input id="pri" type="number" min={1} className="field" value={d.priority ?? ""} onChange={(e) => set("priority", e.target.value ? Number(e.target.value) : null)} /></Field>
                </div>
                <Field label="Reason" id="rat"><input id="rat" className="field" value={d.rationale} onChange={(e) => set("rationale", e.target.value)} maxLength={400} placeholder="One line is enough" /></Field>
              </Card>
            </fieldset>
          )}

          {!isNew && (
            <Card title="Change history">
              {!history && <p className="text-sm text-slate-600">Loading…</p>}
              {history?.length === 0 && <p className="text-sm text-slate-600">No changes recorded yet.</p>}
              <ol className="space-y-3">{history?.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue" aria-hidden="true" />
                  <div><p className="text-sm"><strong>{h.changed_by_name}</strong> <span className="text-slate-600">· {new Date(h.changed_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></p>
                    <p className="text-sm text-slate-700">{describe(h, teams)}</p></div>
                </li>))}</ol>
            </Card>
          )}
        </form>

        <footer className="flex items-center gap-3 border-t border-slate-200 bg-white px-6 py-3">
          {project && canDelete && <button type="button" className="btn text-red-800" disabled={busy} onClick={async () => { if (confirm(`Remove "${project.name}" from the Big Plan?`)) { const e = await onDelete(project); if (e) setErr(e); else onClose(); } }}>Remove</button>}
          {err && <p role="alert" className="text-sm font-semibold text-red-800">{err}</p>}
          <span className="flex-1" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="drawer-form" className="btn btn-primary min-w-[120px] justify-center" disabled={busy || (!canEdit && !canDecide)}>{busy ? "Saving…" : isNew ? "Add project" : "Save changes"}</button>
        </footer>
      </aside>
    </>
  );
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-base font-bold text-navy">{title}</h3>{aside}</div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, id, hint, required, children }: { label: string; id: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">{label}{required && <span className="text-red-700" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

function pick(p: Project): ProjectDraft {
  const { id, ref, name, purpose, lead_team_id, owner, start_date, end_date, status, impact_regulatory, impact_financial, impact_customer, impact_foundations, impact_digital, decision, priority, rationale, notes, confirmed, rag, team_ids } = p;
  return { id, ref, name, purpose, lead_team_id, owner, start_date, end_date, status, impact_regulatory, impact_financial, impact_customer, impact_foundations, impact_digital, decision, priority, rationale, notes, confirmed, rag, team_ids };
}

const LABELS: Record<string, string> = { ref: "Reference", rag: "Traffic light", name: "Name", purpose: "What it delivers", lead_team_id: "Lead team", owner: "Owner", start_date: "Start", end_date: "End", status: "Status", decision: "ELT decision", priority: "Priority", rationale: "Reason", notes: "Notes", confirmed: "Confirmed",
  impact_regulatory: "Regulatory impact", impact_financial: "Financial impact", impact_customer: "Customer impact", impact_foundations: "Foundations impact", impact_digital: "Digital impact" };

function describe(h: HistoryRow, teams: Team[]): string {
  const tn = (id: unknown) => teams.find((t) => t.id === id)?.name ?? String(id);
  if (h.action === "created") return "Added the project to the plan";
  if (h.action === "removed") return "Removed the project";
  if (h.action === "team_added") return `Added ${tn((h.changes as { team_id: string }).team_id)}`;
  if (h.action === "team_removed") return `Removed ${tn((h.changes as { team_id: string }).team_id)}`;
  const parts = Object.entries(h.changes as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => {
    const fmt = (x: unknown) => x === null || x === "" ? "blank" : k === "lead_team_id" ? tn(x) : k.startsWith("impact_") ? (LEVELS[Number(x)] === "—" ? "None" : LEVELS[Number(x)]) : typeof x === "boolean" ? (x ? "Yes" : "No") : String(x);
    return k === "notes" || k === "purpose" || k === "rationale" ? `${LABELS[k] ?? k} updated` : `${LABELS[k] ?? k}: ${fmt(v.from)} → ${fmt(v.to)}`;
  });
  return parts.join(" · ");
}
