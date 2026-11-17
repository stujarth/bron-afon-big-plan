"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project, Role, Team } from "@/lib/types";
import { ORG_TEAM } from "@/lib/types";
import type { View } from "./BigPlan";

interface Topic { id: string; title: string; roles?: Role[]; steps: React.ReactNode[]; tip?: React.ReactNode; go?: View }

const TOPICS: Topic[] = [
  { id: "start", title: "Signing in", steps: [
    <>Go to the Big Plan address and enter your <strong>@bronafon.org.uk</strong> email and password.</>,
    <>The first time, you&apos;ll be asked to choose your own password — at least 12 characters. Three unrelated words is easier to remember than symbols.</>,
    <>Forgotten it? Ask an admin to <strong>reset your password</strong> from ⚙ People. You&apos;ll get a new temporary one.</>] },
  { id: "find", title: "Finding your projects", go: "plan", steps: [
    <>Open <strong>Projects</strong>. Everything is grouped by lead team.</>,
    <>Type in <strong>Search</strong>, or choose your team from <strong>All lead teams</strong>.</>,
    <>Tick <strong>Still to confirm</strong> to see only rows that need checking.</>,
    <>The numbers along the top (red, amber, still to confirm…) can be clicked to list those projects.</>] },
  { id: "update", title: "Updating a project", roles: ["editor", "elt", "admin"], go: "plan", steps: [
    <>Click the project. A panel opens on the right.</>,
    <>Change what has moved — usually the <strong>Status</strong>, a <strong>date</strong> or the <strong>traffic light</strong>.</>,
    <>If the row is now correct, tick <strong>Confirmed by the lead</strong>.</>,
    <>Press <strong>Save</strong>. Everyone else sees the change straight away. Every change is recorded in <em>Change history</em> at the bottom of the panel.</>],
    tip: <>A quick update before each OLT is all it takes — most weeks that&apos;s one or two clicks.</> },
  { id: "add", title: "Adding a project", roles: ["editor", "elt", "admin"], go: "plan", steps: [
    <>On <strong>Projects</strong>, press <strong>Add project</strong>.</>,
    <>Give it a name and, in one line, <strong>what it delivers</strong> — the benefit, not the activity.</>,
    <>Choose the <strong>lead team</strong>, the accountable Director or Head of Service, and any <strong>other teams</strong> whose time it needs. Pick <strong>Whole organisation</strong> if it touches everyone.</>,
    <>Add a start and end date, rate the five impact areas, then <strong>Save</strong>. The reference (BP-001, BP-002…) is given automatically.</>] },
  { id: "rag", title: "Traffic lights explained", steps: [
    <><span className="pill bg-emerald-600 text-white">On track</span> — the lead is confident and nothing is due within 30 days.</>,
    <><span className="pill bg-amber-400 text-amber-950">Amber</span> or <span className="pill bg-amber-400 text-amber-950">Ends soon</span> — the lead has flagged a risk, or the end date is within 30 days.</>,
    <><span className="pill bg-red-600 text-white">Red</span> or <span className="pill bg-red-600 text-white">Overdue</span> — the lead says it&apos;s in trouble, or the end date has passed.</>,
    <><span className="pill bg-slate-300 text-slate-700">Complete</span> / <span className="pill bg-slate-300 text-slate-700">Paused</span> — not counted as live.</>],
    tip: <>The lead sets Green, Amber or Red; the dates can only make it worse, never better.</> },
  { id: "roadmap", title: "Reading the roadmap", go: "roadmap", steps: [
    <>Open <strong>Roadmap</strong>. Each bar is a project, coloured by its lead team.</>,
    <>Use <strong>Months / Quarters / 3 years</strong> to zoom, and <strong>◄ Earlier / Today / Later ►</strong> to move along. The green line is today.</>,
    <>Click a <strong>column heading</strong> to list everything live then, a <strong>team name</strong> for that team&apos;s projects, or a <strong>bar</strong> to open the project.</>] },
  { id: "capacity", title: "Checking team capacity", go: "capacity", steps: [
    <>Open <strong>Capacity</strong>. Each number is how many live projects a team is carrying that quarter. Darker means busier.</>,
    <>The top grid counts projects a team <strong>leads</strong>; the bottom one counts everything it <strong>leads or supports</strong>.</>,
    <>Click any number to see exactly which projects make it up.</>] },
  { id: "decide", title: "Recording ELT decisions", roles: ["elt", "admin"], go: "prioritise", steps: [
    <>Open <strong>Decisions</strong>. <strong>Make decisions</strong> shows what&apos;s still to decide, highest impact first. Use the filters and <strong>Sort by</strong> to narrow it down.</>,
    <>Choose <strong>Progress</strong>, <strong>Pause</strong>, <strong>Re-sequence</strong>, <strong>Deprioritise</strong> or <strong>Stop</strong>, and add a one-line reason. Click the same button again to clear it.</>,
    <><strong>Re-sequence</strong> means &ldquo;keep it, but move it&rdquo; — new date boxes appear on the card so you can set where it lands.</>,
    <>Put the go-ahead work in order with <strong>▲ ▼</strong> — on each card, or on the <strong>Set priority order</strong> tab where you can also drag rows. Every move saves straight away; number 1 is the highest priority.</>],
    tip: <>Pause, Deprioritise and Stop take the project off the roadmap and out of the capacity counts immediately.</> },
  { id: "reports", title: "Reports and downloads", go: "reports", steps: [
    <>Open <strong>Reports</strong> for the headline numbers, broken down by team, status and decision.</>,
    <><strong>Download as Excel</strong> gives three sheets: Projects, Capacity and ELT decisions.</>,
    <><strong>Print or save as PDF</strong> gives a clean printable page — choose &ldquo;Save as PDF&rdquo; in the print window.</>] },
  { id: "screen", title: "Screen size, meeting rooms and full screen", steps: [
    <>Use <strong>A−</strong> and <strong>A+</strong> at the top right to make everything smaller or bigger. Click the percentage to go back to normal. Your choice is remembered on this computer.</>,
    <>Press <strong>Full screen</strong> at the top right to hide the menus. Press <strong>Esc</strong> to come back.</>,
    <>For a screen left running, sign in with the read-only account and open the address ending <strong>/display</strong>. It updates by itself as people make changes.</>] },
  { id: "teams", title: "Setting up teams", roles: ["elt", "admin"], go: "teams", steps: [
    <>Open <strong>⚙ Teams</strong>.</>,
    <>To add one, type the name, pick a colour and press <strong>Add team</strong>. Text colour is chosen for you so it stays readable.</>,
    <>Rename by typing over the name; reorder with ▲ ▼; untick <strong>Active</strong> to retire a team you no longer need. Retired teams keep their history.</>] },
  { id: "people", title: "Adding people", roles: ["admin"], go: "people", steps: [
    <>Open <strong>⚙ People</strong>. Enter a name and a <strong>@bronafon.org.uk</strong> email, choose what they can do, and press <strong>Add person</strong>.</>,
    <>A temporary password appears once. Pass it on by phone or Teams, not email. They choose their own the first time they sign in.</>,
    <>Change what someone can do with the <strong>Can</strong> dropdown, or <strong>Reset password</strong> if they&apos;re locked out.</>] },
];

