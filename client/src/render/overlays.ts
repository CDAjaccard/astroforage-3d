/* Surcouches de détection (parité avec la « révélation » 2D) :
 * - Géoscanner : filons en surbrillance À TRAVERS la roche autour de la foreuse
 * - Labo cristallin : balises roses sur tous les cristaux du monde
 * Sprites additifs sans test de profondeur. */
import * as THREE from "three";
import { W, T, SURF, tile, RESDEF } from "@astroforage/shared";

const VOX = 2;
const MAX_ORE = 260;

function dotTex(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 48;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 48, 48);
  return new THREE.CanvasTexture(cv);
}

export class Overlays {
  private oreGroup = new THREE.Group();
  private beaconGroup = new THREE.Group();
  private orePool: THREE.Sprite[] = [];
  private beacons = new Map<string, THREE.Sprite>();
  private tex = dotTex();
  private scanT = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.oreGroup, this.beaconGroup);
  }

  private makeSprite(color: string, size: number, opacity: number): THREE.Sprite {
    const m = new THREE.SpriteMaterial({
      map: this.tex, color, transparent: true, opacity,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    s.renderOrder = 50;
    return s;
  }

  /** Scan périodique des filons autour de la foreuse (si Géoscanner construit). */
  update(
    dt: number,
    S: { grid: Uint8Array; worldH: number },
    hasScanner: boolean, hasOptique: boolean, hasLabo: boolean,
    inDrill: boolean, dx: number, dy: number, dz: number,
    crystalKeys: Iterable<string>,
    time: number
  ): void {
    /* ---- filons (scanner) ---- */
    this.scanT -= dt;
    const active = hasScanner && inDrill;
    this.oreGroup.visible = active;
    if (active && this.scanT <= 0) {
      this.scanT = 0.5;
      const R = 9 + (hasOptique ? 3 : 0);
      const cx = Math.floor(dx / VOX), cz = Math.floor(dz / VOX);
      const cd = SURF - 1 - Math.floor(dy / VOX);
      let n = 0;
      for (let d = Math.max(SURF, cd - R); d <= Math.min(S.worldH - 2, cd + R) && n < MAX_ORE; d++) {
        for (let z = Math.max(1, cz - R); z <= Math.min(W - 2, cz + R) && n < MAX_ORE; z++) {
          for (let x = Math.max(1, cx - R); x <= Math.min(W - 2, cx + R) && n < MAX_ORE; x++) {
            const dist2 = (x - cx) ** 2 + (z - cz) ** 2 + (d - cd) ** 2;
            if (dist2 > R * R) continue;
            const id = tile(S, x, z, d);
            const def = T[id];
            if (!def?.res) continue;
            let sp = this.orePool[n];
            if (!sp) {
              sp = this.makeSprite("#fff", 0.8, 0.5);
              this.orePool.push(sp);
              this.oreGroup.add(sp);
            }
            sp.visible = true;
            (sp.material as THREE.SpriteMaterial).color.set(RESDEF[def.res]?.col ?? "#fff");
            sp.position.set((x + 0.5) * VOX, (SURF - 1 - d) * VOX + 1, (z + 0.5) * VOX);
            n++;
          }
        }
      }
      for (let i = n; i < this.orePool.length; i++) this.orePool[i].visible = false;
    }

    /* ---- balises cristaux (labo) ---- */
    this.beaconGroup.visible = hasLabo;
    if (hasLabo) {
      const want = new Set<string>();
      for (const k of crystalKeys) {
        const [x, z, d] = k.split(",").map(Number);
        if (tile(S, x, z, d) === 8) want.add(k);   // cristaux uniquement (pas le Cœur)
      }
      for (const [k, sp] of this.beacons) {
        if (!want.has(k)) { this.beaconGroup.remove(sp); this.beacons.delete(k); }
      }
      for (const k of want) {
        if (this.beacons.has(k)) continue;
        const [x, z, d] = k.split(",").map(Number);
        const sp = this.makeSprite("#ff9de8", 1.6, 0.45);
        sp.position.set((x + 0.5) * VOX, (SURF - 1 - d) * VOX + 1.4, (z + 0.5) * VOX);
        this.beaconGroup.add(sp);
        this.beacons.set(k, sp);
      }
      const pulse = 1.3 + Math.sin(time * 2.4) * 0.35;
      for (const [, sp] of this.beacons) sp.scale.setScalar(pulse);
    }
  }
}
