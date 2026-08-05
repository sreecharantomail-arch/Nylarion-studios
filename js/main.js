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
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
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
  window.addEventListener('resize', () => {
    const newW = container.clientWidth;
    const newH = container.clientHeight;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
  });

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
