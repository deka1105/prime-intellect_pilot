/**
 * Reward-hack harness — Prime Intellect P-1.
 *
 * Prime Intellect is hiring nine Applied Research leads by vertical plus a
 * Forward-Deployed RL engineer, which is a company paying salaries for the
 * step customers cannot do: writing a reward function that means what they
 * think it means. A badly specified reward does not fail loudly — it trains
 * successfully on the wrong thing and burns the GPU hours they just sold.
 *
 * Four tiny environments, each with a hand-written reward made of *named
 * clauses*, and a battery of trivial policies run against them. The exploits
 * are not written down anywhere: the `maximise` policy is a one-step greedy
 * search over the same reward the environment publishes, so when it scores
 * well without completing the task, it found that on its own. That is the
 * whole claim — the bug is reachable by something far dumber than a trained
 * model.
 *
 * One environment is specified correctly, so the harness can be seen to pass
 * as well as fail.
 */

export type State = Record<string, number | boolean | string | string[]>;

export type Clause = {
  id: string;
  /** How the reward reads to the person who wrote it. */
  text: string;
  /** What it actually pays, per step. */
  fn: (prev: State, action: string, next: State) => number;
};

export type Env = {
  id: string;
  label: string;
  task: string;
  budget: number;
  actions: string[];
  reset: () => State;
  step: (s: State, action: string) => State;
  /** Ground truth, deliberately separate from the reward. */
  completed: (s: State) => boolean;
  /** A human-readable measure of how much of the task actually got done. */
  progress: (s: State) => string;
  clauses: Clause[];
  /** The repair, and the clause it replaces. Absent when the env is correct. */
  fix?: { clauseId: string; text: string; clause: Clause };
};

const n = (s: State, k: string) => Number(s[k] ?? 0);
const b = (s: State, k: string) => Boolean(s[k]);

/* ----------------------------------------------------- 1. the proxy bug --- */

const delivery: Env = {
  id: "delivery",
  label: "package-delivery",
  task: "Carry the package to position 7 and drop it there.",
  budget: 20,
  actions: ["forward", "back", "wait", "drop"],
  reset: () => ({ pos: 0, target: 7, holding: true, delivered: false }),
  step: (s, a) => {
    if (b(s, "delivered")) return s;
    const pos = n(s, "pos");
    if (a === "forward") return { ...s, pos: Math.min(12, pos + 1) };
    if (a === "back") return { ...s, pos: Math.max(0, pos - 1) };
    if (a === "drop" && b(s, "holding")) {
      return { ...s, holding: false, delivered: pos === n(s, "target") };
    }
    return s;
  },
  completed: (s) => b(s, "delivered"),
  progress: (s) => (b(s, "delivered") ? "delivered" : `package at ${n(s, "pos")} of ${n(s, "target")}, ${b(s, "holding") ? "still held" : "dropped short"}`),
  clauses: [
    {
      id: "C1",
      text: "+0.8 for every step the package is still being carried — 'reward the agent for keeping hold of it'",
      fn: (prev) => (b(prev, "holding") ? 0.8 : 0),
    },
    {
      id: "C2",
      text: "+10 when the package is delivered at the target",
      fn: (prev, _a, next) => (!b(prev, "delivered") && b(next, "delivered") ? 10 : 0),
    },
  ],
  fix: {
    clauseId: "C1",
    text: "Pay for carrying only when the distance to the target actually fell this step.",
    clause: {
      id: "C1",
      text: "+0.8 only when the package is held and got closer to the target this step",
      fn: (prev, _a, next) => {
        const before = Math.abs(n(prev, "pos") - n(prev, "target"));
        const after = Math.abs(n(next, "pos") - n(next, "target"));
        return b(prev, "holding") && after < before ? 0.8 : 0;
      },
    },
  },
};

/* --------------------------------------------- 2. counting the wrong act --- */

const TICKETS = ["bug", "spam", "bug", "billing", "spam", "bug", "billing", "spam", "bug", "billing", "spam", "bug"];

