import { useEffect, useRef } from 'react';
import { useGame } from './session.tsx';
/** Optional local feedback, unlocked by an explicit user gesture. Never judges gameplay. */
export function SoundEffects() {
  const { preferences, canonical, readOnly } = useGame();
  const audio = useRef<AudioContext | null>(null);
  const last = useRef<{ id: string; version: number } | null>(null);
  useEffect(() => {
    if (readOnly || !preferences.audio) {
      void audio.current?.suspend();
      return;
    }
    const enable = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    document.addEventListener('pointerdown', enable);
    document.addEventListener('keydown', enable);
    return () => {
      document.removeEventListener('pointerdown', enable);
      document.removeEventListener('keydown', enable);
    };
  }, [preferences.audio, readOnly]);
  useEffect(() => {
    const previous = last.current;
    last.current = canonical ? { id: canonical.worldId, version: canonical.gameVersion } : null;
    if (
      !canonical ||
      !previous ||
      previous.id !== canonical.worldId ||
      canonical.gameVersion <= previous.version ||
      canonical.gameVersion - previous.version > 3 ||
      !preferences.audio ||
      readOnly ||
      audio.current?.state !== 'running'
    )
      return;
    const ctx = audio.current;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const loss = Object.values(canonical.events.at(-1)?.resourceDelta ?? {}).some(
      (value) => (value ?? 0) < 0,
    );
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(loss ? 165 : 440, ctx.currentTime);
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.22);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }, [canonical, preferences.audio, readOnly]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  return null;
}
