/* Physique voxel : balayage AABB par axe (comme collideMove de l'original,
 * généralisé en 3 axes) + raycast DDA pour le forage/interactions. */
import { W, SURF, tile, isPassableId, rowOfY } from "@astroforage/shared";

const VOX = 2;

export interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number }
interface GridRef { grid: Uint8Array; worldH: number }

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
  let nx = E.x + E.vx * dt;
  if (E.vx !== 0) {
    const lead = nx + Math.sign(E.vx) * hx;
    if (solidBox(S, E.vx > 0 ? lead - 0.001 : lead, E.y - hy + eps, E.z - hz + eps, E.vx > 0 ? lead : lead + 0.001, E.y + hy - eps, E.z + hz - eps)) {
      const cell = Math.floor(lead / VOX);
      nx = E.vx > 0 ? cell * VOX - hx - 0.001 : (cell + 1) * VOX + hx + 0.001;
      E.vx = 0;
      r.hitWall = true;
    }
  }
  E.x = Math.max(VOX + hx + 0.01, Math.min((W - 1) * VOX - hx - 0.01, nx));

  /* Z */
  let nz = E.z + E.vz * dt;
  if (E.vz !== 0) {
    const lead = nz + Math.sign(E.vz) * hz;
    if (solidBox(S, E.x - hx + eps, E.y - hy + eps, E.vz > 0 ? lead - 0.001 : lead, E.x + hx - eps, E.y + hy - eps, E.vz > 0 ? lead : lead + 0.001)) {
      const cell = Math.floor(lead / VOX);
      nz = E.vz > 0 ? cell * VOX - hz - 0.001 : (cell + 1) * VOX + hz + 0.001;
      E.vz = 0;
      r.hitWall = true;
    }
  }
  E.z = Math.max(VOX + hz + 0.01, Math.min((W - 1) * VOX - hz - 0.01, nz));

  /* Y */
  let ny = E.y + E.vy * dt;
  if (E.vy < 0) {
    const lead = ny - hy;
    if (solidBox(S, E.x - hx + eps, lead, E.z - hz + eps, E.x + hx - eps, lead + 0.001, E.z + hz - eps)) {
      const cell = Math.floor(lead / VOX);
      ny = (cell + 1) * VOX + hy + 0.001;
      r.landV = -E.vy;
      E.vy = 0;
      r.grounded = true;
    }
  } else if (E.vy > 0) {
    const lead = ny + hy;
    if (solidBox(S, E.x - hx + eps, lead - 0.001, E.z - hz + eps, E.x + hx - eps, lead, E.z + hz - eps)) {
      const cell = Math.floor(lead / VOX);
      ny = cell * VOX - hy - 0.001;
      E.vy = 0;
      r.hitHead = true;
    }
  }
  E.y = ny;
  /* au sol si un solide affleure juste sous les pieds */
  if (!r.grounded && E.vy >= -0.01) {
    if (solidBox(S, E.x - hx + eps, E.y - hy - 0.06, E.z - hz + eps, E.x + hx - eps, E.y - hy - 0.02, E.z + hz - eps)) r.grounded = true;
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
