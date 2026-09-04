/**
 * Which worker runs the singleton background jobs (plan expiry, moderation queue).
 *
 * The obvious test — `cluster.worker.id === 1` inside the worker — is wrong:
 * cluster ids increase monotonically and are never reused, so the first time
 * that worker dies its replacement gets id 2 and the condition is false for the
 * rest of the process's life. The jobs stop, nothing logs an error, and nobody
 * notices until subscriptions quietly outlive their expiry date.
 *
 * Only the primary knows which workers exist, so it hands the role out at fork
 * time and hands it on when the holder dies.
 */
export const BACKGROUND_JOBS_ENV = "RUN_BACKGROUND_JOBS";

export const forkEnvFor = (runsJobs) => ({ [BACKGROUND_JOBS_ENV]: runsJobs ? "1" : "0" });

export const shouldRunBackgroundJobs = (env = process.env) =>
  env?.[BACKGROUND_JOBS_ENV] === "1";

/**
 * Tracks which worker currently holds the role. Kept separate from cluster.js so
 * the handover rule can be tested without forking real processes.
 */
export const createBackgroundJobRole = () => {
  let holderId = null;

  return {
    assignTo(workerId) {
      holderId = workerId;
    },
    isHeldBy(workerId) {
      return holderId !== null && workerId === holderId;
    },
    get holder() {
      return holderId;
    },
  };
};

/**
 * The primary's fork/replace algorithm, separated from cluster.js so it can be
 * driven by a test without forking real processes.
 *
 * `fork` receives the env for the new worker and must return an object with an
 * `id`, exactly like `cluster.fork()` does.
 */
export const createWorkerPool = ({ fork, size }) => {
  const role = createBackgroundJobRole();

  const spawn = (runsJobs) => {
    const worker = fork(forkEnvFor(runsJobs));
    if (runsJobs) role.assignTo(worker.id);
    return worker;
  };

  return {
    start() {
      for (let i = 0; i < size; i += 1) spawn(i === 0);
    },
    /** Replaces a dead worker, carrying the job role over if it held it. */
    replace(deadWorker) {
      const heldJobs = role.isHeldBy(deadWorker.id);
      return { worker: spawn(heldJobs), heldJobs };
    },
    get jobHolder() {
      return role.holder;
    },
  };
};