const ROLE_TABLE: [string, string, string, string, string][] = [
  ["", "Can view", "Can edit", "ELT", "Admin"],
  ["See every screen and download reports", "✓", "✓", "✓", "✓"],
  ["Add and update projects", "", "✓", "✓", "✓"],
  ["Record ELT decisions", "", "", "✓", "✓"],
  ["Manage teams", "", "", "✓", "✓"],
  ["Add people, remove projects", "", "", "", "✓"],
];

export default function Guide({ role, teams, projects, supabase, onGo, onReplay }: { role: Role; teams: Team[]; projects: Project[]; supabase: SupabaseClient; onGo: (v: View) => void; onReplay: () => void }) {
  const [people, setPeople] = useState<number | null>(null);
  const isAdmin = role === "admin", canSetUp = role === "admin" || role === "elt";
  useEffect(() => { if (isAdmin) supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count }) => setPeople(count ?? 0)); }, [isAdmin, supabase]);
  const topics = TOPICS.filter((t) => !t.roles || t.roles.includes(role));
  const live = projects.filter((p) => p.status !== "Complete");
  const checks = [
    { done: teams.filter((t) => t.active && t.id !== ORG_TEAM).length >= 3, label: "Teams are set up", hint: "At least three active teams, each with its own colour.", go: "teams" as View },
    ...(isAdmin ? [{ done: (people ?? 0) >= 3, label: "People have been added", hint: "Directors and Heads of Service have their own sign-in.", go: "people" as View }] : []),
    { done: projects.length > 0, label: "Projects are on the plan", hint: "At least one project has been added.", go: "plan" as View },
    { done: projects.length > 0 && projects.every((p) => p.lead_team_id && p.start_date && p.end_date), label: "Every project has a lead team and dates", hint: "Projects without dates don't appear on the roadmap.", go: "plan" as View },
    { done: projects.length > 0 && projects.every((p) => p.confirmed), label: "Every project has been confirmed by its lead", hint: "Use the 'Still to confirm' filter to find the rest.", go: "plan" as View },
    { done: live.length > 0 && live.every((p) => p.decision), label: "ELT have made a decision on every live project", hint: "Work through the Decisions tab, highest impact first.", go: "prioritise" as View },
  ];
  const doneCount = checks.filter((c) => c.done).length;

  return (
    <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <nav aria-label="Guide topics" className="lg:sticky lg:top-40 lg:self-start">
        <h2 className="mb-2 text-lg font-bold text-navy">Guide</h2>
        <ul className="space-y-0.5">
          {canSetUp && <li><a href="#setup" className="block rounded px-2 py-1.5 font-semibold text-blue hover:bg-lblue">Setting up checklist</a></li>}
          {topics.map((t) => <li key={t.id}><a href={`#${t.id}`} className="block rounded px-2 py-1.5 hover:bg-lblue">{t.title}</a></li>)}
          <li><a href="#roles" className="block rounded px-2 py-1.5 hover:bg-lblue">Who can do what</a></li>
        </ul>
        <button className="btn mt-4 w-full justify-center" onClick={onReplay}>Replay the welcome tour</button>
      </nav>

      <div className="max-w-4xl space-y-6">
        {canSetUp && (
          <article id="setup" className="scroll-mt-40 rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-1 flex items-baseline justify-between gap-4"><h3 className="text-xl font-bold text-navy">Setting up checklist</h3><span className="text-sm font-semibold text-slate-600">{doneCount} of {checks.length} done</span></div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true"><div className="h-full rounded-full bg-green" style={{ width: `${(doneCount / checks.length) * 100}%` }} /></div>
            <ul className="divide-y divide-slate-200">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-4 py-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${c.done ? "bg-emerald-600 text-white" : "border-2 border-slate-300 text-slate-500"}`} aria-label={c.done ? "Done" : "Not done yet"}>{c.done ? "✓" : ""}</span>
                  <div className="flex-1"><p className={`font-semibold ${c.done ? "text-slate-600 line-through decoration-slate-400" : ""}`}>{c.label}</p><p className="text-sm text-slate-600">{c.hint}</p></div>
                  {!c.done && <button className="btn" onClick={() => onGo(c.go)}>Go there</button>}
                </li>))}
            </ul>
          </article>
        )}

        {topics.map((t) => (
          <article key={t.id} id={t.id} className="scroll-mt-40 rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-baseline justify-between gap-4"><h3 className="text-xl font-bold text-navy">{t.title}</h3>{t.go && <button className="btn btn-quiet" onClick={() => onGo(t.go!)}>Take me there →</button>}</div>
            <ol className="space-y-2.5">{t.steps.map((s, i) => (
              <li key={i} className="flex gap-3 leading-relaxed"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lblue text-sm font-bold text-blue">{i + 1}</span><span className="pt-0.5">{s}</span></li>))}</ol>
            {t.tip && <p className="mt-4 rounded-lg bg-lblue px-4 py-3 text-sm"><strong>Tip:</strong> {t.tip}</p>}
          </article>
        ))}

        <article id="roles" className="scroll-mt-40 rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="mb-3 text-xl font-bold text-navy">Who can do what</h3>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse">
            <thead><tr>{ROLE_TABLE[0].map((h, i) => <th key={i} className={`border-b border-slate-200 px-3 py-2 text-sm ${i ? "text-center" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody>{ROLE_TABLE.slice(1).map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`border-b border-slate-200 px-3 py-2 ${i ? "text-center font-bold text-emerald-700" : ""}`}>{c}</td>)}</tr>)}</tbody>
          </table></div>
          <p className="mt-3 text-sm text-slate-600">You are signed in as: <strong>{{ viewer: "Can view", editor: "Can edit", elt: "ELT", admin: "Admin" }[role]}</strong>.</p>
        </article>
      </div>
    </section>
  );
}
