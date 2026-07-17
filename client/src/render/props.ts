/* Props 3D : modèles générés (MCP Higgsfield, /assets/models/*.glb) avec
 * repli procédural systématique — le jeu reste jouable sans aucun asset.
 * L'astronaute est TOUJOURS procédural (recolorable pour le vestiaire coop). */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { COSMETIC, type Cosmetic } from "@astroforage/shared";

const loader = new GLTFLoader();

/** Charge un GLB, le normalise (hauteur cible, pied à y=0), sinon null. */
async function loadGLB(url: string, targetH: number, yawOffset = 0): Promise<THREE.Object3D | null> {
  try {
    const gltf = await loader.loadAsync(url);
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = targetH / Math.max(0.001, size.y);
    obj.scale.setScalar(s);
    box.setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= box.min.y;
    /* l'offset d'orientation vit sur un nœud INTERNE : la racine reste libre
     * pour le lacet du gameplay (qui l'écrase chaque frame) */
    const orient = new THREE.Group();
    orient.rotation.y = yawOffset;
    orient.add(obj);
    const wrap = new THREE.Group();
    wrap.add(orient);
    return wrap;
  } catch {
    return null;
  }
}

function mat(col: string | number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: col as any, roughness: 0.75, metalness: 0.25, ...opts });
}
function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}

/* ---------- replis procéduraux ---------- */

function fallbackDrill(): THREE.Object3D {
  const g = new THREE.Group();
  const hull = mat("#d8d2c4", { roughness: 0.55, metalness: 0.5 });
  const orange = mat("#ff8c42", { roughness: 0.5, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.7, 6, 14), hull);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.85;
  g.add(body);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.95, 18), mat("#8f97a8", { metalness: 0.85, roughness: 0.3 }));
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0, 0.85, -1.25);
  g.add(cone);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat("#7de0d8", { transparent: true, opacity: 0.85, emissive: "#1b5a55", roughness: 0.15 }));
  canopy.position.set(0, 1.18, -0.2);
  g.add(canopy);
  for (const sx of [-1, 1]) {
    g.add(box(0.24, 0.42, 0.62, orange, sx * 0.74, 0.62, 0.32));
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.3, 10), mat("#5c6270", { metalness: 0.8 }));
    noz.position.set(sx * 0.74, 0.32, 0.32);
    g.add(noz);
  }
  g.add(box(0.9, 0.16, 1.1, orange, 0, 0.18, 0.1));
  return g;
}

function fallbackRocket(): THREE.Object3D {
  const g = new THREE.Group();
  const hull = mat("#e8e2d4", { roughness: 0.5, metalness: 0.4 });
  const orange = mat("#ff8c42");
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 6.4, 18), hull);
  body.position.y = 4.4;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 18), orange);
  nose.position.y = 8.9;
  g.add(nose);
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat("#7de0d8", { emissive: "#1b5a55" }));
  win.position.set(0, 5.6, -1.45);
  g.add(win);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = box(0.3, 2.6, 0.3, mat("#5c6270", { metalness: 0.7 }));
    leg.position.set(Math.cos(a) * 1.9, 1.2, Math.sin(a) * 1.9);
    leg.rotation.z = Math.cos(a) * 0.35;
    leg.rotation.x = -Math.sin(a) * 0.35;
    g.add(leg);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 1.1), orange);
    fin.position.set(Math.cos(a) * 1.7, 2.4, Math.sin(a) * 1.7);
    fin.lookAt(0, 2.4, 0);
    g.add(fin);
  }
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 1.2, 16), mat("#3c4250", { metalness: 0.9 }));
  noz.position.y = 0.75;
  g.add(noz);
  return g;
}

function fallbackRobot(): THREE.Object3D {
  const g = new THREE.Group();
  const teal = mat("#2fb8a8", { metalness: 0.5 });
  g.add(box(0.62, 0.45, 0.78, teal, 0, 0.52, 0));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 10), mat("#9aa7bd", { metalness: 0.85 }));
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0, 0.45, -0.6);
  g.add(cone);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(box(0.12, 0.34, 0.12, mat("#3c4250"), sx * 0.28, 0.17, sz * 0.28));
  }
  const ant = box(0.03, 0.5, 0.03, mat("#9aa7bd"), 0.2, 0.98, 0.15);
  g.add(ant);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat("#9dff70", { emissive: "#5adf35", emissiveIntensity: 2 }));
  led.position.set(0.2, 1.25, 0.15);
  g.add(led);
  return g;
}

