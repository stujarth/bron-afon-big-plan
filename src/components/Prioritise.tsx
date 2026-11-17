"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EltDecision, Project, Team } from "@/lib/types";
import { DECISIONS, DECISION_HELP, IMPACT_FIELDS, LEVELS } from "@/lib/types";
import { formatShort } from "@/lib/quarters";
import { health } from "@/lib/plan";
import { DateField, HealthPill, SectionTitle, Segmented, StatusPill, TeamTag } from "./ui";

export type Patch = Partial<Pick<Project, "decision" | "priority" | "rationale" | "start_date" | "end_date">>;
type Update = (p: Project, patch: Patch, toast?: string) => Promise<string | null>;
const TONE: Record<EltDecision, string> = { Progress: "bg-emerald-700 text-white", Pause: "bg-maroon text-white", Deprioritise: "bg-maroon text-white", Stop: "bg-maroon text-white", "Re-sequence": "bg-amber-500 text-amber-950" };
const SORTS = [["impact", "Highest impact first"], ["priority", "ELT priority order"], ["ending", "Ending soonest"], ["starting", "Starting soonest"], ["name", "Name A–Z"]] as const;
type Sort = (typeof SORTS)[number][0];

/** Work ELT has agreed to go ahead with, in priority order (unranked items fall in by impact). */
function goAheadOrder(projects: Project[]): string[] {
  return projects.filter((p) => p.decision === "Progress" || p.decision === "Re-sequence")
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999) || b.impact_score - a.impact_score || a.name.localeCompare(b.name)).map((p) => p.id);
}
type Move = (id: string, dir: -1 | 1) => Promise<string | null>;

/** The same ▲ ▼ pattern as the Teams page: each click saves straight away. */
function OrderArrows({ label, canUp, canDown, onUp, onDown, disabled }: { label: string; canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void; disabled?: boolean }) {
  return (
    <span className="inline-flex whitespace-nowrap">
      <button type="button" className="btn btn-quiet !px-2" disabled={disabled || !canUp} onClick={onUp} aria-label={`Move ${label} up`} title="Move up">▲</button>
      <button type="button" className="btn btn-quiet !px-2" disabled={disabled || !canDown} onClick={onDown} aria-label={`Move ${label} down`} title="Move down">▼</button>
    </span>
  );
}

export default function Prioritise({ projects, teams, canDecide, onUpdate, onSetOrder, onOpen, today, compact = false }: { projects: Project[]; teams: Team[]; canDecide: boolean; compact?: boolean; today: Date; onUpdate: Update; onSetOrder: (ids: string[]) => Promise<string | null>; onOpen: (p: Project) => void }) {
  const [tab, setTab] = useState<"decide" | "order">("decide");
  const live = projects.filter((p) => p.status !== "Complete");
  const awaiting = live.filter((p) => !p.decision).length;
  const goAhead = useMemo(() => goAheadOrder(live), [live]); // eslint-disable-line react-hooks/exhaustive-deps
  const rankOf = new Map(goAhead.map((id, i) => [id, i + 1]));
  async function moveBy(id: string, dir: -1 | 1) {
    const i = goAhead.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= goAhead.length) return null;
    const next = [...goAhead]; [next[i], next[j]] = [next[j], next[i]];
    return onSetOrder(next);
  }
  return (
    <section>
      <SectionTitle sub="ELT decide what goes ahead, what waits and what stops — then put the go-ahead work in priority order.">Decisions</SectionTitle>
      {!compact && (
        <div className="mb-4 grid gap-2 rounded-lg border-l-4 border-blue bg-white p-4 text-sm shadow-sm sm:grid-cols-5">
          {DECISIONS.map((d) => <div key={d}><span className={`pill ${TONE[d]}`}>{d}</span><p className="mt-1 text-slate-700">{DECISION_HELP[d]}</p></div>)}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ v: "decide", label: `Make decisions${awaiting ? ` (${awaiting} to do)` : ""}` }, { v: "order", label: "Set priority order" }]} />
        {!canDecide && <span className="text-sm text-slate-600">Only ELT members can record decisions — you can see them here.</span>}
      </div>
      {tab === "decide" ? <DecideList projects={live} teams={teams} canDecide={canDecide} onUpdate={onUpdate} onOpen={onOpen} today={today} rankOf={rankOf} total={goAhead.length} onMove={moveBy} /> : <PriorityOrder projects={live} saved={goAhead} teams={teams} canDecide={canDecide} onSetOrder={onSetOrder} onOpen={onOpen} today={today} />}
    </section>
  );
}