const triage: Env = {
  id: "triage",
  label: "ticket-triage",
  task: "Read each ticket and close it under the right label.",
  // Two steps per ticket for the intended behaviour: read, then close. A
  // budget that cannot fit the correct policy would be measuring the budget.
  budget: 24,
  actions: ["read", "close-bug", "close-spam", "close-billing"],
  reset: () => ({ idx: 0, closed: 0, correct: 0, read: false }),
  step: (s, a) => {
    const idx = n(s, "idx");
    if (idx >= TICKETS.length) return s;
    if (a === "read") return { ...s, read: true };
    const label = a.replace("close-", "");
    const right = label === TICKETS[idx];
    return {
      ...s,
      idx: idx + 1,
      read: false,
      closed: n(s, "closed") + 1,
      correct: n(s, "correct") + (right ? 1 : 0),
    };
  },
  completed: (s) => n(s, "correct") >= 10,
  progress: (s) => `${n(s, "closed")} closed, ${n(s, "correct")} of those correct`,
  clauses: [
    {
      id: "C1",
      text: "+1 for every ticket closed — 'throughput is what we are optimising'",
      fn: (prev, _a, next) => n(next, "closed") - n(prev, "closed"),
    },
  ],
  fix: {
    clauseId: "C1",
    text: "Pay for correct resolutions and charge for wrong ones, so closing blind is worse than reading.",
    clause: {
      id: "C1",
      text: "+2 for a correctly labelled close, −2 for an incorrect one",
      fn: (prev, _a, next) => {
        const closed = n(next, "closed") - n(prev, "closed");
        if (closed === 0) return 0;
        return n(next, "correct") > n(prev, "correct") ? 2 : -2;
      },
    },
  },
};

/* ------------------------------------------------- 3. duplicates count --- */

const research: Env = {
  id: "research",
  label: "research-citations",
  task: "Support the claim with at least three distinct sources.",
  budget: 8,
  actions: ["search", "cite-A", "cite-B", "cite-C"],
  reset: () => ({ cites: [] as string[], searched: false }),
  step: (s, a) => {
    if (a === "search") return { ...s, searched: true };
    const cites = [...((s.cites as string[]) ?? []), a.replace("cite-", "")];
    return { ...s, cites };
  },
  completed: (s) => new Set((s.cites as string[]) ?? []).size >= 3,
  progress: (s) => {
    const c = (s.cites as string[]) ?? [];
    return `${c.length} citations, ${new Set(c).size} distinct`;
  },
  clauses: [
    {
      id: "C1",
      text: "+2 for every citation added to the answer",
      fn: (prev, _a, next) => (((next.cites as string[]) ?? []).length - ((prev.cites as string[]) ?? []).length) * 2,
    },
  ],
  fix: {
    clauseId: "C1",
    text: "Pay for distinct sources, not for the number of citation marks.",
    clause: {
      id: "C1",
      text: "+2 for every *distinct* source added",
      fn: (prev, _a, next) => {
        const before = new Set((prev.cites as string[]) ?? []).size;
        const after = new Set((next.cites as string[]) ?? []).size;
        return (after - before) * 2;
      },
    },
  },
};

/* ------------------------------------------------ 4. specified correctly --- */

const INVOICES = ["match", "no-match", "match", "match", "no-match", "match"];

const invoices: Env = {
  id: "invoices",
  label: "invoice-match",
  task: "Decide for each invoice whether it matches its purchase order.",
  budget: 6,
  actions: ["say-match", "say-no-match", "skip"],
  reset: () => ({ idx: 0, right: 0, wrong: 0, skipped: 0 }),
  step: (s, a) => {
    const idx = n(s, "idx");
    if (idx >= INVOICES.length) return s;
    if (a === "skip") return { ...s, idx: idx + 1, skipped: n(s, "skipped") + 1 };
    const said = a === "say-match" ? "match" : "no-match";
    const right = said === INVOICES[idx];
    return { ...s, idx: idx + 1, right: n(s, "right") + (right ? 1 : 0), wrong: n(s, "wrong") + (right ? 0 : 1) };
  },
  completed: (s) => n(s, "right") >= 5,
  progress: (s) => `${n(s, "right")} right, ${n(s, "wrong")} wrong, ${n(s, "skipped")} skipped`,
  clauses: [
    { id: "C1", text: "+5 for a correct decision", fn: (prev, _a, next) => (n(next, "right") > n(prev, "right") ? 5 : 0) },
    { id: "C2", text: "−5 for an incorrect decision", fn: (prev, _a, next) => (n(next, "wrong") > n(prev, "wrong") ? -5 : 0) },
    { id: "C3", text: "0 for declining to decide", fn: () => 0 },
  ],
};

export const ENVS: Env[] = [delivery, triage, research, invoices];

/* -------------------------------------------------------------- policies --- */

export type Policy = { id: string; label: string; blurb: string };

