import { FrameBudget } from './SceneRuntime.tsx';
import { RoundedBox } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  type BurstEvent,
  Bursts,
  canvasTexture,
  damp,
  easeInOut,
  easeOut,
  type FeedPhase,
  glowTexture,
  GradientSky,
  progress,
  seeded,
  usePhaseTimer,
} from './feedKit.tsx';

// Arena units are roughly metres. The blue car attacks the orange goal at -Z.
const HALF_WIDTH = 34;
const HALF_LENGTH = 46;
const WALL_HEIGHT = 13;
const RAMP = 5;
const GOAL_HALF_WIDTH = 9;
const GOAL_HEIGHT = 7;
const GOAL_DEPTH = 7;
const GOAL_LINE = -HALF_LENGTH;
const BALL_RADIUS = 1.9;
const GRAVITY = 20;
const BLUE = '#2f7cff';
const ORANGE = '#ff8a1f';

const FORWARD = new THREE.Vector3(0, 0, -1);
const CAR_START = new THREE.Vector3(-1.4, 0, -13);
const CAR_CONTACT = new THREE.Vector3(0.35, 5.3, -30.6);
const CAR_PATH = new THREE.CubicBezierCurve3(
  CAR_START,
  new THREE.Vector3(-1.2, 0.9, -17),
  new THREE.Vector3(-0.4, 3.3, -24),
  CAR_CONTACT,
);
const BALL_SPOT = new THREE.Vector3(0.6, BALL_RADIUS, -33.5);
const BALL_HOLD = new THREE.Vector3(0.6, 7.4, -33.5);
const CONTACT_DIR = BALL_HOLD.clone().sub(CAR_CONTACT).normalize();
const GOAL_CENTER = new THREE.Vector3(0, 3.4, GOAL_LINE - 1);
const ATTEMPT_TIME = 1.8;

// Win: a clean touch drives the ball into the side netting, where it detonates.
const SHOT_START = 0.15;
const SHOT_TIME = 0.5;
const NET_POINT = new THREE.Vector3(-1.6, 3.4, -51);
const CAR_STRUCK = CAR_CONTACT.clone().addScaledVector(CONTACT_DIR, 0.55);
const CAR_COAST = new THREE.Vector3(0.8, 6.6, -36.2);
const CAR_LANDED = new THREE.Vector3(0.9, 0, -37.6);

// Loss: a thin touch clips the crossbar and the ball bounces back into play.
const MISS_START = 0.12;
const SHOT_VELOCITY = new THREE.Vector3(0.5, 5.6, -22);
const BAR_TIME = 0.477;
const REBOUND = new THREE.Vector3(2.2, 7.86, 7.44);
const REBOUND_TIME = 1.256;
const CAR_TOUCHED = CAR_CONTACT.clone().addScaledVector(CONTACT_DIR, 0.4);
const CAR_SPILLED = new THREE.Vector3(-0.4, 0, -35.8);
const SPILL_DIR = new THREE.Vector3(-0.15, -0.35, -1).normalize();
const REST_DIR = new THREE.Vector3(-0.2, 0, -1).normalize();

function ballistic(
  origin: THREE.Vector3,
  velocity: THREE.Vector3,
  time: number,
  target: THREE.Vector3,
) {
  return target
    .copy(origin)
    .addScaledVector(velocity, time)
    .setY(origin.y + velocity.y * time - 0.5 * GRAVITY * time * time);
}

const BAR_POINT = ballistic(BALL_HOLD, SHOT_VELOCITY, BAR_TIME, new THREE.Vector3());
const REBOUND_LANDING = ballistic(BAR_POINT, REBOUND, REBOUND_TIME, new THREE.Vector3());

/** Height above rest of a ball launched upward at `launch` m/s that keeps bouncing. */
function bounceHeight(time: number, launch: number, restitution: number) {
  let speed = launch;
  let remaining = time;
  while (speed > 0.4) {
    const flight = (2 * speed) / GRAVITY;
    if (remaining < flight) return speed * remaining - 0.5 * GRAVITY * remaining * remaining;
    remaining -= flight;
    speed *= restitution;
  }
  return 0;
}

function missedBall(time: number, target: THREE.Vector3) {
  if (time < BAR_TIME) return ballistic(BALL_HOLD, SHOT_VELOCITY, time, target);
  const rebound = time - BAR_TIME;
  if (rebound < REBOUND_TIME) return ballistic(BAR_POINT, REBOUND, rebound, target);
  const roll = rebound - REBOUND_TIME;
  const slide = (1 - Math.exp(-2 * roll)) / 2;
  return target.set(
    REBOUND_LANDING.x + REBOUND.x * slide,
    BALL_RADIUS + bounceHeight(roll, 8.6, 0.5),
    REBOUND_LANDING.z + REBOUND.z * slide,
  );
}