function DecideList({ projects, teams, canDecide, onUpdate, onOpen, today, rankOf, total, onMove }: { projects: Project[]; teams: Team[]; canDecide: boolean; onUpdate: Update; onOpen: (p: Project) => void; today: Date; rankOf: Map<string, number>; total: number; onMove: Move }) {
  const [q, setQ] = useState(""); const [dec, setDec] = useState("todo"); const [team, setTeam] = useState(""); const [rag, setRag] = useState(""); const [sort, setSort] = useState<Sort>("impact");
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = projects.filter((p) => (!s || `${p.ref} ${p.name} ${p.owner}`.toLowerCase().includes(s))
      && (dec === "all" || (dec === "todo" ? !p.decision : p.decision === dec))
      && (!team || p.lead_team_id === team) && (!rag || health(p, today).tone === rag));
    const by: Record<Sort, (a: Project, b: Project) => number> = {
      impact: (a, b) => b.impact_score - a.impact_score || a.name.localeCompare(b.name),
      priority: (a, b) => (rankOf.get(a.id) ?? 9999) - (rankOf.get(b.id) ?? 9999) || b.impact_score - a.impact_score,
      ending: (a, b) => (a.end_date ?? "9").localeCompare(b.end_date ?? "9"),
      starting: (a, b) => (a.start_date ?? "9").localeCompare(b.start_date ?? "9"),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return out.sort(by[sort]);
  }, [projects, q, dec, team, rag, sort, today, rankOf]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Filter label="Search"><input type="search" className="field !w-[220px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ref or owner" /></Filter>
        <Filter label="Decision"><select className="field !w-auto" value={dec} onChange={(e) => setDec(e.target.value)}><option value="todo">Still to decide</option><option value="all">All</option>{DECISIONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Filter>
        <Filter label="Lead team"><select className="field !w-auto" value={team} onChange={(e) => setTeam(e.target.value)}><option value="">All teams</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Filter>
        <Filter label="Traffic light"><select className="field !w-auto" value={rag} onChange={(e) => setRag(e.target.value)}><option value="">Any</option><option value="red">Red</option><option value="amber">Amber</option><option value="green">Green</option></select></Filter>
        <Filter label="Sort by"><select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Filter>
        <span className="ml-auto self-center text-sm text-slate-600">{list.length} shown</span>
      </div>
      <div className="grid gap-3">
        {list.length === 0 && <p className="rounded-lg bg-white p-10 text-center text-slate-600">{dec === "todo" ? "Every live project has an ELT decision. 🎉" : "Nothing matches those filters."}</p>}
        {list.map((p) => <Card key={p.id} p={p} team={teamById.get(p.lead_team_id ?? "")} canDecide={canDecide} onUpdate={onUpdate} onOpen={onOpen} today={today} rank={rankOf.get(p.id) ?? null} total={total} onMove={onMove} />)}
      </div>
    </>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}

function Card({ p, team, canDecide, onUpdate, onOpen, today, rank, total, onMove }: { p: Project; team: Team | undefined; canDecide: boolean; onUpdate: Update; onOpen: (p: Project) => void; today: Date; rank: number | null; total: number; onMove: Move }) {
  const [rationale, setRationale] = useState(p.rationale); const [start, setStart] = useState(p.start_date); const [end, setEnd] = useState(p.end_date);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { setRationale(p.rationale); setStart(p.start_date); setEnd(p.end_date); }, [p.rationale, p.start_date, p.end_date]);
  const strong = IMPACT_FIELDS.filter(([k]) => p[k] >= 2).map(([k, l]) => `${l.split(" ")[0]} ${LEVELS[p[k]].toLowerCase()}`).join(", ");
  const datesChanged = start !== p.start_date || end !== p.end_date;
  async function run(patch: Patch, msg?: string) { setBusy(true); setErr(""); const e = await onUpdate(p, patch, msg); if (e) setErr(e); setBusy(false); }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[260px] flex-1">
          <h3 className="text-base font-bold">{p.name} <span className="text-sm font-normal text-slate-600">{p.ref}</span></h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600"><TeamTag team={team} small /><span>{p.owner}</span><span>{formatShort(p.start_date)} – {formatShort(p.end_date)}</span><StatusPill status={p.status} /><HealthPill h={health(p, today)} /></div>
          {(p.purpose || strong) && <p className="mt-2 text-sm">{p.purpose}{strong && <span className="text-slate-600"> · {strong}</span>}</p>}
        </div>
        {rank !== null && (
          <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <span className="text-xs font-semibold text-slate-600">Priority</span>
            <span className="flex items-center gap-1">
              {canDecide && <button type="button" className="btn btn-quiet !min-h-[32px] !px-2" disabled={busy || rank === 1} onClick={async () => { setBusy(true); const e = await onMove(p.id, -1); if (e) setErr(e); setBusy(false); }} aria-label={`Move ${p.name} up the priority order`} title="Higher priority">▲</button>}
              <b className="min-w-[2ch] text-center text-2xl leading-none text-navy">{rank}</b>
              {canDecide && <button type="button" className="btn btn-quiet !min-h-[32px] !px-2" disabled={busy || rank === total} onClick={async () => { setBusy(true); const e = await onMove(p.id, 1); if (e) setErr(e); setBusy(false); }} aria-label={`Move ${p.name} down the priority order`} title="Lower priority">▼</button>}
            </span>
            <span className="text-xs text-slate-600">of {total}</span>
          </div>
        )}
        <div className="text-center"><b className="block text-3xl leading-none text-navy">{p.impact_score}</b><small className="text-xs text-slate-600">impact / 15</small></div>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ELT decision">
          {DECISIONS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={p.decision === d} disabled={!canDecide || busy} title={DECISION_HELP[d]}
              onClick={() => run({ decision: p.decision === d ? null : d }, p.decision === d ? "Decision cleared" : `${p.name}: ${d}`)}
              className={`min-h-[40px] rounded-md border px-4 text-sm font-semibold disabled:cursor-not-allowed ${p.decision === d ? `${TONE[d]} border-transparent` : "border-slate-400 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"}`}>{d}</button>
          ))}
          <span className="flex-1" />
          <button className="btn btn-quiet" onClick={() => onOpen(p)}>Open project</button>
        </div>

        {p.decision === "Re-sequence" && (
          <div className="mt-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
            <p className="mb-2 text-sm font-semibold text-amber-950">Re-sequence: set the new dates so it lands where there&apos;s capacity.</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block"><span className="mb-1 block text-sm font-semibold">New start</span><div className="w-[230px]"><DateField id={`s-${p.id}`} value={start} onChange={setStart} /></div></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold">New end</span><div className="w-[230px]"><DateField id={`e-${p.id}`} value={end} onChange={setEnd} /></div></label>
              <button className="btn btn-primary" disabled={!canDecide || busy || !datesChanged} onClick={() => { if (start && end && end < start) return setErr("The end date is before the start date."); run({ start_date: start, end_date: end }, "New dates saved"); }}>Save new dates</button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="text" className="field min-w-[240px] flex-1" placeholder="Reason for the decision (one line)" aria-label="Reason for decision" value={rationale} disabled={!canDecide} maxLength={400}
            onChange={(e) => setRationale(e.target.value)} onBlur={() => rationale.trim() !== p.rationale && run({ rationale: rationale.trim() }, "Reason saved")} />
        </div>
        {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{err}</p>}
      </div>
    </article>
  );
}

