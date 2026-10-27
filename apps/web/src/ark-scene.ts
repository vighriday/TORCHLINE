import * as THREE from 'three';
import type { Resources, ShipSystem, SystemId } from '@torchline/contracts';
import { conditionColor, markSeed } from './visual-state.ts';

// Cosmetic renderer only. No commands, timers, network, or gameplay transitions.
export function createArkScene(
  container: HTMLElement,
  onContextLost: () => void,
  onReady: () => void,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'default',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x07080b, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 160);
  camera.position.set(24, 15, 33);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xcde8ff, 0x282131, 2.3));
  const sun = new THREE.DirectionalLight(0xffdbaf, 3.5);
  sun.position.set(-8, 12, 15);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x69b9e5, 3);
  rim.position.set(10, -5, -10);
  scene.add(rim);
  const ship = new THREE.Group();
  scene.add(ship);
  const groups = {} as Record<SystemId, THREE.Group>;
  const materials = {} as Record<SystemId, THREE.MeshStandardMaterial>;
  const ids: SystemId[] = [
    'hull',
    'reactor',
    'habitat',
    'lifeSupport',
    'cargo',
    'navigation',
    'shields',
  ];
  for (const id of ids) {
    const group = new THREE.Group();
    ship.add(group);
    groups[id] = group;
    materials[id] = new THREE.MeshStandardMaterial({
      color: 0x71818c,
      metalness: 0.65,
      roughness: 0.48,
    });
  }
  const mesh = (
    id: SystemId,
    geometry: THREE.BufferGeometry,
    position: [number, number, number],
    material: THREE.Material = materials[id],
  ) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    groups[id].add(object);
    return object;
  };
  const cylinder = (radius: number, length: number, segments = 16) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  };
  mesh('hull', cylinder(0.8, 19), [0, 0, 0]);
  for (let x = -8; x <= 8; x += 2) mesh('hull', cylinder(0.9, 0.13), [x, 0, 0]);
  const bow = mesh('hull', new THREE.ConeGeometry(0.85, 3, 8), [10.5, 0, 0]);
  bow.rotation.z = -Math.PI / 2;
  mesh('hull', new THREE.BoxGeometry(2, 0.6, 1.1), [8, 0.8, 0]);
  mesh('reactor', new THREE.SphereGeometry(1.6, 24, 16), [-10, 0, 0]);
  for (const x of [-10.8, -10, -9.2]) {
    const ring = mesh('reactor', new THREE.TorusGeometry(1.65, 0.1, 8, 40), [x, 0, 0]);
    ring.rotation.y = Math.PI / 2;
  }
  mesh('reactor', cylinder(0.8, 1.6), [-11.5, 0, 0]);
  const fireMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb24f,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const fire = mesh('reactor', new THREE.ConeGeometry(0.7, 5, 20), [-14, 0, 0], fireMaterial);
  fire.rotation.z = Math.PI / 2;
  const innerFire = mesh(
    'reactor',
    new THREE.ConeGeometry(0.35, 3.5, 16),
    [-13.2, 0, 0],
    new THREE.MeshBasicMaterial({ color: 0xffe6b3 }),
  );
  innerFire.rotation.z = Math.PI / 2;
  groups.habitat.position.x = 1.5;
  const habitatRing = mesh('habitat', new THREE.TorusGeometry(4.5, 0.4, 12, 72), [0, 0, 0]);
  habitatRing.rotation.y = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const spoke = mesh('habitat', new THREE.BoxGeometry(0.25, 9, 0.25), [0, 0, 0]);
    spoke.rotation.x = (i * Math.PI) / 2;
  }
  const windowsMaterial = new THREE.MeshBasicMaterial({ color: 0x8fdce4 });
  const windows = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.09, 0.12, 0.2),
    windowsMaterial,
    80,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    matrix.makeTranslation(0.4, 4.5 * Math.cos(a), 4.5 * Math.sin(a));
    windows.setMatrixAt(i, matrix);
  }
  groups.habitat.add(windows);
  for (let z = -1; z <= 1; z++) mesh('lifeSupport', cylinder(0.46, 3.5, 12), [-4, 1.5, z]);
  const cargoPods: THREE.Mesh[] = [];
  for (let x = 0; x < 3; x++)
    for (let z = 0; z < 2; z++)
      cargoPods.push(
        mesh('cargo', new THREE.BoxGeometry(1.5, 1.35, 1.3), [4 + x * 1.7, -1.55, z * 1.5 - 0.75]),
      );
  for (let x = 0; x < 3; x++)
    mesh('cargo', new THREE.BoxGeometry(0.12, 2.5, 3.2), [4 + x * 1.7, -1.3, 0]);
  mesh('navigation', new THREE.BoxGeometry(0.15, 3, 0.15), [11, 1.5, 0]);
  const dish = mesh(
    'navigation',
    new THREE.SphereGeometry(1.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.4),
    [11, 3, 0],
  );
  dish.rotation.z = -0.6;
  mesh(
    'navigation',
    new THREE.SphereGeometry(0.13, 8, 8),
    [11, 3.8, 0],
    new THREE.MeshBasicMaterial({ color: 0x8fdce4 }),
  );
  const shieldMaterial = new THREE.MeshBasicMaterial({
    color: 0x8fdce4,
    wireframe: true,
    transparent: true,
    opacity: 0.045,
    depthWrite: false,
  });
  const shield = mesh('shields', new THREE.SphereGeometry(1, 32, 16), [0, 0, 0], shieldMaterial);
  shield.scale.set(15, 6, 6);
  // A single bounded background point cloud; no textures, bloom, or particle emitters.
  const stars = new Float32Array(480 * 3);
  for (let i = 0; i < 480; i++) {
    stars[i * 3] = (markSeed(`x${i}`) - 0.5) * 120;
    stars[i * 3 + 1] = (markSeed(`y${i}`) - 0.5) * 65;
    stars[i * 3 + 2] = -20 - markSeed(`z${i}`) * 45;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0x9cabbc, size: 0.055, transparent: true, opacity: 0.6 }),
    ),
  );
  let marksKey = '';
  const scars = new THREE.Group();
  ship.add(scars);
  function disposeTree(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materialSet = new Set<THREE.Material>();
    root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materialSet.add(material);
      }
    });
    geometries.forEach((g) => g.dispose());
    materialSet.forEach((m) => m.dispose());
  }
  function update(systems: ShipSystem[], resources: Resources) {
    for (const system of systems) {
      const lost = system.condition === 'destroyed';
      materials[system.id].color.set(conditionColor(system));
      materials[system.id].emissive.set(lost ? 0x55140d : 0x000000);
      if (system.id === 'navigation') groups.navigation.rotation.z = lost ? -0.28 : 0;
      if (system.id === 'cargo')
        cargoPods.forEach((pod) => {
          pod.visible = !lost;
        });
      if (system.id === 'shields')
        shieldMaterial.opacity = lost ? 0 : (system.integrity / 100) * 0.065;
    }
    windows.count = Math.round(Math.min(1, resources.passengers / 180) * 80);
    fire.scale.y = 0.4 + (Math.max(0, resources.power) / 100) * 0.6;
    innerFire.scale.y = fire.scale.y;
    const key = JSON.stringify(systems.map((s) => [s.id, s.marks]));
    if (key !== marksKey) {
      marksKey = key;
      disposeTree(scars);
      scars.clear();
      const scarAnchors: Record<SystemId, [number, number, number]> = {
        hull: [0, 0.8, 0.4],
        reactor: [-10, 1, 1],
        habitat: [1.5, 3, 3],
        lifeSupport: [-4, 2, 1],
        cargo: [6, -1, 1.5],
        navigation: [11, 2, 0.5],
        shields: [0, 3, 4],
      };
      for (const system of systems)
        for (const mark of system.marks.slice(-8)) {
          const [x, y, z] = scarAnchors[system.id];
          const scar = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.06, 0.09),
            new THREE.MeshBasicMaterial({ color: mark.kind === 'repair' ? 0x8fdce4 : 0xf57865 }),
          );
          scar.position.set(
            x + (markSeed(mark.eventId) - 0.5) * 2,
            y + (markSeed(mark.eventId + 'y') - 0.5),
            z,
          );
          scar.rotation.z = markSeed(mark.eventId) * 2;
          scars.add(scar);
        }
    }
  }
  let disposed = false,
    visible = false,
    frame = 0,
    timer: ReturnType<typeof setTimeout> | undefined,
    angle = 0;
  let painted = false;
  const stop = () => {
    cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    frame = 0;
    timer = undefined;
  };
  const draw = () => {
    if (disposed || !visible || document.hidden) {
      stop();
      return;
    }
    angle += 0.002;
    ship.rotation.y = Math.sin(angle) * 0.045;
    groups.habitat.rotation.x += 0.003;
    renderer.render(scene, camera);
    if (!painted) {
      painted = true;
      onReady();
    }
    timer = setTimeout(() => {
      frame = requestAnimationFrame(draw);
    }, 1000 / 30);
  };
  const resume = () => {
    stop();
    if (!disposed && visible && !document.hidden) frame = requestAnimationFrame(draw);
  };
  const resize = new ResizeObserver(() => {
    const width = container.clientWidth,
      height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.position.set(24, 15, Math.max(33, (33 * 1.8) / camera.aspect));
    camera.updateProjectionMatrix();
  });
  resize.observe(container);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? false;
    resume();
  });
  intersection.observe(container);
  document.addEventListener('visibilitychange', resume);
  const lost = (event: Event) => {
    event.preventDefault();
    stop();
    onContextLost();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  return {
    update,
    dispose() {
      disposed = true;
      stop();
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', resume);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      disposeTree(scene);
      // Shield's placeholder material is never attached to a mesh.
      materials.shields.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
