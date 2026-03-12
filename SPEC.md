# Project: ASCII 3D Portfolio Site

## Overview
Build a retro-styled single-page site featuring a 3D model rendered through an ASCII art post-processing shader. Inspired by matthewpetersen.ca but with our own identity. This will be deployed as static files on Apache.

## Tech Stack
- **Vite** for build (already installed)
- **Three.js** + **postprocessing** (already installed)
- Vanilla JS (no React)
- Custom CSS (no Tailwind — keep it simple)
- Google Fonts: `JetBrains Mono` (monospace)

## File Structure
```
├── index.html
├── src/
│   ├── main.js          # Entry point
│   ├── scene.js          # Three.js scene setup + model loading
│   ├── ascii-effect.js   # Custom ASCII post-processing effect
│   ├── ui.js             # UI interactions (theme toggle, chat)
│   └── style.css         # All styles
├── public/
│   └── models/
│       └── model.glb     # Already downloaded (DamagedHelmet)
├── vite.config.js
└── package.json
```

## Core Features

### 1. ASCII Post-Processing 3D Viewer (THE STAR)
The main visual: a Three.js scene with a .glb model rendered through a custom ASCII character post-processing shader.

**ASCII Shader (GLSL)** — Use the `postprocessing` library's Effect system. Create a custom `ASCIIEffect` class that extends `Effect`:

```glsl
// Fragment shader uniforms
uniform sampler2D uCharacters;   // Texture atlas of ASCII chars
uniform float uCharactersCount;  // Number of characters in set
uniform float uCellSize;         // Size of each ASCII cell in pixels
uniform float uInvertAmount;     // Invert brightness (0 or 1)
uniform vec3 uColor;             // Text color
uniform vec3 uBackgroundColor;   // Background color
uniform float uBlend;            // Blend with original (0-1)
uniform float uReveal;           // Reveal animation progress (0-1)
uniform vec2 uMouse;             // Mouse position in UV
uniform float uHoverRadius;      // Radius of hover effect
uniform float uTime;             // Elapsed time
uniform float uVelocity;         // Mouse velocity

const vec2 SIZE = vec2(16.); // Character atlas grid size

vec3 greyscale(vec3 color) {
    float g = dot(color, vec3(0.299, 0.587, 0.114));
    return vec3(g);
}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 cell = resolution / uCellSize;
    vec2 grid = 1.0 / cell;
    vec2 pixelizedUV = grid * (0.5 + floor(uv / grid));
    
    vec4 pixelized = texture2D(inputBuffer, pixelizedUV);
    
    // Reveal animation (top to bottom)
    float yPos = 1.0 - uv.y;
    if (yPos > uReveal) {
        outputColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    float brightness = greyscale(pixelized.rgb).r;

    // Mouse hover scramble effect
    vec2 mouseUV = vec2(uMouse.x, 1.0 - uMouse.y);
    float aspect = resolution.x / resolution.y;
    vec2 aspectCorrectedUV = vec2(uv.x * aspect, uv.y);
    vec2 aspectCorrectedMouse = vec2(mouseUV.x * aspect, mouseUV.y);
    
    float dist = distance(aspectCorrectedUV, aspectCorrectedMouse);
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

    // Map brightness to character
    float finalInvert = uInvertAmount;
    float greyscaled = mix(brightness, 1.0 - brightness, finalInvert);
    
    float characterIndex = floor((uCharactersCount - 1.0) * greyscaled);
    vec2 characterPosition = vec2(mod(characterIndex, SIZE.x), floor(characterIndex / SIZE.y));
    vec2 offset = vec2(characterPosition.x, -characterPosition.y) / SIZE;
    vec2 charUV = mod(uv * (cell / SIZE), 1.0 / SIZE) - vec2(0., 1.0 / SIZE) + offset;
    vec4 asciiCharacter = texture2D(uCharacters, charUV);

    vec3 finalColor = mix(uBackgroundColor, uColor, asciiCharacter.r);
    outputColor = vec4(finalColor, 1.0);
}
```

**Character set:** ` .:,'-^=*+?!|0#X%WM@`

**Character texture generation:** Create a canvas (1024x1024), draw each character in a 16-column grid (64px per cell), use that as the uCharacters texture.

**PostProcessing pipeline:**
```js
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing';
// 1. RenderPass (scene, camera)
// 2. EffectPass with our custom ASCIIEffect
```

**Reveal animation on load:** 
- Start with uCellSize very large (like 50px) and uReveal at 0
- Over 1.5-2 seconds, animate uReveal from 0 → 1 (top to bottom reveal)
- Simultaneously shrink uCellSize from 50 → 12 (sharpening the ASCII)

**Mouse interaction:**
- Track mouse position over the canvas
- Calculate mouse velocity
- Pass to shader for the scramble effect (characters randomize near fast mouse movement)
- Decay velocity smoothly (multiply by ~0.92 each frame)

### 2. Theme (Light/Dark)
- Default: **dark** (black BG, white ASCII)
- Toggle button in bottom-right corner
- Light mode: white/light gray BG, dark ASCII characters
- CSS variables for all colors
- Smooth transitions

**CSS Variables:**
```css
[data-theme="dark"] {
  --surface: #0a0a0a;
  --foreground: #e0e0e0;
  --muted: #666;
  --panel: #111;
  --panel-border: #333;
  --accent: #00ff88;
}
[data-theme="light"] {
  --surface: #f0f0f0;
  --foreground: #1a1a1a;
  --muted: #888;
  --panel: #fff;
  --panel-border: #ccc;
  --accent: #0066ff;
}
```

### 3. Layout
Top to bottom:
1. **Brand name** in large pixel/monospace text — use "SUMUR DIGITAL" or "LAB" in big blocky letters
2. **3D ASCII viewer** — takes up ~55vh
3. **Chat panel** — bordered box with retro styling
4. **Footer** with social links

### 4. Chat Interface (Static Placeholder)
- Bordered panel with monospace font
- A few pre-written suggestion buttons ("Tell me about this project", "What tech is this?", "Who built this?")
- Text input at bottom with a `⣿` braille prefix
- No actual AI backend yet — just clicking a suggestion shows a hardcoded response
- Responses appear with a typewriter animation

### 5. Retro Aesthetic Details
- **Scanline overlay** — faint repeating horizontal lines via CSS pseudo-element
- **CRT vignette** — subtle darkening at edges via radial gradient overlay
- **Monospace everything** — JetBrains Mono
- **Subtle animations** — elements fade in with slight Y-translation on scroll

### 6. Responsive
- Desktop: 3D viewer fills more space, chat panel side by side or below
- Mobile: everything stacks, 3D viewer slightly shorter
- 3D viewer resizes properly (update renderer + composer size on resize)

## Model Setup
- Load `/models/model.glb` with GLTFLoader
- Center the model and frame it nicely
- Add orbit controls (rotate, zoom) but with limits
- Lighting: ambient (soft white, intensity ~2) + directional (slightly blue-tinted, strong)
- The DamagedHelmet model should be rotated to face the camera

## Vite Config
```js
export default {
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
}
```

## Build Output
Run `npm run build` → outputs to `dist/` folder, ready for Apache deployment.

## Important Notes
- NO React, NO frameworks — vanilla JS only
- Keep it clean and well-commented
- The ASCII shader is the hero — make sure it looks great
- The model.glb is already in public/models/ — don't try to download it
- Use ES modules throughout
- Add `"type": "module"` to package.json
- Add scripts: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`
