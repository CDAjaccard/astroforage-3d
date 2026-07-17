/* Écrans plein-page : titre, pause, coop, sauvegardes, options, exploits, victoire. */
import { DIFFS, FEATS, COSMETIC, type DiffKey } from "@astroforage/shared";
import { t, pick, getLang, setLang } from "./i18n.js";
import { settings, saveSettings, defaultServerUrl } from "../config.js";
import { listSlots, deleteSlot, renameSlot, exportSlot, importSlot, loadFeats, getBest, curSlotId, setCurSlot } from "../save/store.js";
import { au } from "../audio/engine.js";

export interface MenuHost {
  startNew(diff: DiffKey): void;
  playSlot(id: string): void;
  coopJoin(url: string, room: string, name: string, pass: string): void;
  resume(): void;
  backToMenu(): void;
  freeplay(): void;
  applySettings(): void;
  isDesktop(): boolean;
  quitApp(): void;
}

const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h > 0 ? `${h}h${String(m % 60).padStart(2, "0")}` : `${m}min${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export class Menus {
  root: HTMLDivElement;
  private host: MenuHost;
  screen: string | null = null;

  constructor(parent: HTMLElement, host: MenuHost) {
    this.host = host;
    this.root = document.createElement("div");
    this.root.className = "overlay hidden";
    parent.appendChild(this.root);
  }

  close(): void {
    this.screen = null;
    this.root.classList.add("hidden");
  }
  private show(html: string, cls = ""): void {
    this.root.className = "overlay " + cls;
    this.root.innerHTML = html;
  }
  private wire(sel: string, fn: (el: HTMLElement) => void): void {
    this.root.querySelectorAll(sel).forEach(e => e.addEventListener("click", (ev) => { ev.stopPropagation(); au.ensure(); fn(e as HTMLElement); }));
  }

  /* ---------------- titre ---------------- */
  title(version: string): void {
    this.screen = "title";
    const cur = curSlotId();
    const hasSave = cur !== null && listSlots().some(s => s.id === cur);
    this.show(`
      <div class="menu-card title-card">
        <div class="logo">ASTRO<span>·</span>FORAGE <em>3D</em></div>
        <div class="tagline">${t("subtitle")}</div>
        <div class="menu-btns">
          ${hasSave ? `<button class="mbtn primary" data-a="continue">${t("play")}</button>` : ""}
          <button class="mbtn ${hasSave ? "" : "primary"}" data-a="new">${t("newGame")}</button>
          <button class="mbtn" data-a="coop">${t("coop")}</button>
          <button class="mbtn" data-a="saves">${t("saves")}</button>
          <button class="mbtn" data-a="options">${t("options")}</button>
          <button class="mbtn" data-a="feats">${t("feats")}</button>
          ${this.host.isDesktop() ? `<button class="mbtn" data-a="quit">${t("quit")}</button>` : ""}
        </div>
        <div class="version">v${version} · <a href="https://github.com/CDAjaccard/astroforage-3d" target="_blank" rel="noreferrer">GitHub</a></div>
      </div>`);
    this.wire("[data-a=continue]", () => { const id = curSlotId(); if (id) this.host.playSlot(id); });
    this.wire("[data-a=new]", () => this.diffPick());
    this.wire("[data-a=coop]", () => this.coop());
    this.wire("[data-a=saves]", () => this.saves());
    this.wire("[data-a=options]", () => this.options());
    this.wire("[data-a=feats]", () => this.feats());
    this.wire("[data-a=quit]", () => this.host.quitApp());
  }

  private diffPick(): void {
    let btns = "";
    for (const k in DIFFS) {
      const d = DIFFS[k];
      const best = getBest(k as DiffKey);
      btns += `<button class="mbtn diff" data-diff="${k}" style="--dc:${d.col}">
        <b>${pick(d.nom, d.nomEn)}</b><small>${pick(d.desc, d.descEn)}${best ? ` · ⏱ ${fmtTime(best)}` : ""}</small></button>`;
    }
    this.show(`<div class="menu-card"><h2>${t("chooseDiff")}</h2><div class="menu-btns">${btns}</div>
      <button class="mbtn ghost" data-a="back">${t("back")}</button></div>`);
    this.wire("[data-diff]", (el) => this.host.startNew(el.dataset.diff as DiffKey));
    this.wire("[data-a=back]", () => this.title(VERSION));
  }

  /* ---------------- coop ---------------- */
  coop(status = ""): void {
    this.screen = "coop";
    this.show(`
      <div class="menu-card wide">
        <h2>${t("coopTitle")}</h2>
        <label>${t("server")}<input id="c-url" value="${settings.serverUrl || defaultServerUrl()}" spellcheck="false"></label>
        <label>${t("room")}<input id="c-room" value="KEPLER" maxlength="12" spellcheck="false"></label>
        <label>${t("nick")}<input id="c-nick" value="${settings.nick || ""}" maxlength="20" placeholder="Pilote"></label>
        <label>${t("passOpt")}<input id="c-pass" type="password" maxlength="30"></label>
        <div class="btnrow"><button class="mbtn primary" data-a="join">${t("join")}</button>
        <button class="mbtn" data-a="rooms">${t("publicRooms")} ⟳</button>
        ${(window as any).af3d ? `<button class="mbtn" data-a="host">${getLang() === "en" ? "🖧 Host (LAN)" : "🖧 Héberger (LAN)"}</button>` : ""}</div>
        <div id="c-status" class="net-status">${status}</div>
        <div id="c-rooms" class="rooms-list"></div>
        <div class="hint-text">${t("coopHint")}</div>
        <button class="mbtn ghost" data-a="back">${t("back")}</button>
      </div>`);
    const val = (id: string): string => (this.root.querySelector("#" + id) as HTMLInputElement).value.trim();
    this.wire("[data-a=join]", () => {
      settings.serverUrl = val("c-url");
      settings.nick = val("c-nick");
      saveSettings();
      (this.root.querySelector("#c-status") as HTMLElement).textContent = t("connecting");
      this.host.coopJoin(val("c-url"), val("c-room") || "KEPLER", val("c-nick") || "Pilote", val("c-pass"));
    });
    this.wire("[data-a=rooms]", () => void this.fetchRooms(val("c-url")));
    this.wire("[data-a=host]", async () => {
      const st = this.root.querySelector("#c-status") as HTMLElement;
      const r = await (window as any).af3d?.hostServer?.();
      if (r?.ok) {
        (this.root.querySelector("#c-url") as HTMLInputElement).value = "ws://localhost:8080";
        st.textContent = getLang() === "en"
          ? "Local server started (port 8080) — friends join via your LAN IP."
          : "Serveur local démarré (port 8080) — vos amis rejoignent via votre IP locale.";
      } else st.textContent = "❌ " + (r?.error ?? "hôte indisponible");
    });
    this.wire("[data-a=back]", () => this.title(VERSION));
    void this.fetchRooms(settings.serverUrl || defaultServerUrl());
  }

  coopStatus(msg: string): void {
    const el = this.root.querySelector("#c-status") as HTMLElement | null;
    if (el) el.textContent = msg;
  }

  private async fetchRooms(wsUrl: string): Promise<void> {
    const box = this.root.querySelector("#c-rooms") as HTMLElement | null;
    if (!box) return;
    box.textContent = "…";
    try {
      let base = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
      if (!/^https?:/.test(base)) base = "http://" + base;
      const r = await fetch(base.replace(/\/+$/, "") + "/api/rooms", { cache: "no-store" });
      const j = await r.json();
      const rooms: any[] = j.rooms || [];
      if (!rooms.length) { box.textContent = t("noRooms"); return; }
      box.innerHTML = rooms.map(rm =>
        `<button class="room-btn" data-room="${rm.code}">${rm.active ? "🟢" : "⚪"} <b>${rm.code}</b> · ${rm.players}/${rm.max} · ${t("act")} ${rm.act}</button>`
      ).join("");
      box.querySelectorAll("[data-room]").forEach(b => b.addEventListener("click", () => {
        (this.root.querySelector("#c-room") as HTMLInputElement).value = (b as HTMLElement).dataset.room!;
      }));
    } catch {
      box.textContent = t("noRooms");
    }
  }

  /* ---------------- sauvegardes ---------------- */
  saves(): void {
    this.screen = "saves";
    const slots = listSlots();
    const cur = curSlotId();
    let rows = slots.map(s => `
      <div class="slot ${s.id === cur ? "cur" : ""}">
        <div class="slot-b" data-play="${s.id}">
          <b>${s.name}</b>
          <small>${new Date(s.date).toLocaleString()} · ${pick(DIFFS[s.diff]?.nom, DIFFS[s.diff]?.nomEn)} · ${t("act")} ${s.act}${s.launched ? " · ★" : ""} · ⏱ ${fmtTime(s.time)}</small>
        </div>
        <button class="pbtn" data-ren="${s.id}">✎</button>
        <button class="pbtn" data-exp="${s.id}">⬇</button>
        <button class="pbtn danger" data-del="${s.id}">🗑</button>
      </div>`).join("");
    if (!slots.length) rows = `<div class="hint-text">${t("emptySaves")}</div>`;
    this.show(`<div class="menu-card wide"><h2>${t("savesTitle")}</h2>
      <div class="slots">${rows}</div>
      <div class="btnrow">
        <button class="mbtn" data-a="new">${t("newSlot")}</button>
        <button class="mbtn" data-a="import">${t("importSave")}</button>
      </div>
      <button class="mbtn ghost" data-a="back">${t("back")}</button>
      <input type="file" id="imp-file" accept=".json" style="display:none">
    </div>`);
    this.wire("[data-play]", (el) => { setCurSlot(el.dataset.play!); this.host.playSlot(el.dataset.play!); });
    this.wire("[data-del]", (el) => { if (confirm(t("confirmDel"))) { deleteSlot(el.dataset.del!); this.saves(); } });
    this.wire("[data-ren]", (el) => {
      const n = prompt(t("renameSave"), "");
      if (n) { renameSlot(el.dataset.ren!, n); this.saves(); }
    });
    this.wire("[data-exp]", (el) => exportSlot(el.dataset.exp!));
    this.wire("[data-a=new]", () => this.diffPick());
    this.wire("[data-a=back]", () => this.title(VERSION));
    const inp = this.root.querySelector("#imp-file") as HTMLInputElement;
    this.wire("[data-a=import]", () => inp.click());
    inp.addEventListener("change", () => {
      const f = inp.files?.[0];
      if (f) importSlot(f).then(() => this.saves()).catch(() => alert("Import impossible / invalid file"));
    });
  }

  /* ---------------- options ---------------- */
  options(fromPause = false): void {
    this.screen = "options";
    const cosBtns = (kind: "suit" | "visor" | "accent"): string =>
      (COSMETIC[kind] as any[]).map((c, i) =>
        `<button class="swatch ${settings.cosmetic[kind] === i ? "sel" : ""}" data-cos="${kind}:${i}" style="--c:${c.col}" title="${pick(c.nom, c.nomEn)}"></button>`).join("");
    this.show(`<div class="menu-card wide"><h2>${t("optTitle")}</h2>
      <label>${t("lang")}<select id="o-lang"><option value="fr" ${getLang() === "fr" ? "selected" : ""}>Français</option><option value="en" ${getLang() === "en" ? "selected" : ""}>English</option></select></label>
      <label>${t("sens")}<input id="o-sens" type="range" min="0.3" max="2.5" step="0.1" value="${settings.sens}"></label>
      <label>${t("invertY")}<input id="o-inv" type="checkbox" ${settings.invertY ? "checked" : ""}></label>
      <label>${t("fov")}<input id="o-fov" type="range" min="60" max="110" step="1" value="${settings.fov}"></label>
      <label>${t("volume")}<input id="o-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
      <label>${t("music")}<input id="o-mus" type="checkbox" ${settings.music ? "checked" : ""}></label>
      <label>${t("renderDist")}<input id="o-dist" type="range" min="60" max="180" step="10" value="${settings.renderDist}"></label>
      <label>${t("fullscreen")}<input id="o-fs" type="checkbox" ${document.fullscreenElement ? "checked" : ""}></label>
      <div class="sect">${t("suitCol")}</div><div class="swatches">${cosBtns("suit")}</div>
      <div class="sect">${t("visorCol")}</div><div class="swatches">${cosBtns("visor")}</div>
      <div class="sect">${t("accentCol")}</div><div class="swatches">${cosBtns("accent")}</div>
      <button class="mbtn ghost" data-a="back">${t("back")}</button>
    </div>`);
    const bind = (id: string, fn: (el: HTMLInputElement) => void): void => {
      const e = this.root.querySelector("#" + id) as HTMLInputElement;
      e?.addEventListener("change", () => { fn(e); saveSettings(); this.host.applySettings(); });
    };
    bind("o-lang", e => { setLang(e.value as any); fromPause ? this.pause() : this.options(fromPause); });
    bind("o-sens", e => settings.sens = Number(e.value));
    bind("o-inv", e => settings.invertY = e.checked);
    bind("o-fov", e => settings.fov = Number(e.value));
    bind("o-vol", e => { settings.volume = Number(e.value); au.applyVolume(); });
    bind("o-mus", e => { settings.music = e.checked; au.applyMusic(); });
    bind("o-dist", e => settings.renderDist = Number(e.value));
    bind("o-fs", e => {
      if (e.checked) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    this.wire("[data-cos]", (el) => {
      const [kind, i] = el.dataset.cos!.split(":");
      (settings.cosmetic as any)[kind] = Number(i);
      saveSettings();
      this.host.applySettings();
      this.options(fromPause);
    });
    this.wire("[data-a=back]", () => fromPause ? this.pause() : this.title(VERSION));
  }

  /* ---------------- exploits ---------------- */
  feats(fromPause = false): void {
    const got = loadFeats();
    const rows = FEATS.map(f => `<div class="feat ${got[f.id] ? "got" : ""}">
      <span class="feat-ico">${f.ico}</span>
      <div><b>${pick(f.nom, f.nomEn)}</b><small>${pick(f.desc, f.descEn)}</small></div>
    </div>`).join("");
    this.show(`<div class="menu-card wide"><h2>★ ${t("feats")} (${Object.keys(got).length}/${FEATS.length})</h2>
      <div class="feats">${rows}</div>
      <button class="mbtn ghost" data-a="back">${t("back")}</button></div>`);
    this.wire("[data-a=back]", () => fromPause ? this.pause() : this.title(VERSION));
  }

  /* ---------------- pause ---------------- */
  pause(): void {
    this.screen = "pause";
    this.show(`<div class="menu-card"><h2>${t("pause")}</h2>
      <div class="menu-btns">
        <button class="mbtn primary" data-a="resume">${t("resume")}</button>
        <button class="mbtn" data-a="options">${t("options")}</button>
        <button class="mbtn" data-a="feats">${t("feats")}</button>
        <button class="mbtn" data-a="menu">${t("toMenu")}</button>
      </div></div>`, "translucent");
    this.wire("[data-a=resume]", () => this.host.resume());
    this.wire("[data-a=options]", () => this.options(true));
    this.wire("[data-a=feats]", () => this.feats(true));
    this.wire("[data-a=menu]", () => this.host.backToMenu());
  }

  /* ---------------- victoire ---------------- */
  win(time: number, rescues: number, improved: boolean): void {
    this.screen = "win";
    this.show(`<div class="menu-card win-card">
      <h1>🚀 ${t("winTitle")}</h1>
      <p>${t("winText")}</p>
      <p class="win-stats">⏱ ${t("timePlayed")} : <b>${fmtTime(time)}</b>${improved ? " ★" : ""} · 🛟 ${rescues}</p>
      <div class="menu-btns">
        <button class="mbtn primary" data-a="free">${t("freeplay")}</button>
        <button class="mbtn" data-a="menu">${t("toMenu")}</button>
      </div></div>`);
    this.wire("[data-a=free]", () => this.host.freeplay());
    this.wire("[data-a=menu]", () => this.host.backToMenu());
  }

  /** écran de clic pour reprendre le pointer lock */
  clickCatch(show: boolean): void {
    let e = this.root.parentElement!.querySelector(".clickcatch") as HTMLElement | null;
    if (show) {
      if (!e) {
        e = document.createElement("div");
        e.className = "clickcatch";
        e.innerHTML = `<div>${t("clickToPlay")}</div>`;
        this.root.parentElement!.appendChild(e);
      }
      e.style.display = "flex";
    } else if (e) e.style.display = "none";
  }
}

export const VERSION = "0.1.0";
