"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Team } from "@/lib/types";
import { ORG_TEAM } from "@/lib/types";
import { Help, SectionTitle, TeamTag } from "./ui";

/** Pick black or white text for a background colour so names stay readable. */
function textFor(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#081D2D" : "#FFFFFF";
}
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export default function TeamsAdmin({ teams, supabase, onChanged }: { teams: Team[]; supabase: SupabaseClient; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(""); const [colour, setColour] = useState("#007DC3"); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const sorted = [...teams].sort((a, b) => a.sort_order - b.sort_order);

  async function run(fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true); setErr(""); const { error } = await fn(); if (error) setErr(error.message.includes("row-level") ? "Only ELT members and admins can change teams." : error.message); await onChanged(); setBusy(false);
  }
  const add = () => { if (!name.trim()) return setErr("Give the team a name."); const id = slug(name); if (teams.some((t) => t.id === id)) return setErr("A team with that name already exists.");
    run(async () => await supabase.from("teams").insert({ id, name: name.trim(), colour, text_colour: textFor(colour), sort_order: Math.max(0, ...teams.map((t) => t.sort_order)) + 1, active: true })).then(() => setName("")); };
  const update = (t: Team, patch: Partial<Team>) => run(async () => await supabase.from("teams").update(patch).eq("id", t.id));
  const move = (t: Team, dir: -1 | 1) => { const i = sorted.findIndex((x) => x.id === t.id); const o = sorted[i + dir]; if (!o) return;
    run(async () => { const a = await supabase.from("teams").update({ sort_order: o.sort_order }).eq("id", t.id); const b = await supabase.from("teams").update({ sort_order: t.sort_order }).eq("id", o.id); return { error: a.error ?? b.error }; }); };

  return (
    <section>
      <SectionTitle sub="Add a team, change its colour, or retire one you no longer need. Retired teams keep their history but can't be chosen for new projects.">Manage teams</SectionTitle>
      <Help>Colours are used on the roadmap and everywhere a team is shown. <strong>Whole organisation</strong> is built in: choose it as lead or supporting team for work that draws on everyone.</Help>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div><label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="tn">New team name</label><input id="tn" className="field !w-[280px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Hub" maxLength={60} /></div>
        <div><label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="tc">Colour</label><input id="tc" type="color" className="h-[38px] w-14 cursor-pointer rounded border border-slate-300" value={colour} onChange={(e) => setColour(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={add} disabled={busy}>Add team</button>
        {err && <p role="alert" className="text-sm text-red-800">{err}</p>}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="text-left text-xs text-slate-600"><th className="border-b border-slate-200 px-3 py-2">Order</th><th className="border-b border-slate-200 px-3 py-2">Team</th><th className="border-b border-slate-200 px-3 py-2">Name</th><th className="border-b border-slate-200 px-3 py-2">Colour</th><th className="border-b border-slate-200 px-3 py-2">In use</th></tr></thead>
          <tbody>{sorted.map((t, i) => (
            <tr key={t.id} className={t.active ? "" : "opacity-50"}>
              <td className="border-b border-slate-200 px-3 py-1.5 whitespace-nowrap"><button className="btn btn-quiet !px-2" disabled={i === 0 || t.id === ORG_TEAM} onClick={() => move(t, -1)} aria-label="Move up">▲</button><button className="btn btn-quiet !px-2" disabled={i === sorted.length - 1 || t.id === ORG_TEAM} onClick={() => move(t, 1)} aria-label="Move down">▼</button></td>
              <td className="border-b border-slate-200 px-3 py-1.5"><TeamTag team={t} /></td>
              <td className="border-b border-slate-200 px-3 py-1.5"><input className="field !w-[260px] !py-1" defaultValue={t.name} disabled={t.id === ORG_TEAM} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && update(t, { name: e.target.value.trim() })} aria-label={`Rename ${t.name}`} /></td>
              <td className="border-b border-slate-200 px-3 py-1.5"><input type="color" className="h-8 w-12 cursor-pointer rounded border border-slate-300" value={t.colour} onChange={(e) => update(t, { colour: e.target.value, text_colour: textFor(e.target.value) })} aria-label={`Colour for ${t.name}`} /></td>
              <td className="border-b border-slate-200 px-3 py-1.5"><label className="chip" data-on={t.active}><input type="checkbox" checked={t.active} disabled={t.id === ORG_TEAM} onChange={(e) => update(t, { active: e.target.checked })} /> {t.active ? "Active" : "Retired"}</label></td>
            </tr>))}</tbody>
        </table>
      </div>
    </section>
  );
}
