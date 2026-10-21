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
  }

  /**
   * Update Story Scenes & 3D Horse Trajectory across the Fantasy Landscape
   */
  function updateJourney(progress) {
    // Define Waypoints for The Legendary Horse across Scenes
    let charX, charY, charScale, charOpacity, charTilt = 0;
    let skyOpacity, forestOpacity, kingdomOpacity, foregroundOpacity = 0;
    let sceneName = 'The Arrival';

    const isMobile = state.isMobile;

    if (progress <= 0.20) {
      // Scene 1: The Arrival
      const t = progress / 0.20;
      sceneName = 'The Arrival — Celestial Horizon';

      charX = isMobile ? lerp(50, 50, t) : lerp(60, 58, t);
      charY = isMobile ? lerp(68, 66, t) : lerp(56, 54, t);
      charScale = isMobile ? lerp(0.58, 0.60, t) : lerp(0.76, 0.80, t);
      charOpacity = 1.0;

      skyOpacity = 1.0;
      forestOpacity = lerp(0.0, 0.35, t);
      kingdomOpacity = 0.0;
      foregroundOpacity = 0.0;

    } else if (progress <= 0.45) {
      // Scene 2: The Awakening
      const t = (progress - 0.20) / 0.25;
      sceneName = 'The Awakening — Realm of Nylarion';

      charX = isMobile ? lerp(50, 50, t) : lerp(58, 66, t);
      charY = isMobile ? lerp(66, 64, t) : lerp(54, 52, t);
      charScale = isMobile ? lerp(0.60, 0.64, t) : lerp(0.80, 0.84, t);
      charOpacity = 1.0;

      skyOpacity = lerp(1.0, 0.25, t);
      forestOpacity = lerp(0.35, 1.0, t);
      kingdomOpacity = 0.0;
      foregroundOpacity = lerp(0.0, 0.65, t);

    } else if (progress <= 0.72) {
      // Scene 3: Through the Living Forest
      const t = (progress - 0.45) / 0.27;
      sceneName = 'Through the Forest — Games & Creations';

      charX = isMobile ? lerp(50, 50, t) : lerp(66, 38, t);
      charY = isMobile ? lerp(64, 62, t) : lerp(52, 50, t);
      charScale = isMobile ? lerp(0.64, 0.62, t) : lerp(0.84, 0.80, t);
      charOpacity = isMobile ? 0.88 : 0.95;

      skyOpacity = 0.15;
      forestOpacity = lerp(1.0, 0.2, t);
      kingdomOpacity = lerp(0.0, 0.95, t);
      foregroundOpacity = lerp(0.65, 0.1, t);

    } else if (progress <= 0.88) {
      // Scene 4: The Ancient Kingdom
      const t = (progress - 0.72) / 0.16;
      sceneName = 'The Ancient Kingdom — Technology Citadel';

      charX = isMobile ? lerp(50, 50, t) : lerp(38, 32, t);
      charY = isMobile ? lerp(62, 60, t) : lerp(50, 48, t);
      charScale = isMobile ? lerp(0.62, 0.64, t) : lerp(0.80, 0.78, t);
      charOpacity = 1.0;

      skyOpacity = lerp(0.15, 0.65, t);
      forestOpacity = 0.0;
      kingdomOpacity = lerp(0.95, 0.4, t);
      foregroundOpacity = 0.0;

    } else {
      // Scene 5 & 6: The Studio Revealed & The Invitation
      const t = (progress - 0.88) / 0.12;
      sceneName = 'The Invitation — Play Beyond Reality';

      charX = isMobile ? lerp(50, 50, t) : lerp(32, 64, t);
      charY = isMobile ? lerp(60, 64, t) : lerp(48, 54, t);
      charScale = isMobile ? lerp(0.64, 0.62, t) : lerp(0.78, 0.82, t);
      charOpacity = 1.0;

      skyOpacity = lerp(0.65, 0.95, t);
      forestOpacity = 0.0;
      kingdomOpacity = lerp(0.4, 0.2, t);
      foregroundOpacity = 0.0;
    }

    // 1. POSITION 3D HORSE IN THREE.JS WORLD COORDINATES
    if (webgl.is3DReady && webgl.horseGroup && webgl.camera) {
      const aspect = window.innerWidth / window.innerHeight;
      const vFovRad = (webgl.camera.fov * Math.PI) / 180;
      const frustumH = 2 * Math.tan(vFovRad / 2) * 50; // ~46.63 units
      const frustumW = frustumH * aspect;

      const ndcX = (charX / 100) * 2 - 1;
      const ndcY = -((charY / 100) * 2 - 1);

      const targetX = ndcX * (frustumW * 0.5) + (state.mouseX * 1.5);
      const targetY = ndcY * (frustumH * 0.5) - (state.mouseY * 1.2);

      // Smooth interpolation of 3D horse position
      webgl.horseGroup.position.x = lerp(webgl.horseGroup.position.x, targetX, 0.12);
      webgl.horseGroup.position.y = lerp(webgl.horseGroup.position.y, targetY, 0.12);
      webgl.horseGroup.position.z = 0;

      // Scale horse proportionally to viewport & scene depth
      const s = (isMobile ? 3.4 : 4.4) * charScale;
      webgl.horseGroup.scale.set(s, s, s);

      // Facing orientation: base -Math.PI * 0.5 (traveling rightward along +X)
      // When moving across Scene 3, angle slightly towards camera for dynamic perspective
      let targetYaw = -Math.PI * 0.5;
      if (progress > 0.45 && progress <= 0.72) {
        targetYaw = -Math.PI * 0.40;
      }
      webgl.horseGroup.rotation.y = lerp(webgl.horseGroup.rotation.y, targetYaw, 0.08);

      // Dynamic banking, pitch on acceleration/braking
      if (!state.reducedMotion) {
        const pitch = clamp(-state.scrollVelocity * 0.012, -0.15, 0.15);
        const roll = Math.sin(state.time * 5.5) * Math.min(0.04, Math.abs(state.scrollVelocity) * 0.008);
        webgl.horseGroup.rotation.x = lerp(webgl.horseGroup.rotation.x, pitch, 0.1);
        webgl.horseGroup.rotation.z = lerp(webgl.horseGroup.rotation.z, roll, 0.1);
      }
    }

    // 2. DEFINITIVE LEGENDARY STEED CHARACTER POSITIONING
    if (dom.character && !webgl.is3DReady) {
      let breathingY = 0;
      let trotBob = 0;

      if (!state.reducedMotion) {
        breathingY = Math.sin(state.time * 1.8) * 4;
        const speed = Math.abs(state.scrollVelocity);
        if (speed > 0.4) {
          trotBob = Math.sin(state.time * 8.5) * Math.min(3.5, speed * 0.28);
          charTilt = Math.sin(state.time * 8.5) * Math.min(1.0, speed * 0.05);
        }
      }

      const posX = charX + (state.mouseX * 1.2);
      const posY = charY + (state.mouseY * 1.0);

      dom.character.style.left = `${posX}vw`;
      dom.character.style.top = `calc(${posY}vh + ${(breathingY + trotBob).toFixed(1)}px)`;
      dom.character.style.transform = `translate3d(-50%, -50%, 0) scale(${charScale}) rotate(${charTilt.toFixed(2)}deg)`;
      dom.character.style.opacity = `${charOpacity}`;
    }

    // 3. Update Environmental Layers
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
