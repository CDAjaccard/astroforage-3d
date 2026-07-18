/* Scène Three.js : caméra, lumières jour/nuit, brouillard de profondeur,
 * lampe frontale, secousses d'écran. */
import * as THREE from "three";
import { settings } from "../config.js";
import { Sky } from "./sky.js";

const HEMI_DAY = new THREE.Color(0xbfd8e0);
const HEMI_NIGHT = new THREE.Color(0x39496b);

export class SceneMgr {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sky: Sky;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  lamp: THREE.SpotLight;
  lampGlow: THREE.PointLight;
  shake = 0;
  private fog: THREE.Fog;
  /** direction de la lumière directionnelle (soleil le jour, lune la nuit) */
  private lightDir = new THREE.Vector3(0.3, 0.8, 0.2).normalize();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 900);
    this.fog = new THREE.Fog(0x1a1420, 10, settings.renderDist);
    this.scene.fog = this.fog;

    this.sky = new Sky(this.scene);
    this.hemi = new THREE.HemisphereLight(0xbfd8e0, 0x6b4a33, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe0b0, 1.4);
    this.sun.position.set(40, 80, 25);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    /* ombres dynamiques (option) : caméra ortho qui suit le joueur */
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 240;
    const sc = this.sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
    this.sun.shadow.bias = -0.0006;
    this.applyShadows();

    /* lampe frontale (suit la caméra) */
    this.lamp = new THREE.SpotLight(0xfff2d8, 0, 50, 0.8, 0.7, 1.5);
    this.scene.add(this.lamp);
    this.scene.add(this.lamp.target);
    this.lampGlow = new THREE.PointLight(0xffe8c0, 0, 18, 1.9);
    this.scene.add(this.lampGlow);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.applyRenderScale();
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Résolution interne (option graphique). */
  applyRenderScale(): void {
    const s = settings.renderScale > 0 ? settings.renderScale : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(s);
  }

  /** Ombres dynamiques (option, coûteuse). */
  applyShadows(): void {
    if (this.renderer.shadowMap.enabled !== settings.shadows) {
      this.renderer.shadowMap.enabled = settings.shadows;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.shadowMap.needsUpdate = true;
      /* force la recompilation des matériaux éclairés */
      this.scene.traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) m.needsUpdate = true;
      });
    }
  }

  /** Ambiance selon la lumière du jour, la profondeur (m) et la tempête. */
  updateEnv(daylight: number, depth: number, storm: number, time: number, dayPhase: number): void {
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    this.sky.update(daylight, storm, time, dayPhase);

    const under = Math.min(1, depth / 26);           // transition surface -> souterrain
    const dayAmb = 0.28 + daylight * 0.72;
    this.hemi.intensity = (0.85 * dayAmb) * (1 - under) + 0.06;
    this.hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, daylight);

    /* soleil : chaud et rasant à l'aube/au crépuscule, neutre au zénith ;
     * la nuit, la grande lune prend le relais en bleu froid */
    const el = Math.sin(dayPhase * Math.PI * 2);   // élévation (zénith à 0.25)
    const dayI = 1.5 * daylight * (1 - under) * (1 - storm * 0.65);
    const moonI = 0.17 * (1 - daylight) * (1 - under);
    if (dayI >= moonI) {
      const warm = 1 - Math.min(1, Math.max(0, el) * 2.4);         // 1 à l'horizon
      this.sun.intensity = dayI * (1 + warm * 0.25);
      this.sun.color.setHSL(0.10 - warm * 0.05, 0.5 + warm * 0.35, 0.62 + (1 - warm) * 0.08);
      this.lightDir.copy(this.sky.uniforms.uSunDir.value);
      if (this.lightDir.y < 0.08) this.lightDir.y = 0.08;          // jamais sous l'horizon
    } else {
      this.sun.intensity = moonI;
      this.sun.color.setHex(0x93a7d4);
      this.lightDir.set(0.5, 0.45, -0.6).normalize();              // la grande lune
    }

    /* brouillard : couleur ciel en surface (bleu nuit après le couchant),
     * noir-violet dessous */
    const surfCol = new THREE.Color().setHSL(
      0.07 + (1 - daylight) * 0.52,
      0.22 + daylight * 0.18,
      0.10 + daylight * 0.40
    );
    if (storm > 0.01) surfCol.lerp(new THREE.Color(0x8a6a45), storm * 0.8);
    const caveCol = new THREE.Color(0x0b0812);
    this.fog.color.copy(surfCol).lerp(caveCol, under);
    this.renderer.setClearColor(this.fog.color);
    this.fog.near = 8 + (1 - under) * 30;
    this.fog.far = settings.renderDist * (1 - under * 0.45) * (1 - storm * 0.45);

    /* lampe frontale : à fond sous terre ou de nuit */
    const lampOn = Math.max(under, (1 - daylight) * 0.8);
    this.lamp.intensity = 55 * lampOn;
    this.lampGlow.intensity = 1.2 * lampOn;
    this.hemi.intensity += 0.1 * under;   // léger plancher de lisibilité en galerie
  }

  /** Positionne la lampe frontale sur la caméra (+ le soleil d'ombre qui suit). */
  updateLamp(): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.lamp.position.copy(this.camera.position);
    this.lamp.target.position.copy(this.camera.position).addScaledVector(dir, 12);
    this.lampGlow.position.copy(this.camera.position).addScaledVector(dir, 2.6);
    /* la directionnelle suit le soleil/la lune (ombres cohérentes ET modelé
     * des faces qui tourne avec l'heure, même sans ombres) */
    this.sun.target.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.lightDir, 120);
  }

  render(dt: number): void {
    const sh = this.shake * (settings.shakeScale ?? 1);   // accessibilité
    if (sh > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * sh * 0.05;
      this.camera.position.y += (Math.random() - 0.5) * sh * 0.05;
      this.camera.position.z += (Math.random() - 0.5) * sh * 0.05;
    }
    if (this.shake > 0.01) this.shake *= Math.pow(0.001, dt);
    this.renderer.render(this.scene, this.camera);
  }
}
