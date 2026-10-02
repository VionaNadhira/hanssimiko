'use client';

import {useEffect, useRef} from 'react';
import * as THREE from 'three';

const VEC3_ZERO = new THREE.Vector3(0, 0, 0);
const VEC3_TARGET = new THREE.Vector3(0, 0, 0);

type ThreeBackgroundProps = {
  intensity?: 'normal' | 'active' | 'success' | 'error';
};

export function ThreeBackground({intensity = 'normal'}: ThreeBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const mousePosRef = useRef<{x: number; y: number}>({x: 0.5, y: 0.5});
  const targetMouseRef = useRef<{x: number; y: number}>({x: 0.5, y: 0.5});
  const intensityRef = useRef<'normal' | 'active' | 'success' | 'error'>(intensity);
  const pulseRef = useRef<{active: boolean; start: number; duration: number} | null>(null);
  const reduceMotionRef = useRef<boolean>(false);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);

  useEffect(() => {
    intensityRef.current = intensity;
    if (intensity === 'success') {
      pulseRef.current = {active: true, start: performance.now(), duration: 800};
    }
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    reduceMotionRef.current = reduceMotion;

    const isWebGLAvailable = (() => {
      try {
        const test = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (test.getContext('webgl') || test.getContext('experimental-webgl')));
      } catch {
        return false;
      }
    })();

    if (!isWebGLAvailable) return;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    const dprInitial = Math.min(window.devicePixelRatio, getMaxDPR());
    renderer.setPixelRatio(dprInitial);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    const particleCount = getParticleCount();
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = (Math.random() - 0.5) * 12;
      positions[i3 + 2] = (Math.random() - 0.5) * 8;
      sizes[i] = Math.random() * 1.2 + 0.3;
      const isPurple = Math.random() > 0.15;
      if (isPurple) {
        colors[i3] = 0.85 + Math.random() * 0.1;
        colors[i3 + 1] = 0.4 + Math.random() * 0.15;
        colors[i3 + 2] = 0.95 + Math.random() * 0.05;
      } else {
        const w = 0.9 + Math.random() * 0.1;
        colors[i3] = w;
        colors[i3 + 1] = w;
        colors[i3 + 2] = w * 0.98;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = material;
    geometryRef.current = geometry;

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    const resizeHandler = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, getMaxDPR());
      if (cameraRef.current) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
      if (rendererRef.current) {
        rendererRef.current.setPixelRatio(dpr);
        rendererRef.current.setSize(width, height);
      }
    };
    resizeHandlerRef.current = resizeHandler;
    window.addEventListener('resize', resizeHandler, {passive: true});

    const mouseMoveHandler = (e: MouseEvent) => {
      targetMouseRef.current.x = e.clientX / window.innerWidth;
      targetMouseRef.current.y = e.clientY / window.innerHeight;
    };
    mouseMoveHandlerRef.current = mouseMoveHandler;
    if (!reduceMotion) {
      window.addEventListener('mousemove', mouseMoveHandler, {passive: true});
    }

    const animate = () => {
      mousePosRef.current.x += (targetMouseRef.current.x - mousePosRef.current.x) * 0.02;
      mousePosRef.current.y += (targetMouseRef.current.y - mousePosRef.current.y) * 0.02;
      VEC3_TARGET.set((mousePosRef.current.x - 0.5) * (reduceMotion ? 0 : 0.15), -(mousePosRef.current.y - 0.5) * (reduceMotion ? 0 : 0.1), 0);
      if (cameraRef.current) {
        cameraRef.current.position.lerp(VEC3_TARGET, 0.01);
        cameraRef.current.lookAt(VEC3_ZERO);
      }

      const mat = materialRef.current;
      if (mat) {
        const cur = intensityRef.current;
        const target = reduceMotion ? 0.05 : cur === 'success' ? 0.16 : cur === 'active' ? 0.14 : 0.12;
        mat.opacity += (target - mat.opacity) * 0.05;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (mouseMoveHandlerRef.current) {
        window.removeEventListener('mousemove', mouseMoveHandlerRef.current);
      }
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
      }
      materialRef.current?.dispose();
      geometryRef.current?.dispose();
      if (pointsRef.current && sceneRef.current) {
        sceneRef.current.remove(pointsRef.current);
      }
      rendererRef.current?.dispose();
      rendererRef.current?.forceContextLoss?.();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      pointsRef.current = null;
      geometryRef.current = null;
      materialRef.current = null;
    };
  }, []);

  function getParticleCount(): number {
    if (typeof window === 'undefined') return 160;
    const w = window.innerWidth;
    if (w < 768) return 40;
    if (w < 1024) return 90;
    return 160;
  }

  function getMaxDPR(): number {
    if (typeof window === 'undefined') return 2;
    return window.innerWidth < 768 ? 1.5 : 2;
  }

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{pointerEvents: 'none'}} />
    </div>
  );
}
