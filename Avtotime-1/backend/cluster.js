import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import { createWorkerPool } from "./config/workerRoles.js";

const WORKERS = Number(process.env.CLUSTER_WORKERS) || availableParallelism();

if (cluster.isPrimary) {
  console.log(`[cluster] primary ${process.pid}: spawning ${WORKERS} workers`);

  // Exactly one worker runs the background jobs, and the role has to survive
  // that worker crashing — see config/workerRoles.js for why the worker cannot
  // decide this from its own id.
  const pool = createWorkerPool({ fork: (env) => cluster.fork(env), size: WORKERS });
  pool.start();

  cluster.on("exit", (worker, code, signal) => {
    const { heldJobs } = pool.replace(worker);
    const suffix = heldJobs ? ", held the background jobs" : "";
    console.log(
      `[cluster] worker ${worker.process.pid} exited (code=${code ?? "-"}, signal=${signal ?? "-"}${suffix}), restarting…`,
    );
  });
} else {
  await import("./index.js");
}
