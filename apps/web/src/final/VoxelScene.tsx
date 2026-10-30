import { FrameBudget } from './SceneRuntime.tsx';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export type GameContext = 'voxel' | 'rocket' | 'souls';
export type FeedPhase = 'idle' | 'jump' | 'hold' | 'land' | 'fall';

const X_MIN = -30;
const X_MAX = 36;
const Z_MIN = -60;
const Z_MAX = 34;
const LAVA_Y = 1.5;

// A 5-block jump gap beside the player that widens into a meandering lava ravine.
function gapWidth(z: number) {
  return z > -6 ? 5 : 5 + Math.min(9, Math.round((-6 - z) * 0.45));
}

function gapCenter(z: number) {
  return z > -6 ? 3 : 3 + Math.sin((z + 6) * 0.09) * 4;
}

function gapStart(z: number) {
  return Math.round(gapCenter(z) - gapWidth(z) / 2);
}

function isGap(x: number, z: number) {
  const start = gapStart(z);
  return x >= start && x < start + gapWidth(z);
}

function heightAt(x: number, z: number) {
  if (x >= -4 && x <= 0 && z >= 0 && z <= 6) return 6; // the player's run-up pillar
  if (x >= 6 && x <= 9 && z >= -1 && z <= 6) return 4; // landing ledge
  const rim = gapWidth(z) / 2;
  const distance = Math.abs(x - gapCenter(z));
  const valley = Math.max(0, distance - rim - 6) * 0.42;
  const noise =
    Math.sin(x * 0.23 + 1.3) * 1.2 + Math.cos(z * 0.19) * 1.3 + Math.sin((x - z) * 0.11) * 1.6;
  const far = x >= gapStart(z) + gapWidth(z);
  return Math.max(
    3,
    Math.round(4.4 + noise * (distance < rim + 5 ? 0.5 : 1) + valley - (far ? 0.6 : 0)),
  );
}

function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

function pixelTexture(seed: number, paint: (x: number, y: number, random: number) => string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const context = canvas.getContext('2d');
  const random = seeded(seed);
  if (context) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        context.fillStyle = paint(x, y, random());
        context.fillRect(x, y, 1, 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const pick = (random: number, colors: string[]) =>
  colors[Math.min(colors.length - 1, Math.floor(random * colors.length))];
const DIRT = ['#7d5838', '#6f4c2f', '#86603e', '#6a472b'];
const GRASS = ['#5a9a3c', '#4f8c34', '#68a646', '#548f39'];

type BlockKind = 'grass' | 'dirt' | 'stone' | 'scorched' | 'log' | 'leaf';

function buildWorld() {
  const blocks: Record<BlockKind, Array<[number, number, number]>> = {
    grass: [],
    dirt: [],
    stone: [],
    scorched: [],
    log: [],
    leaf: [],
  };
  const columnTop = (x: number, z: number) =>
    x < X_MIN || x > X_MAX || z < Z_MIN || z > Z_MAX ? 0 : isGap(x, z) ? 0 : heightAt(x, z);
  for (let x = X_MIN; x <= X_MAX; x++) {
    for (let z = Z_MIN; z <= Z_MAX; z++) {
      if (isGap(x, z)) continue;
      const top = heightAt(x, z);
      // Only build each column down to its lowest neighbour: enough to close every visible side face.
      const bottom = Math.min(
        top,
        columnTop(x + 1, z),
        columnTop(x - 1, z),
        columnTop(x, z + 1),
        columnTop(x, z - 1),
      );
      for (let y = Math.max(0, bottom); y <= top; y++) {
        const depth = top - y;
        const kind: BlockKind =
          depth === 0 ? 'grass' : y <= LAVA_Y + 1 ? 'scorched' : depth < 3 ? 'dirt' : 'stone';
        blocks[kind].push([x, y, z]);
      }
    }
  }
  const trees: Array<[number, number]> = [
    [-16, -30],
    [-15, -42],
    [-24, -12],
    [-6, -50],
    [14, -10],
    [17, -22],
    [15, -36],
    [18, -3],
    [23, -30],
    [16, -1],
    [-21, -24],
    [26, -13],
  ];
  trees.forEach(([tx, tz], index) => {
    if (isGap(tx, tz) || isGap(tx + 2, tz) || isGap(tx - 2, tz)) return;
    const ground = heightAt(tx, tz);
    const trunk = 4 + (index % 2);
    for (let y = 1; y <= trunk; y++) blocks.log.push([tx, ground + y, tz]);
    for (let dy = trunk - 1; dy <= trunk + 2; dy++) {
      const radius = dy >= trunk + 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy <= trunk) continue;
          if (
            Math.abs(dx) === radius &&
            Math.abs(dz) === radius &&
            (radius === 2 || dy === trunk + 2)
          )
            continue;
          blocks.leaf.push([tx + dx, ground + dy, tz + dz]);
        }
      }
    }
  });
  return blocks;
}

