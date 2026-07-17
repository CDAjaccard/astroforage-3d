import { Game } from "./game/game.js";
import "./style.css";

const container = document.getElementById("app")!;
const loading = document.getElementById("loading")!;

const game = new Game(container);
void game.init().then(() => {
  loading.remove();
});

let last = performance.now();
const perf = { fps: 0, ms: 0, frames: 0, acc: 0, msAcc: 0 };
(window as any).AF3D_PERF = perf;
function loop(now: number): void {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.06) dt = 0.06;
  const t0 = performance.now();
  game.update(dt);
  perf.msAcc += performance.now() - t0;
  perf.frames++;
  perf.acc += dt;
  if (perf.acc >= 1) {
    perf.fps = Math.round(perf.frames / perf.acc);
    perf.ms = +(perf.msAcc / perf.frames).toFixed(1);
    perf.frames = 0; perf.acc = 0; perf.msAcc = 0;
  }
}
requestAnimationFrame(loop);

/* débogage console (comme window.AF de l'original) */
(window as any).AF3D = game;

/* hooks de test headless (dev uniquement) : avance manuelle + capture canvas.
 * Permet de jouer/vérifier le jeu même quand l'onglet est masqué (CI, agents). */
if (import.meta.env.DEV) {
  (window as any).AF3D_STEP = (dt: number, n = 1): string => {
    for (let i = 0; i < n; i++) game.update(dt);
    return "ok";
  };
  (window as any).AF3D_SHOT = async (url = "http://localhost:5175/shot"): Promise<string> => {
    game.update(1 / 60);
    const data = game.scene.renderer.domElement.toDataURL("image/png");
    try {
      await fetch(url, { method: "POST", body: data });
      return "sent " + Math.round(data.length / 1024) + "KB";
    } catch (e) {
      return "fail " + e;
    }
  };
}
