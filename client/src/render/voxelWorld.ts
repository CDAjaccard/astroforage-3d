/* Rendu voxel par chunks 16³ : culling de faces, occlusion ambiante par
 * sommet, atlas procédural. Deux géométries par chunk : matière éclairée
 * (roches/minerais) et matière émissive (lave). */
import * as THREE from "three";
import { W, SURF, isPassableId } from "@astroforage/shared";
import { TILE_SLOT, slotUV, buildAtlas } from "./atlas.js";

const CS = 16; // taille de chunk (voxels)
const VOX = 2; // arête voxel en mètres

interface GridRef { grid: Uint8Array; worldH: number }

/* 6 faces : normale, 4 coins (dans le repère du voxel 0..1), tangentes AO */
interface FaceDef {
  n: [number, number, number];
  corners: Array<[number, number, number]>;
}
/* coins ordonnés pour indexation (0,1,2, 0,2,3) vue de l'extérieur */
const FACES: FaceDef[] = [
  { n: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }
];

class MeshBuf {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  quad(face: FaceDef, wx: number, wy: number, wz: number, uvr: [number, number, number, number], ao: number[], jitter: number): void {
    const base = this.pos.length / 3;
    const [u0, v0, u1, v1] = uvr;
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) {
      const c = face.corners[i];
      this.pos.push(wx + c[0] * VOX, wy + c[1] * VOX, wz + c[2] * VOX);
      this.nrm.push(face.n[0], face.n[1], face.n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      const l = (0.55 + 0.45 * (ao[i] / 3)) * jitter;
      this.col.push(l, l, l);
    }
    /* flip du quad selon l'AO pour éviter l'artefact diagonal */
    if (ao[0] + ao[2] > ao[1] + ao[3]) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  }
  build(): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function jitterOf(x: number, z: number, d: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + d * 37.719) * 43758.5453;
  return 0.92 + (n - Math.floor(n)) * 0.13;
}

export class VoxelWorld {
  group = new THREE.Group();
  private S: GridRef;
  private litMat: THREE.MeshLambertMaterial;
  private glowMat: THREE.MeshBasicMaterial;
  private chunks = new Map<string, { lit: THREE.Mesh | null; glow: THREE.Mesh | null }>();
  private dirty = new Set<string>();
  /** cristaux / cœur présents (props gérés par props.ts) : positions voxel */
  onSpecialChanged: () => void = () => { /* assigné par Game */ };

