/* ASTRO·FORAGE 3D — orchestrateur : modes, avatars (astronaute + foreuse),
 * caméras FPS/TPS, forage, base, fusée, coop, événements, sauvegarde.
 * Les nombres d'équilibrage viennent de l'original (unités : mètres, 1 voxel = 2 m). */
import * as THREE from "three";
import {
  W, SURF, O2MAX, POUCH, DAYLEN, BEAM_COST, BEAM_CD, QUESTS, FEATS, BUILDINGS,
  RESDEF, T as TILES, DIFFS, ROCK_POS, SPAWN_DRILL, SPAWN_ASTRO, DECOR,
  tile, isPassableId, rowOfY, topYOfRow, canPlaceBuilding, surfaceTopY, mulberry32,
  type DiffKey, type GameEvent, type Snapshot, type WirePlayer, SEND_HZ
} from "@astroforage/shared";
import { SceneMgr } from "../render/sceneMgr.js";
import { VoxelWorld } from "../render/voxelWorld.js";
import { Props, makeBuilding, makeNest, makeDebris, makeBeacon, animAstro, type AstroRig } from "../render/props.js";
import { Effects } from "../render/effects.js";
import { Hud, type HudState } from "../ui/hud.js";
import { Cockpit } from "../ui/cockpit.js";
import { Panels, type PanelHost } from "../ui/panels.js";
import { Menus, VERSION, type MenuHost } from "../ui/menus.js";
import { t, pick, getLang } from "../ui/i18n.js";
import { Input } from "../input.js";
import { au } from "../audio/engine.js";
import { settings, saveSettings } from "../config.js";
import { LocalSim, NetSim, foretStats, upVal, dayPhase, type SimPort } from "./simPort.js";
import { moveAABB, touchesLava, raycastVoxel, setStaticBoxes, type StaticBox } from "./physics.js";
import { Interior, ROOM, makeDecoMesh } from "./interior.js";
import { Overlays } from "../render/overlays.js";
import { BuildingVisual, loadBuildingTemplates, buildingHeight, type BuildingCtx } from "../render/buildings.js";
import {
  newSlot, saveSlot, loadSlot, curSlotId, setCurSlot, loadFeats, saveFeats, saveBest,
  type SlotData
} from "../save/store.js";

const VOX = 2;
const AH = { x: 0.42, y: 0.82, z: 0.42 };  // demi-boîte astronaute
const DH = { x: 0.76, y: 0.76, z: 0.76 };  // demi-boîte foreuse
const EYE = 0.62;                          // hauteur des yeux depuis le centre
const REACH = 4.6;                         // portée de forage (m)
const GRAV = 44;                           // 22 t/s² × 2

interface Remote {
  rig: AstroRig | null;
  drill: THREE.Object3D | null;
  label: THREE.Sprite;
  cur: THREE.Vector3;
  target: THREE.Vector3;
  data: WirePlayer;
  holder: THREE.Group;
}

export class Game {
  scene: SceneMgr;
  input: Input;
  hud: Hud;
  cockpit: Cockpit;
  panels: Panels;
  menus: Menus;
  fx!: Effects;
  props = new Props();
  world: VoxelWorld | null = null;
  sim: SimPort | null = null;

  mode: "boot" | "menu" | "play" | "interior" | "launch" | "win" = "boot";
  camMode: "fps" | "tps" = "fps";
  interior = new Interior();
  overlays!: Overlays;
  placingDeco: string | null = null;
  private decoGhost: THREE.Object3D | null = null;
  private outsidePos: { x: number; y: number; z: number } | null = null;

  /* avatars (client-autoritatif, comme l'original) */
  astro = { x: 0, y: 2, z: 0, vx: 0, vy: 0, vz: 0, o2: O2MAX, jp: 90, pouch: 0, grounded: true, anim: 0, inDrill: false, o2Warn: false, jets: false };
  drill = { x: 0, y: 2, z: 0, vx: 0, vy: 0, vz: 0, hp: 60, en: 100, grounded: true, yaw: 0, digP: 0, beamCD: 0, boosting: false, digging: false };
  inv: Record<string, number> = {};
  private digKey = "";
  private digTarget: { x: number; z: number; d: number } | null = null;
  private depositing = false;
  private lastDepositN = 0;
  private noteT = 0;
  private localBoostT = 0;

  /* visuels */
  private drillMesh!: THREE.Object3D;
  private rocketMesh!: THREE.Object3D;
  private myRig!: AstroRig;
  private buildingVisuals = new Map<string, BuildingVisual>();
  private buildingTemplates: Record<string, THREE.Object3D | null> = {};
  private factoryT = 0;
  private robotMeshes = new Map<number, THREE.Object3D>();
  private creatureMeshes: THREE.Object3D[] = [];
  private projMeshes: THREE.Object3D[] = [];
  private nestMeshes = new Map<string, THREE.Object3D>();
  private debrisMeshes = new Map<string, THREE.Object3D>();
  private specials = new Map<string, THREE.Object3D>();  // cristaux + cœur
  private remotes = new Map<number, Remote>();
  private ghost: THREE.Object3D | null = null;
  placing: string | null = null;

  /* cadence */
  private saveT = 0;
  private moodT = 0;
  private featT = 0;
  private sendT = 0;
  private featsCache = loadFeats();
  private launchAnim = { t: 0, act: 1 as 1 | 2, failT: 0, failW: 0, w: 0, ignited: false, cdN: -1 };
  private drillSpin!: THREE.Group;
  private drillSpinMesh!: THREE.Mesh;
  private drillFlames: THREE.Mesh[] = [];
  private drillTilt = { x: 0, z: 0 };
  private thrusting = false;
  private hurtA = 0;
  private beaconBulb: THREE.Mesh | null = null;
  private beaconHalo: THREE.Sprite | null = null;
  private moteT = 0;
  /* foret visible en vue cockpit (viewmodel devant la caméra) */
  private fpBit: THREE.Group | null = null;
  private fpBitInner!: THREE.Group;
  private fpBitSpin!: THREE.Mesh;
  private fpBitSpinMat!: THREE.MeshStandardMaterial;
  private fpBitVel = 0;
  private slotId: string | null = null;
  private uiLayer: HTMLDivElement;
  private introT = 0;
  private introBoomed = false;
  private introFade!: HTMLDivElement;
  private radarT = 0;
  private radarBlips: Array<{ dx: number; dz: number; dy: number; col: string }> = [];

