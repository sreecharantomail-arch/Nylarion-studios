/* =============================================================
   1. LOADING SCREEN ANIMATION LOGIC
============================================================= */
window.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('loader-screen');
  const bar = document.getElementById('loader-bar');
  const percentText = document.getElementById('loader-percent');
  const statusText = document.getElementById('loader-text');

  const statuses = [
    "INITIALIZING ENGINE...",
    "COMPILING SHADERS...",
    "LOADING HIGH-RES EMBLEM...",
    "CONNECTING REALM SERVERS...",
    "PREPARING NYLARION CORE..."
  ];

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 12) + 5;
    if (progress > 100) progress = 100;

    if (bar) bar.style.width = progress + '%';
    if (percentText) percentText.textContent = progress + '%';

    const statusIdx = Math.min(Math.floor((progress / 100) * statuses.length), statuses.length - 1);
    if (statusText) statusText.textContent = statuses[statusIdx];

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (loader) loader.classList.add('hidden');
      }, 400);
    }
  }, 120);
});

/* =============================================================
   2. THREE.JS SCENE & 100% COLOR-ACCURATE 3D LOGO
============================================================= */
(function init3DLogo() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const fallbackLogo = container.querySelector('.hero-center-logo');
  // Keep a visible logo if the CDN/WebGL is unavailable or the texture fails to load.
  const fallbackTimer = setTimeout(() => {
    if (fallbackLogo) fallbackLogo.classList.add('show');
  }, 1800);

  if (!window.THREE) {
    if (fallbackLogo) fallbackLogo.classList.add('show');
    clearTimeout(fallbackTimer);
    return;
  }

  const width = container.clientWidth || 400;
  const height = container.clientHeight || 360;

  // Scene, Camera, Renderer (with sRGB Color Accuracy)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 6.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (THREE.sRGBEncoding) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  container.appendChild(renderer.domElement);

  const mainGroup = new THREE.Group();

  // Real-time Canvas Background Cutout Generator (Preserves 100% Original RGB Values)
  function loadAccurateColorCutout(imageSrc, callback) {
    const img = new Image();
    img.onload = () => {
      if (fallbackLogo) fallbackLogo.classList.remove('show');
      clearTimeout(fallbackTimer);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Remove dark background pixels without touching original RGB hues
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Remove dark background tones (#04080e, #090f18)
        if (r < 24 && g < 28 && b < 32) {
          data[i + 3] = 0; // Alpha 0
        } else if (r < 38 && g < 42 && b < 48) {
          const avg = (r + g + b) / 3;
          data[i + 3] = Math.min(255, (avg - 18) * 12);
        }
      }

      ctx.putImageData(imgData, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (THREE.sRGBEncoding) {
        texture.encoding = THREE.sRGBEncoding;
      }
      callback(texture);
    };
    img.onerror = () => {
      if (fallbackLogo) fallbackLogo.classList.add('show');
      clearTimeout(fallbackTimer);
    };
    img.src = imageSrc;
  }

  // Load Cutout Emblem into 3D Space using MeshBasicMaterial for 100% Color Accuracy
  loadAccurateColorCutout('assets/images/logo.png', (accurateTexture) => {
    // Primary Emblem Front Plane (Un-tinted, 100% color accurate, elongated middle length)
    const geometry = new THREE.PlaneGeometry(5.4, 4.2);
    const material = new THREE.MeshBasicMaterial({
      map: accurateTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const logoMesh = new THREE.Mesh(geometry, material);
    mainGroup.add(logoMesh);

    // Layer 2: Subtle Cyan Depth Glow Layer
    const cyanGlowGeo = new THREE.PlaneGeometry(5.48, 4.28);
    const cyanGlowMat = new THREE.MeshBasicMaterial({
      map: accurateTexture,
      transparent: true,
      opacity: 0.45,
      color: 0x00f0ff,
      side: THREE.DoubleSide
    });
    const cyanGlowMesh = new THREE.Mesh(cyanGlowGeo, cyanGlowMat);
    cyanGlowMesh.position.z = -0.06;
    mainGroup.add(cyanGlowMesh);

    // Layer 3: Subtle Gold Depth Glow Layer
    const goldGlowGeo = new THREE.PlaneGeometry(5.56, 4.36);
    const goldGlowMat = new THREE.MeshBasicMaterial({
      map: accurateTexture,
      transparent: true,
      opacity: 0.35,
      color: 0xdfb260,
      side: THREE.DoubleSide
    });
    const goldGlowMesh = new THREE.Mesh(goldGlowGeo, goldGlowMat);
    goldGlowMesh.position.z = -0.12;
    mainGroup.add(goldGlowMesh);
  });

  scene.add(mainGroup);

  /* =============================================================
     3. PARTICLES & FLOATING COLOR DOTS
  ============================================================= */
  const particlesGeo = new THREE.BufferGeometry();
  const count = 280;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const colorCyan = new THREE.Color(0x00f0ff);
  const colorGold = new THREE.Color(0xdfb260);

  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 24;
    positions[i + 1] = (Math.random() - 0.5) * 15;
    positions[i + 2] = (Math.random() - 0.5) * 12;

    const c = Math.random() > 0.4 ? colorCyan : colorGold;
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }

  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particlesMat = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.85
  });

  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  /* =============================================================
     4. MOUSE & TOUCH INTERACTION HANDLERS
  ============================================================= */
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let targetRotationY = 0;
  let targetRotationX = 0;

  container.addEventListener('pointerdown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('pointermove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      targetRotationY += deltaX * 0.01;
      targetRotationX += deltaY * 0.01;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    } else {
      const rect = container.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      const mouseY = (e.clientY - rect.top) / rect.height - 0.5;

      if (mouseX >= -1 && mouseX <= 1 && mouseY >= -1 && mouseY <= 1) {
        targetRotationY = mouseX * 0.65;
        targetRotationX = mouseY * 0.4;
      }
    }
  });

  window.addEventListener('pointerup', () => { isDragging = false; });

  // Touch Support
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;

      targetRotationY += deltaX * 0.01;
      targetRotationX += deltaY * 0.01;

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  });

  window.addEventListener('touchend', () => { isDragging = false; });

  /* =============================================================
     5. SMOOTH SCROLL & RESIZE LISTENERS
  ============================================================= */
  function updateCameraForViewport() {
    const newW = container.clientWidth;
    const newH = container.clientHeight;
    camera.aspect = newW / newH;
    
    // Scale camera distance on smaller screens so the emblem fits nicely
    if (newW <= 480) {
      camera.position.z = 7.8;
    } else if (newW <= 768) {
      camera.position.z = 7.2;
    } else {
      camera.position.z = 6.8;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
  }

  // Initial camera setup
  updateCameraForViewport();

  window.addEventListener('resize', updateCameraForViewport);

  // Animation Loop
  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (!isDragging) {
      mainGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.10;
    }

    mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.08;
    mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.06;

    particles.rotation.y = elapsedTime * 0.02;

    renderer.render(scene, camera);
  }

  animate();
})();

