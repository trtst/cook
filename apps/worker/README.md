# 炊火记 Worker

`apps/worker` is the async worker boundary. Meal reminders, knowledge articles, and shared weekly topics have independent enable switches. Scheduled publishing does not consume Outbox events.

Other Outbox and worker behavior remains disabled. Do not add unrelated event
types or consumers to this runtime.

## Commands

```bash
pnpm type-check
pnpm build
pnpm dev
```

## Runtime

`WORKER_ENABLED` defaults to `false` and controls only meal reminders. When enabled, configure `DATABASE_URL`,
`WECHAT_APP_ID`, `WECHAT_APP_SECRET`, and `WECHAT_MEAL_REMINDER_TEMPLATE_ID`.

`ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED` defaults to `false`. It can run
without meal reminder credentials and requires only `DATABASE_URL` plus the
article scheduled-publish migration.

`HOME_TOPIC_SCHEDULED_PUBLISH_WORKER_ENABLED` defaults to `false`. It requires
only `DATABASE_URL` and the shared weekly topic migration. At publish time it
locks due draft rows, rechecks that every weekday still has a publicly eligible
recipe, then publishes using the scheduled timestamp. If the menu is no longer
complete, it clears the schedule, leaves the topic as a draft, increments its
version, and writes a system audit event.

When all switches are disabled, the worker prints a short status line and
exits without opening PostgreSQL or WeChat connections. When the reminder
switch is enabled, it claims only due
`MEAL_REMINDER_SEND` rows, in bounded batches, and uses the current user’s
WeChat identity and the event or plan state as final delivery checks.

Delivery is at least once: transient send failures retry, so an ambiguous
WeChat response may rarely result in a duplicate. A single row is claimed at a
time and stale processing claims are recovered after 15 minutes to reduce the
chance of reclaiming a reminder while another worker may still be sending it.
Recoveries are logged by count only.

Do not set `WORKER_ENABLED=true` until the meal reminder migration and matching
WeChat template configuration are deployed. Do not enable article or home topic
publishing until their scheduled-publish migrations are deployed. No other
Outbox event is processed by this worker.

## Production deployment

The full `./deploy.sh` release applies pending API migrations first, then builds
and starts or reloads the PM2 process `cook-worker`. Before the first release,
create `apps/worker/.env` from `.env.example` and set the production
`DATABASE_URL` plus `ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED=true`. Keep
the existing `WORKER_ENABLED` setting for meal reminders; when unset, it
defaults to `false`.
The process loads only this worker-specific environment file; do not copy the
API environment file into the worker directory.
