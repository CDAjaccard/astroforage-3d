/* ASTRO·FORAGE 3D — GameSim : la simulation autoritative du monde partagé.
 *
 * Une seule implémentation pour les deux modes (décision n°6, docs/DECISIONS.md) :
 *   - SOLO : instanciée dans le client, avec un joueur local ; hors-ligne.
 *   - COOP : instanciée par le serveur (une par salle) ; les clients envoient
 *     des INTENTIONS et reçoivent deltas de voxels, état « base », faune et
 *     événements — même modèle que le « Palier 2 » du jeu original.
 *
 * La sim possède : terrain, stock, bâtiments, énergie, robots, fusée, quêtes,
 * faune, nids, météo, séismes, actes. Elle ne simule JAMAIS les avatars — les
 * clients gardent la main sur leur pilote (prédiction), comme dans l'original. */

import {
  W, SURF, DAYLEN, DIFFS, type DiffKey, RESDEF, T, RECIPES, BUILDINGS, UPGRADES,
  DEPTHS, RESEARCH, ROCKET, ROCKET2, QUESTS, ACT2_QI, MOBS, ROBOT_COST, BAIE_UP,
  SPD_UP, ROBOT_ITV, ROBOT_CAP, DEFAULT_UP, ROCK_POS, type UpKey
} from "./data.js";
import { randomSeed } from "./rng.js";
import {
  genWorld, deepenWorld, seismicVeins, tile, setTile, VOX, rowOfY, topYOfRow, depthM, isPassableId
} from "./world.js";
import type {
  Building, Creature, GameEvent, Nest, PowerInfo, Projectile, SharedState,
  SimPlayer, Snapshot, Cosmetic
} from "./types.js";

export const SNAPSHOT_V = 1;
const ROCKET_M = { x: (ROCK_POS.x + 0.5) * VOX, z: (ROCK_POS.z + 0.5) * VOX };

export interface IntentMsg { i: string; [k: string]: any }

/** Validation de placement d'un bâtiment (pure — partagée client/serveur). */
export function canPlaceBuilding(
  S: { grid: Uint8Array; worldH: number; builds: Building[]; launched: boolean },
  cx: number, cz: number
): boolean {
  const x0 = Math.round(cx - 1), z0 = Math.round(cz - 1);
  if (x0 < 2 || x0 + 1 > W - 3 || z0 < 2 || z0 + 1 > W - 3) return false;
  const dRock = Math.hypot(cx - (ROCK_POS.x + 0.5), cz - (ROCK_POS.z + 0.5));
  if (!S.launched && dRock < 3.4) return false;
  if (dRock > 30) return false;
  for (let z = z0; z <= z0 + 1; z++)
    for (let x = x0; x <= x0 + 1; x++) {
      if (tile(S, x, z, SURF) === 0) return false;
      if (tile(S, x, z, SURF - 1) !== 0) return false;
    }
  for (const b of S.builds) {
    if (Math.abs(cx - b.x) < 2.95 && Math.abs(cz - b.z) < 2.95) return false;
  }
  return true;
}

/** Progression textuelle d'une quête (pure — pour l'affichage HUD). */
export function questProgress(
  S: { stats: { mined: Record<string, number>; made: Record<string, number> }; robots: Array<{ done: boolean }> },
  repaired: number, maxForet: number, qi: number
): string | null {
  const m = S.stats.mined, made = S.stats.made;
  switch (qi) {
    case 1: return `${Math.min(5, m.fer || 0)}/5 · ${Math.min(5, m.charbon || 0)}/5`;
    case 3: return `${Math.min(4, made.lingot_fer || 0)}/4`;
    case 6: return `${S.robots.filter(r => !r.done).length}/3 · ${Math.min(5, made.acier || 0)}/5`;
    case 7: return `${Math.min(3, m.cristal || 0)}/3`;
    case 8: case 12: return `${repaired}/5`;
    case 10: return `${Math.min(6, m.magmatite || 0)}/6`;
    case 11: return `Mk${maxForet} · ${Math.min(8, m.iridium || 0)}/8`;
  }
  return null;
}

function initialState(seed: number, diff: DiffKey): SharedState {
  const gen = genWorld(seed);
  const rocketFix: Record<string, boolean> = {};
  const rocketDel: Record<string, Record<string, number>> = {};
  for (const sys of ROCKET) { rocketFix[sys.key] = false; rocketDel[sys.key] = {}; }
  return {
    seed, act: 1, diff, worldH: (gen.grid.length / (W * W)) | 0,
    grid: gen.grid, edits: [],
    store: {}, builds: [], robots: [], robotsOwned: 0, baieLvl: 1, robotSpd: 1,
    rocketFix, rocketDel, research: {}, qi: 0, time: 0, dayT: DAYLEN * 0.12,
    stats: { mined: {}, made: {}, robots: 0, rescues: 0 },
    battE: 0, launched: false, quakeT: 55, quakeSam: 0, storm: null,
    debris: [], creatures: [], projectiles: [], nests: gen.nests,
    milestones: {}, deepest: 0, mobWarn: {}, nestWarn: 0
  };
}

export class GameSim {
  S: SharedState;
  power: PowerInfo = { prod: 0, dem: 0, ratio: 1, batt: 0, battCap: 0 };
  daylight = 1;
  players = new Map<number, SimPlayer>();
  /** phase de décollage en cours (cinématique synchronisée) */
  launch: { t: number; act: 1 | 2 } | null = null;

  private events: GameEvent[] = [];
  private deltas: number[] = [];
  private dmg = new Map<number, { drill: number; foot: number }>();
  private resyncFlag = false;
  private questAcc = 0;
  private creSpawnT = 0;
  private sonicT = 0;
  private meteorEv: { tx: number; tz: number; t: number } | null = null;

  constructor(seed?: number | null, diff: DiffKey = "normal", snap?: Snapshot) {
    if (snap) {
      this.S = GameSim.restore(snap);
    } else {
      this.S = initialState(seed ?? randomSeed(), diff);
    }
  }

  /* ================= joueurs ================= */

  addPlayer(id: number, name: string, cos: Cosmetic): SimPlayer {
    const p: SimPlayer = {
      id, name, cos, up: { ...DEFAULT_UP },
      x: 0, y: 2, z: 0, inDrill: false, speed: 0
    };
    this.players.set(id, p);
    return p;
  }
  removePlayer(id: number): void { this.players.delete(id); }

  /** Met à jour la position connue d'un joueur (cible faune / paliers). */
  setPlayerPos(id: number, x: number, y: number, z: number, inDrill: boolean, speed: number): void {
    const p = this.players.get(id);
    if (!p) return;
    p.x = x; p.y = y; p.z = z; p.inDrill = inDrill; p.speed = speed;
  }

  /* ================= files de sortie ================= */

