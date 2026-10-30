import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// Manual frames prevent OrbitControls and particles from scheduling an unbounded RAF loop.
export function FrameBudget({
  reducedMotion = false,
  mini = false,
}: {
  reducedMotion?: boolean;
  mini?: boolean;
}) {
  const { gl, advance, setDpr } = useThree();
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const contextLost = (event: Event) => {
      event.preventDefault();
      setLost(true);
    };
    gl.domElement.addEventListener('webglcontextlost', contextLost);
    return () => gl.domElement.removeEventListener('webglcontextlost', contextLost);
  }, [gl]);
  const elapsed = useRef(0);
  const rendered = useRef(0);
  const trigger = useRef(() => {});
  useEffect(() => {
    let visible = true,
      timer: ReturnType<typeof setTimeout> | undefined,
      raf = 0,
      pending = false,
      warmup = 2,
      previous = performance.now();
    let slowFrames = 0;
    const frame = () => {
      if (document.hidden || !visible) return;
      const now = performance.now();
      elapsed.current += Math.min(0.1, Math.max(0.001, (now - previous) / 1000));
      previous = now;
      const started = performance.now();
      advance(elapsed.current, true);
      // Sustained expensive rendering reduces resolution, preserving UI responsiveness.
      slowFrames = performance.now() - started > 32 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames >= 8 && gl.getPixelRatio() > 0.75) {
        setDpr(Math.max(0.75, gl.getPixelRatio() * 0.8));
        slowFrames = 0;
      }
    };
    const draw = () => {
      if (pending || document.hidden || !visible) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        pending = false;
        if (document.hidden || !visible) return;
        frame();
        warmup = Math.max(0, warmup - 1);
        // Leave a real event-loop gap after each completed render. Slow GPUs must
        // not build interval debt ahead of input, fetch completion or phase UI.
        if (warmup > 0 || !reducedMotion) timer = setTimeout(draw, warmup > 0 ? 0 : mini ? 50 : 34);
      });
    };
    trigger.current = () => {
      if (timer) clearTimeout(timer);
      draw();
    };
    const update = () => {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
      pending = false;
      warmup = 2;
      previous = performance.now();
      draw();
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      update();
    });
    observer.observe(gl.domElement);
    const input = () => {
      if (reducedMotion) trigger.current();
    };
    for (const name of ['pointermove', 'pointerup', 'wheel'])
      gl.domElement.addEventListener(name, input);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      for (const name of ['pointermove', 'pointerup', 'wheel'])
        gl.domElement.removeEventListener(name, input);
      trigger.current = () => {};
    };
  }, [gl, advance, setDpr, reducedMotion, mini]);
  useEffect(() => {
    trigger.current();
  });
  useFrame(() => {
    const root = gl.domElement.closest<HTMLElement>('.ark-canvas,.voxel-canvas');
    if (!root) return;
    root.dataset.frameCount = String(++rendered.current);
    root.dataset.drawCalls = String(gl.info.render.calls);
    root.dataset.pixelRatio = String(gl.getPixelRatio());
    if (gl.info.render.calls > 0) root.dataset.sceneReady = 'true';
  });
  if (lost) throw new Error('Graphics context unavailable');
  return null;
}
