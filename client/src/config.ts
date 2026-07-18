/* Réglages persistants (localStorage). */
import type { Cosmetic } from "@astroforage/shared";

export interface Settings {
  sens: number;        // sensibilité souris (0.5..2)
  invertY: boolean;
  fov: number;         // 60..110
  volume: number;      // 0..1
  music: boolean;
  renderDist: number;  // distance de brouillard/rendu en mètres (60..160)
  cosmetic: Cosmetic;
  serverUrl: string;
  nick: string;
  /** carnet de serveurs coop */
  servers: Array<{ name: string; url: string }>;
  /** résolution interne : 0 = auto (ratio natif ≤2), sinon facteur fixe */
  renderScale: number;
  /** densité de particules (0.5 léger · 1 normal) */
  fxDensity: number;
  /** ombres dynamiques (coûteuses — défaut désactivé) */
  shadows: boolean;
  /** intensité des secousses d'écran (accessibilité : 0 / 0.5 / 1) */
  shakeScale: number;
}

const KEY = "af3d_settings";

export function defaultServerUrl(): string {
  try {
    if (location.protocol === "http:" || location.protocol === "https:") {
      /* servi par le serveur coop lui-même (build) : même hôte */
      if (location.port !== "5173") return (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host;
    }
  } catch { /* file:// (Electron) */ }
  return "ws://localhost:8080";
}

export const settings: Settings = (() => {
  const d: Settings = {
    sens: 1, invertY: false, fov: 78, volume: 0.5, music: true, renderDist: 110,
    cosmetic: { suit: 0, visor: 0, accent: 0 },
    serverUrl: defaultServerUrl(),
    nick: "",
    servers: [],
    renderScale: 0,
    fxDensity: 1,
    shadows: false,
    shakeScale: 1
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(d, JSON.parse(raw));
  } catch { /* réglages corrompus : défauts */ }
  return d;
})();

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* stockage indisponible */ }
}
