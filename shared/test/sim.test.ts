import { describe, it, expect } from "vitest";
import { GameSim, SURF, W, tile, QUESTS, ACT2_QI, H2, ROCKET, ROCKET2 } from "../src/index.js";

function makeSim(): { sim: GameSim; p: ReturnType<GameSim["addPlayer"]> } {
  const sim = new GameSim(1234, "normal");
  const p = sim.addPlayer(1, "Test", { suit: 0, visor: 0, accent: 0 });
  sim.setPlayerPos(1, 50, 1, 60, false, 0);
  return { sim, p };
}

describe("GameSim — intentions", () => {
  it("fore un voxel et crédite les stats (minerai)", () => {
    const { sim, p } = makeSim();
    /* trouve un voxel de fer */
    let fx = -1, fz = -1, fd = -1;
    outer: for (let d = SURF; d < 60; d++)
      for (let z = 2; z < W - 2; z++)
        for (let x = 2; x < W - 2; x++)
          if (tile(sim.S, x, z, d) === 11) { fx = x; fz = z; fd = d; break outer; }
    expect(fx).toBeGreaterThan(0);
    const ack = sim.applyIntent(p, { i: "dig", x: fx, z: fz, d: fd });
    expect(ack).toEqual({ res: "fer" });
    expect(tile(sim.S, fx, fz, fd)).toBe(0);
    expect(sim.S.stats.mined.fer).toBe(1);
    expect(sim.drainTileDeltas()).toEqual([fx, fz, fd, 0]);
  });

  it("refuse de forer trop dur pour le foret Mk1", () => {
    const { sim, p } = makeSim();
    /* basalte (dureté 3) : refusé au Mk1 (h max 2) */
    let bx = -1, bz = -1, bd = -1;
    outer: for (let d = SURF + 42; d < SURF + 78; d++)
      for (let z = 2; z < W - 2; z++)
        for (let x = 2; x < W - 2; x++)
          if (tile(sim.S, x, z, d) === 3) { bx = x; bz = z; bd = d; break outer; }
    const ack = sim.applyIntent(p, { i: "dig", x: bx, z: bz, d: bd });
    expect(ack).toBeNull();
    expect(tile(sim.S, bx, bz, bd)).toBe(3);
  });

  it("construit, produit et consomme l'énergie", () => {
    const { sim, p } = makeSim();
    sim.S.store.fer = 100;
    sim.S.store.cuivre = 50;
    sim.S.store.charbon = 20;
    expect(sim.applyIntent(p, { i: "build", key: "generateur", x: 15, z: 21 })).toBeNull();
    expect(sim.applyIntent(p, { i: "build", key: "fonderie", x: 19, z: 21 })).toBeNull();
    expect(sim.S.builds.length).toBe(2);
    expect(sim.S.store.fer).toBe(100 - 10 - 15);
    /* production de lingots (recette par défaut lingot_fer : 2 fer -> 1, 4 s) */
    for (let i = 0; i < 300; i++) sim.step(1 / 30);
    expect(sim.S.stats.made.lingot_fer ?? 0).toBeGreaterThanOrEqual(2);
    expect(sim.power.prod).toBeGreaterThan(0);
  });

  it("respecte prérequis et exemplaire unique", () => {
    const { sim, p } = makeSim();
    sim.S.store = { acier: 100, circuit: 100, cable: 100 };
    sim.applyIntent(p, { i: "build", key: "baie", x: 15, z: 21 });     // requiert montecharge
    expect(sim.S.builds.length).toBe(0);
    sim.applyIntent(p, { i: "build", key: "montecharge", x: 15, z: 21 });
    sim.applyIntent(p, { i: "build", key: "baie", x: 19, z: 21 });
    expect(sim.S.builds.length).toBe(2);
    sim.applyIntent(p, { i: "build", key: "montecharge", x: 23, z: 21 }); // max 1
    expect(sim.S.builds.filter(b => b.key === "montecharge").length).toBe(1);
  });

  it("améliore par joueur en payant le stock partagé", () => {
    const { sim, p } = makeSim();
    sim.S.store.lingot_fer = 8;
    const ack = sim.applyIntent(p, { i: "upgrade", key: "foret" });
    expect(ack).toEqual({ up: { key: "foret", lvl: 2 } });
    expect(p.up.foret).toBe(2);
    expect(sim.S.store.lingot_fer ?? 0).toBe(0);
  });

  it("fabrique, pose et range des décorations (établi de la fusée)", () => {
    const { sim, p } = makeSim();
    sim.S.store.verre = 2;
    sim.S.store.biogel = 2;
    expect(sim.applyIntent(p, { i: "decoAdd", id: "plante", x: 0.4 })).toEqual({ deco: true });
    expect(sim.S.decos.length).toBe(1);
    expect(sim.S.store.verre ?? 0).toBe(1);
    /* refus si fonds insuffisants */
    sim.applyIntent(p, { i: "decoAdd", id: "trophee", x: 0.6 });
    expect(sim.S.decos.length).toBe(1);
    /* rangement : 60 % rendus */
    sim.applyIntent(p, { i: "decoRemove", x: 0.4 });
    expect(sim.S.decos.length).toBe(0);
    expect(sim.S.store.verre).toBe(2); // ceil(1*0.6)=1 rendu
    /* les décos voyagent dans le snapshot */
    sim.applyIntent(p, { i: "decoAdd", id: "plante", x: 0.7 });
    const snap = sim.serialize();
    const restored = new GameSim(null, "normal", snap);
    expect(restored.S.decos).toEqual([{ id: "plante", x: 0.7 }]);
  });

  it("dépose dans le stock partagé en respectant la capacité", () => {
    const { sim, p } = makeSim();
    const ack = sim.applyIntent(p, { i: "deposit", items: { fer: 250, charbon: 100 } });
    /* capacité 300 sans silo */
    const total = Object.values(ack!.accepted as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    expect(total).toBe(300);
  });
});

describe("GameSim — campagne", () => {
  it("Acte I : décollage condamné -> crash -> abysses -> Acte II ; Acte II -> victoire", () => {
    const { sim, p } = makeSim();
    for (const sys of ROCKET) {
      for (const r in sys.cost) sim.S.store[r] = (sim.S.store[r] || 0) + sys.cost[r];
      sim.applyIntent(p, { i: "contribute", key: sys.key });
    }
    expect(sim.rocketReady()).toBe(true);
    sim.applyIntent(p, { i: "launch" });
    const evs = sim.drainEvents() ?? [];
    expect(evs.some(e => e.t === "launch")).toBe(true);
    for (let i = 0; i < 200; i++) sim.step(1 / 30); // > 5.9 s
    expect(sim.S.act).toBe(2);
    expect(sim.S.worldH).toBe(H2);
    expect(sim.S.qi).toBe(ACT2_QI);
    expect(sim.drainResync()).toBe(true);

    for (const sys of ROCKET2) {
      for (const r in sys.cost) sim.S.store[r] = (sim.S.store[r] || 0) + sys.cost[r];
      sim.applyIntent(p, { i: "contribute", key: sys.key });
    }
    expect(sim.rocketReady()).toBe(true);
    sim.applyIntent(p, { i: "launch" });
    for (let i = 0; i < 250; i++) sim.step(1 / 30); // > 7 s
    expect(sim.S.launched).toBe(true);
    expect(sim.S.qi).toBe(QUESTS.length);
  });

  it("sauvegarde/restauration : snapshot fidèle (grille par seed + éditions)", () => {
    const { sim, p } = makeSim();
    sim.S.store.fer = 42;
    /* creuse quelques voxels */
    for (let d = SURF; d < SURF + 5; d++) sim.applyIntent(p, { i: "dig", x: 12, z: 12, d });
    const snap = sim.serialize();
    const restored = new GameSim(null, "normal", snap);
    expect(restored.S.seed).toBe(sim.S.seed);
    expect(restored.S.store.fer).toBe(42);
    expect(Buffer.from(restored.S.grid).equals(Buffer.from(sim.S.grid))).toBe(true);
  });

  it("les quêtes progressent (objectif 1 : monter à bord)", () => {
    const { sim } = makeSim();
    expect(sim.S.qi).toBe(0);
    sim.setPlayerPos(1, 50, 1, 60, true, 0);   // en foreuse
    for (let i = 0; i < 20; i++) sim.step(1 / 30);
    expect(sim.S.qi).toBe(1);
  });

  it("les paliers de profondeur donnent une prime une seule fois", () => {
    const { sim } = makeSim();
    sim.setPlayerPos(1, 50, -52, 60, true, 0); // 52 m
    sim.step(1 / 30);
    expect(sim.S.store.fer ?? 0).toBe(4);      // prime des 50 m
    sim.step(1 / 30);
    expect(sim.S.store.fer ?? 0).toBe(4);      // pas de doublon
    expect(sim.S.deepest).toBeGreaterThanOrEqual(50);
  });
});
