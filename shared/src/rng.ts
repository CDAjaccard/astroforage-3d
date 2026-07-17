/* PRNG mulberry32 — porté tel quel du jeu original (js/world.js) pour une
 * génération de monde identique et déterministe côté client et serveur. */
export type Rng = () => number;

export function mulberry32(a: number): Rng {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed aléatoire 31 bits (nouvelle partie). */
export function randomSeed(): number {
  return (Math.random() * 1e9) | 0;
}