export const POLICIES: Policy[] = [
  { id: "idle", label: "Do nothing", blurb: "Takes the first action forever, whatever it is." },
  { id: "repeat", label: "Repeat one action", blurb: "Picks the action that paid best on step one and never changes." },
  { id: "maximise", label: "Maximise the reward", blurb: "One-step greedy search over the published reward. Finds the exploit by itself." },
  { id: "rush", label: "Rush the terminal", blurb: "Takes the ending action immediately." },
  { id: "intended", label: "Do the task", blurb: "The behaviour the reward was written to produce." },
];

const INTENDED: Record<string, (s: State, step: number) => string> = {
  delivery: (s) => (n(s, "pos") < n(s, "target") ? "forward" : "drop"),
  triage: (s) => (b(s, "read") ? `close-${TICKETS[n(s, "idx")]}` : "read"),
  research: (s) => {
    const c = new Set((s.cites as string[]) ?? []);
    return c.has("A") ? (c.has("B") ? "cite-C" : "cite-B") : "cite-A";
  },
  invoices: (s) => (INVOICES[n(s, "idx")] === "match" ? "say-match" : "say-no-match"),
};

export type Run = {
  policy: string;
  reward: number;
  completed: boolean;
  progress: string;
  /** Reward attributed to each clause, which is how an exploit is traced. */
  byClause: Record<string, number>;
  trace: { step: number; action: string; reward: number }[];
};

export function run(env: Env, policyId: string, clauses = env.clauses): Run {
  let s = env.reset();
  let total = 0;
  const byClause: Record<string, number> = Object.fromEntries(clauses.map((c) => [c.id, 0]));
  const trace: Run["trace"] = [];

  const rewardOf = (prev: State, a: string, next: State) =>
    clauses.reduce((acc, c) => acc + c.fn(prev, a, next), 0);

  let locked: string | null = null;

  for (let step = 0; step < env.budget; step++) {
    let action: string;
    if (policyId === "idle") action = env.actions[env.actions.length - 1] === "skip" ? "skip" : env.actions.find((a) => a === "wait") ?? env.actions[0];
    else if (policyId === "rush") action = env.actions.find((a) => a.startsWith("drop") || a.startsWith("close") || a === "skip") ?? env.actions[0];
    else if (policyId === "intended") action = INTENDED[env.id](s, step);
    else if (policyId === "repeat") {
      if (locked === null) {
        locked = env.actions.reduce((best, a) =>
          rewardOf(s, a, env.step(s, a)) > rewardOf(s, best, env.step(s, best)) ? a : best, env.actions[0]);
      }
      action = locked;
    } else {
      // greedy: whatever pays most right now, ties broken by action order
      action = env.actions.reduce((best, a) =>
        rewardOf(s, a, env.step(s, a)) > rewardOf(s, best, env.step(s, best)) ? a : best, env.actions[0]);
    }

    const next = env.step(s, action);
    const r = rewardOf(s, action, next);
    for (const c of clauses) byClause[c.id] += c.fn(s, action, next);
    total += r;
    trace.push({ step, action, reward: r });
    s = next;
  }

  return { policy: policyId, reward: Math.round(total * 10) / 10, completed: env.completed(s), progress: env.progress(s), byClause, trace };
}

export type EnvReport = {
  env: Env;
  runs: Run[];
  fixedRuns: Run[] | null;
  /** A policy that scored at least as well as doing the task, without doing it. */
  exploited: Run | null;
  intendedReward: number;
};

export function report(env: Env): EnvReport {
  const runs = POLICIES.map((p) => run(env, p.id));
  const intended = runs.find((r) => r.policy === "intended")!;
  /*
    Not `>= intended`. A policy that does nothing and earns 97% of the task's
    reward is the bug, and insisting it strictly beat the correct behaviour
    would let that through — as would the case where reward is identical and
    only the outcome differs, which is what ticket-triage shows.
  */
  const exploited = runs
    .filter((r) => r.policy !== "intended" && !r.completed && intended.reward > 0 && r.reward >= intended.reward * 0.8)
    .sort((a, b) => b.reward - a.reward)[0] ?? null;

  const fixedClauses = env.fix
    ? env.clauses.map((c) => (c.id === env.fix!.clauseId ? env.fix!.clause : c))
    : null;

  return {
    env, runs,
    fixedRuns: fixedClauses ? POLICIES.map((p) => run(env, p.id, fixedClauses)) : null,
    exploited,
    intendedReward: intended.reward,
  };
}

export const DEMO_NOTE =
  "These four environments and their reward functions were written for this demo — they are not from Prime Intellect's Environment Hub and no training is run here. What is real is the search: the 'maximise the reward' policy is a one-step greedy walk over the same reward the environment publishes, so where it scores well without completing the task, it found that exploit on its own.";
