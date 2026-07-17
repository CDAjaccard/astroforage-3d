/* ASTRO·FORAGE 3D — serveur coop temps réel (monde autoritatif).
 *
 * Chaque salle possède une GameSim (la même que le solo). Les clients envoient
 * des INTENTIONS, reçoivent deltas de voxels, positions, faune, événements et
 * état « base » périodique. Mondes persistés sur disque (server/data/rooms).
 *
 * Lancement :  npm start   (http + ws sur :8080)
 * Sert aussi le client construit (client/dist) s'il existe — comme l'original.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import url from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import {
  GameSim, type Snapshot, type SimPlayer,
  MAX_PLAYERS, TICK_MS, BASE_EVERY, DEFAULT_PORT,
  sanitizeRoom, sanitizeName, sanitizeCos
} from "@astroforage/shared";

const PORT = Number(process.env.PORT || DEFAULT_PORT);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
const DATA_DIR = path.resolve(__dirname, "../data/rooms");
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------------- salles ---------------- */

interface NetPlayer {
  ws: WebSocket;
  sp: SimPlayer;
  st: any;              // dernier état d'avatar reçu
  prevX?: number; prevY?: number; prevZ?: number;
}
interface Room {
  code: string;
  sim: GameSim;
  players: Map<number, NetPlayer>;
  tick: number;
  passHash: string | null;
  hadMobs: boolean;
}

const rooms = new Map<string, Room>();
let nextId = 1;

const roomFile = (code: string) => path.join(DATA_DIR, code + ".json");
function loadRoomSave(code: string): (Snapshot & { passHash?: string }) | null {
  try { return JSON.parse(fs.readFileSync(roomFile(code), "utf8")); } catch { return null; }
}
function roomData(room: Room): Snapshot {
  const o = room.sim.serialize();
  if (room.passHash) o.passHash = room.passHash;
  return o;
}
function saveRoom(room: Room): void {
  try {
    const tmp = roomFile(room.code) + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(roomData(room)));
    fs.renameSync(tmp, roomFile(room.code));
  } catch (e) { console.error(`[salle ${room.code}] sauvegarde échouée`, e); }
}
function saveAll(): void { for (const [, r] of rooms) saveRoom(r); }

const hashPass = (p: string) => crypto.createHash("sha256").update("af-room:" + p).digest("hex");
const passOK = (p: string | undefined, hash: string | null) => !!p && !!hash && hashPass(p) === hash;

function getRoom(code: string): Room {
  let r = rooms.get(code);
  if (!r) {
    const saved = loadRoomSave(code);
    const sim = saved ? new GameSim(null, saved.diff ?? "normal", saved) : new GameSim(null, "normal");
    r = { code, sim, players: new Map(), tick: 0, passHash: saved?.passHash ?? null, hadMobs: false };
    rooms.set(code, r);
    console.log(`[salle ${code}] ${saved ? "restaurée depuis le disque" : "créée"} (seed ${sim.S.seed})${r.passHash ? " 🔒" : ""}`);
  }
  return r;
}

function send(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function broadcast(room: Room, obj: unknown): void {
  const s = JSON.stringify(obj);
  for (const [, p] of room.players) if (p.ws.readyState === WebSocket.OPEN) p.ws.send(s);
}
function dropPlayer(ws: WebSocket & { player?: { id: number; room: string } }): void {
  const pl = ws.player;
  if (!pl) return;
  ws.player = undefined;
  const room = rooms.get(pl.room);
  if (!room) return;
  room.players.delete(pl.id);
  room.sim.removePlayer(pl.id);
  console.log(`[salle ${pl.room}] joueur ${pl.id} parti (${room.players.size} restant·s)`);
  if (room.players.size === 0) {
    saveRoom(room);
    rooms.delete(pl.room);
    console.log(`[salle ${pl.room}] vide — sauvegardée et fermée`);
  }
}

/* ---------------- HTTP : /api/rooms + client statique ---------------- */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".wasm": "application/wasm"
};

function publicApi(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const urlPath = (req.url || "").split("?")[0];
  if (urlPath !== "/api/rooms" || req.method !== "GET") return false;
  const out: any[] = [];
  const seen = new Set<string>();
  for (const [code, room] of rooms) {
    seen.add(code);
    if (!room.passHash) out.push({ code, active: true, players: room.players.size, act: room.sim.S.act, max: MAX_PLAYERS });
  }
  try {
    for (const f of fs.readdirSync(DATA_DIR)) {
      if (!f.endsWith(".json")) continue;
      const code = f.replace(/\.json$/, "");
      if (seen.has(code)) continue;
      try {
        const d = JSON.parse(fs.readFileSync(roomFile(code), "utf8"));
        if (!d.passHash) out.push({ code, active: false, players: 0, act: d.act || 1, max: MAX_PLAYERS });
      } catch { /* fichier illisible : ignoré */ }
    }
  } catch { /* pas de dossier data */ }
  out.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || b.players - a.players || a.code.localeCompare(b.code));
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify({ rooms: out }));
  return true;
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  if (urlPath.split("/").some(s => s.startsWith("."))) { res.writeHead(404); res.end("Not found"); return; }
  const filePath = path.normalize(path.join(CLIENT_DIST, urlPath));
  if (!filePath.startsWith(CLIENT_DIST)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ASTRO·FORAGE 3D — serveur coop actif.\nClient non construit : lancez `npm run build` puis rechargez, ou utilisez le serveur de dev Vite (npm run dev).");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (publicApi(req, res)) return;
  serveStatic(req, res);
});