function fallbackCrystal(): THREE.Object3D {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), mat("#3e3540"));
  rock.position.y = 0.12;
  rock.scale.y = 0.5;
  g.add(rock);
  const cm = mat("#ff9de8", { emissive: "#c245a8", emissiveIntensity: 1.4, transparent: true, opacity: 0.92, roughness: 0.2 });
  const heights = [1.1, 0.75, 0.55, 0.8];
  const pos = [[0, 0], [0.3, 0.16], [-0.28, 0.1], [0.05, -0.3]];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, heights[i], 6), cm);
    c.position.set(pos[i][0], heights[i] / 2, pos[i][1]);
    c.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * 3, (Math.random() - 0.5) * 0.35);
    g.add(c);
  }
  return g;
}

function fallbackCreature(): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat("#a866ff", { roughness: 0.5 }));
  body.scale.set(1.25, 0.75, 1);
  body.name = "body";
  g.add(body);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat("#efd7ff", { emissive: "#c9a6ff", emissiveIntensity: 2.2 }));
  core.name = "core";
  g.add(core);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = box(0.09, 0.5, 0.09, mat("#7a4bc0"));
    leg.position.set(Math.cos(a) * 0.55, -0.35, Math.sin(a) * 0.55);
    leg.rotation.z = Math.cos(a) * 0.6;
    leg.rotation.x = -Math.sin(a) * 0.6;
    g.add(leg);
  }
  return g;
}

function fallbackHeart(): THREE.Object3D {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat("#ffd23e", { emissive: "#ffae00", emissiveIntensity: 2.4, roughness: 0.15 }));
  c.position.y = 0.9;
  c.name = "spin";
  g.add(c);
  return g;
}

export function makeNest(): THREE.Object3D {
  const g = new THREE.Group();
  const m = mat("#5a3a78", { roughness: 0.85 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random() * 0.4, 9, 7), m);
    b.position.set((Math.random() - 0.5) * 1.3, 0.3 + Math.random() * 0.35, (Math.random() - 0.5) * 1.3);
    b.scale.y = 0.7;
    g.add(b);
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat("#c07dff", { emissive: "#a04de0", emissiveIntensity: 2.2 }));
  glow.position.y = 0.75;
  glow.name = "core";
  g.add(glow);
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7 + Math.random() * 0.5, 5), mat("#7a4bc0"));
    sp.position.set(Math.cos(a) * (0.5 + Math.random() * 0.6), 0.8, Math.sin(a) * (0.5 + Math.random() * 0.6));
    sp.rotation.set((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2);
    g.add(sp);
  }
  return g;
}

export function makeDebris(): THREE.Object3D {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.35, 0), mat(i % 2 ? "#6b7688" : "#8a5636", { roughness: 0.9 }));
    r.position.set((Math.random() - 0.5) * 1.6, 0.2, (Math.random() - 0.5) * 1.6);
    g.add(r);
  }
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat("#ff8c42", { emissive: "#ff6a20", emissiveIntensity: 2.5 }));
  glow.position.y = 0.4;
  g.add(glow);
  return g;
}

/* ---------- bâtiments procéduraux (silhouettes distinctes) ---------- */

function labelSprite(ico: string): THREE.Sprite {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 96;
  const ctx = cv.getContext("2d")!;
  ctx.font = "64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ico, 48, 52);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.setScalar(1.5);
  return sp;
}

