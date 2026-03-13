/**
 * UI Interactions
 * Theme toggle, chat interface, typewriter effect
 */

// ---- Hardcoded chat responses ----
const RESPONSES = {
  'What is this?':
    'This is an experimental 3D showcase by Sumur Digital. A battle-scarred sci-fi helmet rendered through a custom ASCII post-processing shader — every pixel becomes a character.',
  'What tech powers this?':
    'Three.js for 3D rendering, a custom GLSL fragment shader for the ASCII effect, Vite for the build system, and vanilla JS for the UI. No frameworks needed.',
  'Who built this?':
    'Built by Sumur Digital (sumurdigital.com) — a web design and development studio based in Jaén, Spain. This is our 3D lab playground.',
};

// Default response for unrecognized input
const DEFAULT_RESPONSE =
  "Interesting question. This is just a demo — but imagine an AI answering here. For now, try one of the suggestion buttons above.";

/**
 * Typewriter effect for chat messages
 */
function typewriterAppend(container, role, text, speed = 18) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';

  const roleSpan = document.createElement('span');
  roleSpan.className = 'role';
  roleSpan.textContent = role;

  const textSpan = document.createElement('span');
  textSpan.className = 'text';

  msgEl.appendChild(roleSpan);
  msgEl.appendChild(textSpan);
  container.appendChild(msgEl);

  let i = 0;
  function tick() {
    if (i < text.length) {
      textSpan.textContent += text[i];
      i++;
      container.scrollTop = container.scrollHeight;
      setTimeout(tick, speed);
    }
  }
  tick();
}

/**
 * Add a user message (no typewriter)
 */
