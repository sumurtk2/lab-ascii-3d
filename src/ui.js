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