export function makeBuilding(key: string, ico: string): THREE.Object3D {
  const g = new THREE.Group();
  const metal = mat("#8a8f9c", { metalness: 0.6, roughness: 0.45 });
  const dark = mat("#3c4250", { metalness: 0.5 });
  const teal = mat("#2fb8a8");
  const orange = mat("#ff8c42");
  switch (key) {
    case "generateur": {
      g.add(box(2.2, 1.7, 2.2, dark, 0, 0.85, 0));
      const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.8, 10), metal);
      chim.position.set(0.6, 2.5, 0.4);
      g.add(chim);
      g.add(box(1.2, 0.5, 1.4, orange, -0.4, 1.95, 0));
      break;
    }
    case "fonderie": {
      g.add(box(2.6, 1.4, 2.2, dark, 0, 0.7, 0));
      const four = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 1.5, 12), mat("#7a4020", { emissive: "#803010", emissiveIntensity: 0.4 }));
      four.position.set(0, 2.0, 0);
      g.add(four);
      break;
    }
    case "atelier": {
      g.add(box(2.8, 1.8, 2.4, metal, 0, 0.9, 0));
      const toit = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.8, 3, 1), teal);
      toit.rotation.z = Math.PI / 2;
      toit.rotation.y = Math.PI / 2;
      toit.position.y = 2.2;
      toit.scale.y = 0.5;
      g.add(toit);
      break;
    }
    case "solaire": {
      const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 8), metal);
      pied.position.y = 0.6;
      g.add(pied);
      const pan = box(2.8, 0.1, 2, mat("#1c3f66", { metalness: 0.8, roughness: 0.2, emissive: "#0c2038", emissiveIntensity: 0.6 }));
      pan.position.y = 1.35;
      pan.rotation.x = -0.5;
      g.add(pan);
      break;
    }
    case "accu": {
      for (const sx of [-0.75, 0, 0.75]) {
        const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.6, 10), teal);
        cell.position.set(sx, 0.8, 0);
        g.add(cell);
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat("#9dff70", { emissive: "#4fae30", emissiveIntensity: 1 }));
        top.position.set(sx, 1.7, 0);
        g.add(top);
      }
      break;
    }
    case "silo": {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.6, 14), mat("#d8b18e"));
      s.position.y = 1.3;
      g.add(s);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), orange);
      dome.position.y = 2.6;
      g.add(dome);
      break;
    }
    case "raffinerie": {
      g.add(box(2, 1.2, 2, dark, 0, 0.6, 0));
      for (const [sx, h] of [[-0.55, 2.6], [0.35, 2.1]] as Array<[number, number]>) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, h, 10), metal);
        col.position.set(sx, h / 2 + 0.4, 0.3);
        g.add(col);
      }
      const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 8, 14, Math.PI), mat("#ffd23e"));
      pipe.position.set(-0.1, 2.2, 0.3);
      g.add(pipe);
      break;
    }
    case "montecharge": {
      for (const sx of [-0.9, 0.9]) g.add(box(0.3, 3, 0.3, metal, sx, 1.5, 0));
      g.add(box(2.1, 0.3, 1.4, orange, 0, 2.9, 0));
      g.add(box(1.6, 0.2, 1.2, teal, 0, 0.5, 0));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.4, 12, 1, true), mat("#7de0d8", { transparent: true, opacity: 0.3, emissive: "#2fb8a8", emissiveIntensity: 1.2, side: THREE.DoubleSide }));
      beam.position.y = 1.6;
      beam.name = "beam";
      g.add(beam);
      break;
    }
    case "baie": {
      g.add(box(2.6, 1.5, 2.4, metal, 0, 0.75, 0));
      const porte = box(1.4, 1, 0.1, dark, 0, 0.6, 1.22);
      g.add(porte);
      g.add(labelIcoLight(g, "#9dff70"));
      const mini = fallbackRobot();
      mini.scale.setScalar(0.55);
      mini.position.set(0.7, 1.5, 0.4);
      g.add(mini);
      break;
    }
    case "labo": {
      const domeB = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat("#cfe8ff", { transparent: true, opacity: 0.5, roughness: 0.1 }));
      domeB.position.y = 0.9;
      g.add(domeB);
      g.add(box(2.8, 0.9, 2.8, metal, 0, 0.45, 0));
      const cr = fallbackCrystal();
      cr.scale.setScalar(0.8);
      cr.position.y = 0.9;
      g.add(cr);
      break;
    }
    case "reacteur": {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.25, 2.8, 14), mat("#c8ccd6", { metalness: 0.4 }));
      t.position.y = 1.4;
      g.add(t);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 8, 20), mat("#b4ff8a", { emissive: "#6fdf35", emissiveIntensity: 2 }));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 2.9;
      g.add(halo);
      break;
    }
    case "scanner": {
      const pied2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 8), metal);
      pied2.position.y = 0.8;
      g.add(pied2);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), teal);
      dish.position.y = 1.7;
      dish.rotation.x = Math.PI;
      dish.name = "dish";
      g.add(dish);
      break;
    }
    default:
      g.add(box(2, 1.6, 2, metal, 0, 0.8, 0));
  }
  const lab = labelSprite(ico);
  lab.position.y = 3.6;
  g.add(lab);
  return g;
}

