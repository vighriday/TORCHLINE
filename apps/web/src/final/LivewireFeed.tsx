import { lazy, Suspense } from 'react';
import type { LivewireStake } from '@torchline/contracts';
import { SceneBoundary } from './SceneBoundary.tsx';
import type { FeedPhase } from './feedKit.tsx';
import type { GameContext } from './types.ts';

// Each practice feed is its own chunk, so a creator only downloads the scene they pick.
const scenes = {
  voxel: lazy(() => import('./VoxelScene.tsx').then((module) => ({ default: module.VoxelScene }))),
  rocket: lazy(() =>
    import('./RocketScene.tsx').then((module) => ({ default: module.RocketScene })),
  ),
  souls: lazy(() => import('./SoulsScene.tsx').then((module) => ({ default: module.SoulsScene }))),
};

export const gameContexts: Record<
  GameContext,
  { name: string; attempt: string; preset: LivewireStake['preset'] }
> = {
  voxel: { name: 'Minecraft', attempt: 'LAVA GAP JUMP', preset: 'challenge' },
  rocket: { name: 'Rocket League', attempt: 'AERIAL GOAL', preset: 'match' },
  souls: { name: 'Souls Run', attempt: 'BOSS ATTEMPT', preset: 'boss' },
};

/** A saved mission always replays in the scene of the preset it was opened with. */
export function contextForPreset(preset: LivewireStake['preset']): GameContext {
  return preset === 'match' ? 'rocket' : preset === 'boss' ? 'souls' : 'voxel';
}

export function GameFeed({
  context,
  phase,
  reducedMotion,
}: {
  context: GameContext;
  phase: FeedPhase;
  reducedMotion: boolean;
}) {
  const Scene = scenes[context];
  return (
    <SceneBoundary>
      <Suspense
        fallback={
          <div className="ark-canvas-loading">
            <span>LOADING ILLUSTRATIVE PRACTICE SCENE</span>
            <b>{gameContexts[context].name}</b>
          </div>
        }
      >
        <Scene key={context} phase={phase} reducedMotion={reducedMotion} />
      </Suspense>
    </SceneBoundary>
  );
}

const banners: Record<GameContext, { win: string; loss: string }> = {
  voxel: { win: 'GAP CLEARED', loss: 'LOST TO THE LAVA' },
  rocket: { win: 'GOAL', loss: 'OFF THE CROSSBAR' },
  souls: { win: 'WARDEN FELLED', loss: 'YOU FELL' },
};

/**
 * Game-styled heads-up display drawn over the practice feed. It mirrors the feed phase and, once
 * the streamer's result is saved, the outcome; it never claims to read the real game.
 */
export function GameHud({
  context,
  phase,
  game,
  attempt,
  awaiting,
}: {
  context: GameContext;
  phase: FeedPhase;
  game: string;
  attempt: string;
  awaiting: boolean;
}) {
  return (
    <div className={`game-hud game-hud--${context}`} data-phase={phase} aria-hidden="true">
      <div className="game-feed-label">
        <span>ILLUSTRATIVE GAMEPLAY — NOT GAME TELEMETRY</span>
        <b>
          {game.toUpperCase()} / {attempt}
        </b>
        {awaiting && <em>AWAITING STREAMER ATTESTATION</em>}
      </div>
      {context === 'voxel' && (
        <>
          <div className="game-crosshair" />
          <div className="game-hearts">
            {Array.from({ length: 10 }, (_, i) => (
              <i
                key={i}
                className={i > 7 ? 'empty' : ''}
                style={{ transitionDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
          <div className="game-xp">
            <i />
          </div>
          <div className="game-hotbar">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={i === 2 ? 'active' : ''} />
            ))}
          </div>
        </>
      )}
      {context === 'rocket' && (
        <>
          <div className="arena-score">
            <span className="arena-team arena-team--blue">
              <small>BLUE</small>
              <b>{phase === 'win' ? 3 : 2}</b>
            </span>
            <span className="arena-clock">
              <small>OVERTIME</small>
              <b>+0:42</b>
            </span>
            <span className="arena-team arena-team--orange">
              <b>2</b>
              <small>ORANGE</small>
            </span>
          </div>
          <div className="arena-boost">
            <svg viewBox="0 0 120 120">
              <circle className="arena-boost-track" cx="60" cy="60" r="50" />
              <circle className="arena-boost-fill" cx="60" cy="60" r="50" pathLength={100} />
            </svg>
            <b>{phase === 'idle' ? 100 : 12}</b>
            <small>BOOST</small>
          </div>
          <span className="arena-cam">BALL CAM</span>
        </>
      )}
      {context === 'souls' && (
        <>
          <div className="souls-vitals">
            <i className="souls-vital souls-vital--health">
              <em />
            </i>
            <i className="souls-vital souls-vital--focus">
              <em />
            </i>
            <i className="souls-vital souls-vital--stamina">
              <em />
            </i>
          </div>
          <div className="souls-boss">
            <span>THE ECLIPSED WARDEN</span>
            <i>
              <em />
            </i>
          </div>
        </>
      )}
      {(phase === 'win' || phase === 'loss') && (
        <div className={`game-banner game-banner--${phase}`}>
          <strong>{banners[context][phase]}</strong>
          <small>STREAMER-ATTESTED · SAVED TO THE ARK</small>
        </div>
      )}
    </div>
  );
}
