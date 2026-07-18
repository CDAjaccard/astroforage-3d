/* Scène Three.js : caméra, lumières jour/nuit, brouillard de profondeur,
 * lampe frontale, secousses d'écran. */
import * as THREE from "three";
import { settings } from "../config.js";
import { Sky } from "./sky.js";

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

  /** Ambiance selon la lumière du jour, la profondeur (m) et la tempête. */
  updateEnv(daylight: number, depth: number, storm: number, time: number, dayPhase: number): void {
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    this.sky.update(daylight, storm, time, dayPhase);

    const under = Math.min(1, depth / 26);           // transition surface -> souterrain
    const dayAmb = 0.28 + daylight * 0.72;
    this.hemi.intensity = (0.85 * dayAmb) * (1 - under) + 0.06;
    this.sun.intensity = 1.5 * daylight * (1 - under) * (1 - storm * 0.65);
    this.sun.color.setHSL(0.09, 0.55, 0.62 + daylight * 0.1);

    /* brouillard : couleur ciel en surface, noir-violet dessous */
    const surfCol = new THREE.Color().setHSL(0.07, 0.4, 0.12 + daylight * 0.38);
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

  /** Positionne la lampe frontale sur la caméra. */
  updateLamp(): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.lamp.position.copy(this.camera.position);
    this.lamp.target.position.copy(this.camera.position).addScaledVector(dir, 12);
    this.lampGlow.position.copy(this.camera.position).addScaledVector(dir, 2.6);
  }

  render(dt: number): void {
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.05;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.05;
      this.camera.position.z += (Math.random() - 0.5) * this.shake * 0.05;
      this.shake *= Math.pow(0.001, dt);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
