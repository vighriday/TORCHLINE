import { FrameBudget } from './SceneRuntime.tsx';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  type BurstEvent,
  Bursts,
  canvasTexture,
  damp,
  easeIn,
  easeInOut,
  easeOut,
  type FeedPhase,
  glowTexture,
  GradientSky,
  progress,
  seeded,
  usePhaseTimer,
} from './feedKit.tsx';

const lerp = THREE.MathUtils.lerp;
const BOSS_Z = -14;
const BOSS_SCALE = 1.15;
const HIP = 2.6;

// Boss rig poses in radians: shoulder swing, wrist cock, and torso lean.
const REST = { arm: -0.25, wrist: -0.83, lean: 0 };
const RAISED = { arm: -3.3, wrist: -0.6, lean: -0.14 };
const SLAM = { arm: -1.2, wrist: 0.14, lean: 0.2 };
const SLUMP = { arm: -0.55, wrist: -0.75, lean: 0.32 };

// Knight path: close the distance, leap into a plunging attack, then land the blow or get swatted back.
const PLAYER_START = new THREE.Vector3(0.6, 0, 2);
const PLAYER_RUN_END = new THREE.Vector3(1.5, 0, -6.4);
const PLAYER_LEAP = new THREE.Vector3(1.6, 1.35, -8.4);
const PLAYER_STRIKE = new THREE.Vector3(1, 0, -11.4);
const PLAYER_FALLEN = new THREE.Vector3(0.9, 0.14, -5.4);
const SWORD_REST = 0.15;
const SWORD_RUN = -0.3;
const SWORD_RAISED = 3.39;
const SWORD_LOW = -0.4;
const CAMERA_OFFSET = new THREE.Vector3(0.9, 2.2, 5);

const UP = new THREE.Vector3(0, 1, 0);
const BOSS_CHEST = new THREE.Vector3(0, 4.6 * BOSS_SCALE, BOSS_Z);
const BOSS_KNEELING = new THREE.Vector3(0, 3.4, BOSS_Z);
const HIT_POINT = new THREE.Vector3(1.05, 1.4, BOSS_Z + 1.4);
const IMPACT_POINT = new THREE.Vector3(1.75 * BOSS_SCALE, 0.2, -6.3);
const BRAZIERS: Array<[number, number]> = [
  [-6.5, -3],
  [6.5, -3],
  [-7, -21],
  [7, -21],
];
const COLUMNS_Z = [6, -2, -10, -18, -26];
const EMBER_SOURCES: Array<[number, number, number]> = [
  ...BRAZIERS.map(([x, z]): [number, number, number] => [x, 1.6, z]),
  [0, 0.4, BOSS_Z],
];

