/* Panneaux de jeu : Construire, Bâtiment, Atelier, Labo, Fusée, Stock, Aide.
 * DOM pur, rafraîchi tant qu'ouvert. Les actions passent par la façade Game. */
import {
  BUILDINGS, BUILD_ORDER, RECIPES, RESDEF, RESEARCH, UPGRADES, ROCKET, ROCKET2,
  ROBOT_COST, BAIE_UP, SPD_UP, ROBOT_CAP, TIPS,
  type Building, type SharedState, type PlayerUp
} from "@astroforage/shared";
import { t, pick, getLang } from "./i18n.js";

export interface PanelHost {
  S: SharedState;
  myUp: PlayerUp;
  intent(m: any): void;
  startPlacing(key: string): void;
  canAffordShared(cost: Record<string, number>): boolean;
  buildCost(key: string): Record<string, number>;
  builtCount(key: string): number;
  repairedCount(): number;
  closePanel(): void;
  blip(): void;
  err(): void;
}

function costHtml(cost: Record<string, number>, S: SharedState): string {
  return Object.entries(cost).map(([r, n]) => {
    const have = S.store[r] || 0;
    const ok = have >= n;
    const def = RESDEF[r];
    return `<span class="cost ${ok ? "ok" : "ko"}" style="--c:${def?.col ?? "#fff"}">${n} ${pick(def?.nom, def?.nomEn)}</span>`;
  }).join(" ");
}

export class Panels {
  root: HTMLDivElement;
  name: string | null = null;
  arg: unknown = null;
  private host: PanelHost;
  private refreshT = 0;

  constructor(parent: HTMLElement, host: PanelHost) {
    this.host = host;
    this.root = document.createElement("div");
    this.root.className = "panel hidden";
    parent.appendChild(this.root);
  }

  open(name: string, arg?: unknown): void {
    this.name = name;
    this.arg = arg ?? null;
    this.root.classList.remove("hidden");
    this.render();
  }
  close(): void {
    this.name = null;
    this.arg = null;
    this.root.classList.add("hidden");
  }
  get isOpen(): boolean { return this.name !== null; }

  update(dt: number): void {
    if (!this.name) return;
    this.refreshT += dt;
    if (this.refreshT > 0.4) { this.refreshT = 0; this.render(); }
  }

  private render(): void {
    const n = this.name;
    if (!n) return;
    if (n === "build") this.renderBuild();
    else if (n === "building") this.renderBuilding();
    else if (n === "atelier") this.renderAtelier();
    else if (n === "labo") this.renderLabo();
    else if (n === "fusee") this.renderRocket();
    else if (n === "stock") this.renderStock();
    else if (n === "aide") this.renderHelp();
  }

  private frame(title: string, bodyHtml: string): void {
    this.root.innerHTML = `<div class="panel-head"><span>${title}</span><button class="pbtn" data-act="close">✕</button></div><div class="panel-body">${bodyHtml}</div>`;
    this.root.querySelector("[data-act=close]")?.addEventListener("click", () => this.host.closePanel());
  }

  private renderBuild(): void {
    const S = this.host.S;
    let rows = "";
    for (const key of BUILD_ORDER) {
      const def = BUILDINGS[key];
      const built = this.host.builtCount(key);
      const maxed = !!def.max && built >= def.max;
      const lockPre = def.prereq && this.host.builtCount(def.prereq) === 0;
      const cost = this.host.buildCost(key);
      const afford = this.host.canAffordShared(cost);
      rows += `<div class="row ${maxed || lockPre ? "dim" : ""}">
        <div class="row-ico">${def.ico}</div>
        <div class="row-b">
          <div class="row-t">${pick(def.nom, def.nomEn)} ${built > 0 ? `<span class="chip">×${built}</span>` : ""}</div>
          <div class="row-d">${pick(def.desc, def.descEn)}</div>
          <div class="row-c">${maxed ? t("maxed") : costHtml(cost, S)}${lockPre ? ` · ⛓ ${pick(BUILDINGS[def.prereq!].nom, BUILDINGS[def.prereq!].nomEn)}` : ""}</div>
        </div>
        ${maxed || lockPre ? "" : `<button class="pbtn go" data-build="${key}" ${afford ? "" : "disabled"}>${t("build")}</button>`}
      </div>`;
    }
    this.frame("🏗️ " + t("build"), rows);
    this.root.querySelectorAll("[data-build]").forEach(b => b.addEventListener("click", () => {
      this.host.startPlacing((b as HTMLElement).dataset.build!);
    }));
  }

