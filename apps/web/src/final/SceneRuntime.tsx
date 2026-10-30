import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// Manual frames prevent OrbitControls and particles from scheduling an unbounded RAF loop.
export function FrameBudget({
  reducedMotion = false,
  mini = false,
}: {
  reducedMotion?: boolean;
  mini?: boolean;
}) {
  const { gl, advance } = useThree();
  const elapsed = useRef(0);
  const rendered = useRef(0);
  const trigger = useRef(() => {});
  useEffect(() => {
    let visible = true,
      timer: ReturnType<typeof setInterval> | undefined,
      previous = performance.now();
    const frame = () => {
      if (document.hidden || !visible) return;
      const now = performance.now();
      elapsed.current += Math.min(0.1, Math.max(0.001, (now - previous) / 1000));
      previous = now;
      advance(elapsed.current, true);
    };
    trigger.current = frame;
    const update = () => {
      if (timer) clearInterval(timer);
      previous = performance.now();
      if (!document.hidden && visible) {
        frame();
        requestAnimationFrame(frame);
        if (!reducedMotion) timer = setInterval(frame, mini ? 50 : 34);
      }
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      update();
    });
    observer.observe(gl.domElement);
    const input = () => {
      if (reducedMotion) requestAnimationFrame(frame);
    };
    for (const name of ['pointermove', 'pointerup', 'wheel'])
      gl.domElement.addEventListener(name, input);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      if (timer) clearInterval(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      for (const name of ['pointermove', 'pointerup', 'wheel'])
        gl.domElement.removeEventListener(name, input);
      trigger.current = () => {};
    };
  }, [gl, advance, reducedMotion, mini]);
  useEffect(() => {
    requestAnimationFrame(() => trigger.current());
  });
  useFrame(() => {
    const root = gl.domElement.closest<HTMLElement>('.ark-canvas,.voxel-canvas');
    if (!root) return;
    root.dataset.frameCount = String(++rendered.current);
    root.dataset.drawCalls = String(gl.info.render.calls);
    root.dataset.pixelRatio = String(gl.getPixelRatio());
    if (gl.info.render.calls > 0) root.dataset.sceneReady = 'true';
  });
  return null;
}
