"use client";
import { useMemo, useState } from "react";
import type { Project, Team } from "@/lib/types";
import { IMPACT_FIELDS, STATUSES } from "@/lib/types";
import { formatShort } from "@/lib/quarters";
import { health, sortForRoadmap } from "@/lib/plan";
import { DecisionPill, HealthPill, Help, ImpactDots, SectionTitle, StatusPill, TeamTag } from "./ui";

export default function PlanTable({ projects, teams, canEdit, onOpen, onAdd, compact = false, today }: { projects: Project[]; teams: Team[]; canEdit: boolean; compact?: boolean; today: Date; onOpen: (p: Project) => void; onAdd: () => void }) {
  const [q, setQ] = useState(""); const [team, setTeam] = useState(""); const [status, setStatus] = useState(""); const [unconf, setUnconf] = useState(false);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sortForRoadmap(projects, teams).filter((p) =>
      (!s || `${p.ref} ${p.name} ${p.purpose} ${p.owner}`.toLowerCase().includes(s)) && (!team || p.lead_team_id === team) && (!status || p.status === status) && (!unconf || !p.confirmed));
  }, [projects, teams, q, team, status, unconf]);

  let lastTeam: string | null | undefined = undefined;
  return (
    <section aria-labelledby="plan-h">
      <SectionTitle sub="One row per project or significant piece of work. Click a row to open it.">Projects</SectionTitle>
      {!compact && <Help><strong>Directors and Heads of Service:</strong> keep your rows current — a status change or a date is usually all it takes. Rows with a <span className="inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" aria-hidden="true" /> still need the lead to confirm them. Use <strong>Add project</strong> for anything significant that is missing.</Help>}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input type="search" className="field !w-auto min-w-[240px]" placeholder="Search projects…" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field !w-auto" aria-label="Filter by lead team" value={team} onChange={(e) => setTeam(e.target.value)}><option value="">All lead teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="field !w-auto" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <label className="chip" data-on={unconf}><input type="checkbox" checked={unconf} onChange={(e) => setUnconf(e.target.checked)} /> Still to confirm</label>
        <span className="flex-1" />
        {canEdit && <button className="btn btn-primary" onClick={onAdd}>Add project</button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead><tr className="text-left text-xs text-slate-600">
            {["Project", "Owner", "Other teams", "Start", "End", "Status", "Traffic light", "Impact", "ELT decision"].map((h) => <th key={h} className={`sticky top-0 bg-white px-3 py-2.5 font-semibold border-b border-slate-200 `}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-slate-600">{projects.length ? "Nothing matches those filters." : "No projects yet."}</td></tr>}
            {rows.map((p) => {
              const group = p.lead_team_id !== lastTeam; lastTeam = p.lead_team_id;
              return [
                group && (
                  <tr key={`g-${p.lead_team_id}`} className="bg-slate-50"><td colSpan={9} className="border-t-2 border-slate-300 px-3 py-2 text-sm font-bold">
                    <TeamTag team={teamById.get(p.lead_team_id ?? "")} /> <span className="ml-2 text-xs font-normal text-slate-600">{rows.filter((x) => x.lead_team_id === p.lead_team_id).length} projects</span></td></tr>
                ),
                <tr key={p.id} className="hover:bg-lblue focus-within:bg-lblue" onClick={() => onOpen(p)} onKeyDown={(e) => e.key === "Enter" && onOpen(p)} tabIndex={0}>
                  <td className="border-b border-slate-200 px-3 py-2 align-top font-semibold min-w-[220px]">
                    {!p.confirmed && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" title="Carried over — needs confirming" />}{p.name}
                    <small className="block font-normal text-slate-600 text-xs mt-0.5">{p.ref}{p.purpose ? ` · ${p.purpose}` : ""}</small></td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top">{p.owner}</td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top text-xs text-slate-600">{p.team_ids.map((t) => teamById.get(t)?.name).filter(Boolean).join(", ")}</td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top whitespace-nowrap">{formatShort(p.start_date)}</td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top whitespace-nowrap">{formatShort(p.end_date)}</td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top"><StatusPill status={p.status} /></td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top"><HealthPill h={health(p, today)} /></td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top whitespace-nowrap"><ImpactDots values={IMPACT_FIELDS.map(([k]) => p[k])} /> <b className="ml-1">{p.impact_score}</b></td>
                  <td className="border-b border-slate-200 px-3 py-2 align-top"><DecisionPill decision={p.decision} priority={p.priority} /></td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