  drainEvents(): GameEvent[] | null {
    if (!this.events.length) return null;
    const e = this.events; this.events = []; return e;
  }
  drainTileDeltas(): number[] | null {
    if (!this.deltas.length) return null;
    const d = this.deltas; this.deltas = []; return d;
  }
  drainDamage(): Map<number, { drill: number; foot: number }> | null {
    if (!this.dmg.size) return null;
    const d = this.dmg; this.dmg = new Map(); return d;
  }
  drainResync(): boolean {
    const r = this.resyncFlag; this.resyncFlag = false; return r;
  }

  private ev(e: GameEvent): void { this.events.push(e); }
  private toast(msg: string, kind: "ok" | "info" | "warn" | "bad", msgEn?: string): void {
    this.ev({ t: "toast", msg, kind, msgEn });
  }
  private say(txt: string, dur: number, txtEn?: string): void { this.ev({ t: "say", txt, dur, txtEn }); }
  private hurt(id: number, drill: number, foot: number): void {
    const d = this.dmg.get(id) ?? { drill: 0, foot: 0 };
    d.drill += drill; d.foot += foot;
    this.dmg.set(id, d);
  }

  /* ================= stock / aides ================= */

  diff() { return DIFFS[this.S.diff] ?? DIFFS.normal; }
  count(r: string): number { return this.S.store[r] || 0; }
  storeTotal(): number { let n = 0; for (const k in this.S.store) n += this.S.store[k]; return n; }
  storeCap(): number { let c = 300; for (const b of this.S.builds) if (b.key === "silo") c += 250; return c; }
  storeFree(): number { return this.storeCap() - this.storeTotal(); }
  gain(res: string, n: number): number {
    const a = Math.max(0, Math.min(n, this.storeFree()));
    if (a > 0) this.S.store[res] = (this.S.store[res] || 0) + a;
    return a;
  }
  canAfford(cost: Record<string, number>): boolean {
    for (const r in cost) if (this.count(r) < cost[r]) return false;
    return true;
  }
  pay(cost: Record<string, number>): void {
    for (const r in cost) {
      this.S.store[r] = (this.S.store[r] || 0) - cost[r];
      if (this.S.store[r] <= 0) delete this.S.store[r];
    }
  }
  builtCount(key: string): number { let n = 0; for (const b of this.S.builds) if (b.key === key) n++; return n; }
  hasB(key: string): boolean { return this.builtCount(key) > 0; }
  hasR(id: string): boolean { return !!this.S.research[id]; }
  buildCost(key: string): Record<string, number> {
    const def = BUILDINGS[key];
    const mult = def.repeat ? Math.pow(1.35, this.builtCount(key)) : 1;
    const c: Record<string, number> = {};
    for (const r in def.cost) c[r] = Math.ceil(def.cost[r] * mult);
    return c;
  }
  rocketList() { return this.S.act >= 2 ? ROCKET2 : ROCKET; }
  rocketReady(): boolean { return this.rocketList().every(s => this.S.rocketFix[s.key]); }
  repairedCount(): number { return this.rocketList().filter(s => this.S.rocketFix[s.key]).length; }
  robotItv(): number { return ROBOT_ITV[this.S.robotSpd - 1] * (this.hasR("servos") ? 0.8 : 1); }
  robotRad(): number { return this.hasR("servos") ? 5 : 4; }
  robotCap(): number { return ROBOT_CAP[this.S.baieLvl - 1]; }

  /** Un emplacement de bâtiment (2×2 voxels, centre cx/cz fractionnaire) est-il valide ? */
  canPlaceAt(cx: number, cz: number): boolean {
    return canPlaceBuilding(this.S, cx, cz);
  }

  /* ================= intentions ================= */