  private renderBuilding(): void {
    const b = this.arg as Building | null;
    const S = this.host.S;
    const live = b ? S.builds.find(x => Math.abs(x.x - b.x) < 0.4 && Math.abs(x.z - b.z) < 0.4) : null;
    if (!live) { this.host.closePanel(); return; }
    this.arg = live;
    const def = BUILDINGS[live.key];
    const recs = RECIPES[live.key];
    let body = `<div class="row-d">${pick(def.desc, def.descEn)}</div>`;
    body += `<div class="row-d st">— ${this.statusLabel(live)}</div>`;
    if (recs) {
      body += `<div class="sect">${t("recipe")}</div>`;
      for (const r of recs) {
        if (r.act2 && S.act < 2) continue;
        const sel = live.recipe === r.id;
        const outKey = Object.keys(r.out)[0];
        const name = r.label ? pick(r.label, r.labelEn) : pick(RESDEF[outKey]?.nom, RESDEF[outKey]?.nomEn);
        body += `<div class="row ${sel ? "sel" : ""}">
          <div class="row-b"><div class="row-t">${name} ${sel && live.job ? `<progress max="${r.t}" value="${live.prog.toFixed(1)}"></progress>` : ""}</div>
          <div class="row-c">${costHtml(r.in, S)} → ${Object.entries(r.out).map(([k, v]) => `${v} ${pick(RESDEF[k]?.nom, RESDEF[k]?.nomEn)}`).join(", ")} · ${r.t}s · ${r.pow}↯</div></div>
          ${sel ? "" : `<button class="pbtn" data-recipe="${r.id}">✓</button>`}
        </div>`;
      }
      const laboOn = this.host.builtCount("labo") > 0;
      body += `<div class="btnrow">
        <button class="pbtn" data-act="toggle">${live.on ? t("paused2") : t("running")}</button>
        ${laboOn ? `<button class="pbtn ${live.oc ? "go" : ""}" data-act="oc">${t("overdrive")}</button>` : ""}
      </div>`;
    }
    if (live.key === "baie") {
      const S2 = this.host.S;
      body += `<div class="sect">${t("robots")} — ${S2.robots.length}/${S2.robotsOwned} ${getLang() === "en" ? "deployed" : "déployés"} · cap. ${ROBOT_CAP[S2.baieLvl - 1]}</div>`;
      body += `<div class="btnrow">
        <button class="pbtn go" data-act="robotAdd" ${this.host.canAffordShared(ROBOT_COST) && S2.robotsOwned < ROBOT_CAP[S2.baieLvl - 1] ? "" : "disabled"}>${t("buyRobot")}</button>
        <span class="row-c">${costHtml(ROBOT_COST, S2)}</span></div>`;
      if (S2.baieLvl < 3) {
        body += `<div class="btnrow"><button class="pbtn" data-act="baieUp" ${this.host.canAffordShared(BAIE_UP[S2.baieLvl]!) ? "" : "disabled"}>${t("baieUp")}</button><span class="row-c">${costHtml(BAIE_UP[S2.baieLvl]!, S2)}</span></div>`;
      }
      if (S2.robotSpd < 3) {
        body += `<div class="btnrow"><button class="pbtn" data-act="spdUp" ${this.host.canAffordShared(SPD_UP[S2.robotSpd]!) ? "" : "disabled"}>${t("spdUp")}</button><span class="row-c">${costHtml(SPD_UP[S2.robotSpd]!, S2)}</span></div>`;
      }
    }
    if (live.key === "atelier") body += `<div class="btnrow"><button class="pbtn go" data-act="openAtelier">🔧 ${t("workshop")}</button></div>`;
    if (live.key === "labo") body += `<div class="btnrow"><button class="pbtn go" data-act="openLabo">🔬 ${t("labo")}</button></div>`;
    body += `<div class="btnrow"><button class="pbtn danger" data-act="demolish">${t("demolish")}</button></div>`;
    this.frame(`${def.ico} ${pick(def.nom, def.nomEn)}`, body);

    this.root.querySelectorAll("[data-recipe]").forEach(el => el.addEventListener("click", () => {
      this.host.intent({ i: "machine", x: live.x, z: live.z, recipe: (el as HTMLElement).dataset.recipe });
      this.host.blip();
    }));
    const act = (sel: string, fn: () => void): void => {
      this.root.querySelector(`[data-act=${sel}]`)?.addEventListener("click", fn);
    };
    act("toggle", () => { this.host.intent({ i: "machine", x: live.x, z: live.z, on: !live.on }); this.host.blip(); });
    act("oc", () => { this.host.intent({ i: "machine", x: live.x, z: live.z, oc: !live.oc }); this.host.blip(); });
    act("robotAdd", () => this.host.intent({ i: "robotAdd" }));
    act("baieUp", () => this.host.intent({ i: "baieUp" }));
    act("spdUp", () => this.host.intent({ i: "spdUp" }));
    act("openAtelier", () => this.open("atelier"));
    act("openLabo", () => this.open("labo"));
    act("demolish", () => { this.host.intent({ i: "demolish", x: live.x, z: live.z }); this.host.closePanel(); });
  }

