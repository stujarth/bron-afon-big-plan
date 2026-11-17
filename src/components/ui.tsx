import type { EltDecision, ProjectStatus, Team } from "@/lib/types";
import type { Health } from "@/lib/plan";

export function TeamTag({ team, small }: { team: Team | undefined; small?: boolean }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 font-bold ${small ? "text-xs" : "text-xs"}`}
      style={{ background: team?.colour ?? "#999", color: team?.text_colour ?? "#fff" }}>{team?.name ?? "Unassigned"}</span>
  );
}

const STATUS_CLASS: Record<ProjectStatus, string> = {
  "In delivery": "bg-emerald-100 text-emerald-900", "Not started": "bg-lblue text-blue", Paused: "bg-amber-100 text-amber-900", Complete: "bg-slate-200 text-slate-600",
};
export function StatusPill({ status }: { status: ProjectStatus }) { return <span className={`pill ${STATUS_CLASS[status]}`}>{status}</span>; }

const DECISION_CLASS: Record<EltDecision, string> = {
  Progress: "bg-emerald-100 text-emerald-900", Pause: "bg-red-100 text-red-900", Deprioritise: "bg-red-100 text-red-900", Stop: "bg-red-100 text-red-900", "Re-sequence": "bg-amber-100 text-amber-900",
};
export function DecisionPill({ decision, priority }: { decision: EltDecision | null; priority?: number | null }) {
  if (!decision) return <span className="pill border border-dashed border-slate-300 text-slate-600">To decide</span>;
  return <><span className={`pill ${DECISION_CLASS[decision]}`}>{decision}</span>{priority ? <span className="ml-1 text-xs text-slate-600">#{priority}</span> : null}</>;
}

const TONE: Record<Health["tone"], string> = { red: "bg-red-600 text-white", amber: "bg-amber-400 text-amber-950", green: "bg-emerald-600 text-white", grey: "bg-slate-300 text-slate-700" };
export function HealthPill({ h }: { h: Health }) { return <span className={`pill ${TONE[h.tone]}`}>{h.label}</span>; }
export function HealthDot({ h }: { h: Health }) {
  const c = { red: "bg-red-600", amber: "bg-amber-400", green: "bg-emerald-600", grey: "bg-slate-300" }[h.tone];
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} title={h.label} aria-label={h.label} />;
}

export function ImpactDots({ values }: { values: number[] }) {
  const c = ["bg-slate-200", "bg-[#9FD3EE]", "bg-[#4FA9DA]", "bg-blue"];
  return <span className="inline-flex gap-0.5 align-middle" aria-hidden="true">{values.map((v, i) => <i key={i} className={`block h-2 w-3.5 rounded-sm ${c[v] ?? c[0]}`} />)}</span>;
}

export function Help({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 rounded-lg border-l-4 border-blue bg-white px-4 py-3 text-sm leading-relaxed shadow-sm">{children}</div>;
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return <div className="mb-3"><h2 className="text-xl font-bold text-navy">{children}</h2>{sub && <p className="mt-0.5 text-sm text-slate-600">{sub}</p>}</div>;
}

/** Segmented choice control: big targets, clear selected state, works as a radio group. */
export function Segmented<T extends string | number>({ value, onChange, options, labelledBy, disabled }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; labelledBy?: string; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button type="button" key={String(o.v)} role="radio" aria-checked={value === o.v} disabled={disabled} onClick={() => onChange(o.v)}
          className={`min-h-[36px] min-w-[64px] rounded-md px-3 text-sm font-semibold ${value === o.v ? "bg-white text-navy shadow ring-1 ring-slate-300" : "text-slate-600 hover:text-navy"}`}>{o.label}</button>
      ))}
    </div>
  );
}

/** Date input where clicking anywhere opens the calendar, with a small clear button. */
export function DateField({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="relative">
      <input id={id} type="date" className={`field field-date ${value ? "!pr-16" : "is-empty"}`} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* not supported */ } }} />
      {value && <button type="button" onClick={() => onChange(null)} className="absolute right-10 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Clear date" title="Clear date">✕</button>}
    </div>
  );
}