/** Striped turf with field markings. The top of the canvas maps to the orange goal end (-Z). */
function turfTexture() {
  const ppu = 14;
  const width = HALF_WIDTH * 2 * ppu;
  const height = HALF_LENGTH * 2 * ppu;
  const x = (value: number) => (value + HALF_WIDTH) * ppu;
  const z = (value: number) => (value + HALF_LENGTH) * ppu;
  return canvasTexture(width, height, (context) => {
    const stripes = 14;
    for (let i = 0; i < stripes; i++) {
      context.fillStyle = i % 2 ? '#3d9438' : '#47a441';
      context.fillRect(
        0,
        Math.floor((i * height) / stripes),
        width,
        Math.ceil(height / stripes) + 1,
      );
    }
    const random = seeded(5);
    for (let n = 0; n < 16000; n++) {
      context.fillStyle = random() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,25,0,.07)';
      context.fillRect(random() * width, random() * height, 2, 2);
    }
    const teams = context.createLinearGradient(0, 0, 0, height);
    teams.addColorStop(0, 'rgba(255,138,31,.2)');
    teams.addColorStop(0.28, 'rgba(255,138,31,0)');
    teams.addColorStop(0.72, 'rgba(47,124,255,0)');
    teams.addColorStop(1, 'rgba(47,124,255,.2)');
    context.fillStyle = teams;
    context.fillRect(0, 0, width, height);
    context.lineWidth = 0.32 * ppu;
    context.strokeStyle = 'rgba(255,255,255,.8)';
    context.strokeRect(
      x(-HALF_WIDTH + 0.8),
      z(-HALF_LENGTH + 0.8),
      (HALF_WIDTH * 2 - 1.6) * ppu,
      (HALF_LENGTH * 2 - 1.6) * ppu,
    );
    context.beginPath();
    context.moveTo(x(-HALF_WIDTH), z(0));
    context.lineTo(x(HALF_WIDTH), z(0));
    context.moveTo(x(9), z(0));
    context.arc(x(0), z(0), 9 * ppu, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.85)';
    context.beginPath();
    context.arc(x(0), z(0), 0.6 * ppu, 0, Math.PI * 2);
    context.fill();
    const boxes: Array<[number, number, string]> = [
      [GOAL_LINE, 1, 'rgba(255,178,104,.92)'],
      [-GOAL_LINE, -1, 'rgba(132,182,255,.92)'],
    ];
    boxes.forEach(([line, into, color]) => {
      context.strokeStyle = color;
      context.strokeRect(x(-15), z(into > 0 ? line : line - 11), 30 * ppu, 11 * ppu);
      context.beginPath();
      context.arc(
        x(0),
        z(line + into * 11),
        6 * ppu,
        into > 0 ? 0 : Math.PI,
        into > 0 ? Math.PI : Math.PI * 2,
      );
      context.stroke();
    });
  });
}

