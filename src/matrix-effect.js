/**
 * Matrix Rain Post-Processing Effect
 * Green falling characters with 3D model emerging from within the rain
 */

import { Effect } from 'postprocessing';
import { Uniform, CanvasTexture, NearestFilter, Vector2, Color } from 'three';

const FRAGMENT_SHADER = /* glsl */`
uniform sampler2D uCharacters;
uniform float uCharactersCount;
uniform float uCellSize;
uniform float uTime;
uniform vec3 uHighlightColor;
uniform vec3 uRainColor;
uniform vec3 uBackgroundColor;
uniform float uRainSpeed;
uniform float uRainDensity;
uniform float uReveal;
uniform vec2 uMouse;
uniform float uHoverRadius;
uniform float uVelocity;

float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}

float random2(vec2 st) {
    return fract(sin(dot(st, vec2(45.5432, 98.1234))) * 12345.6789);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 cell = resolution / uCellSize;
    vec2 grid = 1.0 / cell;

    // Which cell are we in?
    vec2 cellCoord = floor(uv / grid);
    vec2 cellUV = fract(uv * cell);

    // Sample the scene (model)
    vec2 pixelizedUV = grid * (0.5 + cellCoord);
    vec4 sceneColor = texture2D(inputBuffer, pixelizedUV);
    float sceneBrightness = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));

    // Reveal animation
    float yPos = 1.0 - uv.y;
    if (yPos > uReveal) {
        outputColor = vec4(uBackgroundColor, 1.0);
        return;
    }

    // === MATRIX RAIN ===
    float colId = cellCoord.x;
    float rowId = cellCoord.y;
    float totalRows = cell.y;

    // Each column has unique properties
    float colSeed = random(vec2(colId, 0.0));
    float colSpeed = 0.5 + colSeed * 1.5; // Speed varies per column
    float colOffset = random(vec2(colId, 1.0)) * 100.0; // Start offset
    float dropLength = 8.0 + random(vec2(colId, 2.0)) * 20.0; // Trail length

    // Rain position (head of the drop)
    float rainPos = mod(uTime * uRainSpeed * colSpeed + colOffset, totalRows + dropLength + 10.0);

    // How far is this cell from the rain head? (inverted Y: top=0, bottom=totalRows)
    float cellY = totalRows - rowId;
    float distFromHead = rainPos - cellY;

    // Rain brightness: bright at head, fading trail behind
    float rainBrightness = 0.0;
    if (distFromHead > 0.0 && distFromHead < dropLength) {
        // In the trail
        float trailFade = 1.0 - (distFromHead / dropLength);
        rainBrightness = trailFade * trailFade; // Quadratic falloff
    }
    if (distFromHead > -1.0 && distFromHead <= 0.0) {
        // At the head — brightest
        rainBrightness = 1.0;
    }

    // Add a second, shorter rain stream per column for density
    float colSeed2 = random(vec2(colId, 3.0));
    float colSpeed2 = 0.3 + colSeed2 * 1.0;
    float colOffset2 = random(vec2(colId, 4.0)) * 100.0;
    float dropLength2 = 5.0 + random(vec2(colId, 5.0)) * 12.0;
    float rainPos2 = mod(uTime * uRainSpeed * colSpeed2 + colOffset2, totalRows + dropLength2 + 15.0);
    float distFromHead2 = rainPos2 - cellY;

    if (distFromHead2 > 0.0 && distFromHead2 < dropLength2) {
        float trail2 = 1.0 - (distFromHead2 / dropLength2);
        rainBrightness = max(rainBrightness, trail2 * trail2 * 0.6);
    }
    if (distFromHead2 > -1.0 && distFromHead2 <= 0.0) {
        rainBrightness = max(rainBrightness, 0.8);
    }

    // Apply density threshold
    if (colSeed > uRainDensity) {
        // Only apply second stream if it exists
        if (colSeed2 > uRainDensity * 0.7) {
            rainBrightness *= 0.15; // Dim ambient flicker
        }
    }

    // Mouse hover scramble
    vec2 mouseUV = vec2(uMouse.x, 1.0 - uMouse.y);
    float aspect = resolution.x / resolution.y;
    vec2 aUV = vec2(uv.x * aspect, uv.y);
    vec2 aMouse = vec2(mouseUV.x * aspect, mouseUV.y);
    float mouseDist = distance(aUV, aMouse);

    if (mouseDist < uHoverRadius) {
        float falloff = smoothstep(uHoverRadius, 0.0, mouseDist);
        float intensity = clamp(uVelocity * 5.0, 0.0, 1.0);
        rainBrightness = max(rainBrightness, falloff * intensity * 0.8);
    }

    // === MODEL INTEGRATION ===
    // The model "lights up" the rain — brighter, whiter characters where the model is
    float modelInfluence = smoothstep(0.05, 0.3, sceneBrightness);

    // Combine: model areas get boosted brightness
    float combinedBrightness = max(rainBrightness, modelInfluence * 0.9);

    // Pick a character — model areas use scene brightness, rain uses cycling random chars
    float charIndex;
    if (modelInfluence > 0.2) {
        // Model area: map scene brightness to character
        charIndex = floor((uCharactersCount - 1.0) * sceneBrightness);
    } else {
        // Rain area: random cycling characters
        float charCycle = floor(uTime * 4.0 + random(cellCoord) * 50.0);
        charIndex = mod(floor(random(cellCoord + charCycle) * uCharactersCount), uCharactersCount);
    }

    // Look up character in atlas
    float col = mod(charIndex, 16.0);
    float row = floor(charIndex / 16.0);
    vec2 charUV = (vec2(col, row) + cellUV) / 16.0;
    float charPixel = texture2D(uCharacters, charUV).r;

    // Color: rain is green, model highlight is brighter/whiter
    vec3 rainGreen = uRainColor * rainBrightness;
    vec3 modelHighlight = uHighlightColor * modelInfluence;
    vec3 charColor = max(rainGreen, modelHighlight);

    // Add extra glow at rain head
    bool isHead = (distFromHead > -1.0 && distFromHead <= 0.0) ||
                  (distFromHead2 > -1.0 && distFromHead2 <= 0.0);
    if (isHead) {
        charColor = mix(charColor, vec3(0.8, 1.0, 0.8), 0.5);
    }

    // Ambient dim characters everywhere (background noise)
    float ambient = random(cellCoord + floor(uTime * 2.0)) * 0.06;
    combinedBrightness = max(combinedBrightness, ambient);

    // Final output
    vec3 finalColor = mix(uBackgroundColor, charColor, charPixel * combinedBrightness);
    outputColor = vec4(finalColor, 1.0);
}
`;

