/**
 * Main Entry Point
 * Boots Three.js scene + UI
 */

import { initScene } from './scene.js';
import { initUI } from './ui.js';
import './style.css';

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Init 3D scene
  const sceneAPI = initScene(canvas);

  // Init UI (theme toggle, chat)
  initUI(sceneAPI);
});
