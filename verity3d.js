// verity3d.js — Verity 3D Face
// Three.js geometri, no external model file needed
// Face berubah karakter per fase 1-4

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class VerityModel {
  constructor(container) {
    this.container = container;
    this.phase = 1;
    this.mouse = { x: 0, y: 0 };
    this.clock = new THREE.Clock();
    this.glitching = false;
    this.particles = [];

    this._initScene();
    this._initFace();
    this._initParticles();
    this._initLights();
    this._bindEvents();
    this._animate();
  }

  // =====================
  // SCENE SETUP
  // =====================
  _initScene() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);
  }

  // =====================
  // FACE CONSTRUCTION
  // =====================
  _initFace() {
    this.faceGroup = new THREE.Group();
    this.scene.add(this.faceGroup);

    // --- HEAD: Icosahedron (bukan sphere biasa — lebih angular, eerie) ---
    const headGeo = new THREE.IcosahedronGeometry(1.4, 3);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x111118,
      roughness: 0.7,
      metalness: 0.3,
      wireframe: false,
    });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.faceGroup.add(this.head);

    // Head wireframe overlay (tipis, subtle)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    });
    this.headWire = new THREE.Mesh(headGeo, wireMat);
    this.faceGroup.add(this.headWire);

    // --- EYES ---
    this.eyes = [];
    this.eyeGlows = [];

    const eyePositions = [
      new THREE.Vector3(-0.42, 0.22, 1.25),
      new THREE.Vector3(0.42, 0.22, 1.25),
    ];

    eyePositions.forEach((pos) => {
      // Eye base (hitam)
      const eyeGeo = new THREE.SphereGeometry(0.13, 16, 16);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.copy(pos);
      this.faceGroup.add(eye);
      this.eyes.push(eye);

      // Iris (gold glow)
      const irisGeo = new THREE.SphereGeometry(0.07, 16, 16);
      const irisMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.copy(pos);
      iris.position.z += 0.07;
      this.faceGroup.add(iris);

      // Glow ring di sekitar eye
      const glowGeo = new THREE.RingGeometry(0.13, 0.22, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xFFD700,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(pos);
      glow.position.z += 0.05;
      this.faceGroup.add(glow);
      this.eyeGlows.push(glow);
    });

    // --- MOUTH: Garis tipis (default tertutup) ---
    const mouthPoints = [
      new THREE.Vector3(-0.3, -0.35, 1.25),
      new THREE.Vector3(-0.1, -0.38, 1.28),
      new THREE.Vector3(0.1, -0.38, 1.28),
      new THREE.Vector3(0.3, -0.35, 1.25),
    ];
    const mouthCurve = new THREE.CatmullRomCurve3(mouthPoints);
    const mouthGeo = new THREE.TubeGeometry(mouthCurve, 20, 0.012, 8, false);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.5 });
    this.mouth = new THREE.Mesh(mouthGeo, mouthMat);
    this.faceGroup.add(this.mouth);

    // --- NOSE HINT: dua titik kecil ---
    const noseDotGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const noseDotMat = new THREE.MeshBasicMaterial({ color: 0x444433 });
    [-0.07, 0.07].forEach(x => {
      const dot = new THREE.Mesh(noseDotGeo, noseDotMat);
      dot.position.set(x, -0.1, 1.35);
      this.faceGroup.add(dot);
    });

    // --- CRACK LINES (fase 3-4): garis retak di muka ---
    this.cracks = this._makeCracks();
    this.cracks.forEach(c => {
      c.visible = false;
      this.faceGroup.add(c);
    });
  }

  _makeCracks() {
    const cracks = [];
    const crackData = [
      [new THREE.Vector3(0.2, 0.8, 1.1), new THREE.Vector3(0.5, 0.3, 1.2), new THREE.Vector3(0.4, -0.1, 1.1)],
      [new THREE.Vector3(-0.3, 0.5, 1.1), new THREE.Vector3(-0.6, 0.1, 1.15), new THREE.Vector3(-0.5, -0.4, 1.0)],
      [new THREE.Vector3(0.0, -0.5, 1.3), new THREE.Vector3(0.2, -0.9, 1.1)],
    ];
    crackData.forEach(pts => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 12, 0.008, 4, false);
      const mat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.6 });
      cracks.push(new THREE.Mesh(geo, mat));
    });
    return cracks;
  }

  // =====================
  // PARTICLES (melayang di sekitar wajah)
  // =====================
  _initParticles() {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = [];

    for (let i = 0; i < count; i++) {
      const r = 1.8 + Math.random() * 2.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      speeds.push((Math.random() - 0.5) * 0.008);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._particlePositions = positions;
    this._particleSpeeds = speeds;
    this._particleCount = count;

    const mat = new THREE.PointsMaterial({
      color: 0xFFD700,
      size: 0.025,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });

    this.particleMesh = new THREE.Points(geo, mat);
    this.scene.add(this.particleMesh);
  }

  // =====================
  // LIGHTS
  // =====================
  _initLights() {
    // Ambient — sangat gelap
    const ambient = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambient);

    // Main light — gold dari depan atas
    this.mainLight = new THREE.PointLight(0xFFD700, 2.5, 10);
    this.mainLight.position.set(0, 2, 4);
    this.scene.add(this.mainLight);

    // Rim light — dari belakang, biru gelap
    const rimLight = new THREE.PointLight(0x1a1a4f, 1.5, 8);
    rimLight.position.set(0, -1, -4);
    this.scene.add(rimLight);

    // Eye light — tepat di depan mata
    this.eyeLight = new THREE.PointLight(0xFFD700, 1.2, 3);
    this.eyeLight.position.set(0, 0.2, 3);
    this.scene.add(this.eyeLight);
  }

  // =====================
  // EVENTS
  // =====================
  _bindEvents() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    });

    window.addEventListener('resize', () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  // =====================
  // SET PHASE
  // =====================
  setPhase(phase) {
    this.phase = phase;

    const phaseColors = {
      1: { head: 0x111118, eye: 0xFFD700, glow: 0xFFD700, wire: 0xFFD700, particle: 0xFFD700 },
      2: { head: 0x0e0e15, eye: 0xCCA800, glow: 0xCCA800, wire: 0xCCA800, particle: 0xCCA800 },
      3: { head: 0x0a0a10, eye: 0x8B7000, glow: 0x8B5000, wire: 0x8B7000, particle: 0x664400 },
      4: { head: 0x080808, eye: 0xFF2200, glow: 0xFF0000, wire: 0xFF2200, particle: 0xFF1100 },
    };

    const c = phaseColors[phase] || phaseColors[1];

    // Head color
    this.head.material.color.setHex(c.head);

    // Eye & glow colors
    this.eyes.forEach(eye => {
      eye.children; // noop
    });
    // Update iris & glow materials in scene
    this.faceGroup.children.forEach(child => {
      if (child.geometry && child.geometry.type === 'SphereGeometry') {
        const params = child.geometry.parameters;
        if (params && params.radius === 0.07) {
          child.material.color.setHex(c.eye);
        }
      }
      if (child.geometry && child.geometry.type === 'RingGeometry') {
        child.material.color.setHex(c.glow);
      }
    });

    // Wire opacity
    this.headWire.material.color.setHex(c.wire);
    this.headWire.material.opacity = phase === 4 ? 0.12 : 0.04;

    // Particle color
    this.particleMesh.material.color.setHex(c.particle);
    this.particleMesh.material.opacity = phase === 4 ? 0.8 : 0.5;

    // Eye light color
    this.eyeLight.color.setHex(c.eye);
    this.eyeLight.intensity = phase === 4 ? 2.5 : 1.2;

    // Main light color
    this.mainLight.color.setHex(c.glow);

    // Mouth opacity berubah per fase
    this.mouth.material.opacity = phase === 1 ? 0.5 : phase === 2 ? 0.35 : phase === 3 ? 0.6 : 0.9;
    this.mouth.material.color.setHex(c.eye);

    // Cracks visible ab fase 3
    this.cracks.forEach(c => { c.visible = phase >= 3; });
    if (phase === 4) {
      this.cracks.forEach(crack => { crack.material.color.setHex(0xFF2200); });
    }
  }

  // =====================
  // TRIGGER GLITCH (dipanggil dari script.js fase 4)
  // =====================
  triggerGlitch() {
    if (this.glitching) return;
    this.glitching = true;

    let count = 0;
    const interval = setInterval(() => {
      // Random offset kepala
      this.faceGroup.position.x = (Math.random() - 0.5) * 0.3;
      this.faceGroup.position.y = (Math.random() - 0.5) * 0.2;
      // Random scale
      const s = 0.95 + Math.random() * 0.15;
      this.faceGroup.scale.set(s, s, s);
      // Wire flicker
      this.headWire.material.opacity = Math.random() * 0.3;

      count++;
      if (count > 14) {
        clearInterval(interval);
        this.faceGroup.position.set(0, 0, 0);
        this.faceGroup.scale.set(1, 1, 1);
        this.glitching = false;
      }
    }, 60);
  }

  // =====================
  // ANIMATE
  // =====================
  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    const t = this.clock.getElapsedTime();
    const phase = this.phase;

    // --- HEAD: ngikutin mouse (ngeliat user) ---
    const targetRotY = this.mouse.x * 0.35;
    const targetRotX = -this.mouse.y * 0.25;
    this.faceGroup.rotation.y += (targetRotY - this.faceGroup.rotation.y) * 0.05;
    this.faceGroup.rotation.x += (targetRotX - this.faceGroup.rotation.x) * 0.05;

    // Slow ambient sway
    this.faceGroup.position.y = Math.sin(t * 0.4) * 0.06;

    // --- PHASE-SPECIFIC BEHAVIOR ---
    if (phase === 1) {
      // Ceria: sedikit bounce
      this.faceGroup.position.y += Math.sin(t * 1.2) * 0.02;
    }

    if (phase === 2) {
      // Sesekali twitch kecil
      if (Math.sin(t * 3.7) > 0.97) {
        this.faceGroup.position.x = (Math.random() - 0.5) * 0.05;
      } else {
        this.faceGroup.position.x *= 0.9;
      }
    }

    if (phase === 3) {
      // Kepala miring dikit, lebih lambat ngikutin mouse
      this.faceGroup.rotation.z = Math.sin(t * 0.3) * 0.06;
    }

    if (phase === 4) {
      // Glitch terus-terusan kecil
      if (Math.sin(t * 8) > 0.92) {
        this.faceGroup.position.x = (Math.random() - 0.5) * 0.08;
        this.headWire.material.opacity = Math.random() * 0.2 + 0.05;
      } else {
        this.faceGroup.position.x *= 0.85;
      }
      // Scale breathe disturbing
      const s = 1 + Math.sin(t * 1.5) * 0.015;
      this.faceGroup.scale.set(s, s, s);
    }

    // --- EYE GLOW PULSE ---
    const glowPulse = 0.15 + Math.abs(Math.sin(t * (phase === 4 ? 3.5 : 1.5))) * 0.25;
    this.eyeGlows.forEach(g => { g.material.opacity = glowPulse; });
    this.eyeLight.intensity = (phase === 4 ? 2 : 1) + Math.sin(t * 2) * 0.4;

    // --- PARTICLES: orbit lambat ---
    const pos = this._particlePositions;
    for (let i = 0; i < this._particleCount; i++) {
      const speed = this._particleSpeeds[i] * (phase === 4 ? 2.5 : 1);
      const x = pos[i * 3];
      const z = pos[i * 3 + 2];
      pos[i * 3]     = x * Math.cos(speed) - z * Math.sin(speed);
      pos[i * 3 + 2] = x * Math.sin(speed) + z * Math.cos(speed);
    }
    this.particleMesh.geometry.attributes.position.needsUpdate = true;

    // Partikel makin deket ke muka di fase 4
    if (phase === 4) {
      this.particleMesh.scale.setScalar(0.85 + Math.sin(t * 0.8) * 0.06);
    } else {
      this.particleMesh.scale.setScalar(1);
    }

    // --- MOUTH: "ngomong" saat fase 4 ---
    if (phase === 4) {
      this.mouth.scale.y = 1 + Math.abs(Math.sin(t * 4)) * 0.8;
    } else {
      this.mouth.scale.y = 1;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // =====================
  // DESTROY
  // =====================
  destroy() {
    cancelAnimationFrame(this._raf);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('resize', this._onResize);
  }
}
