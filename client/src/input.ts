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
        if (k === "fwd") this.kbFwd = true;
        else if (k === "back") this.kbBack = true;
        else if (k === "left") this.kbLeft = true;
        else if (k === "right") this.kbRight = true;
        else if (k === "up") this.kbUp = true;
        else if (k === "boost") this.kbBoost = true;
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
      if (k) {
        (this.keys as any)[k] = false;
        if (k === "fwd") this.kbFwd = false;
        else if (k === "back") this.kbBack = false;
        else if (k === "left") this.kbLeft = false;
        else if (k === "right") this.kbRight = false;
        else if (k === "up") this.kbUp = false;
        else if (k === "boost") this.kbBoost = false;
      }
    });
    window.addEventListener("blur", () => this.clear());

    this.el.addEventListener("mousedown", (e) => {
      if (!this.enabled) return;
      if (!this.locked) { this.lock(); return; }
      if (e.button === 0) { this.keys.mouseL = true; this.mouseHeld = true; }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) { this.keys.mouseL = false; this.mouseHeld = false; }
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

  /* ---- manette (Gamepad API — Steam Input mappe les manettes en XInput) ---- */
  padConnected = false;
  private prevPad: boolean[] = [];

  /** À appeler chaque frame : fusionne l'état de la manette dans keys/yaw/pitch. */
  pollGamepad(dt: number): void {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find(p => p && p.connected);
    if (!gp) {
      if (this.padConnected) {
        /* déconnexion : relâche tout ce que la manette tenait */
        this.padConnected = false;
        this.keys.fwd = this.kbFwd; this.keys.back = this.kbBack;
        this.keys.left = this.kbLeft; this.keys.right = this.kbRight;
        this.keys.up = this.kbUp; this.keys.boost = this.kbBoost;
        this.keys.mouseL = this.mouseHeld;
        this.prevPad = [];
      }
      return;
    }
    if (!this.padConnected) {
      this.padConnected = true;
      this.onAction("padConnected");
    }
    if (!this.enabled) return;
    const dz = (v: number): number => Math.abs(v) < 0.18 ? 0 : v;
    const lx = dz(gp.axes[0] ?? 0), ly = dz(gp.axes[1] ?? 0);
    const rx = dz(gp.axes[2] ?? 0), ry = dz(gp.axes[3] ?? 0);
    /* stick gauche -> déplacement (seuils) */
    if (ly < -0.35) this.keys.fwd = true; else if (ly > -0.2 && this.keys.fwd && !this.kbFwd) this.keys.fwd = false;
    if (ly > 0.35) this.keys.back = true; else if (ly < 0.2 && this.keys.back && !this.kbBack) this.keys.back = false;
    if (lx < -0.35) this.keys.left = true; else if (lx > -0.2 && this.keys.left && !this.kbLeft) this.keys.left = false;
    if (lx > 0.35) this.keys.right = true; else if (lx < 0.2 && this.keys.right && !this.kbRight) this.keys.right = false;
    /* stick droit -> visée */
    const s = 2.6 * settings.sens;
    this.yaw -= rx * s * dt;
    this.pitch -= ry * s * dt * (settings.invertY ? -1 : 1);
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    /* boutons maintenus */
    const b = (i: number): boolean => !!gp.buttons[i]?.pressed;
    this.keys.up = b(0) || this.kbUp;                        // A : saut / poussée
    this.keys.boost = b(4) || b(6) || this.kbBoost;          // LB/LT : surrégime
    this.keys.mouseL = b(5) || b(7) || this.mouseHeld;       // RB/RT : forer
    /* boutons à front montant */
    const edge = (i: number, action: string): void => {
      const now = b(i);
      if (now && !this.prevPad[i]) this.onAction(action);
      this.prevPad[i] = now;
    };
    edge(2, "interact");    // X
    edge(3, "camera");      // Y
    edge(1, "escape");      // B
    edge(9, "pause");       // Start
    edge(8, "stock");       // Select
    edge(12, "build");      // D-pad haut
    edge(13, "helpPanel");  // D-pad bas
    edge(14, "robot");      // D-pad gauche
    edge(15, "beam");       // D-pad droite
    if (this.keys.up && !this.prevPad[0]) this.jumpBuf = 0.16;
    this.prevPad[0] = b(0);
  }
  /* mémoire clavier/souris pour ne pas écraser leurs maintiens */
  private kbFwd = false; private kbBack = false; private kbLeft = false; private kbRight = false;
  private kbUp = false; private kbBoost = false; private mouseHeld = false;

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