function addUserMessage(container, text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';
  msgEl.innerHTML = `<span class="role">you ›</span><span class="text">${text}</span>`;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

/**
 * Handle a chat question
 */
function handleQuestion(question, messagesContainer) {
  addUserMessage(messagesContainer, question);

  const response = RESPONSES[question] || DEFAULT_RESPONSE;

  // Small delay before "typing" response
  setTimeout(() => {
    typewriterAppend(messagesContainer, 'lab ›', response);
  }, 400);
}

/**
 * Initialize all UI interactions
 */
export function initUI(sceneAPI) {
  // ---- Theme toggle ----
  const html = document.documentElement;
  const toggleBtn = document.getElementById('theme-toggle');
  const iconMoon = document.getElementById('icon-moon');
  const iconSun = document.getElementById('icon-sun');

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';

    iconMoon.classList.toggle('hidden', !isDark);
    iconSun.classList.toggle('hidden', isDark);

    if (sceneAPI) {
      sceneAPI.setTheme(isDark);
    }

    localStorage.setItem('theme', theme);
  }

  // Load saved preference
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  toggleBtn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  // ---- Model switcher ----
  const modelBtns = document.querySelectorAll('.model-btn');
  modelBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const model = btn.getAttribute('data-model');
      if (!model || !sceneAPI) return;
      modelBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      sceneAPI.loadModel(model);
    });
  });

  // ---- Talk button ----
  const talkBtn = document.getElementById('talk-btn');
  if (talkBtn) {
    talkBtn.classList.add('hidden');
    talkBtn.addEventListener('click', () => {
      if (!sceneAPI) return;
      const isTalking = sceneAPI.toggleTalk();
      talkBtn.textContent = isTalking ? '■ STOP' : '▶ TALK';
      talkBtn.classList.toggle('talking', isTalking);
    });

    document.addEventListener('lipsync-ready', (e) => {
      if (e.detail.ready) {
        talkBtn.classList.remove('hidden');
        talkBtn.textContent = '▶ TALK';
        talkBtn.classList.remove('talking');
      } else {
        talkBtn.classList.add('hidden');
      }
    });
  }

  // ---- Lighting toggle ----
  const lightBtn = document.getElementById('lighting-btn');
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      if (!sceneAPI) return;
      const mode = sceneAPI.toggleLighting();
      lightBtn.textContent = mode === 'enhanced' ? '✦ ENHANCED' : '☀ FLAT';
      lightBtn.classList.toggle('enhanced', mode === 'enhanced');
    });
  }

  // ---- Sliders panel ----
  const slidersToggle = document.getElementById('sliders-toggle');
  const slidersPanel = document.getElementById('sliders-panel');

  if (slidersToggle && slidersPanel) {
    slidersToggle.addEventListener('click', () => {
      slidersPanel.classList.toggle('hidden');
      slidersToggle.classList.toggle('enhanced', !slidersPanel.classList.contains('hidden'));
    });

    const sliders = [
      { id: 'sl-ambient', val: 'sv-ambient', fn: (v) => sceneAPI?.setAmbient(v), fmt: (v) => v.toFixed(1) },
      { id: 'sl-key', val: 'sv-key', fn: (v) => sceneAPI?.setKeyLight(v), fmt: (v) => v.toFixed(1) },
      { id: 'sl-rim', val: 'sv-rim', fn: (v) => sceneAPI?.setRimLight(v), fmt: (v) => v.toFixed(1) },
      { id: 'sl-rough', val: 'sv-rough', fn: (v) => sceneAPI?.setRoughness(v), fmt: (v) => v.toFixed(2) },
      { id: 'sl-metal', val: 'sv-metal', fn: (v) => sceneAPI?.setMetalness(v), fmt: (v) => v.toFixed(2) },
      { id: 'sl-env', val: 'sv-env', fn: (v) => sceneAPI?.setEnvIntensity(v), fmt: (v) => v.toFixed(2) },
    ];

    for (const s of sliders) {
      const input = document.getElementById(s.id);
      const display = document.getElementById(s.val);
      if (input && display) {
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          display.textContent = s.fmt(v);
          s.fn(v);
        });
      }
    }

    // Sync sliders when lighting mode changes
    const syncSliders = () => {
      const mode = sceneAPI?.getLighting();
      const presets = {
        flat: { ambient: 2, key: 4, rim: 2, rough: 0.5, metal: 0, env: 0 },
        enhanced: { ambient: 0.8, key: 5, rim: 4, rough: 0.4, metal: 0.1, env: 1.2 },
      };
      const p = presets[mode] || presets.flat;
      const ids = ['ambient', 'key', 'rim', 'rough', 'metal', 'env'];
      const vals = [p.ambient, p.key, p.rim, p.rough, p.metal, p.env];
      ids.forEach((id, i) => {
        const input = document.getElementById('sl-' + id);
        const display = document.getElementById('sv-' + id);
        if (input) input.value = vals[i];
        if (display) display.textContent = sliders[i].fmt(vals[i]);
      });
    };

    // Sync when lighting button is clicked
    if (lightBtn) {
      lightBtn.addEventListener('click', () => setTimeout(syncSliders, 50));
    }

    // Sync when model-specific lighting is applied
    document.addEventListener('lighting-changed', (e) => {
      const L = e.detail;
      const map = { ambient: L.ambient, key: L.key, rim: L.rim, rough: L.rough, metal: L.metal, env: L.env };
      const ids = ['ambient', 'key', 'rim', 'rough', 'metal', 'env'];
      ids.forEach((id, i) => {
        const input = document.getElementById('sl-' + id);
        const display = document.getElementById('sv-' + id);
        const v = map[id];
        if (input) input.value = v;
        if (display) display.textContent = sliders[i].fmt(v);
      });
    });
  }

  // ---- Chat ----
  const messagesContainer = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const suggestionBtns = document.querySelectorAll('.suggestion-btn');

  // Suggestion buttons
  suggestionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const question = btn.getAttribute('data-question');
      if (question) {
        handleQuestion(question, messagesContainer);
      }
    });
  });

  // Chat input
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const question = chatInput.value.trim();
      if (question) {
        handleQuestion(question, messagesContainer);
        chatInput.value = '';
      }
    }
  });
}
