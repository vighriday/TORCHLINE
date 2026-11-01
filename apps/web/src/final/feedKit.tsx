import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Shared building blocks for the illustrative LIVEWIRE practice feeds. The feeds only depict an
// attempt; the streamer attests the real outcome, so nothing here reads or detects a game.
export type FeedPhase = 'idle' | 'attempt' | 'hold' | 'win' | 'loss';

export const easeIn = (t: number) => t * t * t;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Fraction of `duration` elapsed since `start`, clamped to [0, 1]. */
export function progress(time: number, start: number, duration: number) {
  return THREE.MathUtils.clamp((time - start) / duration, 0, 1);
}

/** Frame-rate independent exponential approach of `current` towards `target`. */
export function damp(current: THREE.Vector3, target: THREE.Vector3, lambda: number, delta: number) {
  return current.lerp(target, 1 - Math.exp(-lambda * delta));
}

/** Deterministic mulberry32 sequence, so every viewer sees the same crowd, stones and ash. */
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const SOFT_GLOW: Array<[number, string]> = [
  [0, 'rgba(255,255,255,1)'],
  [0.35, 'rgba(255,255,255,.45)'],
  [1, 'rgba(255,255,255,0)'],
];

/** Radial white falloff, tinted by the material colour of whatever uses it. */
export function glowTexture(stops: Array<[number, string]> = SOFT_GLOW) {
  return canvasTexture(128, 128, (context) => {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  });
}

/** Sky dome painted top (0) to bottom (1); 0.5 sits on the horizon. */
export function GradientSky({
  stops,
  radius = 420,
}: {
  stops: Array<[number, string]>;
  radius?: number;
}) {
  const texture = useMemo(
    () =>
      canvasTexture(4, 512, (context) => {
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        for (const [offset, color] of stops) gradient.addColorStop(offset, color);
        context.fillStyle = gradient;
        context.fillRect(0, 0, 4, 512);
      }),
    [stops],
  );
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[radius, 32, 24]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        fog={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Seconds since the feed entered its current phase. `changed` is true on the first frame of a
 * phase so a scene can capture where things were when the phase began.
 */
export function usePhaseTimer(phase: FeedPhase) {
  const clock = useRef<{ phase: FeedPhase | null; start: number }>({ phase: null, start: 0 });
  return (elapsed: number) => {
    if (clock.current.phase !== phase) {
      clock.current = { phase, start: elapsed };
      return { time: 0, changed: true };
    }
    return { time: elapsed - clock.current.start, changed: false };
  };
}

export interface BurstEvent {
  origin: THREE.Vector3;
  count: number;
  color: string;
  /** Launch speed range, metres per second. */
  speed: [number, number];
  /** Lifetime range in seconds. */
  life: [number, number];
  /** Preferred direction; launches spread around it. Omitted launches go every way. */
  direction?: THREE.Vector3;
  spread?: number;
  /** Half extents of a box to spawn inside instead of a single point. */
  box?: THREE.Vector3;
  gravity?: number;
  /** Upward acceleration, for embers and dissolving ash. */
  lift?: number;
  drag?: number;
  /** Births are staggered across this many seconds. */
  delay?: number;
}

const POOL = 2400;

/** One additive particle pool that drains queued bursts every frame. */
export function Bursts({ queue, size }: { queue: { current: BurstEvent[] }; size: number }) {
  const points = useRef<THREE.Points>(null);
  const sprite = useMemo(() => glowTexture(), []);
  const pool = useMemo(
    () => ({
      position: new Float32Array(POOL * 3),
      color: new Float32Array(POOL * 3),
      velocity: new Float32Array(POOL * 3),
      base: new Float32Array(POOL * 3),
      age: new Float32Array(POOL),
      life: new Float32Array(POOL),
      gravity: new Float32Array(POOL),
      lift: new Float32Array(POOL),
      drag: new Float32Array(POOL),
      next: 0,
      random: seeded(101),
      tint: new THREE.Color(),
      launch: new THREE.Vector3(),
      jitter: new THREE.Vector3(),
    }),
    [],
  );
  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    const p = pool;
    for (const burst of queue.current.splice(0)) {
      p.tint.set(burst.color);
      for (let n = 0; n < burst.count; n++) {
        const i = p.next;
        p.next = (p.next + 1) % POOL;
        const r = p.random;
        const o = i * 3;
        p.position[o] = burst.origin.x + (burst.box ? (r() * 2 - 1) * burst.box.x : 0);
        p.position[o + 1] = burst.origin.y + (burst.box ? (r() * 2 - 1) * burst.box.y : 0);
        p.position[o + 2] = burst.origin.z + (burst.box ? (r() * 2 - 1) * burst.box.z : 0);
        // A uniformly random unit vector, optionally bent towards the preferred direction.
        const z = r() * 2 - 1;
        const angle = r() * Math.PI * 2;
        const ring = Math.sqrt(1 - z * z);
        p.jitter.set(ring * Math.cos(angle), ring * Math.sin(angle), z);
        if (burst.direction)
          p.launch
            .copy(burst.direction)
            .normalize()
            .addScaledVector(p.jitter, burst.spread ?? 0.4)
            .normalize();
        else p.launch.copy(p.jitter);
        const speed = burst.speed[0] + r() * (burst.speed[1] - burst.speed[0]);
        p.velocity[o] = p.launch.x * speed;
        p.velocity[o + 1] = p.launch.y * speed;
        p.velocity[o + 2] = p.launch.z * speed;
        p.base[o] = p.tint.r;
        p.base[o + 1] = p.tint.g;
        p.base[o + 2] = p.tint.b;
        p.life[i] = burst.life[0] + r() * (burst.life[1] - burst.life[0]);
        p.age[i] = -(burst.delay ? r() * burst.delay : 0);
        p.gravity[i] = burst.gravity ?? 0;
        p.lift[i] = burst.lift ?? 0;
        p.drag[i] = burst.drag ?? 0;
      }
    }
    for (let i = 0; i < POOL; i++) {
      const o = i * 3;
      if (p.life[i] <= 0) continue;
      p.age[i] += delta;
      if (p.age[i] < 0 || p.age[i] >= p.life[i]) {
        if (p.age[i] >= p.life[i]) p.life[i] = 0;
        p.color[o] = p.color[o + 1] = p.color[o + 2] = 0;
        continue;
      }
      const keep = Math.exp(-p.drag[i] * delta);
      p.velocity[o] *= keep;
      p.velocity[o + 1] = (p.velocity[o + 1] + (p.lift[i] - p.gravity[i]) * delta) * keep;
      p.velocity[o + 2] *= keep;
      p.position[o] += p.velocity[o] * delta;
      p.position[o + 1] += p.velocity[o + 1] * delta;
      p.position[o + 2] += p.velocity[o + 2] * delta;
      // Additive blending: fading the colour to black fades the particle out.
      const fade = (1 - p.age[i] / p.life[i]) ** 1.4;
      p.color[o] = p.base[o] * fade;
      p.color[o + 1] = p.base[o + 1] * fade;
      p.color[o + 2] = p.base[o + 2] * fade;
    }
    const geometry = points.current?.geometry;
    if (geometry) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pool.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[pool.color, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={size}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