/* =============================================================
   6. MOBILE NAVIGATION DRAWER TOGGLE
============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (mobileToggle && navMenu) {
    const toggleMenu = () => {
      const isOpen = navMenu.classList.contains('active');
      mobileToggle.classList.toggle('active');
      navMenu.classList.toggle('active');

      if (!isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };

    mobileToggle.addEventListener('click', toggleMenu);

    // Close mobile menu when a nav link is clicked
    const links = navMenu.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        if (navMenu.classList.contains('active')) {
          mobileToggle.classList.remove('active');
          navMenu.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });
  }
});


/* =============================================================
   7. NYLARION AI — AUTONOMOUS FLYING ROBOT
   The robot continuously flies around the visible webpage.
   Touch/click it -> flight stops and chat opens. Touch/click elsewhere -> robot flies toward that point and resumes.
   After the spoken answer finishes -> chat closes and flight resumes.
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const launch = document.getElementById('ny-ai-launch');
  const widget = document.getElementById('ny-ai-widget');
  const panel = document.getElementById('ny-ai-window');
  const close = document.getElementById('ny-ai-close');
  const voiceBtn = document.getElementById('ny-ai-voice');
  const form = document.getElementById('ny-ai-form');
  const input = document.getElementById('ny-ai-input');
  const messages = document.getElementById('ny-ai-messages');
  const status = document.getElementById('ny-ai-status');
  const quickPrompts = document.getElementById('ny-ai-quick-prompts');
  const micBtn = document.getElementById('ny-ai-mic');

  if (!launch || !widget || !panel || !form || !input || !messages) return;

  const greeting = "Hi, I'm Nylarion AI. Welcome to Nylarion Studios. Play Beyond Reality.";
  let welcomeSpoken = false;
  let welcomeFallbackArmed = true;
  let voices = [];
  let history = [];
  let busy = false;
  let chatOpen = false;
  let rafId = 0;
  let recognition = null;

  function loadVoices() {
    if ('speechSynthesis' in window) voices = window.speechSynthesis.getVoices();
  }
  loadVoices();
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadVoices;

  function addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'ny-ai-msg user';
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function addTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'ny-ai-typing';
    el.id = 'ny-ai-typing';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Nylarion AI is thinking');
    el.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTypingIndicator() { document.getElementById('ny-ai-typing')?.remove(); }

  function speak(text, done) {
    if (!('speechSynthesis' in window)) {
      if (status) status.textContent = 'Voice is not supported in this browser';
      if (typeof done === 'function') done();
      return false;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const preferred = voices.find(v => /^en(-|_)/i.test(v.lang) && /Google|Microsoft|Natural|Samantha|Daniel/i.test(v.name));
    utterance.voice = preferred || voices.find(v => /^en/i.test(v.lang)) || voices[0] || null;
    utterance.rate = 0.94;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    utterance.onstart = () => { if (status) status.textContent = 'Speaking...'; };
    utterance.onend = () => {
      if (typeof done === 'function') done();
    };
    utterance.onerror = () => {
      if (status) status.textContent = 'Voice unavailable';
      if (typeof done === 'function') done();
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  // -------------------------------------------------------------
  // FIRST-OPEN WELCOME VOICE
  // Try to welcome the visitor as soon as the webpage opens.
  // If the browser blocks autoplay speech, the first click/touch anywhere
  // will unlock it and play the welcome automatically.
  // -------------------------------------------------------------
  function speakWelcome() {
    if (welcomeSpoken || !('speechSynthesis' in window)) return false;
    welcomeSpoken = true;
    welcomeFallbackArmed = false;
    if (status) status.textContent = 'Welcome to Nylarion Studios...';
    speak(greeting);
    return true;
  }

  function welcomeOnFirstInteraction(event) {
    if (!welcomeFallbackArmed || welcomeSpoken) return;
    // Give the robot click handler a chance to process normally, but make
    // the welcome voice happen on the very first genuine user interaction.
    speakWelcome();
    document.removeEventListener('pointerdown', welcomeOnFirstInteraction, true);
  }

  document.addEventListener('pointerdown', welcomeOnFirstInteraction, true);

  async function checkBackend() {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Backend unavailable');
      const data = await response.json();
      if (status) status.textContent = data.aiConfigured
        ? `Nylarion AI connected (${data.model || 'OpenAI'})`
        : 'AI API key not configured';
      return data;
    } catch {
      if (status) status.textContent = 'Backend offline';
      return null;
    }
  }

  async function askBackend(text) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    });

    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Backend error (${response.status})`);
    if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('The assistant returned an empty response. Please try again.');
    return data.reply.trim();
  }

  /* -------------------------------------------------------------
     FLIGHT ENGINE
  ------------------------------------------------------------- */
  const flight = {
    x: 0, y: 0, tx: 0, ty: 0,
    vx: 0, vy: 0,
    paused: false,
    last: performance.now(),
    initialized: false
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function bounds() {
    const width = launch.offsetWidth || 112;
    const height = launch.offsetHeight || 126;
    return {
      minX: 8,
      maxX: Math.max(8, window.innerWidth - width - 8),
      minY: 18,
      maxY: Math.max(18, window.innerHeight - height - 18)
    };
  }

  function chooseTarget() {
    const b = bounds();
    // Deliberately use almost the whole visible viewport so the robot
    // travels across the webpage instead of hovering in one corner.
    flight.tx = b.minX + Math.random() * Math.max(1, b.maxX - b.minX);
    flight.ty = b.minY + Math.random() * Math.max(1, b.maxY - b.minY);
  }

  function chooseTargetAt(clientX, clientY) {
    const b = bounds();
    const width = launch.offsetWidth || 112;
    const height = launch.offsetHeight || 126;
    flight.tx = clamp(clientX - width / 2, b.minX, b.maxX);
    flight.ty = clamp(clientY - height / 2, b.minY, b.maxY);
  }

  function placeRobot(x, y) {
    const b = bounds();
    const left = clamp(x, b.minX, b.maxX);
    const top = clamp(y, b.minY, b.maxY);
    widget.style.left = `${left}px`;
    widget.style.top = `${top}px`;
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }

  function startFlight() {
    flight.paused = false;
    flight.last = performance.now();
    if (!flight.initialized) {
      const b = bounds();
      flight.x = b.minX + (b.maxX - b.minX) * 0.78;
      flight.y = b.minY + (b.maxY - b.minY) * 0.72;
      flight.initialized = true;
      placeRobot(flight.x, flight.y);
      chooseTarget();
    }
  }

  function pauseFlight() {
    flight.paused = true;
    launch.classList.add('ny-ai-stopped');
  }

  function resumeFlight() {
    chatOpen = false;
    panel.classList.remove('open');
    launch.classList.remove('ny-ai-stopped');
    flight.paused = false;
    flight.last = performance.now();
    chooseTarget();
    if (status) status.textContent = 'Nylarion AI flying...';
  }

  function finishConversation() {
    // Give the user a moment to hear the final word, then release the robot.
    setTimeout(() => {
      if (!busy) resumeFlight();
    }, 180);
  }

  function fly(now) {
    const dt = Math.min(0.04, Math.max(0.001, (now - flight.last) / 1000));
    flight.last = now;

    if (!flight.paused && !chatOpen) {
      const dx = flight.tx - flight.x;
      const dy = flight.ty - flight.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 24) {
        chooseTarget();
      }

      const nextDx = flight.tx - flight.x;
      const nextDy = flight.ty - flight.y;
      const nextDistance = Math.max(1, Math.hypot(nextDx, nextDy));
      const speed = 105;
      const step = Math.min(speed * dt, nextDistance);
      flight.vx = (nextDx / nextDistance) * step / Math.max(dt, 0.001);
      flight.vy = (nextDy / nextDistance) * step / Math.max(dt, 0.001);
      flight.x += (nextDx / nextDistance) * step;
      flight.y += (nextDy / nextDistance) * step;

      // Small floating wave makes the flight feel organic rather than robotic.
      const wave = Math.sin(now / 420) * 2.2;
      placeRobot(flight.x, flight.y + wave);
      const tilt = clamp(flight.vx * 0.045, -9, 9);
      launch.style.setProperty('--robot-flight-tilt', `${tilt}deg`);
    }

    rafId = requestAnimationFrame(fly);
  }

  startFlight();
  rafId = requestAnimationFrame(fly);

  // Attempt the welcome voice automatically when the webpage opens.
  // Browsers that block autoplay will use the first user interaction fallback.
  setTimeout(() => {
    speakWelcome();
  }, 900);

  launch.addEventListener('click', (event) => {
    event.stopPropagation();
    if (chatOpen) return;
    pauseFlight();
    chatOpen = true;
    panel.classList.add('open');
    if (status) status.textContent = 'Listening...';
    input.focus();
    // The welcome is already spoken on first page open/interaction.
    // Do not repeat it every time the robot is opened.
  });

  // Touch/click anywhere else: send the robot toward that point, close the
  // chat if it is open, and let autonomous flight continue from there.
  function moveRobotToTouch(event) {
    if (busy) return;
    const target = event.touches?.[0] || event.changedTouches?.[0] || event;
    if (!target || typeof target.clientX !== 'number') return;
    const targetEl = event.target;
    if (targetEl && (targetEl.closest?.('#ny-ai-launch') || targetEl.closest?.('#ny-ai-window'))) return;

    chooseTargetAt(target.clientX, target.clientY);
    if (chatOpen) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      resumeFlight();
    } else {
      flight.paused = false;
      launch.classList.remove('ny-ai-stopped');
      if (status) status.textContent = 'Nylarion AI flying...';
    }
  }

  document.addEventListener('pointerdown', moveRobotToTouch, { passive: true });

  close?.addEventListener('click', () => {
    if (busy) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try { recognition?.stop(); } catch {}
    resumeFlight();
  });

  voiceBtn?.addEventListener('click', () => speak(greeting));

  // Suggested prompts make first-time use easier and reduce empty-state friction.
  quickPrompts?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-prompt]');
    if (!button || busy) return;
    input.value = button.dataset.prompt || '';
    form.requestSubmit();
  });

  // Optional browser speech recognition; gracefully degrades when unsupported.
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && micBtn) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      micBtn.classList.add('is-listening');
      micBtn.setAttribute('aria-label', 'Listening; click to stop');
      if (status) status.textContent = 'Listening to your message...';
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) { input.value = transcript; input.focus(); }
    };
    recognition.onerror = () => { if (status) status.textContent = 'Voice input unavailable — type your message instead'; };
    recognition.onend = () => {
      micBtn.classList.remove('is-listening');
      micBtn.setAttribute('aria-label', 'Speak your message');
      if (status && !busy) status.textContent = 'Voice assistant online';
    };
    micBtn.addEventListener('click', () => {
      try {
        if (micBtn.classList.contains('is-listening')) recognition.stop();
        else recognition.start();
      } catch { if (status) status.textContent = 'Microphone is busy. Please try again.'; }
    });
  } else if (micBtn) {
    micBtn.disabled = true;
    micBtn.title = 'Voice input is not supported in this browser';
    micBtn.setAttribute('aria-label', 'Voice input not supported');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;

    pauseFlight();
    busy = true;
    addUserMessage(text);
    input.value = '';
    if (status) status.textContent = 'Thinking...';
    addTypingIndicator();
    if (quickPrompts) quickPrompts.hidden = true;

    try {
      const reply = await askBackend(text);
      removeTypingIndicator();
      history.push({ role: 'user', content: text });
      history.push({ role: 'assistant', content: reply });
      history = history.slice(-10);

      // AI answer stays voice-only.
      speak(reply, finishConversation);
    } catch (error) {
      removeTypingIndicator();
      console.error('Nylarion AI:', error);
      const message = error?.message || 'I cannot reach the Nylarion AI backend right now.';
      if (status) status.textContent = 'Backend error';
      speak(message, finishConversation);
    } finally {
      busy = false;
    }
  });

  window.addEventListener('resize', () => {
    if (!chatOpen) {
      placeRobot(flight.x, flight.y);
      chooseTarget();
    }
  });

  // Backend health check is silent; the robot remains flying until touched.
  checkBackend();

  // Respect reduced-motion preferences by keeping the robot visible and still.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    flight.paused = true;
    launch.classList.add('ny-ai-reduced-motion');
  }
});
