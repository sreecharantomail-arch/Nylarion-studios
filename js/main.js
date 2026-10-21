/* =============================================================
   NYLARION STUDIOS — MAIN JAVASCRIPT
   Professional game studio website interactions
   ============================================================= */

/* =============================================================
   1. LOADING SCREEN
   ============================================================= */
window.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('loader-screen');
  const bar = document.getElementById('loader-bar');
  const percentText = document.getElementById('loader-percent');
  const statusText = document.getElementById('loader-text');

  const statuses = [
    'INITIALIZING ENGINE...',
    'LOADING ASSETS...',
    'COMPILING SHADERS...',
    'PREPARING EXPERIENCE...',
    'LAUNCHING NYLARION...'
  ];

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 10) + 6;
    if (progress > 100) progress = 100;

    if (bar) bar.style.width = progress + '%';
    if (percentText) percentText.textContent = progress + '%';

    const statusIdx = Math.min(Math.floor((progress / 100) * statuses.length), statuses.length - 1);
    if (statusText) statusText.textContent = statuses[statusIdx];

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (loader) loader.classList.add('hidden');
      }, 350);
    }
  }, 110);
});

/* =============================================================
   2. SCROLL-BASED HEADER & REVEAL ANIMATIONS
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('site-header');

  // Sticky header background on scroll
  const handleScroll = () => {
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Intersection Observer for reveal animations
  const revealElements = document.querySelectorAll('[data-reveal]');
  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach((el) => revealObserver.observe(el));
  }
});

/* =============================================================
   3. THREE.JS SCENE — 3D LOGO EMBLEM
   ============================================================= */
function init3DLogo() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const fallbackLogo = container.querySelector('.hero-center-logo');
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

  // Color-accurate background cutout
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

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r < 24 && g < 28 && b < 32) {
          data[i + 3] = 0;
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

  loadAccurateColorCutout('assets/images/logo.png', (accurateTexture) => {
    const geometry = new THREE.PlaneGeometry(5.4, 4.2);
    const material = new THREE.MeshBasicMaterial({
      map: accurateTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const logoMesh = new THREE.Mesh(geometry, material);
    mainGroup.add(logoMesh);

    // Cyan depth glow
    const cyanGlowGeo = new THREE.PlaneGeometry(5.48, 4.28);
    const cyanGlowMat = new THREE.MeshBasicMaterial({
      map: accurateTexture,
      transparent: true,
      opacity: 0.35,
      color: 0x38d9e8,
      side: THREE.DoubleSide
    });
    const cyanGlowMesh = new THREE.Mesh(cyanGlowGeo, cyanGlowMat);
    cyanGlowMesh.position.z = -0.06;
    mainGroup.add(cyanGlowMesh);

    // Gold depth glow
    const goldGlowGeo = new THREE.PlaneGeometry(5.56, 4.36);
    const goldGlowMat = new THREE.MeshBasicMaterial({
      map: accurateTexture,
      transparent: true,
      opacity: 0.25,
      color: 0xd4a853,
      side: THREE.DoubleSide
    });
    const goldGlowMesh = new THREE.Mesh(goldGlowGeo, goldGlowMat);
    goldGlowMesh.position.z = -0.12;
    mainGroup.add(goldGlowMesh);
  });

  scene.add(mainGroup);

  // Particles
  const particlesGeo = new THREE.BufferGeometry();
  const count = 200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const colorCyan = new THREE.Color(0x38d9e8);
  const colorGold = new THREE.Color(0xd4a853);

  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 22;
    positions[i + 1] = (Math.random() - 0.5) * 14;
    positions[i + 2] = (Math.random() - 0.5) * 10;

    const c = Math.random() > 0.4 ? colorCyan : colorGold;
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }

  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particlesMat = new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.6
  });

  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  // Interaction
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
        targetRotationY = mouseX * 0.5;
        targetRotationX = mouseY * 0.3;
      }
    }
  });

  window.addEventListener('pointerup', () => { isDragging = false; });

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

  // Responsive camera
  function updateCameraForViewport() {
    const newW = container.clientWidth;
    const newH = container.clientHeight;
    camera.aspect = newW / newH;

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

  updateCameraForViewport();
  window.addEventListener('resize', updateCameraForViewport);

  // Animation loop
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (!isDragging) {
      mainGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.08;
    }

    mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.07;
    mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.05;

    particles.rotation.y = elapsedTime * 0.015;

    renderer.render(scene, camera);
  }

  animate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init3DLogo);
} else {
  init3DLogo();
}