/** Tileable honeycomb lines on black, used as the emissive map of the arena walls. */
function honeycombTexture() {
  const side = 30;
  const width = side * 3;
  const height = Math.round(Math.sqrt(3) * side);
  const texture = canvasTexture(width, height, (context) => {
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    for (let column = -1; column <= 2; column++) {
      for (let row = -1; row <= 1; row++) {
        const cx = column * side * 1.5;
        const cy = row * height + (Math.abs(column) % 2 ? height / 2 : 0);
        context.beginPath();
        for (let k = 0; k <= 6; k++)
          context.lineTo(
            cx + side * Math.cos((Math.PI / 3) * k),
            cy + side * Math.sin((Math.PI / 3) * k),
          );
        context.stroke();
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function netTexture() {
  const texture = canvasTexture(32, 32, (context) => {
    context.strokeStyle = 'rgba(255,255,255,.95)';
    context.lineWidth = 3;
    context.strokeRect(0, 0, 32, 32);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Plane whose UVs repeat once per cell, so one tiling texture keeps the same scale on every panel. */
function panelGeometry(width: number, height: number, cellWidth: number, cellHeight = cellWidth) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (uv.getX(i) * width) / cellWidth, (uv.getY(i) * height) / cellHeight);
  return geometry;
}

function GlowBar({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function Pitch() {
  const gl = useThree((state) => state.gl);
  const turf = useMemo(() => {
    const texture = turfTexture();
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    return texture;
  }, [gl]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_WIDTH * 2, HALF_LENGTH * 2]} />
        <meshStandardMaterial map={turf} roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, GOAL_LINE - GOAL_DEPTH / 2]}>
        <planeGeometry args={[GOAL_HALF_WIDTH * 2, GOAL_DEPTH]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.95} />
      </mesh>
    </>
  );
}

function Arena() {
  const honeycomb = useMemo(honeycombTexture, []);
  const materials = useMemo(() => {
    const wall = (glow: string) =>
      new THREE.MeshStandardMaterial({
        color: '#111a33',
        emissive: glow,
        emissiveMap: honeycomb,
        emissiveIntensity: 0.7,
        roughness: 0.55,
        metalness: 0.2,
        side: THREE.DoubleSide,
      });
    return {
      orange: wall('#ff7a2a'),
      blue: wall('#3a78ff'),
      ramp: new THREE.MeshStandardMaterial({
        color: '#3a8b35',
        roughness: 0.92,
        side: THREE.DoubleSide,
      }),
    };
  }, [honeycomb]);
  const panels = useMemo(
    () => ({
      side: panelGeometry(HALF_LENGTH, WALL_HEIGHT - RAMP, 4.8, 2.77),
      besideGoal: panelGeometry(HALF_WIDTH - GOAL_HALF_WIDTH, WALL_HEIGHT - RAMP, 4.8, 2.77),
      aboveGoal: panelGeometry(GOAL_HALF_WIDTH * 2, WALL_HEIGHT - GOAL_HEIGHT, 4.8, 2.77),
    }),
    [],
  );
  const wallY = (RAMP + WALL_HEIGHT) / 2;
  const besideX = (GOAL_HALF_WIDTH + HALF_WIDTH) / 2;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            geometry={panels.side}
            material={materials.orange}
            position={[side * HALF_WIDTH, wallY, -HALF_LENGTH / 2]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          />
          <mesh
            geometry={panels.side}
            material={materials.blue}
            position={[side * HALF_WIDTH, wallY, HALF_LENGTH / 2]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          />
          {/* Curved turf where the floor rolls up into the side walls and the back wall. */}
          <mesh
            material={materials.ramp}
            position={[side * (HALF_WIDTH - RAMP), RAMP, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry
              args={[
                RAMP,
                RAMP,
                HALF_LENGTH * 2,
                20,
                1,
                true,
                side > 0 ? 0 : -Math.PI / 2,
                Math.PI / 2,
              ]}
            />
          </mesh>
          <mesh
            geometry={panels.besideGoal}
            material={materials.orange}
            position={[side * besideX, wallY, GOAL_LINE]}
          />
          <mesh
            material={materials.ramp}
            position={[side * besideX, RAMP, GOAL_LINE + RAMP]}
            rotation={[0, 0, -Math.PI / 2]}
          >
            <cylinderGeometry
              args={[
                RAMP,
                RAMP,
                HALF_WIDTH - GOAL_HALF_WIDTH,
                20,
                1,
                true,
                Math.PI / 2,
                Math.PI / 2,
              ]}
            />
          </mesh>
          <GlowBar
            position={[side * HALF_WIDTH, WALL_HEIGHT, -HALF_LENGTH / 2]}
            size={[0.3, 0.3, HALF_LENGTH]}
            color={ORANGE}
          />
          <GlowBar
            position={[side * HALF_WIDTH, WALL_HEIGHT, HALF_LENGTH / 2]}
            size={[0.3, 0.3, HALF_LENGTH]}
            color={BLUE}
          />
          <GlowBar
            position={[side * HALF_WIDTH, RAMP, 0]}
            size={[0.16, 0.16, HALF_LENGTH * 2]}
            color="#dbe7ff"
          />
          <GlowBar
            position={[side * besideX, RAMP, GOAL_LINE]}
            size={[HALF_WIDTH - GOAL_HALF_WIDTH, 0.16, 0.16]}
            color="#dbe7ff"
          />
        </group>
      ))}
      <mesh
        geometry={panels.aboveGoal}
        material={materials.orange}
        position={[0, (GOAL_HEIGHT + WALL_HEIGHT) / 2, GOAL_LINE]}
      />
      <GlowBar
        position={[0, WALL_HEIGHT, GOAL_LINE]}
        size={[HALF_WIDTH * 2, 0.3, 0.3]}
        color={ORANGE}
      />
      <mesh position={[0, 10.1, GOAL_LINE + 0.05]}>
        <ringGeometry args={[1.45, 1.9, 6]} />
        <meshBasicMaterial color={ORANGE} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Goal() {
  const net = useMemo(netTexture, []);
  const netMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: net,
        color: '#ffd9b4',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [net],
  );
  const frame = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffe0c0',
        emissive: ORANGE,
        emissiveIntensity: 1.5,
        roughness: 0.4,
      }),
    [],
  );
  const shell = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: '#1e110a', roughness: 1, side: THREE.DoubleSide }),
    [],
  );
  const nets = useMemo(
    () => ({
      back: panelGeometry(GOAL_HALF_WIDTH * 2, GOAL_HEIGHT, 0.55),
      side: panelGeometry(GOAL_DEPTH, GOAL_HEIGHT, 0.55),
      roof: panelGeometry(GOAL_HALF_WIDTH * 2, GOAL_DEPTH, 0.55),
    }),
    [],
  );
  return (
    <group position={[0, 0, GOAL_LINE]}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={frame} position={[side * GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, 0]}>
            <boxGeometry args={[0.5, GOAL_HEIGHT, 0.5]} />
          </mesh>
          <mesh material={frame} position={[side * GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, -GOAL_DEPTH]}>
            <boxGeometry args={[0.25, GOAL_HEIGHT, 0.25]} />
          </mesh>
          <mesh
            geometry={nets.side}
            material={netMaterial}
            position={[side * GOAL_HALF_WIDTH, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <mesh
            material={shell}
            position={[side * (GOAL_HALF_WIDTH + 0.4), GOAL_HEIGHT / 2, -GOAL_DEPTH / 2]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[GOAL_DEPTH, GOAL_HEIGHT]} />
          </mesh>
        </group>
      ))}
      <mesh material={frame} position={[0, GOAL_HEIGHT, 0]}>
        <boxGeometry args={[GOAL_HALF_WIDTH * 2 + 0.5, 0.5, 0.5]} />
      </mesh>
      <mesh material={frame} position={[0, GOAL_HEIGHT, -GOAL_DEPTH]}>
        <boxGeometry args={[GOAL_HALF_WIDTH * 2, 0.25, 0.25]} />
      </mesh>
      <mesh material={shell} position={[0, GOAL_HEIGHT / 2, -GOAL_DEPTH - 0.5]}>
        <planeGeometry args={[GOAL_HALF_WIDTH * 2, GOAL_HEIGHT]} />
      </mesh>
      <mesh
        geometry={nets.back}
        material={netMaterial}
        position={[0, GOAL_HEIGHT / 2, -GOAL_DEPTH]}
      />
      <mesh
        geometry={nets.roof}
        material={netMaterial}
        position={[0, GOAL_HEIGHT, -GOAL_DEPTH / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <GlowBar position={[0, 0.03, -0.1]} size={[GOAL_HALF_WIDTH * 2, 0.05, 0.22]} color={ORANGE} />
      <pointLight
        position={[0, 3.5, -3.5]}
        color={ORANGE}
        intensity={45}
        distance={20}
        decay={1.5}
      />
    </group>
  );
}

