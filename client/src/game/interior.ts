/* Intérieur de la fusée — votre BASE personnelle (parité avec l'original) :
 * sas, vestiaire (couleurs de combinaison), établi de décoration (8 objets),
 * console de vol. La pièce vit très haut au-dessus du monde (aucun chunk
 * visible) ; les décorations sont partagées via la sim (solo et coop). */
import * as THREE from "three";
import type { Deco } from "@astroforage/shared";

export const ROOM = { x0: 600, y0: 500, z0: 600, L: 12, D: 5.4, H: 3.1 };

export interface Station { id: "hatch" | "vestiaire" | "deco" | "console"; x: number }
export const STATIONS: Station[] = [
  { id: "hatch", x: 1.1 },
  { id: "vestiaire", x: 4.2 },
  { id: "deco", x: 7.2 },
  { id: "console", x: 10.6 }
];

function mat(col: string | number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: col as any, roughness: 0.8, metalness: 0.2, ...opts });
}
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}

export function makeDecoMesh(id: string): THREE.Object3D {
  const g = new THREE.Group();
  switch (id) {
    case "plante": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 10), mat("#c67a3e"));
      pot.position.y = 0.12;
      g.add(pot);
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), mat("#6f9e5b"));
        leaf.position.set((Math.random() - 0.5) * 0.16, 0.45, (Math.random() - 0.5) * 0.16);
        leaf.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        g.add(leaf);
      }
      break;
    }
    case "lampe": {
      g.add(box(0.26, 0.05, 0.26, mat("#5f636e"), 0, 0.03, 0));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), mat("#8a8f9c", { metalness: 0.6 }));
      pole.position.y = 0.78;
      g.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat("#ffd9a0", { emissive: "#ffb84d", emissiveIntensity: 1.6 }));
      bulb.position.y = 1.6;
      g.add(bulb);
      const light = new THREE.PointLight(0xffcf90, 3, 5, 1.8);
      light.position.y = 1.6;
      g.add(light);
      break;
    }
    case "tapis": {
      const rug = box(1.4, 0.03, 0.9, mat("#9a77c9", { roughness: 1 }));
      rug.position.y = 0.015;
      g.add(rug);
      g.add(box(1.2, 0.032, 0.7, mat("#c9a6ff", { roughness: 1 }), 0, 0.016, 0));
      break;
    }
    case "statue": {
      g.add(box(0.34, 0.22, 0.34, mat("#5f636e"), 0, 0.11, 0));
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 6), mat("#ff9de8", { emissive: "#c245a8", emissiveIntensity: 1.3, transparent: true, opacity: 0.92 }));
      c.position.y = 0.57;
      g.add(c);
      break;
    }
    case "banniere": {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), mat("#8a8f9c"));
      pole.position.y = 0.85;
      g.add(pole);
      const flag = box(0.65, 0.9, 0.03, mat("#2fb8a8"), 0.36, 1.15, 0);
      g.add(flag);
      g.add(box(0.65, 0.16, 0.035, mat("#ff8c42"), 0.36, 1.35, 0));
      break;
    }
    case "robot": {
      const b = box(0.3, 0.24, 0.24, mat("#2fb8a8", { metalness: 0.5 }), 0, 1, 0);
      b.name = "bob";
      g.add(b);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat("#ffd23e", { emissive: "#ffae00", emissiveIntensity: 2 }));
      eye.position.set(0.08, 1.02, 0.13);
      g.add(eye);
      break;
    }
    case "baril": {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.62, 12), mat("#8a8f9c", { metalness: 0.55 }));
      drum.position.y = 0.31;
      g.add(drum);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.03, 6, 16), mat("#8dff70", { emissive: "#5adf35", emissiveIntensity: 2 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.36;
      g.add(ring);
      const glow = new THREE.PointLight(0x8dff70, 1.4, 3.4, 2);
      glow.position.y = 0.6;
      g.add(glow);
      break;
    }
    case "trophee": {
      g.add(box(0.3, 0.34, 0.3, mat("#3c4250"), 0, 0.17, 0));
      const cup = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 10), mat("#ffd23e", { metalness: 0.8, roughness: 0.25, emissive: "#8d6a00", emissiveIntensity: 0.4 }));
      cup.rotation.x = Math.PI;
      cup.position.y = 0.5;
      g.add(cup);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat("#ffd23e", { metalness: 0.8, roughness: 0.2 }));
      orb.position.y = 0.68;
      g.add(orb);
      break;
    }
    default:
      g.add(box(0.3, 0.3, 0.3, mat("#8a8f9c"), 0, 0.15, 0));
  }
  return g;
}