// Matrix-style character set (katakana-inspired + numbers + symbols)
const MATRIX_CHARS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789:・.=*+-<>¦|_";

function createCharactersTexture(characters, fontSize) {
  const size = 1024;
  const cellSize = size / 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
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

class MatrixEffect extends Effect {
  constructor(options = {}) {
    const {
      fontSize = 48,
      cellSize = 16,
      rainColor = '#00ff41',
      highlightColor = '#aaffcc',
      backgroundColor = '#000000',
      rainSpeed = 1.0,
      rainDensity = 0.7,
    } = options;

    const characters = MATRIX_CHARS;

    const uniforms = new Map([
      ['uCharacters', new Uniform(null)],
      ['uCellSize', new Uniform(cellSize)],
      ['uCharactersCount', new Uniform(characters.length)],
      ['uRainColor', new Uniform(new Color(rainColor))],
      ['uHighlightColor', new Uniform(new Color(highlightColor))],
      ['uBackgroundColor', new Uniform(new Color(backgroundColor))],
      ['uRainSpeed', new Uniform(rainSpeed)],
      ['uRainDensity', new Uniform(rainDensity)],
      ['uTime', new Uniform(0)],
      ['uReveal', new Uniform(1.0)],
      ['uMouse', new Uniform(new Vector2(-9999, -9999))],
      ['uHoverRadius', new Uniform(0.15)],
      ['uVelocity', new Uniform(0)],
    ]);

    super('MatrixEffect', FRAGMENT_SHADER, { uniforms });

    try {
      const charTexture = createCharactersTexture(characters, fontSize);
      this.uniforms.get('uCharacters').value = charTexture;
      console.log('[Matrix] Effect ready, chars:', characters.length);
    } catch (e) {
      console.error('[Matrix] Texture creation failed:', e);
    }
  }

  setCellSize(v) { this.uniforms.get('uCellSize').value = v; }
  setRainColor(hex) { this.uniforms.get('uRainColor').value.set(hex); }
  setHighlightColor(hex) { this.uniforms.get('uHighlightColor').value.set(hex); }
  setBackgroundColor(hex) { this.uniforms.get('uBackgroundColor').value.set(hex); }
  setReveal(v) { this.uniforms.get('uReveal').value = Math.max(0, Math.min(1, v)); }
  setMouse(x, y) { this.uniforms.get('uMouse').value.set(x, y); }
  setTime(v) { this.uniforms.get('uTime').value = v; }
  setVelocity(v) { this.uniforms.get('uVelocity').value = v; }
}

export { MatrixEffect };
