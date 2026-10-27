import { useEffect, useState } from 'react';
import type { HandoffPreview } from '@torchline/contracts';
import { request } from './api.ts';
import { ArkView } from './ArkView.tsx';
import { ResourceMeters } from './DeckViews.tsx';

export function HandoffInspector({
  id,
  status,
  onClose,
}: {
  id: string;
  status: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<HandoffPreview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setPreview(null);
    setError('');
    void request<HandoffPreview>(`/api/handoffs/${encodeURIComponent(id)}/preview`)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, status]);
  return (
    <section className="handoff-inspector" aria-label="Incoming Ark preview">
      <div className="section-heading">
        <h3>Inspect the torch you will carry</h3>
        <button className="quiet" onClick={onClose}>
          Close preview
        </button>
      </div>
      {error ? (
        <p role="status">Preview unavailable: {error}</p>
      ) : !preview ? (
        <p role="status">Loading the saved Ark…</p>
      ) : (
        <>
          <p>
            <strong>{preview.source.label}</strong> → <strong>{preview.target.label}</strong> ·
            chapter {preview.world.chapter} · {preview.status}
          </p>
          <p>{preview.world.recap}</p>
          <ResourceMeters world={preview.world} />
          <ArkView systems={preview.world.systems} resources={preview.world.resources} readOnly />
          <p>
            This is the frozen Ark on offer. Acceptance remains a separate action after{' '}
            {preview.world.mode === 'simulation'
              ? 'simulated evidence'
              : 'verified native raid evidence'}
            .
          </p>
          <p className="muted">
            Offer expires{' '}
            <time dateTime={preview.expiresAt}>{new Date(preview.expiresAt).toLocaleString()}</time>
            .
          </p>
        </>
      )}
    </section>
  );
}