const TIERS = [0, 1, 2, 3, 4];
const TIER_DEPTH = 3;
const TIER_RISE = 1.3;

function Stadium() {
  const glow = useMemo(() => glowTexture(), []);
  const stand = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#161c2b', roughness: 0.95 }),
    [],
  );
  const crowd = useMemo(() => {
    const random = seeded(31);
    const palette = [
      '#ff8a1f',
      '#ff8a1f',
      '#2f7cff',
      '#2f7cff',
      '#f2f2f2',
      '#9aa4b8',
      '#ffd25a',
      '#2a3248',
      '#ff5a3c',
    ].map((hex) => new THREE.Color(hex).multiplyScalar(0.8));
    const positions: number[] = [];
    const colors: number[] = [];
    const add = (x: number, y: number, z: number) => {
      const color = palette[Math.floor(random() * palette.length)];
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
    };
    TIERS.forEach((tier) => {
      const y = WALL_HEIGHT + TIER_RISE * (tier + 1) + 0.35;
      for (let n = 0; n < 360; n++) {
        const x = HALF_WIDTH + tier * TIER_DEPTH + 0.3 + random() * (TIER_DEPTH - 0.6);
        add(random() > 0.5 ? x : -x, y, -70 + random() * 120);
      }
      const span = HALF_WIDTH + (tier + 1) * TIER_DEPTH;
      for (let n = 0; n < 260; n++)
        add(
          -span + random() * span * 2,
          y,
          GOAL_LINE - tier * TIER_DEPTH - 0.3 - random() * (TIER_DEPTH - 0.6),
        );
    });
    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }, []);
  return (
    <group>
      {TIERS.map((tier) => {
        const height = TIER_RISE * (tier + 1);
        const offset = tier * TIER_DEPTH + TIER_DEPTH / 2;
        return (
          <group key={tier}>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                material={stand}
                position={[side * (HALF_WIDTH + offset), WALL_HEIGHT + height / 2, -10]}
              >
                <boxGeometry args={[TIER_DEPTH, height, 120]} />
              </mesh>
            ))}
            <mesh material={stand} position={[0, WALL_HEIGHT + height / 2, GOAL_LINE - offset]}>
              <boxGeometry
                args={[(HALF_WIDTH + (tier + 1) * TIER_DEPTH) * 2, height, TIER_DEPTH]}
              />
            </mesh>
          </group>
        );
      })}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[crowd.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[crowd.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.55} vertexColors />
      </points>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 44, 0, -64]}>
          <mesh position={[0, 17, 0]}>
            <boxGeometry args={[0.9, 34, 0.9]} />
            <meshStandardMaterial color="#1d2331" />
          </mesh>
          <group position={[0, 34.5, 0]} rotation={[0.35, -side * 0.6, 0]}>
            <mesh>
              <boxGeometry args={[7, 3.4, 0.5]} />
              <meshStandardMaterial color="#1a2030" />
            </mesh>
            <mesh position={[0, 0, 0.26]}>
              <planeGeometry args={[6.4, 2.8]} />
              <meshBasicMaterial color="#f4f8ff" toneMapped={false} />
            </mesh>
          </group>
          <sprite position={[0, 34.5, 2]} scale={[26, 26, 1]}>
            <spriteMaterial
              map={glow}
              color="#cfe0ff"
              transparent
              opacity={0.45}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}

