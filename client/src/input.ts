/* Entrées clavier + souris (pointer lock). ZQSD et WASD acceptés (e.code). */
import { settings } from "./config.js";

export interface Keys {
  fwd: boolean; back: boolean; left: boolean; right: boolean;
  up: boolean; down: boolean; boost: boolean;
  mouseL: boolean;
}

export class Input {
  keys: Keys = { fwd: false, back: false, left: false, right: false, up: false, down: false, boost: false, mouseL: false };
  yaw = 0;
  pitch = 0;
  jumpBuf = 0;
  locked = false;
  /** callbacks d'actions ponctuelles (assignés par Game) */
  onAction: (action: string) => void = () => { /* assigné par Game */ };
  enabled = false;
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;

    const MAP: Record<string, keyof Keys> = {
      KeyW: "fwd", KeyZ: "fwd", ArrowUp: "fwd",
      KeyS: "back", ArrowDown: "back",
      KeyA: "left", KeyQ: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right",
      Space: "up",
      ControlLeft: "down", KeyC: "down",
      ShiftLeft: "boost", ShiftRight: "boost"
    };

    window.addEventListener("keydown", (e) => {
      const tn = (e.target as HTMLElement)?.tagName;
      if (tn === "INPUT" || tn === "TEXTAREA" || tn === "SELECT") return;
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      const k = MAP[e.code];
      if (k && this.enabled) {
        (this.keys as any)[k] = true;
        if (k === "up" && !e.repeat) this.jumpBuf = 0.16;
      }
      if (e.repeat) return;
      switch (e.code) {
        case "KeyE": this.onAction("interact"); break;
        case "KeyV": this.onAction("camera"); break;
        case "KeyB": this.onAction("build"); break;
        case "KeyI": this.onAction("stock"); break;
        case "KeyR": this.onAction("robot"); break;
        case "KeyT": this.onAction("beam"); break;
        case "KeyH": this.onAction("helpPanel"); break;
        case "KeyM": this.onAction("mute"); break;
        case "KeyP": this.onAction("pause"); break;
        case "Escape": this.onAction("escape"); break;
        case "F11": this.onAction("fullscreen"); break;
      }
    });
    window.addEventListener("keyup", (e) => {
      const k = MAP[e.code];
      if (k) (this.keys as any)[k] = false;
    });
    window.addEventListener("blur", () => this.clear());

    this.el.addEventListener("mousedown", (e) => {
      if (!this.enabled) return;
      if (!this.locked) { this.lock(); return; }
      if (e.button === 0) this.keys.mouseL = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.keys.mouseL = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.locked || !this.enabled) return;
      const s = 0.0023 * settings.sens;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s * (settings.invertY ? -1 : 1);
      const lim = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) { this.clear(); this.onAction("unlocked"); }
      else this.onAction("lockedIn");
    });
  }

  lock(): void {
    if (document.pointerLockElement !== this.el) {
      this.el.requestPointerLock?.();
    }
  }
  unlock(): void {
    if (document.pointerLockElement === this.el) document.exitPointerLock();
  }
  clear(): void {
    for (const k of Object.keys(this.keys) as Array<keyof Keys>) (this.keys as any)[k] = false;
  }
}
