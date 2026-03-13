/**
 * Simple lip sync — procedural viseme animation
 * Cycles through mouth shapes to simulate talking.
 * Can be driven by audio amplitude or auto-demo.
 */

// Oculus viseme sequence for natural speech pattern
const VISEME_SEQUENCE = [
  'viseme_sil', 'viseme_aa', 'viseme_O', 'viseme_sil',
  'viseme_E', 'viseme_FF', 'viseme_sil', 'viseme_DD',
  'viseme_aa', 'viseme_kk', 'viseme_I', 'viseme_sil',
  'viseme_SS', 'viseme_nn', 'viseme_U', 'viseme_sil',
  'viseme_TH', 'viseme_RR', 'viseme_aa', 'viseme_sil',
  'viseme_PP', 'viseme_CH', 'viseme_E', 'viseme_sil',
];

const ALL_VISEMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH',
  'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS',
  'viseme_nn', 'viseme_RR', 'viseme_aa', 'viseme_E',
  'viseme_I', 'viseme_O', 'viseme_U',
];

// Happy/relaxed expression targets
const HAPPY_MORPHS = {
  mouthSmileLeft: 0.55,
  mouthSmileRight: 0.55,
  cheekSquintLeft: 0.25,
  cheekSquintRight: 0.25,
  browInnerUp: 0.15,
  browOuterUpLeft: 0.1,
  browOuterUpRight: 0.1,
};

// Annoyed expression targets — clearly pissed
const ANNOYED_MORPHS = {
  browDownLeft: 0.9,
  browDownRight: 0.9,
  browInnerUp: 0.4,
  eyeSquintLeft: 0.6,
  eyeSquintRight: 0.6,
  noseSneerLeft: 0.5,
  noseSneerRight: 0.5,
  mouthFrownLeft: 0.7,
  mouthFrownRight: 0.7,
  mouthPressLeft: 0.5,
  mouthPressRight: 0.5,
  mouthShrugLower: 0.3,
  jawForward: 0.25,
  cheekPuff: 0.2,
};

export class LipSync {
  constructor() {
    this.meshes = [];       // Meshes with morph targets
    this.morphMap = {};     // name → { mesh, index } for each viseme
    this.talking = false;
    this.talkStart = 0;
    this.visemeSpeed = 8;   // visemes per second
    this.blinkTimer = 0;
    this.nextBlink = 2 + Math.random() * 4;
    this.blinkPhase = 0;    // 0=open, >0 = blinking
    this.held = false;      // user is grabbing the model
    this.heldAmount = 0;    // 0→1 ease into annoyed expression
  }

  /**
   * Scan a loaded GLTF scene for meshes with morph targets
   */
  setup(model) {
    this.meshes = [];
    this.morphMap = {};

    model.traverse((node) => {
      if (node.isMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
        this.meshes.push(node);
        for (const [name, index] of Object.entries(node.morphTargetDictionary)) {
          if (!this.morphMap[name]) {
            this.morphMap[name] = [];
          }
          this.morphMap[name].push({ mesh: node, index });
        }
      }
    });

    console.log('[LipSync] Found', this.meshes.length, 'meshes with morphs');
    console.log('[LipSync] Available:', Object.keys(this.morphMap).join(', '));
    return this.meshes.length > 0;
  }

  /**
   * Set a morph target value across all meshes
   */
  setMorph(name, value) {
    const targets = this.morphMap[name];
    if (!targets) return;
    for (const { mesh, index } of targets) {
      mesh.morphTargetInfluences[index] = value;
    }
  }

  /**
   * Reset all visemes to 0
   */
  resetVisemes() {
    for (const name of ALL_VISEMES) {
      this.setMorph(name, 0);
    }
    this.setMorph('jawOpen', 0);
  }

  /**
   * Start talking animation
   */
  startTalking() {
    this.talking = true;
    this.talkStart = performance.now();
  }

  /**
   * Stop talking animation
   */
  stopTalking() {
    this.talking = false;
    this.resetVisemes();
  }