const BIG_PADS: Array<[number, number]> = [
  [-27, -36],
  [27, -36],
  [-30, 0],
  [30, 0],
  [-27, 36],
  [27, 36],
];
const SMALL_PADS = (
  [
    [0, -40],
    [-10, -40],
    [10, -40],
    [-18, -28],
    [18, -28],
    [0, -22],
    [-8, -14],
    [8, -14],
    [-24, -14],
    [24, -14],
    [-16, -6],
    [16, -6],
    [-10, 0],
    [10, 0],
  ] as Array<[number, number]>
).flatMap(([x, z]): Array<[number, number]> =>
  z === 0
    ? [[x, z]]
    : [
        [x, z],
        [x, -z],
      ],
);

function BoostPads() {
  const glow = useMemo(() => glowTexture(), []);
  const small = useRef<THREE.InstancedMesh>(null);
  const orbs = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const mesh = small.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    SMALL_PADS.forEach(([x, z], index) => {
      dummy.position.set(x, 0.05, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(({ clock }) => {
    orbs.current?.children.forEach((orb: THREE.Object3D, index: number) => {
      orb.position.y = 1.35 + Math.sin(clock.elapsedTime * 2 + index) * 0.14;
      orb.rotation.y = clock.elapsedTime * 1.4;
    });
  });
  return (
    <group>
      <instancedMesh ref={small} args={[undefined, undefined, SMALL_PADS.length]}>
        <cylinderGeometry args={[0.55, 0.6, 0.08, 16]} />
        <meshBasicMaterial color="#ffb547" toneMapped={false} />
      </instancedMesh>
      {BIG_PADS.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[1.7, 1.9, 0.12, 28]} />
            <meshStandardMaterial color="#262b35" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.5, 32]} />
            <meshBasicMaterial color="#ffb547" toneMapped={false} />
          </mesh>
          <sprite position={[0, 1.35, 0]} scale={[3.6, 3.6, 1]}>
            <spriteMaterial
              map={glow}
              color="#ffa33d"
              transparent
              opacity={0.55}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        </group>
      ))}
      <group ref={orbs}>
        {BIG_PADS.map(([x, z]) => (
          <mesh key={`${x},${z}`} position={[x, 1.35, z]}>
            <icosahedronGeometry args={[0.55, 0]} />
            <meshBasicMaterial color="#ffc24f" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const WHEELS: Array<[number, number, number]> = [
  [-0.8, 0.8, 0.36],
  [0.8, 0.8, 0.36],
  [-0.82, -0.82, 0.42],
  [0.82, -0.82, 0.42],
];

/** Octane-style battle car, modelled nose-first along +Z so `lookAt` aims it. */
function Car({ ref, boost }: { ref: React.Ref<THREE.Group>; boost: { current: number } }) {
  const flame = useRef<THREE.Group>(null);
  const materials = useMemo(
    () => ({
      paint: new THREE.MeshStandardMaterial({ color: BLUE, metalness: 0.45, roughness: 0.32 }),
      trim: new THREE.MeshStandardMaterial({ color: '#141a24', metalness: 0.5, roughness: 0.45 }),
      glass: new THREE.MeshStandardMaterial({ color: '#0a1220', metalness: 0.8, roughness: 0.15 }),
      tire: new THREE.MeshStandardMaterial({ color: '#111317', roughness: 0.85 }),
      rim: new THREE.MeshStandardMaterial({ color: '#b8c2cf', metalness: 0.9, roughness: 0.3 }),
    }),
    [],
  );
  useFrame(({ clock }) => {
    const node = flame.current;
    if (!node) return;
    const level = boost.current;
    node.visible = level > 0.02;
    node.scale.set(
      1,
      1,
      Math.max(
        0.01,
        level *
          (0.84 + Math.sin(clock.elapsedTime * 57) * 0.1 + Math.sin(clock.elapsedTime * 31) * 0.07),
      ),
    );
  });
  return (
    <group ref={ref}>
      <RoundedBox
        args={[1.52, 0.44, 2.5]}
        radius={0.13}
        smoothness={3}
        position={[0, 0.6, 0]}
        material={materials.paint}
      />
      <RoundedBox
        args={[1.4, 0.2, 1.05]}
        radius={0.08}
        smoothness={2}
        position={[0, 0.79, 0.72]}
        rotation={[0.2, 0, 0]}
        material={materials.paint}
      />
      <RoundedBox
        args={[1.14, 0.42, 1.12]}
        radius={0.14}
        smoothness={3}
        position={[0, 1, -0.2]}
        material={materials.glass}
      />
      <RoundedBox
        args={[1.02, 0.1, 0.82]}
        radius={0.04}
        smoothness={2}
        position={[0, 1.23, -0.26]}
        material={materials.paint}
      />
      <mesh material={materials.trim} position={[0, 0.42, 0]}>
        <boxGeometry args={[1.56, 0.14, 2.3]} />
      </mesh>
      <mesh material={materials.paint} position={[0, 1.16, -1.12]}>
        <boxGeometry args={[1.56, 0.07, 0.36]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={materials.trim} position={[side * 0.5, 0.98, -1.08]}>
            <boxGeometry args={[0.07, 0.3, 0.12]} />
          </mesh>
          <mesh position={[side * 0.77, 0.62, 0.1]}>
            <boxGeometry args={[0.02, 0.06, 1.9]} />
            <meshBasicMaterial color="#8fd0ff" toneMapped={false} />
          </mesh>
          <mesh position={[side * 0.46, 0.66, 1.25]}>
            <boxGeometry args={[0.34, 0.09, 0.04]} />
            <meshBasicMaterial color="#eaf6ff" toneMapped={false} />
          </mesh>
          <mesh position={[side * 0.5, 0.7, -1.25]}>
            <boxGeometry args={[0.36, 0.08, 0.04]} />
            <meshBasicMaterial color="#ff3a3a" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {WHEELS.map(([x, z, radius]) => (
        <group key={`${x},${z}`} position={[x, radius, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={materials.tire}>
            <cylinderGeometry args={[radius, radius, 0.34, 20]} />
          </mesh>
          <mesh material={materials.rim}>
            <cylinderGeometry args={[radius * 0.55, radius * 0.55, 0.36, 12]} />
          </mesh>
        </group>
      ))}
      <mesh material={materials.trim} position={[0, 0.58, -1.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.21, 0.16, 14]} />
      </mesh>
      <group ref={flame} position={[0, 0.58, -1.36]}>
        <mesh position={[0, 0, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.22, 1.2, 14, 1, true]} />
          <meshBasicMaterial
            color="#ff8a24"
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0, -0.34]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.11, 0.68, 12, 1, true]} />
          <meshBasicMaterial
            color="#fff4cf"
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Drives the car, ball, effects, and ball-cam for each feed phase. */
function Match({ phase, bursts }: { phase: FeedPhase; bursts: { current: BurstEvent[] } }) {
  const camera = useThree((state) => state.camera);
  const car = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Group>(null);
  const ballShadow = useRef<THREE.Mesh>(null);
  const carShadow = useRef<THREE.Mesh>(null);
  const shock = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const boost = useRef(0);
  const timer = usePhaseTimer(phase);
  const shadowTexture = useMemo(
    () =>
      glowTexture([
        [0, 'rgba(255,255,255,.9)'],
        [0.55, 'rgba(255,255,255,.45)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    [],
  );
  const ballGeometry = useMemo(() => new THREE.IcosahedronGeometry(BALL_RADIUS, 1), []);
  const ballSeams = useMemo(() => new THREE.EdgesGeometry(ballGeometry, 1), [ballGeometry]);
  const s = useMemo(
    () => ({
      car: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      ball: new THREE.Vector3(),
      ballFrom: new THREE.Vector3(),
      eye: new THREE.Vector3(),
      look: new THREE.Vector3(),
      eyeTarget: new THREE.Vector3(),
      lookTarget: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
      flashOrigin: new THREE.Vector3(),
      flashAt: -10,
      flashScale: 1,
      fired: false,
      ready: false,
    }),
    [],
  );

  const fireFlash = (origin: THREE.Vector3, elapsed: number, scale: number, color: string) => {
    s.flashOrigin.copy(origin);
    s.flashAt = elapsed;
    s.flashScale = scale;
    flash.current?.color.set(color);
  };

  useFrame((state, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const { time: t, changed } = timer(elapsed);
    // Returning to idle is a fresh kickoff: cut instead of easing back across the pitch.
    const snap = !s.ready || (changed && phase === 'idle');
    if (changed) {
      s.ballFrom.copy(s.ball);
      s.fired = false;
    }
    s.ready = true;
    let roll = 0;
    let boostLevel = 0;
    let spin = 1.2;
    let ballVisible = true;

    if (phase === 'idle') {
      s.car.copy(CAR_START);
      s.car.y += Math.sin(elapsed * 9) * 0.01;
      s.dir.set(BALL_SPOT.x - CAR_START.x, 0, BALL_SPOT.z - CAR_START.z).normalize();
      const bounce = (elapsed % 1.5) / 1.5;
      s.ball.copy(BALL_SPOT);
      s.ball.y += 26 * bounce * (1 - bounce);
    } else if (phase === 'attempt') {
      // Jump, then boost along a rising arc to meet the ball as it drops.
      const p = Math.min(1, t / ATTEMPT_TIME);
      const u = p * (0.42 + 0.58 * p);
      CAR_PATH.getPoint(u, s.car);
      const apex = Math.min(t, ATTEMPT_TIME) - 1;
      s.ball.set(BALL_HOLD.x, 9.4 - 3.125 * apex * apex, BALL_HOLD.z);
      s.ball.lerpVectors(s.ballFrom, s.ball, easeInOut(progress(t, 0, 0.45)));
      CAR_PATH.getTangent(u, s.dir);
      s.tmp.copy(s.ball).sub(s.car).normalize();
      s.dir.lerp(s.tmp, THREE.MathUtils.smoothstep(p, 0.55, 1)).normalize();
      roll = Math.sin(p * Math.PI) * 0.35;
      boostLevel = p > 0.08 ? 1 : 0;
      spin = 2;
    } else if (phase === 'hold') {
      s.car.copy(CAR_CONTACT);
      s.car.y += Math.sin(elapsed * 1.4) * 0.04;
      s.ball.copy(BALL_HOLD);
      s.ball.y += Math.sin(elapsed * 1.4 + 1) * 0.04;
      s.dir.copy(CONTACT_DIR);
      boostLevel = 0.45;
      spin = 0.3;
    } else if (phase === 'win') {
      if (t < SHOT_START)
        s.car.copy(CAR_CONTACT).addScaledVector(CONTACT_DIR, (0.55 * t) / SHOT_START);
      else if (t < 1)
        s.car.lerpVectors(CAR_STRUCK, CAR_COAST, easeOut(progress(t, SHOT_START, 1 - SHOT_START)));
      else {
        const drop = progress(t, 1, 0.9);
        s.car.lerpVectors(CAR_COAST, CAR_LANDED, drop);
        s.car.y = CAR_COAST.y * (1 - drop * drop);
      }
      s.dir
        .copy(CONTACT_DIR)
        .lerp(FORWARD, THREE.MathUtils.smoothstep(t, 0.3, 1.6))
        .normalize();
      boostLevel = t < 0.7 ? 1 : 0;
      const flight = progress(t, SHOT_START, SHOT_TIME);
      s.ball.lerpVectors(BALL_HOLD, NET_POINT, flight);
      s.ball.y += Math.sin(flight * Math.PI) * 0.6;
      ballVisible = flight < 0.86;
      spin = 14;
      if (!ballVisible && !s.fired) {
        s.fired = true;
        bursts.current.push(
          {
            origin: s.ball.clone(),
            count: 280,
            color: '#4f9dff',
            speed: [8, 26],
            life: [0.6, 1.5],
            gravity: 7,
            drag: 1.6,
          },
          {
            origin: s.ball.clone(),
            count: 140,
            color: '#ffffff',
            speed: [4, 15],
            life: [0.4, 0.9],
            gravity: 4,
            drag: 2,
          },
        );
        fireFlash(s.ball, elapsed, 1, '#6aaeff');
      }
    } else {
      const fall = progress(t, MISS_START, 1.05);
      if (t < MISS_START)
        s.car.copy(CAR_CONTACT).addScaledVector(CONTACT_DIR, (0.4 * t) / MISS_START);
      else {
        s.car.lerpVectors(CAR_TOUCHED, CAR_SPILLED, easeOut(fall));
        s.car.y = CAR_TOUCHED.y * (1 - fall * fall);
      }
      s.dir
        .copy(CONTACT_DIR)
        .lerp(SPILL_DIR, THREE.MathUtils.smoothstep(fall, 0, 0.5))
        .lerp(REST_DIR, THREE.MathUtils.smoothstep(fall, 0.6, 1))
        .normalize();
      roll = Math.sin(fall * Math.PI) * 0.9;
      boostLevel = t < 0.35 ? 0.6 : 0;
      if (t < MISS_START) s.ball.copy(BALL_HOLD);
      else missedBall(t - MISS_START, s.ball);
      spin = t < MISS_START + BAR_TIME ? 9 : -5;
      if (t >= MISS_START + BAR_TIME && !s.fired) {
        s.fired = true;
        s.tmp.set(BAR_POINT.x, GOAL_HEIGHT + 0.25, GOAL_LINE + 0.25);
        bursts.current.push({
          origin: s.tmp.clone(),
          count: 70,
          color: '#ffd29a',
          speed: [3, 11],
          life: [0.25, 0.6],
          gravity: 14,
          drag: 1,
        });
        fireFlash(s.tmp, elapsed, 0.18, '#ffc27a');
      }
    }

    const carNode = car.current;
    if (carNode) {
      carNode.position.copy(s.car);
      carNode.lookAt(s.tmp.copy(s.car).add(s.dir));
      if (roll) carNode.rotateZ(roll);
      if (boostLevel > 0.05) {
        carNode.updateMatrixWorld();
        bursts.current.push({
          origin: carNode.localToWorld(new THREE.Vector3(0, 0.58, -1.5)),
          direction: s.dir.clone().negate(),
          count: Math.max(1, Math.round(boostLevel * 150 * delta)),
          speed: [5, 10],
          spread: 1.1,
          life: [0.22, 0.48],
          color: '#ff9436',
          drag: 1.5,
        });
      }
    }
    boost.current = boostLevel;

    const ballNode = ball.current;
    if (ballNode) {
      ballNode.visible = ballVisible;
      ballNode.position.copy(s.ball);
      ballNode.rotation.x -= delta * spin;
      ballNode.rotation.z += delta * spin * 0.3;
    }
    const ballShadowNode = ballShadow.current;
    if (ballShadowNode) {
      const height = Math.max(0, s.ball.y - BALL_RADIUS);
      ballShadowNode.visible = ballVisible;
      ballShadowNode.position.set(s.ball.x, 0.03, s.ball.z);
      ballShadowNode.scale.setScalar(BALL_RADIUS * 2.3 * (1 + height * 0.05));
      (ballShadowNode.material as THREE.MeshBasicMaterial).opacity =
        0.55 * (1 - Math.min(1, height / 16));
    }
    const carShadowNode = carShadow.current;
    if (carShadowNode) {
      const spread = 1 + s.car.y * 0.05;
      carShadowNode.position.set(s.car.x, 0.025, s.car.z);
      carShadowNode.rotation.set(-Math.PI / 2, 0, Math.atan2(s.dir.x, s.dir.z));
      carShadowNode.scale.set(2.1 * spread, 3.3 * spread, 1);
      (carShadowNode.material as THREE.MeshBasicMaterial).opacity =
        0.62 * (1 - Math.min(1, s.car.y / 12));
    }

    const age = elapsed - s.flashAt;
    const shockNode = shock.current;
    if (shockNode) {
      shockNode.visible = age < 0.9 && s.flashScale > 0.5;
      if (shockNode.visible) {
        shockNode.position.copy(s.flashOrigin);
        shockNode.scale.setScalar(1 + easeOut(age / 0.9) * 15);
        (shockNode.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - age / 0.9);
      }
    }
    if (flash.current) {
      flash.current.position.copy(s.flashOrigin);
      flash.current.intensity = age < 1.2 ? 1400 * s.flashScale * (1 - age / 1.2) ** 2 : 0;
    }

    // Ball cam: ride behind the car on the car→ball line; after the touch, watch the goal mouth.
    if (phase === 'win') {
      s.eyeTarget.set(s.car.x * 0.6, s.car.y + 2.8, s.car.z + 7.2);
      s.lookTarget.copy(s.fired ? GOAL_CENTER : s.ball);
    } else if (phase === 'loss') {
      s.eyeTarget.set(0.2, 8.4, -22.8);
      s.lookTarget.copy(GOAL_CENTER).lerp(s.ball, 0.5);
    } else {
      s.tmp.set(s.ball.x - s.car.x, 0, s.ball.z - s.car.z).normalize();
      s.eyeTarget.copy(s.car).addScaledVector(s.tmp, -6.4);
      s.eyeTarget.y = s.car.y + 2.5;
      s.lookTarget
        .copy(s.car)
        .lerp(phase === 'idle' ? s.tmp.set(s.ball.x, 4.2, s.ball.z) : s.ball, 0.62);
      s.lookTarget.y += 0.6;
    }
    if (snap) {
      s.eye.copy(s.eyeTarget);
      s.look.copy(s.lookTarget);
    } else {
      damp(s.eye, s.eyeTarget, phase === 'win' ? 2.4 : phase === 'loss' ? 1.6 : 6, delta);
      damp(s.look, s.lookTarget, phase === 'idle' ? 3 : 7, delta);
    }
    camera.position.copy(s.eye);
    camera.lookAt(s.look);
  });

  return (
    <>
      <Car ref={car} boost={boost} />
      <group ref={ball}>
        <mesh geometry={ballGeometry}>
          <meshStandardMaterial color="#e8ebf1" roughness={0.38} metalness={0.12} flatShading />
        </mesh>
        <lineSegments geometry={ballSeams} scale={1.004}>
          <lineBasicMaterial color="#5f6b7c" transparent opacity={0.6} />
        </lineSegments>
      </group>
      <mesh ref={ballShadow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry />
        <meshBasicMaterial
          map={shadowTexture}
          color="#000000"
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh ref={carShadow}>
        <planeGeometry />
        <meshBasicMaterial
          map={shadowTexture}
          color="#000000"
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh ref={shock} visible={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial
          color="#6fb0ff"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={flash} intensity={0} distance={70} decay={1.2} color="#6aaeff" />
    </>
  );
}

const SKY: Array<[number, string]> = [
  [0, '#0a1230'],
  [0.26, '#1a2862'],
  [0.34, '#33408a'],
  [0.4, '#7b4f8e'],
  [0.45, '#d9765f'],
  [0.5, '#ffb070'],
  [0.53, '#2f2038'],
  [1, '#0c0a12'],
];

export function RocketScene({
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
      camera={{ fov: 58, near: 0.1, far: 600, position: [-2, 2.5, -6.6] }}
      gl={{ antialias: true }}
    >
      <FrameBudget reducedMotion={reducedMotion} renderKey={`rocket:${phase}`} />
      <color attach="background" args={['#141a3a']} />
      <fog attach="fog" args={['#2b2748', 80, 210]} />
      <hemisphereLight args={['#d2e2ff', '#2d5a2a', 1.1]} />
      <directionalLight position={[-30, 50, 40]} intensity={1.9} color="#fff3e2" />
      <directionalLight position={[25, 20, -70]} intensity={0.7} color="#ffb48a" />
      <GradientSky stops={SKY} />
      <Stadium />
      <Pitch />
      <Arena />
      <Goal />
      <BoostPads />
      <Match phase={phase} bursts={bursts} />
      <Bursts queue={bursts} size={0.5} />
    </Canvas>
  );
}
