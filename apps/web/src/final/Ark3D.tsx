import type { RefObject } from 'react';
import type { Resources, SystemPresentation } from '@torchline/contracts';
import { FrameBudget } from './SceneRuntime.tsx';
import { conditionColor } from './condition.ts';
import { Canvas, createPortal, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html, Line, OrbitControls, RoundedBox, Stars } from '@react-three/drei';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export type ArkSector = 'bridge' | 'cryo' | 'reactor' | 'life';

type SceneProps = {
  selected: ArkSector;
  navigation: number;
  labelPortal?: RefObject<HTMLDivElement>;
  resources?: Resources;
  systems?: SystemPresentation[];
  reducedMotion?: boolean;
  readOnly?: boolean;
  mini?: boolean;
  view?: 'exterior' | 'cockpit';
  onSelect?: (sector: ArkSector) => void;
};

const COLORS = {
  hull: '#323936',
  hullDark: '#101616',
  edge: '#73796f',
  cyan: '#76c6c5',
  amber: '#df9d47',
  red: '#d5533e',
  green: '#6ca889',
};

function SectorNode({
  sector,
  selected,
  position,
  children,
  onSelect,
}: {
  sector: ArkSector;
  selected: ArkSector;
  position: [number, number, number];
  children: React.ReactNode;
  onSelect?: (sector: ArkSector) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const active = selected === sector;
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.(sector);
  };
  return (
    <group
      position={position}
      onClick={click}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'crosshair';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {children}
      {(active || hovered) && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.05, 0.018, 8, 64]} />
            <meshBasicMaterial
              color={active ? COLORS.amber : COLORS.cyan}
              transparent
              opacity={active ? 0.82 : 0.42}
            />
          </mesh>
          <pointLight
            color={active ? COLORS.amber : COLORS.cyan}
            intensity={active ? 7 : 3}
            distance={3.8}
          />
        </>
      )}
    </group>
  );
}

function HabitatRing({ x, phase }: { x: number; phase: number }) {
  const ring = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.x += delta * 0.055 * phase;
  });
  return (
    <group ref={ring} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <torusGeometry args={[2.1, 0.24, 12, 72]} />
        <meshStandardMaterial color="#454c47" metalness={0.9} roughness={0.37} />
      </mesh>
      <mesh>
        <torusGeometry args={[2.1, 0.255, 8, 24]} />
        <meshStandardMaterial color="#141a19" metalness={0.75} roughness={0.55} wireframe />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 2.1, Math.sin(angle) * 2.1, 0]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.38, 0.13, 0.56]} />
            <meshStandardMaterial
              color={i % 4 === 0 ? '#665a43' : '#28302d'}
              metalness={0.72}
              roughness={0.5}
            />
          </mesh>
        );
      })}
      <mesh>
        <cylinderGeometry args={[0.38, 0.38, 2.8, 12]} />
        <meshStandardMaterial color="#171d1c" metalness={0.88} roughness={0.32} />
      </mesh>
      {[0, Math.PI / 2].map((angle) => (
        <mesh key={angle} rotation={[0, 0, angle]}>
          <boxGeometry args={[4.15, 0.07, 0.08]} />
          <meshStandardMaterial color="#697069" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Truss({ start, length }: { start: number; length: number }) {
  const points = useMemo(() => {
    const lines: Array<[THREE.Vector3, THREE.Vector3]> = [];
    for (let i = 0; i <= length; i += 0.65) {
      lines.push([
        new THREE.Vector3(start + i, -0.42, -0.42),
        new THREE.Vector3(start + i + 0.42, 0.42, 0.42),
      ]);
      lines.push([
        new THREE.Vector3(start + i, 0.42, -0.42),
        new THREE.Vector3(start + i + 0.42, -0.42, 0.42),
      ]);
    }
    return lines;
  }, [length, start]);
  return (
    <group>
      {points.map((line, i) => (
        <Line key={i} points={line} color="#66706b" lineWidth={0.7} transparent opacity={0.72} />
      ))}
      {[-0.44, 0.44].flatMap((y) =>
        [-0.44, 0.44].map((z) => (
          <mesh
            key={`${y}-${z}`}
            position={[start + length / 2, y, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.035, 0.035, length, 6]} />
            <meshStandardMaterial color="#727870" metalness={0.9} roughness={0.34} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Engines() {
  return (
    <group position={[-6.1, 0, 0]}>
      <RoundedBox args={[1.8, 2.8, 2.8]} radius={0.16} smoothness={3}>
        <meshStandardMaterial color="#202725" metalness={0.92} roughness={0.42} />
      </RoundedBox>
      {[-0.72, 0, 0.72].flatMap((y) =>
        [-0.72, 0.72].map((z) => (
          <group key={`${y}-${z}`} position={[-1.05, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <mesh>
              <cylinderGeometry args={[0.38, 0.52, 0.65, 18]} />
              <meshStandardMaterial color="#151b1a" metalness={0.92} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.34, 0]}>
              <circleGeometry args={[0.29, 24]} />
              <meshBasicMaterial color="#a7ffff" />
            </mesh>
            <pointLight position={[0, -0.7, 0]} color="#5bc8d3" intensity={13} distance={5} />
          </group>
        )),
      )}
      {[-1.08, 1.08].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[2.3, 0.14, 3.2]} />
          <meshStandardMaterial color="#697068" metalness={0.95} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function CryoVault({ selected, onSelect }: Pick<SceneProps, 'selected' | 'onSelect'>) {
  return (
    <SectorNode sector="cryo" selected={selected} position={[0.55, -0.55, 0.7]} onSelect={onSelect}>
      <RoundedBox args={[3.1, 1.05, 0.52]} radius={0.12} smoothness={3}>
        <meshPhysicalMaterial
          color="#102122"
          metalness={0.55}
          roughness={0.22}
          transmission={0.18}
          transparent
          opacity={0.88}
        />
      </RoundedBox>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-1.25 + i * 0.31, 0, 0.3]}>
          <capsuleGeometry args={[0.09, 0.48, 4, 8]} />
          <meshStandardMaterial
            color="#6fb5b4"
            emissive="#376e70"
            emissiveIntensity={1.2}
            metalness={0.45}
            roughness={0.3}
          />
        </mesh>
      ))}
      <pointLight position={[0, 0, 1]} color={COLORS.cyan} intensity={5} distance={3} />
    </SectorNode>
  );
}

function Reactor({ selected, onSelect }: Pick<SceneProps, 'selected' | 'onSelect'>) {
  const core = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (core.current) core.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4) * 0.045);
  });
  return (
    <SectorNode
      sector="reactor"
      selected={selected}
      position={[-2.35, -0.35, 0.68]}
      onSelect={onSelect}
    >
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.78, 0.78, 1.05, 20]} />
        <meshStandardMaterial color="#24241e" metalness={0.88} roughness={0.38} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial
          color="#ffc171"
          emissive="#ff6a20"
          emissiveIntensity={4.8}
          roughness={0.22}
        />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[0, 0, (i / 6) * Math.PI * 2]}
          position={[
            Math.cos((i / 6) * Math.PI * 2) * 0.82,
            Math.sin((i / 6) * Math.PI * 2) * 0.82,
            0,
          ]}
        >
          <boxGeometry args={[0.46, 0.1, 0.12]} />
          <meshStandardMaterial color="#8c6943" metalness={0.85} roughness={0.32} />
        </mesh>
      ))}
      <pointLight color="#ff7b32" intensity={18} distance={5.5} />
    </SectorNode>
  );
}

