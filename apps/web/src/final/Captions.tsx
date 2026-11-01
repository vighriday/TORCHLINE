import { useEffect, useRef, useState } from 'react';
import { useGame } from './session.tsx';

/**
 * Text captions for newly saved consequences, so a captain who has sound off (or relies on text)
 * still notices each change as it lands. Honors the Captions setting. The read-only broadcast
 * keeps its own signal strip and is not captioned here.
 */
export function ConsequenceCaptions() {
  const { canonical, preferences, readOnly } = useGame();
  const last = useRef<{ id: string; version: number } | null>(null);
  const [caption, setCaption] = useState<{ key: string; text: string; loss: boolean } | null>(null);
  useEffect(() => {
    const previous = last.current;
    last.current = canonical ? { id: canonical.worldId, version: canonical.gameVersion } : null;
    if (
      !canonical ||
      !previous ||
      previous.id !== canonical.worldId ||
      canonical.gameVersion <= previous.version ||
      readOnly ||
      !preferences.captions
    )
      return;
    const event = canonical.events.at(-1);
    if (!event) return;
    setCaption({
      key: event.id,
      text: event.summary,
      loss: Object.values(event.resourceDelta).some((value) => (value ?? 0) < 0),
    });
    const timer = setTimeout(() => setCaption(null), 6000);
    return () => clearTimeout(timer);
  }, [canonical?.worldId, canonical?.gameVersion, preferences.captions, readOnly]);
  useEffect(() => {
    if (!preferences.captions) setCaption(null);
  }, [preferences.captions]);
  if (!caption) return null;
  return (
    <div
      key={caption.key}
      className="consequence-caption"
      data-tone={caption.loss ? 'loss' : 'gain'}
      role="status"
      aria-live="polite"
    >
      <span>SAVED CONSEQUENCE</span>
      <p>{caption.text}</p>
    </div>
  );
}
