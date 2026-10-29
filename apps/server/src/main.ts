import { Store, REQUIRED_MIGRATION } from '@torchline/storage';
import { createApp } from './app.ts';
import { runtimeConfig } from './runtime-config.ts';

let store: Store | undefined;
let app: Awaited<ReturnType<typeof createApp>> | undefined;
let stopping: Promise<void> | undefined;
const shutdown = (code = 0) => {
  if (code) process.exitCode = code;
  return (stopping ??= (async () => {
    // Fastify runs onClose hooks in reverse registration order. End its worker
    // lease before ending the pool, otherwise pool.end waits on that lease forever.
    await app?.close();
    await store?.close();
  })().catch(() => {
    process.exitCode = 1;
  }));
};
try {
  const runtime = runtimeConfig(process.env);
  store = new Store(runtime.databaseUrl, runtime.databaseBudgets);
  if (
    !(await store.pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [REQUIRED_MIGRATION]))
      .rowCount
  )
    throw new Error('Database migration required. Run the migration command for this mode.');
  app = await createApp(store, runtime.config, {
    logger: true,
    onFatal: () => {
      void shutdown(1);
    },
  });
  await app.listen({ port: runtime.port, host: runtime.host });
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void shutdown();
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
  await shutdown(1);
}
