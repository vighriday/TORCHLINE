import { Store } from '@torchline/storage';
if (!process.env.DATABASE_URL)
  throw new Error(
    'DATABASE_URL missing. Run pnpm db:up or configure an isolated PostgreSQL database.',
  );
const store = new Store(process.env.DATABASE_URL);
try {
  await store.migrate();
  console.log('Database migrations applied.');
} finally {
  await store.close();
}
