/* SimPort : la même interface pour le solo (GameSim locale, hors-ligne) et le
 * coop (réplique + WebSocket). Le Game ne fait pas la différence. */
import {
  GameSim, type GameEvent, type IntentMsg, type PlayerUp, type PowerInfo,
  type SharedState, type Snapshot, type SimPlayer, type WirePlayer, type DiffKey,
  DEFAULT_UP, DAYLEN, W, questProgress, UPGRADES, sanitizeCos
} from "@astroforage/shared";
import { settings } from "../config.js";

export interface SimPort {
  readonly mode: "solo" | "coop";
  readonly S: SharedState;
  readonly power: PowerInfo;
  readonly daylight: number;
  readonly myId: number;
  readonly myUp: PlayerUp;
  onEvents: (ev: GameEvent[]) => void;
  onTiles: (d: number[]) => void;
  onHurt: (drill: number, foot: number) => void;
  onResync: () => void;
  onAck: (m: any) => void;
  onPlayers: (players: Record<string, WirePlayer>) => void;
  onClosed: (reason: string) => void;
  intent(m: IntentMsg): void;
  sendAvatar(w: Record<string, unknown>): void;
  update(dt: number): void;
  questProg(qi: number): string | null;
  repairedCount(): number;
  serialize(): Snapshot | null;
  dispose(): void;
}

/* ---------------- SOLO ---------------- */

export class LocalSim implements SimPort {
  readonly mode = "solo" as const;
  sim: GameSim;
  readonly myId = 1;
  me: SimPlayer;
  onEvents: SimPort["onEvents"] = () => {};
  onTiles: SimPort["onTiles"] = () => {};
  onHurt: SimPort["onHurt"] = () => {};
  onResync: SimPort["onResync"] = () => {};
  onAck: SimPort["onAck"] = () => {};
  onPlayers: SimPort["onPlayers"] = () => {};
  onClosed: SimPort["onClosed"] = () => {};

  constructor(opts: { seed?: number; diff?: DiffKey; snap?: Snapshot; up?: PlayerUp }) {
    this.sim = opts.snap ? new GameSim(null, opts.snap.diff, opts.snap) : new GameSim(opts.seed ?? null, opts.diff ?? "normal");
    this.me = this.sim.addPlayer(this.myId, settings.nick || "Pilote", settings.cosmetic);
    if (opts.up) this.me.up = { ...opts.up };
  }
  get S(): SharedState { return this.sim.S; }
  get power(): PowerInfo { return this.sim.power; }
  get daylight(): number { return this.sim.daylight; }
  get myUp(): PlayerUp { return this.me.up; }

  intent(m: IntentMsg): void {
    const ack = this.sim.applyIntent(this.me, m);
    if (ack) this.onAck({ i: m.i, ...ack });
  }
  sendAvatar(w: any): void {
    this.sim.setPlayerPos(this.myId, w.x, w.y, w.z, !!w.d, w.spd ?? 0);
  }
  update(dt: number): void {
    this.sim.step(dt);
    const tiles = this.sim.drainTileDeltas();
    if (tiles) this.onTiles(tiles);
    const ev = this.sim.drainEvents();
    if (ev) this.onEvents(ev);
    const dmg = this.sim.drainDamage();
    if (dmg) {
      const d = dmg.get(this.myId);
      if (d && (d.drill > 0 || d.foot > 0)) this.onHurt(d.drill, d.foot);
    }
    if (this.sim.drainResync()) this.onResync();
  }
  questProg(qi: number): string | null { return this.sim.questProg(qi); }
  repairedCount(): number { return this.sim.repairedCount(); }
  serialize(): Snapshot { return this.sim.serialize(); }
  dispose(): void { /* rien à fermer en solo */ }
}

/* ---------------- COOP ---------------- */

export class NetSim implements SimPort {
  readonly mode = "coop" as const;
  S!: SharedState;                 // réplique (grille reconstruite du snapshot)
  power: PowerInfo = { prod: 0, dem: 0, ratio: 1, batt: 0, battCap: 0 };
  daylight = 1;
  myId = 0;
  myUp: PlayerUp = { ...DEFAULT_UP };
  room = "";
  onEvents: SimPort["onEvents"] = () => {};
  onTiles: SimPort["onTiles"] = () => {};
  onHurt: SimPort["onHurt"] = () => {};
  onResync: SimPort["onResync"] = () => {};
  onAck: SimPort["onAck"] = () => {};
  onPlayers: SimPort["onPlayers"] = () => {};
  onClosed: SimPort["onClosed"] = () => {};
  onWelcome: () => void = () => {};
  private ws: WebSocket | null = null;
  private sendAcc = 0;
  private closedFired = false;