export class Interior {
  group = new THREE.Group();
  /** position du joueur dans le repère de la pièce */
  px = 2; pz = ROOM.D * 0.55;
  private decoMeshes: Array<{ key: string; obj: THREE.Object3D }> = [];
  private stationMeshes = new Map<string, THREE.Object3D>();
  private built = false;

  build(scene: THREE.Scene): void {
    if (this.built) return;
    this.built = true;
    const g = this.group;
    g.position.set(ROOM.x0, ROOM.y0, ROOM.z0);
    const { L, D, H } = ROOM;
    const wall = mat("#4b5468", { roughness: 0.7, metalness: 0.25 });
    const wallDk = mat("#333a49");
    const floor = box(L, 0.1, D, mat("#4a5160", { metalness: 0.4, roughness: 0.6 }), L / 2, -0.05, D / 2);
    g.add(floor);
    /* dalles */
    for (let i = 1; i < L; i += 2) g.add(box(0.04, 0.012, D, wallDk, i, 0.006, D / 2));
    g.add(box(L, 0.1, D, wall, L / 2, H + 0.05, D / 2));                 // plafond
    g.add(box(L, H, 0.12, wall, L / 2, H / 2, -0.06));                    // mur du fond
    g.add(box(L, H, 0.12, wall, L / 2, H / 2, D + 0.06));                 // mur avant
    g.add(box(0.12, H, D, wall, -0.06, H / 2, D / 2));
    g.add(box(0.12, H, D, wall, L + 0.06, H / 2, D / 2));
    /* bandeaux lumineux au plafond */
    for (const lx of [L * 0.22, L * 0.5, L * 0.78]) {
      g.add(box(1.6, 0.04, 0.3, mat("#eef6ff", { emissive: "#cfe4ff", emissiveIntensity: 1.6 }), lx, H - 0.03, D / 2));
      const pl = new THREE.PointLight(0xffeeda, 16, 13, 1.5);
      pl.position.set(lx, H - 0.5, D / 2);
      g.add(pl);
    }
    /* hublot (mur avant) */
    const hublot = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 24), mat("#8a8f9c", { metalness: 0.7 }));
    hublot.position.set(L * 0.5, 1.7, D - 0.05);
    g.add(hublot);
    const vitre = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), mat("#0d1b2e", { emissive: "#12395a", emissiveIntensity: 0.8 }));
    vitre.position.set(L * 0.5, 1.7, D - 0.04);
    vitre.rotation.y = Math.PI;
    g.add(vitre);

    /* ---- postes (mur du fond) ---- */
    const mkStation = (id: string, x: number, builder: () => THREE.Object3D): void => {
      const o = builder();
      o.position.set(x, 0, 0.55);
      g.add(o);
      this.stationMeshes.set(id, o);
    };
    mkStation("hatch", STATIONS[0].x, () => {
      const s = new THREE.Group();
      s.add(box(1.2, 2.3, 0.14, mat("#5c6270", { metalness: 0.6 }), 0, 1.15, -0.45));
      s.add(box(0.9, 2, 0.1, mat("#79e0d6", { emissive: "#2fb8a8", emissiveIntensity: 0.35 }), 0, 1.1, -0.4));
      s.add(box(0.16, 0.16, 0.1, mat("#ff8c42", { emissive: "#ff8c42", emissiveIntensity: 1.2 }), 0.36, 1.2, -0.36));
      return s;
    });
    mkStation("vestiaire", STATIONS[1].x, () => {
      const s = new THREE.Group();
      s.add(box(1.5, 2.1, 0.5, mat("#3c4250"), 0, 1.05, -0.3));
      for (let i = 0; i < 3; i++) {
        const cols = ["#ece7da", "#5b8fb0", "#9a77c9"];
        s.add(box(0.34, 1.2, 0.1, mat(cols[i]), -0.5 + i * 0.5, 1.1, -0.02));
      }
      return s;
    });
    mkStation("deco", STATIONS[2].x, () => {
      const s = new THREE.Group();
      s.add(box(1.7, 0.09, 0.8, mat("#8a5636"), 0, 0.92, -0.1));
      for (const [sx] of [[-0.7], [0.7]] as Array<[number]>) s.add(box(0.12, 0.9, 0.12, mat("#5f636e"), sx, 0.45, -0.1));
      s.add(box(0.3, 0.2, 0.24, mat("#ffd23e", { emissive: "#8d6a00", emissiveIntensity: 0.4 }), -0.4, 1.1, -0.1));
      s.add(box(0.22, 0.3, 0.2, mat("#2fb8a8"), 0.3, 1.16, -0.1));
      return s;
    });
    mkStation("console", STATIONS[3].x, () => {
      const s = new THREE.Group();
      s.add(box(1.6, 0.8, 0.6, mat("#2b303c"), 0, 0.4, -0.2));
      const scr = box(1.3, 0.8, 0.08, mat("#0a2a26", { emissive: "#1f8478", emissiveIntensity: 1.1 }), 0, 1.35, -0.42);
      scr.rotation.x = -0.18;
      s.add(scr);
      return s;
    });
    scene.add(g);
  }

  /** position-monde de la caméra dans la pièce */
  camPos(): { x: number; y: number; z: number } {
    return { x: ROOM.x0 + this.px, y: ROOM.y0 + 1.45, z: ROOM.z0 + this.pz };
  }

  /** poste le plus proche (portée 1.5 m) */
  nearStation(): Station | null {
    let best: Station | null = null, bd = 1.5;
    for (const st of STATIONS) {
      const d = Math.hypot(this.px - st.x, this.pz - 1.0);
      if (d < bd) { bd = d; best = st; }
    }
    return best;
  }

  /** déco la plus proche d'un x-pièce (portée 0.9 m) */
  nearDecoX(x: number, decos: Deco[]): number | null {
    let best: number | null = null, bd = 0.9;
    for (const d of decos) {
      const dx = Math.abs(d.x * ROOM.L - x);
      if (dx < bd) { bd = dx; best = d.x; }
    }
    return best;
  }

  move(dt: number, ix: number, iz: number): void {
    const sp = 3.4;
    this.px = Math.max(0.6, Math.min(ROOM.L - 0.6, this.px + ix * sp * dt));
    this.pz = Math.max(0.7, Math.min(ROOM.D - 0.7, this.pz + iz * sp * dt));
  }

  syncDecos(decos: Deco[], time: number): void {
    const want = new Set(decos.map(d => d.id + ":" + d.x.toFixed(3)));
    for (let i = this.decoMeshes.length - 1; i >= 0; i--) {
      if (!want.has(this.decoMeshes[i].key)) {
        this.group.remove(this.decoMeshes[i].obj);
        this.decoMeshes.splice(i, 1);
      }
    }
    const have = new Set(this.decoMeshes.map(d => d.key));
    for (const d of decos) {
      const key = d.id + ":" + d.x.toFixed(3);
      if (have.has(key)) continue;
      const obj = makeDecoMesh(d.id);
      obj.position.set(d.x * ROOM.L, 0, d.id === "banniere" ? 0.35 : 1.7);
      this.group.add(obj);
      this.decoMeshes.push({ key, obj });
    }
    /* petites animations */
    for (const d of this.decoMeshes) {
      const bob = d.obj.getObjectByName("bob");
      if (bob) bob.position.y = 1 + Math.sin(time * 2 + d.obj.position.x) * 0.08;
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.built = false;
    this.decoMeshes = [];
  }
}