  applyIntent(p: SimPlayer, m: IntentMsg): Record<string, any> | null {
    const S = this.S;
    switch (m.i) {
      case "dig": return this.iDig(p, m.x | 0, m.z | 0, m.d | 0);
      case "harvest": {
        if (tile(S, m.x | 0, m.z | 0, m.d | 0) !== 8) return null;
        setTile(S, m.x | 0, m.z | 0, m.d | 0, 0);
        this.deltas.push(m.x | 0, m.z | 0, m.d | 0, 0);
        S.stats.mined.cristal = (S.stats.mined.cristal || 0) + 1;
        return null;
      }
      case "deposit": {
        const accepted: Record<string, number> = {};
        for (const r in (m.items || {})) {
          const n = Math.max(0, m.items[r] | 0);
          if (!RESDEF[r] || n <= 0) continue;
          accepted[r] = this.gain(r, n);
        }
        return { accepted };
      }
      case "debris": {
        const di = S.debris.findIndex(d => Math.abs(d.x - m.x) < 1.5 && Math.abs(d.z - m.z) < 1.5);
        if (di < 0) return null;
        const d = S.debris[di];
        S.debris.splice(di, 1);
        this.gain("titane", d.ti);
        this.gain("fer", d.fe);
        this.ev({ t: "floater", x: d.x * VOX, y: 1.6, z: d.z * VOX, txt: `☄️ +${d.ti} Titane · +${d.fe} Fer`, col: "#c9d6e8" });
        return null;
      }
      case "build": {
        const key = String(m.key);
        const def = BUILDINGS[key];
        if (!def) return null;
        if (def.max && this.builtCount(key) >= def.max) { this.toast("Déjà construit (maximum atteint).", "warn", "Already built (max reached)."); return null; }
        if (def.prereq && !this.hasB(def.prereq)) { this.toast(`Nécessite d'abord : ${BUILDINGS[def.prereq].nom}.`, "warn", `Requires first: ${BUILDINGS[def.prereq].nomEn}.`); return null; }
        if (!this.canPlaceAt(+m.x, +m.z)) { this.toast("Impossible de construire ici.", "warn", "Cannot build here."); return null; }
        const cost = this.buildCost(key);
        if (!this.canAfford(cost)) { this.toast("Ressources insuffisantes.", "warn", "Not enough resources."); return null; }
        this.pay(cost);
        const b: Building = { x: +m.x, z: +m.z, key, on: true, recipe: null, prog: 0, job: 0, fuel: 0, pending: null, status: "", oc: false };
        const recs = RECIPES[key];
        if (recs && recs.length) b.recipe = recs[0].id;
        S.builds.push(b);
        this.toast(`🏗️ ${def.nom} — construction terminée !`, "ok", `🏗️ ${def.nomEn} — construction complete!`);
        return null;
      }
      case "demolish": {
        const bi = S.builds.findIndex(b => Math.abs(b.x - m.x) < 0.6 && Math.abs(b.z - m.z) < 0.6);
        if (bi < 0) return null;
        const b = S.builds[bi];
        const def = BUILDINGS[b.key];
        for (const r in def.cost) {
          const n = Math.floor(def.cost[r] * 0.6);
          if (n > 0) this.gain(r, n);
        }
        S.builds.splice(bi, 1);
        this.toast(`🧨 ${def.nom} démoli — 60 % des matériaux récupérés.`, "info", `🧨 ${def.nomEn} demolished — 60% of materials recovered.`);
        return null;
      }
      case "machine": {
        const b = S.builds.find(bb => Math.abs(bb.x - m.x) < 0.6 && Math.abs(bb.z - m.z) < 0.6);
        if (!b) return null;
        if (typeof m.recipe === "string") {
          const recs = RECIPES[b.key];
          if (recs && recs.some(r => r.id === m.recipe)) { b.recipe = m.recipe; b.job = 0; b.prog = 0; }
        }
        if (typeof m.on === "boolean") b.on = m.on;
        if (typeof m.oc === "boolean") b.oc = m.oc && this.hasB("labo");
        return null;
      }
      case "upgrade": {
        const key = m.key as UpKey;
        const U = UPGRADES[key];
        if (!U) return null;
        const lvl = p.up[key] || 1;
        if (lvl >= U.vals.length) return null;
        const cost = U.costs[lvl];
        if (!cost || !this.canAfford(cost)) { this.toast("Ressources insuffisantes.", "warn", "Not enough resources."); return null; }
        this.pay(cost);
        p.up[key] = lvl + 1;
        return { up: { key, lvl: lvl + 1 } };
      }
      case "research": {
        const r = RESEARCH.find(x => x.id === m.id);
        if (!r || this.hasR(r.id)) return null;
        if (!this.hasB("labo")) { this.toast("Nécessite un Labo cristallin.", "warn", "Requires a Crystal lab."); return null; }
        if (this.count("cristal") < r.cost) { this.toast(`Cristaux insuffisants (${this.count("cristal")}/${r.cost}).`, "warn", `Not enough crystals (${this.count("cristal")}/${r.cost}).`); return null; }
        this.pay({ cristal: r.cost });
        S.research[r.id] = 1;
        this.toast(`🔬 Recherche débloquée : ${r.nom}`, "ok", `🔬 Research unlocked: ${r.nomEn}`);
        return { research: r.id };
      }
      case "robotAdd": {
        if ((S.robotsOwned || 0) >= this.robotCap()) { this.toast("Capacité maximale — agrandissez la Baie.", "warn", "Max capacity — expand the Bay."); return null; }
        if (!this.canAfford(ROBOT_COST)) { this.toast("Ressources insuffisantes.", "warn", "Not enough resources."); return null; }
        this.pay(ROBOT_COST);
        S.robotsOwned++;
        this.toast("🤖 Robot-foreuse assemblé ! Sous terre, appuyez sur R pour le déployer.", "ok", "🤖 Mining robot assembled! Underground, press R to deploy it.");
        return null;
      }
      case "robotDeploy": {
        if (!this.hasB("baie")) { this.toast("Construisez d'abord la Baie robotique.", "warn", "Build the Robotics bay first."); return null; }
        if (S.robotsOwned - S.robots.length <= 0) { this.toast("Aucun robot disponible — assemblez-en dans la Baie.", "warn", "No robot available — assemble one in the Bay."); return null; }
        const d = m.d | 0;
        if (d - SURF < 1) { this.toast("Déployez le robot sous terre, près d'un filon !", "warn", "Deploy the robot underground, near a vein!"); return null; }
        S.stats.robots++;
        S.robots.push({ x: m.x | 0, z: m.z | 0, d, t: 0, done: false, full: false, n: S.stats.robots });
        this.toast(`🤖 Robot-foreuse n°${S.stats.robots} déployé !`, "ok", `🤖 Mining robot #${S.stats.robots} deployed!`);
        return null;
      }
      case "robotRecall": {
        const ri = S.robots.findIndex(r => r.n === m.n);
        if (ri < 0) return null;
        S.robots.splice(ri, 1);
        this.toast("🤖 Robot rapatrié à la base — prêt à être redéployé (R).", "info", "🤖 Robot recalled to base — ready to redeploy (R).");
        return null;
      }
      case "baieUp": {
        if (S.baieLvl >= 3) return null;
        const c = BAIE_UP[S.baieLvl];
        if (!c || !this.canAfford(c)) { this.toast("Ressources insuffisantes.", "warn", "Not enough resources."); return null; }
        this.pay(c);
        S.baieLvl++;
        this.toast(`⬆️ Baie agrandie : capacité ${this.robotCap()} robots.`, "ok", `⬆️ Bay expanded: capacity ${this.robotCap()} robots.`);
        return null;
      }
      case "spdUp": {
        if (S.robotSpd >= 3) return null;
        const c = SPD_UP[S.robotSpd];
        if (!c || !this.canAfford(c)) { this.toast("Ressources insuffisantes.", "warn", "Not enough resources."); return null; }
        this.pay(c);
        S.robotSpd++;
        this.toast(`⬆️ Forets robotiques : un minerai toutes les ${this.robotItv().toFixed(1)} s.`, "ok", `⬆️ Robot drills: one ore every ${this.robotItv().toFixed(1)} s.`);
        return null;
      }
      case "contribute": {
        const sys = this.rocketList().find(s => s.key === m.key);
        if (!sys || S.rocketFix[sys.key]) return null;
        const del = S.rocketDel[sys.key] || (S.rocketDel[sys.key] = {});
        let moved = 0, complete = true;
        for (const r in sys.cost) {
          const need = sys.cost[r] - (del[r] || 0);
          if (need > 0) {
            const take = Math.min(need, this.count(r));
            if (take > 0) {
              this.pay({ [r]: take });
              del[r] = (del[r] || 0) + take;
              moved += take;
            }
          }
          if ((del[r] || 0) < sys.cost[r]) complete = false;
        }
        if (complete) {
          S.rocketFix[sys.key] = true;
          this.toast(`✅ ${sys.nom} de la fusée : réparation terminée !`, "ok", `✅ Rocket ${sys.nomEn}: repair complete!`);
          this.ev({ t: "boom", x: ROCKET_M.x, y: 3, z: ROCKET_M.z });
        } else if (moved > 0) this.toast(`🔩 +${moved} pièces installées (${sys.nom})`, "info", `🔩 +${moved} parts installed (${sys.nomEn})`);
        else this.toast("Rien à fournir pour l'instant — produisez les pièces manquantes.", "warn", "Nothing to supply yet — produce the missing parts.");
        return null;
      }
      case "launch": {
        if (!this.rocketReady() || this.launch) { this.toast("La fusée n'est pas prête.", "warn", "The rocket is not ready."); return null; }
        this.launch = { t: 0, act: S.act };
        this.ev({ t: "launch", act: S.act });
        return null;
      }
      case "rescue": {
        S.stats.rescues++;
        return null;
      }
    }
    return null;
  }