function labelIcoLight(_g: THREE.Group, col: string): THREE.Mesh {
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(col, { emissive: col, emissiveIntensity: 2 }));
  led.position.set(-1.1, 1.6, 1.15);
  return led;
}

/* ---------- astronaute (GLB stylisé riggé si présent, sinon procédural) ---------- */

export interface AstroRig {
  group: THREE.Group;
  legL: THREE.Object3D | null; legR: THREE.Object3D | null;
  armL: THREE.Object3D | null; armR: THREE.Object3D | null;
  jetFlame: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  walk?: THREE.AnimationAction;
}

/** Flamme de jetpack attachable à n'importe quel rig. */
function fallbackJetFlame(g: THREE.Group): THREE.Object3D {
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.5, 8),
    mat("#7de0d8", { emissive: "#38c0ff", emissiveIntensity: 3, transparent: true, opacity: 0.85 })
  );
  flame.rotation.x = Math.PI;
  flame.position.set(0, 0.55, -0.32);
  flame.visible = false;
  g.add(flame);
  return flame;
}

export function makeAstronaut(cos: Cosmetic): AstroRig {
  const su = COSMETIC.suit[cos.suit % COSMETIC.suit.length];
  const vi = COSMETIC.visor[cos.visor % COSMETIC.visor.length];
  const ac = COSMETIC.accent[cos.accent % COSMETIC.accent.length];
  const suit = mat(su.col, { roughness: 0.7 });
  const suitDk = mat(su.dk, { roughness: 0.8 });
  const accent = mat(ac.col);

  const g = new THREE.Group();
  const mkLimb = (w: number, h: number, m: THREE.Material): THREE.Group => {
    const pivot = new THREE.Group();
    const l = box(w, h, w, m, 0, -h / 2, 0);
    pivot.add(l);
    return pivot;
  };
  const legL = mkLimb(0.16, 0.42, suitDk); legL.position.set(-0.11, 0.42, 0);
  const legR = mkLimb(0.16, 0.42, suitDk); legR.position.set(0.11, 0.42, 0);
  g.add(legL, legR);
  const torso = box(0.44, 0.5, 0.28, suit, 0, 0.68, 0);
  g.add(torso);
  g.add(box(0.34, 0.42, 0.16, accent, 0, 0.7, 0.2));      // sac ventral/accent
  const pack = box(0.36, 0.44, 0.2, suitDk, 0, 0.72, -0.24); // jetpack
  g.add(pack);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), mat("#7de0d8", { emissive: "#38c0ff", emissiveIntensity: 3, transparent: true, opacity: 0.85 }));
  flame.rotation.x = Math.PI;
  flame.position.set(0, 0.4, -0.26);
  flame.visible = false;
  g.add(flame);
  const armL = mkLimb(0.13, 0.4, suit); armL.position.set(-0.29, 0.92, 0);
  const armR = mkLimb(0.13, 0.4, suit); armR.position.set(0.29, 0.92, 0);
  g.add(armL, armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), suit);
  head.position.y = 1.13;
  g.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI), mat(vi.col, { emissive: vi.col, emissiveIntensity: 0.5, roughness: 0.15 }));
  visor.position.set(0, 1.14, 0.08);
  g.add(visor);
  return { group: g, legL, legR, armL, armR, jetFlame: flame };
}

/** Anime la marche/jetpack d'un rig d'astronaute (GLB riggé ou procédural). */
export function animAstro(rig: AstroRig, anim: number, moving: boolean, jets: boolean, dt = 0): void {
  if (rig.mixer && rig.walk) {
    const target = moving ? 1.5 : 0;
    rig.walk.timeScale += (target - rig.walk.timeScale) * Math.min(1, dt * 10);
    rig.mixer.update(dt);
  } else if (rig.legL && rig.legR && rig.armL && rig.armR) {
    const sw = moving ? Math.sin(anim * 7) * 0.6 : 0;
    rig.legL.rotation.x = sw;
    rig.legR.rotation.x = -sw;
    rig.armL.rotation.x = -sw * 0.8;
    rig.armR.rotation.x = sw * 0.8;
  }
  rig.jetFlame.visible = jets;
  if (jets) rig.jetFlame.scale.y = 0.8 + Math.random() * 0.5;
}

/* ---------- catalogue chargé ---------- */

