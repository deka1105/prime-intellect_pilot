import { DemoBanner } from "@/lib/app-shell";
import { DEMO_NOTE } from "./envs";
import { Harness } from "./Harness";

/**
 * Reward-hack harness — Prime Intellect P-1.
 *
 * Stateless: four environments, a battery of policies, and a greedy search run
 * in the browser. Nothing is trained and nothing persists.
 */
export default function RewardHackHarnessPilot() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
      <DemoBanner>{DEMO_NOTE}</DemoBanner>

      <h1 className="text-lg font-semibold tracking-tight">
        This reward function looks right. Here are four policies that beat it without doing the task.
      </h1>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-foreground/65">
        A badly specified reward does not fail loudly — it trains successfully on the wrong thing
        and bills you for the GPU hours. Each environment below is checked against policies dumber
        than anything you would deploy; if one of them scores, a trained model will find it faster.
      </p>

      <div className="mt-6">
        <Harness />
      </div>
    </div>
  );
}
