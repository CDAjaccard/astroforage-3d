/* Atlas de textures voxel 100 % procédural (canvas), palette du jeu original.
 * 8×4 cases de 64 px. Chaque id de voxel pointe vers une case (les minerais :
 * roche hôte + éclats colorés lumineux). */
import * as THREE from "three";
import { T, ORE } from "@astroforage/shared";

export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
const CELL = 64;

/** id voxel -> index de case dans l'atlas */
export const TILE_SLOT: Record<number, number> = {};

function hashNoise(x: number, y: number, s: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawRock(ctx: CanvasRenderingContext2D, ox: number, oy: number, base: string, dark: string, seed: number): void {
  ctx.fillStyle = base;
  ctx.fillRect(ox, oy, CELL, CELL);
  /* grain */
  for (let y = 0; y < CELL; y += 2) {
    for (let x = 0; x < CELL; x += 2) {
      const n = hashNoise(x, y, seed);
      if (n > 0.62) {
        ctx.fillStyle = dark;
        ctx.globalAlpha = 0.24 + (n - 0.62) * 0.9;
        ctx.fillRect(ox + x, oy + y, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  }
  /* fissures */
  ctx.strokeStyle = dark;
  ctx.globalAlpha = 0.5;
  for (let c = 0; c < 4; c++) {
    ctx.beginPath();
    let x = hashNoise(c, seed, 1) * CELL, y = hashNoise(seed, c, 2) * CELL;
    ctx.moveTo(ox + x, oy + y);
    for (let s = 0; s < 4; s++) {
      x += (hashNoise(c, s, seed) - 0.5) * 22;
      y += (hashNoise(s, c, seed) - 0.5) * 22;
      ctx.lineTo(ox + Math.max(1, Math.min(CELL - 1, x)), oy + Math.max(1, Math.min(CELL - 1, y)));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  /* bord assombri (lecture voxel) */
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(ox + 1, oy + 1, CELL - 2, CELL - 2);
  ctx.lineWidth = 1;
}

function drawOreSpecks(ctx: CanvasRenderingContext2D, ox: number, oy: number, col: string, seed: number, glow = true): void {
  for (let i = 0; i < 9; i++) {
    const x = 8 + hashNoise(i, seed, 3) * (CELL - 16);
    const y = 8 + hashNoise(seed, i, 4) * (CELL - 16);
    const r = 2.5 + hashNoise(i, i, seed) * 3.5;
    if (glow) {
      const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r * 2.4);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.fillRect(ox + x - r * 2.4, oy + y - r * 2.4, r * 4.8, r * 4.8);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    /* petit losange cristallin */
    ctx.moveTo(ox + x, oy + y - r);
    ctx.lineTo(ox + x + r * 0.8, oy + y);
    ctx.lineTo(ox + x, oy + y + r);
    ctx.lineTo(ox + x - r * 0.8, oy + y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(ox + x - 1, oy + y - r * 0.5, 1.5, r * 0.6);
  }
}

export interface AtlasResult {
  texture: THREE.Texture;
  canvas: HTMLCanvasElement;
}

export function buildAtlas(): AtlasResult {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * CELL;
  canvas.height = ATLAS_ROWS * CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let slot = 0;
  const put = (id: number, draw: (ox: number, oy: number) => void): void => {
    const ox = (slot % ATLAS_COLS) * CELL;
    const oy = Math.floor(slot / ATLAS_COLS) * CELL;
    TILE_SLOT[id] = slot;
    draw(ox, oy);
    slot++;
  };

  /* strates 1-5 + socle + abysses */
  for (const id of [1, 2, 3, 4, 5, 9, 32, 33]) {
    const d = T[id];
    put(id, (ox, oy) => drawRock(ctx, ox, oy, d.col, d.col2, id * 7.3));
  }
  /* lave : braises émissives */
  put(6, (ox, oy) => {
    drawRock(ctx, ox, oy, "#7a1f08", "#4a1204", 66);
    for (let i = 0; i < 26; i++) {
      const x = hashNoise(i, 1, 9) * CELL, y = hashNoise(2, i, 9) * CELL;
      const r = 3 + hashNoise(i, 3, 9) * 8;
      const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r);
      g.addColorStop(0, "#ffd23e");
      g.addColorStop(0.5, "#ff7a2d");
      g.addColorStop(1, "rgba(194,52,15,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox + x - r, oy + y - r, r * 2, r * 2);
    }
  });
  /* gaz : roche verdâtre suintante */
  put(7, (ox, oy) => {
    drawRock(ctx, ox, oy, "#4c4a3a", "#3a382a", 77);
    for (let i = 0; i < 12; i++) {
      const x = hashNoise(i, 5, 7) * CELL, y = hashNoise(6, i, 7) * CELL;
      const r = 3 + hashNoise(i, 8, 7) * 5;
      const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r);
      g.addColorStop(0, "rgba(125,255,138,0.9)");
      g.addColorStop(1, "rgba(125,255,138,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox + x - r, oy + y - r, r * 2, r * 2);
    }
  });
  /* surface (variante herbeuse-régolithe pour le dessus de la rangée SURF) */
  put(100, (ox, oy) => {
    drawRock(ctx, ox, oy, "#8a5638", "#734527", 100);
    for (let i = 0; i < 40; i++) {
      const x = hashNoise(i, 2, 42) * CELL, y = hashNoise(3, i, 42) * CELL;
      ctx.fillStyle = hashNoise(i, 9, 1) > 0.5 ? "#9a6240" : "#7c4a30";
      ctx.fillRect(ox + x, oy + y, 3, 2);
    }
  });
  /* minerais : roche hôte + éclats */
  for (const res of Object.keys(ORE)) {
    const id = ORE[res];
    const d = T[id];
    put(id, (ox, oy) => {
      drawRock(ctx, ox, oy, "#463c48", "#372f39", id * 3.1);
      drawOreSpecks(ctx, ox, oy, resColor(res), id * 5.7);
    });
  }
  /* Cœur (paroi de la chambre si jamais rendue en cube) */
  put(31, (ox, oy) => {
    drawRock(ctx, ox, oy, "#463c48", "#372f39", 311);
    drawOreSpecks(ctx, ox, oy, "#ffd23e", 31);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, canvas };
}

function resColor(res: string): string {
  const cols: Record<string, string> = {
    charbon: "#2e3140", fer: "#e0956a", cuivre: "#ff8c42", quartz: "#e8f4ff",
    glace: "#a8e4ff", titane: "#dfe9f7", uranium: "#8dff70", magmatite: "#ff7a45", iridium: "#9ad7ff"
  };
  return cols[res] ?? "#fff";
}

/** UV d'une case (u0,v0,u1,v1) — v inversé (canvas vers UV GL). */
export function slotUV(slot: number): [number, number, number, number] {
  const cx = slot % ATLAS_COLS;
  const cy = Math.floor(slot / ATLAS_COLS);
  const u0 = cx / ATLAS_COLS, v1 = 1 - cy / ATLAS_ROWS;
  const u1 = (cx + 1) / ATLAS_COLS, v0 = 1 - (cy + 1) / ATLAS_ROWS;
  /* léger retrait anti-saignement */
  const bu = 0.25 / (ATLAS_COLS * CELL), bv = 0.25 / (ATLAS_ROWS * CELL);
  return [u0 + bu, v0 + bv, u1 - bu, v1 - bv];
}