  /** Forage d'un voxel (l'avatar a déjà purgé le temps de perçage côté client). */
  private iDig(p: SimPlayer, x: number, z: number, d: number): Record<string, any> | null {
    const S = this.S;
    const id = tile(S, x, z, d);
    const def = T[id];
    if (!def || def.air || def.bedrock || def.lava || def.manual) return null;
    const foret = UPGRADES.foret.vals[(p.up.foret || 1) - 1] as { h: number; sp: number };
    if (def.hard > foret.h) return null;
    if (def.gas) {
      this.explode(x, z, d);
      return null;
    }
    if (def.heart) {
      S.stats.coeur = 1;
      this.gain("cristal", 6);
      this.gain("uranium", 10);
      this.ev({ t: "heart" });
      this.ev({ t: "floater", x: (x + 0.5) * VOX, y: topYOfRow(d) + 1, z: (z + 0.5) * VOX, txt: "💛 LE CŒUR DE KEPLER !", col: "#ffd23e" });
      this.toast("💛 Le Cœur de Kepler ! Un artefact légendaire. (+6 cristaux, +10 uranium)", "ok", "💛 The Heart of Kepler! A legendary artifact. (+6 crystals, +10 uranium)");
      this.say("Incroyable… le CŒUR DE KEPLER ! La légende des prospecteurs disait vrai. Il rayonne d'énergie pure, pilote !", 13, "Unbelievable… the HEART OF KEPLER! The prospectors' legend was true. It radiates pure energy, pilot!");
    }
    setTile(S, x, z, d, 0);
    this.deltas.push(x, z, d, 0);
    if (def.res) {
      S.stats.mined[def.res] = (S.stats.mined[def.res] || 0) + 1;
      return { res: def.res }; // le client crédite sa soute
    }
    return {};
  }

  /** Explosion d'une poche de gaz : sphère de rayon ~2.2 voxels. */
  private explode(cx: number, cz: number, cd: number): void {
    const S = this.S;
    for (let d = cd - 2; d <= cd + 2; d++)
      for (let z = cz - 2; z <= cz + 2; z++)
        for (let x = cx - 2; x <= cx + 2; x++) {
          const dx = x - cx, dz = z - cz, dd = d - cd;
          if (dx * dx + dz * dz + dd * dd <= 3.4) {
            const id = tile(S, x, z, d);
            if (id !== 9 && id !== 0) {
              setTile(S, x, z, d, 0);
              this.deltas.push(x, z, d, 0);
            }
          }
        }
    const bx = (cx + 0.5) * VOX, by = topYOfRow(cd) - VOX / 2, bz = (cz + 0.5) * VOX;
    this.ev({ t: "boom", x: bx, y: by, z: bz });
    for (const [, p] of this.players) {
      const dist = Math.hypot(p.x - bx, p.y - by, p.z - bz);
      if (dist < 6.8 && p.inDrill) this.hurt(p.id, Math.round(24 * Math.max(0.1, 1 - dist / 7.2)), 0);
    }
  }

  /* ================= boucle ================= */

  step(dt: number): void {
    const S = this.S;
    S.time += dt;
    S.dayT += dt;
    const tphase = (S.dayT % DAYLEN) / DAYLEN;
    this.daylight = Math.max(0, Math.min(1, Math.sin(tphase * Math.PI * 2) * 1.5 + 0.35));

    this.updateBase(dt);
    this.updateRobots(dt);
    this.updateCreatures(dt);
    this.updateNests(dt);
    this.updateMilestones();
    this.updateQuests(dt);
    this.updateWorldEvents(dt);
    this.updateLaunch(dt);
  }

  /* ---- énergie + production (port de base.js) ---- */
  private updateBase(dt: number): void {
    const S = this.S;
    const L = this.daylight;
    let prod = 0;
    const nAccu = this.builtCount("accu");
    const battCap = 100 * nAccu;
    if (S.battE > battCap) S.battE = battCap;

    const solF = S.storm ? (this.hasR("bouclier") ? 0.5 : 0.2) : 1;
    for (const b of S.builds) {
      if (b.key === "solaire") { prod += 3 * L * solF; b.status = S.storm ? "storm" : L > 0.02 ? "day" : "night"; }
      else if (b.key === "generateur") {
        if (b.fuel > 0) { b.fuel -= dt; prod += 8; b.status = "run"; }
        if (b.fuel <= 0) {
          if (b.on && this.count("charbon") > 0) { this.pay({ charbon: 1 }); b.fuel = 6; prod += 8; b.status = "run"; }
          else b.status = b.on ? "noFuel" : "paused";
        }
      } else if (b.key === "reacteur") {
        if (b.fuel > 0) { b.fuel -= dt; prod += 40; b.status = "run"; }
        if (b.fuel <= 0) {
          if (b.on && this.count("cellule") > 0) { this.pay({ cellule: 1 }); b.fuel = 45; prod += 40; b.status = "run"; }
          else b.status = b.on ? "noFuel" : "paused";
        }
      } else if (b.key === "accu") b.status = "accu";
    }

    let dem = 0;
    const running: Array<[Building, (typeof RECIPES)[string][number]]> = [];
    const laboOn = this.hasB("labo");
    for (const b of S.builds) {
      const recs = RECIPES[b.key];
      if (!recs) continue;
      if (b.oc && !laboOn) b.oc = false;
      const rec = recs.find(r => r.id === b.recipe);
      if (!rec) { b.status = "chooseRecipe"; continue; }
      if (!b.on) { b.status = "paused"; continue; }
      if (b.pending) {
        let done = true;
        for (const r in b.pending) {
          const a = this.gain(r, b.pending[r]);
          b.pending[r] -= a;
          if (b.pending[r] <= 0) delete b.pending[r]; else done = false;
        }
        if (done) b.pending = null;
        else { b.status = "storeFull"; continue; }
      }
      if (!b.job) {
        if (this.canAfford(rec.in)) { this.pay(rec.in); b.job = 1; b.prog = 0; }
        else { b.status = "waitRes"; continue; }
      }
      dem += rec.pow * (b.oc ? 2.5 : 1);
      running.push([b, rec]);
    }
    let robotsActive = 0;
    for (const r of S.robots) if (!r.done) robotsActive++;
    dem += robotsActive;

    let ratio: number;
    if (dem <= prod) {
      ratio = 1;
      if (battCap > 0 && prod > dem) {
        S.battE = Math.min(battCap, S.battE + Math.min(prod - dem, 6 * nAccu) * dt);
      }
    } else {
      let draw = 0;
      if (battCap > 0 && S.battE > 0) {
        draw = Math.min(dem - prod, 9 * nAccu, S.battE / Math.max(dt, 0.0001));
        S.battE = Math.max(0, S.battE - draw * dt);
      }
      ratio = Math.min(1, (prod + draw) / dem);
    }
    this.power = { prod: Math.round(prod * 10) / 10, dem: Math.round(dem * 10) / 10, ratio, batt: Math.round(S.battE), battCap };

    for (const [b, rec] of running) {
      b.prog += dt * ratio * (b.oc ? 1.8 : 1);
      b.status = (ratio < 0.98 ? "lowPower" : "run") + (b.oc ? "_oc" : "");
      if (b.prog >= rec.t) {
        b.prog = 0; b.job = 0;
        const pend: Record<string, number> = {};
        const firstOut = Object.keys(rec.out)[0];
        const bonus = this.hasR("recyclage") && Math.random() < 0.2;
        for (const r in rec.out) {
          let qty = rec.out[r];
          if (bonus && r === firstOut) qty += 1;
          S.stats.made[r] = (S.stats.made[r] || 0) + qty;
          const a = this.gain(r, qty);
          if (a < qty) pend[r] = qty - a;
        }
        if (Object.keys(pend).length) b.pending = pend;
        this.ev({
          t: "floater", x: b.x * VOX, y: 3.4, z: b.z * VOX,
          txt: `${bonus ? "♻ +" : "+"}${rec.out[firstOut] + (bonus ? 1 : 0)} ${RESDEF[firstOut].nom}`,
          col: bonus ? "#9dff70" : RESDEF[firstOut].col
        });
      }
    }
  }

