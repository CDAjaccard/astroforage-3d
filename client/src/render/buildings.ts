/* Visuels animés des bâtiments : GLB généré (repli procédural sinon) + couche
 * d'animation par type — fumée, lueurs, éléments mobiles. Les états viennent
 * de la sim (status des machines, énergie, jour/nuit). */
import * as THREE from "three";
import { BUILDINGS, BUILD_ORDER } from "@astroforage/shared";
import { makeBuilding, fallbackCrystalSmall, loadGLB } from "./props.js";
import type { Effects } from "./effects.js";

/** Charge les GLB générés des 12 bâtiments (null par clé si absent). */
export async function loadBuildingTemplates(): Promise<Record<string, THREE.Object3D | null>> {
  const out: Record<string, THREE.Object3D | null> = {};
  await Promise.all(BUILD_ORDER.map(async key => {
    out[key] = await loadGLB(`assets/models/batiments/${key}.glb`, buildingHeight(key));
  }));
  return out;
}

/** Contexte d'animation fourni par le jeu à chaque frame. */
export interface BuildingCtx {
  status: string;         // clé de statut sim ("run", "paused", …)
  ratio: number;          // énergie disponible 0..1
  battFrac: number;       // charge des accus 0..1
  daylight: number;
  dayPhase: number;       // 0..1 (position du soleil)
  robotsActive: number;
  storm: boolean;
  time: number;
}

interface FxDef {
  height: number;
  smoke?: { x: number; y: number; z: number; col: string; rate: number };
  steam?: { x: number; y: number; z: number; rate: number };
  glow?: { x: number; y: number; z: number; col: number; size: number; pulse: number; light?: boolean };
}

/* ancres réglées pour les GLB normalisés (pied au sol, centré) */
const FX: Record<string, FxDef> = {
  generateur: { height: 2.7, smoke: { x: 0.3, y: 2.75, z: 0.2, col: "#5a5a62", rate: 7 }, glow: { x: 0, y: 1.1, z: 0.8, col: 0xff9a4d, size: 1.1, pulse: 3 } },
  fonderie: { height: 3.0, smoke: { x: -0.2, y: 3.1, z: 0, col: "#4a4444", rate: 9 }, glow: { x: 0, y: 1.0, z: 0.9, col: 0xff7a2d, size: 1.6, pulse: 5, light: true } },
  atelier: { height: 2.7, glow: { x: 0, y: 1.2, z: 0.9, col: 0x7de0d8, size: 1.2, pulse: 0 } },
  solaire: { height: 2.3, glow: { x: 0, y: 1.6, z: 0, col: 0x3f7fd8, size: 1.0, pulse: 0 } },
  accu: { height: 2.1, glow: { x: 0, y: 1.5, z: 0.4, col: 0x9dff70, size: 1.2, pulse: 1.4 } },
  silo: { height: 3.5, glow: { x: 0, y: 3.3, z: 0, col: 0xffffff, size: 0.5, pulse: 1 } },
  raffinerie: { height: 3.3, steam: { x: 0.4, y: 3.3, z: 0.2, rate: 8 }, glow: { x: 0, y: 1.2, z: 0.7, col: 0xffd23e, size: 1.0, pulse: 2 } },
  montecharge: { height: 3.3, glow: { x: 0, y: 2.6, z: 0, col: 0x7de0d8, size: 1.3, pulse: 2, light: true } },
  baie: { height: 2.7, glow: { x: 0, y: 1.4, z: 1.0, col: 0x9dff70, size: 1.0, pulse: 2.6 } },
  labo: { height: 2.9, glow: { x: 0, y: 2.6, z: 0, col: 0xff9de8, size: 1.6, pulse: 1.8, light: true } },
  reacteur: { height: 3.5, steam: { x: 0, y: 3.5, z: 0, rate: 4 }, glow: { x: 0, y: 2.6, z: 0, col: 0x8dff70, size: 2.0, pulse: 1.2, light: true } },
  scanner: { height: 3.1, glow: { x: 0, y: 2.9, z: 0, col: 0x7de0d8, size: 0.9, pulse: 0 } }
};

function glowTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.4, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
const GLOW_TEX = glowTexture();
const isRunning = (s: string): boolean => s.startsWith("run") || s === "day";

export class BuildingVisual {
  group = new THREE.Group();
  private key: string;
  private glow: THREE.Sprite | null = null;
  private light: THREE.PointLight | null = null;
  private mobile: THREE.Object3D | null = null;   // élément animé (plateforme, holo, anneau)
  private mobileKind = "";
  private smokeAcc = 0;
  private sparkAcc = 0;
  private fx: Effects;

