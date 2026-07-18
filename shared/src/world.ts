/* ASTRO·FORAGE 3D — génération et accès au monde voxel.
 * Transposition 3D de js/world.js : mêmes strates, mêmes bandes de profondeur,
 * mêmes duretés ; les densités 2D (minerai par tuile) sont converties en
 * densités volumiques pour que « creuser un tunnel » rencontre autant de
 * ressources que dans l'original. Génération 100 % déterministe par seed. */

import { mulberry32, type Rng } from "./rng.js";
import { W, H0, H2, SURF, ORE, isRockId, ROCK_POS } from "./data.js";
import type { Nest, SharedState } from "./types.js";

export const CRUST_END = 178; // croûte abyssale (dureté 5) puis roche du noyau (dureté 7)

export function idx(x: number, z: number, d: number): number {
  return (d * W + z) * W + x;
}

export function tile(S: { grid: Uint8Array; worldH: number }, x: number, z: number, d: number): number {
  if (d < 0) return 0;                     // au-dessus du monde : ciel libre
  if (x < 0 || x >= W || z < 0 || z >= W || d >= S.worldH) return 9;
  return S.grid[idx(x, z, d)];
}

/** Écrit un voxel et journalise l'édition (pour snapshots/persistance). */
export function setTile(S: { grid: Uint8Array; worldH: number; edits: number[] }, x: number, z: number, d: number, v: number): void {
  if (x < 1 || x >= W - 1 || z < 1 || z >= W - 1 || d < 0 || d >= S.worldH - 1) return;
  const i = idx(x, z, d);
  if (S.grid[i] === v) return;
  S.grid[i] = v;
  S.edits.push(x, z, d, v);
}

/* ---- conversions monde (mètres) <-> voxels ---- */
export const VOX = 2; // arête en mètres
export function voxOfX(mx: number): number { return Math.floor(mx / VOX); }
export function voxOfY(my: number): number { return SURF - 1 - Math.floor(my / VOX); } // rangée d
export function yOfVox(d: number): number { return (SURF - 1 - d) * VOX; }            // Y du BAS du voxel... voir note

/* Note de repère vertical : la rangée d occupe les Y-monde
 * [ (SURF-1-d)*2 ; (SURF-d)*2 ). La rangée d=SURF est le premier sol :
 * son sommet est à Y=0. Un point à Y=-0.1 est dans la rangée SURF. */
export function rowOfY(my: number): number { return SURF - 1 - Math.floor(my / VOX); }
export function topYOfRow(d: number): number { return (SURF - d) * VOX; }

/** Ids traversables : air, cristal (prop au sol) et Cœur (artefact). */
export const isPassableId = (id: number): boolean => id === 0 || id === 8 || id === 31;

/** Le voxel contenant le point-monde (mx,my,mz) est-il solide ? */
export function solidAt(S: { grid: Uint8Array; worldH: number }, mx: number, my: number, mz: number): boolean {
  return !isPassableId(tile(S, Math.floor(mx / VOX), Math.floor(mz / VOX), rowOfY(my)));
}

/** Profondeur en mètres d'un Y-monde (0 en surface). */
export function depthM(my: number): number { return Math.max(0, -my); }

/* ---- génération ---- */

function carveSphere(grid: Uint8Array, worldH: number, cx: number, cz: number, cd: number, r: number, dMin: number): void {
  const r2 = r * r + 0.3;
  for (let d = Math.max(dMin, cd - r); d <= Math.min(worldH - 3, cd + r); d++) {
    for (let z = Math.max(1, cz - r); z <= Math.min(W - 2, cz + r); z++) {
      for (let x = Math.max(1, cx - r); x <= Math.min(W - 2, cx + r); x++) {
        const dx = x - cx, dz = z - cz, dd = d - cd;
        if (dx * dx + dz * dz + dd * dd <= r2) {
          const i = idx(x, z, d);
          if (grid[i] !== 9) grid[i] = 0;
        }
      }
    }
  }
}

/* Densités surfaciques du jeu 2D (count × taille moyenne / aire de la bande),
 * réappliquées au volume 3D — voir docs/GDD.md §2. */