  private statusLabel(b: Building): string {
    const key = ("st_" + (b.status || "paused")) as any;
    try {
      const v = t(key);
      if (b.key === "accu") {
        const S = this.host.S;
        return `${t("st_accu")} : ${Math.round(S.battE)}↯`;
      }
      return v;
    } catch { return b.status; }
  }

  private renderAtelier(): void {
    const S = this.host.S;
    const up = this.host.myUp;
    let body = `<div class="row-d">${getLang() === "en" ? "Your personal upgrades (each pilot has their own)." : "Vos améliorations personnelles (chaque pilote a les siennes)."}</div>`;
    for (const key of Object.keys(UPGRADES) as Array<keyof PlayerUp>) {
      const U = UPGRADES[key];
      const lvl = up[key] || 1;
      const maxed = lvl >= U.vals.length;
      const cost = maxed ? null : U.costs[lvl];
      body += `<div class="row">
        <div class="row-b">
          <div class="row-t">${pick(U.nom, U.nomEn)} <span class="chip">Mk${lvl}</span></div>
          <div class="row-d">${pick(U.desc, U.descEn)} — ${this.fmtUp(key, lvl - 1)}${maxed ? "" : " → " + this.fmtUp(key, lvl)}</div>
          <div class="row-c">${maxed ? t("maxed") : costHtml(cost!, S)}</div>
        </div>
        ${maxed ? "" : `<button class="pbtn go" data-up="${key}" ${this.host.canAffordShared(cost!) ? "" : "disabled"}>${t("buy")}</button>`}
      </div>`;
    }
    this.frame("🔧 " + t("workshop"), body);
    this.root.querySelectorAll("[data-up]").forEach(el => el.addEventListener("click", () => {
      this.host.intent({ i: "upgrade", key: (el as HTMLElement).dataset.up });
    }));
  }

  private fmtUp(key: keyof PlayerUp, idx: number): string {
    const v = UPGRADES[key].vals[idx];
    if (key === "foret") return `≤${v.h} ×${v.sp}`;
    if (key === "refroid") return `${v * 2} m`;
    return String(v);
  }

  private renderLabo(): void {
    const S = this.host.S;
    const cr = S.store.cristal || 0;
    let body = `<div class="row-d">💎 ${cr} ${pick("cristaux disponibles", "crystals available")}</div>`;
    for (const r of RESEARCH) {
      const got = !!S.research[r.id];
      body += `<div class="row ${got ? "sel" : ""}">
        <div class="row-ico">${r.ico}</div>
        <div class="row-b">
          <div class="row-t">${pick(r.nom, r.nomEn)}</div>
          <div class="row-d">${pick(r.desc, r.descEn)}</div>
        </div>
        ${got ? `<span class="chip ok">${t("done")}</span>` : `<button class="pbtn go" data-res="${r.id}" ${cr >= r.cost ? "" : "disabled"}>💎${r.cost}</button>`}
      </div>`;
    }
    this.frame("🔬 " + t("labo"), body);
    this.root.querySelectorAll("[data-res]").forEach(el => el.addEventListener("click", () => {
      this.host.intent({ i: "research", id: (el as HTMLElement).dataset.res });
    }));
  }

