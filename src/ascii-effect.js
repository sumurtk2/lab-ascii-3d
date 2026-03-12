/**
 * Custom ASCII Post-Processing Effect
 * Converts 3D scene into ASCII character art
 */

import { Effect } from 'postprocessing';
import { Uniform, CanvasTexture, NearestFilter, Vector2, Color } from 'three';

const FRAGMENT_SHADER = /* glsl */`
uniform sampler2D uCharacters;
uniform float uCharactersCount;
uniform float uCellSize;
uniform float uInvertAmount;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uReveal;
uniform vec2 uMouse;
uniform float uHoverRadius;
uniform float uTime;
uniform float uVelocity;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Grid dimensions in cells
    vec2 cell = resolution / uCellSize;
    vec2 grid = 1.0 / cell;

    // Pixelize: sample center of each cell
    vec2 pixelizedUV = grid * (0.5 + floor(uv / grid));
    vec4 pixelized = texture2D(inputBuffer, pixelizedUV);

    // Reveal animation (top to bottom)
    float yPos = 1.0 - uv.y;
    if (yPos > uReveal) {
        outputColor = vec4(uBackgroundColor, 1.0);
        return;
    }

    // Convert to greyscale
    float brightness = dot(pixelized.rgb, vec3(0.299, 0.587, 0.114));

    // Mouse hover scramble effect
    vec2 mouseUV = vec2(uMouse.x, 1.0 - uMouse.y);
    float aspect = resolution.x / resolution.y;
    vec2 aUV = vec2(uv.x * aspect, uv.y);
    vec2 aMouse = vec2(mouseUV.x * aspect, mouseUV.y);
    float dist = distance(aUV, aMouse);
    float effectRadius = uHoverRadius * 1.2;

    if (dist < effectRadius) {
        float falloff = smoothstep(effectRadius, 0.0, dist);
        float intensity = clamp(uVelocity * 5.0, 0.0, 1.0);
        float noise = random(pixelizedUV + uTime * 10.0);
        if (noise < intensity * falloff) {
            float scramble = (random(pixelizedUV * 2.0 + uTime) - 0.5) * 2.0;
            brightness = clamp(brightness + scramble, 0.0, 1.0);
        }
    }

    // Apply inversion
    float greyscaled = mix(brightness, 1.0 - brightness, uInvertAmount);

    // Map brightness to character index
    float charIndex = floor((uCharactersCount - 1.0) * greyscaled);

    // Character position in the 16x16 atlas grid
    float col = mod(charIndex, 16.0);
    float row = floor(charIndex / 16.0);

    // Position within the current cell (0→1)
    vec2 cellUV = fract(uv * cell);

    // Look up character in atlas
    // Atlas is 16x16 grid, texture flipY is disabled so row 0 = top = UV y=0
    vec2 charUV = (vec2(col, row) + cellUV) / 16.0;
    float charBrightness = texture2D(uCharacters, charUV).r;

    // Final color: character pixels get foreground color, rest gets background
    vec3 finalColor = mix(uBackgroundColor, uColor, charBrightness);
    outputColor = vec4(finalColor, 1.0);
}
`;

/**
 * Generate a canvas texture atlas with ASCII characters in a 16x16 grid
 */
function createCharactersTexture(characters, fontSize) {
  const size = 1024;
  const cellSize = size / 16; // 64px per cell
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');

  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  // White characters
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < characters.length; i++) {
    const col = i % 16;
    const row = Math.floor(i / 16);
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;
    ctx.fillText(characters[i], x, y);
  }

  const texture = new CanvasTexture(canvas);
  texture.flipY = false; // CRITICAL: keep canvas coords = UV coords
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;

  console.log('[ASCII] Texture created, chars:', characters.length, 'flipY:', texture.flipY);
  return texture;
}

function getCellSize(baseSize) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return Math.max(2, Math.round(baseSize * dpr / 2));
}

class ASCIIEffect extends Effect {
  constructor(options = {}) {
    const {
      characters = " .:,'-^=*+?!|0#X%WM@",
      fontSize = 54,
      cellSize = 16,
      color = '#ffffff',
      backgroundColor = '#000000',
      invert = false,
    } = options;

    const uniforms = new Map([
      ['uCharacters', new Uniform(null)],
      ['uCellSize', new Uniform(cellSize)],
      ['uCharactersCount', new Uniform(characters.length)],
      ['uColor', new Uniform(new Color(color))],
      ['uBackgroundColor', new Uniform(new Color(backgroundColor))],
      ['uInvertAmount', new Uniform(invert ? 1.0 : 0.0)],
      ['uReveal', new Uniform(1.0)],
      ['uMouse', new Uniform(new Vector2(-9999, -9999))],
      ['uHoverRadius', new Uniform(0.15)],
      ['uTime', new Uniform(0)],
      ['uVelocity', new Uniform(0)],
    ]);

    super('ASCIIEffect', FRAGMENT_SHADER, { uniforms });

    try {
      const charTexture = createCharactersTexture(characters, fontSize);
      this.uniforms.get('uCharacters').value = charTexture;
      console.log('[ASCII] Effect ready');
    } catch (e) {
      console.error('[ASCII] Texture creation failed:', e);
    }
  }

  setCellSize(v) { this.uniforms.get('uCellSize').value = v; }
  setColor(hex) { this.uniforms.get('uColor').value.set(hex); }
  setBackgroundColor(hex) { this.uniforms.get('uBackgroundColor').value.set(hex); }
  setInvert(v) { this.uniforms.get('uInvertAmount').value = v ? 1.0 : 0.0; }
  setReveal(v) { this.uniforms.get('uReveal').value = Math.max(0, Math.min(1, v)); }
  setMouse(x, y) { this.uniforms.get('uMouse').value.set(x, y); }
  setTime(v) { this.uniforms.get('uTime').value = v; }
  setVelocity(v) { this.uniforms.get('uVelocity').value = v; }
}

export { ASCIIEffect, getCellSize };