/* =============================================================
   4. MOBILE NAVIGATION
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (mobileToggle && navMenu) {
    const toggleMenu = () => {
      const isOpen = navMenu.classList.contains('active');
      mobileToggle.classList.toggle('active');
      mobileToggle.setAttribute('aria-expanded', String(!isOpen));
      navMenu.classList.toggle('active');
      document.body.style.overflow = isOpen ? '' : 'hidden';
    };

    mobileToggle.addEventListener('click', toggleMenu);

    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (navMenu.classList.contains('active')) {
          mobileToggle.classList.remove('active');
          mobileToggle.setAttribute('aria-expanded', 'false');
          navMenu.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });
  }
});

/* =============================================================
   5. CONTACT FORM
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  const feedback = document.getElementById('form-feedback');

  if (!form || !feedback) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.textContent = '';
    feedback.className = 'form-feedback';

    const name = form.querySelector('#contact-name')?.value?.trim();
    const email = form.querySelector('#contact-email')?.value?.trim();
    const subject = form.querySelector('#contact-subject')?.value?.trim();
    const message = form.querySelector('#contact-message')?.value?.trim();

    if (!name) {
      feedback.textContent = 'Please enter your name.';
      feedback.classList.add('error');
      return;
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      feedback.textContent = 'Please enter a valid email address.';
      feedback.classList.add('error');
      return;
    }

    if (!message || message.length < 5) {
      feedback.textContent = 'Please enter a message with at least 5 characters.';
      feedback.classList.add('error');
      return;
    }

    const submitBtn = form.querySelector('#contact-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        feedback.textContent = data.message || 'Message sent successfully!';
        feedback.classList.add('success');
        form.reset();
      } else {
        throw new Error(data.error || 'Failed to send message.');
      }
    } catch (error) {
      feedback.textContent = error.message || 'Unable to send message. Please email us directly at nylarionstudios@gmail.com.';
      feedback.classList.add('error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Message <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m4 4 16 8-16 8 3-8-3-8zm3 8h13"/></svg>';
      }
    }
  });
});

/* =============================================================
   6. SMOOTH SCROLL for anchor links
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerHeight = document.querySelector('header')?.offsetHeight || 70;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });
});

/* =============================================================
   7. NYLARION AI — AUTONOMOUS FLYING ROBOT
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
  let recognition = null;
  let ttsAvailable = true;

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

  function addBotMessage(text) {
    const el = document.createElement('div');
    el.className = 'ny-ai-msg bot';
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

  function removeTypingIndicator() {
    document.getElementById('ny-ai-typing')?.remove();
  }

  function speak(text, done) {
    if (!('speechSynthesis' in window)) {
      ttsAvailable = false;
      if (status) status.textContent = 'Voice not supported — text responses active';
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
    utterance.onstart = () => {
      if (status) status.textContent = 'Speaking...';
    };
    utterance.onend = () => {
      if (status) status.textContent = 'Voice assistant online';
      if (typeof done === 'function') done();
    };
    utterance.onerror = () => {
      ttsAvailable = false;
      if (status) status.textContent = 'Voice unavailable — text responses active';
      if (typeof done === 'function') done();
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  // Welcome voice
  function speakWelcome() {
    if (welcomeSpoken || !('speechSynthesis' in window)) return false;
    welcomeSpoken = true;
    welcomeFallbackArmed = false;
    if (status) status.textContent = 'Welcome to Nylarion Studios...';
    speak(greeting);
    return true;
  }

  function welcomeOnFirstInteraction() {
    if (!welcomeFallbackArmed || welcomeSpoken) return;
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
        : 'Knowledge base active';
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
    try { data = await response.json(); } catch { /* empty */ }
    if (!response.ok) throw new Error(data.error || `Backend error (${response.status})`);
    if (typeof data.reply !== 'string' || !data.reply.trim()) {
      throw new Error('The assistant returned an empty response. Please try again.');
    }
    return data.reply.trim();
  }

  /* =============================================================
     Permanent Fixed Bottom-Right Controller
     ============================================================= */

  function openChat(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (chatOpen) return;
    chatOpen = true;
    panel.classList.add('open');
    launch.classList.add('ny-ai-active');
    launch.setAttribute('aria-expanded', 'true');
    if (status && !busy) status.textContent = 'Voice assistant online';
    setTimeout(() => {
      input.focus();
    }, 90);
  }

  function closeChat(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!chatOpen) return;
    chatOpen = false;
    panel.classList.remove('open');
    launch.classList.remove('ny-ai-active');
    launch.setAttribute('aria-expanded', 'false');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try { recognition?.stop(); } catch { /* empty */ }
    if (status && !busy) status.textContent = 'Voice assistant online';
  }

  function toggleChat(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (chatOpen) {
      closeChat(event);
    } else {
      openChat(event);
    }
  }

  // Expose global helpers for testing and external triggers
  window.openNylarionChat = openChat;
  window.closeNylarionChat = closeChat;
  window.toggleNylarionChat = toggleChat;

  // Speak welcome greeting after brief page initialization
  setTimeout(() => { speakWelcome(); }, 1000);

  // Interaction triggers
  launch.addEventListener('click', toggleChat);
  document.getElementById('nav-ai-btn')?.addEventListener('click', openChat);
  close?.addEventListener('click', closeChat);

  // Close chat on Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && chatOpen) {
      closeChat();
    }
  });

  // Close chat when clicking outside panel & launcher
  document.addEventListener('pointerdown', (event) => {
    if (!chatOpen) return;
    const target = event.target;
    if (
      target.closest('#ny-ai-window') ||
      target.closest('#ny-ai-widget') ||
      target.closest('#nav-ai-btn')
    ) {
      return;
    }
    closeChat();
  });

  voiceBtn?.addEventListener('click', () => speak(greeting));

  quickPrompts?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-prompt]');
    if (!button || busy) return;
    input.value = button.dataset.prompt || '';
    form.requestSubmit();
  });

  // Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && micBtn) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
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
    recognition.onerror = () => {
      if (status) status.textContent = 'Voice input unavailable — type your message instead';
    };
    recognition.onend = () => {
      micBtn.classList.remove('is-listening');
      micBtn.setAttribute('aria-label', 'Speak your message');
      if (status && !busy) status.textContent = 'Voice assistant online';
    };
    micBtn.addEventListener('click', () => {
      try {
        if (micBtn.classList.contains('is-listening')) recognition.stop();
        else recognition.start();
      } catch {
        if (status) status.textContent = 'Microphone is busy. Please try again.';
      }
    });
  } else if (micBtn) {
    micBtn.disabled = true;
    micBtn.title = 'Voice input is not supported in this browser';
    micBtn.setAttribute('aria-label', 'Voice input not supported');
  }

  // Chat Form Submit
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;

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

      // Always display message in conversation history
      addBotMessage(reply);

      // Play voice if TTS is available
      if (ttsAvailable) {
        speak(reply, () => {
          if (status) status.textContent = 'Voice assistant online';
        });
      } else {
        if (status) status.textContent = 'Voice assistant online';
      }
    } catch (error) {
      removeTypingIndicator();
      console.error('Nylarion AI:', error);
      const message = error?.message || 'I cannot reach the Nylarion AI backend right now.';
      if (status) status.textContent = 'Connection error';
      addBotMessage(message);
    } finally {
      busy = false;
    }
  });

  checkBackend();

  // Reduced motion
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    launch.classList.add('ny-ai-reduced-motion');
  }
});
