"use client";
import type { Project, Team } from "@/lib/types";
import { formatShort } from "@/lib/quarters";
import { health } from "@/lib/plan";
import { HealthPill, StatusPill, TeamTag } from "./ui";

export interface Drill { title: string; sub?: string; projects: Project[]; }

/** A panel listing the projects behind any number you click on. */
export default function DrillDown({ drill, teams, today, onClose, onOpen }: { drill: Drill; teams: Team[]; today: Date; onClose: () => void; onOpen?: (p: Project) => void }) {
  const t = (id: string | null) => teams.find((x) => x.id === id);
  return (
    <>
      <div className="fixed inset-0 z-30 bg-navy/45" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[640px] flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="dd-h">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex-1"><h2 id="dd-h" className="text-base font-bold">{drill.title}</h2>{drill.sub && <p className="text-xs text-slate-600">{drill.sub}</p>}</div>
          <span className="text-sm text-slate-600">{drill.projects.length} project{drill.projects.length === 1 ? "" : "s"}</span>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="flex-1 overflow-auto px-5 py-3">
          {drill.projects.length === 0 && <p className="py-10 text-center text-slate-600">Nothing here.</p>}
          <ul className="divide-y divide-slate-200">
            {drill.projects.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{p.name} <span className="text-xs font-normal text-slate-600">{p.ref}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <TeamTag team={t(p.lead_team_id)} small /><span>{p.owner}</span><span>{formatShort(p.start_date)} – {formatShort(p.end_date)}</span><StatusPill status={p.status} /><HealthPill h={health(p, today)} />
                    </div>
                    {p.team_ids.length > 0 && <div className="mt-1 text-xs text-slate-600">Also needs: {p.team_ids.map((id) => t(id)?.name).filter(Boolean).join(", ")}</div>}
                  </div>
                  {onOpen && <button className="btn btn-quiet" onClick={() => onOpen(p)}>Open</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
