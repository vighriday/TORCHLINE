import * as T from 'three';
import type { Resources, ShipSystem, SystemId } from '@torchline/contracts';
import { markSeed } from './visual-state.ts';

export const ARK_ANCHORS: Record<SystemId, [number, number, number]> = {
  hull: [0, 1, 1],
  reactor: [-10, 0, 0],
  habitat: [1, 4.8, 0],
  lifeSupport: [-3.6, 2.3, 0],
  cargo: [5, -2, 0],
  navigation: [11, 2, 0],
  shields: [0, 5.8, 0],
};
export function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,.8)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
export const fresnelVertex =
  'varying vec3 n; varying vec3 v; void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}';
export const fresnelFragment =
  'uniform vec3 color; uniform float strength; varying vec3 n; varying vec3 v; void main(){float f=pow(1.-abs(dot(n,v)),2.5)*strength;gl_FragColor=vec4(color*f,f);}';
export function disposeObjects(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  root.traverse((object) => {
    if (
      object instanceof T.Mesh ||
      object instanceof T.Points ||
      object instanceof T.Line ||
      object instanceof T.Sprite
    ) {
      if ('geometry' in object) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof T.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
/** Claude Design's modular vessel, adapted to canonical condition/marks rather than prototype scars. */
export function buildArk(glow: T.Texture) {
  const ship = new T.Group();
  const groups = {} as Record<SystemId, T.Group>;
  for (const id of Object.keys(ARK_ANCHORS) as SystemId[]) {
    groups[id] = new T.Group();
    groups[id].name = id;
    ship.add(groups[id]);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#626773';
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 240; i++) {
    const v = 85 + Math.floor(markSeed(`plate:${i}`) * 60);
    ctx.fillStyle = `rgb(${v},${v + 4},${v + 9})`;
    ctx.fillRect(markSeed(`x${i}`) * 512, markSeed(`y${i}`) * 256, 8 + markSeed(`s${i}`) * 55, 18);
  }
  ctx.strokeStyle = '#292c33';
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  const panels = new T.CanvasTexture(canvas);
  panels.colorSpace = T.SRGBColorSpace;
  panels.wrapS = panels.wrapT = T.RepeatWrapping;
  panels.repeat.set(4, 1);
  const metal = new T.MeshStandardMaterial({
    color: 0xb5b4b2,
    map: panels,
    metalness: 0.72,
    roughness: 0.42,
  });
  const dark = new T.MeshStandardMaterial({ color: 0x252b32, metalness: 0.65, roughness: 0.5 });
  const trim = new T.MeshStandardMaterial({ color: 0xd3c4a6, metalness: 0.85, roughness: 0.3 });
  const ice = new T.MeshBasicMaterial({ color: 0xffe0ac });
  const sealed = new T.MeshStandardMaterial({ color: 0x242b33, metalness: 0.7, roughness: 0.7 });
  function mesh(
    id: SystemId,
    g: T.BufferGeometry,
    m: T.Material = metal,
    p: [number, number, number] = [0, 0, 0],
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(...p);
    groups[id].add(o);
    return o;
  }
  function axial(radius: number, length: number) {
    const geometry = new T.CylinderGeometry(radius, radius, length, 24);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }
  function sprite(color: number, size: number) {
    const object = new T.Sprite(
      new T.SpriteMaterial({
        map: glow,
        color,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
    );
    object.scale.set(size, size, 1);
    return object;
  }
  mesh('hull', axial(0.9, 18));
  for (let x = -7.6; x < 8; x += 1.4) {
    const o = mesh('hull', new T.TorusGeometry(0.98, 0.07, 6, 24), trim, [x, 0, 0]);
    o.rotation.y = Math.PI / 2;
  }
  const plates = new T.InstancedMesh(new T.BoxGeometry(1.15, 0.3, 0.95), metal, 48);
  groups.hull.add(plates);
  const matrix = new T.Object3D();
  const bow = mesh('hull', new T.ConeGeometry(0.9, 2.6, 24), metal, [10.3, 0, 0]);
  bow.rotation.z = -Math.PI / 2;
  mesh('hull', new T.BoxGeometry(2, 0.8, 1.3), dark, [6.6, 1.2, 0]);
  mesh('hull', new T.BoxGeometry(1.6, 0.12, 1.32), ice, [6.7, 1.45, 0]);
  groups.reactor.position.x = -9.8;
  mesh('reactor', new T.SphereGeometry(1.95, 24, 16), dark);
  const reactorRings = [
    mesh('reactor', new T.TorusGeometry(2.25, 0.14, 8, 40), trim),
    mesh('reactor', new T.TorusGeometry(2.25, 0.06, 6, 40), trim),
  ];
  reactorRings[0].rotation.y = Math.PI / 2;
  const core = mesh(
    'reactor',
    new T.SphereGeometry(0.85, 20, 14),
    new T.MeshBasicMaterial({ color: 0xffd6a0 }),
    [0, 0, 1.45],
  );
  const coreGlow = sprite(0xff9b45, 8);
  coreGlow.position.z = 1.5;
  groups.reactor.add(coreGlow);
  const nozzle = mesh(
    'reactor',
    new T.CylinderGeometry(1, 1.8, 2.4, 24, 1, true),
    new T.MeshStandardMaterial({
      color: 0x292e36,
      metalness: 0.75,
      roughness: 0.4,
      side: T.DoubleSide,
    }),
    [-2.4, 0, 0],
  );
  nozzle.rotation.z = -Math.PI / 2;
  const plume = sprite(0xff953d, 1);
  plume.position.x = -6.5;
  plume.scale.set(12, 3.4, 1);
  groups.reactor.add(plume);
  const plumeCore = sprite(0xffe9bb, 1);
  plumeCore.position.x = -4.3;
  plumeCore.scale.set(5, 1.5, 1);
  groups.reactor.add(plumeCore);
  groups.habitat.position.x = 1;
  const ring = new T.Group();
  groups.habitat.add(ring);
  const torus = new T.Mesh(new T.TorusGeometry(4.7, 0.55, 14, 96), metal);
  torus.rotation.y = Math.PI / 2;
  ring.add(torus);
  const seams = new T.Mesh(
    new T.TorusGeometry(4.7, 0.62, 5, 96),
    new T.MeshStandardMaterial({
      color: 0x1c212a,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    }),
  );
  seams.rotation.y = Math.PI / 2;
  ring.add(seams);
  for (let i = 0; i < 4; i++) {
    const spoke = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 9.4, 8), trim);
    spoke.rotation.x = (i * Math.PI) / 4;
    ring.add(spoke);
  }
  ring.add(new T.Mesh(new T.SphereGeometry(1.25, 16, 12), dark));
  const windows = new T.InstancedMesh(new T.BoxGeometry(0.09, 0.13, 0.09), ice, 216);
  ring.add(windows);
  const seal = new T.Mesh(new T.TorusGeometry(4.7, 0.64, 8, 40, Math.PI * 0.65), sealed);
  seal.rotation.y = Math.PI / 2;
  seal.visible = false;
  ring.add(seal);
  groups.lifeSupport.position.set(-3.6, 1.6, 0);
  const tankMaterial = new T.MeshStandardMaterial({
    color: 0xb0c3c9,
    metalness: 0.4,
    roughness: 0.25,
    emissive: 0x8fdce4,
    emissiveIntensity: 0.2,
  });
  for (const z of [-0.95, 0, 0.95]) {
    const tank = mesh('lifeSupport', new T.CapsuleGeometry(0.42, 2.8, 6, 16), tankMaterial, [
      0,
      0,
      z,
    ]);
    tank.rotation.z = Math.PI / 2;
    for (const x of [-1.1, 0, 1.1]) {
      const band = mesh('lifeSupport', new T.TorusGeometry(0.45, 0.05, 6, 16), trim, [x, 0, z]);
      band.rotation.y = Math.PI / 2;
    }
  }
  groups.cargo.position.set(5.3, -1.75, 0);
  const pods: T.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const pod = mesh(
      'cargo',
      new T.BoxGeometry(0.95, 1.2, 1.5),
      new T.MeshStandardMaterial({
        color: [0x8a6a44, 0x6b7480, 0x7d5c3a][i % 3],
        map: panels,
        metalness: 0.5,
        roughness: 0.55,
      }),
      [-2.6 + i * 1.05, 0, 0],
    );
    pods.push(pod);
  }
  groups.navigation.position.set(10.9, 0, 0);
  const mast = mesh('navigation', axial(0.08, 4.2), trim, [1.9, 0, 0]);
  const dishGroup = new T.Group();
  dishGroup.position.set(0.2, 1.8, 0);
  groups.navigation.add(dishGroup);
  const strut = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 1.6, 8), trim);
  strut.position.y = -0.8;
  dishGroup.add(strut);
  const dishMaterial = new T.MeshStandardMaterial({
    color: 0xd8d2c4,
    metalness: 0.5,
    roughness: 0.35,
    side: T.DoubleSide,
  });
  const dish = new T.Mesh(
    new T.SphereGeometry(1.2, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.3),
    dishMaterial,
  );
  dish.rotation.z = -Math.PI / 2;
  dishGroup.add(dish);
  const navLight = sprite(0x8fdce4, 1.1);
  navLight.position.x = 4.1;
  groups.navigation.add(navLight);
  const shieldMaterial = new T.ShaderMaterial({
    vertexShader: fresnelVertex,
    fragmentShader: fresnelFragment,
    uniforms: { color: { value: new T.Color(0x8fdce4) }, strength: { value: 0.45 } },
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const shell = mesh('shields', new T.SphereGeometry(1, 40, 24), shieldMaterial);
  shell.scale.set(15.5, 7, 7);
  const wire = mesh(
    'shields',
    new T.IcosahedronGeometry(1, 3),
    new T.MeshBasicMaterial({
      color: 0x8fdce4,
      wireframe: true,
      transparent: true,
      opacity: 0.035,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  wire.scale.copy(shell.scale);
  const scars = new T.Group();
  ship.add(scars);
  let scarKey = '',
    power = 0.6,
    wreck = false,
    leaking = false,
    cargoLost = false;
  function update(systems: ShipSystem[], r: Resources) {
    const by = Object.fromEntries(systems.map((s) => [s.id, s])) as Record<SystemId, ShipSystem>;
    wreck = r.hull === 0;
    power = r.power / 100;
    leaking = by.lifeSupport.condition === 'damaged';
    cargoLost = by.cargo.marks.some((m) => m.kind === 'jettison');
    for (let i = 0; i < 48; i++) {
      const row = Math.floor(i / 12),
        a = (row * Math.PI) / 2 + Math.PI / 4;
      matrix.position.set(-6.9 + (i % 12) * 1.25, Math.cos(a) * 0.98, Math.sin(a) * 0.98);
      matrix.rotation.set(a, 0, 0);
      matrix.scale.setScalar((i * 17) % 48 < Math.round(r.hull * 0.48) ? 1 : 0.0001);
      matrix.updateMatrix();
      plates.setMatrixAt(i, matrix.matrix);
    }
    plates.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 216; i++) {
      const a = (i / 216) * Math.PI * 2;
      matrix.position.set(0.56 * (i % 2 ? 1 : -1), Math.cos(a) * 5.28, Math.sin(a) * 5.28);
      matrix.rotation.set(a, 0, 0);
      matrix.scale.setScalar(i < r.passengers ? 1 : 0.0001);
      matrix.updateMatrix();
      windows.setMatrixAt(i, matrix.matrix);
    }
    windows.instanceMatrix.needsUpdate = true;
    seal.visible = by.habitat.condition === 'sealed';
    const navLost = by.navigation.condition === 'destroyed';
    dishMaterial.color.set(navLost ? 0x27211e : 0xd8d2c4);
    dishGroup.rotation.z = navLost ? -0.7 : 0;
    dishGroup.position.y = navLost ? 1.1 : 1.8;
    mast.scale.x = navLost ? 0.45 : 1;
    navLight.visible = !navLost;
    shieldMaterial.uniforms.strength.value =
      by.shields.condition === 'destroyed' ? 0 : by.shields.condition === 'repaired' ? 0.5 : 0.22;
    shell.visible = wire.visible = by.shields.condition !== 'destroyed';
    tankMaterial.emissive.set(leaking ? 0xb63a29 : 0x8fdce4);
    tankMaterial.emissiveIntensity = 0.08 + (r.oxygen / 100) * 0.3;
    pods.forEach((pod, i) => {
      pod.position.set(
        -2.6 + i * 1.05,
        cargoLost && i > 1 ? -1 - (i - 1) * 0.55 : 0,
        cargoLost && i > 1 ? (i % 2 ? 1 : -1) * 2 : 0,
      );
      pod.rotation.set(0, 0, cargoLost && i > 1 ? i * 0.4 : 0);
      pod.visible = !wreck || i < 3;
    });
    const key = JSON.stringify(systems.map((s) => [s.id, s.marks]));
    if (key !== scarKey) {
      scarKey = key;
      disposeObjects(scars);
      scars.clear();
      for (const s of systems)
        for (const mark of s.marks.slice(-8)) {
          const [x, y, z] = ARK_ANCHORS[s.id];
          const scar = new T.Mesh(
            new T.BoxGeometry(0.1, mark.kind === 'damage' ? 1.3 : 0.8, 0.1),
            new T.MeshBasicMaterial({ color: mark.kind === 'repair' ? 0x8fdce4 : 0xd65b34 }),
          );
          scar.position.set(
            x + (markSeed(mark.eventId) - 0.5) * (s.id === 'hull' ? 14 : 2),
            y + (markSeed(mark.eventId + 'y') - 0.5),
            z + 0.5,
          );
          scar.rotation.z = 0.4 + markSeed(mark.eventId);
          scars.add(scar);
        }
    }
    groups.reactor.position.set(wreck ? -11.5 : -9.8, wreck ? -1.2 : 0, 0);
    groups.reactor.rotation.z = wreck ? -0.2 : 0;
    groups.habitat.rotation.z = wreck ? 0.15 : 0;
  }
  function animate(t: number, dt: number) {
    ring.rotation.x += dt * 0.2 * (wreck ? 0.08 : 1);
    reactorRings[0].rotation.x += dt * 0.6;
    reactorRings[1].rotation.z += dt * 0.3;
    const k = wreck ? 0.03 : 0.3 + 0.7 * power;
    coreGlow.material.opacity = k;
    plume.material.opacity = plumeCore.material.opacity = wreck
      ? 0
      : 0.35 + 0.45 * power + 0.035 * Math.sin(t * 8);
    plume.scale.x = 8 + 6 * power;
    core.scale.setScalar(0.9 + 0.04 * Math.sin(t * 2));
    if (cargoLost)
      pods.forEach((pod, i) => {
        if (i > 1) pod.rotation.y += dt * 0.08;
      });
  }
  return {
    ship,
    update,
    animate,
    get leaking() {
      return leaking;
    },
    get wreck() {
      return wreck;
    },
    position(id: SystemId) {
      const v = new T.Vector3(...ARK_ANCHORS[id]);
      ship.localToWorld(v);
      return v;
    },
  };
}
