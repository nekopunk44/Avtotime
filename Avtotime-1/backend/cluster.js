import cluster from "node:cluster";
import { availableParallelism } from "node:os";

const WORKERS = Number(process.env.CLUSTER_WORKERS) || availableParallelism();

if (cluster.isPrimary) {
  console.log(`[cluster] primary ${process.pid}: spawning ${WORKERS} workers`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`[cluster] worker ${worker.process.pid} exited (code=${code ?? "-"}, signal=${signal ?? "-"}), restarting…`);
    cluster.fork();
  });
} else {
  await import("./index.js");
}
