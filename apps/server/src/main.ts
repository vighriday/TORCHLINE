import { Store, REQUIRED_MIGRATION } from '@torchline/storage';
import { createApp } from './app.ts';
import { runtimeConfig } from './runtime-config.ts';

let store: Store | undefined;
let app: Awaited<ReturnType<typeof createApp>> | undefined;
try {
  const runtime = runtimeConfig(process.env);
  store = new Store(runtime.databaseUrl);
  if (
    !(await store.pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [REQUIRED_MIGRATION]))
      .rowCount
  )
    throw new Error('Database migration required. Run the migration command for this mode.');
  app = await createApp(store, runtime.config, {
    logger: true,
    onFatal: () => {
      process.exitCode = 1;
    },
  });
  const ownedStore = store;
  app.addHook('onClose', async () => ownedStore.close());
  await app.listen({ port: runtime.port, host: runtime.host });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      void app!.close().catch(() => {
        process.exitCode = 1;
      });
    });
} catch (error) {
  const code = (error as { code?: string }).code;
  console.error(
    !store && error instanceof Error
      ? error.message
      : code
        ? `TORCHLINE startup failed (${code}). Check database/migrations and host configuration.`
        : 'TORCHLINE startup failed. Check configuration with the deployment runbook; no credentials printed.',
  );
  await app?.close().catch(() => {});
  await store?.close().catch(() => {});
  process.exitCode = 1;
}
