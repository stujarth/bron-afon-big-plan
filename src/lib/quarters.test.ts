import { test } from "node:test";
import assert from "node:assert/strict";
import { quarters, overlaps, isoDate, fiscalLabel, periods } from "./quarters.ts";

const sep21 = new Date(2026, 8, 21);

test("isoDate does not shift a local midnight into the previous UTC day", () => {
  assert.equal(isoDate(new Date(2026, 8, 30)), "2026-09-30");
  assert.equal(isoDate(new Date(2027, 2, 31)), "2027-03-31");
});

test("fiscal quarters follow an April–March year", () => {
  assert.equal(fiscalLabel(new Date(2026, 9, 1)), "Q3 26/27");
  assert.equal(fiscalLabel(new Date(2027, 0, 1)), "Q4 26/27");
  assert.equal(fiscalLabel(new Date(2027, 3, 1)), "Q1 27/28");
});

test("window of six quarters starts at the current quarter and rolls with offset", () => {
  const q = quarters(sep21, 0);
  assert.equal(q.length, 6);
  assert.equal(q[0].label, "Q2 26/27");
  assert.equal(isoDate(q[0].start), "2026-07-01");
  assert.equal(isoDate(q[0].end), "2026-09-30");
  assert.equal(quarters(sep21, 1)[0].label, "Q3 26/27");
});

test("overlap is inclusive and requires both dates", () => {
  const q = quarters(sep21, 1)[0]; // Oct–Dec 26
  assert.equal(overlaps({ start_date: "2026-04-01", end_date: "2026-10-01" }, q), true);
  assert.equal(overlaps({ start_date: "2026-12-31", end_date: "2027-03-31" }, q), true);
  assert.equal(overlaps({ start_date: "2027-01-01", end_date: "2027-03-31" }, q), false);
  assert.equal(overlaps({ start_date: null, end_date: "2027-03-31" }, q), false);
});

test("roadmap zoom levels produce the right columns", () => {
  const oct1 = new Date(2026, 9, 1);
  assert.equal(periods(oct1, 0, "months").length, 12);
  assert.equal(periods(oct1, 0, "months")[0].label, "Oct 26");
  assert.equal(isoDate(periods(oct1, 0, "months")[0].end), "2026-10-31");
  assert.equal(periods(oct1, 0, "quarters").length, 6);
  assert.equal(periods(oct1, 0, "years").length, 12);
  assert.equal(periods(oct1, -2, "months")[0].label, "Aug 26");
});
