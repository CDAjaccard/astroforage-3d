/* ASTRO·FORAGE 3D — types partagés client/serveur. */
import type { DiffKey, UpKey } from "./data.js";

/* Coordonnées voxel : (vx, vz) horizontal 0..W-1, d = rangée verticale
 * 0..H-1 du haut (ciel) vers le bas. Monde en mètres : X=vx*2, Z=vz*2,
 * Y = (SURF - d)*2 (surface du sol à Y=0, profondeur = -Y). */

export interface Building {
  key: string;
  x: number; z: number;        // centre, en voxels (fraction .5)
  on: boolean;
  recipe: string | null;
  prog: number;
  job: 0 | 1;
  fuel: number;
  pending: Record<string, number> | null;
  status: string;              // clé de statut (traduite côté client)
  oc: boolean;                 // surcadence
}

export interface Robot {
  x: number; z: number; d: number;  // position voxel
  t: number;
  done: boolean;
  full: boolean;
  n: number;                        // numéro d'usine
  lastX?: number; lastZ?: number; lastD?: number;
}

export interface Creature {
  x: number; y: number; z: number;  // mètres (monde)
  vx: number; vy: number; vz: number;
  hp: number; max: number;
  ph: number; hit: number; fire: number;
  type: string;
}

export interface Projectile {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  t: number; life: number;
}

export interface Nest {
  x: number; y: number; z: number;  // mètres
  hp: number; max: number;
  ph: number; spawnT: number; hit: number; awake: boolean;
}

export interface Debris { x: number; z: number; t: number; ti: number; fe: number }

/** Décoration posée dans l'intérieur de la fusée (x le long de la pièce, 0..1). */
export interface Deco { id: string; x: number }

export interface Stats {
  mined: Record<string, number>;
  made: Record<string, number>;
  robots: number;
  rescues: number;
  creatures?: number;
  nests?: number;
  boostT?: number;
  coeur?: number;
}

/** État partagé du monde (possédé par la GameSim — locale en solo, serveur en coop). */
export interface SharedState {
  seed: number;
  act: 1 | 2;
  diff: DiffKey;
  worldH: number;
  grid: Uint8Array;
  edits: number[];              // liste plate [x,z,d,v, x,z,d,v, ...] post-génération
  store: Record<string, number>;
  builds: Building[];
  robots: Robot[];
  robotsOwned: number;
  baieLvl: number;
  robotSpd: number;
  rocketFix: Record<string, boolean>;
  rocketDel: Record<string, Record<string, number>>;
  research: Record<string, 1>;
  qi: number;
  time: number;
  dayT: number;
  stats: Stats;
  battE: number;
  launched: boolean;
  quakeT: number;
  quakeSam: 0 | 1;
  storm: { t: number; dur: number } | null;
  debris: Debris[];
  creatures: Creature[];
  projectiles: Projectile[];
  nests: Nest[];
  milestones: Record<number, 1>;
  deepest: number;
  mobWarn: Record<string, 1>;
  nestWarn: 0 | 1;
  decos: Deco[];
}

/** Avatar (possédé par chaque client ; jamais simulé par le serveur). */
export interface AstroState {
  x: number; y: number; z: number;   // mètres
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number;
  inDrill: boolean;
  grounded: boolean;
  anim: number;
  o2: number;
  jp: number;
  pouch: number;
  o2Warn?: boolean;
  jets?: boolean;
}

export interface DrillState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number;
  hp: number; en: number;
  grounded: boolean;
  digging: boolean;
  boosting: boolean;
  digP: number;
  digT: { x: number; z: number; d: number } | null;
  beamCD: number;
}

export interface Cosmetic { suit: number; visor: number; accent: number }

/** Ce qu'un joueur diffuse aux autres (18 Hz). */
export interface AvatarWire {
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  d: 0 | 1;       // dans la foreuse
  g: 0 | 1;       // au sol
  j: 0 | 1;       // jetpack allumé
  dg: 0 | 1;      // en train de forer
  b: 0 | 1;       // surrégime
  a: number;      // phase d'animation de marche
}

/** Améliorations personnelles d'un joueur (suivies par la sim pour valider le forage). */
export type PlayerUp = Record<UpKey, number>;

export interface SimPlayer {
  id: number;
  name: string;
  cos: Cosmetic;
  up: PlayerUp;
  /* dernière position connue (cible pour la faune / paliers de profondeur) */
  x: number; y: number; z: number;
  inDrill: boolean;
  speed: number;
}

/* ---- événements de présentation (sim -> clients) ---- */
export type GameEvent =
  | { t: "toast"; msg: string; msgEn?: string; kind: "ok" | "info" | "warn" | "bad" }
  | { t: "say"; txt: string; txtEn?: string; dur: number }
  | { t: "floater"; x: number; y: number; z: number; txt: string; col: string }
  | { t: "boom"; x: number; y: number; z: number }
  | { t: "questDone"; qi: number }
  | { t: "mobkill"; x: number; y: number; z: number; body: string }
  | { t: "nestkill"; x: number; y: number; z: number; bio: number }
  | { t: "sonic"; x: number; y: number; z: number }
  | { t: "hitfx"; x: number; y: number; z: number }
  | { t: "quake" }
  | { t: "meteor"; x: number; z: number }
  | { t: "storm"; on: boolean }
  | { t: "milestone"; m: number }
  | { t: "heart" }
  | { t: "launch"; act: 1 | 2 }
  | { t: "act2" }
  | { t: "win" };

export interface PowerInfo { prod: number; dem: number; ratio: number; batt: number; battCap: number }

/** Instantané sérialisable d'une partie (sauvegarde solo, snapshot coop, disque serveur). */
export interface Snapshot {
  v: number;                    // version du format
  seed: number;
  act: 1 | 2;
  diff: DiffKey;
  worldH: number;
  edits: number[];
  store: Record<string, number>;
  builds: Building[];
  robots: Robot[];
  robotsOwned: number;
  baieLvl: number;
  robotSpd: number;
  rocketFix: Record<string, boolean>;
  rocketDel: Record<string, Record<string, number>>;
  research: Record<string, 1>;
  qi: number;
  time: number;
  dayT: number;
  stats: Stats;
  battE: number;
  launched: boolean;
  quakeT: number;
  quakeSam: 0 | 1;
  nests: Nest[];
  milestones: Record<number, 1>;
  deepest: number;
  mobWarn: Record<string, 1>;
  nestWarn: 0 | 1;
  decos?: Deco[];
  /* méta hors-sim (facultatif) */
  passHash?: string;
}
