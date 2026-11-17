export type ProjectStatus = "Not started" | "In delivery" | "Paused" | "Complete";
export type EltDecision = "Progress" | "Pause" | "Re-sequence" | "Deprioritise" | "Stop";
export type Rag = "Green" | "Amber" | "Red";
export type Role = "viewer" | "editor" | "elt" | "admin";

export const STATUSES: ProjectStatus[] = ["Not started", "In delivery", "Paused", "Complete"];
export const DECISIONS: EltDecision[] = ["Progress", "Pause", "Re-sequence", "Deprioritise", "Stop"];
export const RAGS: Rag[] = ["Green", "Amber", "Red"];
export const DECISION_HELP: Record<EltDecision, string> = {
  Progress: "Go ahead as planned.",
  Pause: "Stop work for now and keep it on the list. It leaves the roadmap and capacity counts until it's picked up again.",
  "Re-sequence": "Keep it, but move it. Set the new start and end dates so it lands where there's capacity.",
  Deprioritise: "Not now. It stays on the list but drops out of the roadmap and capacity counts.",
  Stop: "End this work. It drops out of the roadmap and capacity counts.",
};
export const ROLES: [Role, string][] = [["viewer", "Can view"], ["editor", "Can edit"], ["elt", "ELT — can edit and decide"], ["admin", "Admin"]];
export const IMPACT_FIELDS = [
  ["impact_regulatory", "Regulatory compliance"],
  ["impact_financial", "Financial impact"],
  ["impact_customer", "Customer service"],
  ["impact_foundations", "Core foundations"],
  ["impact_digital", "Digital programme alignment"],
] as const;
export type ImpactField = (typeof IMPACT_FIELDS)[number][0];
export const LEVELS = ["—", "Low", "Medium", "High"] as const;
export const ORG_TEAM = "org";

export interface Team { id: string; name: string; colour: string; text_colour: string; sort_order: number; active: boolean; }

export interface Project {
  id: string; ref: string | null; name: string; purpose: string; lead_team_id: string | null; owner: string;
  start_date: string | null; end_date: string | null; status: ProjectStatus;
  impact_regulatory: number; impact_financial: number; impact_customer: number; impact_foundations: number; impact_digital: number; impact_score: number;
  decision: EltDecision | null; priority: number | null; rationale: string; notes: string; confirmed: boolean; rag: Rag;
  source: string | null; updated_at: string; updated_by: string | null; team_ids: string[];
}

export interface Profile { id: string; email: string; full_name: string | null; role: Role; must_change_password?: boolean; created_at?: string; onboarded_at?: string | null; }
export interface HistoryRow { id: number; changed_at: string; changed_by: string | null; changed_by_name?: string; action: string; changes: Record<string, unknown>; }
