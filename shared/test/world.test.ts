import { describe, it, expect } from "vitest";
import { genWorld, deepenWorld, seismicVeins, tile, W, H0, H2, SURF, ORE, GameSim, isRockId } from "../src/index.js";

describe("génération du monde", () => {
  it("est déterministe pour une même seed", () => {
    const a = genWorld(12345);
    const b = genWorld(12345);
    expect(Buffer.from(a.grid).equals(Buffer.from(b.grid))).toBe(true);
    expect(a.nests.length).toBe(b.nests.length);
    expect(a.nests[0].x).toBe(b.nests[0].x);
  });

  it("diffère pour des seeds différentes", () => {
    const a = genWorld(1);
    const b = genWorld(2);
    expect(Buffer.from(a.grid).equals(Buffer.from(b.grid))).toBe(false);
  });

  it("a une surface solide, un ciel libre et un socle au fond", () => {
    const { grid } = genWorld(777);
    const S = { grid, worldH: H0 };
    for (let z = 1; z < W - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        expect(tile(S, x, z, SURF)).toBeGreaterThan(0);       // sol plein
        expect(tile(S, x, z, SURF - 1)).toBe(0);              // ciel
        expect(tile(S, x, z, H0 - 1)).toBe(9);                // socle
      }
    }
    expect(tile(S, 10, 10, -5)).toBe(0);                       // au-dessus du monde : air
    expect(tile(S, 0, 10, 50)).toBe(9);                        // bord : socle
  });

  it("contient les ressources clés en quantités jouables", () => {
    const { grid, nests } = genWorld(4242);
    const counts: Record<number, number> = {};
    for (const v of grid) counts[v] = (counts[v] || 0) + 1;
    expect(counts[ORE.fer]).toBeGreaterThan(3000);
    expect(counts[ORE.charbon]).toBeGreaterThan(3000);
    expect(counts[ORE.uranium]).toBeGreaterThan(300);
    expect(counts[8]).toBeGreaterThanOrEqual(60);              // cristaux
    expect(counts[31]).toBe(1);                                // un seul Cœur
    expect(counts[6]).toBeGreaterThan(1000);                   // lave
    expect(counts[7]).toBeGreaterThan(400);                    // gaz
    expect(nests.length).toBe(3);
  });

  it("ouvre les abysses à l'Acte II en conservant les galeries", () => {
    const sim = new GameSim(999, "normal");
    const S = sim.S;
    /* creuse une galerie témoin */
    for (let d = SURF; d < SURF + 10; d++) {
      S.grid[(d * W + 30) * W + 30] = 0;
      S.edits.push(30, 30, d, 0);
    }
    deepenWorld(S);
    expect(S.worldH).toBe(H2);
    /* galerie conservée */
    for (let d = SURF; d < SURF + 10; d++) expect(tile(S, 30, 30, d)).toBe(0);
    /* magmatite et iridium présents en profondeur */
    let mag = 0, iri = 0;
    for (let d = H0; d < H2; d++)
      for (let z = 1; z < W - 1; z++)
        for (let x = 1; x < W - 1; x++) {
          const v = tile(S, x, z, d);
          if (v === ORE.magmatite) mag++;
          if (v === ORE.iridium) iri++;
        }
    expect(mag).toBeGreaterThan(1000);
    expect(iri).toBeGreaterThan(1000);
  });

  it("régénère des filons par secousse sismique", () => {
    const sim = new GameSim(31337, "normal");
    let ok = 0;
    for (let i = 0; i < 5; i++) ok += seismicVeins(sim.S);
    expect(ok).toBeGreaterThan(0);
    expect(sim.S.edits.length).toBeGreaterThan(0);
    /* les éditions sismiques posent bien du minerai */
    const last = sim.S.edits.slice(-4);
    expect(isRockId(last[3]) || last[3] >= 10).toBe(true);
  });
});
