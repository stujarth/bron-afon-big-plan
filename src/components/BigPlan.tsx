"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project, Team } from "@/lib/types";
import { periods, quarters, type Zoom } from "@/lib/quarters";
import { health } from "@/lib/plan";
import PlanTable from "./PlanTable";
import Roadmap from "./Roadmap";
import Calendar from "./Calendar";
import Capacity from "./Capacity";
import Prioritise, { type Patch } from "./Prioritise";
import Reports from "./Reports";
import TeamsAdmin from "./TeamsAdmin";
import PeopleAdmin from "./PeopleAdmin";
import DrillDown, { type Drill } from "./DrillDown";
import ProjectDrawer, { type ProjectDraft } from "./ProjectDrawer";
import Guide from "./Guide";
import Welcome from "./Welcome";

export type View = "plan" | "roadmap" | "calendar" | "capacity" | "prioritise" | "reports" | "teams" | "people" | "guide";
const VIEWS: [View, string][] = [["plan", "Projects"], ["roadmap", "Roadmap"], ["calendar", "Calendar"], ["capacity", "Capacity"], ["prioritise", "Decisions"], ["reports", "Reports"]];
const ADMIN_VIEWS: [View, string][] = [["teams", "⚙ Teams"], ["people", "⚙ People"]];
const ENV = process.env.NEXT_PUBLIC_ENVIRONMENT ?? "";

