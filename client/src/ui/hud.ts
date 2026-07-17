/* HUD en DOM : jauges, objectif, SAM, toasts, réticule, indicateurs. */
import { QUESTS, RESDEF, type SharedState, type PowerInfo } from "@astroforage/shared";
import { t, pick, getLang } from "./i18n.js";

function el(tag: string, cls: string, parent: HTMLElement): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
}

export interface HudState {
  inDrill: boolean;
  o2: number; o2Max: number;
  jp: number; jpMax: number;
  en: number; enMax: number;
  hp: number; hpMax: number;
  cargo: number; cargoMax: number;
  pouch: number;
  depth: number;
  hot: number;
  boost: boolean;
  digP: number;      // progression du forage 0..1 (-1 = pas de cible)
  hint: string;      // invite d'interaction
}

export class Hud {
  root: HTMLDivElement;
  private gO2!: HTMLElement; private gJp!: HTMLElement; private gEn!: HTMLElement;
  private gHp!: HTMLElement; private gCargo!: HTMLElement;
  private rowO2!: HTMLElement; private rowJp!: HTMLElement; private rowEn!: HTMLElement;
  private rowHp!: HTMLElement; private rowCargo!: HTMLElement;
  private heatEl!: HTMLElement;
  private depthEl!: HTMLElement;
  private questTxt!: HTMLElement; private questTip!: HTMLElement; private questProg!: HTMLElement;
  private samBox!: HTMLElement; private samTxt!: HTMLElement;
  private toastBox!: HTMLElement;
  private powerEl!: HTMLElement;
  private storeEl!: HTMLElement;
  private clockEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private cross!: HTMLElement;
  private digRing!: HTMLElement;
  private vignette!: HTMLElement;
  private pouchEl!: HTMLElement;
  private samT = 0;
  private samFull = "";
  private samShown = 0;

  constructor(parent: HTMLElement) {
    this.root = el("div", "hud hidden", parent) as HTMLDivElement;

    const tl = el("div", "hud-tl", this.root);
    const quest = el("div", "quest", tl);
    el("div", "quest-k", quest).textContent = "🎯";
    const qbody = el("div", "quest-b", quest);
    this.questTxt = el("div", "quest-txt", qbody);
    this.questProg = el("div", "quest-prog", qbody);
    this.questTip = el("div", "quest-tip", qbody);
    this.samBox = el("div", "sam hidden", tl);
    el("div", "sam-head", this.samBox).textContent = "◉ SAM";
    this.samTxt = el("div", "sam-txt", this.samBox);

    const tr = el("div", "hud-tr", this.root);
    this.clockEl = el("div", "pill", tr);
    this.powerEl = el("div", "pill", tr);
    this.storeEl = el("div", "pill", tr);

    const bl = el("div", "hud-bl", this.root);
    const mkGauge = (label: string, cls: string): [HTMLElement, HTMLElement] => {
      const row = el("div", "gauge-row", bl);
      el("span", "gauge-label", row).textContent = label;
      const bar = el("div", "gauge", row);
      const fill = el("div", "gauge-fill " + cls, bar);
      return [row, fill];
    };
    [this.rowO2, this.gO2] = mkGauge(t("o2"), "g-o2");
    [this.rowJp, this.gJp] = mkGauge(t("jetpack"), "g-jp");
    [this.rowEn, this.gEn] = mkGauge("↯", "g-en");
    [this.rowHp, this.gHp] = mkGauge("🛡", "g-hp");
    [this.rowCargo, this.gCargo] = mkGauge("📦", "g-cargo");
    this.pouchEl = el("div", "pouch", bl);
    this.heatEl = el("div", "heat hidden", bl);
    this.heatEl.textContent = "🌡 " + t("heat");

    const br = el("div", "hud-br", this.root);
    this.depthEl = el("div", "depth", br);

    const cc = el("div", "hud-cc", this.root);
    this.cross = el("div", "cross", cc);
    this.cross.textContent = "+";
    this.digRing = el("div", "digring hidden", cc);
    this.hintEl = el("div", "hint", cc);

    this.toastBox = el("div", "toasts", this.root);
    this.vignette = el("div", "vignette", this.root);
  }

  setVisible(v: boolean): void { this.root.classList.toggle("hidden", !v); }