  constructor(container: HTMLElement) {
    const canvas = document.createElement("canvas");
    canvas.id = "game";
    container.appendChild(canvas);
    this.uiLayer = document.createElement("div");
    this.uiLayer.className = "uilayer";
    container.appendChild(this.uiLayer);

    this.scene = new SceneMgr(canvas);
    this.input = new Input(canvas);
    this.hud = new Hud(container);
    this.cockpit = new Cockpit(container);
    this.fx = new Effects(this.scene.scene, this.uiLayer);
    this.overlays = new Overlays(this.scene.scene);
    this.introFade = document.createElement("div");
    this.introFade.className = "introfade";
    this.introFade.style.display = "none";
    container.appendChild(this.introFade);

    const panelHost: PanelHost = {
      get S() { return game.sim!.S; },
      get myUp() { return game.sim!.myUp; },
      intent: (m) => this.sim?.intent(m),
      startPlacing: (key) => this.startPlacing(key),
      startDecoPlacing: (id) => this.startDecoPlacing(id),
      applyCosmetics: () => this.applySettings(),
      rescueHome: () => this.rescue(getLang() === "en" ? "voluntary" : "volontaire"),
      canAffordShared: (cost) => {
        const S = this.sim?.S;
        if (!S) return false;
        for (const r in cost) if ((S.store[r] || 0) < cost[r]) return false;
        return true;
      },
      buildCost: (key) => {
        const S = this.sim!.S;
        const def = BUILDINGS[key];
        let n = 0;
        for (const b of S.builds) if (b.key === key) n++;
        const mult = def.repeat ? Math.pow(1.35, n) : 1;
        const c: Record<string, number> = {};
        for (const r in def.cost) c[r] = Math.ceil(def.cost[r] * mult);
        return c;
      },
      builtCount: (key) => {
        let n = 0;
        for (const b of this.sim?.S.builds ?? []) if (b.key === key) n++;
        return n;
      },
      repairedCount: () => this.sim?.repairedCount() ?? 0,
      closePanel: () => this.closePanel(),
      blip: () => au.blip(),
      err: () => au.err()
    };
    const game = this;
    this.panels = new Panels(container, panelHost);

    const menuHost: MenuHost = {
      startNew: (diff) => this.startSolo({ diff }),
      playSlot: (id) => this.startSolo({ slotId: id }),
      coopJoin: (url, room, name, pass) => this.startCoop(url, room, name, pass),
      resume: () => this.resume(),
      backToMenu: () => this.backToMenu(),
      freeplay: () => { this.mode = "play"; this.menus.close(); this.hud.setVisible(true); },
      applySettings: () => this.applySettings(),
      isDesktop: () => !!(window as any).af3d,
      quitApp: () => (window as any).af3d?.quit?.()
    };
    this.menus = new Menus(container, menuHost);

    this.input.onAction = (a) => this.onAction(a);
    window.addEventListener("beforeunload", () => this.saveNow());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { this.saveNow(); au.suspend(); } else au.resume();
    });
  }

  async init(): Promise<void> {
    const [, templates] = await Promise.all([this.props.load(), loadBuildingTemplates()]);
    this.buildingTemplates = templates;
    this.mode = "menu";
    this.menus.title(VERSION);
  }

  /* ================= cycles de vie ================= */

  private disposeWorldVisuals(): void {
    for (const m of [this.drillMesh, this.rocketMesh, this.myRig?.group, this.ghost]) {
      if (m) this.scene.scene.remove(m);
    }
    for (const [, v] of this.buildingVisuals) v.dispose(this.scene.scene);
    for (const [, o] of this.robotMeshes) this.scene.scene.remove(o);
    for (const o of this.creatureMeshes) this.scene.scene.remove(o);
    for (const o of this.projMeshes) this.scene.scene.remove(o);
    for (const [, o] of this.nestMeshes) this.scene.scene.remove(o);
    for (const [, o] of this.debrisMeshes) this.scene.scene.remove(o);
    for (const [, o] of this.specials) this.scene.scene.remove(o);
    for (const [, r] of this.remotes) this.scene.scene.remove(r.holder);
    if (this.rocksMesh) { this.scene.scene.remove(this.rocksMesh); this.rocksMesh.dispose(); this.rocksMesh = null; }
    this.buildingVisuals.clear(); this.robotMeshes.clear(); this.creatureMeshes = [];
    this.projMeshes = []; this.nestMeshes.clear(); this.debrisMeshes.clear();
    this.specials.clear(); this.remotes.clear();
    this.ghost = null;
    this.placing = null;
  }

  /** Active la projection d'ombres sur tout un sous-arbre (option graphique). */
  private castShadows(o: THREE.Object3D): THREE.Object3D {
    o.traverse(c => {
      if ((c as THREE.Mesh).isMesh) { c.castShadow = true; }
    });
    return o;
  }

  private setupWorld(): void {
    const S = this.sim!.S;
    if (!this.world) this.world = new VoxelWorld(this.scene.scene, S, this.scene.renderer.capabilities.getMaxAnisotropy());
    else this.world.setState(S);
    this.world.setState(S);
    this.scanSpecials();

    this.drillMesh = this.castShadows(this.props.makeDrill());
    this.buildDrillFx();
    this.scene.scene.add(this.drillMesh);
    if (!this.fpBit) this.buildFpBit();
    this.rocketMesh = this.castShadows(this.props.makeRocket());
    this.rocketMesh.position.set((ROCK_POS.x + 0.5) * VOX, 0, (ROCK_POS.z + 0.5) * VOX);
    /* balise de détresse au sommet (suit la fusée au décollage) */
    const beacon = makeBeacon();
    beacon.position.y = 10.9;
    this.rocketMesh.add(beacon);
    this.beaconBulb = beacon.getObjectByName("bulb") as THREE.Mesh;
    this.beaconHalo = beacon.getObjectByName("halo") as THREE.Sprite;
    this.scene.scene.add(this.rocketMesh);
    this.myRig = this.props.makeAstro(settings.cosmetic);
    this.castShadows(this.myRig.group);
    this.scene.scene.add(this.myRig.group);
    this.syncNests();
    this.scatterRocks();
  }

  /** Rochers décoratifs épars (déterministes par seed), posés sur le relief. */
  private rocksMesh: THREE.InstancedMesh | null = null;
  private scatterRocks(): void {
    if (this.rocksMesh) {
      this.scene.scene.remove(this.rocksMesh);
      this.rocksMesh.dispose();
    }
    const S = this.sim!.S;
    const R = mulberry32((S.seed ^ 0x0c0c5) | 0);
    const N = 150;
    const geo = new THREE.DodecahedronGeometry(0.55, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6e4a34 });
    const inst = new THREE.InstancedMesh(geo, mat, N);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    let placed = 0;
    for (let i = 0; i < N * 3 && placed < N; i++) {
      const vx = 2 + Math.floor(R() * (W - 4));
      const vz = 2 + Math.floor(R() * (W - 4));
      const dRock = Math.hypot(vx - ROCK_POS.x, vz - ROCK_POS.z);
      if (dRock < 18) continue;   // pas dans le camp
      const y = surfaceTopY(S, vx, vz);
      const s = 0.4 + R() * 1.1;
      eu.set(R() * 3, R() * 6.28, R() * 3);
      q.setFromEuler(eu);
      m4.compose(
        new THREE.Vector3((vx + 0.2 + R() * 0.6) * 2, y + s * 0.25, (vz + 0.2 + R() * 0.6) * 2),
        q,
        new THREE.Vector3(s, s * (0.6 + R() * 0.5), s)
      );
      inst.setMatrixAt(placed++, m4);
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    this.scene.scene.add(inst);
    this.rocksMesh = inst;
  }

  private resetAvatars(av?: SlotData["avatar"]): void {
    const a = this.astro, d = this.drill;
    if (av) {
      Object.assign(a, av.astro, { vx: 0, vy: 0, vz: 0, pouch: av.pouch, jp: upVal(this.sim!.myUp, "jetpack"), grounded: true, anim: 0 });
      a.inDrill = av.astro.inDrill;
      Object.assign(d, av.drill, { vx: 0, vy: 0, vz: 0, grounded: true, yaw: 0, digP: 0, beamCD: 0 });
      this.inv = { ...av.inv };
    } else {
      a.x = (SPAWN_ASTRO.x + 0.5) * VOX; a.z = (SPAWN_ASTRO.z + 0.5) * VOX; a.y = AH.y + 0.02;
      a.vx = a.vy = a.vz = 0; a.o2 = O2MAX; a.jp = 90; a.pouch = 0; a.inDrill = false; a.grounded = true;
      d.x = (SPAWN_DRILL.x + 0.5) * VOX; d.z = (SPAWN_DRILL.z + 0.5) * VOX; d.y = DH.y + 0.02;
      d.vx = d.vy = d.vz = 0;
      d.hp = upVal(this.sim!.myUp, "coque");
      d.en = upVal(this.sim!.myUp, "batterie");
      this.inv = {};
    }
    this.input.yaw = Math.PI * 0.8;
    this.input.pitch = -0.1;
  }

  startSolo(opts: { diff?: DiffKey; slotId?: string }): void {
    this.teardownSim();
    let av: SlotData["avatar"] | undefined;
    if (opts.slotId) {
      const data = loadSlot(opts.slotId);
      if (!data) { this.menus.saves(); return; }
      this.slotId = opts.slotId;
      setCurSlot(opts.slotId);
      this.sim = new LocalSim({ snap: data.snap, up: data.avatar.up });
      av = data.avatar;
      this.hud.toast(t("loaded"), "info");
    } else {
      this.slotId = newSlot();
      this.sim = new LocalSim({ diff: opts.diff ?? "normal" });
    }
    this.wireSim();
    this.setupWorld();
    this.resetAvatars(av);
    this.enterPlay();
    if (!opts.slotId) {
      const q = QUESTS[0];
      this.hud.say(pick(q.sam, q.samEn), 14);
      /* petite cinématique de crash : fondu au noir + impact */
      this.introT = 3.4;
      this.introBoomed = false;
      this.introFade.style.display = "block";
      this.introFade.style.opacity = "1";
    }
    this.saveNow();
  }

  startCoop(url: string, room: string, name: string, pass: string): void {
    this.teardownSim();
    const net = new NetSim();
    net.onWelcome = () => {
      this.sim = net;
      this.wireSim();
      this.setupWorld();
      this.resetAvatars();
      this.enterPlay();
      this.hud.toast(`🛰️ Coop — ${net.room}`, "ok");
      this.hud.say(pick(
        "Liaison coop établie, pilote. Vous partagez KEPLER-9b, la base et les objectifs avec votre équipage. Forez, construisez, automatisez — ensemble !",
        "Co-op link established, pilot. You share KEPLER-9b, the base and the objectives with your crew. Dig, build, automate — together!"), 13);
    };
    net.connect(url, room, name, pass || undefined, (reason) => {
      const msg = reason === "full" ? t("roomFull") : reason === "password" ? t("badPass") : "❌ " + reason;
      this.menus.coopStatus(msg);
    });
    /* les callbacks de fermeture ne s'activent qu'une fois en jeu */
    net.onClosed = () => {
      if (this.sim === net) {
        this.hud.toast(t("coopLost"), "warn");
        this.backToMenu();
      }
    };
  }

  private teardownSim(): void {
    this.saveNow();
    this.sim?.dispose();
    this.sim = null;
    this.slotId = null;
    this.disposeWorldVisuals();
  }

  private wireSim(): void {
    const sim = this.sim!;
    sim.onEvents = (ev) => this.handleEvents(ev);
    sim.onTiles = (d) => this.handleTiles(d);
    sim.onHurt = (drill, foot) => {
      if (this.astro.inDrill) this.drill.hp -= drill;
      else this.astro.o2 = Math.max(0, this.astro.o2 - foot);
      if (drill > 0 && !this.astro.inDrill) this.drill.hp -= drill;
      this.hurtA = Math.min(1, this.hurtA + (drill + foot) * 0.06);
      this.scene.shake = Math.max(this.scene.shake, 2);
    };
    sim.onResync = () => {
      this.world!.setState(sim.S);
      this.scanSpecials();
      this.syncNests();
    };
    sim.onAck = (m) => this.handleAck(m);
    sim.onPlayers = (players) => this.handlePlayers(players);
  }

  private enterPlay(): void {
    this.mode = "play";
    this.menus.close();
    this.hud.setVisible(true);
    au.ensure();
    this.input.enabled = true;
    this.input.lock();
  }

  resume(): void {
    this.mode = "play";
    this.menus.close();
    this.hud.setVisible(true);
    this.input.enabled = true;
    this.input.lock();
  }

  backToMenu(): void {
    this.saveNow();
    this.teardownSim();
    this.mode = "menu";
    this.panels.close();
    this.hud.setVisible(false);
    this.input.enabled = false;
    this.input.unlock();
    this.menus.clickCatch(false);
    this.menus.title(VERSION);
  }

  applySettings(): void {
    this.scene.applyRenderScale();
    this.scene.applyShadows();
    /* recrée le rig local avec les nouvelles couleurs */
    if (this.myRig) {
      this.scene.scene.remove(this.myRig.group);
      this.myRig = this.props.makeAstro(settings.cosmetic);
      this.scene.scene.add(this.myRig.group);
    }
  }

  /* ================= entrées ================= */

  private onAction(a: string): void {
    if (this.mode === "menu") return;
    switch (a) {
      case "unlocked":
        if (this.mode === "play" && !this.panels.isOpen && this.menus.screen === null) this.menus.clickCatch(true);
        break;
      case "lockedIn":
        this.menus.clickCatch(false);
        break;
      case "escape":
        if (this.placing) { this.cancelPlacing(); return; }
        if (this.placingDeco) { this.cancelDecoPlacing(); return; }
        if (this.panels.isOpen) { this.closePanel(); return; }
        if (this.mode === "interior") { this.exitRocket(); return; }
        if (this.mode === "play") this.pauseGame();
        else if (this.menus.screen === "pause") this.resume();
        break;
      case "pause":
        if (this.mode === "play") this.pauseGame();
        else if (this.menus.screen === "pause") this.resume();
        break;
      case "interact": this.doInteract(); break;
      case "camera": this.camMode = this.camMode === "fps" ? "tps" : "fps"; au.blip(700, 0.05, 0.07); break;
      case "build":
        if (this.mode !== "play") break;
        if (this.placing) this.cancelPlacing();
        else if (this.panels.name === "build") this.closePanel();
        else this.openPanel("build");
        break;
      case "stock":
        if (this.panels.name === "stock") this.closePanel();
        else this.openPanel("stock");
        break;
      case "helpPanel":
        if (this.panels.name === "aide") this.closePanel();
        else this.openPanel("aide");
        break;
      case "robot": this.deployRobot(); break;
      case "beam": this.beamUp(); break;
      case "mute": au.toggle(); break;
      case "padConnected":
        this.hud.toast(getLang() === "en" ? "🎮 Controller detected" : "🎮 Manette détectée", "info");
        this.hint("pad", "hintPad");
        break;
      case "fullscreen":
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
        break;
    }
  }

  private pauseGame(): void {
    if (this.sim?.mode === "solo") this.saveNow();
    this.panels.close();
    this.input.unlock();
    this.input.clear();
    this.menus.clickCatch(false);
    this.menus.pause();
    /* le solo est mis en pause ; le coop continue de tourner côté serveur */
  }

  openPanel(name: string, arg?: unknown): void {
    this.panels.open(name, arg);
    this.input.unlock();
    this.input.clear();
    this.menus.clickCatch(false);
    au.blip(700, 0.05, 0.08);
  }
  closePanel(): void {
    this.panels.close();
    if (this.mode === "play") this.input.lock();
  }

  /* ================= interactions ================= */

  private camRay(): { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number } {
    const c = this.scene.camera;
    const dir = new THREE.Vector3();
    c.getWorldDirection(dir);
    /* le rayon part de la tête de l'avatar (pas de la caméra TPS) */
    const b = this.astro.inDrill ? this.drill : this.astro;
    const oy = b.y + (this.astro.inDrill ? 0.4 : EYE);
    return { ox: b.x, oy, oz: b.z, dx: dir.x, dy: dir.y, dz: dir.z };
  }

  /** Attache les effets animés à la foreuse : foret tournant + flammes de réacteurs. */
  private buildDrillFx(): void {
    /* foret-vortex : cône strié qui tourne pendant le forage */
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 32;
    const cx = cv.getContext("2d")!;
    cx.fillStyle = "#5a6474";
    cx.fillRect(0, 0, 64, 32);
    cx.fillStyle = "#aeb9cb";
    for (let i = 0; i < 8; i++) cx.fillRect(i * 8, 0, 3, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.drillSpin = new THREE.Group();
    this.drillSpin.position.set(0, 0.85, -1.45);
    const orient = new THREE.Group();
    orient.rotation.x = -Math.PI / 2;      // pointe du cône vers -Z (l'avant)
    this.drillSpinMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.0, 14, 1, true),
      new THREE.MeshStandardMaterial({ map: tex, metalness: 0.85, roughness: 0.3, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    orient.add(this.drillSpinMesh);
    this.drillSpin.add(orient);
    this.drillMesh.add(this.drillSpin);
    /* flammes des réacteurs (sous la coque) */
    this.drillFlames = [];
    for (const sx of [-0.52, 0.52]) {
      const fl = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.9, 10),
        new THREE.MeshBasicMaterial({ color: 0x7de0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      fl.rotation.x = Math.PI;             // pointe vers le bas
      fl.position.set(sx, -0.15, 0.35);
      fl.visible = false;
      this.drillMesh.add(fl);
      this.drillFlames.push(fl);
    }
  }

  /* demi-largeurs de collision par bâtiment (silhouettes : poteau fin pour
   * le solaire et le scanner — on passe sous le panneau / l'antenne) */
  private static BUILD_HW: Record<string, number> = {
    generateur: 1.15, fonderie: 1.35, atelier: 1.45, solaire: 0.35, accu: 1.05,
    silo: 1.2, raffinerie: 1.05, montecharge: 1.1, baie: 1.35, labo: 1.45,
    reacteur: 1.3, scanner: 0.4
  };

  /** Boîtes de collision des constructions et objets (rebâties chaque frame :
   * une poignée d'AABB — bâtiments, fusée posée, foreuse quand on est à pied). */
  private syncStaticBoxes(): void {
    const S = this.sim?.S;
    if (!S || this.mode === "menu") { setStaticBoxes([]); return; }
    const list: StaticBox[] = [];
    for (const b of S.builds) {
      const hw = Game.BUILD_HW[b.key] ?? 1.1;
      const cx = b.x * VOX, cz = b.z * VOX;
      list.push({ x0: cx - hw, y0: 0, z0: cz - hw, x1: cx + hw, y1: buildingHeight(b.key), z1: cz + hw });
    }
    if (!S.launched && this.mode !== "launch") {
      const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
      list.push({ x0: rx - 1.9, y0: 0, z0: rz - 1.9, x1: rx + 1.9, y1: 10.5, z1: rz + 1.9 });
    }
    /* la foreuse garée bloque l'astronaute à pied (jamais son propre pilote) */
    if (!this.astro.inDrill && this.mode === "play") {
      const d = this.drill;
      list.push({ x0: d.x - 1.0, y0: d.y - DH.y, z0: d.z - 1.0, x1: d.x + 1.0, y1: d.y + DH.y + 0.3, z1: d.z + 1.0 });
    }
    setStaticBoxes(list);
  }

  /** Vue cockpit : le capot et le nez de la VRAIE foreuse (asset GLB, repli
   * procédural sinon) sous la caméra, nez droit devant. Le vortex de forage
   * strié — identique à la vue TPS — apparaît et tourne quand on creuse. */
  private buildFpBit(): void {
    this.fpBit = new THREE.Group();
    this.fpBitInner = new THREE.Group();
    /* l'engin est posé sous la ligne d'œil : on regarde PAR-DESSUS la
     * verrière — capot, museau et foret visibles en bas d'écran, alignés */
    this.fpBitInner.position.set(0, -1.95, -1.15);
    this.fpBit.add(this.fpBitInner);

    const hull = this.props.makeDrill();
    hull.scale.setScalar(0.92);
    this.fpBitInner.add(hull);

    /* vortex de forage : même cône strié que buildDrillFx, au nez de l'engin */
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 32;
    const cx = cv.getContext("2d")!;
    cx.fillStyle = "#5a6474";
    cx.fillRect(0, 0, 64, 32);
    cx.fillStyle = "#aeb9cb";
    for (let i = 0; i < 8; i++) cx.fillRect(i * 8, 0, 3, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    /* dégagé devant le museau, pointe plongeant vers le point de forage :
     * on voit le flanc strié défiler quand il tourne (lisible du cockpit) */
    const spinWrap = new THREE.Group();
    spinWrap.position.set(0, 1.55, -2.4);
    const orient = new THREE.Group();
    orient.rotation.x = -Math.PI / 2 - 0.55;   // vers -Z et piqué vers le bas
    this.fpBitSpinMat = new THREE.MeshStandardMaterial({
      map: tex, metalness: 0.55, roughness: 0.45, transparent: true, opacity: 0, side: THREE.DoubleSide,
      emissive: 0x9aa8bc, emissiveMap: tex, emissiveIntensity: 0.85   // auto-éclairé (viewmodel)
    });
    this.fpBitSpin = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 14, 1), this.fpBitSpinMat);
    orient.add(this.fpBitSpin);
    spinWrap.add(orient);
    this.fpBitInner.add(spinWrap);

    this.fpBit.traverse(o => { o.frustumCulled = false; });
    this.fpBit.visible = false;
    this.scene.scene.add(this.fpBit);
  }

  /* ---- intérieur de la fusée ---- */
  enterRocket(): void {
    if (!this.sim || this.astro.inDrill) return;
    const a = this.astro;
    this.outsidePos = { x: a.x, y: a.y, z: a.z };
    this.interior.build(this.scene.scene);
    this.interior.px = 2;
    this.interior.pz = ROOM.D * 0.55;
    this.mode = "interior";
    this.input.clear();
    this.input.yaw = 0.25;      // face aux postes (mur du fond)
    this.input.pitch = -0.04;
    a.o2 = O2MAX;
    if (!localStorage.getItem("af3d_seenRocket")) {
      localStorage.setItem("af3d_seenRocket", "1");
      this.hud.say(t("samWelcomeHome"), 14);
    }
    au.blip(520, 0.09, 0.09);
  }
  exitRocket(): void {
    if (this.mode !== "interior") return;
    this.cancelDecoPlacing();
    this.panels.close();
    const a = this.astro;
    const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
    a.x = this.outsidePos?.x ?? rx + 4;
    a.y = Math.max(this.outsidePos?.y ?? 1, 0.9);
    a.z = this.outsidePos?.z ?? rz;
    a.vx = a.vy = a.vz = 0;
    a.jp = upVal(this.sim!.myUp, "jetpack") + (this.sim!.S.research.nitro ? 80 : 0);
    this.mode = "play";
    this.input.lock();
    au.blip(380, 0.09, 0.09);
    if (this.sim?.mode === "solo") this.saveNow();
  }
  startDecoPlacing(id: string): void {
    this.placingDeco = id;
    this.panels.close();
    if (this.decoGhost) this.interior.group.remove(this.decoGhost);
    this.decoGhost = makeDecoMesh(id);
    this.decoGhost.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mm = (m.material as THREE.MeshStandardMaterial).clone();
        mm.transparent = true;
        mm.opacity = 0.55;
        m.material = mm;
      }
    });
    this.interior.group.add(this.decoGhost);
    this.input.lock();
    this.hud.toast(t("decoPlaceHint"), "info");
  }
  cancelDecoPlacing(): void {
    if (this.decoGhost) this.interior.group.remove(this.decoGhost);
    this.decoGhost = null;
    this.placingDeco = null;
  }
  /** x-pièce visé au sol (caméra intérieure) */
  private interiorAimX(): number | null {
    const cam = this.scene.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    if (dir.y > -0.08) return null;
    const tPlane = (ROOM.y0 + 0.01 - cam.position.y) / dir.y;
    if (tPlane < 0 || tPlane > 10) return null;
    const lx = cam.position.x + dir.x * tPlane - ROOM.x0;
    const lz = cam.position.z + dir.z * tPlane - ROOM.z0;
    if (lz < 0.2 || lz > ROOM.D - 0.2) return null;
    return Math.max(0.6, Math.min(ROOM.L - 0.6, lx));
  }
  private interiorInteract(): void {
    if (this.placingDeco) { this.cancelDecoPlacing(); return; }
    const st = this.interior.nearStation();
    if (!st) return;
    if (st.id === "hatch") this.exitRocket();
    else if (st.id === "vestiaire") this.openPanel("vestiaire");
    else if (st.id === "deco") this.openPanel("deco");
    else if (st.id === "console") this.openPanel("fusee");
  }
  private updateInterior(dt: number): void {
    const K = this.input.keys;
    const yaw = this.input.yaw;
    let ix = 0, iz = 0;
    if (K.fwd) { ix -= Math.sin(yaw); iz -= Math.cos(yaw); }
    if (K.back) { ix += Math.sin(yaw); iz += Math.cos(yaw); }
    if (K.left) { ix -= Math.cos(yaw); iz += Math.sin(yaw); }
    if (K.right) { ix += Math.cos(yaw); iz -= Math.sin(yaw); }
    const il = Math.hypot(ix, iz);
    if (il > 0) { ix /= il; iz /= il; }
    this.interior.move(dt, ix, iz);
    this.astro.o2 = O2MAX;
    this.interior.syncDecos(this.sim!.S.decos, performance.now() / 1000);

    /* placement de décoration */
    if (this.placingDeco && this.decoGhost) {
      const ax = this.interiorAimX();
      this.decoGhost.visible = ax !== null;
      if (ax !== null) {
        this.decoGhost.position.set(ax, 0, this.placingDeco === "banniere" ? 0.35 : 1.7);
        if (this.input.keys.mouseL) {
          this.input.keys.mouseL = false;
          this.sim!.intent({ i: "decoAdd", id: this.placingDeco, x: ax / ROOM.L });
          au.build();
          const def = DECOR[this.placingDeco];
          const canAgain = def && Object.entries(def.cost).every(([r, n]) => (this.sim!.S.store[r] || 0) >= n);
          if (!canAgain) this.cancelDecoPlacing();
        }
      }
    } else if (this.input.keys.mouseL) {
      /* clic sur une déco posée : la ranger */
      this.input.keys.mouseL = false;
      const ax = this.interiorAimX();
      if (ax !== null) {
        const nx = this.interior.nearDecoX(ax, this.sim!.S.decos);
        if (nx !== null) { this.sim!.intent({ i: "decoRemove", x: nx }); au.thud(); }
      }
    }
  }

  private doInteract(): void {
    if (this.mode === "interior") { this.interiorInteract(); return; }
    if (this.mode !== "play" || !this.sim) return;
    if (this.placing) { this.cancelPlacing(); return; }
    const S = this.sim.S;
    const a = this.astro, d = this.drill;

    if (a.inDrill) {
      if (!d.grounded) { this.hud.toast(t("landFirst"), "warn"); au.err(); return; }
      /* sortir : cherche une case libre à côté */
      a.inDrill = false;
      d.digging = false;
      this.digTarget = null;
      this.thrusting = false;
      au.setDig(false);
      au.engine(false, 0, false);
      au.thruster(false, false);
      const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      let placed = false;
      for (const ang of angles) {
        const nx = d.x + Math.cos(this.input.yaw + ang) * 1.9;
        const nz = d.z - Math.sin(this.input.yaw + ang) * 1.9;
        const dRow = rowOfY(d.y);
        if (isPassableId(tile(S, Math.floor(nx / VOX), Math.floor(nz / VOX), dRow))) {
          a.x = nx; a.z = nz; a.y = d.y; placed = true; break;
        }
      }
      if (!placed) { a.x = d.x; a.z = d.z; a.y = d.y + 1.6; }
      a.vx = a.vy = a.vz = 0;
      au.blip(420, 0.08, 0.1);
      return;
    }

    const ray = this.camRay();
    const hit = raycastVoxel(S, ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, REACH, true);
    /* cristal visé ? */
    if (hit && hit.id === 8) { this.harvestCrystal(hit.x, hit.z, hit.d); return; }
    if (hit && hit.id === 31) { /* le Cœur se fore (foreuse) — indice */ this.hud.toast(pick("Le Cœur ne se cueille pas — il se fore !", "The Heart can't be picked — drill it!"), "info"); return; }

    /* foreuse proche ? */
    if (Math.hypot(a.x - d.x, a.y - d.y, a.z - d.z) < 3.6) {
      a.inDrill = true;
      au.blip(520, 0.08, 0.1);
      setTimeout(() => au.thud(), 200);
      this.hint("dig", "hintDig");
      return;
    }
    /* fusée : on entre dans la base (vestiaire / établi / console) */
    const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
    if (!S.launched && Math.hypot(a.x - rx, a.z - rz) < 5.5 && a.y < 8) { this.enterRocket(); return; }
    /* robot proche ? */
    for (const r of S.robots) {
      const px = (r.x + 0.5) * VOX, pz = (r.z + 0.5) * VOX, py = topYOfRow(r.d);
      if (Math.hypot(a.x - px, a.y - py, a.z - pz) < 3) {
        this.sim.intent({ i: "robotRecall", n: r.n });
        return;
      }
    }
    /* bâtiment proche ? */
    let best: any = null, bd = 3.8;
    for (const b of S.builds) {
      const dd = Math.hypot(a.x - b.x * VOX, a.z - b.z * VOX);
      if (dd < bd) { bd = dd; best = b; }
    }
    if (best && a.y < 6) { this.openPanel("building", best); return; }
  }

  private harvestCrystal(x: number, z: number, d: number): void {
    const a = this.astro;
    if (a.inDrill) return;
    if (a.pouch >= POUCH) { this.hud.toast(t("pouchFull"), "warn"); au.err(); return; }
    this.sim!.intent({ i: "harvest", x, z, d });
    a.pouch++;
    const px = (x + 0.5) * VOX, py = topYOfRow(d) - 1, pz = (z + 0.5) * VOX;
    this.fx.chunks(px, py, pz, "#ff9de8", 9);
    this.fx.floater(px, py, pz, "+1 Cristal 💎", "#ff9de8");
    au.pickup();
    au.blip(1500, 0.14, 0.09);
  }

  private deployRobot(): void {
    if (!this.sim || this.mode !== "play") return;
    const d = this.drill;
    if (!this.astro.inDrill) { this.hud.toast(pick("Déployez les robots depuis la foreuse.", "Deploy robots from the pod."), "warn"); return; }
    this.sim.intent({ i: "robotDeploy", x: Math.floor(d.x / VOX), z: Math.floor(d.z / VOX), d: rowOfY(d.y) });
    au.build();
  }

  private beamUp(): void {
    if (!this.sim) return;
    const S = this.sim.S, d = this.drill;
    const hasMc = S.builds.some(b => b.key === "montecharge");
    if (!this.astro.inDrill) { this.hud.toast(t("beamDrillOnly"), "warn"); return; }
    if (!hasMc) { this.hud.toast(t("beamNoBuild"), "warn"); au.err(); return; }
    if (-d.y < 6) { this.hud.toast(t("beamSurf"), "info"); return; }
    if (d.beamCD > 0) { this.hud.toast(t("beamCd"), "warn"); au.err(); return; }
    if (d.en < BEAM_COST) { this.hud.toast(t("beamNoEnergy"), "warn"); au.err(); return; }
    d.en -= BEAM_COST;
    d.beamCD = BEAM_CD;
    this.fx.beamCol(d.x, d.y, d.z);
    d.x = (SPAWN_DRILL.x + 0.5) * VOX;
    d.z = (SPAWN_DRILL.z + 0.5) * VOX;
    d.y = DH.y + 0.02;
    d.vx = d.vy = d.vz = 0;
    this.fx.beamCol(d.x, d.y, d.z);
    this.scene.shake = Math.max(this.scene.shake, 4);
    au.cash();
    this.hud.toast(t("beamOk"), "ok");
  }

  /* ---- placement de bâtiment ---- */
  startPlacing(key: string): void {
    this.placing = key;
    this.panels.close();
    if (this.ghost) this.scene.scene.remove(this.ghost);
    const tmpl = this.buildingTemplates[key];
    this.ghost = tmpl ? tmpl.clone(true) : makeBuilding(key, BUILDINGS[key].ico);
    this.ghost.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mm = (m.material as THREE.MeshStandardMaterial).clone();
        mm.transparent = true;
        mm.opacity = 0.55;
        m.material = mm;
      }
    });
    this.scene.scene.add(this.ghost);
    this.input.lock();
    this.hud.toast("📍 " + pick(BUILDINGS[key].nom, BUILDINGS[key].nomEn) + " — " + t("place"), "info");
    this.hint("build", "hintBuild");
  }
  cancelPlacing(): void {
    if (this.ghost) this.scene.scene.remove(this.ghost);
    this.ghost = null;
    this.placing = null;
  }
  /** point de sol visé pour le placement (intersection avec le plan de surface) */
  private groundAim(): { cx: number; cz: number } | null {
    const ray = this.camRay();
    if (ray.dy > -0.05) return null;
    const tPlane = (0.01 - ray.oy) / ray.dy;
    if (tPlane < 0 || tPlane > 40) return null;
    const wx = ray.ox + ray.dx * tPlane, wz = ray.oz + ray.dz * tPlane;
    return { cx: Math.round(wx / VOX - 1) + 1, cz: Math.round(wz / VOX - 1) + 1 };
  }

  /* ================= événements de la sim ================= */

  private handleEvents(evs: GameEvent[]): void {
    for (const e of evs) {
      switch (e.t) {
        case "toast": this.hud.toast(getLang() === "en" && e.msgEn ? e.msgEn : e.msg, e.kind); if (e.kind === "ok") au.cash(); else if (e.kind === "bad") au.err(); break;
        case "say": this.hud.say(getLang() === "en" && e.txtEn ? e.txtEn : e.txt, e.dur); au.blip(880, 0.05, 0.06); break;
        case "floater": this.fx.floater(e.x, e.y, e.z, e.txt, e.col); break;
        case "boom": {
          this.fx.boom(e.x, e.y, e.z);
          const b = this.body();
          au.boom(Math.hypot(b.x - e.x, b.y - e.y, b.z - e.z), this.panOf(e.x, e.z));
          this.scene.shake = Math.max(this.scene.shake, 6);
          break;
        }
        case "questDone": au.cash(); break;
        case "mobkill": {
          this.fx.chunks(e.x, e.y, e.z, e.body, 10);
          this.fx.chunks(e.x, e.y, e.z, "#7de0d8", 6);
          const b = this.body();
          au.boom(Math.hypot(b.x - e.x, b.y - e.y, b.z - e.z) + 8, this.panOf(e.x, e.z));
          break;
        }
        case "nestkill": this.fx.boom(e.x, e.y, e.z); this.scene.shake = Math.max(this.scene.shake, 10); au.boom(6, this.panOf(e.x, e.z)); this.syncNests(); break;
        case "sonic": this.fx.sonic(e.x, e.y, e.z); au.blip(300, 0.18, 0.12); break;
        case "hitfx": {
          this.fx.chunks(e.x, e.y, e.z, "#7dff8a", 5);
          const b = this.body();
          au.hit(Math.hypot(b.x - e.x, b.y - e.y, b.z - e.z), this.panOf(e.x, e.z));
          break;
        }
        case "quake": this.scene.shake = Math.max(this.scene.shake, 2.5); au.thud(); break;
        case "meteor": break; // le boom d'impact suit
        case "storm": break;  // reflété par S.storm
        case "milestone": break;
        case "heart": au.cash(); this.scene.shake = Math.max(this.scene.shake, 5); break;
        case "launch": this.beginLaunch(e.act); break;
        case "act2": this.act2Visual(); break;
        case "win": this.winScreen(); break;
      }
    }
  }

  private handleTiles(dd: number[]): void {
    if (!this.world) return;
    for (let i = 0; i + 3 < dd.length; i += 4) {
      const x = dd[i], z = dd[i + 1], d = dd[i + 2], v = dd[i + 3];
      this.world.markDirty(x, z, d);
      const key = x + "," + z + "," + d;
      const cur = this.specials.get(key);
      if (cur && v !== 8 && v !== 31) { this.scene.scene.remove(cur); this.specials.delete(key); }
      if (!cur && (v === 8 || v === 31)) this.addSpecial(x, z, d, v);
    }
  }

  private handleAck(m: any): void {
    if (m.i === "dig" && m.res) {
      this.inv[m.res] = (this.inv[m.res] || 0) + 1;
      const def = RESDEF[m.res];
      au.pickup();
      if (this.digTarget) {
        const p = this.digTarget;
        this.fx.floater((p.x + 0.5) * VOX, topYOfRow(p.d), (p.z + 0.5) * VOX, "+1 " + pick(def.nom, def.nomEn), def.col);
      }
    } else if (m.i === "deposit") {
      this.depositing = false;
      const acc = m.accepted || {};
      let n = 0;
      for (const r in acc) n += acc[r];
      /* rendu de ce qui n'a pas tenu dans le stock */
      for (const r in this.pendingDeposit) {
        const rej = (this.pendingDeposit[r] || 0) - (acc[r] || 0);
        if (rej > 0) this.inv[r] = (this.inv[r] || 0) + rej;
      }
      this.pendingDeposit = {};
      if (n > 0) { this.hud.toast(`📦 +${n} ${t("depositOk").replace("📦 ", "")}`, "ok"); au.cash(); }
    } else if (m.i === "upgrade" && m.up) {
      const upds = this.sim!.myUp as any;
      upds[m.up.key] = m.up.lvl;
      if (m.up.key === "batterie") this.drill.en = upVal(this.sim!.myUp, "batterie");
      if (m.up.key === "coque") this.drill.hp = upVal(this.sim!.myUp, "coque");
      if (m.up.key === "jetpack") this.astro.jp = upVal(this.sim!.myUp, "jetpack");
      au.cash();
    } else if (m.i === "research" && m.research === "nitro") {
      this.astro.jp = upVal(this.sim!.myUp, "jetpack") + 80;
    }
  }
  private pendingDeposit: Record<string, number> = {};

  private handlePlayers(players: Record<string, WirePlayer>): void {
    const seen = new Set<number>();
    for (const idStr in players) {
      const id = Number(idStr);
      if (id === this.sim?.myId) continue;
      seen.add(id);
      const p = players[idStr];
      let r = this.remotes.get(id);
      if (!r) {
        const holder = new THREE.Group();
        const rig = this.props.makeAstro(p.cos);
        const drill = this.props.makeDrill();
        drill.visible = false;
        drill.rotation.y = Math.PI;   // le holder est orienté yaw+π (convention avatar)
        holder.add(rig.group, drill);
        const label = this.nameSprite(p.name);
        label.position.y = 2.2;
        holder.add(label);
        this.scene.scene.add(holder);
        r = { rig, drill, label, holder, cur: new THREE.Vector3(p.x, p.y, p.z), target: new THREE.Vector3(), data: p };
        this.remotes.set(id, r);
      }
      r.data = p;
      r.target.set(p.x, p.y, p.z);
    }
    for (const [id, r] of this.remotes) {
      if (!seen.has(id)) { this.scene.scene.remove(r.holder); this.remotes.delete(id); }
    }
  }

  private nameSprite(name: string): THREE.Sprite {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext("2d")!;
    ctx.font = "bold 30px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(10,14,20,0.55)";
    ctx.beginPath();
    (ctx as any).roundRect?.(28, 8, 200, 46, 10);
    ctx.fill();
    ctx.fillStyle = "#7de0d8";
    ctx.fillText(name.slice(0, 14), 128, 41);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(2.4, 0.6, 1);
    return sp;
  }

  /* ---- props spéciaux (cristaux / cœur / nids / débris) ---- */
  private scanSpecials(): void {
    for (const [, o] of this.specials) this.scene.scene.remove(o);
    this.specials.clear();
    const S = this.sim!.S;
    for (let d = SURF; d < S.worldH; d++)
      for (let z = 1; z < W - 1; z++)
        for (let x = 1; x < W - 1; x++) {
          const id = S.grid[(d * W + z) * W + x];
          if (id === 8 || id === 31) this.addSpecial(x, z, d, id);
        }
  }
  private addSpecial(x: number, z: number, d: number, id: number): void {
    const o = id === 8 ? this.props.makeCrystal() : this.props.makeHeart();
    o.position.set((x + 0.5) * VOX, (SURF - 1 - d) * VOX, (z + 0.5) * VOX);
    if (id === 8) o.rotation.y = (x * 7 + z * 13 + d) % 6;
    this.scene.scene.add(o);
    this.specials.set(x + "," + z + "," + d, o);
  }
  private syncNests(): void {
    const S = this.sim!.S;
    const seen = new Set<string>();
    for (const n of S.nests) {
      const k = Math.round(n.x) + "," + Math.round(n.z);
      seen.add(k);
      if (!this.nestMeshes.has(k)) {
        const o = makeNest();
        o.position.set(n.x, n.y - 0.6, n.z);
        this.scene.scene.add(o);
        this.nestMeshes.set(k, o);
      }
    }
    for (const [k, o] of this.nestMeshes) {
      if (!seen.has(k)) { this.scene.scene.remove(o); this.nestMeshes.delete(k); }
    }
  }

  /* ================= boucle principale ================= */

  private body(): { x: number; y: number; z: number } {
    return this.astro.inDrill ? this.drill : this.astro;
  }

  /** Panoramique stéréo (-1..1) d'un point-monde relatif à la visée. */
  private panOf(x: number, z: number): number {
    const b = this.body();
    const dx = x - b.x, dz = z - b.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) return 0;
    const ang = Math.atan2(-dx, -dz) - this.input.yaw;
    return Math.max(-1, Math.min(1, Math.sin(ang) * -0.85));
  }

  update(dt: number): void {
    if (this.mode === "boot") return;
    this.input.pollGamepad(dt);
    const sim = this.sim;
    /* coupe le moteur hors pilotage (menu, intérieur, décollage, à pied) */
    if (this.mode !== "play" || !this.astro.inDrill) {
      au.engine(false, 0, false);
      au.thruster(false, false);
    }
    /* collision des constructions et objets (liste d'AABB, coût négligeable) */
    this.syncStaticBoxes();

    if (this.mode === "menu" || !sim) {
      this.scene.updateEnv(0.85, 0, 0, performance.now() / 1000, 0.3);
      this.scene.render(dt);
      return;
    }

    /* pause solo : gel de la sim */
    const paused = this.menus.screen === "pause" && sim.mode === "solo";
    if (!paused) {
      if (this.mode === "play") {
        if (this.astro.inDrill) this.updateDrill(dt);
        else { this.updateAstro(dt); this.settleDrill(dt); }
        this.updatePlacing();
      } else if (this.mode === "interior") {
        this.updateInterior(dt);
      }
      sim.update(dt);
      if (this.mode === "launch") this.updateLaunchAnim(dt);
    }

    /* envoi avatar (18 Hz) — le solo l'utilise aussi (cibles faune) */
    this.sendT += dt;
    if (this.sendT >= 1 / SEND_HZ) {
      this.sendT = 0;
      const b = this.body();
      const spd = Math.hypot((b as any).vx ?? 0, (b as any).vy ?? 0, (b as any).vz ?? 0);
      sim.sendAvatar({
        x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2),
        yaw: +this.input.yaw.toFixed(2), pitch: +this.input.pitch.toFixed(2),
        d: this.astro.inDrill ? 1 : 0,
        g: (this.astro.inDrill ? this.drill.grounded : this.astro.grounded) ? 1 : 0,
        j: this.astro.jets ? 1 : 0,
        dg: this.drill.digging ? 1 : 0,
        b: this.drill.boosting ? 1 : 0,
        a: +this.astro.anim.toFixed(2),
        spd
      });
    }

    /* visuels du monde */
    this.world?.update();
    this.updateEntities(dt);
    this.updateCamera(dt);
    this.scene.updateLamp();

    const b = this.body();
    const depth = Math.max(0, -b.y);
    const stormA = sim.S.storm ? 1 : 0;
    this.scene.updateEnv(sim.daylight, depth, stormA, performance.now() / 1000, dayPhase(sim.S.dayT));
    if (this.mode === "interior") {
      /* éclairage intérieur fixe : pas de lampe frontale ni de soleil */
      this.scene.hemi.intensity = 0.85;
      this.scene.sun.intensity = 0;
      this.scene.lamp.intensity = 0;
      this.scene.lampGlow.intensity = 0;
    }

    /* ambiance sonore */
    this.moodT += dt;
    if (this.moodT > 0.3) {
      this.moodT = 0;
      au.mood(Math.min(1, depth / 180), 1 - sim.daylight, stormA);
    }

    /* HUD */
    this.updateHud(dt);
    this.panels.update(dt);
    this.fx.update(dt, this.scene.camera);

    /* exploits + autosave */
    this.featT += dt;
    if (this.featT > 1.4) { this.featT = 0; this.checkFeats(); }
    if (sim.mode === "solo" && this.mode === "play" && !paused) {
      this.saveT += dt;
      if (this.saveT > 8) { this.saveT = 0; this.saveNow(); }
    }

    this.scene.render(dt);
  }

  /* ---- astronaute à pied (port de updateAstro, unités ×2) ---- */
  private updateAstro(dt: number): void {
    const a = this.astro, K = this.input.keys, S = this.sim!.S;
    const jpMax = upVal(this.sim!.myUp, "jetpack") + (this.sim!.S.research.nitro ? 80 : 0);

    /* direction caméra (plan horizontal) */
    const yaw = this.input.yaw;
    let ix = 0, iz = 0;
    if (K.fwd) { ix -= Math.sin(yaw); iz -= Math.cos(yaw); }
    if (K.back) { ix += Math.sin(yaw); iz += Math.cos(yaw); }
    if (K.left) { ix -= Math.cos(yaw); iz += Math.sin(yaw); }
    if (K.right) { ix += Math.cos(yaw); iz -= Math.sin(yaw); }
    const il = Math.hypot(ix, iz);
    if (il > 0) { ix /= il; iz /= il; }

    a.vx += ix * 52 * dt;
    a.vz += iz * 52 * dt;
    const damp = Math.pow(0.000001, dt);
    if (il === 0) { a.vx *= damp; a.vz *= damp; }
    const hv = Math.hypot(a.vx, a.vz);
    const vmax = 6.8;
    if (hv > vmax) { a.vx = a.vx / hv * vmax; a.vz = a.vz / hv * vmax; }

    /* saut + jetpack */
    a.jets = false;
    if (this.input.jumpBuf > 0 && a.grounded) {
      a.vy = 17.2 * 0.55;             // saut ~1.6 m (gravité forte)
      this.input.jumpBuf = 0;
      a.grounded = false;
      au.blip(340, 0.06, 0.07);
    } else if (K.up && !a.grounded && a.jp > 0) {
      a.vy += 50 * dt;
      a.jp = Math.max(0, a.jp - 30 * dt);
      a.jets = true;
      if (Math.random() < dt * 20) this.fx.puff(a.x, a.y - 0.7, a.z, "#7de0d8", 1);
    }
    au.setJet(a.jets);
    a.vy -= GRAV * dt;
    a.vy = Math.max(-34, Math.min(32, a.vy));

    const res = moveAABB(S, a, AH.x, AH.y, AH.z, dt);
    if (res.grounded && !a.grounded && res.landV > 26) {
      this.scene.shake = Math.max(this.scene.shake, 3);
      au.thud();
    }
    a.grounded = res.grounded;
    a.anim += dt * (hv > 0.6 ? hv * 1.4 : 0);
    if (this.input.jumpBuf > 0) this.input.jumpBuf -= dt;

    /* recharge jetpack au sol */
    const atSurf = a.y > -1.2;
    if (a.grounded) a.jp = Math.min(jpMax, a.jp + (atSurf ? 45 : 18) * dt);

    /* oxygène */
    const depth = -a.y;
    if (depth > 1) {
      a.o2 = Math.max(0, a.o2 - 1.05 * DIFFS[S.diff].o2 * dt);
      if (a.o2 < 45 && !a.o2Warn) {
        a.o2Warn = true;
        this.hud.toast(t("o2Low"), "warn");
        au.err();
      }
      if (a.o2 <= 0) { this.rescue(t("reasonO2")); return; }
    } else {
      a.o2 = Math.min(O2MAX, a.o2 + 30 * dt);
    }
    if (a.o2 > 80) a.o2Warn = false;

    /* surface : sacoche + débris */
    if (atSurf) {
      this.flushPouch();
      this.collectDebris(a.x, a.z);
    }
  }

  /* ---- foreuse pilotée (port de updateDrill) ---- */
  private updateDrill(dt: number): void {
    const d = this.drill, a = this.astro, K = this.input.keys, S = this.sim!.S;
    const up = this.sim!.myUp;
    const st = {
      foret: foretStats(up),
      soute: upVal(up, "soute"),
      batt: upVal(up, "batterie"),
      coque: upVal(up, "coque"),
      refroid: upVal(up, "refroid"),
      jets: upVal(up, "jets") + (S.research.nitro ? 6 : 0)
    };
    const hp0 = d.hp;
    if (d.beamCD > 0) d.beamCD -= dt;
    this.noteT -= dt;
    const note = (msg: string): void => {
      if (this.noteT <= 0) { this.hud.toast(msg, "warn"); this.noteT = 2.4; }
    };

    const boosting = K.boost && d.en > 8;
    /* déplacement horizontal relatif caméra */
    const yaw = this.input.yaw;
    let ix = 0, iz = 0;
    if (K.fwd) { ix -= Math.sin(yaw); iz -= Math.cos(yaw); }
    if (K.back) { ix += Math.sin(yaw); iz += Math.cos(yaw); }
    if (K.left) { ix -= Math.cos(yaw); iz += Math.sin(yaw); }
    if (K.right) { ix += Math.cos(yaw); iz -= Math.sin(yaw); }
    const il = Math.hypot(ix, iz);
    if (il > 0) { ix /= il; iz /= il; }
    const acc = boosting ? 104 : 68;
    d.vx += ix * acc * dt;
    d.vz += iz * acc * dt;
    if (il === 0) {
      const damp = Math.pow(0.000001, dt);
      d.vx *= damp; d.vz *= damp;
    }
    const hv = Math.hypot(d.vx, d.vz);
    const vmax = boosting ? 14.4 : 11.2;
    if (hv > vmax) { d.vx = d.vx / hv * vmax; d.vz = d.vz / hv * vmax; }

    const thrust = K.up && d.en > 0;
    this.thrusting = thrust;
    if (thrust) {
      d.vy += st.jets * 2 * (boosting ? 1.28 : 1) * dt;
      if (Math.random() < dt * 26) this.fx.flame(d.x, d.y - 0.8, d.z);
    }
    d.vy -= GRAV * dt;
    d.vy = Math.max(-34, Math.min(32, d.vy));

    const res = moveAABB(S, d, DH.x, DH.y, DH.z, dt);
    if (res.grounded && res.landV > 26) {
      const dmg = (res.landV - 26) * 1.8;
      d.hp -= dmg;
      au.thud();
      this.scene.shake = Math.max(this.scene.shake, 3);
      this.fx.floater(d.x, d.y + 1, d.z, `-${Math.round(dmg)} ${t("hull")}`, "#ff6b5e");
    } else if (res.grounded && res.landV > 14) au.thud();
    d.grounded = res.grounded;

    /* support de vie du pilote */
    a.o2 = Math.min(O2MAX, a.o2 + 40 * dt);
    const jpMax = upVal(up, "jetpack") + (S.research.nitro ? 80 : 0);
    a.jp = Math.min(jpMax, a.jp + 40 * dt);
    a.x = d.x; a.y = d.y; a.z = d.z;

    /* ---- forage à la visée ---- */
    let digging = false;
    this.digTarget = null;
    if (d.en > 0 && K.mouseL && !this.placing) {
      const ray = this.camRay();
      const hit = raycastVoxel(S, ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, REACH, true);
      if (hit) {
        const def = TILES[hit.id];
        if (!def || def.air) { /* rien */ }
        else if (def.bedrock) note(t("bedrockMsg"));
        else if (def.lava) note(t("lavaMsg"));
        else if (def.manual) { note(t("crystalManual")); au.tink(); }
        else if (def.hard > st.foret.h) { note(t("tooHard")); au.tink(); }
        else if (def.res && this.cargoUsed() >= st.soute) note(t("cargoFull"));
        else {
          digging = true;
          const key = hit.x + "," + hit.z + "," + hit.d;
          if (this.digKey !== key) { this.digKey = key; d.digP = 0; }
          this.digTarget = { x: hit.x, z: hit.z, d: hit.d };
          d.digP += dt * st.foret.sp * (boosting ? 1.9 : 1);
          if (Math.random() < dt * (boosting ? 30 : 16)) {
            this.fx.chunks(hit.px, hit.py, hit.pz, def.col || "#777", 1);
          }
          const need = 0.55 * def.hard;
          if (d.digP >= need) {
            d.digP = 0;
            this.digKey = "";
            this.sim!.intent({ i: "dig", x: hit.x, z: hit.z, d: hit.d });
            this.fx.chunks((hit.x + 0.5) * VOX, topYOfRow(hit.d) - 1, (hit.z + 0.5) * VOX, def.col || "#777", 7);
          }
        }
      }
    }
    if (!digging) { d.digP = 0; this.digKey = ""; }
    d.digging = digging;
    d.boosting = boosting && (digging || thrust || hv > 1);
    if (d.boosting) this.localBoostT += dt;
    au.setDig(digging);
    au.setBoost(d.boosting, digging);
    /* moteur : ralenti à bord, monte en régime avec vitesse/poussée/forage */
    const rpm = Math.min(1, hv / 16 + Math.abs(d.vy) / 18 + (thrust ? 0.35 : 0) + (digging ? 0.3 : 0));
    au.engine(true, rpm, d.boosting);
    au.thruster(thrust, d.boosting);   // grondement fusée sur la poussée
    if (d.boosting && digging) this.scene.shake = Math.max(this.scene.shake, 0.9);

    /* énergie */
    const drain = (0.18 + (hv > 0.8 ? 0.85 : 0) + (thrust ? 1.7 : 0) + (digging ? 2.4 : 0)) * (boosting ? 2.1 : 1);
    d.en = Math.max(0, d.en - drain * DIFFS[S.diff].drain * dt);
    if (K.boost && !boosting && d.en > 0) note(t("boostLow"));

    /* chaleur (profondeur en tuiles = m/2, comme l'original) */
    const depthT = Math.max(0, -d.y) / 2;
    const heatMul = DIFFS[S.diff].heat * (S.research.thermique ? 0.5 : 1);
    let hot = 0;
    if (depthT > st.refroid) {
      hot = depthT - st.refroid;
      d.hp -= hot * 0.055 * heatMul * (boosting && digging ? 1.7 : 1) * dt;
    }
    (this as any)._hot = hot;

    /* lave */
    if (touchesLava(S, d, DH.x, DH.y, DH.z)) {
      d.hp -= 13 * dt;
      if (Math.random() < dt * 2) { au.sizzle(); this.fx.floater(d.x, d.y + 1.2, d.z, "🔥", "#ff6b5e"); }
    }

    /* surface : dépôt / recharge / réparation */
    this.collectDebris(d.x, d.z);
    const atSurf = d.y > -3 && d.y < 6;
    if (atSurf) {
      d.en = Math.min(st.batt, d.en + 46 * dt);
      d.hp = Math.min(st.coque, d.hp + 8 * dt);
      this.flushPouch();
      if (!this.depositing) {
        const items: Record<string, number> = {};
        let any = false;
        for (const k in this.inv) if (this.inv[k] > 0) { items[k] = this.inv[k]; any = true; }
        if (any) {
          this.depositing = true;
          this.pendingDeposit = items;
          this.inv = {};
          this.sim!.intent({ i: "deposit", items });
        }
      }
    }

    if (d.hp < hp0 - 0.4) this.hurtA = Math.min(1, this.hurtA + (hp0 - d.hp) / 22);
    if (d.en <= 0 && d.y < -1.2) this.rescue(t("reasonBattery"));
    if (d.hp <= 0) { d.hp = 0; this.rescue(t("reasonHull")); }
  }

  private settleDrill(dt: number): void {
    const d = this.drill, S = this.sim!.S;
    d.boosting = false;
    d.digging = false;
    d.vx = 0; d.vz = 0;
    d.vy = Math.max(-34, d.vy - GRAV * dt);
    const res = moveAABB(S, d, DH.x, DH.y, DH.z, dt);
    d.grounded = res.grounded;
  }

  private cargoUsed(): number {
    let n = 0;
    for (const k in this.inv) n += this.inv[k];
    return n;
  }
  private flushPouch(): void {
    const a = this.astro;
    if (a.pouch > 0) {
      this.sim!.intent({ i: "deposit", items: { cristal: a.pouch } });
      this.hud.toast(`💎 +${a.pouch} ${t("crystalsDrop").replace("💎 ", "")}`, "ok");
      a.pouch = 0;
      au.cash();
    }
  }
  private collectDebris(x: number, z: number): void {
    const S = this.sim!.S;
    for (const dbr of S.debris) {
      if (Math.abs(x / VOX - dbr.x) < 1.4 && Math.abs(z / VOX - dbr.z) < 1.4) {
        this.sim!.intent({ i: "debris", x: dbr.x, z: dbr.z });
        au.cash();
      }
    }
  }

  /** Astuce contextuelle affichée une seule fois (tutoriel léger). */
  private hint(id: string, key: Parameters<typeof t>[0]): void {
    const k = "af3d_hint_" + id;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
    this.hud.toast(t(key), "info");
  }

  private rescue(reason: string): void {
    const a = this.astro, d = this.drill;
    const st = { batt: upVal(this.sim!.myUp, "batterie"), coque: upVal(this.sim!.myUp, "coque") };
    let lost = this.cargoUsed();
    this.inv = {};
    d.x = (SPAWN_DRILL.x + 0.5) * VOX;
    d.z = (SPAWN_DRILL.z + 0.5) * VOX;
    d.y = DH.y + 0.02;
    d.vx = d.vy = d.vz = 0;
    d.en = st.batt * 0.65;
    if (d.hp <= 0) d.hp = st.coque * 0.35;
    if (!a.inDrill) {
      lost += a.pouch;
      a.pouch = 0;
      a.x = (SPAWN_ASTRO.x + 0.5) * VOX;
      a.z = (SPAWN_ASTRO.z + 0.5) * VOX;
      a.y = AH.y + 0.02;
      a.vx = a.vy = a.vz = 0;
      a.o2 = O2MAX;
      a.jp = upVal(this.sim!.myUp, "jetpack");
    }
    this.sim!.intent({ i: "rescue" });
    this.scene.shake = Math.max(this.scene.shake, 6);
    au.boom();
    this.hud.toast(`${t("rescued")} (${reason})` + (lost > 0 ? ` — ${lost} ${t("lostCargo")}` : ""), "bad");
  }

  /* ---- placement ---- */
  private updatePlacing(): void {
    if (!this.placing || !this.ghost || !this.sim) return;
    const aim = this.groundAim();
    if (!aim) { this.ghost.visible = false; return; }
    this.ghost.visible = true;
    this.ghost.position.set(aim.cx * VOX, 0, aim.cz * VOX);
    const ok = canPlaceBuilding(this.sim.S, aim.cx, aim.cz);
    this.ghost.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mm = m.material as THREE.MeshStandardMaterial;
        if (mm.emissive) mm.emissive.setHex(ok ? 0x0a3f30 : 0x5a1010);
      }
    });
    if (this.input.keys.mouseL) {
      this.input.keys.mouseL = false;
      if (!ok) { this.hud.toast(t("cantPlace"), "warn"); au.err(); return; }
      this.sim.intent({ i: "build", key: this.placing, x: aim.cx, z: aim.cz });
      au.build();
      this.hint("manage", "hintManage");
      /* enchaîne si répétable et payable */
      const def = BUILDINGS[this.placing];
      if (!def.repeat) this.cancelPlacing();
    }
  }

  /* ---- caméra ---- */
  private updateCamera(dt: number): void {
    const cam = this.scene.camera;
    if (this.fpBit) this.fpBit.visible = false;   // ré-affiché en FPS foreuse
    if (this.mode === "interior") {
      const p = this.interior.camPos();
      const yaw = this.input.yaw, pitch = this.input.pitch;
      cam.position.set(p.x, p.y, p.z);
      cam.lookAt(
        p.x - Math.sin(yaw) * Math.cos(pitch),
        p.y + Math.sin(pitch),
        p.z - Math.cos(yaw) * Math.cos(pitch)
      );
      this.myRig.group.visible = false;
      return;
    }
    if (this.mode === "launch") {
      const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
      const ry = this.rocketMesh.position.y;
      cam.position.set(rx + 26, Math.max(6, ry * 0.7 + 6), rz + 26);
      cam.lookAt(rx, ry + 8, rz);
      return;
    }
    const b = this.body();
    const yaw = this.input.yaw, pitch = this.input.pitch;
    const dir = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
    const eyeY = b.y + (this.astro.inDrill ? 0.5 : EYE);
    if (this.camMode === "fps") {
      cam.position.set(b.x, eyeY, b.z);
      cam.lookAt(b.x + dir.x, eyeY + dir.y, b.z + dir.z);
      this.myRig.group.visible = false;
      this.drillMesh.visible = true;
      if (this.astro.inDrill) {
        /* en FPS foreuse : le mesh est sous la caméra, léger recul visuel */
        this.drillMesh.visible = false;
        /* capot de la foreuse collé à la caméra ; vortex de forage comme en
         * TPS : fondu à l'appui, rotation avec inertie */
        if (this.fpBit) {
          const d = this.drill;
          this.fpBit.visible = true;
          this.fpBit.position.copy(cam.position);
          this.fpBit.quaternion.copy(cam.quaternion);
          const wantO = d.digging ? 0.92 : 0;
          this.fpBitSpinMat.opacity += (wantO - this.fpBitSpinMat.opacity) * Math.min(1, dt * 10);
          const want = d.digging ? (d.boosting ? 46 : 26) : 0;
          this.fpBitVel += (want - this.fpBitVel) * Math.min(1, dt * (d.digging ? 9 : 1.5));
          if (this.fpBitSpinMat.opacity > 0.02) this.fpBitSpin.rotation.y += dt * this.fpBitVel;
          const t = performance.now() / 1000;
          const k = d.digging ? 0.016 : 0;
          this.fpBitInner.position.set(
            (Math.random() - 0.5) * k,
            -1.95 + Math.sin(t * 1.7) * 0.008 + (Math.random() - 0.5) * k,
            -1.15 + (d.digging ? Math.sin(t * 34) * 0.025 : 0)
          );
        }
      }
    } else {
      const dist = this.astro.inDrill ? 7.5 : 5.2;
      let back = dist;
      const hit = raycastVoxel(this.sim!.S, b.x, eyeY, b.z, -dir.x, -dir.y, -dir.z, dist, false);
      if (hit) back = Math.max(1.2, hit.dist - 0.4);
      cam.position.set(b.x - dir.x * back, eyeY - dir.y * back + 0.4, b.z - dir.z * back);
      cam.lookAt(b.x, eyeY + 0.3, b.z);
      this.myRig.group.visible = !this.astro.inDrill;
      this.drillMesh.visible = true;
    }
  }

  /* ---- visuels des entités ---- */
  private updateEntities(dt: number): void {
    const S = this.sim!.S;
    const time = performance.now() / 1000;

    /* foreuse : position, orientation, inclinaison, animations */
    const d = this.drill;
    const hover = this.astro.inDrill && !d.grounded ? Math.sin(time * 3.1) * 0.05 : 0;
    this.drillMesh.position.set(d.x, d.y - DH.y + hover, d.z);
    if (this.astro.inDrill) {
      const yaw = this.input.yaw;
      this.drillMesh.rotation.y = yaw;                       // nez -Z = direction de visée
      /* inclinaison : pique du nez en avançant, roulis en translation latérale */
      const fx2 = -Math.sin(yaw), fz2 = -Math.cos(yaw);
      const rx2 = Math.cos(yaw), rz2 = -Math.sin(yaw);
      const vf = d.vx * fx2 + d.vz * fz2;
      const vr = d.vx * rx2 + d.vz * rz2;
      const tx = Math.max(-0.2, Math.min(0.2, -vf * 0.014));
      const tz = Math.max(-0.24, Math.min(0.24, -vr * 0.018));
      const k = Math.min(1, dt * 7);
      this.drillTilt.x += (tx - this.drillTilt.x) * k;
      this.drillTilt.z += (tz - this.drillTilt.z) * k;
      this.drillMesh.rotation.x = this.drillTilt.x;
      this.drillMesh.rotation.z = this.drillTilt.z;
    } else {
      this.drillMesh.rotation.x *= 0.9;
      this.drillMesh.rotation.z *= 0.9;
    }
    /* foret-vortex : n'apparaît qu'en forage, tourne (plus vite en surrégime) */
    if (this.drillSpinMesh) {
      const mat = this.drillSpinMesh.material as THREE.MeshStandardMaterial;
      const want = d.digging ? 0.92 : 0;
      mat.opacity += (want - mat.opacity) * Math.min(1, dt * 10);
      if (mat.opacity > 0.02) this.drillSpinMesh.rotation.y += dt * (d.boosting ? 46 : 26);
    }
    /* flammes des réacteurs */
    for (const fl of this.drillFlames) {
      fl.visible = this.astro.inDrill && this.thrusting;
      if (fl.visible) {
        fl.scale.set(1, 0.7 + Math.random() * (d.boosting ? 0.9 : 0.5), 1);
        (fl.material as THREE.MeshBasicMaterial).color.setHex(d.boosting ? 0xffc169 : 0x7de0ff);
      }
    }
    if (d.digging && this.digTarget) {
      const p = this.digTarget;
      if (Math.random() < dt * 30) this.fx.chunks((p.x + 0.5) * VOX, topYOfRow(p.d) - 1, (p.z + 0.5) * VOX, "#9a938a", 1);
    }

    /* mon rig (TPS) */
    const a = this.astro;
    this.myRig.group.position.set(a.x, a.y - AH.y, a.z);
    this.myRig.group.rotation.y = this.input.yaw + Math.PI;
    animAstro(this.myRig, a.anim, Math.hypot(a.vx, a.vz) > 0.6, !!a.jets, dt);

    /* fusée : fumée post-crash Acte II */
    if (S.act >= 2 && !S.launched && this.mode === "play" && Math.random() < dt * 2.2 && this.sim!.repairedCount() < 5) {
      const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
      this.fx.puff(rx + (Math.random() - 0.5) * 2, 4 + Math.random() * 5, rz + (Math.random() - 0.5) * 2, "#5f5a66", 1);
    }
    /* fusée échouée (Acte I) : dégazage cryo tant qu'elle n'est pas réparée */
    if (S.act === 1 && !S.launched && this.mode === "play" && Math.random() < dt * 1.3 && this.sim!.repairedCount() < 5) {
      const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
      const a2 = Math.random() * 6.283;
      this.fx.puff(rx + Math.cos(a2) * 1.8, 1.0 + Math.random() * 1.8, rz + Math.sin(a2) * 1.8, "#c7d2da", 1);
    }
    /* balise de détresse : double flash rouge périodique */
    if (this.beaconBulb && this.beaconHalo) {
      const ph = time % 2.4;
      const on = ph < 0.1 || (ph > 0.28 && ph < 0.38) ? 1 : 0;
      (this.beaconBulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + on * 2.6;
      const hm = this.beaconHalo.material as THREE.SpriteMaterial;
      hm.opacity += (on * 0.8 - hm.opacity) * Math.min(1, dt * 26);
    }

    /* bâtiments : visuels animés (fumée, lueurs, mouvement) */
    const bkeys = new Set<string>();
    const robotsActive = S.robots.filter(r => !r.done).length;
    const bctxBase = {
      ratio: this.sim!.power.ratio,
      battFrac: this.sim!.power.battCap > 0 ? this.sim!.power.batt / this.sim!.power.battCap : 0,
      daylight: this.sim!.daylight,
      dayPhase: dayPhase(S.dayT),
      robotsActive,
      storm: !!S.storm,
      time
    };
    for (const b of S.builds) {
      const k = b.key + "@" + b.x + "," + b.z;
      bkeys.add(k);
      let vis = this.buildingVisuals.get(k);
      if (!vis) {
        vis = new BuildingVisual(b.key, this.buildingTemplates[b.key] ?? null, this.fx);
        this.castShadows(vis.group);
        vis.group.position.set(b.x * VOX, 0, b.z * VOX);
        this.scene.scene.add(vis.group);
        this.buildingVisuals.set(k, vis);
        this.fx.puff(b.x * VOX, 1, b.z * VOX, "#8a5c40", 6);
      }
      const ctx: BuildingCtx = { status: b.status || (b.on ? "run" : "paused"), ...bctxBase };
      vis.update(dt, ctx, b.x * VOX, b.z * VOX);
    }
    for (const [k, vis] of this.buildingVisuals) {
      if (!bkeys.has(k)) { vis.dispose(this.scene.scene); this.buildingVisuals.delete(k); }
    }

    /* bruits d'usine : intensités par famille, dosées par la distance */
    this.factoryT += dt;
    if (this.factoryT > 0.33) {
      this.factoryT = 0;
      const b0 = this.body();
      let hum = 0, steam = 0, reac = 0;
      for (const b of S.builds) {
        const st = b.status || "";
        if (!(st.startsWith("run") || st === "day")) continue;
        const dist = Math.hypot(b.x * VOX - b0.x, b0.y, b.z * VOX - b0.z);
        const w = Math.max(0, 1 - dist / 34);
        if (w <= 0) continue;
        if (b.key === "generateur" || b.key === "atelier" || b.key === "baie" || b.key === "montecharge") hum += w;
        else if (b.key === "fonderie") { hum += w * 0.6; steam += w * 0.5; }
        else if (b.key === "raffinerie") steam += w;
        else if (b.key === "reacteur") reac += w;
      }
      au.factory(hum, steam, reac);
    }

    /* robots */
    const rkeys = new Set<number>();
    for (const r of S.robots) {
      rkeys.add(r.n);
      let o = this.robotMeshes.get(r.n);
      if (!o) {
        o = this.props.makeRobot();
        this.scene.scene.add(o);
        this.robotMeshes.set(r.n, o);
      }
      o.position.set((r.x + 0.5) * VOX, (SURF - 1 - r.d) * VOX, (r.z + 0.5) * VOX);
      o.rotation.y = time * (r.done ? 0 : 0.9) + r.n;
      if (!r.done && r.lastX !== undefined && Math.random() < dt * 3) {
        this.fx.chunks((r.lastX + 0.5) * VOX, (SURF - 1 - (r.lastD ?? r.d)) * VOX + 1, ((r.lastZ ?? r.z) + 0.5) * VOX, "#7de0d8", 1);
      }
    }
    for (const [n, o] of this.robotMeshes) {
      if (!rkeys.has(n)) { this.scene.scene.remove(o); this.robotMeshes.delete(n); }
    }

    /* créatures (pool par index) */
    while (this.creatureMeshes.length < S.creatures.length) {
      const o = this.props.makeCreature(S.creatures[this.creatureMeshes.length]?.type ?? "rampant");
      this.scene.scene.add(o);
      this.creatureMeshes.push(o);
    }
    for (let i = 0; i < this.creatureMeshes.length; i++) {
      const o = this.creatureMeshes[i];
      const c = S.creatures[i];
      if (!c) { o.visible = false; continue; }
      o.visible = true;
      o.position.lerp(new THREE.Vector3(c.x, c.y, c.z), Math.min(1, dt * 10));
      o.rotation.y = Math.atan2(c.vx, c.vz);
      const s = 0.9 + Math.sin(c.ph) * 0.08;
      o.scale.setScalar(s * (c.type === "traqueur" ? 1.15 : c.type === "cracheur" ? 0.9 : 1));
    }

    /* projectiles */
    while (this.projMeshes.length < S.projectiles.length) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7dff8a }));
      this.scene.scene.add(o);
      this.projMeshes.push(o);
    }
    for (let i = 0; i < this.projMeshes.length; i++) {
      const o = this.projMeshes[i];
      const p = S.projectiles[i];
      if (!p) { o.visible = false; continue; }
      o.visible = true;
      o.position.set(p.x, p.y, p.z);
    }

    /* nids : pulsation */
    for (const n of S.nests) {
      const k = Math.round(n.x) + "," + Math.round(n.z);
      const o = this.nestMeshes.get(k);
      if (o) {
        const core = o.getObjectByName("core");
        if (core) core.scale.setScalar(1 + Math.sin(n.ph) * 0.18);
      }
    }
    this.syncNests();

    /* débris de météorites */
    const dkeys = new Set<string>();
    for (const dbr of S.debris) {
      const k = Math.round(dbr.x) + "," + Math.round(dbr.z);
      dkeys.add(k);
      if (!this.debrisMeshes.has(k)) {
        const o = makeDebris();
        o.position.set(dbr.x * VOX, surfaceTopY(S, Math.floor(dbr.x), Math.floor(dbr.z)), dbr.z * VOX);
        this.scene.scene.add(o);
        this.debrisMeshes.set(k, o);
      }
    }
    for (const [k, o] of this.debrisMeshes) {
      if (!dkeys.has(k)) { this.scene.scene.remove(o); this.debrisMeshes.delete(k); }
    }

    /* cœur / cristaux : rotation douce */
    for (const [, o] of this.specials) {
      const spin = o.getObjectByName("spin");
      if (spin) spin.rotation.y = time;
    }

    /* surcouches scanner / labo */
    this.overlays.update(
      dt, S,
      S.builds.some(b => b.key === "scanner"), !!S.research.optique,
      S.builds.some(b => b.key === "labo"),
      this.astro.inDrill, d.x, d.y, d.z,
      this.specials.keys(), time
    );

    /* tempête : sable balayé en surface */
    if (S.storm && this.mode === "play") {
      const b = this.body();
      if (b.y > -4 && Math.random() < dt * 26) {
        this.fx.sand(b.x + (Math.random() - 0.5) * 30, 0.4 + Math.random() * 2.6, b.z + (Math.random() - 0.5) * 30);
      }
    }
    /* poussière ambiante portée par le vent (surface, hors tempête) */
    this.moteT -= dt;
    if (this.mode === "play" && this.moteT <= 0) {
      const b = this.body();
      if (b.y > -3 && !S.storm) {
        this.moteT = 0.11 + Math.random() * 0.12;
        this.fx.mote(b.x + (Math.random() - 0.5) * 36, 0.3 + Math.random() * 5, b.z + (Math.random() - 0.5) * 36);
      } else this.moteT = 0.6;
    }

    /* joueurs distants */
    for (const [, r] of this.remotes) {
      r.cur.lerp(r.target, Math.min(1, dt * 12));
      r.holder.position.copy(r.cur);
      r.holder.position.y -= r.data.d ? DH.y : AH.y;
      const inD = !!r.data.d;
      if (r.rig) r.rig.group.visible = !inD;
      if (r.drill) r.drill.visible = inD;
      r.holder.rotation.y = (r.data.yaw ?? 0) + Math.PI;
      if (r.rig && !inD) animAstro(r.rig, r.data.a ?? 0, Math.abs(r.target.x - r.cur.x) + Math.abs(r.target.z - r.cur.z) > 0.01, !!r.data.j, dt);
      if (inD && r.data.dg && Math.random() < dt * 12) {
        this.fx.chunks(r.cur.x, r.cur.y - 1, r.cur.z, "#9a938a", 1);
      }
    }
  }

  /* ---- HUD ---- */
  private updateHud(dt: number): void {
    const sim = this.sim!;
    const S = sim.S;
    const a = this.astro, d = this.drill;
    const up = sim.myUp;
    let hint = "";
    if (this.mode === "interior") {
      if (this.placingDeco) hint = t("decoPlaceHint");
      else {
        const st = this.interior.nearStation();
        if (st) hint = t(("st" + st.id.charAt(0).toUpperCase() + st.id.slice(1)) as any);
      }
    } else if (this.mode === "play" && !a.inDrill) {
      const ray = this.camRay();
      const hit = raycastVoxel(S, ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, REACH, true);
      if (hit?.id === 8) hint = t("harvest");
      else if (Math.hypot(a.x - d.x, a.y - d.y, a.z - d.z) < 3.6) hint = t("enterDrill");
      else {
        const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
        if (!S.launched && Math.hypot(a.x - rx, a.z - rz) < 5.5 && a.y < 8) hint = t("openRocket");
        else {
          for (const b of S.builds) {
            if (Math.hypot(a.x - b.x * VOX, a.z - b.z * VOX) < 3.8 && a.y < 6) {
              const def = BUILDINGS[b.key];
              hint = `${t("manage")} ${pick(def.nom, def.nomEn)}`;
              break;
            }
          }
        }
      }
    } else if (a.inDrill && d.grounded) hint = t("exitDrill");
    if (this.placing) hint = t("place");

    const need = this.digTarget ? 0.55 * (TILES[tile(S, this.digTarget.x, this.digTarget.z, this.digTarget.d)]?.hard ?? 1) : 1;
    const hs: HudState = {
      inDrill: a.inDrill,
      o2: a.o2, o2Max: O2MAX,
      jp: a.jp, jpMax: upVal(up, "jetpack") + (S.research.nitro ? 80 : 0),
      en: d.en, enMax: upVal(up, "batterie"),
      hp: d.hp, hpMax: upVal(up, "coque"),
      cargo: this.cargoUsed(), cargoMax: upVal(up, "soute"),
      pouch: a.pouch,
      depth: Math.max(0, -(a.inDrill ? d.y : a.y)),
      hot: (this as any)._hot ?? 0,
      boost: d.boosting,
      digP: this.digTarget ? Math.min(1, d.digP / need) : -1,
      hint
    };
    this.hud.hurtFlash(this.hurtA);
    this.hurtA = Math.max(0, this.hurtA - dt * 1.2);
    this.hud.update(dt, S, sim.power, sim.daylight, hs, sim.questProg(S.qi));

    /* cockpit de la foreuse (vue FPS uniquement — en TPS on voit l'engin) */
    this.cockpit.update({
      visible: this.mode === "play" && a.inDrill && this.camMode === "fps",
      speed: Math.hypot(d.vx, d.vy, d.vz),
      yaw: this.input.yaw,
      depth: hs.depth,
      hp: d.hp, hpMax: hs.hpMax,
      en: d.en, enMax: hs.enMax,
      cargo: hs.cargo, cargoMax: hs.cargoMax,
      hot: hs.hot > 0,
      boost: d.boosting,
      digging: d.digging
    });

    /* radar à minerais (instrument de bord de la foreuse, améliorable) */
    this.radarT += dt;
    const radarOn = this.mode === "play" && a.inDrill;
    if (radarOn && this.radarT > 0.2) {
      this.radarT = 0;
      const radiusM = upVal(up, "radar");
      const Rv = Math.ceil(radiusM / 2);
      const cx = Math.floor(d.x / 2), cz = Math.floor(d.z / 2);
      const cd = SURF - 1 - Math.floor(d.y / 2);
      const blips: typeof this.radarBlips = [];
      for (let dd2 = Math.max(SURF, cd - Rv); dd2 <= Math.min(S.worldH - 2, cd + Rv) && blips.length < 220; dd2++) {
        for (let z = Math.max(1, cz - Rv); z <= Math.min(W - 2, cz + Rv) && blips.length < 220; z++) {
          for (let x = Math.max(1, cx - Rv); x <= Math.min(W - 2, cx + Rv) && blips.length < 220; x++) {
            const id = tile(S, x, z, dd2);
            const def = TILES[id];
            if (!def?.res && id !== 8) continue;
            const bx = (x + 0.5) * 2 - d.x;
            const bz = (z + 0.5) * 2 - d.z;
            const by = (SURF - 1 - dd2) * 2 + 1 - d.y;
            if (bx * bx + bz * bz + by * by > radiusM * radiusM) continue;
            blips.push({ dx: bx, dz: bz, dy: by, col: id === 8 ? "#ff9de8" : (RESDEF[def!.res!]?.col ?? "#fff") });
          }
        }
      }
      this.radarBlips = blips;
    }
    this.hud.drawRadar(dt, radarOn, this.radarBlips, upVal(up, "radar"), this.input.yaw);

    /* boussole de retour (équivalent 3D de la minicarte) */
    let rel: number | null = null, cDist = 0, cSym = "";
    if (this.mode === "play") {
      const bx = (SPAWN_DRILL.x + 0.5) * VOX, bz = (SPAWN_DRILL.z + 0.5) * VOX;
      if (a.inDrill && -d.y > 12) {
        rel = Math.atan2(-(bx - d.x), -(bz - d.z)) - this.input.yaw;
        cDist = Math.hypot(bx - d.x, bz - d.z, d.y);
        cSym = "⌂";
      } else if (!a.inDrill) {
        const dist2 = Math.hypot(d.x - a.x, d.z - a.z, d.y - a.y);
        if (dist2 > 16) {
          rel = Math.atan2(-(d.x - a.x), -(d.z - a.z)) - this.input.yaw;
          cDist = dist2;
          cSym = "⛏";
        }
      }
    }
    this.hud.setCompass(rel, cDist, cSym);

    /* fondu d'intro (crash) */
    if (this.introT > 0) {
      this.introT -= dt;
      if (!this.introBoomed && this.introT < 2.2) {
        this.introBoomed = true;
        const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
        this.fx.boom(rx, 3, rz);
        au.boom();
        au.thud();
        this.scene.shake = 12;
      }
      this.introFade.style.opacity = String(Math.max(0, Math.min(1, this.introT / 2.6)));
      if (this.introT <= 0) this.introFade.style.display = "none";
    }
  }

  /* ---- décollage ---- */
  private beginLaunch(act: 1 | 2): void {
    this.mode = "launch";
    this.panels.close();
    this.input.clear();
    this.launchAnim = { t: 0, act, failT: 0, failW: 0, w: 0, ignited: false, cdN: -1 };
    this.hud.setVisible(false);
    au.ensure();
    au.setDig(false);
    au.engine(false, 0, false);
  }

  private updateLaunchAnim(dt: number): void {
    const L = this.launchAnim;
    L.t += dt;
    const T2 = L.t;
    const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
    if (T2 < 1.8) {
      const n = 3 - Math.floor(T2 / 0.6);
      if (n !== L.cdN) { L.cdN = n; au.blip(600 + n * 90, 0.14, 0.18); }
      if (Math.random() < 0.5) this.fx.puff(rx + (Math.random() - 0.5) * 3, 1, rz + (Math.random() - 0.5) * 3, "#d8dce6", 1);
    }
    if (T2 >= 1.8 && !L.ignited) { L.ignited = true; au.launch(); this.scene.shake = 13; }
    const failing = L.act === 1;
    if (T2 >= 1.8 && !L.failT) {
      if (failing && T2 >= 4.4) {
        L.failT = T2;
        L.failW = L.w;
        au.boom(); au.err();
        this.scene.shake = Math.max(this.scene.shake, 10);
        this.hud.say(pick(
          "ALERTE ! Surchauffe critique — l'alliage du réacteur ne tient pas ! Coupure moteur… on retombe, pilote. ACCROCHEZ-VOUS !",
          "ALERT! Critical overheat — the engine alloy is failing! Engine cut… we're falling, pilot. HOLD ON!"), 7);
      } else {
        this.scene.shake = Math.max(this.scene.shake, T2 < 3 ? 7 : 3);
        if (T2 < 3) L.w = (T2 - 1.8) * 3;
        else L.w = 3.6 + Math.pow(T2 - 3, 2) * 46;
        for (let i = 0; i < 3; i++) this.fx.flame(rx + (Math.random() - 0.5) * 1.6, L.w + 0.5, rz + (Math.random() - 0.5) * 1.6);
        if (Math.random() < 0.6) this.fx.puff(rx + (Math.random() - 0.5) * 4.4, 0.6, rz + (Math.random() - 0.5) * 4.4, "#b8b2aa", 1);
      }
    }
    if (L.failT) {
      const wf = T2 - L.failT;
      L.w = Math.max(0, L.failW + wf * 5 - 46 * wf * wf);
      this.scene.shake = Math.max(this.scene.shake, 2.5);
      if (Math.random() < 0.75) this.fx.puff(rx, L.w + 3, rz, "#5a5a66", 1);
    }
    this.rocketMesh.position.y = L.w;
    /* la sim envoie act2/win au bon moment ; en attendant on anime */
  }

  private act2Visual(): void {
    const rx = (ROCK_POS.x + 0.5) * VOX, rz = (ROCK_POS.z + 0.5) * VOX;
    this.fx.boom(rx + 0.8, 2, rz);
    this.fx.boom(rx - 1.2, 3.5, rz + 1);
    this.scene.shake = 16;
    au.boom(); au.thud();
    this.rocketMesh.position.y = 0;
    this.mode = "play";
    this.hud.setVisible(true);
    /* le resync a rebâti le monde (abysses) */
    this.saveNow();
  }

  private winScreen(): void {
    const S = this.sim!.S;
    this.mode = "win";
    this.input.unlock();
    this.input.enabled = false;
    this.hud.setVisible(false);
    const improved = saveBest(S.time, S.diff);
    this.checkFeats();
    this.saveNow();
    this.menus.win(S.time, S.stats.rescues || 0, improved);
  }

  /* ---- exploits ---- */
  private checkFeats(): void {
    const S = this.sim?.S;
    if (!S) return;
    const stats = S.stats;
    const active = S.robots.filter(r => !r.done).length;
    let minedTotal = 0;
    for (const k in stats.mined) minedTotal += stats.mined[k];
    const boostT = Math.max(stats.boostT || 0, this.localBoostT);
    const cond: Record<string, boolean> = {
      premier: minedTotal >= 1,
      prof50: S.deepest >= 50,
      prof150: S.deepest >= 150,
      prof250: S.deepest >= 250,
      cristaux: (stats.mined.cristal || 0) >= 5,
      usine: S.builds.length >= 6,
      automate: active >= 3,
      armada: active >= 6,
      chasseur: (stats.creatures || 0) >= 10,
      brisenid: (stats.nests || 0) >= 1,
      plancher: boostT >= 60,
      coeur: !!stats.coeur,
      retour: S.launched,
      parfaite: S.launched && !(stats.rescues || 0)
    };
    let changed = false;
    for (const f of FEATS) {
      if (this.featsCache[f.id] || !cond[f.id]) continue;
      this.featsCache[f.id] = 1;
      changed = true;
      this.hud.toast(`${t("newFeat")} ${pick(f.nom, f.nomEn)} !`, "ok");
      au.cash();
      (window as any).af3d?.steamUnlock?.(f.id);
    }
    if (changed) saveFeats(this.featsCache);
  }

  /* ---- sauvegarde solo ---- */
  saveNow(): void {
    if (!this.sim || this.sim.mode !== "solo" || !this.slotId) return;
    const snap = this.sim.serialize();
    if (!snap) return;
    const a = this.astro, d = this.drill;
    const data: SlotData = {
      v: 1,
      snap,
      avatar: {
        up: { ...this.sim.myUp },
        inv: { ...this.inv },
        pouch: a.pouch,
        astro: { x: a.x, y: a.y, z: a.z, o2: a.o2, jp: a.jp, inDrill: a.inDrill },
        drill: { x: d.x, y: d.y, z: d.z, hp: d.hp, en: d.en }
      }
    };
    saveSlot(this.slotId, data);
  }
}
