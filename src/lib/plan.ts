import type { Project, Team } from "./types.ts";
import { ORG_TEAM } from "./types.ts";
import { isoDate, overlaps, type Quarter } from "./quarters.ts";

/** Paused, complete or decided-out projects leave the roadmap and the capacity count. */
export function isOffRoadmap(p: Pick<Project, "status" | "decision">): boolean {
  return p.status === "Complete" || p.status === "Paused" || p.decision === "Pause" || p.decision === "Deprioritise" || p.decision === "Stop";
}

export function sortForRoadmap(projects: Project[], teams: Team[]): Project[] {
  const order = new Map(teams.map((t) => [t.id, t.sort_order]));
  return [...projects].sort(
    (a, b) =>
      (order.get(a.lead_team_id ?? "") ?? 99) - (order.get(b.lead_team_id ?? "") ?? 99) ||
      (a.start_date ?? "9").localeCompare(b.start_date ?? "9") ||
      (a.ref ?? "").localeCompare(b.ref ?? ""),
  );
}

/** A project involves a team if it leads it, supports it, or touches the whole organisation. */
export function involves(p: Project, teamId: string): boolean {
  if (p.lead_team_id === teamId || p.team_ids.includes(teamId)) return true;
  return teamId !== ORG_TEAM && (p.lead_team_id === ORG_TEAM || p.team_ids.includes(ORG_TEAM));
}

export interface CapacityRow { team: Team; counts: number[]; peak: number; }

export function capacity(projects: Project[], teams: Team[], qs: Quarter[], member: (p: Project, teamId: string) => boolean): { rows: CapacityRow[]; totals: number[]; max: number } {
  const live = projects.filter((p) => !isOffRoadmap(p));
  const rows = teams.map((team) => {
    const counts = qs.map((q) => live.filter((p) => overlaps(p, q) && member(p, team.id)).length);
    return { team, counts, peak: Math.max(0, ...counts) };
  });
  const totals = qs.map((q) => live.filter((p) => overlaps(p, q)).length);
  return { rows, totals, max: Math.max(1, ...rows.map((r) => r.peak)) };
}

export type Health = { tone: "red" | "amber" | "green" | "grey"; label: string };

/** One traffic light per project: the lead's own confidence, overridden by hard facts about dates. */
export function health(p: Pick<Project, "status" | "rag" | "end_date">, today: Date): Health {
  if (p.status === "Complete") return { tone: "grey", label: "Complete" };
  if (p.status === "Paused") return { tone: "grey", label: "Paused" };
  const t = isoDate(today);
  if (p.end_date && p.end_date < t) return { tone: "red", label: "Overdue" };
  if (p.rag === "Red") return { tone: "red", label: "Red" };
  if (p.rag === "Amber") return { tone: "amber", label: "Amber" };
  if (p.end_date) {
    const soon = new Date(today); soon.setDate(soon.getDate() + 30);
    if (p.end_date <= isoDate(soon)) return { tone: "amber", label: "Ends soon" };
  }
  return { tone: "green", label: "On track" };
}