export default function BigPlan({ initialTeams, initialProjects, profile, initialView = "plan", initialPresenting = false }: { initialTeams: Team[]; initialProjects: Project[]; profile: Profile; initialView?: View; initialPresenting?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [teams, setTeams] = useState(initialTeams);
  const [projects, setProjects] = useState(initialProjects);
  const [view, setView] = useState<View>(initialView);
  const [presenting, setPresenting] = useState(initialPresenting);
  const [qOffset, setQOffset] = useState(0);
  const [rmOffset, setRmOffset] = useState(0);
  const [zoom, setZoom] = useState<Zoom>("quarters");
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [toast, setToast] = useState("");
  const [welcome, setWelcome] = useState(!profile.onboarded_at && !initialPresenting);
  const isAdmin = profile.role === "admin";
  const canEdit = profile.role !== "viewer";
  const canDecide = profile.role === "elt" || isAdmin;
  const today = useMemo(() => new Date(), []);
  const qs = useMemo(() => quarters(today, qOffset), [today, qOffset]);
  const rmPeriods = useMemo(() => periods(today, rmOffset, zoom), [today, rmOffset, zoom]);
  const canManageTeams = profile.role === "elt" || profile.role === "admin";

  const refresh = useCallback(async () => {
    const [{ data: ps }, { data: ts }] = await Promise.all([supabase.from("projects_with_teams").select("*"), supabase.from("teams").select("*").order("sort_order")]);
    if (ps) setProjects(ps as Project[]); if (ts) setTeams(ts as Team[]);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase.channel("plan-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_teams" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, refresh]);

  useEffect(() => {
    if (initialPresenting) return;
    try { const v = localStorage.getItem("bp-view") as View | null; if (v && (v === "guide" || [...VIEWS, ...ADMIN_VIEWS].some(([k]) => k === v))) setView(v); } catch { /* storage unavailable */ }
  }, [initialPresenting]);

  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setPresenting(false); };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  async function present(on: boolean) {
    setPresenting(on);
    try { if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen(); if (!on && document.fullscreenElement) await document.exitFullscreen(); } catch { /* not permitted; chrome is hidden anyway */ }
  }
  useEffect(() => {
    if (!initialPresenting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPresenting(false); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [initialPresenting]);
  function changeView(v: View) { setView(v); try { localStorage.setItem("bp-view", v); } catch { /* ignore */ } }
  async function finishWelcome() { setWelcome(false); await supabase.rpc("mark_onboarded"); }
  function say(msg: string) { setToast(msg); window.setTimeout(() => setToast(""), 2500); }

  async function saveProject(draft: ProjectDraft): Promise<string | null> {
    const { team_ids, id, ...row } = draft;
    const query = id ? supabase.from("projects").update(row).eq("id", id).select("id").single() : supabase.from("projects").insert(row).select("id").single();
    const { data, error } = await query;
    if (error || !data) return friendly(error?.message);
    const pid = data.id as string;
    const current = projects.find((p) => p.id === pid)?.team_ids ?? [];
    const wanted = team_ids.filter((t) => t !== row.lead_team_id);
    const toAdd = wanted.filter((t) => !current.includes(t)), toRemove = current.filter((t) => !wanted.includes(t));
    if (toRemove.length) await supabase.from("project_teams").delete().eq("project_id", pid).in("team_id", toRemove);
    if (toAdd.length) await supabase.from("project_teams").insert(toAdd.map((team_id) => ({ project_id: pid, team_id })));
    await refresh(); say(id ? "Saved" : "Added to the plan"); return null;
  }
  async function updateFields(p: Project, patch: Patch, msg?: string): Promise<string | null> {
    const { error } = await supabase.from("projects").update(patch).eq("id", p.id);
    if (error) return friendly(error.message);
    await refresh(); if (msg) say(msg); return null;
  }
  async function setOrder(ids: string[]): Promise<string | null> {
    const { error } = await supabase.rpc("set_priority_order", { p_ids: ids });
    if (error) return friendly(error.message);
    await refresh(); say("Priority order saved"); return null;
  }

  // On-screen zoom: scales the whole interface. Stored per browser.
  const ZOOM_STEPS = [87.5, 100, 112.5, 125, 137.5, 150];
  const [zoomPct, setZoomPct] = useState(112.5);
  useEffect(() => { try { const z = Number(localStorage.getItem("bp-zoom")); if (ZOOM_STEPS.includes(z)) setZoomPct(z); } catch { /* ignore */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.style.fontSize = `${zoomPct}%`; try { localStorage.setItem("bp-zoom", String(zoomPct)); } catch { /* ignore */ } }, [zoomPct]);
  const zoomBy = (dir: -1 | 1) => { const i = ZOOM_STEPS.indexOf(zoomPct); const n = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))]; setZoomPct(n); };
  const zoomControl = (dark: boolean) => (
    <div className={`flex items-center overflow-hidden rounded border ${dark ? "border-[#3B5A73]" : "border-slate-400"}`} role="group" aria-label="Screen size">
      <button onClick={() => zoomBy(-1)} disabled={zoomPct === ZOOM_STEPS[0]} className={`px-2.5 py-1.5 text-sm font-bold disabled:opacity-40 ${dark ? "text-white hover:bg-[#123A55]" : "hover:bg-slate-100"}`} aria-label="Make everything smaller" title="Smaller">A−</button>
      <button onClick={() => setZoomPct(112.5)} className={`min-w-[52px] px-1 py-1.5 text-xs font-semibold ${dark ? "text-[#C8D8E4] hover:bg-[#123A55]" : "text-slate-600 hover:bg-slate-100"}`} title="Reset to normal size">{Math.round((zoomPct / 112.5) * 100)}%</button>
      <button onClick={() => zoomBy(1)} disabled={zoomPct === ZOOM_STEPS[ZOOM_STEPS.length - 1]} className={`px-2.5 py-1.5 text-sm font-bold disabled:opacity-40 ${dark ? "text-white hover:bg-[#123A55]" : "hover:bg-slate-100"}`} aria-label="Make everything bigger" title="Bigger">A+</button>
    </div>
  );
  async function remove(p: Project): Promise<string | null> {
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) return friendly(error.message);
    await refresh(); say("Removed"); return null;
  }

  const open = (p: Project) => { if (!presenting) { setDrill(null); setEditing(p); } };
  const live = projects.filter((p) => p.status !== "Complete" && p.status !== "Paused");
  const red = projects.filter((p) => health(p, today).tone === "red"), amber = projects.filter((p) => health(p, today).tone === "amber");
  const unconfirmed = projects.filter((p) => !p.confirmed).length;
  const awaiting = projects.filter((p) => !p.decision && p.status !== "Complete").length;
  const activeTeams = teams.filter((t) => t.active);

  return (
    <div className="min-h-full">
      {ENV === "sandbox" && !presenting && <div className="bg-amber-400 px-4 py-1 text-center text-xs font-bold text-amber-950">SANDBOX — practice data. Nothing here is the real plan.</div>}
      {!presenting && <header className="sticky top-0 z-20 bg-navy text-white">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex gap-0.5" aria-hidden="true"><i className="block h-5 w-1.5 rounded-sm bg-blue" /><i className="block h-5 w-1.5 rounded-sm bg-green" /><i className="block h-5 w-1.5 rounded-sm bg-maroon" /></span>
            <div><h1 className="text-lg font-bold leading-tight">One Bron Afon Plan</h1><p className="text-sm text-[#A9C4D6]">The Big Plan{ENV ? ` · ${ENV}` : ""}</p></div>
          </div>
          <nav className="ml-auto flex flex-wrap gap-0.5 self-end" role="tablist" aria-label="Views">
            {VIEWS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => changeView(k)}
                className={`border-b-[3px] px-3 py-2.5 text-sm font-semibold ${view === k ? "border-green text-white" : "border-transparent text-[#C8D8E4] hover:text-white"}`}>{label}</button>
            ))}
            {ADMIN_VIEWS.filter(([k]) => k === "teams" ? canManageTeams : isAdmin).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => changeView(k)}
                className={`border-b-[3px] px-3 py-2.5 text-sm font-semibold ${view === k ? "border-green text-white" : "border-transparent text-[#8FB0C8] hover:text-white"}`}>{label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3 self-end pb-2 text-sm text-[#A9C4D6]">
            {zoomControl(true)}
            <button onClick={() => changeView("guide")} aria-current={view === "guide" ? "page" : undefined} className={`rounded border px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#123A55] ${view === "guide" ? "border-green bg-[#123A55]" : "border-[#3B5A73]"}`}>? Guide</button>
            <button onClick={() => present(true)} className="rounded border border-[#3B5A73] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#123A55]" title="Hide the menus and fill the screen (Esc to leave)">Full screen</button>
            <form action="/auth/signout" method="post"><span className="mr-3 hidden sm:inline">{profile.full_name ?? profile.email} · {roleLabel(profile.role)}</span><button className="underline hover:text-white">Sign out</button></form>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 bg-[#0C2740] px-4 py-2 text-sm sm:px-6">
          <Stat n={projects.length} label="projects" onClick={() => setDrill({ title: "All projects", projects })} />
          <Stat n={live.length} label="live" onClick={() => setDrill({ title: "Live projects", projects: live })} />
          <Stat n={red.length} label="red" tone="text-red-300" onClick={() => setDrill({ title: "Red — in trouble or overdue", projects: red })} />
          <Stat n={amber.length} label="amber" tone="text-amber-300" onClick={() => setDrill({ title: "Amber — at risk or ending soon", projects: amber })} />
          <Stat n={unconfirmed} label="still to confirm" tone="text-[#FFD166]" onClick={() => setDrill({ title: "Still to be confirmed by the lead", projects: projects.filter((p) => !p.confirmed) })} />
          <Stat n={awaiting} label="awaiting ELT decision" tone="text-[#FFD166]" onClick={() => setDrill({ title: "Awaiting an ELT decision", projects: projects.filter((p) => !p.decision && p.status !== "Complete") })} />
        </div>
      </header>}

      <main id="main" tabIndex={-1} className={presenting ? "px-4 py-3 sm:px-6" : "px-4 pb-16 pt-6 sm:px-6 lg:px-8"}>
        {presenting && (
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-600">
            <span className="text-sm font-bold text-navy">One Bron Afon Plan</span>
            <nav className="seg" aria-label="Views">{VIEWS.map(([k, label]) => <button key={k} data-on={view === k} onClick={() => setView(k)}>{label}</button>)}</nav>
            <span className="flex-1" />{zoomControl(false)}<span>Live · updates automatically</span>
            <button onClick={() => present(false)} className="btn btn-quiet !py-1">Exit full screen</button>
          </div>
        )}
        {!canEdit && !presenting && <p className="mb-4 rounded-md bg-amber-50 px-4 py-2.5 text-amber-900">You can view the plan but not change it.</p>}
        {view === "plan" && <PlanTable projects={projects} teams={teams} today={today} canEdit={canEdit && !presenting} compact={presenting} onOpen={open} onAdd={() => setEditing("new")} />}
        {view === "roadmap" && <Roadmap projects={projects} teams={teams} qs={rmPeriods} today={today} compact={presenting} onOpen={open} onShift={(d) => setRmOffset(d === 0 ? 0 : rmOffset + d)} onDrill={setDrill} zoom={zoom} onZoom={(z) => { setZoom(z); setRmOffset(0); }} />}
        {view === "calendar" && <Calendar projects={projects} teams={teams} today={today} compact={presenting} onOpen={open} onDrill={setDrill} />}
        {view === "capacity" && <Capacity projects={projects} teams={activeTeams} qs={qs} compact={presenting} onDrill={setDrill} />}
        {view === "prioritise" && <Prioritise projects={projects} teams={teams} today={today} canDecide={canDecide && !presenting} compact={presenting} onUpdate={updateFields} onSetOrder={setOrder} onOpen={open} />}
        {view === "reports" && <Reports projects={projects} teams={activeTeams} qs={qs} today={today} compact={presenting} onDrill={setDrill} />}
        {view === "teams" && canManageTeams && <TeamsAdmin teams={teams} supabase={supabase} onChanged={refresh} />}
        {view === "people" && isAdmin && <PeopleAdmin supabase={supabase} me={profile} />}
        {view === "guide" && <Guide role={profile.role} teams={teams} projects={projects} supabase={supabase} onGo={changeView} onReplay={() => setWelcome(true)} />}
      </main>

      {drill && !editing && <DrillDown drill={drill} teams={teams} today={today} onClose={() => setDrill(null)} onOpen={presenting ? undefined : open} />}
      {editing && (
        <ProjectDrawer project={editing === "new" ? null : editing} teams={teams} canEdit={canEdit} canDecide={canDecide} canDelete={isAdmin}
          onClose={() => setEditing(null)} onSave={saveProject} onDelete={remove} supabase={supabase} />
      )}
      {welcome && <Welcome name={profile.full_name} role={profile.role} onDone={finishWelcome} onGuide={() => changeView("guide")} />}
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-md bg-navy px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}

function Stat({ n, label, tone, onClick }: { n: number; label: string; tone?: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded px-1 text-left hover:bg-white/10" title="Show these projects"><b className={`mr-1.5 text-lg ${n && tone ? tone : ""}`}>{n}</b><span className="text-[#B8CBD9]">{label}</span></button>;
}
function roleLabel(r: Profile["role"]) { return { viewer: "can view", editor: "can edit", elt: "ELT", admin: "admin" }[r]; }
function friendly(msg?: string): string {
  if (!msg) return "Could not save — try again.";
  if (msg.includes("Only ELT")) return "Only ELT can record or change a prioritisation decision.";
  if (msg.includes("projects_dates_ok")) return "End date is before start date.";
  if (msg.includes("row-level security")) return "You don't have permission to make that change.";
  return "Could not save — try again.";
}