  private renderRocket(): void {
    const S = this.host.S;
    const list = S.act >= 2 ? ROCKET2 : ROCKET;
    const repaired = this.host.repairedCount();
    let body = `<div class="row-d">${S.act >= 2
      ? pick("Reconstruction STELLAIRE — le premier alliage n'a pas tenu.", "STELLAR rebuild — the first alloy didn't hold.")
      : pick("Réparez les 5 systèmes pour décoller.", "Repair all 5 systems to lift off.")} (${repaired}/5)</div>`;
    for (const sys of list) {
      const fixed = !!S.rocketFix[sys.key];
      const del = S.rocketDel[sys.key] || {};
      let need = "";
      for (const r in sys.cost) {
        const have = del[r] || 0;
        need += `<span class="cost ${have >= sys.cost[r] ? "ok" : ""}">${have}/${sys.cost[r]} ${pick(RESDEF[r]?.nom, RESDEF[r]?.nomEn)}</span> `;
      }
      body += `<div class="row ${fixed ? "sel" : ""}">
        <div class="row-ico">${sys.ico}</div>
        <div class="row-b"><div class="row-t">${pick(sys.nom, sys.nomEn)} ${fixed ? "✅" : ""}</div><div class="row-c">${need}</div></div>
        ${fixed ? "" : `<button class="pbtn" data-sys="${sys.key}">${t("provide")}</button>`}
      </div>`;
    }
    const ready = repaired >= 5;
    body += `<div class="btnrow center"><button class="pbtn launch" data-act="launch" ${ready ? "" : "disabled"}>${ready ? t("liftoff") : t("liftoffLocked")}</button></div>`;
    this.frame("🚀 " + t("rocket"), body);
    this.root.querySelectorAll("[data-sys]").forEach(el => el.addEventListener("click", () => {
      this.host.intent({ i: "contribute", key: (el as HTMLElement).dataset.sys });
    }));
    this.root.querySelector("[data-act=launch]")?.addEventListener("click", () => {
      this.host.intent({ i: "launch" });
      this.host.closePanel();
    });
  }

  private renderStock(): void {
    const S = this.host.S;
    const cats: Record<string, string[]> = { brut: [], exotique: [], raffine: [], piece: [] };
    let total = 0;
    for (const k in RESDEF) {
      const n = S.store[k] || 0;
      total += n;
      if (n > 0) cats[RESDEF[k].cat].push(`<div class="stock-item" style="--c:${RESDEF[k].col}"><b>${n}</b> ${pick(RESDEF[k].nom, RESDEF[k].nomEn)}</div>`);
    }
    const cap = 300 + this.host.builtCount("silo") * 250;
    let body = `<div class="row-d">${total} / ${cap}</div>`;
    const catNames: Record<string, [string, string]> = { brut: ["Minerais", "Ores"], exotique: ["Exotique", "Exotic"], raffine: ["Raffinés", "Refined"], piece: ["Pièces", "Parts"] };
    for (const c in cats) {
      if (!cats[c].length) continue;
      body += `<div class="sect">${pick(catNames[c][0], catNames[c][1])}</div><div class="stock-grid">${cats[c].join("")}</div>`;
    }
    if (!total) body += `<div class="row-d">${pick("Vide — allez forer !", "Empty — go dig!")}</div>`;
    this.frame("📦 " + t("stock"), body);
  }

  private renderHelp(): void {
    let body = `<div class="sect">${t("controlsTitle")}</div><div class="row-d">${t("helpControls")}</div>`;
    body += `<div class="sect">${t("tipsTitle")}</div>`;
    for (const tip of TIPS) body += `<div class="tip">▸ ${pick(tip.fr, tip.en)}</div>`;
    this.frame("❓ " + t("help"), body);
  }
}