interface VeinBand { res: string; d0: number; d1: number; density: number; smin: number; smax: number }
const VEINS_ACT1: VeinBand[] = [
  { res: "charbon", d0: 2, d1: 45, density: 0.112, smin: 4, smax: 9 },
  { res: "fer", d0: 2, d1: 70, density: 0.085, smin: 4, smax: 9 },
  { res: "cuivre", d0: 4, d1: 58, density: 0.064, smin: 4, smax: 8 },
  { res: "quartz", d0: 22, d1: 95, density: 0.029, smin: 3, smax: 7 },
  { res: "glace", d0: 16, d1: 88, density: 0.025, smin: 3, smax: 7 },
  { res: "titane", d0: 55, d1: 132, density: 0.025, smin: 3, smax: 7 },
  { res: "uranium", d0: 85, d1: 140, density: 0.018, smin: 2, smax: 6 },
  { res: "lava", d0: 45, d1: 138, density: 0.019, smin: 2, smax: 6 }
];

function digVeins(R: Rng, grid: Uint8Array, worldH: number, bands: VeinBand[]): void {
  for (const b of bands) {
    const isLava = b.res === "lava";
    const oid = isLava ? 6 : ORE[b.res];
    const bandVol = (W - 2) * (W - 2) * Math.max(1, b.d1 - b.d0);
    let quota = Math.floor(bandVol * b.density);
    let guard = 0;
    while (quota > 0 && guard < 2e6) {
      let x = 2 + Math.floor(R() * (W - 4));
      let z = 2 + Math.floor(R() * (W - 4));
      let d = SURF + b.d0 + Math.floor(R() * Math.max(1, b.d1 - b.d0));
      const size = b.smin + Math.floor(R() * (b.smax - b.smin + 1));
      for (let i = 0; i < size; i++) {
        guard++;
        if (x > 1 && x < W - 2 && z > 1 && z < W - 2 && d > SURF + 1 && d < worldH - 3) {
          const cur = grid[idx(x, z, d)];
          if (isRockId(cur)) { grid[idx(x, z, d)] = oid; quota--; }
        }
        const roll = R();
        if (roll < 0.33) x += R() < 0.5 ? -1 : 1;
        else if (roll < 0.66) z += R() < 0.5 ? -1 : 1;
        else d += R() < 0.5 ? -1 : 1;
        x = Math.max(2, Math.min(W - 3, x));
        z = Math.max(2, Math.min(W - 3, z));
        d = Math.max(SURF + 2, Math.min(worldH - 4, d));
      }
    }
  }
}

export interface GenResult { grid: Uint8Array; nests: Nest[] }