function LifeSupport({ selected, onSelect }: Pick<SceneProps, 'selected' | 'onSelect'>) {
  return (
    <SectorNode sector="life" selected={selected} position={[3, -0.45, 0.65]} onSelect={onSelect}>
      <RoundedBox args={[2.25, 1.2, 0.58]} radius={0.15} smoothness={3}>
        <meshPhysicalMaterial
          color="#14231e"
          metalness={0.52}
          roughness={0.27}
          transmission={0.12}
          transparent
          opacity={0.9}
        />
      </RoundedBox>
      {[-0.7, 0, 0.7].map((x) => (
        <group key={x} position={[x, 0, 0.34]}>
          <mesh>
            <circleGeometry args={[0.29, 16]} />
            <meshStandardMaterial color="#6fa184" emissive="#234c3a" emissiveIntensity={1.7} />
          </mesh>
          <Line
            points={[
              [-0.2, -0.12, 0.01],
              [0, 0.2, 0.01],
              [0.2, -0.15, 0.01],
            ]}
            color="#b3d6b6"
            lineWidth={1}
          />
        </group>
      ))}
      <pointLight position={[0, 0, 1]} color={COLORS.green} intensity={4} distance={3} />
    </SectorNode>
  );
}

function Bridge({
  selected,
  navigation,
  onSelect,
}: Pick<SceneProps, 'selected' | 'navigation' | 'onSelect'>) {
  const dead = navigation === 0;
  const debris = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        p: [1.4 + (i % 4) * 0.22, -0.65 + (i % 3) * 0.3, -0.7 + (i % 5) * 0.28] as [
          number,
          number,
          number,
        ],
        r: [i * 0.7, i * 0.31, i * 0.13] as [number, number, number],
      })),
    [],
  );
  return (
    <SectorNode sector="bridge" selected={selected} position={[5.9, 0, 0]} onSelect={onSelect}>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[1.5, 3.15, 6]} />
        <meshStandardMaterial
          color={dead ? '#1e2020' : '#343b39'}
          metalness={0.93}
          roughness={0.32}
        />
      </mesh>
      <RoundedBox position={[-1.3, 0.75, 0]} args={[1.8, 0.8, 1.75]} radius={0.1} smoothness={2}>
        <meshStandardMaterial color="#202725" metalness={0.9} roughness={0.36} />
      </RoundedBox>
      {!dead && (
        <pointLight position={[0.3, 0.2, 1.4]} color={COLORS.cyan} intensity={6} distance={4} />
      )}
      {dead && (
        <>
          {debris.map((item, i) => (
            <mesh key={i} position={item.p} rotation={item.r}>
              <tetrahedronGeometry args={[0.08 + (i % 3) * 0.04]} />
              <meshStandardMaterial color="#202322" metalness={0.8} roughness={0.7} />
            </mesh>
          ))}
          <Line
            points={[
              [-0.9, 0.8, 1],
              [-0.2, 0.2, 1.05],
              [-0.55, -0.15, 1.02],
              [0.3, -0.6, 1.04],
            ]}
            color={COLORS.red}
            lineWidth={2}
          />
          <pointLight position={[0, 0, 1.2]} color={COLORS.red} intensity={9} distance={4} />
        </>
      )}
    </SectorNode>
  );
}

