/**
 * NYLARION STUDIOS — PROJECT ASCENSION
 * Interactive Cinematic World Engine: "The Realm of Nylarion"
 * 
 * - 5 Vertically stacked fantasy environments in continuous cinematic journey
 * - Multi-layer environmental parallax & Three.js celestial particle fields
 * - Opt-in ethereal ambient soundscape & crystal chapter chimes
 * - Dynamic graphics mode toggle (Cinematic vs Performance)
 */

(function () {
  'use strict';

  // State
  const state = {
    progress: 0,
    targetProgress: 0,
    scrollVelocity: 0,
    smoothVelocity: 0,
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
    clock: null,
    // Particle systems
    stardust: null,
    stardustGeo: null,
    stardustPos: null
  };

  const LERP_FACTOR = 0.08;
  const STARDUST_COUNT_DESKTOP = 240;
  const STARDUST_COUNT_MOBILE = 75;

  /**
   * Helpers
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
    dom.canvas = document.getElementById('realm-webgl-canvas');
    dom.sceneTag = document.getElementById('ascension-scene-tag');
    dom.scenes = Array.from(document.querySelectorAll('.world-scene'));
    dom.sceneBackdrops = Array.from(document.querySelectorAll('.scene-backdrop'));
    dom.progressBar = document.getElementById('scroll-progress-bar');
    dom.soundToggle = document.getElementById('btn-sound-toggle');
    dom.fxToggle = document.getElementById('btn-effects-toggle');
  }

  /**
   * Web Audio Opt-in Ambient Soundscape Engine (Strictly Muted by Default)
   */
  const audio = {
    ctx: null,
    isPlaying: false,
    masterGain: null,
    droneNodes: [],
    lastPlayedScene: -1
  };

  function initAudioContext() {
    if (audio.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      audio.ctx = new AudioCtx();
      audio.masterGain = audio.ctx.createGain();
      audio.masterGain.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
      audio.masterGain.connect(audio.ctx.destination);
    } catch (e) {
      console.warn('Web Audio not permitted in current context:', e);
    }
  }

  function startSoundscape() {
    if (!audio.ctx) initAudioContext();
    if (!audio.ctx) return;
    if (audio.ctx.state === 'suspended') {
      audio.ctx.resume();
    }

    try {
      audio.masterGain.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.masterGain.gain.linearRampToValueAtTime(0.05, audio.ctx.currentTime + 1.8);

      if (audio.droneNodes.length === 0) {
        // Ethereal chord: A2 (110Hz), E3 (164.8Hz), A3 (220Hz), C#4 (277.2Hz)
        const freqs = [110.0, 164.81, 220.0, 277.18];
        freqs.forEach((freq, idx) => {
          const osc = audio.ctx.createOscillator();
          const filter = audio.ctx.createBiquadFilter();
          const gain = audio.ctx.createGain();

          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, audio.ctx.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(340 + idx * 50, audio.ctx.currentTime);

          gain.gain.setValueAtTime(0.25 / freqs.length, audio.ctx.currentTime);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(audio.masterGain);

          osc.start();
          audio.droneNodes.push(osc);
        });
      }

      audio.isPlaying = true;
      updateSoundUI(true);
    } catch (e) {
      console.warn('Could not start soundscape:', e);
    }
  }

  function stopSoundscape() {
    if (!audio.ctx || !audio.isPlaying) return;
    try {
      audio.masterGain.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.masterGain.gain.linearRampToValueAtTime(0.0001, audio.ctx.currentTime + 1.0);
      audio.isPlaying = false;
      updateSoundUI(false);
    } catch (e) {
      console.warn('Could not stop soundscape:', e);
    }
  }

  function playChapterChime(sceneIdx) {
    if (!audio.ctx || !audio.isPlaying) return;
    audio.lastPlayedScene = sceneIdx;
    try {
      const now = audio.ctx.currentTime;
      // Pentatonic crystal chime notes
      const notes = [554.37, 659.25, 739.99, 880.0, 1108.73];
      const freq = notes[sceneIdx % notes.length];

      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.008, now + 0.12);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

      osc.connect(gain);
      gain.connect(audio.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.65);
    } catch (e) {
      // Audio chime error ignored
    }
  }

  function updateSoundUI(active) {
    if (!dom.soundToggle) return;
    dom.soundToggle.classList.toggle('is-active', active);
    dom.soundToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    const icon = dom.soundToggle.querySelector('.sound-icon');
    if (icon) icon.textContent = active ? '🔊' : '🔇';
    const label = dom.soundToggle.querySelector('.control-label');
    if (label) label.textContent = active ? 'Audio: ON' : 'Audio: OFF';
    dom.soundToggle.title = active ? 'Cinematic Ambient Audio (Click to Mute)' : 'Cinematic Ambient Audio (Opt-in — Click to Enable)';
  }

  /**
   * Graphics FX Mode (Cinematic vs Performance)
   */
  function initFXMode() {
    const saved = localStorage.getItem('nylarion_fx_mode');
    const isPerf = saved === 'performance' || state.reducedMotion;
    setFXMode(isPerf);

    if (dom.fxToggle) {
      dom.fxToggle.addEventListener('click', () => {
        const currentlyPerf = document.body.getAttribute('data-fx') === 'performance';
        setFXMode(!currentlyPerf);
      });
    }
  }

  function setFXMode(performanceMode) {
    if (performanceMode) {
      document.body.setAttribute('data-fx', 'performance');
      localStorage.setItem('nylarion_fx_mode', 'performance');
      if (dom.fxToggle) {
        dom.fxToggle.classList.add('is-performance');
        dom.fxToggle.title = 'Graphics Mode: Performance (Click for Cinematic)';
        dom.fxToggle.setAttribute('aria-label', 'Graphics Mode: Performance (Low-FX). Click to switch to Cinematic.');
        const icon = dom.fxToggle.querySelector('.effects-icon');
        if (icon) icon.textContent = '⚡';
      }
    } else {
      document.body.removeAttribute('data-fx');
      localStorage.setItem('nylarion_fx_mode', 'cinematic');
      if (dom.fxToggle) {
        dom.fxToggle.classList.remove('is-performance');
        dom.fxToggle.title = 'Graphics Mode: Cinematic (Click for Performance)';
        dom.fxToggle.setAttribute('aria-label', 'Graphics Mode: Cinematic. Click to switch to Performance mode.');
        const icon = dom.fxToggle.querySelector('.effects-icon');
        if (icon) icon.textContent = '✨';
      }
    }
  }

  /**
   * Check Device & Accessibility Preferences
   */
  function checkPreferences() {
    state.isMobile = window.innerWidth <= 768;
    state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }



  /**
   * Initialize Three.js WebGL Visual Effects & Lighting
   */
  function initWebGL() {
    if (!window.THREE || !dom.canvas) return;

    try {
      const width = window.innerWidth;
      const height = window.innerHeight;

      webgl.clock = new THREE.Clock();
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
      webgl.renderer.outputEncoding = THREE.sRGBEncoding;
      webgl.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      webgl.renderer.toneMappingExposure = 1.05;

      // Soft ambient fill to preserve PBR shadows and muscle definition
      const ambientLight = new THREE.AmbientLight(0x7fa3cb, 0.75);
      webgl.scene.add(ambientLight);

      const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x091424, 0.65);
      webgl.scene.add(hemiLight);

      // Key Directional Light (Warm Golden Sunlight from upper-front-left)
      const keyLight = new THREE.DirectionalLight(0xfff3db, 1.7);
      keyLight.position.set(15, 20, 25);
      webgl.scene.add(keyLight);

      // Kick / Rim Directional Light (Cyan Celestial Shimmer from back-right)
      const rimLight = new THREE.DirectionalLight(0x38d9e8, 1.8);
      rimLight.position.set(-20, 8, -15);
      webgl.scene.add(rimLight);

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
   * Update WebGL Scene & Particles
   */
  function updateWebGL(delta) {
    if (!webgl.scene || !webgl.renderer) return;
    if (document.body.getAttribute('data-fx') === 'performance') return;

    // Ambient Celestial Stardust Drift
    if (webgl.stardustGeo && webgl.stardustPos && !state.reducedMotion) {
      const count = webgl.stardustPos.length / 3;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        webgl.stardustPos[i3 + 1] += Math.sin(state.time + i) * 0.015;
        webgl.stardustPos[i3] += Math.cos(state.time * 0.8 + i) * 0.012;

        if (webgl.stardustPos[i3 + 1] > 32) webgl.stardustPos[i3 + 1] = -32;
        if (webgl.stardustPos[i3 + 1] < -32) webgl.stardustPos[i3 + 1] = 32;
      }
      webgl.stardustGeo.attributes.position.needsUpdate = true;
      webgl.stardust.rotation.y = state.time * 0.02 + state.mouseX * 0.05;
      webgl.stardust.rotation.x = -state.mouseY * 0.03;
    }

    // Camera subtle tilt based on mouse parallax
    if (webgl.camera && !state.reducedMotion) {
      webgl.camera.position.x = state.mouseX * 2.5;
      webgl.camera.position.y = -state.mouseY * 1.8;
      webgl.camera.lookAt(0, 0, 0);
    }

    webgl.renderer.render(webgl.scene, webgl.camera);
  }

  /**
   * Calculate Scroll Progress & Velocity
   */
  function updateScrollProgress() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const currentY = window.scrollY || window.pageYOffset || 0;

    state.targetProgress = docHeight > 0 ? clamp(currentY / docHeight, 0, 1) : 0;
    state.scrollVelocity = currentY - state.lastScrollY;
    state.lastScrollY = currentY;

    if (dom.progressBar) {
      const pct = (state.targetProgress * 100).toFixed(2);
      dom.progressBar.style.width = pct + '%';
      dom.progressBar.setAttribute('aria-valuenow', Math.round(state.targetProgress * 100));
    }
  }

  /**
   * Update 5 Vertical Story Scenes & Parallax
   */
  function updateJourney(progress) {
    let sceneName = 'Chapter I — Celestial Arrival';
    const viewH = window.innerHeight;
    const viewCenter = viewH * 0.5;

    // Detect active scene from actual DOM bounding rects
    let activeSceneIdx = 0;

    if (dom.scenes && dom.scenes.length > 0) {
      for (let i = 0; i < dom.scenes.length; i++) {
        const sc = dom.scenes[i];
        const rect = sc.getBoundingClientRect();
        if (rect.top <= viewCenter && rect.bottom >= viewCenter) {
          activeSceneIdx = i;
          break;
        } else if (rect.top > viewCenter && i === 0) {
          activeSceneIdx = 0;
          break;
        } else if (rect.bottom < viewCenter && i === dom.scenes.length - 1) {
          activeSceneIdx = dom.scenes.length - 1;
        }
      }
    }

    if (activeSceneIdx === 0) {
      sceneName = 'Chapter I — Celestial Arrival';
    } else if (activeSceneIdx === 1) {
      sceneName = 'Chapter II — Enchanted Forest';
    } else if (activeSceneIdx === 2) {
      sceneName = 'Chapter III — Legendary Forest Path';
    } else if (activeSceneIdx === 3) {
      sceneName = 'Chapter IV — Ancient Fantasy City';
    } else {
      sceneName = 'Chapter V — Kingdom Reveal';
    }

    // 1. Smooth Parallax Depth on Vertical Scene Backdrops
    if (dom.scenes && dom.scenes.length > 0 && dom.sceneBackdrops && !state.reducedMotion) {
      const vH = window.innerHeight;
      dom.scenes.forEach((sceneEl, idx) => {
        const backdrop = dom.sceneBackdrops[idx];
        if (!backdrop) return;
        const rect = sceneEl.getBoundingClientRect();
        if (rect.bottom > -50 && rect.top < vH + 50) {
          const centerOffset = (rect.top + rect.height * 0.5) - (vH * 0.5);
          const parallaxY = centerOffset * 0.10;
          backdrop.style.transform = `translate3d(0, ${parallaxY.toFixed(1)}px, 0)`;
        }
      });
    }

    // 2. Update Story HUD Scene Tag
    if (dom.sceneTag && dom.sceneTag.textContent !== sceneName) {
      dom.sceneTag.textContent = sceneName;
    }

    // Play subtle crystal chime on scene transition (only if audio active)
    if (audio.isPlaying && audio.lastPlayedScene !== activeSceneIdx) {
      playChapterChime(activeSceneIdx);
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

    // Update Three.js WebGL Scene (Celestial Particles)
    updateWebGL(delta);

    requestAnimationFrame(render);
  }

  /**
   * Event Listeners
   */
  function attachListeners() {
    // Scroll Listener (passive, non-blocking)
    window.addEventListener('scroll', updateScrollProgress, { passive: true });

    // Ambient Soundscape Toggle (Opt-in)
    if (dom.soundToggle) {
      dom.soundToggle.addEventListener('click', () => {
        if (audio.isPlaying) {
          stopSoundscape();
        } else {
          startSoundscape();
        }
      });
    }

    // Graphics FX Mode Toggle
    initFXMode();

    // Pointer Parallax
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

    // Page Visibility (pause WebGL loop when tab is backgrounded)
    document.addEventListener('visibilitychange', () => {
      state.active = !document.hidden;
      if (state.active) lastTime = performance.now();
    });

    // Handle Reduced Motion Changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener?.('change', (e) => {
      state.reducedMotion = e.matches;
      if (e.matches) setFXMode(true);
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
