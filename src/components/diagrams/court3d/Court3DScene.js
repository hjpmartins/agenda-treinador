// Motor da vista 3D de jogadas (three.js), sem dependência de React.
//
// Recebe uma sequência de diagramas no formato do editor 2D ({court, tokens,
// arrows}) e mostra-a num campo de madeira em perspetiva, com câmara orbital
// (rodar, inclinar, zoom, enquadrar), transição 2D <-> 3D e reprodução da
// jogada passo a passo. Só visualização: não há edição em 3D.
//
// Coordenadas: o diagrama usa x (0..w) e y (0..h) do viewBox; no mundo 3D
// x = x - w/2, z = y - h/2 e o soalho do campo está em y = 0. 1 unidade do
// diagrama = 5 cm (campo de 15 m de largura = 300 unidades).

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { HALF_VB, FULL_VB } from "../../../data";
import { createCourtTexture, createTokenTopTexture, createBallTexture, ensureFonts } from "./textures";
import { buildArrows } from "./arrows3d";
import { sampleStep, rimPositions, BALL_R, PUCK_H, PUCK_R, RIM_H } from "./playAnimation";

const COLORS = {
  bg: "#0B0E13",
  table: "#12161D",
  grid: "#2E3644",
  accent: "#EA5B13",
  text: "#F2EDE3",
  red: "#D64545",
};

const SLAB_T = 6; // espessura do "estrado" do campo
const STEP_SECONDS = 1.3; // igual ao leitor 2D (1300 ms)
const PAUSE_SECONDS = 0.45;
const MAX_POLAR = THREE.MathUtils.degToRad(84);
const FOV_3D = 36;
const FOV_2D = 10; // quase ortográfica: a transição 2D<->3D faz um "dolly zoom"

const damp = (current, goal, lambda, dt) => goal + (current - goal) * Math.exp(-lambda * dt);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ------------------------------ Mesa com grelha ------------------------------ */

function createGridTable() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(COLORS.table) },
      uLine: { value: new THREE.Color(COLORS.grid) },
      uAccent: { value: new THREE.Color(COLORS.accent) },
      uFade: { value: 900 },
      uBg: { value: new THREE.Color(COLORS.bg) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uLine;
      uniform vec3 uAccent;
      uniform float uFade;
      uniform vec3 uBg;
      varying vec2 vXZ;
      float gridLine(vec2 p, float size, float width) {
        vec2 g = abs(fract(p / size - 0.5) - 0.5) / fwidth(p / size);
        return 1.0 - min(min(g.x, g.y) / width, 1.0);
      }
      void main() {
        float minor = gridLine(vXZ, 20.0, 1.0);
        float major = gridLine(vXZ, 100.0, 1.4);
        float d = length(vXZ);
        float fade = 1.0 - smoothstep(uFade * 0.25, uFade, d);
        vec3 col = uBase;
        col = mix(col, uLine, minor * 0.55 * fade);
        col = mix(col, uLine * 1.5, major * 0.8 * fade);
        // Brilho quente por baixo do campo, como luz a escapar do estrado.
        col += uAccent * 0.05 * (1.0 - smoothstep(120.0, 420.0, d));
        col = mix(uBg, col, fade);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -SLAB_T;
  return mesh;
}

/* --------------------------------- Cesto ----------------------------------- */

function createHoop() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: "#F2EDE3", roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1E242E", roughness: 0.6, metalness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: COLORS.accent, roughness: 0.35, metalness: 0.4, emissive: COLORS.accent, emissiveIntensity: 0.15 });

  // Tabela (vidro) com moldura e quadrado de tiro. Fica na linha z = 0 do grupo,
  // o aro avança para -z (para dentro do campo).
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(40, 22, 0.8),
    new THREE.MeshStandardMaterial({ color: "#C9D6E8", transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false })
  );
  glass.position.set(0, 69, 0);
  g.add(glass);
  const frame = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), white);
    m.position.set(x, y, -0.1);
    g.add(m);
  };
  frame(40, 1, 0, 80);
  frame(40, 1, 0, 58);
  frame(1, 22, -20, 69);
  frame(1, 22, 20, 69);
  frame(12, 0.7, 0, 68);
  frame(0.7, 9, -6, 63.5);
  frame(0.7, 9, 6, 63.5);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(41, 2, 2), dark);
  pad.position.set(0, 57.5, 0.2);
  g.add(pad);

  // Aro e rede.
  const rimMat = orange.clone();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.45, 12, 40), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_H, -6.5);
  rim.castShadow = true;
  g.add(rim);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2), orange);
  bracket.position.set(0, RIM_H, -1);
  g.add(bracket);
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(5.1, 3.2, 9, 14, 3, true),
    new THREE.MeshBasicMaterial({ color: "#F2EDE3", wireframe: true, transparent: true, opacity: 0.55 })
  );
  net.position.set(0, RIM_H - 4.6, -6.5);
  g.add(net);

  // Poste fora do campo, assente na mesa, com braço até à tabela.
  const poleH = 70 + SLAB_T;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(3.5, poleH, 3.5), dark);
  pole.position.set(0, poleH / 2 - SLAB_T, 28);
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 28), dark);
  arm.position.set(0, 68, 14);
  g.add(arm);
  const base = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 14), dark);
  base.position.set(0, 3 - SLAB_T, 32);
  base.castShadow = true;
  g.add(base);
  const padBase = new THREE.Mesh(new THREE.BoxGeometry(18.4, 4, 3), new THREE.MeshStandardMaterial({ color: COLORS.accent, roughness: 0.7 }));
  padBase.position.set(0, 2 - SLAB_T + 1, 25);
  g.add(padBase);

  g.traverse((o) => {
    if (o.isMesh && o !== glass && o !== net) o.castShadow = true;
  });
  return { group: g, rimMat, net };
}

