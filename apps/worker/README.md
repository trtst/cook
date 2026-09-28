# 炊火记 Worker

`apps/worker` is the async worker boundary. Its enabled runtime currently consumes only the confirmed meal reminder Outbox event `MEAL_REMINDER_SEND`.

Other Outbox and worker behavior remains disabled. Do not add unrelated event
types or consumers to this runtime.

## Commands

```bash
pnpm type-check
pnpm build
pnpm dev
```

## Runtime

`WORKER_ENABLED` defaults to `false`. When enabled, configure `DATABASE_URL`,
`WECHAT_APP_ID`, `WECHAT_APP_SECRET`, and `WECHAT_MEAL_REMINDER_TEMPLATE_ID`.

When disabled, the worker prints a short status line and exits without opening
PostgreSQL or WeChat connections. When enabled, it claims only due
`MEAL_REMINDER_SEND` rows, in bounded batches, and uses the current user’s
WeChat identity and the event or plan state as final delivery checks.

Delivery is at least once: transient send failures retry, so an ambiguous
WeChat response may rarely result in a duplicate. A single row is claimed at a
time and stale processing claims are recovered after 15 minutes to reduce the
chance of reclaiming a reminder while another worker may still be sending it.
Recoveries are logged by count only.

Do not set `WORKER_ENABLED=true` until the meal reminder migration and the
matching WeChat template configuration are deployed. No other Outbox event is
processed by this worker.
