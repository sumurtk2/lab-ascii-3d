/**
 * Three.js Scene — ASCII post-processing with glitch effects
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { ASCIIEffect, getCellSize } from './ascii-effect.js';

export function initScene(canvas) {
  console.log('[Scene] Initializing...');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 3.2);

  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const dirLight = new THREE.DirectionalLight(0x8888cc, 4);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xcc8888, 1.5);
  fillLight.position.set(-3, -1, 2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 2);
  rimLight.position.set(0, 2, -3);
  scene.add(rimLight);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 6;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  // ---- ASCII Effect ----
  const targetCellSize = getCellSize(12);
  const asciiEffect = new ASCIIEffect({
    characters: " .:,'-^=*+?!|0#X%WM@",
    fontSize: 54,
    cellSize: targetCellSize,
    color: '#ffffff',
    backgroundColor: '#0a0a0a',
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera, asciiEffect));

  // ---- Mouse ----
  const mouse = { x: -9999, y: -9999, prevX: 0, prevY: 0, velocity: 0, lastTime: 0 };

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const now = performance.now();
    const dt = Math.max(1, now - mouse.lastTime);
    const dx = x - mouse.prevX;
    const dy = y - mouse.prevY;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt * 1000;
    mouse.velocity = Math.max(mouse.velocity, speed > 1.5 ? Math.min((speed - 1.5) * 0.5, 1) : 0);
    mouse.prevX = x;
    mouse.prevY = y;
    mouse.lastTime = now;
    mouse.x = x;
    mouse.y = y;
  });

  canvas.addEventListener('pointerleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // ---- Resize ----
  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }

  window.addEventListener('resize', resize);
  requestAnimationFrame(resize);

  // ---- Load Model ----
  let modelLoaded = false;
  let revealStart = null;
  const REVEAL_DURATION = 2000;
  const CELL_START = getCellSize(50);

  const loader = new GLTFLoader();
  loader.load('/models/model.glb', (gltf) => {
    console.log('[Scene] Model loaded');
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.0 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    model.rotation.y = Math.PI * 0.1;
    scene.add(model);
    modelLoaded = true;

    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) loadingEl.classList.add('hidden');
    revealStart = performance.now();
  }, undefined, (err) => {
    console.error('[Scene] Load error:', err);
  });

  // ---- Animation ----
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (!modelLoaded) return;

    const now = performance.now();
    asciiEffect.setMouse(mouse.x, mouse.y);
    asciiEffect.setTime(now / 1000);
    mouse.velocity *= 0.92;
    if (mouse.velocity < 0.001) mouse.velocity = 0;
    asciiEffect.setVelocity(mouse.velocity);

    if (revealStart !== null) {
      const elapsed = now - revealStart;
      const t = Math.min(elapsed / REVEAL_DURATION, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      asciiEffect.setReveal(eased);
      const cellT = Math.min(elapsed / 2500, 1);
      asciiEffect.setCellSize(CELL_START + (targetCellSize - CELL_START) * cellT * cellT * cellT);
      if (t >= 1) {
        asciiEffect.setReveal(1);
        asciiEffect.setCellSize(targetCellSize);
        revealStart = null;
      }
    }

    composer.render();
  }

  animate();

  return {
    setTheme(isDark) {
      const bg = isDark ? '#0a0a0a' : '#f0f0f0';
      const fg = isDark ? '#ffffff' : '#1a1a1a';
      scene.background = new THREE.Color(bg);
      asciiEffect.setColor(fg);
      asciiEffect.setBackgroundColor(bg);
    },
  };
}
