const trueValues = new Set(["1", "true", "yes"]);

interface WorkerConfig {
  enabled: boolean;
  env: string;
}

function readConfig(): WorkerConfig {
  return {
    enabled: trueValues.has((process.env.WORKER_ENABLED ?? "").toLowerCase()),
    env: process.env.NODE_ENV ?? "development"
  };
}

function startWorker(config: WorkerConfig): void {
  if (!config.enabled) {
    console.info(`[worker] disabled in ${config.env}; no async jobs were started.`);
    return;
  }

  throw new Error("Worker runtime is reserved for a confirmed Outbox implementation.");
}

startWorker(readConfig());
