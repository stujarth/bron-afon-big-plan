"use client";
import { useState } from "react";
import type { Project, Team } from "@/lib/types";
import { fiscalLabel, isCurrent, isoDate, overlaps, formatShort, type Quarter } from "@/lib/quarters";
import { health, isOffRoadmap } from "@/lib/plan";
import { HealthDot, Help, SectionTitle, Segmented, TeamTag } from "./ui";
import type { Drill } from "./DrillDown";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_ITEMS = 6;

function fyQuarters(fyStartYear: number): Quarter[] {
  return [0, 1, 2, 3].map((i) => {
    const start = new Date(fyStartYear, 3 + i * 3, 1), end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    return { start, end, label: fiscalLabel(start), range: `${MONTHS[start.getMonth()]}–${MONTHS[end.getMonth()]} ${String(end.getFullYear()).slice(2)}` };
  });
}
const fyName = (y: number) => `${y}/${String(y + 1).slice(2)}`;

/** Quarterly calendar: for each quarter of one or two financial years, what starts, what finishes, what is in flight. */
export default function Calendar({ projects, teams, today, onDrill, onOpen, compact = false }: { projects: Project[]; teams: Team[]; today: Date; onDrill: (d: Drill) => void; onOpen: (p: Project) => void; compact?: boolean }) {
  const thisFy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const [fy, setFy] = useState(thisFy);
  const [years, setYears] = useState<1 | 2>(2);
  const live = projects.filter((p) => !isOffRoadmap(p));
  const t = (id: string | null) => teams.find((x) => x.id === id);
  const fys = years === 2 ? [fy, fy + 1] : [fy];

  return (
    <section>
      <SectionTitle sub="A quarter-by-quarter view of what starts, what finishes and what is in flight.">Quarterly calendar — {years === 2 ? `${fyName(fy)} and ${fyName(fy + 1)}` : fyName(fy)}</SectionTitle>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented value={years} onChange={setYears} options={[{ v: 1, label: "1 year" }, { v: 2, label: "2 years" }]} />
        <div className="seg" role="group" aria-label="Financial year">
          <button onClick={() => setFy(fy - 1)} aria-label="Earlier year">◄ Earlier</button><button onClick={() => setFy(thisFy)}>This year</button><button onClick={() => setFy(fy + 1)} aria-label="Later year">Later ►</button>
        </div>
      </div>
      {!compact && <Help>Each card is a quarter of Bron Afon&apos;s financial year (April to March). Click a heading to see everything live in that quarter, or a project to open it. Paused, deprioritised and stopped work is left out.</Help>}
      <div className="space-y-6">
        {fys.map((y) => (
          <div key={y}>
            {years === 2 && <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-navy">Financial year {fyName(y)}{y === thisFy && <span className="pill bg-emerald-100 text-emerald-900">this year</span>}</h3>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {fyQuarters(y).map((q) => {
                const qa = isoDate(q.start), qb = isoDate(q.end);
                const inQ = live.filter((p) => overlaps(p, q));
                const starting = live.filter((p) => p.start_date && p.start_date >= qa && p.start_date <= qb);
                const finishing = live.filter((p) => p.end_date && p.end_date >= qa && p.end_date <= qb);
                const now = isCurrent(q, today);
                return (
                  <div key={q.label} className={`flex flex-col rounded-lg border bg-white ${now ? "border-green shadow-[0_0_0_3px_rgba(0,178,89,.15)]" : "border-slate-200"}`}>
                    <button onClick={() => onDrill({ title: `Live in ${q.label}`, sub: q.range, projects: inQ })} className="flex w-full items-baseline justify-between rounded-t-lg border-b border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-lblue" title="Show everything live in this quarter">
                      <span className="text-base font-bold">{q.label} {now && <span className="ml-1 text-xs font-semibold text-emerald-700">now</span>}</span>
                      <span className="text-xs text-slate-600">{q.range} · <strong>{inQ.length}</strong> live</span>
                    </button>
                    <div className="flex-1 p-4">
                      <List label="Starting" items={starting} t={t} today={today} onOpen={onOpen} onMore={() => onDrill({ title: `Starting in ${q.label}`, sub: q.range, projects: starting })} empty="Nothing starts" />
                      <List label="Finishing" items={finishing} t={t} today={today} onOpen={onOpen} onMore={() => onDrill({ title: `Finishing in ${q.label}`, sub: q.range, projects: finishing })} empty="Nothing finishes" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function List({ label, items, t, today, onOpen, onMore, empty }: { label: string; items: Project[]; t: (id: string | null) => Team | undefined; today: Date; onOpen: (p: Project) => void; onMore: () => void; empty: string }) {
  const shown = items.slice(0, MAX_ITEMS), extra = items.length - shown.length;
  return (
    <div className="mb-3 last:mb-0">
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">{label} <span className="font-normal normal-case">({items.length})</span></h4>
      {items.length === 0 ? <p className="text-xs text-slate-500">{empty}</p> : (
        <ul className="space-y-1">
          {shown.map((p) => (
            <li key={p.id}><button onClick={() => onOpen(p)} className="flex w-full items-start gap-2 rounded px-1.5 py-1.5 text-left text-sm hover:bg-lblue">
              <span className="mt-1.5 shrink-0"><HealthDot h={health(p, today)} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{p.name}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2"><span className="min-w-0 truncate"><TeamTag team={t(p.lead_team_id)} small /></span><span className="shrink-0 whitespace-nowrap text-xs text-slate-600">{label === "Starting" ? formatShort(p.start_date) : formatShort(p.end_date)}</span></span>
              </span>
            </button></li>))}
          {extra > 0 && <li><button onClick={onMore} className="px-1.5 py-1 text-sm font-semibold text-blue hover:underline">+ {extra} more</button></li>}
        </ul>
      )}
    </div>
  );
}
