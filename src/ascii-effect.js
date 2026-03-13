/**
 * Custom ASCII Post-Processing Effect
 * Converts 3D scene into ASCII character art
 * With random glitches and Matrix rain leak easter eggs
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
uniform float uHeld;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float random2(vec2 st) {
    return fract(sin(dot(st, vec2(45.5432, 98.1234))) * 12345.6789);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 cell = resolution / uCellSize;
    vec2 grid = 1.0 / cell;
    vec2 cellCoord = floor(uv / grid);
    vec2 cellUV = fract(uv * cell);

    // === GLITCH EFFECT ===
    float glitchInterval = 4.17 / (1.0 + uHeld * 5.0); // 6x when held
    float glitchCycle = floor(uTime / glitchInterval);
    float glitchPhase = fract(uTime / glitchInterval);
    float glitchTrigger = random(vec2(glitchCycle, 0.0));
    bool isGlitching = glitchTrigger > 0.4 && glitchPhase < 0.03;

    // 1 in 10 glitches is BIG normally; 50/50 when held
    float bigChance = uHeld > 0.5 ? 0.5 : 0.1;
    bool isBigGlitch = isGlitching && random(vec2(glitchCycle, 99.0)) < bigChance;
    if (isBigGlitch) {
        isGlitching = glitchPhase < (uHeld > 0.5 ? 0.10 : 0.08);
    }
    // When held, lower the trigger threshold so more glitches fire
    if (uHeld > 0.5) {
        isGlitching = isGlitching || (glitchTrigger > 0.15 && glitchPhase < 0.06);
    }

    // Micro-glitch
    float microInterval = 1.67 / (1.0 + uHeld * 5.0); // 6x when held
    float microCycle = floor(uTime / microInterval);
    float microPhase = fract(uTime / microInterval);
    float microTrigger = random(vec2(microCycle, 1.0));
    bool isMicroGlitch = microTrigger > 0.7 && microPhase < 0.015;

    // 1 in 10 micro-glitches is green normally; 1 in 3 when held
    float greenMicroChance = uHeld > 0.5 ? 0.33 : 0.1;
    bool isGreenMicro = isMicroGlitch && random(vec2(microCycle, 88.0)) < greenMicroChance;

    vec2 sampleUV = uv;
    float glitchActive = 0.0;
    float greenBand = 0.0;

    if (isGlitching) {
        glitchActive = 1.0;

        if (isBigGlitch) {
            // BIG glitch: multiple thick bands, heavy displacement
            float heldMul = 1.0 + uHeld * 1.5; // 2.5x bigger when held
            for (float b = 0.0; b < 5.0; b++) {
                float bandY = random(vec2(glitchCycle, 20.0 + b));
                float bandHeight = (0.04 + random(vec2(glitchCycle, 30.0 + b)) * 0.12) * heldMul;
                if (abs(uv.y - bandY) < bandHeight) {
                    float offset = (random(vec2(glitchCycle, 40.0 + b)) - 0.5) * 0.15 * heldMul;
                    sampleUV.x += offset;
                }
            }
            // Green tint on 1-2 displaced bands only (not all 5)
            if (uHeld > 0.5 && random(vec2(glitchCycle, 77.0)) < 0.4) {
                for (float b = 0.0; b < 2.0; b++) {
                    float bY = random(vec2(glitchCycle, 20.0 + b));
                    float bH = 0.03 + random(vec2(glitchCycle, 30.0 + b)) * 0.04; // thin green bands
                    if (abs(uv.y - bY) < bH) {
                        greenBand = 1.0;
                    }
                }
            }
        } else {
            // Normal glitch: 1-2 thin bands, subtle displacement
            float bandY = random(vec2(glitchCycle, 2.0));
            float bandHeight = 0.03 + random(vec2(glitchCycle, 3.0)) * 0.08;
            if (abs(uv.y - bandY) < bandHeight) {
                sampleUV.x += (random(vec2(glitchCycle, 4.0)) - 0.5) * 0.06;
            }
            float bandY2 = random(vec2(glitchCycle, 5.0));
            float bandHeight2 = 0.02 + random(vec2(glitchCycle, 6.0)) * 0.04;
            if (abs(uv.y - bandY2) < bandHeight2) {
                sampleUV.x -= (random(vec2(glitchCycle, 7.0)) - 0.5) * 0.04;
            }
        }
    }

    if (isMicroGlitch) {
        float mBandY = random(vec2(microCycle, 10.0));
        float mBandH = 0.015;
        bool inMicroBand = abs(uv.y - mBandY) < mBandH;
        if (inMicroBand) {
            sampleUV.x += (random(vec2(microCycle, 11.0)) - 0.5) * 0.03;
            if (isGreenMicro) greenBand = 1.0;
        }
    }

    // Pixelize with potentially glitched UV
    vec2 pixelizedUV = grid * (0.5 + floor(sampleUV / grid));
    vec4 pixelized = texture2D(inputBuffer, pixelizedUV);

    // Reveal animation
    float yPos = 1.0 - uv.y;
    if (yPos > uReveal) {
        outputColor = vec4(uBackgroundColor, 1.0);
        return;
    }

    float brightness = dot(pixelized.rgb, vec3(0.299, 0.587, 0.114));

    // Mouse hover scramble
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

    // Map brightness to character
    float charIndex = floor((uCharactersCount - 1.0) * greyscaled);
    float col = mod(charIndex, 16.0);
    float row = floor(charIndex / 16.0);
    vec2 charUV = (vec2(col, row) + cellUV) / 16.0;
    float charBrightness = texture2D(uCharacters, charUV).r;

    // Base color
    vec3 finalColor = mix(uBackgroundColor, uColor, charBrightness);

    // === MATRIX RAIN LEAK ===
    // 1-2 fast green raindrops that streak the full screen height
    float colId = cellCoord.x;
    float totalRows = cell.y;
    float cellY = totalRows - cellCoord.y;

    vec3 matrixGreen = vec3(0.0, 1.0, 0.25);
    float rainMix = 0.0;

    // Drop slots: 2 normally, 6 when held (3x more drops, same speed)
    float maxDrops = uHeld > 0.5 ? 6.0 : 2.0;
    for (float i = 0.0; i < 6.0; i++) {
        if (i >= maxDrops) break;
        float cycleLen = 4.3 + mod(i, 2.0) * 3.2 + i * 1.7; // staggered cycles
        float cycle = floor(uTime / cycleLen);
        float phase = fract(uTime / cycleLen);

        // Only active for the first ~40% of cycle (drop falls then disappears)
        if (phase > 0.4) continue;

        // Random column for this cycle
        float dropCol = floor(random(vec2(i, cycle)) * cell.x);
        if (colId != dropCol) continue;

        // Fast drop — travels full height in the active window
        float dropSpeed = totalRows / (cycleLen * 0.35);
        float dropHead = phase * cycleLen * dropSpeed;
        float dropLen = 6.0 + random(vec2(i, cycle + 50.0)) * 6.0;
        float distFromDrop = dropHead - cellY;

        // Head
        if (distFromDrop > -1.0 && distFromDrop <= 0.0) {
            rainMix = max(rainMix, 1.0);
        }
        // Trail
        if (distFromDrop > 0.0 && distFromDrop < dropLen) {
            float trail = 1.0 - (distFromDrop / dropLen);
            rainMix = max(rainMix, trail * trail * 0.9);
        }
    }

    // Render rain character — normally white, 1 in 10 is green
    if (rainMix > 0.05) {
        float rainCharIdx = mod(floor(random(cellCoord + floor(uTime * 6.0)) * uCharactersCount), uCharactersCount);
        float rc = mod(rainCharIdx, 16.0);
        float rr = floor(rainCharIdx / 16.0);
        vec2 rainCharUV = (vec2(rc, rr) + cellUV) / 16.0;
        float rainCharBright = texture2D(uCharacters, rainCharUV).r;

        // Pick color: use cycle index to decide — ~10% green, 90% white
        float colorSeed = random(vec2(colId + 99.0, floor(uTime / 8.0)));
        vec3 dropColor = colorSeed < 0.1 ? matrixGreen : uColor;

        vec3 rainColor = mix(uBackgroundColor, dropColor, rainCharBright);
        finalColor = mix(finalColor, rainColor, rainMix);
    }

    // Green glitch tint — only within displaced bands
    if (greenBand > 0.5) {
        finalColor.r *= 0.2;
        finalColor.g = min(finalColor.g + 0.4, 1.0);
        finalColor.b *= 0.2;
    }

    outputColor = vec4(finalColor, 1.0);
}
`;

function createCharactersTexture(characters, fontSize) {
  const size = 1024;
  const cellSize = size / 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < characters.length; i++) {
    const col = i % 16;
    const row = Math.floor(i / 16);
    ctx.fillText(characters[i], col * cellSize + cellSize / 2, row * cellSize + cellSize / 2);
  }

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
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
      ['uHeld', new Uniform(0)],
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
  setHeld(v) { this.uniforms.get('uHeld').value = v; }
}

export { ASCIIEffect, getCellSize };