/* ---------------- WebSocket ---------------- */

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket & { player?: { id: number; room: string }; isAlive?: boolean }) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (buf) => {
    let m: any;
    try { m = JSON.parse(String(buf)); } catch { return; }

    if (m.t === "join") {
      if (ws.player) return;
      const code = sanitizeRoom(m.room);
      const existed = rooms.has(code) || fs.existsSync(roomFile(code));
      const room = getRoom(code);
      if (existed) {
        if (room.passHash && !passOK(m.pass, room.passHash)) {
          send(ws, { t: "denied", reason: "password" });
          if (room.players.size === 0) rooms.delete(code);
          return;
        }
      } else {
        room.passHash = m.pass ? hashPass(String(m.pass)) : null;
      }
      if (room.players.size >= MAX_PLAYERS) { send(ws, { t: "full", max: MAX_PLAYERS }); return; }
      const id = nextId++;
      const name = sanitizeName(m.name, id);
      const sp = room.sim.addPlayer(id, name, sanitizeCos(m.cos));
      room.players.set(id, { ws, sp, st: null });
      ws.player = { id, room: code };
      send(ws, { t: "welcome", id, room: code, max: MAX_PLAYERS, snap: room.sim.fullSnapshot() });
      console.log(`[salle ${code}] joueur ${id} « ${name} » rejoint (${room.players.size}/${MAX_PLAYERS})`);
    } else if (m.t === "s") {
      const pl = ws.player;
      if (!pl) return;
      const room = rooms.get(pl.room);
      const p = room?.players.get(pl.id);
      if (p) p.st = m;
    } else if (m.t === "intent") {
      const pl = ws.player;
      if (!pl) return;
      const room = rooms.get(pl.room);
      const p = room?.players.get(pl.id);
      if (!room || !p) return;
      let ack: Record<string, any> | null = null;
      try { ack = room.sim.applyIntent(p.sp, m); }
      catch (e) { console.error("intent", m.i, e); }
      if (ack) send(ws, { t: "ack", i: m.i, ...ack });
    }
  });

  ws.on("close", () => dropPlayer(ws));
  ws.on("error", () => { try { ws.close(); } catch { /* déjà fermé */ } });
});

/* ---------------- boucle de simulation + diffusion ---------------- */

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) dt = TICK_MS / 1000;

  for (const [, room] of rooms) {
    if (room.players.size === 0) continue;
    const sim = room.sim;

    for (const [id, p] of room.players) {
      if (!p.st) continue;
      const { x = 0, y = 0, z = 0 } = p.st;
      let speed = 0;
      if (p.prevX !== undefined) speed = Math.hypot(x - p.prevX!, y - p.prevY!, z - p.prevZ!) / Math.max(dt, 0.001);
      p.prevX = x; p.prevY = y; p.prevZ = z;
      sim.setPlayerPos(id, x, y, z, !!p.st.d, speed);
    }

    try { sim.step(dt); } catch (e) { console.error("[sim]", room.code, e); }

    const dmg = sim.drainDamage();
    if (dmg) for (const [id, d] of dmg) {
      const p = room.players.get(id);
      if (p && (d.drill > 0 || d.foot > 0)) send(p.ws, { t: "hurt", drill: +d.drill.toFixed(2), foot: +d.foot.toFixed(2) });
    }

    room.tick++;

    const players: Record<string, any> = {};
    for (const [id, p] of room.players) {
      const s = p.st || {};
      players[id] = {
        name: p.sp.name, cos: p.sp.cos,
        x: s.x || 0, y: s.y || 0, z: s.z || 0,
        yaw: s.yaw || 0, pitch: s.pitch || 0,
        d: s.d || 0, g: s.g || 0, j: s.j || 0, dg: s.dg || 0, b: s.b || 0, a: s.a || 0
      };
    }
    broadcast(room, { t: "players", players });

    const S = sim.S;
    const hasMobs = S.creatures.length > 0 || S.projectiles.length > 0 || S.nests.some(n => n.awake);
    if (hasMobs || room.hadMobs) {
      broadcast(room, { t: "mobs", creatures: S.creatures, projectiles: S.projectiles, nests: S.nests });
      room.hadMobs = hasMobs;
    }

    const dels = sim.drainTileDeltas();
    if (dels) broadcast(room, { t: "world", d: dels });

    const ev = sim.drainEvents();
    if (ev) broadcast(room, { t: "events", ev });

    if (sim.drainResync()) broadcast(room, { t: "resync", snap: sim.fullSnapshot() });

    if (room.tick % BASE_EVERY === 0) {
      broadcast(room, {
        t: "base",
        base: {
          store: S.store, builds: S.builds, robots: S.robots,
          robotsOwned: S.robotsOwned, baieLvl: S.baieLvl, robotSpd: S.robotSpd,
          rocketFix: S.rocketFix, rocketDel: S.rocketDel, research: S.research,
          stats: S.stats, qi: S.qi, battE: S.battE, dayT: S.dayT,
          power: sim.power, storm: !!S.storm, daylight: sim.daylight, debris: S.debris
        }
      });
    }
  }
}, TICK_MS);

/* sauvegarde périodique + keepalive */
setInterval(() => { for (const [, room] of rooms) if (room.players.size > 0) saveRoom(room); }, 30000);
setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) { dropPlayer(ws); return ws.terminate(); }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* socket morte */ }
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`ASTRO·FORAGE 3D — serveur coop (monde autoritatif) : http + ws sur http://localhost:${PORT}`);
});

process.on("SIGINT", () => { saveAll(); process.exit(0); });
process.on("SIGTERM", () => { saveAll(); process.exit(0); });
