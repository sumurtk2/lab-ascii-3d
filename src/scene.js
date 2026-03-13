/**
 * Three.js Scene — ASCII post-processing with model selector + lip sync
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { ASCIIEffect, getCellSize } from './ascii-effect.js';
import { LipSync } from './lipsync.js';

/**
 * Generate a simple gradient environment map for reflections
 */
function createEnvMap(renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();

  const envScene = new THREE.Scene();
  // Gradient sky dome — bright top, dark bottom for dramatic reflections
  const geo = new THREE.SphereGeometry(10, 32, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      void main() {
        float y = normalize(vWorldPos).y;
        // Bright top, medium sides, dark bottom
        vec3 top = vec3(0.9, 0.92, 1.0);
        vec3 mid = vec3(0.3, 0.32, 0.4);
        vec3 bot = vec3(0.05, 0.05, 0.1);
        vec3 col = y > 0.0 ? mix(mid, top, y) : mix(mid, bot, -y);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(geo, mat));

  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  pmremGenerator.dispose();
  envScene.clear();
  return envMap;
}

const MODELS = {
  helmet: { path: '/models/model.glb', rotY: Math.PI * 0.1, frameMode: 'full' },
  misa: { path: '/models/misa.glb', rotY: 0, frameMode: 'head' },
  avatar: {
    path: '/models/avatar.glb', rotY: 0, frameMode: 'bust', hasLipSync: true,
    hairColor: '#2266dd', enhanceMaterials: true,
    lighting: { ambient: 1.7, key: 1.4, rim: 10, rough: 0.89, metal: 0.33, env: 0 },
  },
};

export function initScene(canvas) {
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
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 3.2);

  // Environment map for reflections
  const envMap = createEnvMap(renderer);

  // ---- Lighting presets ----
  const LIGHT_FLAT = {
    ambient: 2,
    key: { color: 0x8888cc, intensity: 4, pos: [2, 3, 4] },
    fill: { color: 0xcc8888, intensity: 1.5, pos: [-3, -1, 2] },
    rim: { color: 0xffffff, intensity: 2, pos: [0, 2, -3] },
    bottom: null,
    envMap: null,
  };
  const LIGHT_ENHANCED = {
    ambient: 0.8,
    key: { color: 0xffffff, intensity: 5, pos: [2, 3, 4] },
    fill: { color: 0x8888cc, intensity: 2, pos: [-3, -1, 2] },
    rim: { color: 0xffffff, intensity: 4, pos: [0, 2, -4] },
    bottom: { color: 0x6666ff, intensity: 2, pos: [0, -2, 3] },
    envMap: envMap,
  };

  const ambientLight = new THREE.AmbientLight(0xffffff, 2);
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0x8888cc, 4);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xcc8888, 1.5);
  fillLight.position.set(-3, -1, 2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 2);
  rimLight.position.set(0, 2, -3);
  scene.add(rimLight);
  const bottomRim = new THREE.DirectionalLight(0x6666ff, 2);
  bottomRim.position.set(0, -2, 3);
  bottomRim.visible = false;
  scene.add(bottomRim);

  let lightingMode = 'flat'; // 'flat' or 'enhanced'

  function applyLighting(preset) {
    ambientLight.intensity = preset.ambient;
    keyLight.color.set(preset.key.color);
    keyLight.intensity = preset.key.intensity;
    keyLight.position.set(...preset.key.pos);
    fillLight.color.set(preset.fill.color);
    fillLight.intensity = preset.fill.intensity;
    fillLight.position.set(...preset.fill.pos);
    rimLight.color.set(preset.rim.color);
    rimLight.intensity = preset.rim.intensity;
    rimLight.position.set(...preset.rim.pos);
    if (preset.bottom) {
      bottomRim.visible = true;
      bottomRim.color.set(preset.bottom.color);
      bottomRim.intensity = preset.bottom.intensity;
      bottomRim.position.set(...preset.bottom.pos);
    } else {
      bottomRim.visible = false;
    }
    scene.environment = preset.envMap || null;
  }

  applyLighting(LIGHT_FLAT);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 6;
  controls.autoRotate = false;

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

  // ---- Lip Sync ----
  const lipSync = new LipSync();
  let currentModelKey = null;

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

  // ---- Model Management ----
  let currentModel = null;
  let modelLoaded = false;
  let revealStart = null;
  const REVEAL_DURATION = 2000;
  const CELL_START = getCellSize(50);
  const loader = new GLTFLoader();
  const loadedModels = {};

  function loadModel(key) {
    const config = MODELS[key];
    if (!config) return;

    // Show loading
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) loadingEl.classList.remove('hidden');
    modelLoaded = false;

    // Stop lip sync for previous model
    lipSync.stopTalking();

    // Remove current model
    if (currentModel) {
      scene.remove(currentModel);
      currentModel = null;
    }

    currentModelKey = key;

    // Check cache
    if (loadedModels[key]) {
      addModel(loadedModels[key], config);
      return;
    }

    loader.load(config.path, (gltf) => {
      const model = gltf.scene;
      loadedModels[key] = model;
      addModel(model, config);
    }, undefined, (err) => {
      console.error('[Scene] Load error:', err);
      if (loadingEl) loadingEl.querySelector('.loading-text').textContent = 'LOAD ERROR';
    });
  }

  function addModel(model, config) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    if (config.frameMode === 'bust') {
      // Hide everything below shoulders
      const hideMeshes = ['Wolf3D_Outfit_Bottom', 'Wolf3D_Outfit_Footwear', 'Wolf3D_Body'];
      model.traverse((node) => {
        if (node.isMesh && hideMeshes.includes(node.name)) {
          node.visible = false;
        }
      });

      const scale = 2.0 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      const scaledCenter = center.clone().multiplyScalar(scale);
      const scaledHeight = size.y * scale;

      // Position so head is centered vertically
      const headOffset = scaledHeight * 0.32;
      model.position.set(-scaledCenter.x, -scaledCenter.y - headOffset, -scaledCenter.z);

      // Add clipping plane to cut just below shoulders (in world space)
      const clipY = -0.085; // between collarbone and breast — shoulder level
      const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -clipY);
      model.traverse((node) => {
        if (node.isMesh && node.visible && node.material) {
          node.material = node.material.clone();
          node.material.clippingPlanes = [clipPlane];
          node.material.clipShadows = true;
        }
      });

      camera.position.set(0, 0.15, 0.65);
      controls.minDistance = 0.65 * 0.9;  // -10%
      controls.maxDistance = 0.65 * 1.1;  // +10%
      controls.target.set(0, 0.15, 0);
      drift.radius = 0.65;
      drift.baseAz = 0; drift.basePol = Math.PI / 2;
      pickDriftTarget();
    } else if (config.frameMode === 'head') {
      const scale = 2.0 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      const scaledCenter = center.clone().multiplyScalar(scale);
      const scaledHeight = size.y * scale;
      const headOffset = scaledHeight * 0.32;
      model.position.set(-scaledCenter.x, -scaledCenter.y - headOffset, -scaledCenter.z);
      camera.position.set(0, 0, 1.8);
      controls.minDistance = 1.0;
      controls.maxDistance = 6;
      drift.radius = 1.8;
      drift.baseAz = 0; drift.basePol = Math.PI / 2;
      pickDriftTarget();
    } else {
      const scale = 2.0 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.position.copy(center.multiplyScalar(-scale));
      camera.position.set(0, 0, 3.2);
      controls.minDistance = 1.5;
      controls.maxDistance = 6;
      drift.radius = 3.2;
      drift.baseAz = 0; drift.basePol = Math.PI / 2;
      pickDriftTarget();
    }

    model.rotation.set(0, config.rotY || 0, 0);
    scene.add(model);
    currentModel = model;
    modelLoaded = true;

    // Apply per-model lighting or default
    if (config.lighting) {
      const L = config.lighting;
      ambientLight.intensity = L.ambient;
      keyLight.intensity = L.key;
      rimLight.intensity = L.rim;
      if (L.env > 0) {
        scene.environment = envMap;
        bottomRim.visible = true;
      } else {
        scene.environment = null;
        bottomRim.visible = false;
      }
      // Apply material overrides
      model.traverse((n) => {
        if (n.isMesh && n.material && n.visible) {
          n.material.roughness = L.rough;
          n.material.metalness = L.metal;
          n.material.envMapIntensity = L.env;
        }
      });
      lightingMode = 'custom';
      document.dispatchEvent(new CustomEvent('lighting-changed', { detail: L }));
    } else if (config.enhanceMaterials) {
      lightingMode = 'enhanced';
      applyLighting(LIGHT_ENHANCED);
    } else {
      lightingMode = 'flat';
      applyLighting(LIGHT_FLAT);
    }

    // Enhance avatar materials for better ASCII contrast
    if (config.enhanceMaterials) {
      model.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const mat = node.material;

        if (node.name === 'Wolf3D_Hair') {
          mat.color.set(config.hairColor || '#2266dd');
          mat.roughness = 0.3;
          mat.metalness = 0.15;
          mat.envMapIntensity = 1.5;
        } else if (node.name === 'Wolf3D_Head' || node.name === 'Wolf3D_Skin') {
          // Skin — slight glossiness for light wrapping + subsurface look
          mat.roughness = 0.5;
          mat.metalness = 0.05;
          mat.envMapIntensity = 1.0;
        } else if (node.name === 'Wolf3D_Eye') {
          // Eyes — glossy and reflective
          mat.roughness = 0.1;
          mat.metalness = 0.2;
          mat.envMapIntensity = 2.0;
        } else if (node.name === 'Wolf3D_Outfit_Top') {
          mat.roughness = 0.4;
          mat.metalness = 0.1;
          mat.envMapIntensity = 1.2;
        }
      });
    } else if (config.hairColor) {
      model.traverse((node) => {
        if (node.isMesh && node.name === 'Wolf3D_Hair') {
          if (node.material) {
            node.material = node.material.clone();
            node.material.color.set(config.hairColor);
          }
        }
      });
    }

    // Setup lip sync if available
    if (config.hasLipSync) {
      const hasTargets = lipSync.setup(model);
      console.log('[Scene] Lip sync:', hasTargets ? 'ready' : 'no morph targets');
      document.dispatchEvent(new CustomEvent('lipsync-ready', { detail: { ready: hasTargets } }));
    } else {
      document.dispatchEvent(new CustomEvent('lipsync-ready', { detail: { ready: false } }));
    }

    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) loadingEl.classList.add('hidden');

    // Reset reveal
    revealStart = performance.now();
    asciiEffect.setCellSize(CELL_START);
    asciiEffect.setReveal(0);
  }

  // Load default model
  loadModel('avatar');

  // ---- Drift system ----
  // Smooth random orbiting within ±45° horizontal, ±10° vertical
  const drift = {
    azimuth: 0,        // current horizontal angle (rad)
    polar: Math.PI / 2, // current vertical angle (rad) — π/2 = equator
    targetAz: 0,
    targetPol: Math.PI / 2,
    speed: 0.3,        // drift speed multiplier
    nextChange: 0,     // time for next target change
    userActive: false,  // user is dragging
    returnTimer: 0,    // time since user stopped
    baseAz: 0,         // azimuth when model loaded
    basePol: Math.PI / 2,
    radius: 3.2,       // camera distance (set per model)
  };

  const DEG = Math.PI / 180;
  const AZ_RANGE = 45 * DEG;   // ±45°
  const POL_RANGE = 10 * DEG;  // ±10°

  function pickDriftTarget() {
    drift.targetAz = drift.baseAz + (Math.random() * 2 - 1) * AZ_RANGE;
    drift.targetPol = drift.basePol + (Math.random() * 2 - 1) * POL_RANGE;
    drift.nextChange = 4 + Math.random() * 6; // 4-10 seconds between direction changes
  }

  // Detect user interaction
  let userDragTimer = 0;
  let isHeld = false;
  canvas.addEventListener('pointerdown', () => {
    drift.userActive = true;
    drift.returnTimer = 0;
    isHeld = true;
    lipSync.setHeld(true);
  });
  canvas.addEventListener('pointerup', () => {
    drift.userActive = false;
    drift.returnTimer = 0;
    isHeld = false;
    lipSync.setHeld(false);
  });
  canvas.addEventListener('pointerleave', () => {
    isHeld = false;
    lipSync.setHeld(false);
  });

  pickDriftTarget();

  // ---- Animation ----
  let lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    controls.update();
    if (!modelLoaded) return;

    // Drift camera
    if (!drift.userActive) {
      drift.returnTimer += dt;

      // Get current spherical position from controls
      const spherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target)
      );

      if (drift.returnTimer < 3) {
        // Ease back to center — slow and smooth
        const t = drift.returnTimer / 3;
        const ease = t * t * (3 - 2 * t);
        drift.azimuth = spherical.theta;
        drift.polar = spherical.phi;
        const targetAz = drift.baseAz;
        const targetPol = drift.basePol;
        spherical.theta += (targetAz - spherical.theta) * ease * dt * 0.8;
        spherical.phi += (targetPol - spherical.phi) * ease * dt * 0.8;
      } else {
        // Normal drift
        drift.nextChange -= dt;
        if (drift.nextChange <= 0) pickDriftTarget();

        const lerpSpeed = drift.speed * dt;
        spherical.theta += (drift.targetAz - spherical.theta) * lerpSpeed;
        spherical.phi += (drift.targetPol - spherical.phi) * lerpSpeed;
      }

      // Keep distance from user's current zoom, don't force it
      // (let OrbitControls handle zoom freely)

      const newPos = new THREE.Vector3().setFromSpherical(spherical).add(controls.target);
      camera.position.copy(newPos);
      camera.lookAt(controls.target);
    } else {
      // Track where user left the camera
      const spherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target)
      );
      drift.azimuth = spherical.theta;
      drift.polar = spherical.phi;
    }

    asciiEffect.setMouse(mouse.x, mouse.y);
    asciiEffect.setTime(now / 1000);
    mouse.velocity *= 0.92;
    if (mouse.velocity < 0.001) mouse.velocity = 0;
    asciiEffect.setVelocity(mouse.velocity);
    asciiEffect.setHeld(isHeld ? 1.0 : 0.0);

    // Update lip sync
    lipSync.update(dt);

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
    loadModel,
    lipSync,
    toggleTalk() {
      const config = MODELS[currentModelKey];
      if (!config?.hasLipSync) return false;
      return lipSync.toggle();
    },
    setAmbient(v) { ambientLight.intensity = v; },
    setKeyLight(v) { keyLight.intensity = v; },
    setRimLight(v) { rimLight.intensity = v; },
    setRoughness(v) {
      if (!currentModel) return;
      currentModel.traverse((n) => {
        if (n.isMesh && n.material && n.visible) n.material.roughness = v;
      });
    },
    setMetalness(v) {
      if (!currentModel) return;
      currentModel.traverse((n) => {
        if (n.isMesh && n.material && n.visible) n.material.metalness = v;
      });
    },
    setEnvIntensity(v) {
      if (!currentModel) return;
      scene.environment = v > 0 ? envMap : null;
      currentModel.traverse((n) => {
        if (n.isMesh && n.material && n.visible) n.material.envMapIntensity = v;
      });
    },
    getLighting() { return lightingMode; },
    toggleLighting() {
      if (lightingMode === 'flat') {
        lightingMode = 'enhanced';
        applyLighting(LIGHT_ENHANCED);
      } else {
        lightingMode = 'flat';
        applyLighting(LIGHT_FLAT);
      }
      return lightingMode;
    },
    setTheme(isDark) {
      const bg = isDark ? '#0a0a0a' : '#f0f0f0';
      const fg = isDark ? '#ffffff' : '#1a1a1a';
      scene.background = new THREE.Color(bg);
      asciiEffect.setColor(fg);
      asciiEffect.setBackgroundColor(bg);
    },
  };
}