function BlockLayer({
  positions,
  material,
  seed,
}: {
  positions: Array<[number, number, number]>;
  material: THREE.Material | THREE.Material[];
  seed: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const random = seeded(seed);
    positions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      const shade = 0.86 + random() * 0.14;
      instance.setColorAt(index, color.setRGB(shade, shade, shade));
    });
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
  }, [positions, seed]);
  return (
    <instancedMesh ref={mesh} args={[undefined, material, positions.length]}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function Terrain() {
  const blocks = useMemo(buildWorld, []);
  const materials = useMemo(() => {
    const lambert = (map: THREE.Texture, extra: Record<string, unknown> = {}) =>
      new THREE.MeshLambertMaterial({ map, ...extra });
    const grassTop = lambert(pixelTexture(11, (_x, _y, r) => pick(r, GRASS)));
    const grassSide = lambert(
      pixelTexture(23, (_x, y, r) =>
        y < 3 || (y === 3 && r < 0.5) ? pick(r, GRASS) : pick(r, DIRT),
      ),
    );
    const dirt = lambert(pixelTexture(37, (_x, _y, r) => pick(r, DIRT)));
    const stone = lambert(
      pixelTexture(41, (_x, _y, r) => pick(r, ['#7f8486', '#73787a', '#8b9092', '#686d6f'])),
    );
    const scorched = lambert(
      pixelTexture(53, (_x, _y, r) => pick(r, ['#5c2b23', '#4a221c', '#6b3326', '#3e1d18'])),
    );
    const log = lambert(
      pixelTexture(67, (x, _y, r) =>
        x % 4 === 0 ? '#4f3720' : pick(r, ['#6b4c2c', '#76552f', '#5f4227']),
      ),
    );
    const leaf = lambert(
      pixelTexture(71, (_x, _y, r) => pick(r, ['#4a8a37', '#3f7a2f', '#559a40', '#386d2a'])),
    );
    return {
      grass: [grassSide, grassSide, grassTop, dirt, grassSide, grassSide],
      dirt,
      stone,
      scorched,
      log,
      leaf,
    };
  }, []);
  return (
    <>
      {(Object.keys(blocks) as BlockKind[]).map((kind, index) => (
        <BlockLayer
          key={kind}
          positions={blocks[kind]}
          material={materials[kind]}
          seed={index + 3}
        />
      ))}
    </>
  );
}

function Lava() {
  const width = X_MAX - X_MIN + 1;
  const depth = Z_MAX - Z_MIN + 1;
  const texture = useMemo(() => {
    const map = pixelTexture(89, (x, y, r) => {
      const wave = Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2.2) * 0.5 + 0.5;
      return wave + r * 0.25 > 0.95
        ? '#ffe08a'
        : wave > 0.5
          ? '#ff8a24'
          : r > 0.5
            ? '#f06a1c'
            : '#d9481a';
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(width, depth);
    return map;
  }, [width, depth]);
  useFrame((_, delta) => {
    texture.offset.y += delta * 0.08;
  });
  const lights = useMemo(
    () => [1, -12, -26, -42].map((z) => [gapCenter(z), LAVA_Y + 1.4, z] as const),
    [],
  );
  return (
    <>
      <mesh
        position={[(X_MIN + X_MAX) / 2, LAVA_Y, (Z_MIN + Z_MAX) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {lights.map(([x, y, z]) => (
        <pointLight key={z} position={[x, y, z]} color="#ff6a1f" intensity={36} distance={20} />
      ))}
    </>
  );
}

function Embers() {
  const count = 150;
  const points = useRef<THREE.Points>(null);
  const seeds = useMemo(() => {
    const random = seeded(97);
    return Array.from({ length: count }, () => {
      const z = Math.round(-4 - random() * 46);
      return {
        z,
        x: gapStart(z) + random() * (gapWidth(z) - 1),
        rise: 0.5 + random() * 1.4,
        phase: random() * 10,
        y: random() * 5.5,
      };
    });
  }, []);
  const positions = useMemo(() => new Float32Array(count * 3), []);
  useFrame(({ clock }, delta) => {
    const geometry = points.current?.geometry;
    if (!geometry) return;
    seeds.forEach((ember, index) => {
      ember.y += delta * ember.rise;
      if (ember.y > 5.5) ember.y = 0;
      positions[index * 3] = ember.x + Math.sin(clock.elapsedTime + ember.phase) * 0.25;
      positions[index * 3 + 1] = LAVA_Y + 0.2 + ember.y;
      positions[index * 3 + 2] = ember.z;
    });
    geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ff8f33"
        size={0.09}
        transparent
        opacity={0.95}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function Clouds({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    group.current?.children.forEach((cloud: THREE.Object3D) => {
      cloud.position.x += delta * 0.7;
      if (cloud.position.x > 80) cloud.position.x = -80;
    });
  });
  const clouds: Array<[number, number, number, number]> = [
    [-50, 27, -40, 14],
    [-18, 29, -70, 18],
    [12, 26, -36, 10],
    [36, 28, -62, 16],
    [-36, 30, -100, 22],
    [58, 27, -90, 14],
    [0, 31, -120, 26],
  ];
  return (
    <group ref={group}>
      {clouds.map(([x, y, z, w]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]}>
          <boxGeometry args={[w, 1.4, w * 0.6]} />
          <meshBasicMaterial color={color} transparent opacity={0.88} />
        </mesh>
      ))}
    </group>
  );
}

function Sun({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    group.current?.lookAt(-1, 8, 3);
  }, []);
  return (
    <group ref={group} position={[-45, 30, -100]}>
      <mesh>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial color={color} toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[22, 22]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          toneMapped={false}
          fog={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

const START = new THREE.Vector3(-0.3, 6.5 + 1.62, 3);
const LANDING = new THREE.Vector3(7.4, 4.5 + 1.62, 3);
const DIR_CANYON = new THREE.Vector3(5, -6.2, -26).normalize();
const DIR_ACROSS = new THREE.Vector3(12, -3.4, -3).normalize();
const DIR_DOWN = new THREE.Vector3(1, -2.2, -1.4).normalize();

function jumpPoint(u: number, target: THREE.Vector3) {
  return target.set(
    THREE.MathUtils.lerp(START.x, LANDING.x, u),
    THREE.MathUtils.lerp(START.y, LANDING.y, u) + 4 * 1.9 * u * (1 - u),
    START.z,
  );
}

function PlayerCamera({ phase }: { phase: FeedPhase }) {
  const { camera } = useThree();
  const clock = useRef({ phase, start: 0 });
  const position = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (clock.current.phase !== phase) clock.current = { phase, start: t };
    const local = t - clock.current.start;
    const smooth = THREE.MathUtils.smoothstep;
    if (phase === 'idle') {
      position
        .copy(START)
        .add(new THREE.Vector3(Math.sin(t * 0.6) * 0.04, Math.sin(t * 2.1) * 0.035, 0));
      direction.copy(DIR_CANYON);
    } else if (phase === 'jump') {
      const p = Math.min(1, local / 1.6);
      jumpPoint(0.5 * smooth(p, 0.2, 1), position);
      direction
        .copy(DIR_CANYON)
        .lerp(DIR_ACROSS, smooth(p, 0, 0.45))
        .normalize();
    } else if (phase === 'hold') {
      // Freeze-frame at the apex while the streamer attests the real outcome.
      jumpPoint(0.5, position).y += Math.sin(t * 1.4) * 0.04;
      direction.copy(DIR_ACROSS);
    } else if (phase === 'land') {
      const q = Math.min(1, local / 0.7);
      jumpPoint(0.5 + 0.5 * q * q, position);
      if (q === 1) position.y += Math.sin(t * 2.1) * 0.035;
      direction.copy(DIR_ACROSS);
    } else {
      const q = Math.min(1, local / 1.1);
      jumpPoint(0.5, position);
      position.y = THREE.MathUtils.lerp(position.y, LAVA_Y + 1.35, q * q);
      direction
        .copy(DIR_ACROSS)
        .lerp(DIR_DOWN, smooth(q, 0, 0.6))
        .normalize();
    }
    camera.position.copy(position);
    camera.lookAt(position.x + direction.x, position.y + direction.y, position.z + direction.z);
  });
  return null;
}

const palettes: Record<
  GameContext,
  { sky: string; fog: string; cloud: string; sun: string; hemi: number; sunLight: number }
> = {
  voxel: {
    sky: '#86b9e6',
    fog: '#a9cdea',
    cloud: '#ffffff',
    sun: '#fff4c4',
    hemi: 1.25,
    sunLight: 1.6,
  },
  rocket: {
    sky: '#e0926a',
    fog: '#e8ab86',
    cloud: '#ffe1cc',
    sun: '#ffd27a',
    hemi: 1.05,
    sunLight: 1.3,
  },
  souls: {
    sky: '#1c2630',
    fog: '#25313b',
    cloud: '#56636e',
    sun: '#dfe8f0',
    hemi: 0.42,
    sunLight: 0.35,
  },
};

export function VoxelScene({
  phase,
  context,
  reducedMotion = false,
}: {
  phase: FeedPhase;
  context: GameContext;
  reducedMotion?: boolean;
}) {
  const palette = palettes[context];
  return (
    <Canvas
      className="voxel-canvas"
      frameloop="never"
      dpr={[1, 1.5]}
      camera={{ fov: 72, near: 0.1, far: 220, position: START.toArray() }}
      gl={{ antialias: true }}
    >
      <FrameBudget reducedMotion={reducedMotion} />
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, 20, 74]} />
      <hemisphereLight args={['#d6ebff', '#5a4632', palette.hemi]} />
      <directionalLight position={[-40, 60, 50]} intensity={palette.sunLight} color="#fff1d6" />
      <Sun color={palette.sun} />
      <Clouds color={palette.cloud} />
      <Terrain />
      <Lava />
      <Embers />
      <PlayerCamera phase={phase} />
    </Canvas>
  );
}
