const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const { hasServerEntry, jsStamp } = require("./dev-api-stamp.cjs");

const tsc = require.resolve("typescript/bin/tsc");
const root = process.cwd();
const dist = path.join(root, "dist");

const initial = spawnSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
  cwd: process.cwd(),
  stdio: "inherit"
});

if (initial.status !== 0) {
  process.exit(initial.status ?? 1);
}

const compiler = spawn(process.execPath, [
  tsc,
  "-p",
  "tsconfig.json",
  "--watch",
  "--watchFile",
  "fixedPollingInterval",
  "--watchDirectory",
  "fixedPollingInterval",
  "--preserveWatchOutput"
], {
  cwd: root,
  stdio: "inherit"
});

let stopping = false;
let restarting = false;
let server;
let restartTimer;
let startTimer;

function startServer() {
  if (!hasServerEntry(dist)) {
    clearTimeout(startTimer);
    startTimer = setTimeout(() => {
      if (!stopping) startServer();
    }, 250);
    return;
  }

  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: root,
    stdio: "inherit"
  });
  server.on("exit", code => {
    if (stopping) return;
    if (restarting) {
      restarting = false;
      startServer();
      return;
    }
    stop("SIGTERM");
    process.exitCode = code ?? 1;
  });
}

let stamp = jsStamp(dist);
let warming = true;
startServer();

setTimeout(() => {
  stamp = jsStamp(dist);
  warming = false;
}, 3000);

const poller = setInterval(() => {
  if (warming) return;
  const nextStamp = jsStamp(dist);
  if (nextStamp <= stamp) return;
  stamp = nextStamp;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (stopping || !server) return;
    restarting = true;
    server.kill("SIGTERM");
  }, 250);
}, 750);

function stop(signal) {
  if (stopping) return;
  stopping = true;
  clearInterval(poller);
  clearTimeout(restartTimer);
  clearTimeout(startTimer);
  compiler.kill(signal);
  server?.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

compiler.on("exit", code => {
  if (stopping) return;
  stop("SIGTERM");
  process.exitCode = code ?? 1;
});