  constructor(key: string, template: THREE.Object3D | null, fx: Effects) {
    this.key = key;
    this.fx = fx;
    const base = template ? template.clone(true) : makeBuilding(key, BUILDINGS[key]?.ico ?? "▣");
    this.group.add(base);
    const def = FX[key];
    if (def?.glow) {
      this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEX, color: def.glow.col, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending
      }));
      this.glow.position.set(def.glow.x, def.glow.y, def.glow.z);
      this.glow.scale.setScalar(def.glow.size);
      this.group.add(this.glow);
      if (def.glow.light) {
        this.light = new THREE.PointLight(def.glow.col, 0, 11, 1.8);
        this.light.position.set(def.glow.x, def.glow.y + 0.3, def.glow.z);
        this.group.add(this.light);
      }
    }
    this.buildMobile();
  }

  /** Élément mobile procédural par type. */
  private buildMobile(): void {
    const mk = (o: THREE.Object3D, kind: string): void => {
      this.mobile = o;
      this.mobileKind = kind;
      this.group.add(o);
    };
    if (this.key === "montecharge") {
      const plat = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.16, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xffb84d, metalness: 0.5, roughness: 0.5 })
      );
      plat.position.set(0, 0.6, 0);
      mk(plat, "lift");
    } else if (this.key === "labo") {
      const holo = fallbackCrystalSmall();
      holo.scale.setScalar(0.65);
      holo.position.set(0, FX.labo.height + 0.15, 0);
      mk(holo, "holo");
    } else if (this.key === "scanner") {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.05, 8, 22),
        new THREE.MeshStandardMaterial({ color: 0x7de0d8, emissive: 0x2fb8a8, emissiveIntensity: 1.8 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = FX.scanner.height + 0.1;
      mk(ring, "ring");
    } else if (this.key === "generateur") {
      const fan = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.12), new THREE.MeshStandardMaterial({ color: 0x5c6270, metalness: 0.6 }));
        blade.rotation.z = (i / 3) * Math.PI * 2;
        blade.position.x = Math.cos((i / 3) * Math.PI * 2) * 0.22;
        blade.position.y = Math.sin((i / 3) * Math.PI * 2) * 0.22;
        fan.add(blade);
      }
      fan.position.set(0, 1.3, 1.15);
      mk(fan, "fan");
    }
  }

  /** wp = position monde du bâtiment (pour les particules). */
  update(dt: number, ctx: BuildingCtx, wx: number, wz: number): void {
    const def = FX[this.key];
    const run = isRunning(ctx.status);
    const t = ctx.time;

    /* lueur */
    if (this.glow && def?.glow) {
      let target = 0;
      if (this.key === "accu") target = 0.15 + ctx.battFrac * 0.55;
      else if (this.key === "solaire") target = run && ctx.daylight > 0.05 ? 0.3 * ctx.daylight : 0;
      else if (this.key === "silo") target = 0.35;
      else if (this.key === "labo" || this.key === "scanner") target = 0.5;
      else target = run ? 0.55 : 0.06;
      const pulse = def.glow.pulse ? 1 + Math.sin(t * def.glow.pulse) * 0.25 : 1;
      const m = this.glow.material as THREE.SpriteMaterial;
      m.opacity += (target * pulse - m.opacity) * Math.min(1, dt * 5);
      if (this.light) this.light.intensity = m.opacity * 9;
    }

    /* fumée / vapeur */
    if (run && def?.smoke) {
      this.smokeAcc += dt * def.smoke.rate;
      while (this.smokeAcc > 1) {
        this.smokeAcc -= 1;
        this.fx.puff(wx + def.smoke.x + (Math.random() - 0.5) * 0.3, def.smoke.y, wz + def.smoke.z, def.smoke.col, 1);
      }
    }
    if (run && def?.steam) {
      this.smokeAcc += dt * def.steam.rate;
      while (this.smokeAcc > 1) {
        this.smokeAcc -= 1;
        this.fx.puff(wx + def.steam.x + (Math.random() - 0.5) * 0.2, def.steam.y, wz + def.steam.z, "#d8dce6", 1);
      }
    }
    /* étincelles d'atelier / de baie quand ça travaille */
    if (run && (this.key === "atelier" || (this.key === "baie" && ctx.robotsActive > 0))) {
      this.sparkAcc += dt;
      if (this.sparkAcc > 1.4) {
        this.sparkAcc = 0;
        if (Math.random() < 0.7) this.fx.chunks(wx + (Math.random() - 0.5), 1 + Math.random(), wz + 0.8, "#ffd23e", 3);
      }
    }

    /* éléments mobiles */
    if (this.mobile) {
      if (this.mobileKind === "lift") {
        this.mobile.position.y = 0.5 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 1.7;
      } else if (this.mobileKind === "holo") {
        this.mobile.rotation.y = t * 0.8;
        this.mobile.position.y = FX.labo.height + 0.15 + Math.sin(t * 1.6) * 0.12;
      } else if (this.mobileKind === "ring") {
        this.mobile.rotation.z = t * 1.6;
        const s = 1 + ((t * 0.7) % 1) * 0.5;
        this.mobile.scale.setScalar(s);
        (this.mobile as THREE.Mesh).material && (((this.mobile as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 1);
      } else if (this.mobileKind === "fan") {
        if (run) this.mobile.rotation.z += dt * 9;
      }
    }

    /* le panneau solaire suit le soleil (lacet lent selon l'heure) */
    if (this.key === "solaire") {
      const target = (ctx.dayPhase - 0.25) * Math.PI * 1.6;
      this.group.rotation.y += (target - this.group.rotation.y) * Math.min(1, dt * 0.5);
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
  }
}

/** hauteur cible du GLB d'un bâtiment. */
export function buildingHeight(key: string): number {
  return FX[key]?.height ?? 2.7;
}
