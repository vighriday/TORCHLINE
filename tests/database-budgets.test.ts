import { expect, it } from 'vitest';
import { Store } from '@torchline/storage';
import { database } from './helpers.ts';

it('cancels blocked SQL at PostgreSQL, rolls back partial work and permits a clean retry', () =>
  database(async (store, url) => {
    const bounded = new Store(url, { statementMs: 350, lockMs: 100, idleTransactionMs: 500 });
    const blocker = await store.pool.connect();
    try {
      await store.pool.query(
        'CREATE TABLE budget_probe(id int PRIMARY KEY, value int NOT NULL); INSERT INTO budget_probe VALUES(1,0),(2,0)',
      );
      await blocker.query('BEGIN');
      await blocker.query('UPDATE budget_probe SET value=1 WHERE id=1');
      await expect(
        bounded.transaction(async (c) => {
          await c.query('UPDATE budget_probe SET value=1 WHERE id=2');
          await c.query('UPDATE budget_probe SET value=1 WHERE id=1');
        }),
      ).rejects.toMatchObject({ code: '55P03' });
      expect(
        (await store.pool.query('SELECT value FROM budget_probe WHERE id=2')).rows[0].value,
      ).toBe(0);
      await blocker.query('ROLLBACK');
      await bounded.transaction(async (c) => {
        await c.query('UPDATE budget_probe SET value=value+1 WHERE id=1');
      });
      expect(
        (await store.pool.query('SELECT value FROM budget_probe WHERE id=1')).rows[0].value,
      ).toBe(1);
      await expect(bounded.pool.query('SELECT pg_sleep(1)')).rejects.toMatchObject({
        code: '57014',
      });
      expect((await bounded.pool.query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await bounded.close();
    }
  }));

it('discards a terminated idle transaction without crashing or masking the original application error', () =>
  database(async (store, url) => {
    const bounded = new Store(url, { statementMs: 1000, lockMs: 100, idleTransactionMs: 150 });
    try {
      const original = new Error('application-aborted');
      await expect(
        bounded.transaction(async (c) => {
          await c.query('CREATE TABLE rolled_back_probe(id int)');
          await new Promise((r) => setTimeout(r, 400));
          throw original;
        }),
      ).rejects.toBe(original);
      expect(
        (await store.pool.query("SELECT to_regclass('rolled_back_probe') AS name")).rows[0].name,
      ).toBeNull();
      expect((await bounded.pool.query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
    } finally {
      await bounded.close();
    }
  }));
