import * as T from 'three';
import type {
  Resources,
  ShipSystem,
  WorldPresentation,
  VisualCue,
  SystemId,
} from '@torchline/contracts';
import { markSeed } from './visual-state.ts';
import {
  buildArk,
  disposeObjects,
  glowTexture,
  fresnelVertex,
  fresnelFragment,
} from './ark-model.ts';

type PublicEvent = WorldPresentation['events'][number];
type Particle = { p: T.Vector3; v: T.Vector3; age: number; life: number; color: T.Color };
export function createArkScene(
  container: HTMLElement,
  onContextLost: () => void,
  onReady: () => void,
  view: 'panel' | 'flight' | 'title' = 'panel',
) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'default',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x05060a, 0);
  container.append(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(30, 2, 0.1, 2400);
  const glow = glowTexture();
  const ark = buildArk(glow);
  scene.add(ark.ship);
  scene.add(new T.HemisphereLight(0x819bb6, 0x07080b, 0.85));
  const key = new T.DirectionalLight(0xffdfbb, 2.5);
  key.position.set(30, 22, 26);
  scene.add(key);
  const rim = new T.DirectionalLight(0x7fd6ff, 2);
  rim.position.set(-30, 10, -30);
  scene.add(rim);
  const flash = new T.PointLight(0xff7046, 0, 40, 2);
  scene.add(flash);
  const starGeometry = new T.BufferGeometry(),
    positions = new Float32Array(1400 * 3),
    colors = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i++) {
    positions.set(
      [
        (markSeed(`star-x${i}`) - 0.5) * 1100,
        (markSeed(`star-y${i}`) - 0.5) * 600,
        -80 - markSeed(`star-z${i}`) * 800,
      ],
      i * 3,
    );
    const v = 0.35 + markSeed(`lum${i}`) * 0.65;
    colors.set([v, v * 0.91, v * 0.83], i * 3);
  }
  starGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  const stars = new T.Points(
    starGeometry,
    new T.PointsMaterial({
      size: 1.5,
      map: glow,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: false,
      blending: T.AdditiveBlending,
    }),
  );
  scene.add(stars);
  const rockGeometry = new T.IcosahedronGeometry(1, 0);
  const rocks = new T.InstancedMesh(
    rockGeometry,
    new T.MeshStandardMaterial({ color: 0x545056, roughness: 0.95, flatShading: true }),
    42,
  );
  scene.add(rocks);
  const debris = new T.InstancedMesh(
    new T.BoxGeometry(1.5, 0.2, 0.8),
    new T.MeshStandardMaterial({ color: 0x77716a, metalness: 0.7, roughness: 0.7 }),
    30,
  );
  scene.add(debris);
  const object = new T.Object3D();
  const planet = new T.Mesh(
    new T.SphereGeometry(38, 40, 24),
    new T.MeshStandardMaterial({ color: 0x215565, emissive: 0x0a2830, roughness: 0.9 }),
  );
  planet.position.set(20, -38, -65);
  scene.add(planet);
  const atmosphere = new T.Mesh(
    new T.SphereGeometry(39, 32, 20),
    new T.ShaderMaterial({
      vertexShader: fresnelVertex,
      fragmentShader: fresnelFragment,
      uniforms: { color: { value: new T.Color(0x8fdce4) }, strength: { value: 1.1 } },
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.BackSide,
    }),
  );
  atmosphere.position.copy(planet.position);
  scene.add(atmosphere);
  const trailPositions = new Float32Array(120 * 6);
  for (let i = 0; i < 120; i++) {
    const x = (markSeed(`warp-x${i}`) - 0.5) * 150,
      y = (markSeed(`warp-y${i}`) - 0.5) * 60,
      z = -30 - markSeed(`warp-z${i}`) * 90;
    trailPositions.set([x, y, z, x + 16, y, z], i * 6);
  }
  const trailGeometry = new T.BufferGeometry();
  trailGeometry.setAttribute('position', new T.BufferAttribute(trailPositions, 3));
  const trailMaterial = new T.LineBasicMaterial({
    color: 0xc3e4ed,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  scene.add(new T.LineSegments(trailGeometry, trailMaterial));
  const particleGeometry = new T.BufferGeometry(),
    particlePositions = new Float32Array(320 * 3),
    particleColors = new Float32Array(320 * 3);
  particleGeometry.setAttribute('position', new T.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new T.BufferAttribute(particleColors, 3));
  particleGeometry.setDrawRange(0, 0);
  const particles = new T.Points(
    particleGeometry,
    new T.PointsMaterial({
      size: 0.48,
      map: glow,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  particles.frustumCulled = false;
  scene.add(particles);
  const active: Particle[] = [];
  const scanMaterial = new T.MeshBasicMaterial({
    color: 0x8fdce4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const scan = new T.Mesh(new T.TorusGeometry(6.4, 0.035, 6, 64), scanMaterial);
  scan.rotation.y = Math.PI / 2;
  scene.add(scan);
  let chapter = 0,
    arrival = 0,
    scanTime = -1,
    shake = 0,
    painted = false,
    disposed = false,
    visible = false,
    frame = 0,
    t = 0,
    last = 0,
    leakCarry = 0,
    navLost = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let initialized = false;
  const seen = new Set<string>();
  const focus = new T.Vector3(),
    desiredFocus = new T.Vector3();
  let frames = 0,
    metricAt = 0;
  let slowSamples = 0,
    pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
  delete container.dataset.lastCue;
  container.dataset.pixelRatio = pixelRatio.toFixed(2);
  function emit(at: T.Vector3, color: number, count: number, speed: number, life = 1.3) {
    for (let i = 0; i < count && active.length < 320; i++) {
      const seed = `${t}:${i}:${active.length}`;
      active.push({
        p: at.clone(),
        v: new T.Vector3(
          (markSeed(seed + 'x') - 0.5) * speed,
          (markSeed(seed + 'y') - 0.3) * speed,
          (markSeed(seed + 'z') - 0.5) * speed,
        ),
        age: 0,
        life: life * (0.6 + markSeed(seed)),
        color: new T.Color(color),
      });
    }
  }
  function cue(c: VisualCue) {
    const at = ark.position(c.systemId ?? 'hull');
    container.dataset.lastCue = c.kind;
    desiredFocus.copy(at).multiplyScalar(0.12);
    // An oxygen/passenger loss does not physically explode an intact hull.
    if (c.kind === 'world-ended' && !ark.wreck) return;
    if (['damage', 'sacrifice', 'world-ended'].includes(c.kind)) {
      flash.position.copy(at).add(new T.Vector3(0, 2, 3));
      flash.color.set(c.kind === 'sacrifice' ? 0xffa45f : 0xff6945);
      flash.intensity = c.kind === 'world-ended' ? 130 : 60;
      shake = c.kind === 'world-ended' ? 0.18 : 0.08;
      emit(
        at,
        c.kind === 'sacrifice' ? 0xffba76 : 0xff7048,
        c.kind === 'world-ended' ? 120 : 45,
        9,
      );
    }
    if (['repair', 'challenge-solved', 'discovery'].includes(c.kind)) {
      scanTime = 0;
      emit(at, 0x8fdce4, c.kind === 'discovery' ? 12 : 40, 2.2, 1.8);
    }
    if (c.kind === 'chapter-arrived') arrival = 2.2;
  }
  function update(
    systems: ShipSystem[],
    resources: Resources,
    nextChapter = 0,
    events: PublicEvent[] = [],
  ) {
    ark.update(systems, resources);
    chapter = nextChapter;
    navLost = systems.some((s) => s.id === 'navigation' && s.condition === 'destroyed');
    container.dataset.environment = ark.wreck ? 'wreck' : String(chapter);
    rocks.visible = chapter === 2 && !ark.wreck;
    debris.visible = chapter === 4 || ark.wreck;
    planet.visible = atmosphere.visible = chapter === 5 && !ark.wreck;
    const fresh = events.filter((e) => !seen.has(e.id));
    for (const event of events) seen.add(event.id);
    if (initialized && fresh.length <= 3)
      for (const event of fresh) for (const c of event.cues.slice(-8)) cue(c);
    initialized = true;
    // The projection is a bounded tail, so the cosmetic dedupe set is bounded too.
    if (seen.size > 96) {
      seen.clear();
      events.forEach((e) => seen.add(e.id));
    }
  }
  const stop = () => {
    cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    frame = 0;
    timer = undefined;
    last = 0;
  };
  function draw(now: number) {
    if (disposed || !visible || document.hidden) {
      stop();
      return;
    }
    const dt = last ? Math.min(0.06, (now - last) / 1000) : 1 / 30;
    last = now;
    t += dt;
    const yaw = ((-27 + Math.sin(t * 0.08) * 4) * Math.PI) / 180,
      pitch = ((10 + Math.sin(t * 0.11) * 1.5) * Math.PI) / 180;
    const aspect = camera.aspect;
    const base = view === 'title' ? 53 : view === 'flight' ? 48 : 51;
    const radius = base * Math.max(1, 1.65 / aspect);
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * radius,
      Math.sin(pitch) * radius,
      Math.cos(yaw) * Math.cos(pitch) * radius,
    );
    focus.lerp(desiredFocus, 0.06);
    desiredFocus.multiplyScalar(0.97);
    camera.lookAt(focus);
    if (shake > 0) {
      camera.position.x += Math.sin(t * 21) * shake;
      camera.position.y += Math.cos(t * 18) * shake;
      shake = Math.max(0, shake - dt * 0.15);
    }
    if (arrival > 0) {
      arrival = Math.max(0, arrival - dt);
      const k = arrival / 2.2;
      ark.ship.position.x = -70 * k * k * k;
      camera.fov = 30 + 12 * Math.sin(k * Math.PI);
      trailMaterial.opacity = k * 0.65;
    } else {
      ark.ship.position.x = 0;
      camera.fov = 30;
      trailMaterial.opacity = 0;
    }
    camera.updateProjectionMatrix();
    if (arrival > 0) {
      for (let i = 0; i < 120; i++) {
        trailPositions[i * 6] -= dt * 90;
        trailPositions[i * 6 + 3] = trailPositions[i * 6] + 12 + arrival * 12;
        if (trailPositions[i * 6] < -80) trailPositions[i * 6] += 160;
      }
      trailGeometry.attributes.position.needsUpdate = true;
    }
    ark.ship.rotation.y = Math.sin(t * 0.1) * 0.025;
    ark.animate(t, dt);
    stars.rotation.y += dt * 0.0008;
    flash.intensity *= Math.pow(0.03, dt);
    for (const cloud of [rocks, debris])
      if (cloud.visible) {
        for (let i = 0; i < cloud.count; i++) {
          const speed = 1 + markSeed(`velocity${i}`) * 2,
            x = ((((markSeed(`rx${i}`) * 180 - t * speed) % 180) + 180) % 180) - 90,
            y = (markSeed(`ry${i}`) - 0.5) * 55,
            z = -15 - markSeed(`rz${i}`) * 100;
          object.position.set(x, y, z);
          object.rotation.set(t * 0.06 + i, i * 0.5 + t * 0.02, 0);
          object.scale.setScalar(0.4 + markSeed(`rs${i}`) * 2.5);
          object.updateMatrix();
          cloud.setMatrixAt(i, object.matrix);
        }
        cloud.instanceMatrix.needsUpdate = true;
      }
    if (planet.visible) planet.rotation.y += dt * 0.005;
    if (scanTime >= 0) {
      scanTime += dt;
      const k = scanTime / 1.8;
      scan.position.x = -16 + k * 32;
      scanMaterial.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.6;
      if (k >= 1) {
        scanTime = -1;
        scanMaterial.opacity = 0;
      }
    }
    if (ark.leaking || navLost || ark.wreck) {
      leakCarry += dt;
      const interval = ark.leaking ? 0.12 : 0.25;
      if (leakCarry > interval) {
        leakCarry = 0;
        const id: SystemId = ark.leaking ? 'lifeSupport' : navLost ? 'navigation' : 'hull';
        emit(ark.position(id), ark.leaking ? 0xa7dae5 : 0xff8c4a, 1, ark.leaking ? 1.1 : 2.2, 2.2);
      }
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.age += dt;
      if (p.age >= p.life) {
        active.splice(i, 1);
        continue;
      }
      p.p.addScaledVector(p.v, dt);
      p.v.multiplyScalar(1 - dt * 0.3);
    }
    active.forEach((p, i) => {
      particlePositions.set(p.p.toArray(), i * 3);
      const fade = 1 - p.age / p.life;
      particleColors.set([p.color.r * fade, p.color.g * fade, p.color.b * fade], i * 3);
    });
    particleGeometry.setDrawRange(0, active.length);
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    renderer.render(scene, camera);
    frames++;
    if (!painted) {
      painted = true;
      onReady();
    }
    if (now - metricAt > 1000) {
      const fps = (frames * 1000) / (now - metricAt);
      slowSamples = fps < 18 && painted ? slowSamples + 1 : 0;
      if (slowSamples >= 2 && pixelRatio > 0.5) {
        pixelRatio = Math.max(0.5, pixelRatio * 0.75);
        renderer.setPixelRatio(pixelRatio);
        container.dataset.pixelRatio = pixelRatio.toFixed(2);
        slowSamples = 0;
      }
      container.dataset.drawCalls = String(renderer.info.render.calls);
      container.dataset.triangles = String(renderer.info.render.triangles);
      container.dataset.particles = String(active.length);
      container.dataset.fps = String(Math.round((frames * 1000) / (now - metricAt)));
      frames = 0;
      metricAt = now;
    }
    timer = setTimeout(
      () => {
        frame = requestAnimationFrame(draw);
      },
      Math.max(0, 1000 / 30 - (performance.now() - now)),
    );
  }
  const resume = () => {
    stop();
    frames = 0;
    metricAt = performance.now();
    if (!disposed && visible && !document.hidden) frame = requestAnimationFrame(draw);
  };
  const resize = new ResizeObserver(() => {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
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
      disposeObjects(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
