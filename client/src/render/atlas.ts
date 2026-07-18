/* Atlas de textures voxel 100 % procédural (canvas), palette du jeu original.
 * 8×4 cases de 128 px. Bruit de valeur PÉRIODIQUE par case : les faces de
 * voxels adjacents se raccordent sans couture. Chaque id de voxel pointe vers
 * une case (les minerais : roche hôte + éclats colorés lumineux). */
import * as THREE from "three";
import { T, ORE } from "@astroforage/shared";

export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
const CELL = 128;

/** id voxel -> index de case dans l'atlas (101 = régolithe brûlé du crash) */
export const TILE_SLOT: Record<number, number> = {};

function hashNoise(x: number, y: number, s: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function parseHex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Bruit de valeur lissé et périodique (period × period cellules). */
function makeValueNoise(seed: number, period: number): (x: number, y: number) => number {
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = hashNoise(i % period, (i / period) | 0, seed);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = lat[y0 * period + x0], b = lat[y0 * period + x1];
    const c = lat[y1 * period + x0], d = lat[y1 * period + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Roche : 3 octaves de bruit sans couture + fissures + biseau voxel. */
function drawRock(ctx: CanvasRenderingContext2D, ox: number, oy: number, base: string, dark: string, seed: number): void {
  const [br, bg, bb] = parseHex(base);
  const [dr, dg, db] = parseHex(dark);
  const lr = Math.min(255, br * 1.3 + 14), lg = Math.min(255, bg * 1.28 + 12), lb = Math.min(255, bb * 1.24 + 10);
  const n1 = makeValueNoise(seed, 5);          // grandes taches
  const n2 = makeValueNoise(seed + 7.7, 11);   // grain moyen
  const n3 = makeValueNoise(seed + 3.1, 31);   // poussière fine
  const img = ctx.createImageData(CELL, CELL);
  const px = img.data;
  for (let y = 0; y < CELL; y++) {
    const v = y / CELL;
    for (let x = 0; x < CELL; x++) {
      const u = x / CELL;
      const n = n1(u * 5, v * 5) * 0.5 + n2(u * 11, v * 11) * 0.34 + n3(u * 31, v * 31) * 0.16;
      let t = 0.18 + n * 1.1;
      const sp = n3(u * 31 + 13.7, v * 31 + 5.3);
      if (sp > 0.94) t += 0.4;                 // éclats clairs épars
      else if (sp < 0.05) t -= 0.32;           // piqûres sombres
      t = Math.max(0, Math.min(1.5, t));
      let r: number, g: number, b: number;
      if (t <= 1) { r = dr + (br - dr) * t; g = dg + (bg - dg) * t; b = db + (bb - db) * t; }
      else { const e = t - 1; r = br + (lr - br) * e; g = bg + (lg - bg) * e; b = bb + (lb - bb) * e; }
      const i = (y * CELL + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, ox, oy);
  /* fissures : rares, douces, sombres */
  ctx.save();
  ctx.strokeStyle = "rgba(8,4,10,0.30)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  for (let c = 0; c < 3; c++) {
    ctx.beginPath();
    let x = hashNoise(c, seed, 1) * CELL, y = hashNoise(seed, c, 2) * CELL;
    ctx.moveTo(ox + x, oy + y);
    for (let s = 0; s < 6; s++) {
      x += (hashNoise(c, s, seed) - 0.5) * 34;
      y += (hashNoise(s, c, seed) - 0.5) * 34;
      ctx.lineTo(ox + Math.max(2, Math.min(CELL - 2, x)), oy + Math.max(2, Math.min(CELL - 2, y)));
    }
    ctx.stroke();
  }
  ctx.restore();
  /* biseau voxel : arête haute/gauche claire, basse/droite sombre */
  ctx.fillStyle = "rgba(255,240,220,0.10)";
  ctx.fillRect(ox, oy, CELL, 3);
  ctx.fillRect(ox, oy, 3, CELL);
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(ox, oy + CELL - 3, CELL, 3);
  ctx.fillRect(ox + CELL - 3, oy, 3, CELL);
}

function drawOreSpecks(ctx: CanvasRenderingContext2D, ox: number, oy: number, col: string, seed: number, glow = true): void {
  for (let i = 0; i < 11; i++) {
    const x = 14 + hashNoise(i, seed, 3) * (CELL - 28);
    const y = 14 + hashNoise(seed, i, 4) * (CELL - 28);
    const r = 4.5 + hashNoise(i, i, seed) * 7;
    /* ombre de contact : ancre le cristal dans la roche */
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.beginPath();
    ctx.ellipse(ox + x + 1.5, oy + y + r * 0.55, r * 1.35, r * 0.85, 0, 0, 6.2832);
    ctx.fill();
    if (glow) {
      const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r * 2.4);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.fillRect(ox + x - r * 2.4, oy + y - r * 2.4, r * 4.8, r * 4.8);
      ctx.globalAlpha = 1;
    }
    /* losange cristallin à facettes (côté droit plus sombre) */
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(ox + x, oy + y - r);
    ctx.lineTo(ox + x + r * 0.8, oy + y);
    ctx.lineTo(ox + x, oy + y + r);
    ctx.lineTo(ox + x - r * 0.8, oy + y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.moveTo(ox + x, oy + y - r);
    ctx.lineTo(ox + x + r * 0.8, oy + y);
    ctx.lineTo(ox + x, oy + y + r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(ox + x - 1.5, oy + y - r * 0.55, 2.5, r * 0.7);
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
  /* lave : croûte sombre craquelée + braises émissives */
  put(6, (ox, oy) => {
    drawRock(ctx, ox, oy, "#7a1f08", "#3e0f03", 66);
    for (let i = 0; i < 40; i++) {
      const x = hashNoise(i, 1, 9) * CELL, y = hashNoise(2, i, 9) * CELL;
      const r = 5 + hashNoise(i, 3, 9) * 15;
      const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r);
      g.addColorStop(0, "#ffe173");
      g.addColorStop(0.4, "#ff7a2d");
      g.addColorStop(1, "rgba(194,52,15,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox + Math.max(0, x - r), oy + Math.max(0, y - r), r * 2, r * 2);
    }
  });
  /* gaz : roche verdâtre suintante */
  put(7, (ox, oy) => {
    drawRock(ctx, ox, oy, "#4c4a3a", "#34322a", 77);
    for (let i = 0; i < 18; i++) {
      const x = hashNoise(i, 5, 7) * CELL, y = hashNoise(6, i, 7) * CELL;
      const r = 5 + hashNoise(i, 8, 7) * 9;
      const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r);
      g.addColorStop(0, "rgba(125,255,138,0.85)");
      g.addColorStop(1, "rgba(125,255,138,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox + x - r, oy + y - r, r * 2, r * 2);
    }
  });
  /* surface : régolithe balayé, micro-cratères et cailloux */
  put(100, (ox, oy) => {
    drawRock(ctx, ox, oy, "#8a5638", "#6a3f26", 100);
    for (let i = 0; i < 6; i++) {
      const x = 16 + hashNoise(i, 2, 43) * (CELL - 32);
      const y = 16 + hashNoise(3, i, 43) * (CELL - 32);
      const r = 6 + hashNoise(i, 7, 43) * 9;
      /* cuvette sombre + rebord éclairé côté bas-droit */
      const g = ctx.createRadialGradient(ox + x - r * 0.2, oy + y - r * 0.2, 0, ox + x, oy + y, r);
      g.addColorStop(0, "rgba(30,16,10,0.45)");
      g.addColorStop(0.75, "rgba(40,22,14,0.28)");
      g.addColorStop(1, "rgba(40,22,14,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox + x, oy + y, r, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = "rgba(226,168,120,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + x, oy + y, r * 0.92, 0.35, 2.1);
      ctx.stroke();
    }
    /* cailloux */
    for (let i = 0; i < 26; i++) {
      const x = hashNoise(i, 2, 42) * CELL, y = hashNoise(3, i, 42) * CELL;
      const s = 2 + hashNoise(i, 9, 42) * 4;
      ctx.fillStyle = hashNoise(i, 9, 1) > 0.5 ? "#9a6240" : "#754929";
      ctx.beginPath();
      ctx.ellipse(ox + x, oy + y, s, s * 0.7, hashNoise(i, 1, 5) * 3, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,190,0.25)";
      ctx.fillRect(ox + x - s * 0.4, oy + y - s * 0.5, s * 0.8, 1.5);
    }
  });
  /* régolithe brûlé : sol calciné autour du site du crash */
  put(101, (ox, oy) => {
    drawRock(ctx, ox, oy, "#4a3a30", "#251c17", 101);
    for (let i = 0; i < 9; i++) {
      const x = hashNoise(i, 4, 55) * CELL, y = hashNoise(5, i, 55) * CELL;
      const r = 10 + hashNoise(i, 6, 55) * 22;
      const g = ctx.createRadialGradient(ox + x, oy + y, 0, ox + x, oy + y, r);
      g.addColorStop(0, "rgba(12,7,5,0.55)");
      g.addColorStop(1, "rgba(12,7,5,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox + Math.max(0, x - r), oy + Math.max(0, y - r), r * 2, r * 2);
    }
    /* cendres claires + rares braises mortes */
    for (let i = 0; i < 20; i++) {
      const x = hashNoise(i, 8, 56) * CELL, y = hashNoise(9, i, 56) * CELL;
      ctx.fillStyle = "rgba(196,186,176,0.35)";
      ctx.fillRect(ox + x, oy + y, 2.5, 1.5);
    }
    for (let i = 0; i < 5; i++) {
      const x = 8 + hashNoise(i, 3, 57) * (CELL - 16), y = 8 + hashNoise(4, i, 57) * (CELL - 16);
      ctx.fillStyle = "rgba(150,70,30,0.6)";
      ctx.beginPath();
      ctx.arc(ox + x, oy + y, 1.8, 0, 6.2832);
      ctx.fill();
    }
  });
  /* falaise : socle exposé à l'air libre (crête des remparts du cratère) —
   * brun-basalte chaud, lisible, loin du noir du socle souterrain */
  put(102, (ox, oy) => {
    drawRock(ctx, ox, oy, "#54423e", "#332624", 102);
    /* strates horizontales érodées */
    for (let i = 0; i < 5; i++) {
      const y = 12 + hashNoise(i, 1, 88) * (CELL - 24);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(ox, oy + y, CELL, 2.5);
      ctx.fillStyle = "rgba(255,214,180,0.10)";
      ctx.fillRect(ox, oy + y + 2.5, CELL, 1.5);
    }
  });
  /* minerais : roche hôte + éclats */
  for (const res of Object.keys(ORE)) {
    const id = ORE[res];
    put(id, (ox, oy) => {
      drawRock(ctx, ox, oy, "#463c48", "#332b35", id * 3.1);
      drawOreSpecks(ctx, ox, oy, resColor(res), id * 5.7);
    });
  }
  /* Cœur (paroi de la chambre si jamais rendue en cube) */
  put(31, (ox, oy) => {
    drawRock(ctx, ox, oy, "#463c48", "#332b35", 311);
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