/* --------------------------------- Fichas ---------------------------------- */

function createTokenMesh(token) {
  const { type } = token;
  if (type === "cone") {
    const g = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: "#F2C744", roughness: 0.5 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6.5, 15, 28), yellow);
    cone.position.y = 8.5;
    const base = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 15), yellow);
    base.position.y = 0.6;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.6, 2.2, 28, 1, true), new THREE.MeshStandardMaterial({ color: "#F2EDE3", roughness: 0.4 }));
    stripe.position.y = 9.5;
    [cone, base, stripe].forEach((m) => {
      m.castShadow = true;
      g.add(m);
    });
    return { object: g, topMat: null };
  }
  if (type === "treinador") {
    const topTex = createTokenTopTexture("treinador");
    const side = new THREE.MeshStandardMaterial({ color: "#D8D2C6", roughness: 0.5 });
    const box = new THREE.Mesh(new RoundedBoxGeometry(15, PUCK_H + 1, 15, 3, 2), side);
    box.position.y = (PUCK_H + 1) / 2;
    box.castShadow = true;
    const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 12.5), topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = PUCK_H + 1.02;
    const g = new THREE.Group();
    g.add(box, top);
    return { object: g, topMat };
  }
  // Jogadora (ataque) ou defesa: "disco" baixo — continua a ler-se como um
  // círculo visto de cima, mas ganha volume e sombra em perspetiva.
  const isDef = type === "defense";
  const topTex = createTokenTopTexture(type, token.number);
  const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.45, metalness: 0.05, emissiveMap: topTex, emissive: "#ffffff", emissiveIntensity: 0.18 });
  const sideMat = new THREE.MeshStandardMaterial({
    color: isDef ? "#C23A3A" : "#B8450C",
    roughness: 0.5,
    emissive: isDef ? COLORS.red : COLORS.accent,
    emissiveIntensity: isDef ? 0.25 : 0.08,
  });
  const bottomMat = new THREE.MeshStandardMaterial({ color: "#14181F" });
  const geo = new THREE.CylinderGeometry(PUCK_R, PUCK_R, PUCK_H, 48);
  const mesh = new THREE.Mesh(geo, [sideMat, topMat, bottomMat]);
  mesh.position.y = PUCK_H / 2;
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  // Anel fino de luz na base — dá separação do soalho em ângulos rasos.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(PUCK_R + 0.4, PUCK_R + 2.2, 48),
    new THREE.MeshBasicMaterial({ color: isDef ? COLORS.red : COLORS.accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  return { object: g, topMat };
}

/* ---------------------------------- Cena ----------------------------------- */

class Court3DScene {
  /**
   * @param {HTMLElement} container elemento onde o <canvas> é inserido
   * @param {object} opts
   *   onStateChange(state) — chamado quando o passo/estado de reprodução muda
   *   bloom (bool, default true) — pós-processamento de brilho
   *   intro (bool, default true) — voo de câmara inicial
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { bloom: true, intro: true, ...opts };
    this.onStateChange = opts.onStateChange || (() => {});
    this.disposed = false;

    this.steps = [];
    this.stepIndex = 0;
    this.t = 0;
    this.playing = false;
    this.playMode = "all";
    this.pauseLeft = 0;
    this.speed = 1;
    this.court = null;
    this.vb = HALF_VB;
    this.tokenMeshes = new Map();
    this.arrows = null;
    this.arrowsStep = -1;
    this.autoRotate = false;
    this.viewMode = "3d";
    this.lastEmit = 0;
    this.shotFlash = 0;

    // Câmara: valores atuais (cam) perseguem os objetivos (goal) com amortecimento.
    this.cam = { az: Math.PI, polar: THREE.MathUtils.degToRad(55), zoom: 1, fov: FOV_3D, tx: 0, tz: 0, fit: 600 };
    this.goal = { ...this.cam };
    this.saved3d = { az: Math.PI, polar: THREE.MathUtils.degToRad(55) };

    this.edit = { handler: null, hover: null, selectedId: null, pendingId: null, handle: null };
    this._initRenderer();
    this._initScene();
    this._initEditOverlay();
    this._bindInput();

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);

    this.ready = ensureFonts().then(() => {
      this.fontsReady = true;
    });
  }

  /* -------------------------------- setup -------------------------------- */

  _initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.9;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.domElement.style.display = "block";
    r.domElement.style.width = "100%";
    r.domElement.style.height = "100%";
    r.domElement.style.touchAction = "none";
    r.domElement.style.cursor = "grab";
    this.container.appendChild(r.domElement);
    this.renderer = r;

    this.camera = new THREE.PerspectiveCamera(FOV_3D, 1, 5, 6000);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.Fog(COLORS.bg, 900, 2600);

    if (this.opts.bloom) {
      this.composer = new EffectComposer(r);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.45, 0.93);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(this.container);
    this._resize();
  }

  _initScene() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.35;

    this.scene.add(new THREE.HemisphereLight("#9DB0D0", "#14181F", 0.55));

    // Luz principal tipo "pavilhão": foco largo por cima do campo, com sombras.
    const spot = new THREE.SpotLight("#FFF1DE", 2.0, 0, THREE.MathUtils.degToRad(38), 0.65, 0);
    spot.position.set(-140, 720, 260);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.6;
    spot.shadow.radius = 4;
    spot.shadow.camera.near = 300;
    spot.shadow.camera.far = 1400;
    this.scene.add(spot, spot.target);
    this.spot = spot;

    const rim = new THREE.DirectionalLight("#7FA0FF", 0.35);
    rim.position.set(300, 200, -400);
    this.scene.add(rim);

    this.table = createGridTable();
    this.scene.add(this.table);

    this.courtGroup = new THREE.Group();
    this.scene.add(this.courtGroup);

    // Bolas (pode haver várias): geometria e material partilhados.
    this.ballTex = createBallTexture();
    this.ballGeo = new THREE.SphereGeometry(BALL_R, 40, 24);
    this.ballMat = new THREE.MeshStandardMaterial({ map: this.ballTex, roughness: 0.75, emissive: "#3A1505", emissiveIntensity: 0.4 });
    this.balls = new Map(); // id -> { mesh, prev }

    // Halos pulsantes por baixo de quem tem bola (um por bola).
    this.haloGeo = new THREE.RingGeometry(PUCK_R + 3, PUCK_R + 6.5, 64);
    this.haloMat = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    this.halos = [];
  }

  _ballMesh(id) {
    let entry = this.balls.get(id);
    if (!entry) {
      const mesh = new THREE.Mesh(this.ballGeo, this.ballMat);
      mesh.castShadow = true;
      this.scene.add(mesh);
      entry = { mesh, prev: null };
      this.balls.set(id, entry);
    }
    return entry;
  }

  _halo(i) {
    while (this.halos.length <= i) {
      const h = new THREE.Mesh(this.haloGeo, this.haloMat);
      h.rotation.x = -Math.PI / 2;
      h.position.y = 0.3;
      this.scene.add(h);
      this.halos.push(h);
    }
    return this.halos[i];
  }

  _buildCourt(court) {
    this._disposeCourt();
    this.court = court;
    this.vb = court === "campo" ? FULL_VB : HALF_VB;
    const { w, h } = this.vb;

    const courtTex = createCourtTexture(court, this.vb, this.renderer.capabilities.getMaxAnisotropy());
    const top = new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.35 });
    const side = new THREE.MeshStandardMaterial({ color: "#1A1F28", roughness: 0.7 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, SLAB_T, h), [side, side, top, side, side, side]);
    slab.position.y = -SLAB_T / 2;
    slab.receiveShadow = true;
    this.courtGroup.add(slab);

    // Friso laranja luminoso a contornar o estrado.
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.6, 0.01, h + 0.6)),
      new THREE.LineBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.9 })
    );
    edge.position.y = -SLAB_T + 0.6;
    this.courtGroup.add(edge);

    this.hoops = rimPositions(court, this.vb).map((rimPos) => {
      const hoop = createHoop();
      const wp = this.toWorld(rimPos);
      // O aro está a 6,5 do plano da tabela; a tabela fica do lado da linha de fundo.
      const towardBaseline = rimPos.y > h / 2 ? 1 : -1;
      hoop.group.position.set(wp.x, 0, wp.z + towardBaseline * 6.5);
      hoop.group.rotation.y = towardBaseline > 0 ? 0 : Math.PI;
      this.courtGroup.add(hoop.group);
      return hoop;
    });

    this.table.material.uniforms.uFade.value = Math.max(w, h) * 2.2;
    this._fitGoal(true);
  }

  _disposeCourt() {
    this.courtGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    this.courtGroup.clear();
    this.hoops = [];
  }

  toWorld(p) {
    return { x: p.x - this.vb.w / 2, z: p.y - this.vb.h / 2 };
  }

  /* ------------------------------- dados ---------------------------------- */

  /**
   * Troca a sequência de passos. Com { keep: true } (usado durante a edição)
   * mantém o passo atual, as fichas já criadas e a câmara.
   */
  setSequence(diagramas, opts = {}) {
    const list = (Array.isArray(diagramas) ? diagramas : [diagramas]).filter(Boolean);
    // As texturas usam as fontes da app: só desenhar depois de carregadas.
    if (this.fontsReady) this._applySequence(list, opts);
    else
      this.ready.then(() => {
        if (!this.disposed) this._applySequence(list, opts);
      });
  }

  _applySequence(list, { keep = false, stepIndex } = {}) {
    this.steps = list.length ? list : [{ court: "meio", tokens: [], arrows: [] }];
    const court = this.steps[0].court === "campo" ? "campo" : "meio";
    if (court !== this.court) {
      // Ângulo inicial: meio campo visto de trás do meio-campo (cesto ao fundo);
      // campo inteiro visto da lateral, como numa transmissão televisiva.
      const az = court === "campo" ? Math.PI / 2 : Math.PI;
      const polar = THREE.MathUtils.degToRad(court === "campo" ? 50 : 55);
      this.saved3d = { az, polar };
      if (this.viewMode === "3d") {
        this.goal.az = az;
        this.goal.polar = polar;
        this.goal.zoom = 1;
        this.goal.tx = 0;
        this.goal.tz = 0;
      }
      this._buildCourt(court);
      if (this.opts.intro && !this.introDone) this._intro();
    }
    if (keep) {
      const next = Math.max(0, Math.min(stepIndex ?? this.stepIndex, this.steps.length - 1));
      if (next !== this.stepIndex) {
        this.stepIndex = next;
        this.t = 0;
        this.playing = false;
        this.pauseLeft = 0;
      }
    } else {
      this._clearTokens();
      this.stepIndex = 0;
      this.t = 0;
      this.playing = false;
      this.pauseLeft = 0;
    }
    this._rebuildArrows();
    this._emit(true);
  }

  _clearTokens() {
    this.tokenMeshes.forEach((entry) => this._disposeToken(entry));
    this.tokenMeshes.clear();
  }

  _tokenMesh(token) {
    const sig = `${token.type}|${token.number ?? ""}`;
    let entry = this.tokenMeshes.get(token.id);
    if (entry && entry.sig !== sig) {
      this._disposeToken(entry);
      entry = null;
    }
    if (!entry) {
      entry = { ...createTokenMesh(token), sig };
      this.scene.add(entry.object);
      this.tokenMeshes.set(token.id, entry);
    }
    return entry.object;
  }

  _disposeToken({ object, topMat }) {
    this.scene.remove(object);
    object.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    if (topMat && topMat.map) topMat.map.dispose();
  }

  _rebuildArrows() {
    if (this.arrows) {
      this.scene.remove(this.arrows.group);
      this.arrows.dispose();
    }
    const step = this.steps[this.stepIndex];
    this.arrows = buildArrows(step, (p) => this.toWorld(p), { highlightId: this.edit.selectedId });
    this.scene.add(this.arrows.group);
    this.arrowsStep = this.stepIndex;
  }

  /* ---------------------------- reprodução -------------------------------- */

  play() {
    if (this.stepIndex >= this.steps.length - 1 && this.t >= 1) this.goToStep(0);
    this.playMode = "all";
    this.playing = true;
    this._emit(true);
  }

  pause() {
    this.playing = false;
    this._emit(true);
  }

  togglePlay() {
    if (this.playing) this.pause();
    else this.play();
  }

  reset() {
    this.goToStep(0);
  }

  goToStep(i) {
    this.stepIndex = Math.max(0, Math.min(this.steps.length - 1, i));
    this.t = 0;
    this.pauseLeft = 0;
    this.playing = false;
    this._rebuildArrows();
    this._emit(true);
  }

  // Avança um passo: anima o passo atual até ao fim; se já acabou, passa ao
  // seguinte e anima-o.
  nextStep() {
    if (this.t >= 1) {
      if (this.stepIndex >= this.steps.length - 1) return;
      this.goToStep(this.stepIndex + 1);
    }
    this.playMode = "step";
    this.playing = true;
    this._emit(true);
  }

  prevStep() {
    if (this.t > 0.02) this.goToStep(this.stepIndex);
    else this.goToStep(this.stepIndex - 1);
  }

  setSpeed(s) {
    this.speed = s;
    this._emit(true);
  }

  _advance(dt) {
    if (!this.playing) return;
    const n = this.steps.length;
    if (this.pauseLeft > 0) {
      this.pauseLeft -= dt * this.speed;
      if (this.pauseLeft <= 0) {
        this.pauseLeft = 0;
        if (this.stepIndex < n - 1) {
          this.stepIndex += 1;
          this.t = 0;
          this._rebuildArrows();
        } else {
          this.playing = false;
        }
        this._emit(true);
      }
      return;
    }
    this.t = Math.min(1, this.t + (dt * this.speed) / STEP_SECONDS);
    if (this.t >= 1) {
      if (this.playMode === "step" || this.stepIndex >= n - 1) {
        this.playing = false;
        this._emit(true);
      } else {
        this.pauseLeft = PAUSE_SECONDS;
      }
    }
  }

  _emit(force = false) {
    const now = performance.now();
    if (!force && now - this.lastEmit < 66) return;
    this.lastEmit = now;
    this.onStateChange(this.getState());
  }

  getState() {
    const n = this.steps.length;
    return {
      stepIndex: this.stepIndex,
      stepCount: n,
      stepProgress: this.t,
      progress: n ? (this.stepIndex + this.t) / n : 0,
      playing: this.playing,
      speed: this.speed,
      viewMode: this.viewMode,
      autoRotate: this.autoRotate,
      tilt: this.goal.polar / MAX_POLAR,
    };
  }

  /* ------------------------------- câmara --------------------------------- */

  rotateBy(rad) {
    if (this.viewMode === "2d") this.setViewMode("3d");
    this.goal.az += rad;
  }

  // 0 = vista de cima, 1 = quase rasante.
  setTilt(v) {
    if (this.viewMode === "2d" && v > 0.02) this.setViewMode("3d");
    this.goal.polar = Math.max(0, Math.min(1, v)) * MAX_POLAR;
    this._emit(true);
  }

  zoomBy(factor) {
    this.goal.zoom = THREE.MathUtils.clamp(this.goal.zoom * factor, 0.35, 2.4);
  }

  // "Enquadrar": centra o campo, repõe o zoom e recalcula a distância para
  // o campo inteiro caber no ecrã a partir do ângulo atual.
  frame() {
    this.goal.tx = 0;
    this.goal.tz = 0;
    this.goal.zoom = 1;
    this._fitGoal();
  }

  setViewMode(mode) {
    if (mode === this.viewMode) return;
    if (mode === "2d") {
      this.saved3d = { az: this.goal.az, polar: this.goal.polar };
      // Mesma orientação do editor 2D (cesto em baixo); campo inteiro deitado
      // se o ecrã for largo, para aproveitar o espaço.
      const wide = this.camera.aspect > 1.1 && this.court === "campo";
      const targetAz = wide ? Math.PI / 2 : 0;
      this.goal.az = this.goal.az + wrapAngle(targetAz - this.goal.az);
      this.goal.polar = 0;
      this.goal.fov = FOV_2D;
      this.autoRotate = false;
    } else {
      this.goal.az = this.goal.az + wrapAngle(this.saved3d.az - this.goal.az);
      this.goal.polar = this.saved3d.polar || THREE.MathUtils.degToRad(55);
      this.goal.fov = FOV_3D;
    }
    this.viewMode = mode;
    this.renderer.domElement.style.cursor = "grab";
    this.goal.tx = 0;
    this.goal.tz = 0;
    this.goal.zoom = 1;
    this._fitGoal();
    this._emit(true);
  }

  setAutoRotate(on) {
    this.autoRotate = on;
    if (on && this.viewMode === "2d") this.setViewMode("3d");
    this._emit(true);
  }

  _intro() {
    this.introDone = true;
    this.cam.az = this.goal.az - 1.1;
    this.cam.polar = THREE.MathUtils.degToRad(20);
    this.cam.zoom = 1.9;
  }

  _placeCamera(camera, s) {
    const dist = s.fit * s.zoom;
    const sp = Math.sin(s.polar);
    const cp = Math.cos(s.polar);
    // Vista de cima com az = 0: ecrã "para cima" = -z (como o diagrama 2D).
    camera.position.set(s.tx + dist * sp * Math.sin(s.az), dist * cp, s.tz + dist * sp * Math.cos(s.az));
    // "Cima" do ecrã tangente à órbita: contínuo desde a vista de cima até à rasante.
    camera.up.set(-cp * Math.sin(s.az), sp, -cp * Math.cos(s.az));
    camera.lookAt(s.tx, 4, s.tz);
    camera.fov = s.fov;
    camera.near = Math.max(2, dist * 0.04);
    camera.far = dist + 4000;
    camera.updateProjectionMatrix();
  }

  // Procura (por bisseção) a distância a que o campo — mais a altura dos
  // cestos — cabe no ecrã com a orientação/FOV de destino.
  _fitGoal(immediate = false) {
    const { w, h } = this.vb;
    const pad = 12;
    const hoopH = this.viewMode === "2d" ? 0 : 82;
    const corners = [];
    for (const x of [-w / 2 - pad, w / 2 + pad])
      for (const z of [-h / 2 - pad, h / 2 + pad]) for (const y of [-SLAB_T, hoopH]) corners.push(new THREE.Vector3(x, y, z));
    const cam = this.camera.clone();
    const s = { ...this.goal, zoom: 1, tx: 0, tz: 0 };
    let lo = 50;
    let hi = 20000;
    const v = new THREE.Vector3();
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      s.fit = mid;
      this._placeCamera(cam, s);
      cam.updateMatrixWorld();
      const fits = corners.every((c) => {
        v.copy(c).project(cam);
        return v.z < 1 && Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.9;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    this.goal.fit = hi;
    if (immediate) this.cam.fit = hi;
  }

  _resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
      this.bloom.resolution.set(w / 2, h / 2);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.court) this._fitGoal();
  }

  /* -------------------------------- input --------------------------------- */

  _bindInput() {
    const el = this.renderer.domElement;
    const pointers = new Map();
    let lastPinch = null;
    let lastMid = null;
    let panMode = false;

    // Edição (2D e 3D): um dedo / botão esquerdo vai primeiro ao editor. Em
    // 2D o editor fica sempre com o gesto; em 3D só quando começa numa ficha,
    // na pega de uma curva, ou numa ação de desenhar seta — arrastar no chão
    // vazio continua a rodar a câmara (e um toque simples seleciona/limpa).
    // Dois dedos, botão direito e roda continuam a mexer na câmara.
    let editPointer = null;
    let tapStart = null;
    const editEvent = (phase, e) => {
      const pt = this.screenToDiagram(e.clientX, e.clientY);
      return pt ? this.edit.handler({ phase, ...pt, shiftKey: e.shiftKey, view: this.viewMode, rims: rimPositions(this.court, this.vb) }) : false;
    };

    const onDown = (e) => {
      el.setPointerCapture(e.pointerId);
      const canEdit = this.edit.handler && e.button === 0 && !(e.shiftKey && this.viewMode === "3d") && pointers.size === 0;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tapStart = null;
      if (canEdit) {
        if (editEvent("down", e) !== false) {
          editPointer = e.pointerId;
          return;
        }
        tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
      if (editPointer != null) {
        // Segundo dedo durante uma edição: passa a ser gesto de câmara.
        this.edit.handler({ phase: "cancel" });
        editPointer = null;
      }
      panMode = e.button === 2 || e.shiftKey;
      el.style.cursor = "grabbing";
      this.autoRotate = false;
      lastPinch = null;
      lastMid = null;
      this._emit(true);
    };
    const onMove = (e) => {
      if (e.pointerId === editPointer) {
        editEvent("move", e);
        return;
      }
      if (this.edit.handler && pointers.size === 0) {
        const pt = this.screenToDiagram(e.clientX, e.clientY);
        el.style.cursor = pt && this.edit.hover ? this.edit.hover(pt, this.viewMode) : "grab";
      }
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        if (panMode) this._pan(dx, dy);
        else {
          const k = 0.006;
          if (this.viewMode === "2d" && Math.abs(dy) > 1.5) this.setViewMode("3d");
          this.goal.az -= dx * k;
          this.goal.polar = THREE.MathUtils.clamp(this.goal.polar - dy * k, 0, MAX_POLAR);
          this._emit();
        }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (lastPinch) this.zoomBy(lastPinch / dist);
        if (lastMid) this._pan(mid.x - lastMid.x, mid.y - lastMid.y);
        lastPinch = dist;
        lastMid = mid;
      }
    };
    const onUp = (e) => {
      pointers.delete(e.pointerId);
      if (e.pointerId === editPointer) {
        editPointer = null;
        editEvent("up", e);
        return;
      }
      // Toque curto no chão (sem arrastar) em 3D: conta como clique do editor.
      if (tapStart && tapStart.id === e.pointerId && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 5) editEvent("tap", e);
      tapStart = null;
      lastPinch = null;
      lastMid = null;
      if (pointers.size === 0) el.style.cursor = "grab";
    };
    const onWheel = (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(e.deltaY * 0.0012));
    };
    const onContext = (e) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContext);
    this._unbindInput = () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
    };
  }

  /* -------------------------------- edição -------------------------------- */

  // Ponto do ecrã -> coordenadas do diagrama (x, y do viewBox), por raycast
  // ao plano do soalho. Fica limitado ao campo.
  screenToDiagram(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._raycaster = this._raycaster || new THREE.Raycaster();
    this._raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    // Em perspetiva aponta-se ao topo das fichas, não ao soalho por baixo delas.
    const planeY = this.viewMode === "3d" ? PUCK_H : 0;
    if (!this._raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), hit)) return null;
    const { w, h } = this.vb;
    // Apontar para o aro (no ar, em 3D) conta como apontar para o cesto.
    const ray = this._raycaster.ray;
    let hoop = null;
    rimPositions(this.court, this.vb).forEach((r) => {
      const wp = this.toWorld(r);
      if (ray.distanceToPoint(new THREE.Vector3(wp.x, RIM_H, wp.z)) < 16) hoop = r;
    });
    if (hoop) return { x: hoop.x, y: hoop.y, hoop: true };
    return { x: THREE.MathUtils.clamp(hit.x + w / 2, 4, w - 4), y: THREE.MathUtils.clamp(hit.z + h / 2, 4, h - 4) };
  }

  // handler({phase: 'down'|'move'|'up'|'cancel', x, y, shiftKey}); hover(pt) devolve o cursor.
  setEditHandler(handler, hover) {
    this.edit.handler = handler;
    this.edit.hover = hover;
    this.renderer.domElement.style.cursor = "grab";
  }

  // Marcas visuais da edição: ficha/seta selecionada, jogadora de partida à
  // espera do destino e pega para curvar a seta.
  // handles: [{x, y, kind: 'control' | 'wp' | 'add'}].
  setEditOverlay({ selectedId = null, pendingId = null, handles = [] } = {}) {
    const changed = selectedId !== this.edit.selectedId;
    Object.assign(this.edit, { selectedId, pendingId, handles });
    if (changed && this.steps.length && this.court) this._rebuildArrows();
  }

  _initEditOverlay() {
    const ringMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.22, 48), ringMat(COLORS.text));
    this.pendRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.22, 48), ringMat(COLORS.accent));
    this.handleGeo = { disc: new THREE.CircleGeometry(5, 32), ring: new THREE.RingGeometry(5, 6.5, 32) };
    this.handleMat = {
      accent: new THREE.MeshBasicMaterial({ color: COLORS.accent }),
      text: new THREE.MeshBasicMaterial({ color: COLORS.text }),
      dark: new THREE.MeshBasicMaterial({ color: "#14181F", transparent: true, opacity: 0.85 }),
    };
    this.handlePool = [];
    [this.selRing, this.pendRing].forEach((m) => {
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.7;
      m.visible = false;
      m.renderOrder = 5;
      this.scene.add(m);
    });
  }

  _updateEditOverlay(sample, time) {
    const place = (mesh, id) => {
      const tk = id && sample.positions[id];
      mesh.visible = !!tk;
      if (!tk) return;
      const p = this.toWorld(tk);
      const ball = sample.balls.find((b) => b.id === id);
      mesh.position.set(p.x, ball ? ball.h - 5 : PUCK_H + 0.6, p.z);
      const isBall = !!ball;
      mesh.scale.setScalar(isBall ? 8.5 : PUCK_R + 3);
    };
    place(this.selRing, this.edit.selectedId);
    place(this.pendRing, this.edit.pendingId);
    this.pendRing.material.opacity = 0.55 + 0.4 * Math.sin(time * 6);
    // Pegas: laranja = curva / ponto de mudança; pequena "+" = novo ponto.
    const hs = this.edit.handles || [];
    while (this.handlePool.length < hs.length) {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(this.handleGeo.disc, this.handleMat.accent);
      const ring = new THREE.Mesh(this.handleGeo.ring, this.handleMat.text);
      g.add(disc, ring);
      g.rotation.x = -Math.PI / 2;
      g.renderOrder = 6;
      g.userData = { disc };
      this.scene.add(g);
      this.handlePool.push(g);
    }
    this.handlePool.forEach((g, i) => {
      const hd = hs[i];
      g.visible = !!hd;
      if (!hd) return;
      const p = this.toWorld(hd);
      g.position.set(p.x, 0.9, p.z);
      g.userData.disc.material = hd.kind === "add" ? this.handleMat.dark : this.handleMat.accent;
      g.scale.setScalar(hd.kind === "add" ? 0.7 : 1);
    });
  }

  _pan(dx, dy) {
    const s = this.cam;
    const dist = s.fit * s.zoom;
    const perPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(s.fov) / 2)) / this.container.clientHeight;
    const rx = Math.cos(s.az);
    const rz = -Math.sin(s.az);
    const fx = -Math.sin(s.az);
    const fz = -Math.cos(s.az);
    const fScale = 1 / Math.max(0.35, Math.cos(s.polar));
    this.goal.tx -= (rx * dx - fx * dy * fScale) * perPx;
    this.goal.tz -= (rz * dx - fz * dy * fScale) * perPx;
    const lim = Math.max(this.vb.w, this.vb.h) * 0.6;
    this.goal.tx = THREE.MathUtils.clamp(this.goal.tx, -lim, lim);
    this.goal.tz = THREE.MathUtils.clamp(this.goal.tz, -lim, lim);
  }

  /* -------------------------------- frame --------------------------------- */

  _loop() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;

    if (this.autoRotate) this.goal.az += dt * 0.18;
    const c = this.cam;
    const g = this.goal;
    c.az = damp(c.az, g.az, 6, dt);
    c.polar = damp(c.polar, g.polar, 6, dt);
    c.zoom = damp(c.zoom, g.zoom, 7, dt);
    c.fov = damp(c.fov, g.fov, 5, dt);
    c.fit = damp(c.fit, g.fit, 5, dt);
    c.tx = damp(c.tx, g.tx, 8, dt);
    c.tz = damp(c.tz, g.tz, 8, dt);
    this._placeCamera(this.camera, c);
    // Nevoeiro relativo à distância da câmara: a grelha da mesa desvanece-se
    // para o fundo tanto em 3D como na vista 2D (que fica muito mais longe).
    const camDist = c.fit * c.zoom;
    this.scene.fog.near = camDist + 200;
    this.scene.fog.far = camDist + 1800;

    if (this.steps.length && this.court) {
      this._advance(dt);
      this._updatePieces(time, dt);
      if (this.playing) this._emit();
    }

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  _updatePieces(time, dt) {
    const step = this.steps[this.stepIndex];
    if (this.arrowsStep !== this.stepIndex) this._rebuildArrows();
    const idlePreview = !this.playing && this.t === 0;
    this.arrows.setProgress(idlePreview ? null : this.t, this.pauseLeft > 0 ? 0.35 + 0.65 * (this.pauseLeft / PAUSE_SECONDS) : 1);

    const sample = sampleStep(step, this.t, this.vb);
    this._updateEditOverlay(sample, time);
    const seen = new Set();
    // Rodar as fichas com a câmara mantém os números sempre direitos.
    const yaw = this.cam.az;
    step.tokens.forEach((tk) => {
      if (tk.type === "ball") return;
      const obj = this._tokenMesh(tk);
      const p = this.toWorld(sample.positions[tk.id]);
      obj.position.set(p.x, 0, p.z);
      // A tampa do cilindro tem o "cima" da textura ao longo de +x; o tampo
      // do treinador (plano deitado) tem-no ao longo de -z.
      obj.rotation.y = tk.type === "cone" ? 0 : tk.type === "treinador" ? yaw : yaw + Math.PI / 2;
      obj.visible = true;
      seen.add(tk.id);
    });
    this.tokenMeshes.forEach((entry, id) => {
      if (!seen.has(id)) entry.object.visible = false;
    });

    const seenBalls = new Set();
    let haloCount = 0;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    sample.balls.forEach((b) => {
      seenBalls.add(b.id);
      const entry = this._ballMesh(b.id);
      const p = this.toWorld(b);
      entry.mesh.visible = true;
      // Rolamento: roda em torno do eixo perpendicular ao deslocamento.
      if (entry.prev) {
        const dx = p.x - entry.prev.x;
        const dz = p.z - entry.prev.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 40) entry.mesh.rotateOnWorldAxis(new THREE.Vector3(dz / d, 0, -dx / d), d / BALL_R);
      }
      entry.prev = p;
      entry.mesh.position.set(p.x, b.h, p.z);
      if (b.shotPhase > 0) this.shotFlash = 1;

      // Halo em quem tem a bola (a ficha de ataque mais próxima, se estiver perto).
      let holder = null;
      let best = PUCK_R + 14;
      step.tokens.forEach((tk) => {
        if (tk.type !== "offense") return;
        const q = sample.positions[tk.id];
        const d = Math.hypot(q.x - b.x, q.y - b.y);
        if (d < best && b.h < 28) {
          best = d;
          holder = q;
        }
      });
      if (holder) {
        const halo = this._halo(haloCount++);
        const hp = this.toWorld(holder);
        halo.visible = true;
        halo.position.x = hp.x;
        halo.position.z = hp.z;
        halo.scale.setScalar(1 + 0.06 * pulse);
      }
    });
    this.haloMat.opacity = 0.35 + 0.35 * pulse;
    this.halos.forEach((h, i) => {
      if (i >= haloCount) h.visible = false;
    });
    this.balls.forEach((entry, id) => {
      if (!seenBalls.has(id)) entry.mesh.visible = false;
    });

    // Aro a acender quando a bola entra.
    this.shotFlash = Math.max(0, this.shotFlash - dt * 1.5);
    (this.hoops || []).forEach((hp) => {
      hp.rimMat.emissiveIntensity = 0.15 + this.shotFlash * 3;
      hp.net.scale.set(1, 1 + this.shotFlash * 0.25, 1);
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this._unbindInput();
    this._clearTokens();
    this._disposeCourt();
    if (this.arrows) this.arrows.dispose();
    this.ballGeo.dispose();
    this.ballMat.dispose();
    this.ballTex.dispose();
    this.haloGeo.dispose();
    this.haloMat.dispose();
    this.table.geometry.dispose();
    this.table.material.dispose();
    this.envTex.dispose();
    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
    // Liberta já o contexto WebGL (os browsers só permitem uns poucos em simultâneo).
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

export { Court3DScene };
