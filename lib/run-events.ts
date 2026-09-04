import type { Run, RunEvent } from "./types";

/**
 * Riduttore degli eventi di esecuzione. La console non sa da dove arrivano:
 * oggi li produce il driver simulato, domani lo stream della rotta di
 * esecuzione. Stessa forma, stessa UI.
 */
export function applyEvent(run: Run, event: RunEvent): Run {
  switch (event.type) {
    case "state":
      return { ...run, state: event.state };

    case "step": {
      const known = run.steps.some((s) => s.key === event.step.key);
      return {
        ...run,
        steps: known
          ? run.steps.map((s) => (s.key === event.step.key ? event.step : s))
          : [...run.steps, event.step],
      };
    }

    case "log":
      return { ...run, logs: [...run.logs, event.line] };

    case "brief":
      return { ...run, brief: event.brief };

    case "variant": {
      const known = run.variants.some((v) => v.index === event.variant.index);
      return {
        ...run,
        variants: known
          ? run.variants.map((v) => (v.index === event.variant.index ? event.variant : v))
          : [...run.variants, event.variant].sort((a, b) => a.index - b.index),
      };
    }

    case "caption": {
      const known = run.captions.some((c) => c.channel === event.caption.channel);
      return {
        ...run,
        captions: known
          ? run.captions.map((c) => (c.channel === event.caption.channel ? event.caption : c))
          : [...run.captions, event.caption],
      };
    }

    case "guard":
      return { ...run, guard: event.checks };

    case "asset": {
      const known = run.assets.some((a) => a.id === event.asset.id);
      return {
        ...run,
        assets: known
          ? run.assets.map((a) => (a.id === event.asset.id ? event.asset : a))
          : [...run.assets, event.asset],
      };
    }

    case "done":
      return event.run;

    case "error":
      return { ...run, state: "failed", error: event.message };
  }
}

/** Applica una sequenza in un colpo solo: usato al ripristino dopo un refresh. */
export function applyAll(run: Run, events: RunEvent[]): Run {
  return events.reduce(applyEvent, run);
}

/** Il passo attualmente in corso, se c'e'. */
export function activeStep(run: Run) {
  return run.steps.find((s) => s.status === "active") ?? null;
}

/** Avanzamento 0–1 sui passi dichiarati. */
export function progressOf(run: Run): number {
  if (run.steps.length === 0) return 0;
  const done = run.steps.filter((s) => s.status === "done").length;
  return done / run.steps.length;
}
