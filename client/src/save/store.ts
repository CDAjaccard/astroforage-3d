/* Sauvegardes solo multi-slots (localStorage) + export/import JSON + exploits
 * persistants — mêmes principes que le jeu original (save.js). */
import type { DiffKey, PlayerUp, Snapshot } from "@astroforage/shared";

export interface AvatarSave {
  up: PlayerUp;
  inv: Record<string, number>;
  pouch: number;
  astro: { x: number; y: number; z: number; o2: number; jp: number; inDrill: boolean };
  drill: { x: number; y: number; z: number; hp: number; en: number };
}
export interface SlotData { v: 1; snap: Snapshot; avatar: AvatarSave }
export interface SlotMeta { id: string; name: string; date: number; diff: DiffKey; act: number; time: number; launched: boolean }

const META_KEY = "af3d_slots";
const CUR_KEY = "af3d_slot_cur";

function readMeta(): SlotMeta[] {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "[]"); } catch { return []; }
}
function writeMeta(m: SlotMeta[]): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* stockage plein */ }
}

export function listSlots(): SlotMeta[] {
  return readMeta().sort((a, b) => b.date - a.date);
}
export function curSlotId(): string | null { return localStorage.getItem(CUR_KEY); }
export function setCurSlot(id: string): void { localStorage.setItem(CUR_KEY, id); }

export function newSlot(name?: string): string {
  const id = "s" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const metas = readMeta();
  metas.push({ id, name: name || `Partie ${metas.length + 1}`, date: Date.now(), diff: "normal", act: 1, time: 0, launched: false });
  writeMeta(metas);
  setCurSlot(id);
  return id;
}

export function saveSlot(id: string, data: SlotData): void {
  try {
    localStorage.setItem("af3d_slot_" + id, JSON.stringify(data));
    const metas = readMeta();
    const m = metas.find(x => x.id === id);
    if (m) {
      m.date = Date.now();
      m.diff = data.snap.diff;
      m.act = data.snap.act;
      m.time = data.snap.time;
      m.launched = data.snap.launched;
      writeMeta(metas);
    }
  } catch (e) { console.warn("sauvegarde impossible", e); }
}

export function loadSlot(id: string): SlotData | null {
  try {
    const raw = localStorage.getItem("af3d_slot_" + id);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.snap) return null;
    return d as SlotData;
  } catch { return null; }
}

export function deleteSlot(id: string): void {
  localStorage.removeItem("af3d_slot_" + id);
  writeMeta(readMeta().filter(m => m.id !== id));
  if (curSlotId() === id) localStorage.removeItem(CUR_KEY);
}
export function renameSlot(id: string, name: string): void {
  const metas = readMeta();
  const m = metas.find(x => x.id === id);
  if (m) { m.name = name.slice(0, 30) || m.name; writeMeta(metas); }
}

export function exportSlot(id: string): void {
  const data = loadSlot(id);
  if (!data) return;
  const meta = readMeta().find(m => m.id === id);
  const blob = new Blob([JSON.stringify({ meta, data }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `astroforage3d-${(meta?.name || id).replace(/[^a-z0-9-]/gi, "_")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importSlot(file: File): Promise<string> {
  return file.text().then(txt => {
    const j = JSON.parse(txt);
    const data: SlotData = j.data ?? j;
    if (!data?.snap?.seed && data?.snap?.seed !== 0) throw new Error("format invalide");
    const id = newSlot((j.meta?.name || "Import") + " ⬇");
    saveSlot(id, data);
    return id;
  });
}

/* ---- exploits persistants ---- */
const FEATS_KEY = "af3d_feats";
export function loadFeats(): Record<string, 1> {
  try { return JSON.parse(localStorage.getItem(FEATS_KEY) || "{}"); } catch { return {}; }
}
export function saveFeats(f: Record<string, 1>): void {
  try { localStorage.setItem(FEATS_KEY, JSON.stringify(f)); } catch { /* plein */ }
}

/* ---- meilleurs temps ---- */
export function saveBest(time: number, diff: DiffKey): boolean {
  try {
    const k = "af3d_best_" + diff;
    const cur = Number(localStorage.getItem(k) || "0");
    if (!cur || time < cur) { localStorage.setItem(k, String(time)); return true; }
  } catch { /* plein */ }
  return false;
}
export function getBest(diff: DiffKey): number {
  return Number(localStorage.getItem("af3d_best_" + diff) || "0");
}
