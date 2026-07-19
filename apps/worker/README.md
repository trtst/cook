# Next Meal Worker

`apps/worker` is the reserved async worker boundary.

V1 keeps Outbox and worker behavior disabled. This package exists so the
workspace shape, scripts, and type-check path are ready before real worker
behavior is confirmed.

## Commands

```bash
pnpm --filter @next-meal/worker type-check
pnpm --filter @next-meal/worker build
pnpm --filter @next-meal/worker dev
```

## Runtime

`WORKER_ENABLED` defaults to `false`.

When disabled, the worker prints a short status line and exits without opening
Redis, BullMQ, Prisma, or Outbox connections.

Do not set `WORKER_ENABLED=true` until worker behavior is in scope and the
Outbox execution contract has been confirmed.
