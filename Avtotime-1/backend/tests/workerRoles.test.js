import { describe, expect, it } from "vitest";
import {
  BACKGROUND_JOBS_ENV,
  createWorkerPool,
  shouldRunBackgroundJobs,
} from "../config/workerRoles.js";

// Mimics node's cluster: ids increase monotonically and are NEVER reused, which
// is the whole reason the old `worker.id === 1` check broke.
const fakeCluster = () => {
  let nextId = 1;
  const forked = [];
  return {
    forked,
    fork: (env) => {
      const worker = { id: nextId++, env };
      forked.push(worker);
      return worker;
    },
  };
};

const jobWorkers = (forked) => forked.filter((w) => shouldRunBackgroundJobs(w.env));

describe("who runs the singleton background jobs", () => {
  it("gives the role to exactly one worker at startup", () => {
    const cluster = fakeCluster();
    const pool = createWorkerPool({ fork: cluster.fork, size: 4 });

    pool.start();

    expect(cluster.forked).toHaveLength(4);
    expect(jobWorkers(cluster.forked)).toHaveLength(1);
    expect(pool.jobHolder).toBe(1);
  });

  it("hands the role to the replacement when the holder dies", () => {
    const cluster = fakeCluster();
    const pool = createWorkerPool({ fork: cluster.fork, size: 2 });
    pool.start();
    const holder = cluster.forked.find((w) => shouldRunBackgroundJobs(w.env));

    const { worker: replacement, heldJobs } = pool.replace(holder);

    expect(heldJobs).toBe(true);
    expect(shouldRunBackgroundJobs(replacement.env)).toBe(true);
    // The replacement's id is 3, not 1 — the exact reason the old check failed.
    expect(replacement.id).toBe(3);
    expect(pool.jobHolder).toBe(3);
  });

  it("does not duplicate the role when an ordinary worker dies", () => {
    const cluster = fakeCluster();
    const pool = createWorkerPool({ fork: cluster.fork, size: 3 });
    pool.start();
    const ordinary = cluster.forked.find((w) => !shouldRunBackgroundJobs(w.env));

    const { heldJobs } = pool.replace(ordinary);

    expect(heldJobs).toBe(false);
    // Two job runners would mean duplicate notifications and double DB polling.
    expect(jobWorkers(cluster.forked)).toHaveLength(1);
    expect(pool.jobHolder).toBe(1);
  });

  it("keeps the role alive across repeated crashes", () => {
    const cluster = fakeCluster();
    const pool = createWorkerPool({ fork: cluster.fork, size: 2 });
    pool.start();

    // This is the regression: under the old id-based check the jobs stopped
    // forever after the first crash and nothing reported it.
    let holder = cluster.forked.find((w) => shouldRunBackgroundJobs(w.env));
    for (let crash = 0; crash < 5; crash += 1) {
      holder = pool.replace(holder).worker;
      expect(shouldRunBackgroundJobs(holder.env)).toBe(true);
    }

    expect(pool.jobHolder).toBe(holder.id);
    expect(holder.id).toBeGreaterThan(2);
  });
});

describe("the env contract between primary and worker", () => {
  it("treats only the explicit marker as opt-in", () => {
    expect(shouldRunBackgroundJobs({ [BACKGROUND_JOBS_ENV]: "1" })).toBe(true);
    expect(shouldRunBackgroundJobs({ [BACKGROUND_JOBS_ENV]: "0" })).toBe(false);
    expect(shouldRunBackgroundJobs({})).toBe(false);
    expect(shouldRunBackgroundJobs(undefined)).toBe(false);
    // Not truthy-coerced: a stray "true" or "yes" must not silently elect a
    // second runner.
    expect(shouldRunBackgroundJobs({ [BACKGROUND_JOBS_ENV]: "true" })).toBe(false);
  });
});