/** Staggered, irregular flagstones that tile seamlessly. */
function flagstoneTexture() {
  const size = 512;
  const rows = 8;
  const rowHeight = size / rows;
  const wrap = [-size, 0, size];
  const texture = canvasTexture(size, size, (context) => {
    context.fillStyle = '#16140f';
    context.fillRect(0, 0, size, size);
    const random = seeded(19);
    for (let row = 0; row < rows; row++) {
      let x = -random() * 80;
      while (x < size) {
        const width = 48 + random() * 72;
        const shade = 46 + random() * 26;
        const warmth = random() * 6;
        context.fillStyle = `rgb(${shade + warmth}, ${shade + warmth * 0.6}, ${shade - 3})`;
        for (const dx of wrap)
          context.fillRect(x + dx + 2, row * rowHeight + 2, width - 4, rowHeight - 4);
        for (let n = 0; n < 5; n++) {
          context.fillStyle = `rgba(0, 0, 0, ${0.04 + random() * 0.08})`;
          const spotX = x + random() * width;
          const spotY = row * rowHeight + random() * rowHeight;
          const radius = 3 + random() * 10;
          for (const dx of wrap) {
            for (const dy of wrap) {
              context.beginPath();
              context.arc(spotX + dx, spotY + dy, radius, 0, Math.PI * 2);
              context.fill();
            }
          }
        }
        x += width;
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function mistTexture() {
  const size = 256;
  const wrap = [-size, 0, size];
  const texture = canvasTexture(size, size, (context) => {
    const random = seeded(23);
    for (let i = 0; i < 60; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = 24 + random() * 56;
      for (const dx of wrap) {
        for (const dy of wrap) {
          const gradient = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
          gradient.addColorStop(0, 'rgba(255,255,255,.22)');
          gradient.addColorStop(1, 'rgba(255,255,255,0)');
          context.fillStyle = gradient;
          context.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
        }
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  return texture;
}

function lockOnTexture() {
  return canvasTexture(64, 64, (context) => {
    context.shadowColor = 'rgba(255,255,255,.9)';
    context.shadowBlur = 8;
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(32, 32, 6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,.6)';
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(32, 32, 15, 0, Math.PI * 2);
    context.stroke();
  });
}

/** Gothic lancet window outline: straight jambs rising into a pointed arch. */
function lancet(width: number, height: number) {
  const half = width / 2;
  const spring = height - width * 0.95;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(-half, spring);
  shape.quadraticCurveTo(-half, spring + width * 0.62, 0, height);
  shape.quadraticCurveTo(half, spring + width * 0.62, half, spring);
  shape.lineTo(half, 0);
  shape.closePath();
  return shape;
}

/** Cloth panel hanging down from its top edge, with a ragged hem. */
function tatteredCloth(width: number, height: number, teeth: number, seed: number) {
  const random = seeded(seed);
  const half = width / 2;
  const hem = width * 1.12;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(hem / 2, -height * 0.84);
  for (let i = 1; i <= teeth; i++) {
    const x = hem / 2 - (hem * i) / teeth;
    shape.lineTo(x + hem / teeth / 2, -height * (0.94 + random() * 0.12));
    shape.lineTo(x, -height * (0.8 + random() * 0.1));
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function Courtyard() {
  const gl = useThree((state) => state.gl);
  const flagstones = useMemo(() => {
    const texture = flagstoneTexture();
    texture.repeat.set(10, 13);
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    return texture;
  }, [gl]);
  const stone = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5d5951', roughness: 0.95 }),
    [],
  );
  const glow = useMemo(() => glowTexture(), []);
  const windows = useMemo(
    () => ({
      great: new THREE.ShapeGeometry(lancet(6, 13)),
      side: new THREE.ShapeGeometry(lancet(2.6, 7)),
      tower: new THREE.ShapeGeometry(lancet(1.4, 4)),
    }),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
        <planeGeometry args={[64, 84]} />
        <meshStandardMaterial
          map={flagstones}
          bumpMap={flagstones}
          bumpScale={1.5}
          color="#a39d92"
          roughness={0.92}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 11, 0, 0]}>
          {COLUMNS_Z.map((z) => (
            <group key={z} position={[0, 0, z]}>
              <mesh material={stone} position={[0, 0.35, 0]}>
                <boxGeometry args={[2.2, 0.7, 2.2]} />
              </mesh>
              <mesh material={stone} position={[0, 4.75, 0]}>
                <cylinderGeometry args={[0.72, 0.82, 8.1, 14]} />
              </mesh>
              <mesh material={stone} position={[0, 9.05, 0]}>
                <boxGeometry args={[2, 0.6, 2]} />
              </mesh>
            </group>
          ))}
          {/* Each pointed arch is two arcs centred on the opposite springing points. */}
          {COLUMNS_Z.slice(1).map((z) => (
            <group key={z} position={[0, 9.35, z + 4]} rotation={[0, Math.PI / 2, 0]}>
              <mesh material={stone} position={[-4, 0, 0]}>
                <torusGeometry args={[8, 0.42, 6, 14, Math.PI / 3]} />
              </mesh>
              <mesh material={stone} position={[4, 0, 0]} rotation={[0, 0, (2 * Math.PI) / 3]}>
                <torusGeometry args={[8, 0.42, 6, 14, Math.PI / 3]} />
              </mesh>
            </group>
          ))}
          <mesh material={stone} position={[0, 16.9, -10]}>
            <boxGeometry args={[1.4, 1.1, 34]} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0, -34]}>
        <mesh material={stone} position={[0, 10, -1]}>
          <boxGeometry args={[34, 20, 2]} />
        </mesh>
        <mesh geometry={windows.great} position={[0, 4.6, 0.02]}>
          <meshBasicMaterial color="#6d84ab" fog={false} toneMapped={false} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} material={stone} position={[x, 10.4, 0.1]}>
            <boxGeometry args={[0.22, 11.6, 0.2]} />
          </mesh>
        ))}
        <mesh material={stone} position={[0, 10.2, 0.1]}>
          <boxGeometry args={[6, 0.22, 0.2]} />
        </mesh>
        <mesh material={stone} position={[0, 14.6, 0.12]}>
          <torusGeometry args={[1.2, 0.12, 6, 24]} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={windows.side} position={[x * 9, 6, 0.02]}>
            <meshBasicMaterial color="#4c5e80" fog={false} toneMapped={false} />
          </mesh>
        ))}
        <sprite position={[0, 11, 1.5]} scale={[24, 24, 1]}>
          <spriteMaterial
            map={glow}
            color="#7d9cd6"
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </sprite>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} material={stone} position={[-13.75 + i * 2.5, 20.6, -1]}>
            <boxGeometry args={[1.3, 1.2, 2]} />
          </mesh>
        ))}
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 16.5, 0, -1]}>
            <mesh material={stone} position={[0, 13, 0]}>
              <boxGeometry args={[5, 26, 5]} />
            </mesh>
            <mesh material={stone} position={[0, 29.5, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[3.9, 7, 4]} />
            </mesh>
            <mesh geometry={windows.tower} position={[0, 17, 2.52]}>
              <meshBasicMaterial color="#3b4a66" fog={false} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh material={stone} position={[-7.6, 0.72, 4.2]} rotation={[0, 0.5, Math.PI / 2]}>
        <cylinderGeometry args={[0.72, 0.72, 2.6, 14]} />
      </mesh>
      <mesh material={stone} position={[-5.8, 0.6, 6.4]} rotation={[0, -0.3, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.64, 1.4, 14]} />
      </mesh>
      <mesh material={stone} position={[8.4, 0.45, -9.5]} rotation={[0, 0.4, 0.12]}>
        <boxGeometry args={[1.6, 0.9, 1.2]} />
      </mesh>
      <mesh material={stone} position={[-8.6, 0.35, -16]} rotation={[0, -0.6, 0]}>
        <boxGeometry args={[1.2, 0.7, 1]} />
      </mesh>
    </group>
  );
}

