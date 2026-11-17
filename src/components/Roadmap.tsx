"use client";
import { useMemo, useState } from "react";
import type { Project, Team } from "@/lib/types";
import { formatShort, isCurrent, isoDate, overlaps, ZOOMS, type Quarter, type Zoom } from "@/lib/quarters";
import { health, isOffRoadmap, sortForRoadmap } from "@/lib/plan";
import { HealthDot, Help, SectionTitle, TeamTag } from "./ui";
import type { Drill } from "./DrillDown";

export default function Roadmap({ projects, teams, qs, today, onOpen, onShift, onDrill, zoom, onZoom, compact = false }: { projects: Project[]; teams: Team[]; qs: Quarter[]; today: Date; compact?: boolean; onOpen: (p: Project) => void; onShift: (d: -1 | 0 | 1) => void; onDrill: (d: Drill) => void; zoom: Zoom; onZoom: (z: Zoom) => void }) {
  const [hide, setHide] = useState(true);
  const [teamFilter, setTeamFilter] = useState("");
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const first = isoDate(qs[0].start), last = isoDate(qs[qs.length - 1].end);
  const rows = sortForRoadmap(projects, teams).filter((p) => p.start_date && p.end_date && (!hide || !isOffRoadmap(p)) && (!teamFilter || p.lead_team_id === teamFilter) && p.start_date <= last && p.end_date >= first);
  let lastTeam: string | null | undefined = undefined;
  const n = qs.length, dense = n > 6;
  // Position of today as a fraction across the columns (for the vertical marker)
  const span = qs[n - 1].end.getTime() - qs[0].start.getTime();
  const todayPct = Math.max(0, Math.min(1, (today.getTime() - qs[0].start.getTime()) / span));
  const gridCols = `minmax(${dense ? 260 : 340}px,1.3fr) repeat(${n}, minmax(${dense ? 56 : 96}px,1fr))`;

  return (
    <section>
      <SectionTitle sub="Who is doing what, and when. Zoom in for month-by-month detail or out for the three-year picture. Click a heading or team name for the list behind it; click a bar to open the project.">Roadmap — {qs[0].label} to {qs[qs.length - 1].label}</SectionTitle>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="seg" role="group" aria-label="Zoom">{ZOOMS.map((z) => <button key={z.id} data-on={zoom === z.id} title={z.hint} onClick={() => onZoom(z.id)}>{z.label}</button>)}</div>
        <div className="seg" role="group" aria-label="Move the window">
          <button onClick={() => onShift(-1)} aria-label="Earlier">◄ Earlier</button><button onClick={() => onShift(0)}>Today</button><button onClick={() => onShift(1)} aria-label="Later">Later ►</button>
        </div>
        <select className="field !w-auto" aria-label="Show one team" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}><option value="">All teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {!compact && <label className="chip" data-on={hide}><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Hide paused, deprioritised and complete</label>}
      </div>
      {!compact && <Help>Bar colour is the lead team. The dot before each name is its traffic light: <strong className="text-emerald-700">green</strong> on track, <strong className="text-amber-600">amber</strong> at risk or ending within 30 days, <strong className="text-red-700">red</strong> in trouble or overdue. ◄ ► mean the work runs beyond the window shown.</Help>}
      <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className={`relative grid ${dense ? "min-w-[1000px]" : "min-w-[920px]"} ${compact ? "text-base" : ""}`} style={{ gridTemplateColumns: gridCols }}>
          {todayPct > 0 && todayPct < 1 && <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-green/70" style={{ left: `calc(${dense ? 260 : 340}px + (100% - ${dense ? 260 : 340}px) * ${todayPct.toFixed(4)})` }} title="Today" />}
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-bold">Project</div>
          {qs.map((q) => (
            <button key={q.label} onClick={() => onDrill({ title: `Live in ${q.label}`, sub: q.range, projects: projects.filter((p) => !isOffRoadmap(p) && overlaps(p, q)) })}
              className={`border-b border-l border-slate-200 bg-slate-50 px-1 py-2 text-center font-bold hover:bg-lblue ${dense ? "text-xs" : ""} ${isCurrent(q, today) ? "shadow-[inset_0_3px_0_#00B259]" : ""}`} title="Show everything live in this period">
              {q.label}{!dense && <small className="block text-xs font-normal text-slate-600">{q.range}</small>}</button>
          ))}
          {rows.length === 0 && <div className="col-span-full p-8 text-center text-slate-600">Nothing with dates falls in this window.</div>}
          {rows.map((p) => {
            const group = p.lead_team_id !== lastTeam; lastTeam = p.lead_team_id;
            const team = teamById.get(p.lead_team_id ?? ""); const off = isOffRoadmap(p);
            const act = qs.map((q) => overlaps(p, q)); const fi = act.indexOf(true), li = act.lastIndexOf(true);
            return [
              group && (
                <button key={`g-${p.lead_team_id}`} className="col-span-full flex items-center gap-2 border-t-2 border-slate-300 bg-slate-50 px-3 py-1.5 text-left hover:bg-lblue"
                  onClick={() => onDrill({ title: team?.name ?? "Unassigned", sub: "All projects this team is leading", projects: projects.filter((x) => x.lead_team_id === p.lead_team_id) })} title="Show this team's projects">
                  <TeamTag team={team} small /><span className="text-xs text-slate-600">{rows.filter((x) => x.lead_team_id === p.lead_team_id).length} in window</span></button>
              ),
              <div key={`l-${p.id}`} className={`flex items-center gap-2 border-b border-slate-200 px-3 ${dense ? "py-0.5 text-xs" : "py-1.5 text-sm"} ${off ? "text-slate-500" : "font-semibold"}`}><HealthDot h={health(p, today)} /><span className="min-w-[52px] text-xs font-normal text-slate-600">{p.ref}</span>{p.name}</div>,
              ...qs.map((q, i) => (
                <div key={`${p.id}-${i}`} className={`flex items-center border-b border-l border-slate-200 px-0.5 ${dense ? "py-0.5" : "py-1"} ${isCurrent(q, today) ? "bg-green/5" : ""}`}>
                  {act[i] && (
                    <button onClick={() => onOpen(p)} title={`${p.name} · ${formatShort(p.start_date)} – ${formatShort(p.end_date)} · ${p.status}${p.decision ? ` · ELT: ${p.decision}` : ""}`}
                      className={`flex h-6 w-full items-center justify-between px-1.5 text-xs font-bold ${i === fi ? "ml-1 rounded-l" : ""} ${i === li ? "mr-1 rounded-r" : ""}`}
                      style={off ? { background: "#B7BDC3", color: "#fff" } : { background: team?.colour, color: team?.text_colour }}>
                      <span>{i === fi && p.start_date! < first ? "◄" : ""}</span>
                      <span className="opacity-85">{i === li ? (p.end_date! > last ? "►" : dense ? "" : formatShort(p.end_date).slice(3)) : ""}</span>
                    </button>
                  )}
                </div>
              )),
            ];
          })}
        </div>
      </div>
    </section>
  );
}