  /* ---- robots (port de robots.js, rayon sphérique 3D) ---- */
  private updateRobots(dt: number): void {
    const S = this.S;
    const itv = this.robotItv();
    const ratio = this.power.ratio;
    for (const r of S.robots) {
      if (r.done) continue;
      r.t += dt * (0.35 + 0.65 * ratio);
      if (r.t < itv) continue;
      r.t = 0;
      const R = this.robotRad();
      let best: { x: number; z: number; d: number; id: number } | null = null;
      let bd = 1e9;
      for (let d = r.d - R; d <= r.d + R; d++)
        for (let z = r.z - R; z <= r.z + R; z++)
          for (let x = r.x - R; x <= r.x + R; x++) {
            const id = tile(S, x, z, d);
            const def = T[id];
            if (def && def.res) {
              const dist = (x - r.x) ** 2 + (z - r.z) ** 2 + (d - r.d) ** 2;
              if (dist < bd) { bd = dist; best = { x, z, d, id }; }
            }
          }
      if (!best) {
        r.done = true;
        this.toast(`🤖 Robot n°${r.n} : filon épuisé. Interagissez pour le rapatrier.`, "info", `🤖 Robot #${r.n}: vein exhausted. Interact to recall it.`);
        continue;
      }
      if (this.storeFree() <= 0) { r.full = true; r.t = itv * 0.8; continue; }
      r.full = false;
      const res = T[best.id].res!;
      this.gain(res, 1);
      S.stats.mined[res] = (S.stats.mined[res] || 0) + 1;
      setTile(S, best.x, best.z, best.d, 0);
      this.deltas.push(best.x, best.z, best.d, 0);
      r.lastX = best.x; r.lastZ = best.z; r.lastD = best.d;
    }
  }

