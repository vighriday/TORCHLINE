// Offline documentation artwork only; never imported by the application entry.
import * as T from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { buildArk, disposeObjects, glowTexture } from '../src/ark-model.ts';
import pristine from '../../../docs/design/fixtures/pristine.json' with { type: 'json' };
import type { ShipSystem } from '@torchline/contracts';

export interface ReadmeModel {
  png: string;
  stl: string;
  triangles: number;
}
const base64 = (bytes: Uint8Array) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384)
    text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
};
(window as Window & { captureReadmeModel?: () => ReadmeModel }).captureReadmeModel = () => {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(1600, 800);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x05060a, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(30, 2, 0.1, 2000);
  camera.position.set(-20, 8, 43);
  camera.lookAt(0, 0.5, 0);
  scene.add(new T.HemisphereLight(0x819bb6, 0x07080b, 1.05));
  const key = new T.DirectionalLight(0xffdfbb, 3);
  key.position.set(30, 22, 26);
  scene.add(key);
  const rim = new T.DirectionalLight(0x7fd6ff, 2.2);
  rim.position.set(-30, 10, -30);
  scene.add(rim);
  const ark = buildArk(glowTexture());
  ark.update(pristine.systems as ShipSystem[], pristine.resources);
  ark.animate(0, 0);
  scene.add(ark.ship);
  renderer.render(scene, camera);
  const png = renderer.domElement.toDataURL('image/png');
  const physical = new T.Group();
  ark.ship.updateMatrixWorld(true);
  let triangles = 0;
  ark.ship.traverse((object) => {
    if (!(object instanceof T.Mesh) || !object.visible) return;
    for (let parent = object.parent; parent; parent = parent.parent) if (!parent.visible) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some((material) => material.transparent)) return;
    const mesh = new T.Mesh(object.geometry, materials[0]);
    mesh.applyMatrix4(object.matrixWorld);
    physical.add(mesh);
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  const exported = new STLExporter().parse(physical, { binary: true });
  const stl = base64(new Uint8Array(exported.buffer, exported.byteOffset, exported.byteLength));
  disposeObjects(scene);
  renderer.dispose();
  renderer.forceContextLoss();
  return { png, stl, triangles };
};