function Eclipse() {
  const corona = useMemo(
    () =>
      glowTexture([
        [0, 'rgba(255,255,255,0)'],
        [0.25, 'rgba(255,255,255,0)'],
        [0.3, 'rgba(255,244,214,1)'],
        [0.42, 'rgba(255,210,150,.35)'],
        [1, 'rgba(255,190,120,0)'],
      ]),
    [],
  );
  const disc = useMemo(
    () =>
      glowTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.96, 'rgba(255,255,255,1)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    [],
  );
  return (
    <group position={[-9, 52, -95]}>
      <sprite scale={[30, 30, 1]}>
        <spriteMaterial
          map={corona}
          color="#ffe2b0"
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </sprite>
      <sprite position={[0, 0, 1]} scale={[8.8, 8.8, 1]}>
        <spriteMaterial map={disc} color="#000000" transparent depthWrite={false} fog={false} />
      </sprite>
    </group>
  );
}

function Brazier({ position, seed }: { position: [number, number, number]; seed: number }) {
  const light = useRef<THREE.PointLight>(null);
  const flames = useRef<THREE.Group>(null);
  const flame = useMemo(
    () =>
      glowTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.25, 'rgba(255,255,255,.75)'],
        [0.6, 'rgba(255,255,255,.18)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    [],
  );
  const halo = useMemo(() => glowTexture(), []);
  const iron = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a2622',
        metalness: 0.6,
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useFrame(({ clock }) => {
    const e = clock.elapsedTime + seed;
    const flicker =
      0.86 + Math.sin(e * 13.1) * 0.06 + Math.sin(e * 23.7) * 0.05 + Math.sin(e * 7.3) * 0.04;
    if (light.current) light.current.intensity = 34 * flicker;
    flames.current?.children.forEach((sprite: THREE.Object3D, i: number) => {
      const height = (1.5 - i * 0.32) * (flicker + Math.sin(e * 9 + i * 1.7) * 0.08);
      sprite.scale.set(0.95 - i * 0.18, height, 1);
      sprite.position.set(Math.sin(e * 4.6 + i * 2.1) * 0.05, height / 2, 0);
    });
  });
  return (
    <group position={position}>
      <mesh material={iron} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.1, 0.2, 1.1, 8]} />
      </mesh>
      <mesh material={iron} position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.62, 0.32, 0.4, 10, 1, true]} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 10]} />
        <meshBasicMaterial color="#ff5a1a" toneMapped={false} />
      </mesh>
      <group ref={flames} position={[0, 1.3, 0]}>
        {['#ffd7a0', '#ff9a3c', '#ff5a1a'].map((color) => (
          <sprite key={color}>
            <spriteMaterial
              map={flame}
              color={color}
              transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        ))}
      </group>
      <sprite position={[0, 1.9, 0]} scale={[4.5, 4.5, 1]}>
        <spriteMaterial
          map={halo}
          color="#ff7a2a"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <pointLight ref={light} position={[0, 2.1, 0]} color="#ff8a3a" distance={20} decay={1.6} />
    </group>
  );
}