/** Génère le monde de l'Acte I (worldH = H0), déterministe par seed. */
export function genWorld(seed: number): GenResult {
  const worldH = H0;
  const R = mulberry32(seed);
  const grid = new Uint8Array(W * W * worldH);

  /* strates */
  for (let d = SURF; d < worldH; d++) {
    const dep = d - SURF;
    let id = dep < 15 ? 1 : dep < 40 ? 2 : dep < 80 ? 3 : dep < 120 ? 4 : 5;
    if (d >= worldH - 2) id = 9;
    for (let z = 0; z < W; z++) {
      for (let x = 0; x < W; x++) {
        grid[idx(x, z, d)] = (x === 0 || x === W - 1 || z === 0 || z === W - 1) ? 9 : id;
      }
    }
  }

  /* cavernes : vers 3D (marche aléatoire volumique) */
  for (let c = 0; c < 210; c++) {
    let x = 3 + Math.floor(R() * (W - 6));
    let z = 3 + Math.floor(R() * (W - 6));
    let d = SURF + 6 + Math.floor(R() * (worldH - SURF - 22));
    const len = 9 + Math.floor(R() * 20);
    const fat = R() < 0.25 ? 2 : 1;
    for (let i = 0; i < len; i++) {
      if (d > SURF + 3 && d < worldH - 4) carveSphere(grid, worldH, x, z, d, fat, SURF + 4);
      const dir = R();
      if (dir < 0.26) x += R() < 0.5 ? -1 : 1;
      else if (dir < 0.52) z += R() < 0.5 ? -1 : 1;
      else if (dir < 0.74) d += 1;
      else if (dir < 0.88) d -= 1;
      else { x += R() < 0.5 ? -1 : 1; d += 1; }
      x = Math.max(3, Math.min(W - 4, x));
      z = Math.max(3, Math.min(W - 4, z));
      d = Math.max(SURF + 4, Math.min(worldH - 5, d));
    }
  }

  /* filons + lave */
  digVeins(R, grid, worldH, VEINS_ACT1);

  /* poches de gaz isolées (même densité surfacique que l'original : 0.3 %) */
  {
    const bandVol = (W - 2) * (W - 2) * (worldH - SURF - 40);
    let quota = Math.floor(bandVol * 0.003);
    let guard = 0;
    while (quota > 0 && guard++ < 1e6) {
      const x = 2 + Math.floor(R() * (W - 4));
      const z = 2 + Math.floor(R() * (W - 4));
      const d = SURF + 35 + Math.floor(R() * (worldH - SURF - 40));
      const i = idx(x, z, d);
      if (isRockId(grid[i])) { grid[i] = 7; quota--; }
    }
  }

  /* cristaux : posés au sol des cavernes (récolte à pied uniquement) */
  let placedC = 0, guard = 0;
  while (placedC < 90 && guard < 60000) {
    guard++;
    const x = 3 + Math.floor(R() * (W - 6));
    const z = 3 + Math.floor(R() * (W - 6));
    const d = SURF + 22 + Math.floor(R() * (worldH - SURF - 32));
    if (grid[idx(x, z, d)] === 0 && isRockId(grid[idx(x, z, d + 1)])) {
      grid[idx(x, z, d)] = 8;
      placedC++;
    }
  }

  /* le Cœur de Kepler : chambre 3×3×3 tout au fond */
  {
    const hx = 6 + Math.floor(R() * (W - 12));
    const hz = 6 + Math.floor(R() * (W - 12));
    const hd = worldH - 9;
    for (let d = hd - 1; d <= hd + 1; d++)
      for (let z = hz - 1; z <= hz + 1; z++)
        for (let x = hx - 1; x <= hx + 1; x++)
          if (grid[idx(x, z, d)] !== 9) grid[idx(x, z, d)] = 0;
    if (grid[idx(hx, hz, hd + 2)] === 0) grid[idx(hx, hz, hd + 2)] = 5;
    grid[idx(hx, hz, hd + 1)] = 31;
  }

  /* nids : 3 mini-boss tapis dans des cavernes profondes */
  const nests: Nest[] = [];
  let placedN = 0, guardN = 0;
  while (placedN < 3 && guardN < 60000) {
    guardN++;
    const x = 5 + Math.floor(R() * (W - 10));
    const z = 5 + Math.floor(R() * (W - 10));
    const d = SURF + 80 + Math.floor(R() * (worldH - SURF - 95));
    if (!isRockId(grid[idx(x, z, d)])) continue;
    let clash = false;
    for (const n of nests) {
      if (Math.abs(n.x / VOX - x) < 14 && Math.abs(n.z / VOX - z) < 14) clash = true;
    }
    if (clash) continue;
    carveSphere(grid, worldH, x, z, d, 2, SURF + 6);
    carveSphere(grid, worldH, x, z, d - 1, 2, SURF + 6);
    nests.push({
      x: (x + 0.5) * VOX, z: (z + 0.5) * VOX, y: topYOfRow(d) + 0.6,
      hp: 130, max: 130, ph: R() * 6.28, spawnT: 2, hit: 0, awake: false
    });
    placedN++;
  }

  /* surface garantie solide et sans danger */
  for (let z = 1; z < W - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      for (let d = SURF; d <= SURF + 1; d++) {
        const i = idx(x, z, d);
        if (grid[i] === 0 || grid[i] === 6 || grid[i] === 7 || grid[i] === 8) grid[i] = 1;
      }
    }
  }

  /* relief : ondulations douces (0..2 voxels de régolithe) HORS de la zone de
   * base, qui reste parfaitement plate pour la construction. Le jetpack sert
   * à grimper — comme dans l'original. Déterministe par seed. */
  {
    const Rh = mulberry32((seed ^ 0x51ab7e) | 0);
    const gsz = 10; // taille de cellule du bruit de valeur
    const gn = Math.ceil(W / gsz) + 2;
    const lattice = new Float32Array(gn * gn);
    for (let i = 0; i < lattice.length; i++) lattice[i] = Rh();
    const val = (x: number, z: number): number => {
      const gx = x / gsz, gz = z / gsz;
      const x0 = Math.floor(gx), z0 = Math.floor(gz);
      const fx = gx - x0, fz = gz - z0;
      const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
      const a = lattice[z0 * gn + x0], b = lattice[z0 * gn + x0 + 1];
      const c = lattice[(z0 + 1) * gn + x0], d2 = lattice[(z0 + 1) * gn + x0 + 1];
      return a + (b - a) * sx + (c - a) * sz + (a - b - c + d2) * sx * sz;
    };
    for (let z = 1; z < W - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const dRock = Math.hypot(x + 0.5 - (ROCK_POS.x + 0.5), z + 0.5 - (ROCK_POS.z + 0.5));
        if (dRock < FLAT_R) continue;
        const n = val(x, z);
        /* fondu en bordure de zone plate pour éviter une falaise */
        const edge = Math.min(1, (dRock - FLAT_R) / 6);
        const h = n > 0.82 ? 2 : n > 0.58 ? 1 : 0;
        const hh = Math.min(h, edge >= 1 ? 2 : 1);
        for (let k = 1; k <= hh; k++) {
          const d3 = SURF - k;
          if (d3 >= 1) grid[idx(x, z, d3)] = 1;
        }
      }
    }
  }

  return { grid, nests };
}

