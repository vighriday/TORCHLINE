import { useEffect, useRef, useState } from 'react';
import type { WorldHistoryPage } from '@torchline/contracts';
import { request } from './api.ts';
export function useWorldHistory(worldId: string) {
  const identity = useRef(worldId);
  identity.current = worldId;
  const [record, setRecord] = useState<WorldHistoryPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setRecord(null);
    setError('');
    setLoading(true);
    void request<WorldHistoryPage>(`/api/worlds/${encodeURIComponent(worldId)}/history`)
      .then((value) => {
        if (active) setRecord(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [worldId]);
  async function load(kind: 'events' | 'custody' | 'refresh' = 'events') {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (record && kind !== 'refresh') {
        params.set('through', String(record.throughSequence));
        if (kind === 'events' && record.nextCursor !== null)
          params.set('before', String(record.nextCursor));
        if (kind === 'custody' && record.nextCustodyCursor)
          params.set('custodyBefore', record.nextCustodyCursor);
      }
      const next = await request<WorldHistoryPage>(
        `/api/worlds/${encodeURIComponent(worldId)}/history?${params}`,
      );
      if (identity.current !== worldId) return;
      setRecord((previous) =>
        !previous || kind === 'refresh'
          ? next
          : {
              ...previous,
              events: kind === 'events' ? [...previous.events, ...next.events] : previous.events,
              nextCursor: kind === 'events' ? next.nextCursor : previous.nextCursor,
              custody:
                kind === 'custody' ? [...previous.custody, ...next.custody] : previous.custody,
              nextCustodyCursor:
                kind === 'custody' ? next.nextCustodyCursor : previous.nextCustodyCursor,
            },
      );
    } catch (e) {
      if (identity.current === worldId) setError((e as Error).message);
    } finally {
      if (identity.current === worldId) setLoading(false);
    }
  }
  return { record, error, loading, load };
}