  /* ---- faune (port 3D de creatures.js ; distances originales ×2 m) ---- */
  private creatureCap(): number {
    return Math.max(1, Math.round(4 * this.diff().mob)) + Math.max(0, this.players.size - 1) * 2;
  }
  private nearestPlayer(x: number, y: number, z: number): { p: SimPlayer; dist: number } | null {
    let best: SimPlayer | null = null, bd = 1e9;
    for (const [, p] of this.players) {
      const d = Math.hypot(p.x - x, p.y - y, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { p: best, dist: bd } : null;
  }
  private solid(mx: number, my: number, mz: number): boolean {
    return !isPassableId(tile(this.S, Math.floor(mx / VOX), Math.floor(mz / VOX), rowOfY(my)));
  }
  private warnType(type: string): void {
    const S = this.S;
    if (S.mobWarn[type]) return;
    S.mobWarn[type] = 1;
    if (type === "traqueur") {
      this.toast("☣ Traqueur détecté — rapide et coriace !", "bad", "☣ Stalker detected — fast and tough!");
      this.say("Un Traqueur, pilote ! Bien plus rapide et résistant. Gardez de la vitesse pour l'écraser, ou usez du répulseur sonique.", 10, "A Stalker, pilot! Much faster and tougher. Keep your speed up to crush it, or use the sonic repeller.");
    } else if (type === "cracheur") {
      this.toast("☣ Cracheur détecté — attaque à distance !", "bad", "☣ Spitter detected — ranged attack!");
      this.say("Un Cracheur ! Il bombarde de projectiles à distance. Foncez dessus pour l'écraser vite, ou esquivez ses tirs.", 10, "A Spitter! It lobs projectiles from range. Rush it down fast, or dodge its shots.");
    } else {
      this.toast("☣ Créature bioluminescente détectée !", "bad", "☣ Bioluminescent creature detected!");
      this.say("Attention pilote, une forme de vie hostile ! Foncez dedans avec la foreuse pour l'écraser, ou fuyez au jetpack. Une bonne coque encaissera mieux.", 11, "Careful pilot, a hostile lifeform! Ram it with the pod to crush it, or flee with the jetpack. A good hull takes it better.");
    }
  }
  private spawnNear(ax: number, ay: number, az: number, depthMval: number): boolean {
    const S = this.S;
    for (let tries = 0; tries < 24; tries++) {
      const ang = Math.random() * 6.2832;
      const r = 16 + Math.random() * 12;
      const x = ax + Math.cos(ang) * r;
      const z = az + Math.sin(ang) * r;
      const y = ay + (Math.random() - 0.5) * 10;
      const d = rowOfY(y);
      if (d < SURF + 4 || d >= S.worldH - 2) continue;
      if (this.solid(x, y, z)) continue;
      if (Math.hypot(x - ax, y - ay, z - az) < 14) continue;
      let type = "rampant";
      if (depthMval >= 150 && Math.random() < 0.25) type = "cracheur";
      else if (depthMval >= 120 && Math.random() < 0.45) type = "traqueur";
      const M = MOBS[type];
      S.creatures.push({ x, y, z, vx: 0, vy: 0, vz: 0, hp: M.hp, max: M.hp, ph: Math.random() * 6.28, hit: 0, fire: 1.5, type });
      return true;
    }
    return false;
  }
  private killCreature(i: number): void {
    const S = this.S;
    const c = S.creatures[i];
    const M = MOBS[c.type] ?? MOBS.rampant;
    this.gain("biogel", M.biogel);
    S.stats.creatures = (S.stats.creatures || 0) + 1;
    this.ev({ t: "mobkill", x: c.x, y: c.y, z: c.z, body: M.body });
    this.ev({ t: "floater", x: c.x, y: c.y + 0.6, z: c.z, txt: `+${M.biogel} Biogel`, col: "#b98dff" });
    S.creatures.splice(i, 1);
  }
  private updateCreatures(dt: number): void {
    const S = this.S;
    if (!this.players.size) return;

    /* la faune fuit la lumière de la surface */
    let anyDeep = false;
    for (const [, p] of this.players) if (depthM(p.y) > 6) anyDeep = true;
    if (!anyDeep) { S.creatures.length = 0; S.projectiles.length = 0; return; }

    /* projectiles */
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const pr = S.projectiles[i];
      pr.t += dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      if (pr.t >= pr.life || this.solid(pr.x, pr.y, pr.z)) { S.projectiles.splice(i, 1); continue; }
      const near = this.nearestPlayer(pr.x, pr.y, pr.z);
      if (near && near.dist < 1.5) {
        if (near.p.inDrill) this.hurt(near.p.id, 8, 0);
        else this.hurt(near.p.id, 0, 10);
        this.ev({ t: "hitfx", x: pr.x, y: pr.y, z: pr.z });
        S.projectiles.splice(i, 1);
      }
    }

    /* apparitions progressives */
    this.creSpawnT += dt;
    if (S.creatures.length < this.creatureCap() && this.creSpawnT > 2.5) {
      const deep = [...this.players.values()].filter(p => depthM(p.y) > 40);
      if (deep.length && Math.random() < 0.5 * this.diff().mob) {
        const p = deep[(Math.random() * deep.length) | 0];
        if (this.spawnNear(p.x, p.y, p.z, depthM(p.y))) this.creSpawnT = 0;
      }
    }

    /* répulseur sonique */
    let pulses: Array<{ x: number; y: number; z: number }> = [];
    if (this.hasR("sonique") && S.creatures.length) {
      this.sonicT += dt;
      if (this.sonicT > 2.2) {
        this.sonicT = 0;
        for (const [, p] of this.players) {
          if (!p.inDrill) continue;
          pulses.push({ x: p.x, y: p.y, z: p.z });
          this.ev({ t: "sonic", x: p.x, y: p.y, z: p.z });
          for (const nst of S.nests) {
            if (Math.hypot(p.x - nst.x, p.y - nst.y, p.z - nst.z) < 9.6) nst.hp -= 13;
          }
        }
      }
    }

    for (let i = S.creatures.length - 1; i >= 0; i--) {
      const c = S.creatures[i];
      const M = MOBS[c.type] ?? MOBS.rampant;
      c.ph += dt * 3; c.hit -= dt; c.fire -= dt;
      const near = this.nearestPlayer(c.x, c.y, c.z);
      if (!near) continue;
      const { p, dist } = near;
      if (dist > 52) { S.creatures.splice(i, 1); continue; }
      const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
      const dn = dist || 0.001;

      if (dist < 14) this.warnType(c.type);

      for (const pu of pulses) {
        const pd = Math.hypot(c.x - pu.x, c.y - pu.y, c.z - pu.z);
        if (pd < 9.2) {
          c.hp -= 13;
          c.vx -= (pu.x - c.x) / Math.max(pd, 0.1) * -14;
          c.vy -= (pu.y - c.y) / Math.max(pd, 0.1) * -14;
          c.vz -= (pu.z - c.z) / Math.max(pd, 0.1) * -14;
        }
      }

      const aggroR = M.aggro * VOX;
      const aggro = dist < aggroR ? 1 - dist / aggroR : 0;
      let tx: number, ty: number, tz: number;
      if (M.ranged) {
        const want = 12;
        const push = dist < want ? -1 : dist > want + 4 ? 0.7 : 0;
        tx = Math.cos(c.ph * 0.7) * 0.6 + (dx / dn) * push;
        ty = Math.sin(c.ph * 1.1) * 0.4 + (dy / dn) * push;
        tz = Math.sin(c.ph * 0.7) * 0.6 + (dz / dn) * push;
        if (dist < aggroR && c.fire <= 0 && dist > 3) {
          c.fire = 2.6;
          const sp = 14;
          S.projectiles.push({ x: c.x, y: c.y, z: c.z, vx: (dx / dn) * sp, vy: (dy / dn) * sp, vz: (dz / dn) * sp, t: 0, life: 2.2 });
        }
      } else {
        tx = Math.cos(c.ph * 0.7) * 0.64 + (dx / dn) * aggro * 1.9;
        ty = Math.sin(c.ph * 0.9) * 0.5 + (dy / dn) * aggro * 1.9;
        tz = Math.sin(c.ph * 0.8) * 0.64 + (dz / dn) * aggro * 1.9;
      }
      c.vx += tx * dt * 5.2; c.vy += ty * dt * 5.2; c.vz += tz * dt * 5.2;
      const damp = Math.pow(0.02, dt);
      c.vx *= damp; c.vy *= damp; c.vz *= damp;
      const spd = Math.hypot(c.vx, c.vy, c.vz);
      const smax = M.spd * VOX;
      if (spd > smax) { c.vx = c.vx / spd * smax; c.vy = c.vy / spd * smax; c.vz = c.vz / spd * smax; }

      let nx = c.x + c.vx * dt, ny = c.y + c.vy * dt, nz = c.z + c.vz * dt;
      if (this.solid(nx, c.y, c.z)) { c.vx = -c.vx * 0.5; nx = c.x; }
      if (this.solid(c.x, ny, c.z)) { c.vy = -c.vy * 0.5; ny = c.y; }
      if (this.solid(c.x, c.y, nz)) { c.vz = -c.vz * 0.5; nz = c.z; }
      c.x = nx; c.y = ny; c.z = nz;

      /* contact */
      if (dist < 1.7) {
        if (p.inDrill) {
          this.hurt(p.id, M.dmgDrill * dt, 0);
          const spdT = p.speed / VOX;
          c.hp -= (spdT > 2 ? spdT * 7 : 1.6) * dt;
          c.vx -= (dx / dn) * dt * 20; c.vy -= (dy / dn) * dt * 20; c.vz -= (dz / dn) * dt * 20;
        } else {
          this.hurt(p.id, 0, M.dmgFoot * dt);
          c.vx -= (dx / dn) * dt * 12; c.vy -= (dy / dn) * dt * 12; c.vz -= (dz / dn) * dt * 12;
        }
      }

      if (c.hp <= 0) this.killCreature(i);
    }
  }

  /* ---- nids (port 3D de nests.js) ---- */
  private updateNests(dt: number): void {
    const S = this.S;
    if (!S.nests.length || !this.players.size) return;
    for (let i = S.nests.length - 1; i >= 0; i--) {
      const nst = S.nests[i];
      nst.ph += dt * 2; nst.hit -= dt;
      const near = this.nearestPlayer(nst.x, nst.y, nst.z);
      if (!near) continue;
      const { p, dist } = near;
      nst.awake = dist < 32;
      if (!nst.awake) continue;

      if (dist < 22 && !S.nestWarn) {
        S.nestWarn = 1;
        this.toast("Nid de Rampants détecté !", "bad", "Crawler nest detected!");
        this.say("Un nid, pilote ! Il pond des Rampants sans fin. Détruisez-le en fonçant dedans avec la foreuse (ou au répulseur sonique) — il regorge de biogel.", 12, "A nest, pilot! It spawns Crawlers endlessly. Destroy it by ramming it with the pod (or the sonic repeller) — it's full of biogel.");
      }

      nst.spawnT -= dt;
      if (nst.spawnT <= 0) {
        nst.spawnT = Math.max(2.2, 4.5 / this.diff().mob);
        if (S.creatures.length < this.creatureCap() + 3) {
          const ang = Math.random() * 6.2832;
          const sx = nst.x + Math.cos(ang) * 3.2, sz = nst.z + Math.sin(ang) * 3.2;
          const dM = depthM(nst.y);
          const type = dM >= 150 && Math.random() < 0.3 ? "cracheur" : Math.random() < 0.5 ? "traqueur" : "rampant";
          const M = MOBS[type];
          S.creatures.push({ x: sx, y: nst.y + 1, z: sz, vx: 0, vy: 0, vz: 0, hp: M.hp, max: M.hp, ph: Math.random() * 6.28, hit: 0, fire: 1, type });
        }
      }

      if (dist < 2.8) {
        if (p.inDrill) {
          this.hurt(p.id, 11 * dt, 0);
          const spdT = p.speed / VOX;
          nst.hp -= (spdT > 2 ? spdT * 8 : 3) * dt;
        } else {
          this.hurt(p.id, 0, 7 * dt);
        }
      }

      if (nst.hp <= 0) {
        const bio = 14 + Math.floor(Math.random() * 6);
        this.gain("biogel", bio);
        this.gain("cristal", 2);
        S.stats.nests = (S.stats.nests || 0) + 1;
        this.ev({ t: "nestkill", x: nst.x, y: nst.y, z: nst.z, bio });
        this.say("Nid neutralisé, beau travail pilote ! Cette poche des profondeurs est nettoyée.", 9, "Nest neutralized, great work pilot! This pocket of the depths is cleansed.");
        S.nests.splice(i, 1);
      }
    }
  }

  /* ---- paliers de profondeur (prime commune, SAM) ---- */
  private updateMilestones(): void {
    const S = this.S;
    let deepest = 0;
    for (const [, p] of this.players) deepest = Math.max(deepest, depthM(p.y));
    if (deepest > S.deepest) S.deepest = Math.floor(deepest);
    for (const d of DEPTHS) {
      if (deepest >= d.m && !S.milestones[d.m]) {
        S.milestones[d.m] = 1;
        this.say(d.sam, 9, d.samEn);
        const parts: string[] = [];
        for (const r in d.gift) { this.gain(r, d.gift[r]); parts.push(`+${d.gift[r]} ${RESDEF[r].nom}`); }
        this.toast(`⛏ ${d.m} m atteints — prime : ${parts.join(", ")}`, "ok", `⛏ ${d.m} m reached — bonus: ${parts.join(", ")}`);
        this.ev({ t: "milestone", m: d.m });
      }
    }
  }

  /* ---- quêtes (conditions par index, port de data.js) ---- */
  private questCond(qi: number): boolean {
    const S = this.S;
    const mined = S.stats.mined, made = S.stats.made;
    const maxForet = Math.max(1, ...[...this.players.values()].map(p => p.up.foret || 1));
    switch (qi) {
      case 0: return [...this.players.values()].some(p => p.inDrill);
      case 1: return (mined.fer || 0) >= 5 && (mined.charbon || 0) >= 5;
      case 2: return this.hasB("generateur") && this.hasB("fonderie");
      case 3: return (made.lingot_fer || 0) >= 4;
      case 4: return this.hasB("atelier") && maxForet >= 2;
      case 5: return S.robots.length >= 1;
      case 6: return S.robots.filter(r => !r.done).length >= 3 && (made.acier || 0) >= 5;
      case 7: return (mined.cristal || 0) >= 3;
      case 8: return this.rocketReady();
      case 9: return false;
      case 10: return (mined.magmatite || 0) >= 6;
      case 11: return maxForet >= 5 && (mined.iridium || 0) >= 8;
      case 12: return this.rocketReady();
      case 13: return false;
    }
    return false;
  }
  /** Progression textuelle d'une quête (affichage HUD). */
  questProg(qi: number): string | null {
    const maxForet = Math.max(1, ...[...this.players.values()].map(p => p.up.foret || 1));
    return questProgress(this.S, this.repairedCount(), maxForet, qi);
  }
  private updateQuests(dt: number): void {
    this.questAcc += dt;
    if (this.questAcc < 0.35) return;
    this.questAcc = 0;
    const S = this.S;
    const q = QUESTS[S.qi];
    if (!q || !this.questCond(S.qi)) return;
    if (q.gift) {
      const txt: string[] = [];
      for (const r in q.gift) { this.gain(r, q.gift[r]); txt.push(`+${q.gift[r]} ${RESDEF[r].nom}`); }
      this.toast(`🎁 Récompense : ${txt.join(", ")}`, "ok", `🎁 Reward: ${txt.join(", ")}`);
    }
    this.toast("🎯 Objectif accompli !", "ok", "🎯 Objective complete!");
    this.ev({ t: "questDone", qi: S.qi });
    S.qi++;
    const nq = QUESTS[S.qi];
    if (nq) this.say(nq.sam, 14, nq.samEn);
  }

  /* ---- événements de monde : séismes, météorites, tempêtes ---- */
  private updateWorldEvents(dt: number): void {
    const S = this.S;

    S.quakeT -= dt;
    if (S.quakeT <= 0) {
      S.quakeT = 150 + Math.random() * 90;
      const before = S.edits.length;
      const made = seismicVeins(S);
      /* les nouveaux filons partent en deltas pour les clients */
      for (let i = before; i + 3 < S.edits.length; i += 4) {
        this.deltas.push(S.edits[i], S.edits[i + 1], S.edits[i + 2], S.edits[i + 3]);
      }
      if (made > 0) {
        this.ev({ t: "quake" });
        this.toast("🌋 Secousse sismique — de nouveaux filons affleurent dans la roche !", "info", "🌋 Seismic tremor — new veins surface in the rock!");
        if (!S.quakeSam) {
          S.quakeSam = 1;
          this.say("Activité sismique détectée ! Bonne nouvelle, pilote : KEPLER-9b régénère ses filons en permanence — les ressources ne s'épuiseront jamais. Guettez les secousses.", 11, "Seismic activity detected! Good news, pilot: KEPLER-9b constantly regenerates its veins — resources will never run out. Watch for tremors.");
        }
      }
    }

    /* météorites nocturnes */
    if (!this.meteorEv && this.daylight < 0.08 && Math.random() < dt * 0.015) {
      const tx = 6 + Math.random() * (W - 14);
      const tz = 6 + Math.random() * (W - 14);
      this.meteorEv = { tx, tz, t: 2.4 };
      this.ev({ t: "meteor", x: tx, z: tz });
    }
    if (this.meteorEv) {
      this.meteorEv.t -= dt;
      if (this.meteorEv.t <= 0) {
        const M = this.meteorEv;
        this.meteorEv = null;
        S.debris.push({ x: M.tx, z: M.tz, t: 120, ti: 3 + Math.floor(Math.random() * 4), fe: 4 + Math.floor(Math.random() * 4) });
        this.ev({ t: "boom", x: M.tx * VOX, y: 1, z: M.tz * VOX });
        this.toast("☄️ Météorite écrasée en surface — récupérez ses débris !", "warn", "☄️ Meteorite crashed at the surface — grab its debris!");
        this.say("Impact météoritique détecté ! Ces débris regorgent de titane — ramassez-les avant qu'ils ne s'effritent.", 9, "Meteorite impact detected! That debris is packed with titanium — collect it before it crumbles.");
      }
    }
    for (let i = S.debris.length - 1; i >= 0; i--) {
      S.debris[i].t -= dt;
      if (S.debris[i].t <= 0) S.debris.splice(i, 1);
    }

    /* tempêtes de sable */
    if (!S.storm && !this.meteorEv && this.daylight > 0.2 &&
      Math.random() < dt * 0.006 * this.diff().storm * (this.hasR("bouclier") ? 0.5 : 1)) {
      S.storm = { t: 0, dur: 16 + Math.random() * 14 };
      this.ev({ t: "storm", on: true });
      this.toast("🌪️ Tempête de sable en approche !", "warn", "🌪️ Sandstorm incoming!");
      this.say("Tempête de sable ! Les panneaux solaires vont être aveuglés — comptez sur vos générateurs et réacteurs.", 9, "Sandstorm! Solar panels are about to be blinded — rely on your generators and reactors.");
    }
    if (S.storm) {
      S.storm.t += dt;
      if (S.storm.t >= S.storm.dur) {
        S.storm = null;
        this.ev({ t: "storm", on: false });
        this.toast("Éclaircie — la tempête est passée.", "ok", "Clear skies — the storm has passed.");
      }
    }
  }

  /* ---- décollage : Acte I condamné (crash → abysses), Acte II = victoire ---- */
  private updateLaunch(dt: number): void {
    if (!this.launch) return;
    this.launch.t += dt;
    const T2 = this.launch.t;
    if (this.launch.act === 1 && T2 >= 5.9) {
      this.launch = null;
      this.act2Crash();
    } else if (this.launch.act === 2 && T2 >= 7) {
      this.launch = null;
      const S = this.S;
      S.launched = true;
      S.qi = QUESTS.length;
      S.storm = null;
      this.ev({ t: "win" });
    }
  }
  private act2Crash(): void {
    const S = this.S;
    S.act = 2;
    deepenWorld(S);
    S.rocketFix = {}; S.rocketDel = {};
    for (const sys of ROCKET2) { S.rocketFix[sys.key] = false; S.rocketDel[sys.key] = {}; }
    S.qi = ACT2_QI;
    this.resyncFlag = true;
    this.ev({ t: "act2" });
    this.toast("💥 Crash… au même endroit. La base est intacte — et le choc a OUVERT LES ABYSSES.", "bad", "💥 Crash… same spot. The base is intact — and the impact OPENED THE ABYSS.");
    const q = QUESTS[S.qi];
    if (q) this.say(q.sam, 17, q.samEn);
  }

  /* ================= sérialisation ================= */

  serialize(): Snapshot {
    const S = this.S;
    return {
      v: SNAPSHOT_V,
      seed: S.seed, act: S.act, diff: S.diff, worldH: S.worldH,
      edits: S.edits.slice(),
      store: { ...S.store },
      builds: S.builds.map(b => ({ ...b, pending: b.pending ? { ...b.pending } : null })),
      robots: S.robots.map(r => ({ ...r })),
      robotsOwned: S.robotsOwned, baieLvl: S.baieLvl, robotSpd: S.robotSpd,
      rocketFix: { ...S.rocketFix },
      rocketDel: JSON.parse(JSON.stringify(S.rocketDel)),
      research: { ...S.research },
      qi: S.qi, time: S.time, dayT: S.dayT,
      stats: JSON.parse(JSON.stringify(S.stats)),
      battE: S.battE, launched: S.launched,
      quakeT: S.quakeT, quakeSam: S.quakeSam,
      nests: S.nests.map(n => ({ ...n })),
      milestones: { ...S.milestones },
      deepest: S.deepest,
      mobWarn: { ...S.mobWarn },
      nestWarn: S.nestWarn
    };
  }
  fullSnapshot(): Snapshot { return this.serialize(); }

  /** Reconstruit un état complet depuis un snapshot (grille regénérée par seed + rejouée). */
  static restore(snap: Snapshot): SharedState {
    const S = initialState(snap.seed, snap.diff ?? "normal");
    S.edits = (snap.edits ?? []).slice();
    S.act = snap.act ?? 1;
    if (S.act >= 2) {
      deepenWorld(S); // rejoue aussi S.edits sur la grille étendue
    } else {
      for (let i = 0; i + 3 < S.edits.length; i += 4) {
        S.grid[((S.edits[i + 2] * W + S.edits[i + 1]) * W + S.edits[i])] = S.edits[i + 3];
      }
    }
    S.store = snap.store ?? {};
    S.builds = snap.builds ?? [];
    S.robots = snap.robots ?? [];
    S.robotsOwned = snap.robotsOwned ?? 0;
    S.baieLvl = snap.baieLvl ?? 1;
    S.robotSpd = snap.robotSpd ?? 1;
    S.rocketFix = snap.rocketFix ?? {};
    S.rocketDel = snap.rocketDel ?? {};
    S.research = snap.research ?? {};
    S.qi = snap.qi ?? 0;
    S.time = snap.time ?? 0;
    S.dayT = snap.dayT ?? 0;
    S.stats = snap.stats ?? { mined: {}, made: {}, robots: 0, rescues: 0 };
    S.battE = snap.battE ?? 0;
    S.launched = !!snap.launched;
    S.quakeT = snap.quakeT ?? 55;
    S.quakeSam = snap.quakeSam ?? 0;
    S.nests = snap.nests ?? [];
    S.milestones = snap.milestones ?? {};
    S.deepest = snap.deepest ?? 0;
    S.mobWarn = snap.mobWarn ?? {};
    S.nestWarn = snap.nestWarn ?? 0;
    return S;
  }
}
