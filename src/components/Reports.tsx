"use client";
import { useState } from "react";
import type { Project, Team } from "@/lib/types";
import { DECISIONS, IMPACT_FIELDS, LEVELS, ORG_TEAM, STATUSES } from "@/lib/types";
import { formatShort, overlaps, type Quarter } from "@/lib/quarters";
import { capacity, health, involves, isOffRoadmap } from "@/lib/plan";
import { Help, HealthPill, SectionTitle, TeamTag } from "./ui";
import type { Drill } from "./DrillDown";

export default function Reports({ projects, teams, qs, today, onDrill, compact = false }: { projects: Project[]; teams: Team[]; qs: Quarter[]; today: Date; onDrill: (d: Drill) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const live = projects.filter((p) => p.status !== "Complete");
  const byTone = (tone: string) => live.filter((p) => health(p, today).tone === tone);
  const t = (id: string | null) => teams.find((x) => x.id === id);
  const visibleTeams = teams.filter((x) => x.id !== ORG_TEAM);
  const cap = capacity(projects, visibleTeams, qs, involves);

  async function exportExcel() {
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook(); wb.creator = "One Bron Afon Plan";
      const navy = "FF081D2D";
      const head = (ws: import("exceljs").Worksheet, cols: { header: string; key: string; width: number }[]) => {
        ws.columns = cols; ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } }; ws.views = [{ state: "frozen", ySplit: 1 }]; ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
      };
      const ws = wb.addWorksheet("Projects");
      head(ws, [{ header: "Ref", key: "ref", width: 9 }, { header: "Project", key: "name", width: 40 }, { header: "What it delivers", key: "purpose", width: 50 }, { header: "Lead team", key: "lead", width: 28 }, { header: "Owner", key: "owner", width: 30 }, { header: "Other teams", key: "teams", width: 40 }, { header: "Start", key: "start", width: 12 }, { header: "End", key: "end", width: 12 }, { header: "Status", key: "status", width: 13 }, { header: "Traffic light", key: "health", width: 13 }, { header: "Lead's rating", key: "rag", width: 12 }, ...IMPACT_FIELDS.map(([k, l]) => ({ header: l, key: k, width: 14 })), { header: "Impact score", key: "score", width: 12 }, { header: "ELT decision", key: "decision", width: 14 }, { header: "ELT priority", key: "priority", width: 11 }, { header: "Reason", key: "rationale", width: 40 }, { header: "Notes", key: "notes", width: 50 }, { header: "Confirmed", key: "confirmed", width: 10 }, { header: "Last updated", key: "updated", width: 14 }]);
      for (const p of projects) ws.addRow({ ref: p.ref, name: p.name, purpose: p.purpose, lead: t(p.lead_team_id)?.name ?? "", owner: p.owner, teams: p.team_ids.map((id) => t(id)?.name).filter(Boolean).join(", "), start: p.start_date ? new Date(p.start_date) : null, end: p.end_date ? new Date(p.end_date) : null, status: p.status, health: health(p, today).label, rag: p.rag, ...Object.fromEntries(IMPACT_FIELDS.map(([k]) => [k, LEVELS[p[k]]])), score: p.impact_score, decision: p.decision ?? "", priority: p.priority ?? "", rationale: p.rationale, notes: p.notes, confirmed: p.confirmed ? "Yes" : "No", updated: new Date(p.updated_at) });
      ["start", "end", "updated"].forEach((k) => (ws.getColumn(k).numFmt = "dd mmm yyyy"));
      const wc = wb.addWorksheet("Capacity");
      head(wc, [{ header: "Team", key: "team", width: 32 }, ...qs.map((q, i) => ({ header: q.label, key: `q${i}`, width: 11 })), { header: "Busiest", key: "peak", width: 10 }]);
      for (const r of cap.rows) wc.addRow({ team: r.team.name, ...Object.fromEntries(r.counts.map((c, i) => [`q${i}`, c])), peak: r.peak });
      wc.addRow({ team: "All live projects", ...Object.fromEntries(cap.totals.map((c, i) => [`q${i}`, c])) }).font = { bold: true };
      const wd = wb.addWorksheet("ELT decisions");
      head(wd, [{ header: "Ref", key: "ref", width: 9 }, { header: "Project", key: "name", width: 40 }, { header: "Lead team", key: "lead", width: 28 }, { header: "Impact score", key: "score", width: 12 }, { header: "Decision", key: "decision", width: 14 }, { header: "Priority", key: "priority", width: 10 }, { header: "Reason", key: "rationale", width: 50 }]);
      for (const p of [...live].sort((a, b) => b.impact_score - a.impact_score)) wd.addRow({ ref: p.ref, name: p.name, lead: t(p.lead_team_id)?.name ?? "", score: p.impact_score, decision: p.decision ?? "To decide", priority: p.priority ?? "", rationale: p.rationale });
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `One_Bron_Afon_Plan_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }

  const Card = ({ n, label, tone, onClick }: { n: number; label: string; tone?: string; onClick?: () => void }) => (
    <button onClick={onClick} disabled={!onClick} className={`rounded-lg border border-slate-200 bg-white px-4 py-3 text-left ${onClick ? "hover:bg-lblue" : ""}`}>
      <b className={`block text-2xl leading-none ${tone ?? ""}`}>{n}</b><span className="text-xs text-slate-600">{label}</span></button>
  );

  return (
    <section>
      <SectionTitle sub="The headline picture, ready to share. Click any number to see the projects behind it.">Reports</SectionTitle>
      {!compact && (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <button className="btn btn-primary" onClick={exportExcel} disabled={busy}>{busy ? "Preparing…" : "Download as Excel"}</button>
          <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
          <span className="self-center text-xs text-slate-600">The Excel file has three sheets: Projects, Capacity, ELT decisions.</span>
        </div>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card n={projects.length} label="projects on the plan" onClick={() => onDrill({ title: "All projects", projects })} />
        <Card n={live.length} label="live" onClick={() => onDrill({ title: "Live projects", projects: live })} />
        <Card n={byTone("green").length} label="on track" tone="text-emerald-700" onClick={() => onDrill({ title: "On track", projects: byTone("green") })} />
        <Card n={byTone("amber").length} label="at risk / ending soon" tone="text-amber-600" onClick={() => onDrill({ title: "Amber", projects: byTone("amber") })} />
        <Card n={byTone("red").length} label="in trouble / overdue" tone="text-red-700" onClick={() => onDrill({ title: "Red", projects: byTone("red") })} />
        <Card n={live.filter((p) => !p.decision).length} label="awaiting ELT decision" onClick={() => onDrill({ title: "Awaiting an ELT decision", projects: live.filter((p) => !p.decision) })} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Table title="By lead team" rows={visibleTeams.map((tm) => { const ps = projects.filter((p) => p.lead_team_id === tm.id); return { key: tm.id, label: <TeamTag team={tm} />, cells: [ps.length, ps.filter((p) => health(p, today).tone === "red").length, ps.filter((p) => health(p, today).tone === "amber").length, ps.filter((p) => !p.decision && p.status !== "Complete").length], onClick: () => onDrill({ title: tm.name, projects: ps }) }; })} heads={["Team", "Projects", "Red", "Amber", "To decide"]} />
        <Table title="By status" rows={STATUSES.map((s) => { const ps = projects.filter((p) => p.status === s); return { key: s, label: s, cells: [ps.length], onClick: () => onDrill({ title: s, projects: ps }) }; })} heads={["Status", "Projects"]} />
        <Table title="By ELT decision" rows={[...DECISIONS.map((d) => ({ key: d, label: d, cells: [projects.filter((p) => p.decision === d).length], onClick: () => onDrill({ title: d, projects: projects.filter((p) => p.decision === d) }) })), { key: "none", label: "Not yet decided", cells: [live.filter((p) => !p.decision).length], onClick: () => onDrill({ title: "Not yet decided", projects: live.filter((p) => !p.decision) }) }]} heads={["Decision", "Projects"]} />
        <div>
          <h3 className="mb-2 text-sm font-bold">Needs attention</h3>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {byTone("red").length === 0 && byTone("amber").length === 0 && <p className="p-6 text-center text-slate-600">Nothing red or amber right now.</p>}
            <ul className="divide-y divide-slate-200">{[...byTone("red"), ...byTone("amber")].map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm"><HealthPill h={health(p, today)} /><span className="flex-1 font-semibold">{p.name}</span><TeamTag team={t(p.lead_team_id)} small /><span className="text-xs text-slate-600">ends {formatShort(p.end_date)}</span></li>))}</ul>
          </div>
        </div>
      </div>
      <h3 className="mb-2 mt-6 text-sm font-bold">Busiest quarters ahead</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-center text-sm">
          <thead><tr className="text-xs text-slate-600"><th className="border-b border-slate-200 px-3 py-2 text-left">Quarter</th>{qs.map((q) => <th key={q.label} className="border-b border-slate-200 px-3 py-2">{q.label}</th>)}</tr></thead>
          <tbody><tr><td className="px-3 py-2 text-left font-semibold">Live projects</td>{cap.totals.map((n, i) => <td key={i} className="px-3 py-2 font-bold"><button className="hover:underline" onClick={() => onDrill({ title: `Live in ${qs[i].label}`, projects: projects.filter((p) => !isOffRoadmap(p) && overlaps(p, qs[i])) })}>{n}</button></td>)}</tr></tbody>
        </table>
      </div>
    </section>
  );
}

function Table({ title, heads, rows }: { title: string; heads: string[]; rows: { key: string; label: React.ReactNode; cells: number[]; onClick: () => void }[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="text-xs text-slate-600">{heads.map((h, i) => <th key={h} className={`border-b border-slate-200 px-3 py-2 ${i ? "text-center" : "text-left"}`}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key} className="cursor-pointer hover:bg-lblue" onClick={r.onClick}><td className="border-b border-slate-200 px-3 py-1.5">{r.label}</td>{r.cells.map((c, i) => <td key={i} className="border-b border-slate-200 px-3 py-1.5 text-center font-bold">{c || ""}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
