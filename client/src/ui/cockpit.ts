/* HUD cockpit de la foreuse (vue FPS) — inspiration Space Engineers :
 * verrière à montants angulaires, console technique cyan sur fond sombre,
 * lampes d'alerte. 100 % DOM/CSS, pointer-events: none. */
import { pick } from "./i18n.js";

function el(tag: string, cls: string, parent: HTMLElement): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
}

export interface CockpitState {
  visible: boolean;
  speed: number;        // m/s
  yaw: number;          // rad (visée)
  depth: number;        // m
  hp: number; hpMax: number;
  en: number; enMax: number;
  cargo: number; cargoMax: number;
  hot: boolean;
  boost: boolean;
  digging: boolean;
}

const CARDINAUX = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

export class Cockpit {
  root: HTMLDivElement;
  private speedEl: HTMLElement;
  private headEl: HTMLElement;
  private depthEl: HTMLElement;
  private hullFill: HTMLElement;
  private enFill: HTMLElement;
  private cargoFill: HTMLElement;
  private hullVal: HTMLElement;
  private enVal: HTMLElement;
  private cargoVal: HTMLElement;
  private lampHeat: HTMLElement;
  private lampEn: HTMLElement;
  private lampBoost: HTMLElement;
  private lampCargo: HTMLElement;
  private lampDig: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", "cockpit hidden", parent) as HTMLDivElement;

    /* verrière : montants d'angle + piliers latéraux + traverse haute */
    for (const c of ["ck-tl", "ck-tr", "ck-bl", "ck-br", "ck-top", "ck-left", "ck-right"]) {
      el("div", "ck-strut " + c, this.root);
    }
    el("div", "ck-glass", this.root);

    /* console basse centrale */
    const con = el("div", "ck-console", this.root);

    const colL = el("div", "ck-col", con);
    const mkBar = (label: string, cls: string): [HTMLElement, HTMLElement] => {
      const row = el("div", "ck-bar-row", colL);
      el("span", "ck-bar-label", row).textContent = label;
      const bar = el("div", "ck-bar", row);
      const fill = el("div", "ck-bar-fill " + cls, bar);
      const val = el("span", "ck-bar-val", row);
      return [fill, val];
    };
    [this.hullFill, this.hullVal] = mkBar(pick("COQUE", "HULL"), "ck-hull");
    [this.enFill, this.enVal] = mkBar(pick("ÉNERGIE", "POWER"), "ck-en");
    [this.cargoFill, this.cargoVal] = mkBar(pick("CARGO", "CARGO"), "ck-cargo");

    const colC = el("div", "ck-center", con);
    this.speedEl = el("div", "ck-speed", colC);
    const sub = el("div", "ck-sub", colC);
    this.headEl = el("span", "ck-head", sub);
    this.depthEl = el("span", "ck-depthv", sub);

    const colR = el("div", "ck-lamps", con);
    const mkLamp = (label: string, cls = ""): HTMLElement => {
      const l = el("div", "ck-lamp " + cls, colR);
      l.textContent = label;
      return l;
    };
    this.lampDig = mkLamp(pick("FORAGE", "DRILL"), "l-cyan");
    this.lampBoost = mkLamp(pick("SURRÉGIME", "OVERDRIVE"), "l-amber");
    this.lampHeat = mkLamp(pick("SURCHAUFFE", "OVERHEAT"), "l-red");
    this.lampEn = mkLamp(pick("BATTERIE", "BATTERY"), "l-red");
    this.lampCargo = mkLamp(pick("SOUTE PLEINE", "CARGO FULL"), "l-amber");
  }

  update(st: CockpitState): void {
    this.root.classList.toggle("hidden", !st.visible);
    if (!st.visible) return;

    this.speedEl.innerHTML = st.speed.toFixed(1) + "<span> m/s</span>";
    const deg = ((Math.round(-st.yaw * 180 / Math.PI) % 360) + 360) % 360;
    this.headEl.textContent = CARDINAUX[Math.round(deg / 45) % 8] + " " + String(deg).padStart(3, "0") + "°";
    this.depthEl.textContent = "▼ " + Math.max(0, Math.round(st.depth)) + " m";

    const setBar = (fill: HTMLElement, val: HTMLElement, v: number, max: number): void => {
      const f = Math.max(0, Math.min(1, v / Math.max(1, max)));
      fill.style.width = (f * 100).toFixed(0) + "%";
      fill.classList.toggle("low", f < 0.25);
      val.textContent = String(Math.round(v));
    };
    setBar(this.hullFill, this.hullVal, st.hp, st.hpMax);
    setBar(this.enFill, this.enVal, st.en, st.enMax);
    setBar(this.cargoFill, this.cargoVal, st.cargo, st.cargoMax);

    this.lampDig.classList.toggle("on", st.digging);
    this.lampBoost.classList.toggle("on", st.boost);
    this.lampHeat.classList.toggle("on", st.hot);
    this.lampEn.classList.toggle("on", st.en / Math.max(1, st.enMax) < 0.25);
    this.lampCargo.classList.toggle("on", st.cargo >= st.cargoMax);
  }
}
