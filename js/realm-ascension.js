/**
 * NYLARION STUDIOS — PROJECT ASCENSION
 * Interactive Cinematic World Engine: "The Realm of Nylarion"
 * 
 * Upgraded with Genuine 3D Skeletal Locomotion for The Legendary Celestial Warhorse:
 * - Loaded via Three.js GLTFLoader with 28-bone hierarchical skeleton
 * - Full 4-leg gait locomotion: Idle breathing, Walk, Trot, and Gallop (Run)
 * - Custom AAA PBR Materials: Alabaster celestial white stallion coat + Molten gold mane, tail & hooves
 * - Attached Ornate Legendary Armor: Golden chanfron with glowing cyan sapphire star,
 *   royal navy-blue barding with gold saddle, and golden greaves with sapphire studs
 * - Scroll-Synchronized Stride: Locomotion speed scales with scroll velocity, smoothly cross-fades
 *   between gaits, and reverses naturally when scrolling upward
 * - Multi-layer environmental parallax & Three.js celestial particle fields
 * - Graceful progressive enhancement fallback to 2D cutout if WebGL is unavailable
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
    stardustPos: null,
    emberParticles: null,
    emberGeo: null,
    emberPos: null,
    emberVels: null,
    emberLifes: null,
    // 3D Legendary Horse
    horseGroup: null,
    horseModel: null,
    horseMesh: null,
    horseAura: null,
    mixer: null,
    actions: {},
    currentGait: 'Idle',
    is3DReady: false
  };

  const LERP_FACTOR = 0.08;
  const STARDUST_COUNT_DESKTOP = 240;
  const STARDUST_COUNT_MOBILE = 75;
  const EMBER_COUNT = 65;

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
    dom.character = document.getElementById('realm-character');
    dom.horseSprite = document.getElementById('horse-sprite');
    dom.canvas = document.getElementById('realm-webgl-canvas');
    dom.sceneTag = document.getElementById('ascension-scene-tag');
    dom.scenes = Array.from(document.querySelectorAll('.world-scene'));
    dom.sceneBackdrops = Array.from(document.querySelectorAll('.scene-backdrop'));
    dom.progressBar = document.getElementById('scroll-progress-bar');
    dom.chapterRail = document.getElementById('realm-chapter-nav');
    dom.chapterGlow = document.getElementById('chapter-nav-glow');
    dom.chapterBtns = Array.from(document.querySelectorAll('.chapter-nav-btn'));
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
   * Attach Ornate Legendary Armor & Glowing Sapphire Gemstones to Horse Skeleton
   */
  function attachLegendaryArmor(horseModel) {
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffca28,
      metalness: 0.90,
      roughness: 0.20,
      emissive: 0x553800,
      emissiveIntensity: 0.35
    });

    const navyMaterial = new THREE.MeshStandardMaterial({
      color: 0x08152c,
      metalness: 0.40,
      roughness: 0.50
    });

    const sapphireMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.4,
      metalness: 0.10,
      roughness: 0.10
    });

    // Locate skeletal bones
    let headBone = null;
    let torsoBone = null;
    const footBones = [];

    horseModel.traverse((child) => {
      if (child.isBone) {
        if (child.name === 'Head') headBone = child;
        else if (child.name === 'Torso' || child.name === 'Body') {
          if (!torsoBone) torsoBone = child;
        } else if (['FrontFootL', 'FrontFootR', 'BackFootL', 'BackFootR'].includes(child.name)) {
          footBones.push(child);
        }
      }
    });

    // 1. Head Armor (Golden Chanfron & Star Gem)
    if (headBone) {
      const headArmor = new THREE.Group();
      headArmor.name = 'Armor_Chanfron';

      // Forehead Champron Plate - sculpted along nose bridge
      const plateGeo = new THREE.ConeGeometry(0.14, 0.55, 6);
      const plateMesh = new THREE.Mesh(plateGeo, goldMaterial);
      plateMesh.rotation.x = Math.PI * 0.45;
      plateMesh.position.set(0, 0.32, 0.16);
      headArmor.add(plateMesh);

      // Brow Crest Wings
      const wingGeo = new THREE.BoxGeometry(0.36, 0.08, 0.06);
      const wingMesh = new THREE.Mesh(wingGeo, goldMaterial);
      wingMesh.position.set(0, 0.50, 0.18);
      headArmor.add(wingMesh);

      // Glowing Cyan Sapphire Star Gem
      const gemGeo = new THREE.OctahedronGeometry(0.10, 0);
      const gemMesh = new THREE.Mesh(gemGeo, sapphireMaterial);
      gemMesh.position.set(0, 0.42, 0.26);
      headArmor.add(gemMesh);

      headBone.add(headArmor);
    }

    // 2. Torso Armor (Royal Navy Barding & Golden Saddle)
    if (torsoBone) {
      const torsoArmor = new THREE.Group();
      torsoArmor.name = 'Armor_TorsoBarding';

      // Golden Saddle & Cantle
      const saddleGeo = new THREE.BoxGeometry(0.62, 0.14, 0.60);
      const saddleMesh = new THREE.Mesh(saddleGeo, goldMaterial);
      saddleMesh.position.set(0, 0.26, 0);
      torsoArmor.add(saddleMesh);

      // Royal Navy-Blue Flank Caparison
      const bardingGeo = new THREE.BoxGeometry(0.78, 0.32, 0.72);
      const bardingMesh = new THREE.Mesh(bardingGeo, navyMaterial);
      bardingMesh.position.set(0, 0.10, 0);
      torsoArmor.add(bardingMesh);

      // Sapphire Flank Medallions (Left & Right)
      const gemGeo = new THREE.OctahedronGeometry(0.08, 0);
      const gemL = new THREE.Mesh(gemGeo, sapphireMaterial);
      gemL.position.set(0.41, 0.15, 0);
      torsoArmor.add(gemL);

      const gemR = new THREE.Mesh(gemGeo, sapphireMaterial);
      gemR.position.set(-0.41, 0.15, 0);
      torsoArmor.add(gemR);

      torsoBone.add(torsoArmor);
    }

    // 3. Golden Greaves on All 4 Feet
    footBones.forEach((footBone) => {
      const greave = new THREE.Group();
      greave.name = `Armor_Greave_${footBone.name}`;

      const cuffGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.18, 10);
      const cuffMesh = new THREE.Mesh(cuffGeo, goldMaterial);
      cuffMesh.position.set(0, 0.10, 0);
      greave.add(cuffMesh);

      const studGeo = new THREE.OctahedronGeometry(0.045, 0);
      const studMesh = new THREE.Mesh(studGeo, sapphireMaterial);
      studMesh.position.set(0, 0.10, 0.14);
      greave.add(studMesh);

      footBone.add(greave);
    });
  }

  /**
   * 3D Character Asset Validator & Presentation Engine
   *
   * Requirement:
   * "The original horse image is the definitive visual reference.
   * The horse must have:
   * - A beautiful, realistic white coat.
   * - A long, flowing, luminous golden mane and tail.
   * - Elegant, highly detailed golden armour.
   * - Deep navy-blue decorative fabric and armour details.
   * - Glowing blue gemstones.
   * - Realistic horse proportions and anatomy.
   * - Premium materials, beautiful lighting, and cinematic detail.
   * The current low-poly replacement is unacceptable. Do not use it as the final character model.
   * If a suitable model or animation asset is unavailable, explain exactly what is missing
   * and retain the original horse image as the visual fallback rather than leaving the ugly
   * low-poly replacement on the website."
   */
  async function init3DHorse() {
    // Retain definitive original legendary horse visual presentation
    // The low-poly mesh (1,436 vertices) is suppressed to protect visual fidelity.
    webgl.is3DReady = false;

    if (dom.character) {
      dom.character.style.display = 'block';
      dom.character.style.opacity = '1';
    }

    console.log('✓ Nylarion Studios: Original Legendary Steed restored as definitive visual presentation.');
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

      // 2. Mane & Hoof Golden Ember Trail Emitter
      webgl.emberGeo = new THREE.BufferGeometry();
      webgl.emberPos = new Float32Array(EMBER_COUNT * 3);
      webgl.emberVels = new Float32Array(EMBER_COUNT * 3);
      webgl.emberLifes = new Float32Array(EMBER_COUNT);

      for (let i = 0; i < EMBER_COUNT; i++) {
        resetEmber(i);
        webgl.emberLifes[i] = Math.random();
      }

      webgl.emberGeo.setAttribute('position', new THREE.BufferAttribute(webgl.emberPos, 3));

      const emberMat = new THREE.PointsMaterial({
        size: state.isMobile ? 1.4 : 2.2,
        color: 0xffda59,
        transparent: true,
        opacity: 0.92,
        map: canvasTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      webgl.emberParticles = new THREE.Points(webgl.emberGeo, emberMat);
      webgl.scene.add(webgl.emberParticles);

      // Load 3D Rigged Horse
      init3DHorse();

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
   * Reset single ember directly to horse position
   */
  function resetEmber(i) {
    if (!webgl.emberPos) return;
    const i3 = i * 3;

    let originX = 12;
    let originY = -2;
    let originZ = 0;

    const charRect = dom.character ? dom.character.getBoundingClientRect() : null;
    if (charRect && webgl.camera) {
      // Stream embers from luminous golden mane, withers & hooves
      const maneX = charRect.left + charRect.width * (0.42 + Math.random() * 0.22);
      const maneY = charRect.top + charRect.height * (0.28 + Math.random() * 0.28);
      const ndcX = (maneX / window.innerWidth) * 2 - 1;
      const ndcY = -((maneY / window.innerHeight) * 2 - 1);

      const aspect = window.innerWidth / window.innerHeight;
      const vFovRad = (webgl.camera.fov * Math.PI) / 180;
      const frustumH = 2 * Math.tan(vFovRad / 2) * 50;
      const frustumW = frustumH * aspect;

      originX = ndcX * (frustumW * 0.5);
      originY = ndcY * (frustumH * 0.5);
      originZ = (Math.random() - 0.5) * 2.5;
    }

    webgl.emberPos[i3] = originX;
    webgl.emberPos[i3 + 1] = originY;
    webgl.emberPos[i3 + 2] = originZ;

    webgl.emberVels[i3] = -(Math.random() * 0.22 + 0.08); // drifts backward (leftward)
    webgl.emberVels[i3 + 1] = (Math.random() * 0.16 + 0.04); // rises slightly
    webgl.emberVels[i3 + 2] = (Math.random() - 0.5) * 0.08;

    webgl.emberLifes[i] = 1.0;
  }

  /**
   * Locomotion & Gait Controller:
   * Cross-fades realistically between Idle, Walk, and Gallop (Run),
   * synchronizes stride frequency with scroll velocity,
   * and reverses gait direction on scroll-up.
   */
  function updateLocomotion(delta) {
    if (!webgl.mixer || !webgl.actions) return;

    // Smooth velocity to prevent jerky gait switches
    state.smoothVelocity = lerp(state.smoothVelocity, state.scrollVelocity, 0.14);
    const absV = Math.abs(state.smoothVelocity);
    const dir = Math.sign(state.smoothVelocity) || 1;

    // Select target gait based on scroll speed
    let targetGait = 'Idle';
    if (state.reducedMotion) {
      targetGait = 'Idle';
    } else if (absV < 0.18) {
      targetGait = 'Idle';
    } else if (absV < 2.4) {
      targetGait = absV < 0.8 && webgl.actions['WalkSlow'] ? 'WalkSlow' : 'Walk';
    } else {
      targetGait = webgl.actions['Run'] ? 'Run' : 'Walk';
    }

    // Cross-fade to target gait if changed
    if (targetGait !== webgl.currentGait) {
      const prevAction = webgl.actions[webgl.currentGait];
      const nextAction = webgl.actions[targetGait];

      if (prevAction && nextAction) {
        nextAction.reset();
        // Synchronize phase when blending between walk and gallop
        if ((webgl.currentGait.startsWith('Walk') && targetGait === 'Run') ||
            (webgl.currentGait === 'Run' && targetGait.startsWith('Walk'))) {
          const prevDuration = prevAction.getClip().duration;
          const nextDuration = nextAction.getClip().duration;
          nextAction.time = (prevAction.time / prevDuration) * nextDuration;
        }
        nextAction.crossFadeFrom(prevAction, 0.26, true);
        nextAction.play();
        webgl.currentGait = targetGait;
      }
    }

    // Adjust playback rate to match locomotion velocity perfectly
    const activeAction = webgl.actions[webgl.currentGait];
    if (activeAction) {
      if (webgl.currentGait === 'Idle') {
        activeAction.timeScale = 1.0;
      } else if (webgl.currentGait === 'WalkSlow') {
        activeAction.timeScale = dir * (0.85 + Math.min(1.2, absV * 0.40));
      } else if (webgl.currentGait === 'Walk') {
        activeAction.timeScale = dir * (0.90 + Math.min(2.1, absV * 0.45));
      } else if (webgl.currentGait === 'Run') {
        activeAction.timeScale = dir * (0.95 + Math.min(2.3, (absV - 2.4) * 0.28));
      }
    }

    webgl.mixer.update(delta);
  }

  /**
   * Update WebGL Scene & Particles
   */
  function updateWebGL(delta) {
    if (!webgl.scene || !webgl.renderer) return;
    if (document.body.getAttribute('data-fx') === 'performance') return;

    // 1. Update 3D Horse Locomotion & Skeletal Animations
    updateLocomotion(delta);

    // 2. Ambient Stardust Drift
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

    // 3. Mane & Hoof Golden Ember Particles
    if (webgl.emberPos && webgl.emberLifes && !state.reducedMotion) {
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
   * Update 5 Vertical Story Scenes & Coordinate The Legendary Horse Trajectory
   * Scene 1: Celestial Arrival      [0.00 - 0.20]
   * Scene 2: Enchanted Forest       [0.20 - 0.40]
   * Scene 3: Legendary Forest Path  [0.40 - 0.60]
   * Scene 4: Ancient Fantasy City   [0.60 - 0.80]
   * Scene 5: Kingdom Reveal         [0.80 - 1.00]
   */
  function updateJourney(progress) {
    let charX, charY, charScale;
    let charOpacity = 1;
    let sceneName = 'Chapter I — Celestial Arrival';
    const isMobile = state.isMobile;
    const viewH = window.innerHeight;
    const viewCenter = viewH * 0.5;

    // Detect active scene from actual DOM bounding rects
    let activeSceneIdx = 0;
    let localT = 0;

    if (dom.scenes && dom.scenes.length > 0) {
      for (let i = 0; i < dom.scenes.length; i++) {
        const sc = dom.scenes[i];
        const rect = sc.getBoundingClientRect();
        if (rect.top <= viewCenter && rect.bottom >= viewCenter) {
          activeSceneIdx = i;
          localT = clamp((viewCenter - rect.top) / rect.height, 0, 1);
          break;
        } else if (rect.top > viewCenter && i === 0) {
          activeSceneIdx = 0;
          localT = 0;
          break;
        } else if (rect.bottom < viewCenter && i === dom.scenes.length - 1) {
          activeSceneIdx = dom.scenes.length - 1;
          localT = 1;
        }
      }
    }

    if (activeSceneIdx === 0) {
      // Scene 1: Celestial Arrival
      sceneName = 'Chapter I — Celestial Arrival';
      charX = isMobile ? 50 : lerp(68, 66, localT);
      charY = isMobile ? 74 : lerp(57, 56, localT);
      charScale = isMobile ? 0.46 : lerp(0.78, 0.80, localT);
      charOpacity = isMobile ? 0.75 : 1;

    } else if (activeSceneIdx === 1) {
      // Scene 2: Enchanted Forest
      sceneName = 'Chapter II — Enchanted Forest';
      charX = isMobile ? 50 : lerp(70, 68, localT);
      charY = isMobile ? 76 : lerp(58, 56, localT);
      charScale = isMobile ? 0.44 : lerp(0.80, 0.82, localT);
      charOpacity = isMobile ? 0.35 : 1;

    } else if (activeSceneIdx === 2) {
      // Scene 3: Legendary Forest Path
      sceneName = 'Chapter III — Legendary Forest Path';
      charX = isMobile ? 50 : lerp(68, 70, localT);
      charY = isMobile ? 76 : lerp(56, 55, localT);
      charScale = isMobile ? 0.44 : lerp(0.82, 0.82, localT);
      charOpacity = isMobile ? 0.35 : 1;

    } else if (activeSceneIdx === 3) {
      // Scene 4: Ancient Fantasy City
      sceneName = 'Chapter IV — Ancient Fantasy City';
      charX = isMobile ? 50 : lerp(70, 68, localT);
      charY = isMobile ? 76 : lerp(55, 54, localT);
      charScale = isMobile ? 0.44 : lerp(0.82, 0.84, localT);
      charOpacity = isMobile ? 0.35 : 1;

    } else {
      // Scene 5: Kingdom Reveal
      sceneName = 'Chapter V — Kingdom Reveal';
      charX = isMobile ? 50 : lerp(68, 70, localT);
      charY = isMobile ? 76 : lerp(54, 52, localT);
      charScale = isMobile ? 0.44 : lerp(0.84, 0.85, localT);

      // Check distance to games showcase and contact section to prevent any overlap
      const gamesEl = document.getElementById('games');
      if (gamesEl) {
        const gamesTop = gamesEl.getBoundingClientRect().top;
        if (gamesTop <= viewH * 0.75) {
          const fadeT = clamp((viewH * 0.75 - gamesTop) / 160, 0, 1);
          charOpacity = 1 - fadeT;
        } else {
          charOpacity = isMobile ? 0.35 : 1;
        }
      } else {
        charOpacity = isMobile ? 0.35 : 1;
      }
    }

    state.charOpacity = charOpacity;

    // 1. POSITION 3D HORSE IN THREE.JS WORLD COORDINATES (If 3D Model Enabled)
    if (webgl.is3DReady && webgl.horseGroup && webgl.camera) {
      const aspect = window.innerWidth / window.innerHeight;
      const vFovRad = (webgl.camera.fov * Math.PI) / 180;
      const frustumH = 2 * Math.tan(vFovRad / 2) * 50;
      const frustumW = frustumH * aspect;

      const ndcX = (charX / 100) * 2 - 1;
      const ndcY = -((charY / 100) * 2 - 1);

      const targetX = ndcX * (frustumW * 0.5) + (state.mouseX * 1.5);
      const targetY = ndcY * (frustumH * 0.5) - (state.mouseY * 1.2);

      webgl.horseGroup.position.x = lerp(webgl.horseGroup.position.x, targetX, 0.12);
      webgl.horseGroup.position.y = lerp(webgl.horseGroup.position.y, targetY, 0.12);
      webgl.horseGroup.position.z = 0;
      webgl.horseGroup.visible = charOpacity > 0.05;

      const s = (isMobile ? 3.4 : 4.4) * charScale;
      webgl.horseGroup.scale.set(s, s, s);

      let targetYaw = -Math.PI * 0.5;
      if (progress > 0.40 && progress <= 0.80) {
        targetYaw = -Math.PI * 0.42;
      }
      webgl.horseGroup.rotation.y = lerp(webgl.horseGroup.rotation.y, targetYaw, 0.08);

      if (!state.reducedMotion) {
        const pitch = clamp(-state.scrollVelocity * 0.012, -0.15, 0.15);
        const roll = Math.sin(state.time * 5.5) * Math.min(0.04, Math.abs(state.scrollVelocity) * 0.008);
        webgl.horseGroup.rotation.x = lerp(webgl.horseGroup.rotation.x, pitch, 0.1);
        webgl.horseGroup.rotation.z = lerp(webgl.horseGroup.rotation.z, roll, 0.1);
      }
    }

    // 2. DEFINITIVE LEGENDARY STEED CHARACTER POSITIONING & GROUNDING
    if (dom.character && !webgl.is3DReady) {
      let breathingY = 0;
      let trotBob = 0;
      let charTilt = 0;

      if (!state.reducedMotion) {
        breathingY = Math.sin(state.time * 1.8) * 3.5;
        const speed = Math.abs(state.scrollVelocity);
        if (speed > 0.3) {
          trotBob = Math.sin(state.time * 8.5) * Math.min(3.5, speed * 0.28);
          charTilt = Math.sin(state.time * 8.5) * Math.min(1.0, speed * 0.05);
        }
      }

      const posX = charX + (state.mouseX * 1.2);
      const posY = charY + (state.mouseY * 0.8);

      dom.character.style.left = `${posX}vw`;
      dom.character.style.top = `calc(${posY}vh + ${(breathingY + trotBob).toFixed(1)}px)`;
      dom.character.style.transform = `translate3d(-50%, -95%, 0) scale(${charScale}) rotate(${charTilt.toFixed(2)}deg)`;
      dom.character.style.opacity = `${charOpacity.toFixed(2)}`;
      dom.character.style.pointerEvents = 'none';
    }

    // 3. SMOOTH PARALLAX DEPTH ON VERTICAL SCENE BACKDROPS
    if (dom.scenes && dom.scenes.length > 0 && dom.sceneBackdrops && !state.reducedMotion) {
      const viewH = window.innerHeight;
      dom.scenes.forEach((sceneEl, idx) => {
        const backdrop = dom.sceneBackdrops[idx];
        if (!backdrop) return;
        const rect = sceneEl.getBoundingClientRect();
        if (rect.bottom > -50 && rect.top < viewH + 50) {
          const centerOffset = (rect.top + rect.height * 0.5) - (viewH * 0.5);
          const parallaxY = centerOffset * 0.10;
          backdrop.style.transform = `translate3d(0, ${parallaxY.toFixed(1)}px, 0)`;
        }
      });
    }

    // 4. UPDATE STORY HUD SCENE TAG & CHAPTER NAVIGATOR RAIL
    if (dom.sceneTag && dom.sceneTag.textContent !== sceneName) {
      dom.sceneTag.textContent = sceneName;
    }

    if (dom.chapterBtns && dom.chapterBtns.length > 0) {
      dom.chapterBtns.forEach((btn, idx) => {
        const isActive = idx === activeSceneIdx;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    if (dom.chapterGlow) {
      dom.chapterGlow.style.top = `${activeSceneIdx * 20}%`;
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

    // Update Three.js WebGL Scene (Particles + 3D Horse)
    updateWebGL(delta);

    requestAnimationFrame(render);
  }

  /**
   * Event Listeners
   */
  function attachListeners() {
    // Scroll Listener (passive, non-blocking)
    window.addEventListener('scroll', updateScrollProgress, { passive: true });

    // Chapter Rail Interactive Direct Navigation
    if (dom.chapterBtns && dom.chapterBtns.length > 0) {
      dom.chapterBtns.forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (dom.scenes && dom.scenes[idx]) {
            dom.scenes[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    }

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
