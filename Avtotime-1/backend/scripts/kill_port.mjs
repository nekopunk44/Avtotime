import { execSync } from "node:child_process";

const toInt = (value) => {
  const num = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(num) ? num : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getListeningPidsWindows = (port) => {
  const out = execSync("netstat -ano", { encoding: "utf8" });
  const pids = new Set();

  for (const rawLine of out.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Example:
    // TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       11256
    // TCP    [::]:8000              [::]:0                 LISTENING       11256
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;
    if (parts[0].toUpperCase() !== "TCP") continue;
    const local = parts[1] || "";
    const state = (parts[3] || "").toUpperCase();
    const pid = parts[4];
    if (!local.endsWith(`:${port}`)) continue;
    if (state !== "LISTENING") continue;
    const id = toInt(pid);
    if (id) pids.add(id);
  }

  return Array.from(pids);
};

const getListeningPidsUnix = (port) => {
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map(toInt)
      .filter((x) => typeof x === "number");
  } catch {
    return [];
  }
};

const getListeningPids = (port) => {
  if (process.platform === "win32") return getListeningPidsWindows(port);
  return getListeningPidsUnix(port);
};

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const killPid = async (pid) => {
  if (!pid || pid === process.pid) return;

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  for (let i = 0; i < 10; i += 1) {
    if (!isAlive(pid)) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(100);
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // ignore
  }
};

const main = async () => {
  const argPort = toInt(process.argv[2]);
  const envPort = toInt(process.env.PORT);
  const port = argPort ?? envPort ?? 8000;

  const pids = getListeningPids(port).filter((pid) => pid && pid !== process.pid);
  if (!pids.length) {
    console.log(`Port ${port} is free.`);
    return;
  }

  console.log(`Killing processes listening on port ${port}: ${pids.join(", ")}`);
  for (const pid of pids) {
    // eslint-disable-next-line no-await-in-loop
    await killPid(pid);
  }

  const still = getListeningPids(port).filter((pid) => pid && pid !== process.pid);
  if (still.length) {
    throw new Error(`Failed to free port ${port}. Still listening: ${still.join(", ")}`);
  }

  console.log(`Port ${port} is now free.`);
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