export class Props {
  drill!: THREE.Object3D;
  rocket!: THREE.Object3D;
  robot!: THREE.Object3D;
  crystal!: THREE.Object3D;
  creature!: THREE.Object3D;
  heart!: THREE.Object3D;
  astroScene: THREE.Object3D | null = null;
  astroClips: THREE.AnimationClip[] = [];
  usedGLB: Record<string, boolean> = {};

  async load(): Promise<void> {
    const base = "assets/models/";
    /* foreuse : le GLB généré a le nez vers -X ; on le tourne pour que le nez
     * pointe -Z (convention du jeu : « avant » = direction de la caméra) */
    const [drill, rocket, robot, crystal, creature] = await Promise.all([
      loadGLB(base + "foreuse.glb", 1.9, -Math.PI / 2),
      loadGLB(base + "fusee.glb", 11),
      loadGLB(base + "robot.glb", 1.1),
      loadGLB(base + "cristal.glb", 1.3),
      loadGLB(base + "rampant.glb", 0.9)
    ]);
    await this.loadAstro(base + "astronaute.glb");
    this.usedGLB = { drill: !!drill, rocket: !!rocket, robot: !!robot, crystal: !!crystal, creature: !!creature, astro: !!this.astroScene };
    this.drill = drill ?? fallbackDrill();
    this.rocket = rocket ?? fallbackRocket();
    this.robot = robot ?? fallbackRobot();
    this.crystal = crystal ?? fallbackCrystal();
    this.creature = creature ?? fallbackCreature();
    this.heart = fallbackHeart();
  }

  /** Astronaute stylisé riggé (marche embarquée) — garde animations + squelette. */
  private async loadAstro(url: string): Promise<void> {
    try {
      const gltf = await loader.loadAsync(url);
      const scene = gltf.scene;
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = 1.5 / Math.max(0.001, size.y);   // ~1.5 m de haut (chibi)
      scene.scale.setScalar(s);
      box.setFromObject(scene);
      const center = new THREE.Vector3();
      box.getCenter(center);
      scene.position.set(-center.x, -box.min.y, -center.z);
      this.astroScene = scene;
      this.astroClips = gltf.animations ?? [];
    } catch {
      this.astroScene = null;
    }
  }

  /** Rig d'astronaute : GLB stylisé (teinté par le vestiaire) ou repli procédural. */
  makeAstro(cos: Cosmetic): AstroRig {
    if (!this.astroScene) return makeAstronaut(cos);
    const wrap = new THREE.Group();
    const inst = skeletonClone(this.astroScene);
    /* teinte du vestiaire : lerp doux vers la couleur de combinaison */
    const su = COSMETIC.suit[cos.suit % COSMETIC.suit.length];
    const tint = new THREE.Color(su.col);
    inst.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mm = (m.material as THREE.MeshStandardMaterial).clone();
        if (mm.color) mm.color.lerp(tint, 0.28);
        m.material = mm;
      }
    });
    wrap.add(inst);
    const rig: AstroRig = { group: wrap, legL: null, legR: null, armL: null, armR: null, jetFlame: fallbackJetFlame(wrap) };
    if (this.astroClips.length) {
      rig.mixer = new THREE.AnimationMixer(inst);
      const clip = this.astroClips.find(c => /walk/i.test(c.name)) ?? this.astroClips[0];
      rig.walk = rig.mixer.clipAction(clip);
      rig.walk.play();
      rig.walk.timeScale = 0;
    }
    return rig;
  }

  makeDrill(): THREE.Object3D { return this.drill.clone(true); }
  makeRocket(): THREE.Object3D { return this.rocket.clone(true); }
  makeRobot(): THREE.Object3D { return this.robot.clone(true); }
  makeCrystal(): THREE.Object3D { return this.crystal.clone(true); }
  makeHeart(): THREE.Object3D { return this.heart.clone(true); }
  /** Créature teintée par type (rampant violet / traqueur rouge / cracheur vert). */
  makeCreature(type: string): THREE.Object3D {
    const o = this.creature.clone(true);
    const tints: Record<string, number> = { rampant: 0xffffff, traqueur: 0xff5c85, cracheur: 0x7dff8a };
    const tint = new THREE.Color(tints[type] ?? 0xffffff);
    if (type !== "rampant") {
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const m2 = (mesh.material as THREE.MeshStandardMaterial).clone();
          m2.color.lerp(tint, 0.55);
          if (m2.emissive) m2.emissive.lerp(tint, 0.4);
          mesh.material = m2;
        }
      });
    }
    return o;
  }
}