  toast(msg: string, kind: "ok" | "info" | "warn" | "bad" = "info"): void {
    const e = document.createElement("div");
    e.className = "toast t-" + kind;
    e.textContent = msg;
    this.toastBox.appendChild(e);
    while (this.toastBox.children.length > 5) this.toastBox.firstChild?.remove();
    setTimeout(() => { e.classList.add("out"); setTimeout(() => e.remove(), 500); }, 3800);
  }

  say(txt: string, dur: number): void {
    this.samFull = txt;
    this.samShown = 0;
    this.samT = dur;
    this.samBox.classList.remove("hidden");
  }

  hurtFlash(a: number): void {
    this.vignette.style.opacity = String(Math.min(0.85, a));
  }

  update(dt: number, S: SharedState, power: PowerInfo, daylight: number, st: HudState, questProg: string | null): void {
    /* SAM : effet machine à écrire */
    if (this.samT > 0) {
      this.samT -= dt;
      this.samShown = Math.min(this.samFull.length, this.samShown + dt * 60);
      this.samTxt.textContent = this.samFull.slice(0, Math.floor(this.samShown));
      if (this.samT <= 0) this.samBox.classList.add("hidden");
    }

    /* quête */
    const q = QUESTS[S.qi];
    if (q) {
      this.questTxt.textContent = pick(q.txt, q.txtEn);
      this.questTip.textContent = pick(q.tip, q.tipEn);
      this.questProg.textContent = questProg ?? "";
    } else {
      this.questTxt.textContent = getLang() === "en" ? "Free exploration — the base keeps running." : "Exploration libre — la base continue de tourner.";
      this.questTip.textContent = "";
      this.questProg.textContent = "";
    }

    /* pills haut-droite */
    this.clockEl.textContent = (daylight > 0.25 ? "☀️ " + t("dayLabel") : "🌙 " + t("nightLabel")) + (S.storm ? " · 🌪 " + t("stormLabel") : "");
    this.powerEl.textContent = `↯ ${power.prod}/${power.dem}` + (power.battCap ? ` · 🔋${power.batt}` : "");
    this.powerEl.classList.toggle("bad", power.ratio < 0.98);
    let storeN = 0;
    for (const k in S.store) storeN += S.store[k];
    this.storeEl.textContent = `📦 ${storeN}`;

    /* jauges */
    const setG = (fill: HTMLElement, v: number, max: number): void => {
      fill.style.width = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100)) + "%";
      fill.classList.toggle("low", v / Math.max(1, max) < 0.25);
    };
    this.rowO2.classList.toggle("hidden", st.inDrill);
    this.rowJp.classList.toggle("hidden", st.inDrill);
    this.rowEn.classList.toggle("hidden", !st.inDrill);
    this.rowHp.classList.toggle("hidden", !st.inDrill);
    this.rowCargo.classList.toggle("hidden", !st.inDrill);
    setG(this.gO2, st.o2, st.o2Max);
    setG(this.gJp, st.jp, st.jpMax);
    setG(this.gEn, st.en, st.enMax);
    setG(this.gHp, st.hp, st.hpMax);
    setG(this.gCargo, st.cargo, st.cargoMax);
    this.pouchEl.textContent = st.pouch > 0 ? `💎 ${t("pouch")} ${st.pouch}/4` : "";
    this.heatEl.classList.toggle("hidden", !(st.inDrill && st.hot > 0));

    this.depthEl.textContent = `▼ ${Math.max(0, Math.round(st.depth))} m`;
    this.depthEl.classList.toggle("hot", st.hot > 0);

    /* réticule + progression forage */
    this.digRing.classList.toggle("hidden", st.digP < 0);
    if (st.digP >= 0) this.digRing.style.setProperty("--p", String(Math.round(st.digP * 100)));
    this.hintEl.textContent = st.hint;

    const v = Number(this.vignette.style.opacity || 0);
    if (v > 0) this.vignette.style.opacity = String(Math.max(0, v - dt * 1.4));
  }

  /** Détail du stock pour le pill (info-bulle). */
  storeTooltip(S: SharedState): string {
    const parts: string[] = [];
    for (const k in S.store) {
      const def = RESDEF[k];
      if (def) parts.push(`${S.store[k]} ${pick(def.nom, def.nomEn)}`);
    }
    return parts.join(" · ");
  }
}