/** Ranked list of go-ahead work. Same pattern as Teams: ▲ ▼ on the left saves immediately; dragging saves when you let go. */
function PriorityOrder({ projects, saved, teams, canDecide, onSetOrder, onOpen, today }: { projects: Project[]; saved: string[]; teams: Team[]; canDecide: boolean; onSetOrder: (ids: string[]) => Promise<string | null>; onOpen: (p: Project) => void; today: Date }) {
  const savedKey = saved.join(",");
  const [order, setOrder] = useState<string[]>(saved);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const dragFrom = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  useEffect(() => { setOrder(savedKey ? savedKey.split(",") : []); }, [savedKey]);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const unnumbered = order.some((id, i) => byId.get(id)?.priority !== i + 1);
  async function commit(next: string[]) {
    setOrder(next); setBusy(true); setErr("");
    const e = await onSetOrder(next); setBusy(false);
    if (e) { setErr(e); setOrder(savedKey ? savedKey.split(",") : []); }
  }
  const moved = (from: number, to: number) => { const next = [...order]; const [x] = next.splice(from, 1); next.splice(to, 0, x); return next; };
  const unranked = projects.filter((p) => !p.decision).length;

  return (
    <>
      <div className="mb-3 rounded-lg border-l-4 border-blue bg-white p-4 text-sm shadow-sm">
        <p><strong>Put the go-ahead work in order of priority.</strong> Only projects marked <em>Progress</em> or <em>Re-sequence</em> are ranked. {canDecide ? <>Use <strong>▲ ▼</strong> or drag a row by its <span aria-hidden="true">⠿</span> handle — each move saves straight away. Number 1 is the highest priority.</> : "ELT members can reorder this list."}</p>
        {unranked > 0 && <p className="mt-1 text-slate-600">{unranked} live project{unranked > 1 ? "s are" : " is"} still waiting for a decision and won&apos;t appear here until ELT decides.</p>}
      </div>
      {canDecide && (busy || err || unnumbered) && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          {busy && <span role="status" className="font-semibold text-slate-600">Saving…</span>}
          {err && <span role="alert" className="font-semibold text-red-800">{err}</span>}
          {!busy && !err && unnumbered && <><span className="text-slate-700">Some projects don&apos;t have a number yet — they&apos;re shown by impact.</span><button className="btn" onClick={() => commit(order)}>Number them in this order</button></>}
        </div>
      )}
      {order.length === 0 ? <p className="rounded-lg bg-white p-10 text-center text-slate-600">Nothing has been given the go-ahead yet. Mark projects <strong>Progress</strong> on the Make decisions tab first.</p> : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead><tr className="text-left text-xs text-slate-600">{canDecide && <th className="border-b border-slate-200 px-3 py-2">Order</th>}<th className="border-b border-slate-200 px-3 py-2">#</th><th className="border-b border-slate-200 px-3 py-2">Project</th><th className="border-b border-slate-200 px-3 py-2"></th></tr></thead>
            <tbody>
              {order.map((id, i) => { const p = byId.get(id); if (!p) return null; return (
                <tr key={id} draggable={canDecide && !busy}
                  onDragStart={(e) => { dragFrom.current = i; setDragging(i); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragFrom.current !== null && dragFrom.current !== i) { setOrder(moved(dragFrom.current, i)); dragFrom.current = i; setDragging(i); } }}
                  onDragEnd={() => { const wasDragging = dragging !== null; dragFrom.current = null; setDragging(null); if (wasDragging && order.join(",") !== savedKey) commit(order); }}
                  className={dragging === i ? "bg-lblue" : ""}>
                  {canDecide && <td className="w-0 whitespace-nowrap border-b border-slate-200 px-3 py-1.5">
                    <span className="mr-1 cursor-grab select-none text-lg text-slate-500" aria-hidden="true" title="Drag to reorder">⠿</span>
                    <OrderArrows label={p.name} disabled={busy} canUp={i > 0} canDown={i < order.length - 1} onUp={() => commit(moved(i, i - 1))} onDown={() => commit(moved(i, i + 1))} />
                  </td>}
                  <td className="w-0 border-b border-slate-200 px-3 py-1.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-base font-bold text-white">{i + 1}</span></td>
                  <td className="border-b border-slate-200 px-3 py-2">
                    <p className="font-semibold">{p.name} <span className="text-sm font-normal text-slate-600">{p.ref}</span></p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-600"><TeamTag team={teamById.get(p.lead_team_id ?? "")} small /><span>{formatShort(p.start_date)} – {formatShort(p.end_date)}</span><HealthPill h={health(p, today)} />{p.decision === "Re-sequence" && <span className="pill bg-amber-100 text-amber-900">Re-sequence</span>}<span>impact {p.impact_score}</span></div>
                  </td>
                  <td className="w-0 border-b border-slate-200 px-3 py-1.5 text-right"><button className="btn btn-quiet" onClick={() => onOpen(p)}>Open</button></td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