/** Rayon (voxels, depuis la fusée) de la zone de base parfaitement plate. */
export const FLAT_R = 32;

/** Y-monde du sommet solide d'une colonne de surface (pose des débris, props). */
export function surfaceTopY(S: { grid: Uint8Array; worldH: number }, vx: number, vz: number): number {
  for (let d = SURF - 2; d <= SURF + 2; d++) {
    if (!isPassableId(tile(S, vx, vz, d))) return topYOfRow(d);
  }
  return 0;
}

/* ---- Acte II : le crash fissure le socle et ouvre les abysses ---- */
const VEINS_ACT2: VeinBand[] = [
  { res: "magmatite", d0: 118, d1: H0 - SURF - 2, density: 0.02, smin: 3, smax: 7 },   // remontée
  { res: "magmatite", d0: H0 - SURF - 2, d1: CRUST_END - SURF - 2, density: 0.058, smin: 3, smax: 8 },
  { res: "iridium", d0: CRUST_END - SURF, d1: H2 - SURF - 5, density: 0.05, smin: 3, smax: 7 },
  { res: "uranium", d0: H0 - SURF, d1: H2 - SURF - 6, density: 0.012, smin: 2, smax: 6 },
  { res: "lava", d0: H0 - SURF, d1: H2 - SURF - 5, density: 0.028, smin: 2, smax: 6 }
];

