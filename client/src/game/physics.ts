/* Physique voxel : balayage AABB par axe (comme collideMove de l'original,
 * généralisé en 3 axes) + raycast DDA pour le forage/interactions. */
import { W, SURF, tile, isPassableId, rowOfY } from "@astroforage/shared";

const VOX = 2;

export interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number }
interface GridRef { grid: Uint8Array; worldH: number }

/** Boîte de collision statique (bâtiment, fusée, foreuse garée). */
export interface StaticBox { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
let statics: StaticBox[] = [];
/** Liste rebâtie chaque frame par le jeu (bâtiments posés/détruits, etc.). */
export function setStaticBoxes(list: StaticBox[]): void { statics = list; }

function solidBox(S: GridRef, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
  const vx0 = Math.floor(x0 / VOX), vx1 = Math.floor(x1 / VOX);
  const vz0 = Math.floor(z0 / VOX), vz1 = Math.floor(z1 / VOX);
  const d0 = rowOfY(y1), d1 = rowOfY(y0); // y1 haut -> d petit
  for (let d = d0; d <= d1; d++)
    for (let vz = vz0; vz <= vz1; vz++)
      for (let vx = vx0; vx <= vx1; vx++)
        if (!isPassableId(tile(S, vx, vz, d))) return true;
  return false;
}

export interface MoveResult { grounded: boolean; landV: number; hitHead: boolean; hitWall: boolean }

/** Déplace un AABB (demi-tailles hx/hy/hz) avec collision voxel par axe. */
export function moveAABB(S: GridRef, E: Body, hx: number, hy: number, hz: number, dt: number): MoveResult {
  const eps = 0.02;
  const r: MoveResult = { grounded: false, landV: 0, hitHead: false, hitWall: false };

  /* X */
  const mvx = E.vx;
  let nx = E.x + mvx * dt;
  if (mvx !== 0) {
    const lead = nx + Math.sign(mvx) * hx;
    if (solidBox(S, mvx > 0 ? lead - 0.001 : lead, E.y - hy + eps, E.z - hz + eps, mvx > 0 ? lead : lead + 0.001, E.y + hy - eps, E.z + hz - eps)) {
      const cell = Math.floor(lead / VOX);
      nx = mvx > 0 ? cell * VOX - hx - 0.001 : (cell + 1) * VOX + hx + 0.001;
      E.vx = 0;
      r.hitWall = true;
    }
    /* boîtes statiques : on bloque en franchissant la face (jamais piégé si
     * déjà en chevauchement — on peut toujours ressortir) */
    for (const B of statics) {
      if (E.y - hy + eps < B.y1 && E.y + hy - eps > B.y0 && E.z - hz + eps < B.z1 && E.z + hz - eps > B.z0) {
        if (mvx > 0 && E.x + hx <= B.x0 + 0.01 && nx + hx > B.x0) { nx = B.x0 - hx - 0.001; E.vx = 0; r.hitWall = true; }
        else if (mvx < 0 && E.x - hx >= B.x1 - 0.01 && nx - hx < B.x1) { nx = B.x1 + hx + 0.001; E.vx = 0; r.hitWall = true; }
      }
    }
  }
  E.x = Math.max(VOX + hx + 0.01, Math.min((W - 1) * VOX - hx - 0.01, nx));

  /* Z */
  const mvz = E.vz;
  let nz = E.z + mvz * dt;
  if (mvz !== 0) {
    const lead = nz + Math.sign(mvz) * hz;
    if (solidBox(S, E.x - hx + eps, E.y - hy + eps, mvz > 0 ? lead - 0.001 : lead, E.x + hx - eps, E.y + hy - eps, mvz > 0 ? lead : lead + 0.001)) {
      const cell = Math.floor(lead / VOX);
      nz = mvz > 0 ? cell * VOX - hz - 0.001 : (cell + 1) * VOX + hz + 0.001;
      E.vz = 0;
      r.hitWall = true;
    }
    for (const B of statics) {
      if (E.y - hy + eps < B.y1 && E.y + hy - eps > B.y0 && E.x - hx + eps < B.x1 && E.x + hx - eps > B.x0) {
        if (mvz > 0 && E.z + hz <= B.z0 + 0.01 && nz + hz > B.z0) { nz = B.z0 - hz - 0.001; E.vz = 0; r.hitWall = true; }
        else if (mvz < 0 && E.z - hz >= B.z1 - 0.01 && nz - hz < B.z1) { nz = B.z1 + hz + 0.001; E.vz = 0; r.hitWall = true; }
      }
    }
  }
  E.z = Math.max(VOX + hz + 0.01, Math.min((W - 1) * VOX - hz - 0.01, nz));

  /* Y */
  const mvy = E.vy;
  let ny = E.y + mvy * dt;
  if (mvy < 0) {
    const lead = ny - hy;
    if (solidBox(S, E.x - hx + eps, lead, E.z - hz + eps, E.x + hx - eps, lead + 0.001, E.z + hz - eps)) {
      const cell = Math.floor(lead / VOX);
      ny = (cell + 1) * VOX + hy + 0.001;
      r.landV = -mvy;
      E.vy = 0;
      r.grounded = true;
    }
  } else if (mvy > 0) {
    const lead = ny + hy;
    if (solidBox(S, E.x - hx + eps, lead - 0.001, E.z - hz + eps, E.x + hx - eps, lead, E.z + hz - eps)) {
      const cell = Math.floor(lead / VOX);
      ny = cell * VOX - hy - 0.001;
      E.vy = 0;
      r.hitHead = true;
    }
  }
  /* boîtes statiques : atterrir dessus / se cogner dessous */
  if (mvy !== 0) {
    for (const B of statics) {
      if (E.x - hx + eps < B.x1 && E.x + hx - eps > B.x0 && E.z - hz + eps < B.z1 && E.z + hz - eps > B.z0) {
        if (mvy < 0 && E.y - hy >= B.y1 - 0.01 && ny - hy < B.y1) {
          ny = B.y1 + hy + 0.001; r.landV = Math.max(r.landV, -mvy); E.vy = 0; r.grounded = true;
        } else if (mvy > 0 && E.y + hy <= B.y0 + 0.01 && ny + hy > B.y0) {
          ny = B.y0 - hy - 0.001; E.vy = 0; r.hitHead = true;
        }
      }
    }
  }
  E.y = ny;
  /* au sol si un solide affleure juste sous les pieds */
  if (!r.grounded && E.vy >= -0.01) {
    if (solidBox(S, E.x - hx + eps, E.y - hy - 0.06, E.z - hz + eps, E.x + hx - eps, E.y - hy - 0.02, E.z + hz - eps)) r.grounded = true;
    else {
      for (const B of statics) {
        if (E.x - hx + eps < B.x1 && E.x + hx - eps > B.x0 && E.z - hz + eps < B.z1 && E.z + hz - eps > B.z0
            && E.y - hy - 0.06 < B.y1 && E.y - hy - 0.02 > B.y0) { r.grounded = true; break; }
      }
    }
  }
  return r;
}

/** Le corps touche-t-il de la lave (avec marge) ? */
export function touchesLava(S: GridRef, E: Body, hx: number, hy: number, hz: number): boolean {
  const m = 0.24;
  const vx0 = Math.floor((E.x - hx - m) / VOX), vx1 = Math.floor((E.x + hx + m) / VOX);
  const vz0 = Math.floor((E.z - hz - m) / VOX), vz1 = Math.floor((E.z + hz + m) / VOX);
  const d0 = rowOfY(E.y + hy + m), d1 = rowOfY(E.y - hy - m);
  for (let d = d0; d <= d1; d++)
    for (let vz = vz0; vz <= vz1; vz++)
      for (let vx = vx0; vx <= vx1; vx++)
        if (tile(S, vx, vz, d) === 6) return true;
  return false;
}

export interface RayHit {
  x: number; z: number; d: number;   // voxel touché
  id: number;
  dist: number;
  face: [number, number, number];    // normale de la face touchée (monde)
  px: number; py: number; pz: number; // point d'impact
}

/** Raycast DDA dans la grille voxel. hitProps : les cristaux/Cœur arrêtent le rayon. */
export function raycastVoxel(
  S: GridRef,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number, hitProps: boolean
): RayHit | null {
  let vx = Math.floor(ox / VOX), vz = Math.floor(oz / VOX), d = rowOfY(oy);
  const stepX = Math.sign(dx), stepZ = Math.sign(dz), stepD = -Math.sign(dy); // d augmente vers le bas
  const tDeltaX = dx !== 0 ? Math.abs(VOX / dx) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(VOX / dz) : Infinity;
  const tDeltaD = dy !== 0 ? Math.abs(VOX / dy) : Infinity;
  const bx = vx * VOX, bz = vz * VOX;
  const byTop = (SURF - d) * VOX; // Y du plafond du voxel courant
  let tMaxX = dx > 0 ? (bx + VOX - ox) / dx : dx < 0 ? (bx - ox) / dx : Infinity;
  let tMaxZ = dz > 0 ? (bz + VOX - oz) / dz : dz < 0 ? (bz - oz) / dz : Infinity;
  let tMaxD = dy > 0 ? (byTop - oy) / dy : dy < 0 ? (byTop - VOX - oy) / dy : Infinity;
  let t = 0;
  let face: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 64; i++) {
    const id = tile(S, vx, vz, d);
    const solidHit = !isPassableId(id);
    const propHit = hitProps && (id === 8 || id === 31);
    if ((solidHit || propHit) && t > 0) {
      return { x: vx, z: vz, d, id, dist: t, face, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t };
    }
    if (tMaxX < tMaxZ && tMaxX < tMaxD) {
      vx += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0];
    } else if (tMaxZ < tMaxD) {
      vz += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ];
    } else {
      d += stepD; t = tMaxD; tMaxD += tDeltaD; face = [0, stepD > 0 ? 1 : -1, 0];
    }
    if (t > maxDist) return null;
    if (d >= S.worldH) return null;
    /* d<0 (ciel) et x/z hors carte sont gérés par tile() : air ou socle */
  }
  return null;
}