function GroundMist() {
  const texture = useMemo(mistTexture, []);
  const layers = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    layers.current?.children.forEach((layer: THREE.Object3D, i: number) => {
      layer.position.x = Math.sin(clock.elapsedTime * 0.05 + i * 2) * 5;
      layer.position.z = -10 + Math.cos(clock.elapsedTime * 0.04 + i) * 3;
    });
  });
  return (
    <group ref={layers}>
      {[
        [0.35, 0.3],
        [0.85, 0.22],
        [1.5, 0.14],
      ].map(([y, opacity], i) => (
        <mesh key={i} position={[0, y, -10]} rotation={[-Math.PI / 2, 0, i * 1.3]}>
          <planeGeometry args={[70, 80]} />
          <meshBasicMaterial
            map={texture}
            color="#9aa7ba"
            transparent
            opacity={opacity}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Falling ash across the courtyard and embers rising off the braziers and the boss. */
function Ashfall() {
  const ash = useRef<THREE.Points>(null);
  const embers = useRef<THREE.Points>(null);
  const sprite = useMemo(() => glowTexture(), []);
  const field = useMemo(() => {
    const random = seeded(61);
    const flakes = Array.from({ length: 420 }, () => ({
      x: -22 + random() * 44,
      y: random() * 18,
      z: -34 + random() * 44,
      fall: 0.25 + random() * 0.45,
      sway: random() * 6,
    }));
    const sparks = Array.from({ length: 150 }, (_, i) => {
      const source = i % EMBER_SOURCES.length;
      const [x, y, z] = EMBER_SOURCES[source];
      const spread = source === EMBER_SOURCES.length - 1 ? 3.4 : 0.5;
      return {
        x: x + (random() - 0.5) * spread,
        base: y,
        y: random() * 7,
        z: z + (random() - 0.5) * spread,
        rise: 0.5 + random() * 1.1,
        sway: random() * 6,
      };
    });
    return {
      flakes,
      sparks,
      ashPositions: new Float32Array(flakes.length * 3),
      emberPositions: new Float32Array(sparks.length * 3),
    };
  }, []);
  useFrame(({ clock }, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    const e = clock.elapsedTime;
    field.flakes.forEach((flake, i) => {
      flake.y -= flake.fall * delta;
      if (flake.y < 0) flake.y += 18;
      field.ashPositions[i * 3] = flake.x + Math.sin(e * 0.4 + flake.sway) * 0.8;
      field.ashPositions[i * 3 + 1] = flake.y;
      field.ashPositions[i * 3 + 2] = flake.z + Math.cos(e * 0.3 + flake.sway) * 0.5;
    });
    field.sparks.forEach((spark, i) => {
      spark.y += spark.rise * delta;
      if (spark.y > 7) spark.y = 0;
      field.emberPositions[i * 3] =
        spark.x + Math.sin(e * 1.3 + spark.sway) * 0.25 * (1 + spark.y * 0.2);
      field.emberPositions[i * 3 + 1] = spark.base + spark.y;
      field.emberPositions[i * 3 + 2] = spark.z + Math.cos(e * 1.1 + spark.sway) * 0.2;
    });
    if (ash.current) ash.current.geometry.attributes.position.needsUpdate = true;
    if (embers.current) embers.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <>
      <points ref={ash} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[field.ashPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sprite}
          color="#bdb6aa"
          size={0.09}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </points>
      <points ref={embers} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[field.emberPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sprite}
          color="#ff8a3a"
          size={0.13}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </>
  );
}

/** Player knight, modelled facing -Z with the sword arm pivoting at the right shoulder. */
function Knight({ ref, arm }: { ref: React.Ref<THREE.Group>; arm: React.Ref<THREE.Group> }) {
  const m = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#80858c', metalness: 0.7, roughness: 0.38 }),
      mail: new THREE.MeshStandardMaterial({ color: '#4d5055', metalness: 0.55, roughness: 0.6 }),
      leather: new THREE.MeshStandardMaterial({ color: '#2c2521', roughness: 0.9 }),
      cloth: new THREE.MeshStandardMaterial({
        color: '#5c2219',
        roughness: 1,
        side: THREE.DoubleSide,
      }),
      wood: new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.85 }),
      blade: new THREE.MeshStandardMaterial({ color: '#d9dee4', metalness: 0.85, roughness: 0.22 }),
    }),
    [],
  );
  const cape = useMemo(() => tatteredCloth(0.62, 1.1, 7, 91), []);
  return (
    <group ref={ref}>
      {[-1, 1].map((x) => (
        <mesh key={x} material={m.leather} position={[x * 0.13, 0.42, 0]}>
          <boxGeometry args={[0.19, 0.84, 0.22]} />
        </mesh>
      ))}
      <mesh material={m.mail} position={[0, 1.15, 0]}>
        <boxGeometry args={[0.54, 0.62, 0.3]} />
      </mesh>
      <mesh material={m.leather} position={[0, 0.86, 0]}>
        <boxGeometry args={[0.58, 0.1, 0.33]} />
      </mesh>
      <mesh material={m.steel} position={[0, 1.65, 0]}>
        <cylinderGeometry args={[0.15, 0.16, 0.3, 10]} />
      </mesh>
      <mesh material={m.steel} position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} material={m.steel} position={[x * 0.32, 1.4, 0]}>
          <sphereGeometry args={[0.14, 10, 8]} />
        </mesh>
      ))}
      <mesh
        geometry={cape}
        material={m.cloth}
        position={[0, 1.44, 0.17]}
        rotation={[-0.12, 0, 0]}
      />
      <group position={[-0.36, 1.1, -0.14]} rotation={[0, 0.45, 0]}>
        <mesh material={m.wood}>
          <boxGeometry args={[0.5, 0.64, 0.06]} />
        </mesh>
        <mesh material={m.steel} position={[0, 0, -0.035]}>
          <boxGeometry args={[0.1, 0.5, 0.02]} />
        </mesh>
      </group>
      <group ref={arm} position={[0.32, 1.38, 0]}>
        <mesh material={m.mail} position={[0, -0.28, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.56, 8]} />
        </mesh>
        <group position={[0, -0.56, 0]} rotation={[1.2, 0, 0]}>
          <mesh material={m.leather} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.18, 6]} />
          </mesh>
          <mesh material={m.steel} position={[0, -0.04, 0]}>
            <boxGeometry args={[0.26, 0.04, 0.05]} />
          </mesh>
          <mesh material={m.blade} position={[0, -0.52, 0]}>
            <boxGeometry args={[0.06, 0.92, 0.018]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function createBossMaterials() {
  return {
    armor: new THREE.MeshStandardMaterial({ color: '#4a4d54', metalness: 0.6, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: '#24262b', metalness: 0.5, roughness: 0.55 }),
    cloth: new THREE.MeshStandardMaterial({
      color: '#3a1a16',
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    trim: new THREE.MeshStandardMaterial({ color: '#8c6b38', metalness: 0.85, roughness: 0.4 }),
    blade: new THREE.MeshStandardMaterial({ color: '#7d848d', metalness: 0.85, roughness: 0.3 }),
    ember: new THREE.MeshBasicMaterial({ color: '#ff6a24', toneMapped: false }),
  };
}

type BossMaterials = ReturnType<typeof createBossMaterials>;
type BossRig = {
  root: React.RefObject<THREE.Group | null>;
  legs: React.RefObject<THREE.Group | null>;
  upper: React.RefObject<THREE.Group | null>;
  arm: React.RefObject<THREE.Group | null>;
  wrist: React.RefObject<THREE.Group | null>;
  leftArm: React.RefObject<THREE.Group | null>;
  cape: React.RefObject<THREE.Mesh | null>;
  eyes: React.RefObject<THREE.Group | null>;
};

/** Horned greatsword knight. Faces +Z; the upper body pivots at the hip, the sword arm at the shoulder. */
function Boss({ rig, materials: m }: { rig: BossRig; materials: BossMaterials }) {
  const cape = useMemo(() => tatteredCloth(3.2, 4.6, 11, 77), []);
  const glow = useMemo(() => glowTexture(), []);
  return (
    <group ref={rig.root} position={[0, 0, BOSS_Z]} scale={BOSS_SCALE}>
      <group ref={rig.legs}>
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 0.78, 0, 0]}>
            <mesh material={m.dark} position={[0, 0.24, 0.22]}>
              <boxGeometry args={[0.86, 0.48, 1.4]} />
            </mesh>
            <mesh material={m.armor} position={[0, 1.3, 0]}>
              <cylinderGeometry args={[0.42, 0.34, 1.9, 8]} />
            </mesh>
            <mesh material={m.armor} position={[0, 2.18, 0.14]}>
              <sphereGeometry args={[0.4, 10, 8]} />
            </mesh>
            <mesh material={m.dark} position={[0, 2.62, 0]}>
              <cylinderGeometry args={[0.5, 0.44, 0.9, 8]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={rig.upper} position={[0, HIP, 0]}>
        <mesh material={m.cloth} position={[0, -0.05, 0]}>
          <cylinderGeometry args={[1.05, 1.6, 1.9, 12, 1, true]} />
        </mesh>
        <mesh material={m.trim} position={[0, 0.86, 0]}>
          <cylinderGeometry args={[1.08, 1.1, 0.28, 12]} />
        </mesh>
        <mesh material={m.armor} position={[0, 1.78, 0]}>
          <cylinderGeometry args={[1.45, 1.04, 1.9, 7]} />
        </mesh>
        <mesh material={m.dark} position={[0, 1.95, 0.98]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.22, 1.3, 0.2]} />
        </mesh>
        <mesh material={m.dark} position={[0, 2.86, 0]}>
          <cylinderGeometry args={[0.56, 0.78, 0.42, 8]} />
        </mesh>
        <group position={[0, 3.38, 0.06]}>
          <mesh material={m.armor}>
            <cylinderGeometry args={[0.5, 0.56, 0.96, 8]} />
          </mesh>
          <mesh material={m.armor} position={[0, 0.48, 0]}>
            <sphereGeometry args={[0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.06, 0.5]}>
            <boxGeometry args={[0.72, 0.1, 0.1]} />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh
              key={x}
              material={m.dark}
              position={[x * 0.52, 0.62, -0.04]}
              rotation={[-0.35, 0, -x * 0.95]}
            >
              <coneGeometry args={[0.13, 1.5, 6]} />
            </mesh>
          ))}
          <group ref={rig.eyes}>
            {[-1, 1].map((x) => (
              <mesh key={x} material={m.ember} position={[x * 0.17, 0.07, 0.55]}>
                <sphereGeometry args={[0.065, 8, 6]} />
              </mesh>
            ))}
            <sprite position={[0, 0.07, 0.62]} scale={[1.4, 0.7, 1]}>
              <spriteMaterial
                map={glow}
                color="#ff5a1f"
                transparent
                opacity={0.85}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
            <pointLight position={[0, 0.1, 0.9]} color="#ff4a18" intensity={6} distance={6} />
          </group>
        </group>
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 1.62, 2.42, 0]}>
            <mesh material={m.armor} scale={[1, 0.72, 1.08]}>
              <sphereGeometry args={[0.84, 12, 8]} />
            </mesh>
            <mesh material={m.dark} position={[x * 0.22, 0.56, 0]} rotation={[0, 0, -x * 0.35]}>
              <coneGeometry args={[0.14, 0.85, 5]} />
            </mesh>
            <mesh material={m.dark} position={[x * 0.55, 0.36, -0.14]} rotation={[0, 0, -x * 0.95]}>
              <coneGeometry args={[0.12, 0.62, 5]} />
            </mesh>
          </group>
        ))}
        <mesh ref={rig.cape} geometry={cape} material={m.cloth} position={[0, 2.55, -0.82]} />
        <group ref={rig.leftArm} position={[-1.75, 2.4, 0]}>
          <mesh material={m.armor} position={[0, -0.8, 0]}>
            <cylinderGeometry args={[0.36, 0.32, 1.6, 8]} />
          </mesh>
          <mesh material={m.dark} position={[0, -1.75, 0.05]}>
            <cylinderGeometry args={[0.32, 0.3, 1, 8]} />
          </mesh>
          <mesh material={m.dark} position={[0, -2.4, 0.1]}>
            <boxGeometry args={[0.5, 0.52, 0.56]} />
          </mesh>
        </group>
        <group ref={rig.arm} position={[1.75, 2.4, 0]}>
          <mesh material={m.armor} position={[0, -0.8, 0]}>
            <cylinderGeometry args={[0.36, 0.32, 1.6, 8]} />
          </mesh>
          <mesh material={m.dark} position={[0, -1.75, 0]}>
            <cylinderGeometry args={[0.32, 0.3, 1, 8]} />
          </mesh>
          <group ref={rig.wrist} position={[0, -2.5, 0]}>
            <mesh material={m.dark}>
              <boxGeometry args={[0.5, 0.52, 0.56]} />
            </mesh>
            <mesh material={m.trim} position={[0, 0.32, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.5, 6]} />
            </mesh>
            <mesh material={m.trim} position={[0, 0.62, 0]}>
              <sphereGeometry args={[0.13, 8, 6]} />
            </mesh>
            <mesh material={m.trim} position={[0, -0.36, 0]}>
              <boxGeometry args={[1.4, 0.17, 0.3]} />
            </mesh>
            <mesh material={m.blade} position={[0, -3.1, 0]}>
              <boxGeometry args={[0.52, 5.3, 0.1]} />
            </mesh>
            {[-1, 1].map((z) => (
              <mesh key={z} material={m.ember} position={[0, -3, z * 0.056]}>
                <boxGeometry args={[0.07, 4.8, 0.01]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/** Drives the knight, the boss rig, hit effects, and the lock-on camera for each feed phase. */
function Duel({ phase, bursts }: { phase: FeedPhase; bursts: { current: BurstEvent[] } }) {
  const camera = useThree((state) => state.camera);
  const knight = useRef<THREE.Group>(null);
  const knightArm = useRef<THREE.Group>(null);
  const reticle = useRef<THREE.Sprite>(null);
  const flash = useRef<THREE.PointLight>(null);
  const rig: BossRig = {
    root: useRef<THREE.Group>(null),
    legs: useRef<THREE.Group>(null),
    upper: useRef<THREE.Group>(null),
    arm: useRef<THREE.Group>(null),
    wrist: useRef<THREE.Group>(null),
    leftArm: useRef<THREE.Group>(null),
    cape: useRef<THREE.Mesh>(null),
    eyes: useRef<THREE.Group>(null),
  };
  const materials = useMemo(createBossMaterials, []);
  const reticleTexture = useMemo(lockOnTexture, []);
  const timer = usePhaseTimer(phase);
  const s = useMemo(
    () => ({
      knight: new THREE.Vector3(),
      head: new THREE.Vector3(),
      eye: new THREE.Vector3(),
      look: new THREE.Vector3(),
      eyeTarget: new THREE.Vector3(),
      lookTarget: new THREE.Vector3(),
      shake: new THREE.Vector3(),
      fired: 0,
      ready: false,
      flashAt: -10,
      flashPower: 0,
      flashLength: 1,
    }),
    [],
  );

  const fireFlash = (
    position: THREE.Vector3,
    elapsed: number,
    power: number,
    length: number,
    color: string,
  ) => {
    s.flashAt = elapsed;
    s.flashPower = power;
    s.flashLength = length;
    flash.current?.position.copy(position);
    flash.current?.color.set(color);
  };

  useFrame((state, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    const e = state.clock.elapsedTime;
    const { time: t, changed } = timer(e);
    const snap = !s.ready || (changed && phase === 'idle');
    if (changed) s.fired = 0;
    s.ready = true;

    let sword = SWORD_REST;
    let lean = Math.sin(e * 1.7) * 0.015;
    let fall = 0;
    let bossArm = REST.arm + Math.sin(e * 0.8) * 0.03;
    let bossWrist = REST.wrist;
    let bossLean = REST.lean;
    let kneel = 0;
    let fade = 1;
    let glow = 1;
    let shake = 0;
    let roll = 0;
    s.knight.copy(PLAYER_START);

    if (phase === 'attempt') {
      if (t < 1.3) {
        const run = t / 1.3;
        s.knight.lerpVectors(PLAYER_START, PLAYER_RUN_END, run * (0.35 + 0.65 * run));
        s.knight.y = Math.abs(Math.sin(t * 13)) * 0.09;
        sword = SWORD_RUN;
        lean = 0.22;
      } else {
        const leap = easeOut(progress(t, 1.3, 0.5));
        s.knight.lerpVectors(PLAYER_RUN_END, PLAYER_LEAP, leap);
        sword = lerp(SWORD_RUN, SWORD_RAISED, leap);
        lean = lerp(0.22, -0.1, leap);
      }
      const raise = easeInOut(progress(t, 0.15, 1.45));
      bossArm = lerp(REST.arm, RAISED.arm, raise);
      bossWrist = lerp(REST.wrist, RAISED.wrist, raise);
      bossLean = lerp(REST.lean, RAISED.lean, raise);
    } else if (phase === 'hold') {
      s.knight.copy(PLAYER_LEAP);
      s.knight.y += Math.sin(e * 1.4) * 0.04;
      sword = SWORD_RAISED;
      lean = -0.1;
      bossArm = RAISED.arm + Math.sin(e * 9) * 0.012;
      bossWrist = RAISED.wrist;
      bossLean = RAISED.lean;
    } else if (phase === 'win') {
      // The plunging strike lands first; the boss staggers, kneels on its sword, and dissolves.
      const dive = progress(t, 0, 0.35);
      s.knight.lerpVectors(PLAYER_LEAP, PLAYER_STRIKE, easeIn(dive));
      s.knight.y = PLAYER_LEAP.y * (1 - dive * dive);
      sword = lerp(SWORD_RAISED, SWORD_LOW, easeIn(progress(t, 0.04, 0.26)));
      lean = lerp(-0.1, 0.32, dive) * (1 - progress(t, 0.7, 0.8));
      const stagger = easeOut(progress(t, 0.3, 0.7));
      bossArm = lerp(RAISED.arm, SLUMP.arm, stagger);
      bossWrist = lerp(RAISED.wrist, SLUMP.wrist, stagger);
      bossLean = lerp(RAISED.lean, SLUMP.lean, stagger);
      kneel = easeInOut(progress(t, 0.7, 1));
      glow = 1 - progress(t, 0.6, 0.8);
      fade = 1 - easeIn(progress(t, 1.7, 1.8));
      shake = t > 0.3 ? Math.exp(-(t - 0.3) * 9) * 0.06 : 0;
      if (t > 0.3 && !(s.fired & 1)) {
        s.fired |= 1;
        bursts.current.push(
          {
            origin: HIT_POINT.clone(),
            count: 70,
            color: '#ffc477',
            speed: [3, 10],
            life: [0.25, 0.7],
            gravity: 10,
            drag: 1.2,
          },
          {
            origin: HIT_POINT.clone(),
            count: 30,
            color: '#ff6a2a',
            speed: [1, 4],
            life: [0.4, 0.9],
            gravity: 2,
            drag: 2,
          },
        );
        fireFlash(HIT_POINT, e, 60, 0.5, '#ffb36a');
      }
      if (t > 1.5 && !(s.fired & 2)) {
        s.fired |= 2;
        const origin = new THREE.Vector3(0, 3.6, BOSS_Z);
        const box = new THREE.Vector3(1.8, 3.2, 0.9);
        bursts.current.push(
          {
            origin,
            box,
            count: 420,
            color: '#ffd28a',
            speed: [0.5, 2.2],
            direction: UP,
            spread: 0.9,
            lift: 1.1,
            drag: 0.5,
            life: [1.3, 2.8],
            delay: 1.8,
          },
          {
            origin,
            box,
            count: 160,
            color: '#ff7a36',
            speed: [0.4, 1.6],
            direction: UP,
            spread: 0.7,
            lift: 0.8,
            drag: 0.6,
            life: [1, 2.2],
            delay: 1.6,
          },
        );
        fireFlash(origin, e, 90, 3.4, '#ffcf8a');
      }
    } else if (phase === 'loss') {
      // The greatsword lands before the leap does; the knight is thrown back and the view sinks.
      const slam = easeIn(progress(t, 0, 0.26));
      const recover = easeInOut(progress(t, 2.4, 1.6));
      bossArm = lerp(lerp(RAISED.arm, SLAM.arm, slam), REST.arm, recover);
      bossWrist = lerp(lerp(RAISED.wrist, SLAM.wrist, slam), REST.wrist, recover);
      bossLean = lerp(lerp(RAISED.lean, SLAM.lean, slam), REST.lean, recover);
      if (t < 0.26) {
        s.knight.copy(PLAYER_LEAP);
        sword = SWORD_RAISED;
        lean = -0.1;
      } else {
        const knock = progress(t, 0.26, 0.6);
        s.knight.lerpVectors(PLAYER_LEAP, PLAYER_FALLEN, easeOut(knock));
        s.knight.y = lerp(PLAYER_LEAP.y, PLAYER_FALLEN.y, knock) + Math.sin(knock * Math.PI) * 0.7;
        fall = (Math.PI / 2) * easeOut(knock);
        sword = lerp(SWORD_RAISED, 2.4, knock);
        lean = 0;
      }
      shake = t > 0.26 ? Math.exp(-(t - 0.26) * 4.5) * 0.3 : 0;
      roll = 0.42 * easeInOut(progress(t, 0.55, 1.4));
      if (t > 0.26 && !(s.fired & 1)) {
        s.fired |= 1;
        const chest = PLAYER_LEAP.clone().setY(1.9);
        bursts.current.push(
          {
            origin: IMPACT_POINT.clone(),
            count: 110,
            color: '#8d8274',
            speed: [1.5, 5.5],
            direction: UP,
            spread: 3.5,
            gravity: 5,
            drag: 2.4,
            life: [0.6, 1.5],
          },
          {
            origin: chest,
            count: 80,
            color: '#ffb35c',
            speed: [4, 12],
            life: [0.2, 0.55],
            gravity: 14,
            drag: 0.8,
          },
          {
            origin: chest,
            count: 40,
            color: '#ff3a1a',
            speed: [2, 6],
            life: [0.3, 0.8],
            gravity: 9,
            drag: 1.5,
          },
        );
        fireFlash(chest, e, 70, 0.6, '#ff8a4a');
      }
    }

    const knightNode = knight.current;
    if (knightNode) {
      knightNode.position.copy(s.knight);
      knightNode.rotation.x = fall - lean;
    }
    if (knightArm.current) knightArm.current.rotation.x = sword;

    const breathe = Math.sin(e * 1.6) * 0.05 * (1 - kneel);
    rig.legs.current?.scale.set(1, 1 - kneel * 0.42, 1);
    if (rig.upper.current) {
      rig.upper.current.position.y = HIP * (1 - kneel * 0.42) + breathe;
      rig.upper.current.rotation.x = bossLean;
    }
    if (rig.arm.current) rig.arm.current.rotation.x = bossArm;
    if (rig.wrist.current) rig.wrist.current.rotation.x = bossWrist;
    if (rig.leftArm.current)
      rig.leftArm.current.rotation.x = 0.12 + Math.sin(e * 1.1) * 0.03 - kneel * 0.4;
    if (rig.cape.current) rig.cape.current.rotation.x = -0.06 + Math.sin(e * 0.9) * 0.025;
    if (rig.eyes.current) rig.eyes.current.visible = glow > 0.02;
    if (rig.root.current) rig.root.current.visible = fade > 0.002;
    const transparent = fade < 0.999;
    for (const material of Object.values(materials)) {
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = fade;
    }
    if (reticle.current)
      reticle.current.visible = phase === 'idle' || phase === 'attempt' || phase === 'hold';

    // Over-the-shoulder lock-on; pulls back to frame the kill, or sinks to the floor on death.
    s.head.copy(s.knight).setY(s.knight.y + 1.5);
    if (phase === 'win') {
      const pull = easeInOut(progress(t, 0.5, 2.4));
      s.eyeTarget.set(
        lerp(s.knight.x + CAMERA_OFFSET.x, 3.6, pull),
        lerp(CAMERA_OFFSET.y + s.knight.y * 0.5, 3.2, pull),
        lerp(s.knight.z + CAMERA_OFFSET.z, -1.5, pull),
      );
      s.lookTarget.copy(s.head).lerp(BOSS_CHEST, 0.68).lerp(BOSS_KNEELING, pull);
    } else if (phase === 'loss' && t > 0.26) {
      const sink = easeInOut(progress(t, 0.5, 1.4));
      s.eyeTarget.set(
        PLAYER_LEAP.x + CAMERA_OFFSET.x - sink * 0.2,
        lerp(CAMERA_OFFSET.y + PLAYER_LEAP.y * 0.5, 0.55, sink),
        lerp(PLAYER_LEAP.z + CAMERA_OFFSET.z, PLAYER_FALLEN.z + 4.2, sink),
      );
      s.lookTarget.copy(BOSS_CHEST).setY(lerp(BOSS_CHEST.y, 3.2, sink));
    } else {
      s.eyeTarget.set(
        s.knight.x + CAMERA_OFFSET.x,
        CAMERA_OFFSET.y + s.knight.y * 0.5,
        s.knight.z + CAMERA_OFFSET.z,
      );
      s.lookTarget.copy(s.head).lerp(BOSS_CHEST, 0.68);
    }
    if (snap) {
      s.eye.copy(s.eyeTarget);
      s.look.copy(s.lookTarget);
    } else {
      damp(s.eye, s.eyeTarget, 4.5, delta);
      damp(s.look, s.lookTarget, 6, delta);
    }
    camera.position.copy(s.eye);
    if (shake)
      camera.position.add(
        s.shake
          .set(Math.sin(e * 91) + Math.sin(e * 37), Math.sin(e * 73) + Math.cos(e * 29), 0)
          .multiplyScalar(shake),
      );
    camera.lookAt(s.look);
    if (roll) camera.rotateZ(roll);

    const age = e - s.flashAt;
    if (flash.current)
      flash.current.intensity =
        age < s.flashLength ? s.flashPower * (1 - age / s.flashLength) ** 2 : 0;
  });

  return (
    <>
      <Knight ref={knight} arm={knightArm} />
      <Boss rig={rig} materials={materials} />
      <sprite
        ref={reticle}
        position={[0, 4.4 * BOSS_SCALE, BOSS_Z + 1.5]}
        scale={[0.5, 0.5, 1]}
        renderOrder={10}
      >
        <spriteMaterial
          map={reticleTexture}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <pointLight ref={flash} intensity={0} distance={30} decay={1.4} />
    </>
  );
}

const SKY: Array<[number, string]> = [
  [0, '#030406'],
  [0.3, '#080b10'],
  [0.42, '#141a23'],
  [0.49, '#2a313c'],
  [0.52, '#1a1e25'],
  [1, '#08090c'],
];

export function SoulsScene({
  phase,
  reducedMotion = false,
}: {
  phase: FeedPhase;
  reducedMotion?: boolean;
}) {
  const bursts = useRef<BurstEvent[]>([]);
  return (
    <Canvas
      className="voxel-canvas"
      frameloop="never"
      dpr={[1, 1.5]}
      camera={{ fov: 60, near: 0.1, far: 600, position: [1.5, 2.2, 7] }}
      gl={{ antialias: true }}
    >
      <FrameBudget reducedMotion={reducedMotion} renderKey={`souls:${phase}`} />
      <color attach="background" args={['#07090c']} />
      <fog attach="fog" args={['#151a21', 16, 78]} />
      <hemisphereLight args={['#6c7c96', '#1c1611', 0.5]} />
      <directionalLight position={[-12, 30, -45]} intensity={1.6} color="#a8c0ff" />
      <directionalLight position={[10, 14, 24]} intensity={0.5} color="#ffb98a" />
      <GradientSky stops={SKY} />
      <Eclipse />
      <Courtyard />
      {BRAZIERS.map(([x, z], i) => (
        <Brazier key={i} position={[x, 0, z]} seed={i * 1.7} />
      ))}
      <GroundMist />
      <Ashfall />
      <Duel phase={phase} bursts={bursts} />
      <Bursts queue={bursts} size={0.22} />
    </Canvas>
  );
}
