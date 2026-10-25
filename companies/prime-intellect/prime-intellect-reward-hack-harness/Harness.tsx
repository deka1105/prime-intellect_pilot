"use client";

import { useMemo, useState } from "react";
import { ENVS, POLICIES, report } from "./envs";

export function Harness() {
  const [envId, setEnvId] = useState("delivery");
  const env = ENVS.find((e) => e.id === envId)!;
  const r = useMemo(() => report(env), [env]);
  const [fixed, setFixed] = useState(false);
  const runs = fixed && r.fixedRuns ? r.fixedRuns : r.runs;
  const intended = runs.find((x) => x.policy === "intended")!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {ENVS.map((e) => {
          const bad = report(e).exploited !== null;
          return (
            <button key={e.id} type="button" onClick={() => { setEnvId(e.id); setFixed(false); }}
              className={`rounded border px-2.5 py-1 font-mono text-[11.5px] transition-colors ${
                envId === e.id ? "border-foreground/40 bg-foreground/10"
                  : "border-foreground/15 text-foreground/65 hover:border-foreground/30"}`}>
              {e.label}
              <span className={`ml-1.5 ${bad ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {bad ? "✗" : "✓"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-foreground/12 px-4 py-3">
        <div className="text-[12px] text-foreground/55">The task, as a person would state it</div>
        <p className="mt-0.5 text-[13.5px]">{env.task}</p>
        <div className="mt-3 text-[12px] text-foreground/55">
          The reward, as it was written{fixed && <span className="text-emerald-700 dark:text-emerald-400"> — repaired</span>}
        </div>
        <ul className="mt-1 space-y-1">
          {(fixed && env.fix ? env.clauses.map((c) => (c.id === env.fix!.clauseId ? env.fix!.clause : c)) : env.clauses).map((c) => (
            <li key={c.id} className="flex gap-2 text-[12.5px] leading-relaxed">
              <span className="font-mono text-[11px] text-foreground/45">{c.id}</span>
              <span className={r.exploited && !fixed && r.exploited.byClause[c.id] > 0 ? "text-red-800 dark:text-red-300" : "text-foreground/75"}>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {r.exploited && !fixed && (
        <div className="rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3">
          <div className="text-[14px] font-semibold text-red-800 dark:text-red-300">
            {POLICIES.find((p) => p.id === r.exploited!.policy)!.label} scores {r.exploited.reward} without doing the task
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-red-900/90 dark:text-red-200/90">
            Doing the task properly scores {r.intendedReward}. This policy scores{" "}
            {((r.exploited.reward / r.intendedReward) * 100).toFixed(0)}% of that and ends with{" "}
            {r.exploited.progress}. Train against this reward and you get the policy on the left,
            successfully, at full cost.
          </p>
          <p className="mt-1.5 text-[12px] text-red-900/90 dark:text-red-200/90">
            <span className="font-medium">Where the reward came from:</span>{" "}
            {Object.entries(r.exploited.byClause).filter(([, v]) => v !== 0)
              .map(([k, v]) => `${k} paid ${Math.round(v * 10) / 10}`).join(", ") || "nothing"}.
          </p>
        </div>
      )}

      {!r.exploited && !fixed && (
        <div className="rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-4 py-3 text-[12.5px] leading-relaxed text-emerald-900 dark:text-emerald-200">
          <span className="font-semibold">No exploit found.</span> Every trivial policy either
          completes the task or scores well below the behaviour the reward was written for. This is
          what a correctly specified reward looks like from outside.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-foreground/12">
        <table className="w-full text-[12px]">
          <thead className="bg-foreground/[0.04] text-[11px] text-foreground/60">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Policy</th>
              <th className="px-3 py-1.5 text-right font-medium">Reward</th>
              <th className="px-3 py-1.5 text-center font-medium">Task done</th>
              <th className="px-3 py-1.5 text-left font-medium">Ended with</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {runs.map((x) => {
              const p = POLICIES.find((q) => q.id === x.policy)!;
              const suspect = !x.completed && intended.reward > 0 && x.reward >= intended.reward * 0.8;
              return (
                <tr key={x.policy} className={suspect ? "bg-red-500/5" : ""}>
                  <td className="px-3 py-1.5">
                    <span className={x.policy === "intended" ? "font-medium" : ""}>{p.label}</span>
                    <span className="ml-1.5 text-[11px] text-foreground/45">{p.blurb}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{x.reward}</td>
                  <td className={`px-3 py-1.5 text-center font-mono text-[11px] ${x.completed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {x.completed ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-1.5 text-foreground/60 [overflow-wrap:anywhere]">{x.progress}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {env.fix && (
        <div className="rounded-lg border border-foreground/12 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold">The repair</h2>
            <button type="button" onClick={() => setFixed(!fixed)}
              className="rounded border border-foreground/20 px-2.5 py-1 text-[12px] transition-colors hover:border-foreground/40 hover:bg-foreground/5">
              {fixed ? "Show the original reward" : "Apply it and re-run"}
            </button>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/70">
            <span className="font-mono text-[11px] text-foreground/45">{env.fix.clauseId}</span>{" "}
            {env.fix.text}
          </p>
        </div>
      )}
    </div>
  );
}