  /**
   * Toggle talk state
   */
  toggle() {
    if (this.talking) this.stopTalking();
    else this.startTalking();
    return this.talking;
  }

  /**
   * Set held state (user dragging the model)
   */
  setHeld(isHeld) {
    this.held = isHeld;
  }

  /**
   * Call every frame
   */
  update(dt) {
    this._updateHeld(dt);
    this._updateBlink(dt);
    this._updateTalk();
  }

  _updateHeld(dt) {
    const target = this.held ? 1 : 0;
    const speed = this.held ? 3 : 1.5;
    this.heldAmount += (target - this.heldAmount) * speed * dt;
    this.heldAmount = Math.max(0, Math.min(1, this.heldAmount));

    // Idle mood: smooth oscillation between neutral and happy
    const now = performance.now() / 1000;
    // Two layered sine waves for organic feel (different speeds)
    const wave1 = Math.sin(now * 0.4) * 0.5 + 0.5;   // slow wave ~10s cycle
    const wave2 = Math.sin(now * 0.17) * 0.5 + 0.5;   // very slow ~37s cycle
    const happyAmount = (wave1 * 0.6 + wave2 * 0.4);   // 0→1 blend

    // When held: annoyed overrides happy
    const annoyedWeight = this.heldAmount;
    const happyWeight = (1 - annoyedWeight) * happyAmount;

    // Apply happy expression (fades out when annoyed)
    for (const [name, maxVal] of Object.entries(HAPPY_MORPHS)) {
      this.setMorph(name, maxVal * happyWeight);
    }

    // Apply annoyed expression
    for (const [name, maxVal] of Object.entries(ANNOYED_MORPHS)) {
      this.setMorph(name, maxVal * annoyedWeight);
    }
  }

  _updateBlink(dt) {
    this.blinkTimer += dt;

    const blinkSpeedMul = this.held ? 2 : 1; // 2x faster blinks when held

    if (this.blinkPhase > 0) {
      this.blinkPhase += dt * 8 * blinkSpeedMul;
      const v = this.blinkPhase < 1 ? this.blinkPhase : Math.max(0, 2 - this.blinkPhase);
      this.setMorph('eyeBlinkLeft', v);
      this.setMorph('eyeBlinkRight', v);
      if (this.blinkPhase >= 2) {
        this.blinkPhase = 0;
        this.setMorph('eyeBlinkLeft', 0);
        this.setMorph('eyeBlinkRight', 0);
      }
    }

    // Blink interval: halved when held
    const interval = this.held ? (1 + Math.random() * 2) : (2 + Math.random() * 4);
    if (this.blinkTimer >= this.nextBlink && this.blinkPhase === 0) {
      this.blinkPhase = 0.01;
      this.blinkTimer = 0;
      this.nextBlink = interval;
    }
  }

  _updateTalk() {
    if (!this.talking) return;

    const elapsed = (performance.now() - this.talkStart) / 1000;
    const seqLen = VISEME_SEQUENCE.length;
    const pos = (elapsed * this.visemeSpeed) % seqLen;
    const idx = Math.floor(pos);
    const frac = pos - idx;

    const current = VISEME_SEQUENCE[idx];
    const next = VISEME_SEQUENCE[(idx + 1) % seqLen];

    // Smooth interpolation between visemes
    // Reset all first
    for (const name of ALL_VISEMES) {
      this.setMorph(name, 0);
    }

    // Blend current → next
    const eased = frac * frac * (3 - 2 * frac); // smoothstep
    if (current !== 'viseme_sil') {
      this.setMorph(current, 1 - eased);
    }
    if (next !== 'viseme_sil') {
      this.setMorph(next, eased);
    }

    // Jaw follows the "openness" of the current viseme
    const openVisemes = ['viseme_aa', 'viseme_O', 'viseme_E', 'viseme_I', 'viseme_U'];
    const isOpen = openVisemes.includes(current) || openVisemes.includes(next);
    const jawTarget = isOpen ? 0.4 + 0.2 * Math.sin(elapsed * 6) : 0.05;
    this.setMorph('jawOpen', jawTarget);
  }
}
