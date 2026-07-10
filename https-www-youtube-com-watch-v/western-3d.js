(() => {
  const canvas = document.querySelector("#western-3d-canvas");
  const stage = document.querySelector("#western-3d-stage");
  const playerView = document.querySelector("#player-view");
  if (!canvas || !stage) return;

  const CDN = "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";
  const state = {
    mode: "lobby",
    role: "",
    saloon: "",
    running: false
  };
  let renderer = null;
  let scene = null;
  let camera = null;
  let THREE = null;
  let animationId = 0;
  let clock = null;
  let pointLight = null;
  let saloonSign = null;
  let duelGroup = null;
  let saloonGroup = null;
  let dust = null;
  let floorMaterial = null;
  let target = {
    cameraX: 0,
    cameraY: 8,
    cameraZ: 20,
    lightX: 0,
    lightY: 8,
    lightZ: 8,
    gold: 0xd59b35,
    fog: 0x110905
  };

  window.EmpireSheriff3D = {
    setMode(mode) {
      state.mode = mode || "default";
      stage.dataset.sceneMode = state.mode;
      updateTargets();
    },
    setPlayer(next) {
      state.role = next?.role || "";
      state.saloon = next?.saloon || "";
      updateTargets();
    },
    ready: false
  };

  function fallback() {
    stage.classList.add("western-3d-fallback");
  }

  function makeCanvasTexture(text, options = {}) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 1024;
    textureCanvas.height = 384;
    const ctx = textureCanvas.getContext("2d");
    ctx.fillStyle = options.background || "#1b0f08";
    ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, textureCanvas.height);
    gradient.addColorStop(0, "rgba(255, 220, 130, 0.3)");
    gradient.addColorStop(0.45, "rgba(255, 186, 64, 0.08)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.42)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
    ctx.strokeStyle = options.border || "#b47b28";
    ctx.lineWidth = 16;
    ctx.strokeRect(20, 20, textureCanvas.width - 40, textureCanvas.height - 40);
    ctx.fillStyle = options.color || "#ffd37a";
    ctx.font = "900 112px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    ctx.fillText(text, textureCanvas.width / 2, textureCanvas.height / 2 + 8);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.anisotropy = 4;
    return texture;
  }

  function makeBox(name, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    scene.add(mesh);
    return mesh;
  }

  function makeGroupBox(group, name, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    group.add(mesh);
    return mesh;
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x100906, 0.032);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
    camera.position.set(0, 8, 20);
    camera.lookAt(0, 2.2, -12);

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    clock = new THREE.Clock();

    const ambient = new THREE.HemisphereLight(0xffdf9e, 0x160805, 1.8);
    scene.add(ambient);

    const moon = new THREE.DirectionalLight(0x9fc6ff, 0.5);
    moon.position.set(-10, 18, 8);
    scene.add(moon);

    pointLight = new THREE.PointLight(0xffad3d, 9, 56, 1.7);
    pointLight.position.set(0, 8, 8);
    scene.add(pointLight);

    const wood = new THREE.MeshStandardMaterial({
      color: 0x29140a,
      roughness: 0.76,
      metalness: 0.06
    });
    floorMaterial = wood;
    makeBox("floor", [90, 0.4, 92], [0, -0.28, -12], wood);

    const grooveMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0503, transparent: true, opacity: 0.45 });
    for (let i = -20; i <= 20; i += 2.8) {
      makeBox("floor-groove-z", [90, 0.03, 0.04], [0, -0.04, i - 12], grooveMaterial);
    }
    for (let i = -42; i <= 42; i += 5.4) {
      makeBox("floor-groove-x", [0.04, 0.03, 92], [i, -0.03, -12], grooveMaterial);
    }

    buildSaloon();
    buildDuelProps();
    buildDust();
    updateTargets();
    resize();
  }

  function buildSaloon() {
    saloonGroup = new THREE.Group();
    saloonGroup.position.set(0, 0, -28);
    scene.add(saloonGroup);

    const wall = new THREE.MeshStandardMaterial({ color: 0x4d2512, roughness: 0.82 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x140905, roughness: 0.9 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xb17628, roughness: 0.42, metalness: 0.18 });

    makeGroupBox(saloonGroup, "saloon-wall", [28, 12, 1.2], [0, 6, 0], wall);
    makeGroupBox(saloonGroup, "saloon-roof", [32, 2, 3.5], [0, 13.1, 0.2], dark);
    makeGroupBox(saloonGroup, "saloon-door-left", [3.8, 6.2, 0.35], [-2.3, 3.1, 0.72], dark);
    makeGroupBox(saloonGroup, "saloon-door-right", [3.8, 6.2, 0.35], [2.3, 3.1, 0.72], dark);
    makeGroupBox(saloonGroup, "saloon-balcony", [31, 0.45, 3.8], [0, 7.8, 2.1], gold);
    for (let i = -13; i <= 13; i += 3.2) {
      makeGroupBox(saloonGroup, "saloon-post", [0.35, 4.4, 0.35], [i, 5.6, 2.4], gold);
    }

    const signTexture = makeCanvasTexture("SALOON");
    const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true });
    saloonSign = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.7), signMaterial);
    saloonSign.position.set(0, 15.1, 1);
    saloonGroup.add(saloonSign);
  }

  function buildDuelProps() {
    duelGroup = new THREE.Group();
    duelGroup.position.set(0, 0, -8);
    scene.add(duelGroup);

    const red = new THREE.MeshStandardMaterial({ color: 0x7c241b, roughness: 0.58, metalness: 0.08 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xca8b2c, roughness: 0.36, metalness: 0.18 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x100604, roughness: 0.74 });

    const leftCard = makeGroupBox(duelGroup, "duel-card-left", [8, 5, 0.55], [-7.5, 4.1, 0], dark);
    leftCard.rotation.y = 0.12;
    const rightCard = makeGroupBox(duelGroup, "duel-card-right", [8, 5, 0.55], [7.5, 4.1, 0], dark);
    rightCard.rotation.y = -0.12;

    makeGroupBox(duelGroup, "duel-pistol-left", [5.5, 0.45, 0.7], [-7.5, 7.6, 0.3], red).rotation.z = -0.16;
    makeGroupBox(duelGroup, "duel-pistol-right", [5.5, 0.45, 0.7], [7.5, 7.6, 0.3], red).rotation.z = 0.16;
    makeGroupBox(duelGroup, "duel-timer", [4.8, 4.8, 0.45], [0, 5.2, 0.2], brass);
    duelGroup.visible = false;
  }

  function buildDust() {
    const count = 150;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 72;
      positions[i * 3 + 1] = Math.random() * 16 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 68 - 10;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xd59b35,
      size: 0.045,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });
    dust = new THREE.Points(geometry, material);
    scene.add(dust);
  }

  function updateTargets() {
    const mode = state.mode || "default";
    const role = state.role || "";
    let gold = 0xd59b35;
    let fog = 0x110905;
    let cameraX = 0;
    let cameraY = 8;
    let cameraZ = 20;
    let lightX = 0;
    let lightY = 8;
    let lightZ = 8;

    if (mode === "discussion" || mode === "vote") {
      cameraX = state.saloon === "B" ? 4 : -4;
      cameraY = 7.4;
      cameraZ = 17;
      lightX = state.saloon === "B" ? 7 : -7;
      gold = 0xc88a3d;
      fog = 0x1b1008;
    } else if (mode === "duel" || mode === "duel-ready") {
      cameraY = 7;
      cameraZ = 13;
      lightY = 6.5;
      lightZ = 3;
      gold = 0xeea21a;
      fog = 0x170604;
    } else if (mode === "result") {
      cameraY = 8.4;
      cameraZ = 15;
      lightY = 8;
      lightZ = 2;
      gold = 0xffc55a;
      fog = 0x210a05;
    } else if (mode === "spectator" || mode === "game-over") {
      cameraX = 5;
      cameraY = 10;
      cameraZ = 24;
      gold = 0x8f7b5b;
      fog = 0x080807;
    } else if (role === "Hors-la-loi") {
      cameraX = 2;
      gold = 0xb8452c;
      fog = 0x1d0704;
    } else if (role === "Sheriff") {
      cameraX = -2;
      gold = 0xf1bd41;
      fog = 0x140b04;
    }

    target = { cameraX, cameraY, cameraZ, lightX, lightY, lightZ, gold, fog };
    if (scene) {
      scene.fog.color.setHex(fog);
      if (duelGroup) duelGroup.visible = mode === "duel" || mode === "duel-ready" || mode === "result";
      if (saloonGroup) saloonGroup.visible = mode !== "duel" && mode !== "result";
      if (pointLight) pointLight.color.setHex(gold);
      if (floorMaterial) floorMaterial.color.setHex(mode === "spectator" ? 0x1b120c : 0x29140a);
    }
  }

  function resize() {
    if (!renderer || !camera) return;
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const lerp = 0.035;
    camera.position.x += (target.cameraX + Math.sin(time * 0.22) * 0.22 - camera.position.x) * lerp;
    camera.position.y += (target.cameraY + Math.sin(time * 0.31) * 0.12 - camera.position.y) * lerp;
    camera.position.z += (target.cameraZ - camera.position.z) * lerp;
    camera.lookAt(0, 3.1, -14);
    if (pointLight) {
      pointLight.position.x += (target.lightX + Math.sin(time * 0.7) * 0.5 - pointLight.position.x) * 0.05;
      pointLight.position.y += (target.lightY + Math.sin(time * 1.1) * 0.18 - pointLight.position.y) * 0.05;
      pointLight.position.z += (target.lightZ - pointLight.position.z) * 0.05;
      pointLight.intensity = 8.5 + Math.sin(time * 4.1) * 0.35;
    }
    if (saloonSign) saloonSign.rotation.z = Math.sin(time * 0.55) * 0.01;
    if (duelGroup) duelGroup.rotation.y = Math.sin(time * 0.25) * 0.035;
    if (dust) {
      dust.rotation.y += 0.0007;
      dust.rotation.x = Math.sin(time * 0.11) * 0.012;
    }
    renderer.render(scene, camera);
  }

  function observeMode() {
    if (!playerView) return;
    const observer = new MutationObserver(() => {
      window.EmpireSheriff3D.setMode(playerView.dataset.mode || "default");
    });
    observer.observe(playerView, { attributes: true, attributeFilter: ["data-mode", "class"] });
    window.EmpireSheriff3D.setMode(playerView.dataset.mode || "lobby");
  }

  function init(threeModule) {
    THREE = threeModule;
    buildScene();
    observeMode();
    window.addEventListener("resize", resize);
    new ResizeObserver(resize).observe(stage);
    window.EmpireSheriff3D.ready = true;
    state.running = true;
    animate();
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    fallback();
    return;
  }

  import(CDN).then(init).catch(fallback);
})();
