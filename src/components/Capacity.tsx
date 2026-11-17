"use client";
import type { Project, Team } from "@/lib/types";
import { ORG_TEAM } from "@/lib/types";
import { overlaps, type Quarter } from "@/lib/quarters";
import { capacity, involves, isOffRoadmap } from "@/lib/plan";
import { Help, SectionTitle, TeamTag } from "./ui";
import type { Drill } from "./DrillDown";

export default function Capacity({ projects, teams, qs, compact = false, onDrill }: { projects: Project[]; teams: Team[]; qs: Quarter[]; compact?: boolean; onDrill: (d: Drill) => void }) {
  const visible = teams.filter((t) => t.id !== ORG_TEAM);
  const lead = capacity(projects, visible, qs, (p, t) => p.lead_team_id === t);
  const all = capacity(projects, visible, qs, involves);
  const live = projects.filter((p) => !isOffRoadmap(p));
  const drill = (team: Team | null, q: Quarter, mode: "lead" | "all") => onDrill({
    title: team ? `${team.name} — ${q.label}` : `All live projects — ${q.label}`,
    sub: team ? (mode === "lead" ? "Projects this team is leading in the quarter" : "Projects this team is leading or supporting in the quarter") : q.range,
    projects: live.filter((p) => overlaps(p, q) && (!team || (mode === "lead" ? p.lead_team_id === team.id : involves(p, team.id)))),
  });
  return (
    <section>
      <SectionTitle sub="How many live projects each team is carrying in each quarter. Click any number to see which projects.">Capacity</SectionTitle>
      {!compact && <Help>Counts projects whose dates overlap the quarter. Paused, complete, or ELT-decided Pause / Deprioritise / Stop are left out. Projects marked <strong>Whole organisation</strong> count for every team. Darker means busier.</Help>}
      <Grid title="Leading" sub="Projects where this team is the lead" data={lead} qs={qs} onCell={(t, q) => drill(t, q, "lead")} onTotal={(q) => drill(null, q, "all")} />
      <Grid title="Leading or supporting" sub="Everything that draws on this team's time" data={all} qs={qs} onCell={(t, q) => drill(t, q, "all")} onTotal={(q) => drill(null, q, "all")} />
    </section>
  );
}

function Grid({ title, sub, data, qs, onCell, onTotal }: { title: string; sub: string; data: ReturnType<typeof capacity>; qs: Quarter[]; onCell: (t: Team, q: Quarter) => void; onTotal: (q: Quarter) => void }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold">{title} <span className="font-normal text-slate-600">— {sub}</span></h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-center">
          <thead><tr className="text-xs text-slate-600"><th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Team</th>{qs.map((q) => <th key={q.label} className="border-b border-slate-200 px-3 py-2 font-semibold">{q.label}<small className="block font-normal">{q.range}</small></th>)}<th className="border-b border-slate-200 px-3 py-2 font-semibold">Busiest</th></tr></thead>
          <tbody>{data.rows.map(({ team, counts, peak }) => (
            <tr key={team.id}><td className="border-b border-slate-200 px-3 py-1.5 text-left"><TeamTag team={team} /></td>
              {counts.map((v, i) => { const a = v ? 0.15 + 0.85 * (v / data.max) : 0; return (
                <td key={i} className="border-b border-slate-200 p-0">
                  <button disabled={!v} onClick={() => onCell(team, qs[i])} className={`h-full w-full px-3 py-2 font-bold ${a > 0.6 ? "text-white" : ""} ${v ? "hover:ring-2 hover:ring-inset hover:ring-navy" : ""}`} style={{ background: v ? `rgba(0,125,195,${a.toFixed(2)})` : undefined }} aria-label={v ? `${v} projects for ${team.name} in ${qs[i].label} — show them` : "none"}>{v || ""}</button>
                </td>); })}
              <td className="border-b border-slate-200 px-3 py-1.5 font-bold">{peak || ""}</td></tr>
          ))}</tbody>
          <tfoot><tr className="bg-slate-50 font-bold"><td className="border-t-2 border-slate-300 px-3 py-2 text-left">All live projects</td>{data.totals.map((t, i) => <td key={i} className="border-t-2 border-slate-300 p-0"><button onClick={() => onTotal(qs[i])} className="w-full px-3 py-2 hover:ring-2 hover:ring-inset hover:ring-navy">{t}</button></td>)}<td className="border-t-2 border-slate-300" /></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