  constructor(scene: THREE.Scene, S: GridRef) {
    this.S = S;
    const atlas = buildAtlas();
    this.litMat = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true });
    this.glowMat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true });
    scene.add(this.group);
  }

  /** Rebinde l'état (Acte II / chargement) et reconstruit tout. */
  setState(S: GridRef): void {
    this.S = S;
    this.rebuildAll();
    this.onSpecialChanged();
  }

  private key(cx: number, cz: number, cd: number): string { return cx + "," + cz + "," + cd; }

  private tileAt(x: number, z: number, d: number): number {
    const S = this.S;
    if (d < 0) return 0;                   // ciel libre au-dessus du monde
    if (x < 0 || x >= W || z < 0 || z >= W || d >= S.worldH) return 9;
    return S.grid[(d * W + z) * W + x];
  }
  private occl(x: number, z: number, d: number): boolean {
    /* pour l'AO et le culling : les props (8/31) et l'air ne bouchent pas */
    const id = this.tileAt(x, z, d);
    return !isPassableId(id);
  }

  rebuildAll(): void {
    for (const [, c] of this.chunks) {
      c.lit?.geometry.dispose();
      c.glow?.geometry.dispose();
      if (c.lit) this.group.remove(c.lit);
      if (c.glow) this.group.remove(c.glow);
    }
    this.chunks.clear();
    this.dirty.clear();
    const S = this.S;
    const nd = Math.ceil(S.worldH / CS);
    for (let cd = 0; cd < nd; cd++)
      for (let cz = 0; cz < W / CS; cz++)
        for (let cx = 0; cx < W / CS; cx++) this.buildChunk(cx, cz, cd);
  }

  /** Marque le chunk du voxel (et voisins si en bordure) pour reconstruction. */
  markDirty(x: number, z: number, d: number): void {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), cd = Math.floor(d / CS);
    this.dirty.add(this.key(cx, cz, cd));
    if (x % CS === 0 && cx > 0) this.dirty.add(this.key(cx - 1, cz, cd));
    if (x % CS === CS - 1) this.dirty.add(this.key(cx + 1, cz, cd));
    if (z % CS === 0 && cz > 0) this.dirty.add(this.key(cx, cz - 1, cd));
    if (z % CS === CS - 1) this.dirty.add(this.key(cx, cz + 1, cd));
    if (d % CS === 0 && cd > 0) this.dirty.add(this.key(cx, cz, cd - 1));
    if (d % CS === CS - 1) this.dirty.add(this.key(cx, cz, cd + 1));
  }

  /** Reconstruit les chunks sales (appelé chaque frame ; coût borné). */
  update(): void {
    let budget = 4;
    for (const k of this.dirty) {
      this.dirty.delete(k);
      const [cx, cz, cd] = k.split(",").map(Number);
      if (cx < 0 || cz < 0 || cd < 0 || cx >= W / CS || cz >= W / CS || cd * CS >= this.S.worldH) continue;
      this.buildChunk(cx, cz, cd);
      if (--budget <= 0) break;
    }
  }

  private buildChunk(cx: number, cz: number, cd: number): void {
    const k = this.key(cx, cz, cd);
    const old = this.chunks.get(k);
    if (old) {
      old.lit?.geometry.dispose();
      old.glow?.geometry.dispose();
      if (old.lit) this.group.remove(old.lit);
      if (old.glow) this.group.remove(old.glow);
    }
    const S = this.S;
    const lit = new MeshBuf();
    const glow = new MeshBuf();
    const d1 = Math.min(S.worldH, (cd + 1) * CS);
    const ao4: number[] = [0, 0, 0, 0];

    for (let d = cd * CS; d < d1; d++) {
      const vy = SURF - 1 - d;
      for (let z = cz * CS; z < (cz + 1) * CS; z++) {
        for (let x = cx * CS; x < (cx + 1) * CS; x++) {
          const id = S.grid[(d * W + z) * W + x];
          if (isPassableId(id)) continue;      // air + props
          const jit = jitterOf(x, z, d);
          const isGlow = id === 6;
          const buf = isGlow ? glow : lit;
          for (const face of FACES) {
            const nx = x + face.n[0], nz = z + face.n[2], ndd = d - face.n[1];
            if (this.occl(nx, nz, ndd)) continue;
            /* AO par sommet */
            for (let ci = 0; ci < 4; ci++) {
              const c = face.corners[ci];
              /* directions tangentes du coin (voxel adjacent au sommet) */
              const sx = c[0] === 1 ? 1 : -1, sy = c[1] === 1 ? 1 : -1, sz = c[2] === 1 ? 1 : -1;
              let s1 = false, s2 = false, co = false;
              if (face.n[0] !== 0) {
                s1 = this.occl(nx, z + sz, d);
                s2 = this.occl(nx, z, d - sy);
                co = this.occl(nx, z + sz, d - sy);
              } else if (face.n[1] !== 0) {
                s1 = this.occl(x + sx, z, ndd);
                s2 = this.occl(x, z + sz, ndd);
                co = this.occl(x + sx, z + sz, ndd);
              } else {
                s1 = this.occl(x + sx, nz, d);
                s2 = this.occl(x, nz, d - sy);
                co = this.occl(x + sx, nz, d - sy);
              }
              ao4[ci] = s1 && s2 ? 0 : 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (co ? 1 : 0));
            }
            let slot = TILE_SLOT[id] ?? TILE_SLOT[2];
            if (id === 1 && d === SURF && face.n[1] === 1) slot = TILE_SLOT[100];
            buf.quad(face, x * VOX, vy * VOX, z * VOX, slotUV(slot), ao4, isGlow ? 1 : jit);
          }
        }
      }
    }

    const litGeo = lit.build();
    const glowGeo = glow.build();
    const rec = { lit: null as THREE.Mesh | null, glow: null as THREE.Mesh | null };
    if (litGeo) {
      rec.lit = new THREE.Mesh(litGeo, this.litMat);
      rec.lit.matrixAutoUpdate = false;
      rec.lit.receiveShadow = true;   // ombres optionnelles : le terrain les reçoit
      this.group.add(rec.lit);
    }
    if (glowGeo) {
      rec.glow = new THREE.Mesh(glowGeo, this.glowMat);
      rec.glow.matrixAutoUpdate = false;
      this.group.add(rec.glow);
    }
    this.chunks.set(k, rec);
  }
}