/** Étend le monde vers le bas (Acte II), déterministe (seed dérivée). */
export function deepenWorld(S: SharedState): void {
  if (S.worldH >= H2) return;
  const R = mulberry32((S.seed ^ 0x9e3779b9) | 0);
  const ng = new Uint8Array(W * W * H2);
  ng.set(S.grid.subarray(0, W * W * H0));

  /* l'ancien socle vole en éclats, remplacé par la croûte */
  for (let d = H0 - 2; d < H0; d++)
    for (let z = 1; z < W - 1; z++)
      for (let x = 1; x < W - 1; x++) ng[idx(x, z, d)] = 32;

  /* nouvelles strates */
  for (let d = H0; d < H2; d++) {
    const id = d >= H2 - 2 ? 9 : d < CRUST_END ? 32 : 33;
    for (let z = 0; z < W; z++)
      for (let x = 0; x < W; x++)
        ng[idx(x, z, d)] = (x === 0 || x === W - 1 || z === 0 || z === W - 1) ? 9 : id;
  }

  /* cavernes abyssales */
  for (let c = 0; c < 130; c++) {
    let x = 3 + Math.floor(R() * (W - 6));
    let z = 3 + Math.floor(R() * (W - 6));
    let d = H0 + 2 + Math.floor(R() * (H2 - H0 - 8));
    const len = 8 + Math.floor(R() * 16);
    for (let i = 0; i < len; i++) {
      if (d > H0 - 5 && d < H2 - 4) carveSphere(ng, H2, x, z, d, 1, H0 - 6);
      const dir = R();
      if (dir < 0.26) x += R() < 0.5 ? -1 : 1;
      else if (dir < 0.52) z += R() < 0.5 ? -1 : 1;
      else if (dir < 0.74) d += 1;
      else d -= 1;
      x = Math.max(3, Math.min(W - 4, x));
      z = Math.max(3, Math.min(W - 4, z));
      d = Math.max(H0 - 6, Math.min(H2 - 5, d));
    }
  }

  digVeins(R, ng, H2, VEINS_ACT2);

  /* poches de gaz abyssales */
  let quota = 500, guard = 0;
  while (quota > 0 && guard++ < 2e5) {
    const x = 2 + Math.floor(R() * (W - 4));
    const z = 2 + Math.floor(R() * (W - 4));
    const d = H0 + Math.floor(R() * (H2 - H0 - 6));
    const i = idx(x, z, d);
    if (ng[i] === 32 || ng[i] === 33) { ng[i] = 7; quota -= 8; }
  }

  S.grid = ng;
  S.worldH = H2;
  /* rejoue les éditions déjà faites (galeries creusées avant l'Acte II) */
  for (let i = 0; i + 3 < S.edits.length; i += 4) {
    const x = S.edits[i], z = S.edits[i + 1], d = S.edits[i + 2], v = S.edits[i + 3];
    if (d < H2 - 1) S.grid[idx(x, z, d)] = v;
  }
}

/* ---- secousses sismiques : régénération de filons dans la roche pleine ---- */
const QUAKE_PICKS: Array<[string, number]> = [["fer", 0.30], ["charbon", 0.22], ["cuivre", 0.16], ["quartz", 0.10], ["glace", 0.10], ["titane", 0.07], ["uranium", 0.05]];
const QUAKE_PICKS2: Array<[string, number]> = [["fer", 0.24], ["charbon", 0.17], ["cuivre", 0.12], ["quartz", 0.08], ["glace", 0.08], ["titane", 0.07], ["uranium", 0.06], ["magmatite", 0.10], ["iridium", 0.08]];

/** 5 tentatives de nouveaux filons (autorité : sim). Retourne le nombre créés. */
export function seismicVeins(S: SharedState, rand: () => number = Math.random): number {
  const picks = S.act >= 2 ? QUAKE_PICKS2 : QUAKE_PICKS;
  let made = 0;
  for (let v = 0; v < 5; v++) {
    let roll = rand(), res = "fer", acc = 0;
    for (const p of picks) { acc += p[1]; if (roll <= acc) { res = p[0]; break; } }
    const oid = ORE[res];
    const dmin = res === "iridium" ? 170 : res === "magmatite" ? 110 : res === "uranium" ? 85 : res === "titane" ? 55 : 3;
    const dmax = res === "iridium" ? (S.worldH - SURF - 6) : res === "magmatite" ? Math.min(168, S.worldH - SURF - 6) : res === "uranium" ? (S.worldH - SURF - 6) : res === "titane" ? (S.worldH - SURF - 8) : 98;
    let x = 0, z = 0, d = 0, ok = false;
    for (let t = 0; t < 120 && !ok; t++) {
      x = 2 + Math.floor(rand() * (W - 4));
      z = 2 + Math.floor(rand() * (W - 4));
      d = SURF + dmin + Math.floor(rand() * Math.max(1, dmax - dmin));
      if (isRockId(tile(S, x, z, d))) ok = true;
    }
    if (!ok) continue;
    const size = 4 + Math.floor(rand() * 8);
    for (let i = 0; i < size; i++) {
      if (isRockId(tile(S, x, z, d))) setTile(S, x, z, d, oid);
      const r2 = rand();
      if (r2 < 0.33) x += rand() < 0.5 ? -1 : 1;
      else if (r2 < 0.66) z += rand() < 0.5 ? -1 : 1;
      else d += rand() < 0.5 ? -1 : 1;
      x = Math.max(2, Math.min(W - 3, x));
      z = Math.max(2, Math.min(W - 3, z));
      d = Math.max(SURF + 3, Math.min(S.worldH - 4, d));
    }
    made++;
  }
  return made;
}
