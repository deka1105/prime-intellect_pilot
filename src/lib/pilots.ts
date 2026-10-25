import type { ComponentType } from "react";

/**
 * The pilots built for Prime Intellect.
 *
 * Extracted from the pilot factory; each entry points at a folder under
 * `companies/prime-intellect/`. Adding one by hand means creating that folder and
 * appending here, exactly as in the source repo.
 */
export type Pilot = {
  slug: string;
  title: string;
  company: string;
  useCase: string;
  demo: string;
  built: string;
  tier: "eval" | "outreach";
  load: () => Promise<{ default: ComponentType }>;
};

export const pilots: Pilot[] = [
  {
    slug: "prime-intellect-reward-hack-harness",
    title: "Reward-hack harness",
    company: "prime-intellect",
    useCase: "UC-1",
    demo: "Four RL environments against a battery of trivial policies: doing literally nothing scores 16 of a possible 16.4 on one, and on another the reward is identical to the correct behaviour while only 5 of 12 tickets end up labelled right.",
    built: "2026-10-25",
    tier: "eval",
    load: () => import("@companies/prime-intellect/prime-intellect-reward-hack-harness/Pilot"),
  },
];

export function getPilot(slug: string): Pilot | undefined {
  return pilots.find((p) => p.slug === slug);
}