  connect(url: string, room: string, name: string, pass: string | undefined,
    onFail: (reason: string) => void): void {
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { onFail("badurl"); return; }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: "join", room, name, pass: pass || undefined, cos: sanitizeCos(settings.cosmetic) }));
    };
    ws.onmessage = (e) => {
      let m: any;
      try { m = JSON.parse(String(e.data)); } catch { return; }
      switch (m.t) {
        case "welcome":
          this.myId = m.id;
          this.room = m.room;
          this.S = GameSim.restore(m.snap);
          this.onWelcome();
          break;
        case "players": this.onPlayers(m.players); break;
        case "world": {
          const d = m.d as number[];
          for (let i = 0; i + 3 < d.length; i += 4) {
            const [x, z, dd, v] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
            if (this.S && dd < this.S.worldH) this.S.grid[(dd * W + z) * W + x] = v;
          }
          this.onTiles(d);
          break;
        }
        case "base": {
          if (!this.S) break;
          const b = m.base;
          Object.assign(this.S, {
            store: b.store, builds: b.builds, robots: b.robots,
            robotsOwned: b.robotsOwned, baieLvl: b.baieLvl, robotSpd: b.robotSpd,
            rocketFix: b.rocketFix, rocketDel: b.rocketDel, research: b.research,
            stats: b.stats, battE: b.battE, dayT: b.dayT, debris: b.debris,
            decos: b.decos ?? this.S.decos
          });
          if (b.qi !== this.S.qi) this.S.qi = b.qi;
          this.S.storm = b.storm ? (this.S.storm ?? { t: 0, dur: 20 }) : null;
          this.power = b.power;
          this.daylight = b.daylight;
          break;
        }
        case "mobs":
          if (this.S) {
            this.S.creatures = m.creatures || [];
            this.S.projectiles = m.projectiles || [];
            this.S.nests = m.nests || [];
          }
          break;
        case "hurt": this.onHurt(m.drill || 0, m.foot || 0); break;
        case "events": this.onEvents(m.ev || []); break;
        case "resync":
          if (m.snap) {
            this.S = GameSim.restore(m.snap);
            this.onResync();
          }
          break;
        case "ack":
          if (m.i === "upgrade" && m.up) this.myUp[m.up.key as keyof PlayerUp] = m.up.lvl;
          this.onAck(m);
          break;
        case "full": onFail("full"); this.shutdown(); break;
        case "denied": onFail(m.reason === "password" ? "password" : "denied"); this.shutdown(); break;
        case "kicked": this.fireClosed("kicked"); this.shutdown(); break;
      }
    };
    ws.onerror = () => { if (!this.myId) onFail("error"); };
    ws.onclose = () => {
      if (this.myId) this.fireClosed("closed");
      else onFail("error");
    };
  }

  private fireClosed(reason: string): void {
    if (this.closedFired) return;
    this.closedFired = true;
    this.onClosed(reason);
  }
  private shutdown(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null; ws.onmessage = null; ws.onerror = null;
      try { ws.close(); } catch { /* déjà fermée */ }
    }
  }

  intent(m: IntentMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ ...m, t: "intent" }));
  }
  sendAvatar(w: any): void {
    /* throttle géré par Game (appel à SEND_HZ) */
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ ...w, t: "s" }));
  }
  update(dt: number): void {
    /* réplique : avance l'horloge du jour entre deux messages base */
    if (this.S) this.S.dayT += dt;
    this.sendAcc += dt;
  }
  questProg(qi: number): string | null {
    if (!this.S) return null;
    return questProgress(this.S, this.repairedCount(), Math.max(1, this.myUp.foret || 1), qi);
  }
  repairedCount(): number {
    if (!this.S) return 0;
    const list = this.S.act >= 2 ? "blindage propulsion thermo guidage carbu2" : "structure cablage avionique moteur carburant";
    return list.split(" ").filter(k => this.S.rocketFix[k]).length;
  }
  serialize(): Snapshot | null { return null; } // le serveur possède l'état
  dispose(): void { this.shutdown(); }
}

/** Vitesse d'un foret (niveau -> {h, sp}). */
export function foretStats(up: PlayerUp): { h: number; sp: number } {
  return UPGRADES.foret.vals[(up.foret || 1) - 1] as { h: number; sp: number };
}
export function upVal(up: PlayerUp, key: keyof PlayerUp): number {
  return UPGRADES[key].vals[(up[key] || 1) - 1] as number;
}
export function dayPhase(dayT: number): number { return (dayT % DAYLEN) / DAYLEN; }
