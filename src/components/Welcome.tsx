"use client";
import { useEffect, useState } from "react";
import type { Role } from "@/lib/types";

interface Step { title: string; body: React.ReactNode; roles?: Role[] }

const STEPS: Step[] = [
  { title: "Welcome to the Big Plan", body: <>
    <p>This is one place to see all of Bron Afon&apos;s significant work over the next 18 months — who is leading it, when it happens, and which teams it draws on.</p>
    <p>It takes about a minute to learn. Use <strong>Next</strong> to walk through, or <strong>Skip</strong> and come back to the <strong>Guide</strong> any time.</p></> },
  { title: "Find your work", body: <>
    <p>The <strong>Projects</strong> tab lists everything, grouped by lead team. Use the search box or the <em>All lead teams</em> filter to show just yours.</p>
    <p>Each project has a <strong>traffic light</strong>: <Tone c="bg-emerald-600">On track</Tone> <Tone c="bg-amber-400 text-amber-950">Amber</Tone> <Tone c="bg-red-600">Red</Tone>. Overdue work turns red on its own.</p></> },
  { title: "Keep it up to date", roles: ["editor", "elt", "admin"], body: <>
    <p>Click any project to open it. Change what&apos;s needed — usually a date, the status or the traffic light — then press <strong>Save</strong>.</p>
    <p>When a row is right, tick <strong>Confirmed by the lead</strong>. Rows with an amber dot are still waiting for that. New work goes in with <strong>Add project</strong>; the reference number is given automatically.</p></> },
  { title: "See the big picture", body: <>
    <p><strong>Roadmap</strong> shows who is doing what and when — zoom between months, quarters and three years. <strong>Capacity</strong> shows how busy each team is per quarter.</p>
    <p>Almost every number can be clicked to show the projects behind it.</p></> },
  { title: "Make the decisions", roles: ["elt", "admin"], body: <>
    <p>The <strong>Decisions</strong> tab lists live work, highest impact first. For each, choose <em>Progress</em>, <em>Pause</em>, <em>Re-sequence</em>, <em>Deprioritise</em> or <em>Stop</em>, and add a one-line reason.</p>
    <p>Paused and deprioritised work drops out of the roadmap and the capacity counts straight away.</p></> },
  { title: "Set things up", roles: ["elt", "admin"], body: <>
    <p><strong>⚙ Teams</strong> lets you add, rename, recolour or retire teams.</p>
    <p>Admins also have <strong>⚙ People</strong> to add colleagues and choose what each can do. The <strong>Guide</strong> has a checklist showing what&apos;s left to set up.</p></> },
  { title: "Help is always here", body: <>
    <p>The <strong>Guide</strong> button at the top right explains every screen in plain English, step by step.</p>
    <p><strong>Reports</strong> gives you an Excel download or a printable version, and <strong>Full screen</strong> is made for meeting rooms.</p></> },
];

function Tone({ c, children }: { c: string; children: React.ReactNode }) { return <span className={`pill text-white ${c}`}>{children}</span>; }

export default function Welcome({ name, role, onDone, onGuide }: { name: string | null; role: Role; onDone: () => void; onGuide: () => void }) {
  const steps = STEPS.filter((s) => !s.roles || s.roles.includes(role));
  const [i, setI] = useState(0);
  const step = steps[i], last = i === steps.length - 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); if (e.key === "ArrowRight" && !last) setI(i + 1); if (e.key === "ArrowLeft" && i) setI(i - 1); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [i, last, onDone]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" role="dialog" aria-modal="true" aria-labelledby="wl-h">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 rounded-t-xl bg-navy px-6 py-4 text-white">
          <span className="flex gap-0.5" aria-hidden="true"><i className="block h-6 w-1.5 rounded bg-blue" /><i className="block h-6 w-1.5 rounded bg-green" /><i className="block h-6 w-1.5 rounded bg-maroon" /></span>
          <div className="flex-1"><p className="text-sm text-[#A9C4D6]">{i === 0 && name ? `Hello ${name.split(" ")[0]}` : `Step ${i + 1} of ${steps.length}`}</p><h2 id="wl-h" className="text-xl font-bold">{step.title}</h2></div>
        </div>
        <div className="space-y-3 px-6 py-5 text-base leading-relaxed text-slate-800" aria-live="polite">{step.body}</div>
        <div className="flex items-center gap-2 border-t border-slate-200 px-6 py-4">
          <div className="flex gap-1.5" aria-hidden="true">{steps.map((_, k) => <span key={k} className={`h-2 w-2 rounded-full ${k === i ? "bg-blue" : "bg-slate-300"}`} />)}</div>
          <span className="flex-1" />
          {!last && <button className="btn btn-quiet" onClick={onDone}>Skip</button>}
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Back</button>}
          {last ? <>
            <button className="btn" onClick={() => { onDone(); onGuide(); }}>Open the Guide</button>
            <button className="btn btn-primary" onClick={onDone} autoFocus>Get started</button>
          </> : <button className="btn btn-primary" onClick={() => setI(i + 1)} autoFocus>Next</button>}
        </div>
      </div>
    </div>
  );
}
