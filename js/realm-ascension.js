/**
 * NYLARION STUDIOS — PROJECT ASCENSION
 * Interactive Cinematic World Engine: "The Realm of Nylarion"
 * 
 * Manages:
 * 1. Continuous scroll story mapping (Scenes 1 - 6)
 * 2. Three.js WebGL particle field (stardust, volumetric light, golden embers)
 * 3. Legendary Horse character trajectory, breathing motion & stride responsiveness
 * 4. Multi-layer environmental parallax (Celestial Horizon, Living Forest, Forgotten Kingdom, Foreground Foliage)
 * 5. High performance, accessible reduced-motion support, non-hijacked native scrolling
 */

(function () {
  'use strict';

  // State
  const state = {
    progress: 0,
    targetProgress: 0,
    scrollVelocity: 0,
    lastScrollY: 0,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    time: 0,
    isMobile: false,
    reducedMotion: false,
    active: true
  };

  // DOM Elements
  let dom = {};

  // Three.js instances
  let webgl = {
    scene: null,
    camera: null,
    renderer: null,
    canvas: null,
    stardust: null,
    stardustGeo: null,
    stardustPos: null,
    emberParticles: null,
    emberGeo: null,
    emberPos: null,
    emberVels: null,
    emberLifes: null
  };

  const LERP_FACTOR = 0.08;
  const STARDUST_COUNT_DESKTOP = 240;
  const STARDUST_COUNT_MOBILE = 75;
  const EMBER_COUNT = 55;

  /**
   * Linear Interpolation Helper
   */
  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Initialize DOM References
   */
  function initDOM() {
    dom.stage = document.getElementById('realm-stage');
    dom.sky = document.getElementById('realm-sky');
    dom.forest = document.getElementById('realm-forest');
    dom.kingdom = document.getElementById('realm-kingdom');
    dom.foreground = document.getElementById('realm-foreground');
    dom.character = document.getElementById('realm-character');
    dom.horseSprite = document.getElementById('horse-sprite');
    dom.canvas = document.getElementById('realm-webgl-canvas');
    dom.sceneTag = document.getElementById('ascension-scene-tag');
  }

  /**
   * Check Device & Accessibility Preferences
   */
  function checkPreferences() {
    state.isMobile = window.innerWidth <= 768;
    state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Initialize Three.js WebGL Visual Effects
   */
  function initWebGL() {
    if (!window.THREE || !dom.canvas) return;

    try {
      const width = window.innerWidth;
      const height = window.innerHeight;

      webgl.scene = new THREE.Scene();
      webgl.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      webgl.camera.position.set(0, 0, 50);

      webgl.renderer = new THREE.WebGLRenderer({
        canvas: dom.canvas,
        alpha: true,
        antialias: !state.isMobile,
        powerPreference: 'high-performance'
      });
      webgl.renderer.setSize(width, height);
      webgl.renderer.setPixelRatio(Math.min(window.devicePixelRatio, state.isMobile ? 1.25 : 1.75));

      // 1. Ambient Celestial Stardust & Bioluminescent Spores
      const particleCount = state.isMobile ? STARDUST_COUNT_MOBILE : STARDUST_COUNT_DESKTOP;
      webgl.stardustGeo = new THREE.BufferGeometry();
      webgl.stardustPos = new Float32Array(particleCount * 3);
      const stardustColors = new Float32Array(particleCount * 3);

      const colorCyan = new THREE.Color(0x38d9e8);
      const colorGold = new THREE.Color(0xffd24e);
      const colorWhite = new THREE.Color(0xffffff);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        webgl.stardustPos[i3] = (Math.random() - 0.5) * 85;
        webgl.stardustPos[i3 + 1] = (Math.random() - 0.5) * 55;
        webgl.stardustPos[i3 + 2] = (Math.random() - 0.5) * 45;

        const pick = Math.random();
        const c = pick < 0.45 ? colorCyan : pick < 0.85 ? colorGold : colorWhite;
        stardustColors[i3] = c.r;
        stardustColors[i3 + 1] = c.g;
        stardustColors[i3 + 2] = c.b;
      }

      webgl.stardustGeo.setAttribute('position', new THREE.BufferAttribute(webgl.stardustPos, 3));
      webgl.stardustGeo.setAttribute('color', new THREE.BufferAttribute(stardustColors, 3));

      // Create glowing disc texture
      const canvasTexture = createGlowDiscTexture();
      const stardustMat = new THREE.PointsMaterial({
        size: state.isMobile ? 1.8 : 2.4,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        map: canvasTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      webgl.stardust = new THREE.Points(webgl.stardustGeo, stardustMat);
      webgl.scene.add(webgl.stardust);

      // 2. Mane Golden Ember Trail Emitter
      webgl.emberGeo = new THREE.BufferGeometry();
      webgl.emberPos = new Float32Array(EMBER_COUNT * 3);
      webgl.emberVels = new Float32Array(EMBER_COUNT * 3);
      webgl.emberLifes = new Float32Array(EMBER_COUNT);

      for (let i = 0; i < EMBER_COUNT; i++) {
        resetEmber(i);
        webgl.emberLifes[i] = Math.random(); // staggered startup
      }

      webgl.emberGeo.setAttribute('position', new THREE.BufferAttribute(webgl.emberPos, 3));

      const emberMat = new THREE.PointsMaterial({
        size: state.isMobile ? 1.4 : 2.0,
        color: 0xffda59,
        transparent: true,
        opacity: 0.9,
        map: canvasTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      webgl.emberParticles = new THREE.Points(webgl.emberGeo, emberMat);
      webgl.scene.add(webgl.emberParticles);

    } catch (err) {
      console.warn('RealmWebGL initialization fallback:', err);
    }
  }

  /**
   * Helper: Circular Glow Texture for Particle Systems
   */
  function createGlowDiscTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,235,170,0.9)');
    grad.addColorStop(0.6, 'rgba(56,217,232,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(c);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  /**
   * Helper: Reset single ember to horse position
   */
  function resetEmber(i) {
    if (!webgl.emberPos) return;
    const i3 = i * 3;
    // Map character screen coordinates to 3D plane
    const charRect = dom.character ? dom.character.getBoundingClientRect() : null;
    let originX = 12;
    let originY = -2;

    if (charRect && webgl.camera) {
      const ndcX = ((charRect.left + charRect.width * 0.45) / window.innerWidth) * 2 - 1;
      const ndcY = -((charRect.top + charRect.height * 0.35) / window.innerHeight) * 2 + 1;
      originX = ndcX * 35;
      originY = ndcY * 22;
    }

    webgl.emberPos[i3] = originX + (Math.random() - 0.5) * 6;
    webgl.emberPos[i3 + 1] = originY + (Math.random() - 0.5) * 5;
    webgl.emberPos[i3 + 2] = (Math.random() - 0.5) * 8;

    webgl.emberVels[i3] = -(Math.random() * 0.18 + 0.08); // drifts backward (leftward)
    webgl.emberVels[i3 + 1] = (Math.random() * 0.16 + 0.04); // rises slightly
    webgl.emberVels[i3 + 2] = (Math.random() - 0.5) * 0.08;

    webgl.emberLifes[i] = 1.0;
  }

  /**
   * Update WebGL Particles
   */
  function updateWebGL(delta) {
    if (!webgl.scene || !webgl.renderer || state.reducedMotion) return;

    // 1. Ambient Stardust Drift
    if (webgl.stardustGeo && webgl.stardustPos) {
      const count = webgl.stardustPos.length / 3;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        webgl.stardustPos[i3 + 1] += Math.sin(state.time + i) * 0.015;
        webgl.stardustPos[i3] += Math.cos(state.time * 0.8 + i) * 0.012;

        // Wrap around bounds
        if (webgl.stardustPos[i3 + 1] > 32) webgl.stardustPos[i3 + 1] = -32;
        if (webgl.stardustPos[i3 + 1] < -32) webgl.stardustPos[i3 + 1] = 32;
      }
      webgl.stardustGeo.attributes.position.needsUpdate = true;
      webgl.stardust.rotation.y = state.time * 0.02 + state.mouseX * 0.05;
      webgl.stardust.rotation.x = -state.mouseY * 0.03;
    }

    // 2. Mane Ember Particles
    if (webgl.emberPos && webgl.emberLifes) {
      for (let i = 0; i < EMBER_COUNT; i++) {
        webgl.emberLifes[i] -= delta * 0.65;
        if (webgl.emberLifes[i] <= 0) {
          resetEmber(i);
        } else {
          const i3 = i * 3;
          webgl.emberPos[i3] += webgl.emberVels[i3];
          webgl.emberPos[i3 + 1] += webgl.emberVels[i3 + 1];
          webgl.emberPos[i3 + 2] += webgl.emberVels[i3 + 2];
        }
      }
      webgl.emberGeo.attributes.position.needsUpdate = true;
    }

    // Camera subtle tilt based on mouse & scroll
    if (webgl.camera) {
      webgl.camera.position.x = state.mouseX * 3;
      webgl.camera.position.y = -state.mouseY * 2;
      webgl.camera.lookAt(0, 0, 0);
    }

    webgl.renderer.render(webgl.scene, webgl.camera);
  }

  /**
   * Calculate Scroll Progress & Journey Waypoints
   */
  function updateScrollProgress() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const currentY = window.scrollY || window.pageYOffset || 0;

    state.targetProgress = docHeight > 0 ? clamp(currentY / docHeight, 0, 1) : 0;
    state.scrollVelocity = currentY - state.lastScrollY;
    state.lastScrollY = currentY;
  }

  /**
   * Update Story Scenes & Trajectory
   */
  function updateJourney(progress) {
    if (!dom.character) return;

    // Define Waypoints for The Legendary Horse across Scenes
    let charX, charY, charScale, charOpacity, charTilt = 0;
    let skyOpacity, forestOpacity, kingdomOpacity, foregroundOpacity = 0;
    let sceneName = 'The Arrival';

    const isMobile = state.isMobile;

    if (progress <= 0.20) {
      // Scene 1: The Arrival
      const t = progress / 0.20;
      sceneName = 'The Arrival — Celestial Horizon';

      charX = isMobile ? lerp(50, 50, t) : lerp(72, 64, t);
      charY = isMobile ? lerp(74, 72, t) : lerp(56, 54, t);
      charScale = isMobile ? lerp(0.56, 0.60, t) : lerp(0.84, 0.90, t);
      charOpacity = 1.0;

      skyOpacity = 1.0;
      forestOpacity = lerp(0.0, 0.35, t);
      kingdomOpacity = 0.0;
      foregroundOpacity = 0.0;

    } else if (progress <= 0.45) {
      // Scene 2: The Awakening
      const t = (progress - 0.20) / 0.25;
      sceneName = 'The Awakening — Realm of Nylarion';

      charX = isMobile ? lerp(50, 50, t) : lerp(64, 70, t);
      charY = isMobile ? lerp(64, 62, t) : lerp(54, 52, t);
      charScale = isMobile ? lerp(0.68, 0.70, t) : lerp(0.90, 0.96, t);
      charOpacity = 1.0;

      skyOpacity = lerp(1.0, 0.25, t);
      forestOpacity = lerp(0.35, 1.0, t);
      kingdomOpacity = 0.0;
      foregroundOpacity = lerp(0.0, 0.65, t);

    } else if (progress <= 0.72) {
      // Scene 3: Through the Living Forest
      const t = (progress - 0.45) / 0.27;
      sceneName = 'Through the Forest — Games & Creations';

      charX = isMobile ? lerp(50, 50, t) : lerp(70, 36, t);
      charY = isMobile ? lerp(62, 60, t) : lerp(52, 50, t);
      charScale = isMobile ? lerp(0.70, 0.66, t) : lerp(0.96, 0.86, t);
      charOpacity = isMobile ? 0.85 : 0.95;

      skyOpacity = 0.15;
      forestOpacity = lerp(1.0, 0.2, t);
      kingdomOpacity = lerp(0.0, 0.95, t);
      foregroundOpacity = lerp(0.65, 0.1, t);

    } else if (progress <= 0.88) {
      // Scene 4: The Ancient Kingdom
      const t = (progress - 0.72) / 0.16;
      sceneName = 'The Ancient Kingdom — Technology Citadel';

      charX = isMobile ? lerp(50, 50, t) : lerp(36, 30, t);
      charY = isMobile ? lerp(60, 58, t) : lerp(50, 48, t);
      charScale = isMobile ? lerp(0.66, 0.68, t) : lerp(0.86, 0.84, t);
      charOpacity = 1.0;

      skyOpacity = lerp(0.15, 0.65, t);
      forestOpacity = 0.0;
      kingdomOpacity = lerp(0.95, 0.4, t);
      foregroundOpacity = 0.0;

    } else {
      // Scene 5 & 6: The Studio Revealed & The Invitation
      const t = (progress - 0.88) / 0.12;
      sceneName = 'The Invitation — Play Beyond Reality';

      charX = isMobile ? lerp(50, 50, t) : lerp(30, 72, t);
      charY = isMobile ? lerp(58, 62, t) : lerp(48, 56, t);
      charScale = isMobile ? lerp(0.68, 0.66, t) : lerp(0.84, 0.88, t);
      charOpacity = 1.0;

      skyOpacity = lerp(0.65, 0.95, t);
      forestOpacity = 0.0;
      kingdomOpacity = lerp(0.4, 0.2, t);
      foregroundOpacity = 0.0;
    }

    // Apply Subtle Breathing & Stride Sway
    let breathingY = 0;
    let trotBob = 0;

    if (!state.reducedMotion) {
      breathingY = Math.sin(state.time * 1.8) * 5;
      const speed = Math.abs(state.scrollVelocity);
      if (speed > 0.4) {
        trotBob = Math.sin(state.time * 8.5) * Math.min(4.5, speed * 0.35);
        charTilt = Math.sin(state.time * 8.5) * Math.min(1.2, speed * 0.06);
      }
    }

    // Apply Transforms & Opacity to Character using left/top + translate3d
    const posX = charX + (state.mouseX * 1.4);
    const posY = charY + (state.mouseY * 1.2);

    dom.character.style.left = `${posX}vw`;
    dom.character.style.top = `calc(${posY}vh + ${(breathingY + trotBob).toFixed(1)}px)`;
    dom.character.style.transform = `translate3d(-50%, -50%, 0) scale(${charScale}) rotate(${charTilt.toFixed(2)}deg)`;
    dom.character.style.opacity = `${charOpacity}`;

    // Update Environmental Layers
    if (dom.sky) {
      dom.sky.style.opacity = `${skyOpacity}`;
      dom.sky.style.transform = `translate3d(${state.mouseX * -6}px, ${-progress * 40 + state.mouseY * -4}px, 0)`;
    }
    if (dom.forest) {
      dom.forest.style.opacity = `${forestOpacity}`;
      dom.forest.style.transform = `translate3d(${state.mouseX * 12}px, ${(progress - 0.3) * 60 + state.mouseY * 8}px, 0)`;
    }
    if (dom.kingdom) {
      dom.kingdom.style.opacity = `${kingdomOpacity}`;
      dom.kingdom.style.transform = `translate3d(${state.mouseX * -10}px, ${(progress - 0.6) * 50 + state.mouseY * -6}px, 0)`;
    }
    if (dom.foreground) {
      dom.foreground.style.opacity = `${foregroundOpacity}`;
      dom.foreground.style.transform = `translate3d(${state.mouseX * 24}px, ${(progress - 0.4) * 110 + state.mouseY * 16}px, 0)`;
    }

    // Update Scene Indicator Tag
    if (dom.sceneTag && dom.sceneTag.textContent !== sceneName) {
      dom.sceneTag.textContent = sceneName;
    }
  }

  /**
   * Main Render Loop
   */
  let lastTime = performance.now();

  function render(now) {
    if (!state.active) {
      requestAnimationFrame(render);
      return;
    }

    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    state.time += delta;

    // Smooth Lerp on Scroll Progress
    state.progress += (state.targetProgress - state.progress) * LERP_FACTOR;

    // Smooth Lerp on Mouse Parallax
    state.mouseX += (state.targetMouseX - state.mouseX) * 0.06;
    state.mouseY += (state.targetMouseY - state.mouseY) * 0.06;

    // Update World & Character
    updateJourney(state.progress);

    // Update Three.js WebGL Scene
    updateWebGL(delta);

    requestAnimationFrame(render);
  }

  /**
   * Event Listeners
   */
  function attachListeners() {
    // Scroll Listener (passive, non-blocking)
    window.addEventListener('scroll', updateScrollProgress, { passive: true });

    // Pointer Parallax (subtle)
    window.addEventListener('pointermove', (e) => {
      if (state.reducedMotion) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      state.targetMouseX = nx;
      state.targetMouseY = ny;
    }, { passive: true });

    // Window Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        checkPreferences();
        if (webgl.renderer && webgl.camera) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          webgl.camera.aspect = w / h;
          webgl.camera.updateProjectionMatrix();
          webgl.renderer.setSize(w, h);
        }
        updateScrollProgress();
      }, 120);
    }, { passive: true });

    // Page Visibility (pause WebGL RAF loop when tab is backgrounded)
    document.addEventListener('visibilitychange', () => {
      state.active = !document.hidden;
      if (state.active) lastTime = performance.now();
    });

    // Handle Reduced Motion Changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener?.('change', (e) => {
      state.reducedMotion = e.matches;
    });
  }

  /**
   * Boot the Ascension World Engine on DOM Ready
   */
  function init() {
    initDOM();
    checkPreferences();
    initWebGL();
    attachListeners();
    updateScrollProgress();
    requestAnimationFrame(render);

    // Expose Global Controller for External Hooking or Debugging
    window.RealmAscension = {
      state,
      webgl,
      jumpToScene: (progressFraction) => {
        state.targetProgress = clamp(progressFraction, 0, 1);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
