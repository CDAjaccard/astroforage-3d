/* ASTRO·FORAGE 3D — protocole coop (JSON sur WebSocket).
 * Même modèle que l'original : intentions client -> état autoritatif serveur. */
import type { AvatarWire, Cosmetic, GameEvent, Snapshot } from "./types.js";

export const PROTOCOL_V = 1;
export const DEFAULT_PORT = 8080;
export const MAX_PLAYERS = 4;
export const SEND_HZ = 18;          // diffusion de l'avatar par le client
export const TICK_MS = 33;          // simulation serveur ~30 Hz
export const BASE_EVERY = 8;        // état « base » toutes les ~264 ms

/* ---- client -> serveur ---- */
export interface MsgJoin { t: "join"; v?: number; room: string; name: string; pass?: string; cos: Cosmetic }
export interface MsgState extends AvatarWire { t: "s" }
export interface MsgIntent { t: "intent"; i: string; [k: string]: any }
export type ClientMsg = MsgJoin | MsgState | MsgIntent;

/* ---- serveur -> client ---- */
export interface WirePlayer extends AvatarWire { name: string; cos: Cosmetic }
export interface MsgWelcome { t: "welcome"; id: number; room: string; max: number; snap: Snapshot }
export interface MsgPlayers { t: "players"; players: Record<string, WirePlayer> }
export interface MsgWorld { t: "world"; d: number[] }        // [x,z,d,v,...]
export interface MsgBase {
  t: "base";
  base: {
    store: Record<string, number>;
    builds: any[];
    robots: any[];
    robotsOwned: number; baieLvl: number; robotSpd: number;
    rocketFix: Record<string, boolean>;
    rocketDel: Record<string, Record<string, number>>;
    research: Record<string, 1>;
    stats: any;
    qi: number;
    battE: number;
    dayT: number;
    power: { prod: number; dem: number; ratio: number; batt: number; battCap: number };
    storm: boolean;
    daylight: number;
    debris: any[];
  };
}
export interface MsgMobs { t: "mobs"; creatures: any[]; projectiles: any[]; nests: any[] }
export interface MsgHurt { t: "hurt"; drill: number; foot: number }
export interface MsgEvents { t: "events"; ev: GameEvent[] }
export interface MsgResync { t: "resync"; snap: Snapshot }
export interface MsgAck { t: "ack"; i: string; [k: string]: any }
export interface MsgFull { t: "full"; max: number }
export interface MsgDenied { t: "denied"; reason: string }
export interface MsgKicked { t: "kicked" }
export type ServerMsg =
  | MsgWelcome | MsgPlayers | MsgWorld | MsgBase | MsgMobs | MsgHurt
  | MsgEvents | MsgResync | MsgAck | MsgFull | MsgDenied | MsgKicked;

export function sanitizeRoom(code: unknown): string {
  return String(code ?? "KEPLER").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "KEPLER";
}
export function sanitizeName(name: unknown, id: number): string {
  const n = String(name ?? "").trim().slice(0, 20);
  return n || `Pilote ${id}`;
}
export function sanitizeCos(c: any): Cosmetic {
  const n = (v: any, m: number) => Math.max(0, Math.min(m, v | 0));
  return { suit: n(c?.suit, 15), visor: n(c?.visor, 15), accent: n(c?.accent, 15) };
}
