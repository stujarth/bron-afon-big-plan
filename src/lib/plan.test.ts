import { test } from "node:test";
import assert from "node:assert/strict";
import { isOffRoadmap, capacity, involves, health } from "./plan.ts";
import { quarters } from "./quarters.ts";
import type { Project, Team } from "./types.ts";

const teams: Team[] = [
  { id: "a", name: "A", colour: "#000", text_colour: "#fff", sort_order: 1, active: true },
  { id: "b", name: "B", colour: "#000", text_colour: "#fff", sort_order: 2, active: true },
];
const base = { purpose: "", owner: "", impact_regulatory: 0, impact_financial: 0, impact_customer: 0, impact_foundations: 0, impact_digital: 0, impact_score: 0, priority: null, rationale: "", notes: "", confirmed: false, source: null, updated_at: "", updated_by: null, rag: "Green" as const };
const mk = (o: Partial<Project>): Project => ({ id: "x", ref: null, name: "p", lead_team_id: "a", start_date: "2026-10-01", end_date: "2027-03-31", status: "In delivery", decision: null, team_ids: [], ...base, ...o });

test("paused or decided-out projects leave the roadmap", () => {
  assert.equal(isOffRoadmap(mk({})), false);
  assert.equal(isOffRoadmap(mk({ status: "Paused" })), true);
  assert.equal(isOffRoadmap(mk({ decision: "Deprioritise" })), true);
});

test("whole-organisation projects count for every team", () => {
  const p = mk({ lead_team_id: "org", team_ids: [] });
  assert.equal(involves(p, "a"), true); assert.equal(involves(p, "b"), true);
  assert.equal(involves(mk({ team_ids: ["org"] }), "b"), true);
  assert.equal(involves(mk({}), "b"), false);
});

test("capacity counts lead-only and involved separately", () => {
  const qs = quarters(new Date(2026, 9, 1), 0);
  const ps = [mk({ id: "1" }), mk({ id: "2", team_ids: ["b"] }), mk({ id: "3", lead_team_id: "b", decision: "Pause" })];
  assert.deepEqual(capacity(ps, teams, qs, (p, t) => p.lead_team_id === t).rows.map((r) => r.counts[0]), [2, 0]);
  assert.deepEqual(capacity(ps, teams, qs, involves).rows.map((r) => r.counts[0]), [2, 1]);
});

test("health: dates override the lead's own rating", () => {
  const today = new Date(2026, 9, 1);
  assert.equal(health(mk({}), today).tone, "green");
  assert.equal(health(mk({ rag: "Amber" }), today).tone, "amber");
  assert.equal(health(mk({ end_date: "2026-09-30" }), today).label, "Overdue");
  assert.equal(health(mk({ end_date: "2026-10-20" }), today).label, "Ends soon");
  assert.equal(health(mk({ status: "Complete", end_date: "2026-01-01" }), today).tone, "grey");
});