function Radiators() {
  return (
    <group>
      {[-1.2, 1.35].flatMap((x, xIndex) =>
        [-1, 1].map((direction) => (
          <group
            key={`${x}-${direction}`}
            position={[x, direction * 2.55, -0.25]}
            rotation={[0, xIndex ? -0.12 : 0.12, direction * 0.12]}
          >
            <mesh>
              <boxGeometry args={[2.4, 2.9, 0.055]} />
              <meshStandardMaterial color="#10191a" metalness={0.76} roughness={0.42} />
            </mesh>
            {[-0.75, 0, 0.75].map((ix) => (
              <Line
                key={ix}
                points={[
                  [ix, -1.4, 0.04],
                  [ix, 1.4, 0.04],
                ]}
                color="#41676a"
                lineWidth={0.5}
                transparent
                opacity={0.65}
              />
            ))}
            {[-0.9, -0.3, 0.3, 0.9].map((iy) => (
              <Line
                key={iy}
                points={[
                  [-1.18, iy, 0.04],
                  [1.18, iy, 0.04],
                ]}
                color="#41676a"
                lineWidth={0.5}
                transparent
                opacity={0.5}
              />
            ))}
          </group>
        )),
      )}
    </group>
  );
}

function ArkModel({ selected, navigation, onSelect, mini, systems }: SceneProps) {
  const ship = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ship.current) {
      ship.current.position.y = Math.sin(clock.elapsedTime * 0.42) * 0.08;
      ship.current.rotation.y = Math.sin(clock.elapsedTime * 0.23) * 0.025;
      ship.current.rotation.x = Math.sin(clock.elapsedTime * 0.17) * 0.035;
    }
  });
  return (
    <group ref={ship} scale={mini ? 0.78 : 1}>
      <PersistentMarks systems={systems} />
      <Truss start={-5.2} length={10.1} />
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.48, 0.48, 11.2, 16]} />
        <meshStandardMaterial color="#242b29" metalness={0.94} roughness={0.34} />
      </mesh>
      <Engines />
      <EnginePlumes />
      <Radiators />
      <HabitatRing x={-0.7} phase={1} />
      <HabitatRing x={1.1} phase={-1} />
      <CryoVault selected={selected} onSelect={onSelect} />
      <Reactor selected={selected} onSelect={onSelect} />
      <LifeSupport selected={selected} onSelect={onSelect} />
      <Bridge selected={selected} navigation={navigation} onSelect={onSelect} />
      {[-4.6, -3.75, 3.95, 4.6].map((x, i) => (
        <RoundedBox
          key={x}
          position={[x, 0.05, 0]}
          args={[0.68, 1.55 + (i % 2) * 0.35, 1.7]}
          radius={0.09}
          smoothness={2}
        >
          <meshStandardMaterial
            color={i === 2 ? '#3b3c34' : COLORS.hull}
            metalness={0.9}
            roughness={0.4}
          />
        </RoundedBox>
      ))}
      {Array.from({ length: 18 }).map((_, i) => (
        <mesh key={i} position={[-4.4 + i * 0.5, i % 2 ? 0.57 : -0.57, 0.86]}>
          <boxGeometry args={[0.18, 0.045, 0.04]} />
          <meshBasicMaterial color={i % 5 === 0 ? COLORS.red : '#d6b774'} />
        </mesh>
      ))}
    </group>
  );
}

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function planetTexture() {
  return canvasTexture(1024, 512, (ctx, width, height) => {
    const rand = seeded(41);
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#203335');
    base.addColorStop(0.3, '#2f4a45');
    base.addColorStop(0.48, '#5d5a43');
    base.addColorStop(0.6, '#33504b');
    base.addColorStop(1, '#142123');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = `rgba(${150 + rand() * 80}, ${145 + rand() * 75}, ${115 + rand() * 60}, ${0.025 + rand() * 0.07})`;
      ctx.beginPath();
      ctx.ellipse(
        rand() * width,
        rand() * height,
        90 + rand() * 460,
        2 + rand() * 14,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(226, 236, 230, ${0.04 + rand() * 0.11})`;
      ctx.beginPath();
      ctx.ellipse(
        rand() * width,
        rand() * height,
        18 + rand() * 120,
        3 + rand() * 13,
        (rand() - 0.5) * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const polar = ctx.createLinearGradient(0, 0, 0, height);
    polar.addColorStop(0, 'rgba(220,236,232,.65)');
    polar.addColorStop(0.1, 'rgba(220,236,232,0)');
    polar.addColorStop(0.9, 'rgba(220,236,232,0)');
    polar.addColorStop(1, 'rgba(220,236,232,.5)');
    ctx.fillStyle = polar;
    ctx.fillRect(0, 0, width, height);
  });
}

function nebulaTexture(seed: number, colors: string[]) {
  return canvasTexture(512, 512, (ctx, width, height) => {
    const rand = seeded(seed);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 54; i++) {
      const x = width * (0.18 + rand() * 0.64);
      const y = height * (0.22 + rand() * 0.56);
      const radius = width * (0.06 + rand() * 0.3);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colors[i % colors.length]);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  });
}

function glowTexture(inner: string, outer: string) {
  return canvasTexture(256, 256, (ctx, width) => {
    const gradient = ctx.createRadialGradient(
      width / 2,
      width / 2,
      0,
      width / 2,
      width / 2,
      width / 2,
    );
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.16, outer);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, width);
  });
}

function labelTexture(text: string, color: string) {
  return canvasTexture(512, 128, (ctx, width, height) => {
    ctx.fillStyle = color;
    ctx.font = '700 58px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
  });
}

function consoleTexture(
  selected: ArkSector,
  navigation: number,
  side: 'left' | 'right',
  resources?: Resources,
) {
  return canvasTexture(512, 320, (ctx, width, height) => {
    ctx.fillStyle = '#031012';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(118,198,197,.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.font = '600 24px monospace';
    ctx.fillStyle = '#76c6c5';
    ctx.fillText(side === 'left' ? 'ARK-001 / SYSTEM LINK' : 'SHIP RESOURCES', 24, 42);
    if (side === 'left') {
      ctx.fillStyle = '#df9d47';
      ctx.font = '700 46px monospace';
      ctx.fillText(selected.toUpperCase(), 24, 112);
      ctx.font = '500 21px monospace';
      ctx.fillStyle = navigation === 0 ? '#ef6c4e' : '#d8d3c5';
      ctx.fillText(navigation === 0 ? 'NAVIGATION OFFLINE' : `NAVIGATION ${navigation}%`, 24, 152);
      ctx.strokeStyle = navigation === 0 ? '#ef6c4e' : '#76c6c5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= width - 48; x += 6) {
        const y =
          240 +
          Math.sin(x * 0.045) * 34 * Math.cos(x * 0.011) +
          (navigation === 0 ? Math.sin(x * 0.9) * 10 : 0);
        if (x === 0) ctx.moveTo(24 + x, y);
        else ctx.lineTo(24 + x, y);
      }
      ctx.stroke();
      return;
    }
    const rows: Array<[string, number]> = [
      ['HULL', resources?.hull ?? 0],
      ['OXYGEN', resources?.oxygen ?? 0],
      ['POWER', resources?.power ?? 0],
      ['NAV', navigation],
      ['SUPPLY', resources?.supplies ?? 0],
    ];
    rows.forEach(([label, value], index) => {
      const y = 88 + index * 46;
      ctx.font = '500 19px monospace';
      ctx.fillStyle = '#9da7a2';
      ctx.fillText(label, 24, y);
      ctx.fillStyle = '#16302f';
      ctx.fillRect(150, y - 16, 300, 14);
      ctx.fillStyle = value === 0 ? '#ef6c4e' : value < 50 ? '#df9d47' : '#76c6c5';
      ctx.fillRect(150, y - 16, 3 * value, 14);
      ctx.fillStyle = '#d8d3c5';
      ctx.fillText(`${value}`, 462, y);
    });
  });
}

function EnginePlumes() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((child: THREE.Object3D, index: number) => {
      const flicker =
        1 +
        Math.sin(clock.elapsedTime * 19 + index * 1.7) * 0.08 +
        Math.sin(clock.elapsedTime * 7 + index) * 0.05;
      child.scale.set(1, flicker, 1);
    });
  });
  return (
    <group ref={group}>
      {[-0.72, 0, 0.72].flatMap((y) =>
        [-0.72, 0.72].map((z) => (
          <mesh key={`${y}-${z}`} position={[-8.6, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.3, 2.2, 18, 1, true]} />
            <meshBasicMaterial
              color="#7fe9ff"
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

function Planet() {
  const planet = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => planetTexture(), []);
  useFrame((_, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.005;
  });
  return (
    <group position={[-44, -34, -78]}>
      <mesh ref={planet} rotation={[0.22, 0, 0.16]}>
        <sphereGeometry args={[36, 96, 96]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} fog={false} />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[36, 64, 64]} />
        <meshBasicMaterial
          color="#6fd6d8"
          transparent
          opacity={0.13}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

function AsteroidBelt() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const belt = useRef<THREE.Group>(null);
  const count = 170;
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const rand = seeded(88);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 47 + rand() * 24;
      dummy.position.set(
        Math.cos(angle) * radius,
        (rand() - 0.5) * 5,
        Math.sin(angle) * radius * 0.42,
      );
      dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      dummy.scale.setScalar(0.2 + rand() * rand() * 2.5);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame((_, delta) => {
    if (belt.current) belt.current.rotation.y += delta * 0.006;
  });
  return (
    <group ref={belt} position={[-44, -31, -78]} rotation={[0.35, 0, 0.2]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#4b4741" roughness={0.96} metalness={0.08} flatShading />
      </instancedMesh>
    </group>
  );
}

function SpaceDust({ count, speed }: { count: number; speed: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = seeded(12);
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      data[i * 3] = (rand() - 0.5) * 70;
      data[i * 3 + 1] = (rand() - 0.5) * 30;
      data[i * 3 + 2] = (rand() - 0.5) * 46 - 4;
    }
    return data;
  }, [count]);
  useFrame((_, delta) => {
    const geometry = points.current?.geometry;
    if (!geometry) return;
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < count; i++) {
      array[i * 3] -= delta * speed * (0.6 + (i % 5) * 0.25);
      if (array[i * 3] < -35) array[i * 3] = 35;
    }
    attribute.needsUpdate = true;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#bfe7e4"
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}

function SpeedStreaks({ speed }: { speed: number }) {
  const count = 70;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const streaks = useMemo(() => {
    const rand = seeded(5);
    return Array.from({ length: count }, () => ({
      x: (rand() - 0.5) * 80,
      y: (rand() - 0.5) * 26,
      z: (rand() - 0.5) * 40 - 6,
      velocity: 6 + rand() * 10,
      length: 0.8 + rand() * 2.4,
    }));
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, delta) => {
    const instance = mesh.current;
    if (!instance) return;
    streaks.forEach((streak, index) => {
      streak.x -= delta * streak.velocity * speed;
      if (streak.x < -40) streak.x = 40;
      dummy.position.set(streak.x, streak.y, streak.z);
      dummy.scale.set(streak.length * (speed > 1.5 ? 2.6 : 1), 1, 1);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
    });
    instance.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 0.012, 0.012]} />
      <meshBasicMaterial
        color="#8fd6d6"
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function DeepSpace({ mini }: { mini?: boolean }) {
  const nebulae = useMemo(
    () => [
      {
        texture: nebulaTexture(7, [
          'rgba(52,128,136,.12)',
          'rgba(26,62,82,.13)',
          'rgba(120,160,150,.05)',
        ]),
        position: [-34, 20, -130] as [number, number, number],
        scale: 190,
        rotation: 0.3,
      },
      {
        texture: nebulaTexture(19, [
          'rgba(176,92,48,.1)',
          'rgba(110,40,30,.09)',
          'rgba(220,160,90,.045)',
        ]),
        position: [62, -8, -140] as [number, number, number],
        scale: 170,
        rotation: -0.5,
      },
      {
        texture: nebulaTexture(33, ['rgba(80,60,110,.08)', 'rgba(40,90,110,.08)']),
        position: [12, 46, -150] as [number, number, number],
        scale: 210,
        rotation: 1.1,
      },
    ],
    [],
  );
  const sun = useMemo(() => glowTexture('rgba(255,246,226,1)', 'rgba(255,170,90,.38)'), []);
  return (
    <group>
      <Stars
        radius={mini ? 70 : 160}
        depth={mini ? 30 : 90}
        count={mini ? 1200 : 6000}
        factor={mini ? 2.4 : 4.4}
        saturation={0.25}
        fade
        speed={0.35}
      />
      {nebulae.map((nebula, index) => (
        <mesh
          key={index}
          position={nebula.position}
          rotation={[0, 0, nebula.rotation]}
          scale={nebula.scale}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={nebula.texture}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
          />
        </mesh>
      ))}
      {!mini && (
        <>
          <Billboard position={[74, 32, -132]}>
            <mesh scale={64}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={sun}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                fog={false}
                toneMapped={false}
              />
            </mesh>
          </Billboard>
          <directionalLight position={[74, 32, -132]} intensity={2.6} color="#ffc38a" />
          <Planet />
          <AsteroidBelt />
        </>
      )}
    </group>
  );
}

const cockpitControls: Array<{ sector: ArkSector; label: string; color: string }> = [
  { sector: 'reactor', label: 'REACTOR', color: '#df9d47' },
  { sector: 'cryo', label: 'CRYO', color: '#76c6c5' },
  { sector: 'life', label: 'LIFE', color: '#6ca889' },
  { sector: 'bridge', label: 'NAV', color: '#d5533e' },
];

function CockpitInterior({
  selected,
  navigation,
  onSelect,
  burn,
  onBurn,
  resources,
}: Pick<SceneProps, 'selected' | 'navigation' | 'onSelect' | 'resources'> & {
  burn: boolean;
  onBurn: () => void;
}) {
  const { camera, scene, size } = useThree();
  const holo = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    scene.add(camera);
    return () => {
      scene.remove(camera);
    };
  }, [camera, scene]);
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    target.set(
      state.pointer.x * 1.5,
      1.25 + state.pointer.y * 0.75 + Math.sin(t * 0.9) * 0.035,
      21,
    );
    camera.position.lerp(target, Math.min(1, delta * 2.6));
    camera.lookAt(1.1 + state.pointer.x * 0.7, state.pointer.y * 0.45, 0);
    if (holo.current) holo.current.rotation.y = t * 0.7;
    if (lever.current)
      lever.current.rotation.x = THREE.MathUtils.lerp(
        lever.current.rotation.x,
        burn ? -0.75 : 0.25,
        Math.min(1, delta * 5),
      );
  });
  const aspect = size.width / Math.max(1, size.height);
  const fov = aspect < 0.9 ? 62 : 50;
  const depth = 1.2;
  const h = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * depth;
  const w = h * aspect;
  const left = useMemo(
    () => consoleTexture(selected, navigation, 'left', resources),
    [selected, navigation, resources],
  );
  const right = useMemo(
    () => consoleTexture(selected, navigation, 'right', resources),
    [selected, navigation, resources],
  );
  const labels = useMemo(
    () => cockpitControls.map((control) => labelTexture(control.label, '#eef5f1')),
    [],
  );
  useEffect(
    () => () => {
      left.dispose();
      right.dispose();
    },
    [left, right],
  );
  const metal = <meshStandardMaterial color="#161d1d" metalness={0.86} roughness={0.36} />;
  const pointer = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = 'default';
    },
  };
  return createPortal(
    <group position={[0, 0, -depth]}>
      <pointLight position={[0, -h * 0.35, 0.45]} intensity={1.4} distance={2.4} color="#df9d47" />
      <pointLight position={[0, -h * 0.5, 0.3]} intensity={1.1} distance={2} color="#76c6c5" />
      <mesh position={[0, h * 0.98, 0.02]}>
        <boxGeometry args={[w * 2.6, h * 0.26, 0.14]} />
        {metal}
      </mesh>
      <mesh position={[0, h * 0.84, 0.06]}>
        <boxGeometry args={[w * 1.5, h * 0.008, 0.01]} />
        <meshBasicMaterial color="#76c6c5" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * w * 0.93, -h * 0.05, 0.03]} rotation={[0, 0, side * 0.3]}>
            <boxGeometry args={[w * 0.13, h * 2.5, 0.16]} />
            {metal}
          </mesh>
          <mesh position={[side * w * 0.845, -h * 0.02, 0.11]} rotation={[0, 0, side * 0.3]}>
            <boxGeometry args={[w * 0.006, h * 2.2, 0.01]} />
            <meshBasicMaterial color="#df9d47" transparent opacity={0.42} toneMapped={false} />
          </mesh>
          <mesh position={[side * w * 0.74, h * 0.76, 0.04]} rotation={[0, 0, side * -0.72]}>
            <boxGeometry args={[w * 0.5, h * 0.11, 0.12]} />
            {metal}
          </mesh>
        </group>
      ))}
      <group position={[0, h * 0.08, -0.04]}>
        <mesh>
          <ringGeometry args={[h * 0.055, h * 0.06, 48]} />
          <meshBasicMaterial color="#76c6c5" transparent opacity={0.5} toneMapped={false} />
        </mesh>
        {[-2, -1, 1, 2].map((i) => (
          <mesh key={i} position={[0, i * h * 0.12, 0]}>
            <planeGeometry args={[w * (Math.abs(i) === 1 ? 0.16 : 0.24), h * 0.004]} />
            <meshBasicMaterial color="#76c6c5" transparent opacity={0.3} toneMapped={false} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * w * 0.3, 0, 0]}>
            <planeGeometry args={[w * 0.004, h * 0.5]} />
            <meshBasicMaterial color="#76c6c5" transparent opacity={0.25} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * w * 0.66, -h * 0.56, 0.12]}
          rotation={[-0.42, side * -0.38, 0]}
        >
          <mesh>
            <boxGeometry args={[w * 0.5, h * 0.34, 0.03]} />
            <meshStandardMaterial color="#0b1112" metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.017]}>
            <planeGeometry args={[w * 0.46, h * 0.3]} />
            <meshBasicMaterial map={side < 0 ? left : right} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group position={[0, -h * 0.62, 0.14]}>
        <group ref={holo}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[h * 0.075, h * 0.0035, 8, 48]} />
            <meshBasicMaterial color="#76c6c5" transparent opacity={0.8} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[h * 0.05, h * 0.0025, 8, 40]} />
            <meshBasicMaterial color="#df9d47" transparent opacity={0.8} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[h * 0.008, h * 0.008, h * 0.2, 8]} />
            <meshBasicMaterial color="#d8d3c5" toneMapped={false} />
          </mesh>
        </group>
        <mesh position={[0, -h * 0.03, 0]}>
          <cylinderGeometry args={[h * 0.04, h * 0.055, h * 0.02, 24]} />
          <meshStandardMaterial color="#1a2222" metalness={0.9} roughness={0.3} />
        </mesh>
        <pointLight color="#76c6c5" intensity={0.8} distance={0.8} />
      </group>
      <group position={[0, -h * 0.9, 0.16]} rotation={[-1.02, 0, 0]}>
        <mesh>
          <boxGeometry args={[w * 2.4, h * 0.95, 0.05]} />
          <meshStandardMaterial color="#0d1415" metalness={0.8} roughness={0.42} />
        </mesh>
        <mesh position={[0, h * 0.47, 0.03]}>
          <boxGeometry args={[w * 2.4, h * 0.02, 0.02]} />
          <meshBasicMaterial color="#76c6c5" transparent opacity={0.45} toneMapped={false} />
        </mesh>
        {cockpitControls.map((control, index) => {
          const active = selected === control.sector;
          return (
            <group key={control.sector} position={[(-0.39 + index * 0.26) * w, h * 0.12, 0.04]}>
              <RoundedBox
                args={[w * 0.22, h * 0.12, 0.035]}
                radius={0.008}
                smoothness={2}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect?.(control.sector);
                }}
                {...pointer}
              >
                <meshStandardMaterial
                  color={active ? control.color : '#12282a'}
                  emissive={control.color}
                  emissiveIntensity={active ? 2.2 : 0.35}
                  metalness={0.6}
                  roughness={0.3}
                />
              </RoundedBox>
              <mesh position={[0, 0, 0.02]}>
                <planeGeometry args={[w * 0.2, h * 0.05]} />
                <meshBasicMaterial map={labels[index]} transparent toneMapped={false} />
              </mesh>
            </group>
          );
        })}
        <group position={[w * 0.72, h * 0.02, 0.05]}>
          <mesh>
            <boxGeometry args={[w * 0.1, h * 0.3, 0.02]} />
            <meshStandardMaterial color="#111919" metalness={0.9} roughness={0.3} />
          </mesh>
          <group ref={lever} rotation={[0.25, 0, 0]}>
            <mesh
              position={[0, 0, h * 0.09]}
              onClick={(event) => {
                event.stopPropagation();
                onBurn();
              }}
              {...pointer}
            >
              <boxGeometry args={[w * 0.05, w * 0.05, h * 0.18]} />
              <meshStandardMaterial
                color={burn ? '#df9d47' : '#3a4241'}
                emissive="#df9d47"
                emissiveIntensity={burn ? 1.8 : 0.15}
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          </group>
        </group>
      </group>
    </group>,
    camera,
  );
}

function ResponsiveCamera({ mini, view }: { mini?: boolean; view?: 'exterior' | 'cockpit' }) {
  const { camera, gl, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const lens = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    if (view === 'cockpit' && !mini) {
      lens.fov = aspect < 0.9 ? 62 : 50;
      lens.clearViewOffset();
      camera.position.set(0, 1.25, 21);
      camera.lookAt(1.1, 0, 0);
      camera.updateProjectionMatrix();
      return;
    }
    // A page can reserve a left share of the canvas for overlaid copy with --ark-frame-left. The ship is framed
    // in the remaining area through a lens shift, so the scene itself still fills the whole canvas.
    const reserved = THREE.MathUtils.clamp(
      parseFloat(getComputedStyle(gl.domElement).getPropertyValue('--ark-frame-left')) || 0,
      0,
      0.5,
    );
    const frameAspect = aspect * (1 - reserved);
    lens.fov = mini ? 30 : frameAspect < 0.9 ? 42 : 36;
    const tangent = Math.tan(THREE.MathUtils.degToRad(lens.fov / 2));
    const distance = Math.max(4.7 / tangent, 8.8 / (tangent * frameAspect)) * (mini ? 1.02 : 1.12);
    if (reserved)
      lens.setViewOffset(
        size.width,
        size.height,
        (-size.width * reserved) / 2,
        0,
        size.width,
        size.height,
      );
    else lens.clearViewOffset();
    camera.position.copy(new THREE.Vector3(0.34, 0.24, 1).normalize().multiplyScalar(distance));
    camera.lookAt(-0.6, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, gl, mini, size.width, size.height, view]);
  return null;
}

function PersistentMarks({ systems }: { systems?: SystemPresentation[] }) {
  const positions: Record<string, [number, number, number]> = {
    hull: [0, 0.65, 0.95],
    navigation: [5.2, 0.8, 0.5],
    lifeSupport: [1.7, 1.15, 0.75],
    shields: [-0.5, 1.8, 0],
    cargo: [3.7, -0.5, 0.9],
    habitat: [-2.7, 1.2, 0.5],
    reactor: [-1.8, 0, 1.2],
  };
  return (
    <group>
      {systems
        ?.filter((system) => system.marks.length)
        .map((system) => (
          <group key={system.id} position={positions[system.id]}>
            {system.marks.slice(-3).map((mark, index) => (
              <mesh key={mark.eventId + index} position={[index * 0.17, 0, 0.02 * index]}>
                <boxGeometry args={[0.07, 0.28, 0.06]} />
                <meshStandardMaterial
                  color={mark.kind === 'repair' ? conditionColor(system) : '#d5533e'}
                  emissive={mark.kind === 'repair' ? conditionColor(system) : '#d5533e'}
                  emissiveIntensity={0.9}
                  roughness={0.8}
                />
              </mesh>
            ))}
          </group>
        ))}
    </group>
  );
}

function Scene({
  selected,
  navigation,
  onSelect,
  mini,
  view = 'exterior',
  labelPortal,
  resources,
  systems,
  reducedMotion,
  readOnly,
}: SceneProps) {
  const [burn, setBurn] = useState(false);
  const cockpit = !mini && view === 'cockpit';
  return (
    <>
      <FrameBudget reducedMotion={reducedMotion} mini={mini} />
      <ResponsiveCamera mini={mini} view={view} />
      <color attach="background" args={['#020506']} />
      <fog attach="fog" args={['#020506', 45, 240]} />
      <ambientLight intensity={0.62} color="#a9bbb6" />
      <directionalLight position={[4, 9, 8]} intensity={4.4} color="#e0e7dc" />
      <directionalLight position={[-8, -4, 5]} intensity={2.6} color="#5ca5aa" />
      <spotLight position={[8, 7, 5]} angle={0.42} penumbra={0.8} intensity={15} color="#d2a25c" />
      <DeepSpace mini={mini} />
      <SpaceDust count={mini ? 220 : 900} speed={burn ? 9 : 2.6} />
      {!mini && <SpeedStreaks speed={burn ? 3.2 : 1} />}
      <ArkModel
        selected={selected}
        navigation={navigation}
        onSelect={onSelect}
        mini={mini}
        systems={systems}
      />
      {cockpit && (
        <CockpitInterior
          resources={resources}
          selected={selected}
          navigation={navigation}
          onSelect={onSelect}
          burn={burn}
          onBurn={() => setBurn((value) => !value)}
        />
      )}
      {!mini && view === 'exterior' && (
        <>
          <Html
            portal={labelPortal}
            position={[-5.6, -2.45, 0]}
            transform
            distanceFactor={12}
            className="three-ship-id"
            wrapperClass="ark-label-layer"
          >
            <span>GENERATION VESSEL</span>
            <strong>ARK—001</strong>
            <small>KEEL 1,842m / {resources?.passengers ?? 216} SOULS</small>
          </Html>
          <OrbitControls
            makeDefault
            enablePan={false}
            enableZoom
            minDistance={9}
            maxDistance={60}
            minPolarAngle={Math.PI * 0.25}
            maxPolarAngle={Math.PI * 0.75}
            autoRotate={!reducedMotion && !readOnly}
            autoRotateSpeed={0.22}
            dampingFactor={0.06}
            target={[-0.6, 0, 0]}
          />
        </>
      )}
    </>
  );
}

function Ark3DComponent({
  selected,
  navigation,
  mini = false,
  onSelect,
  view = 'exterior',
  resources,
  systems,
  reducedMotion,
  readOnly,
}: SceneProps) {
  const labelPortal = useRef<HTMLDivElement>(null!);
  return (
    <div className={`ark-canvas ark-canvas--${view} ${mini ? 'ark-canvas--mini' : ''}`}>
      <div ref={labelPortal} className="ark-label-portal" />
      <Canvas
        frameloop="never"
        dpr={mini ? [1, 1.25] : [1, 1.5]}
        camera={{ position: [7, 4, 20], fov: 36, near: 0.05, far: 700 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
        }}
        fallback={<div className="ark-canvas-fallback">3D SHIP TELEMETRY UNAVAILABLE</div>}
      >
        <Scene
          labelPortal={labelPortal}
          resources={resources}
          systems={systems}
          reducedMotion={reducedMotion}
          readOnly={readOnly}
          selected={selected}
          navigation={navigation}
          mini={mini}
          onSelect={onSelect}
          view={view}
        />
      </Canvas>
      {!mini && (
        <div className="ark-canvas-help">
          <span>{view === 'exterior' ? 'DRAG TO ORBIT' : 'COCKPIT VIEW'}</span>
          <span>
            {view === 'exterior'
              ? 'SCROLL TO INSPECT'
              : 'CLICK CONSOLE / MOVE POINTER TO LOOK / LEVER = BURN'}
          </span>
          <b>{resources ? 'SAVED ARK / LIVE 3D' : 'UNLAUNCHED VESSEL / LIVE 3D'}</b>
        </div>
      )}
    </div>
  );
}

export const Ark3D = memo(Ark3DComponent);
