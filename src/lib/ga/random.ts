// The GA's source of randomness — seedable, so a plan can be reproduced.
//
// Every random choice in the GA (selection, crossover cut points, mutation,
// the shuffled starting population) goes through random(). It is Math.random
// unless a run is wrapped in withSeed(), which the planner does with a seed it
// stores in the plan's metadata: running the same inputs with the same seed
// gives the same plan, which is what makes a result in the thesis checkable.
//
// The GA runs synchronously, so swapping the generator for the length of one
// run can't leak into another request.

let current: () => number = Math.random;

export function random(): number {
  return current();
}

/** mulberry32: a small, fast 32-bit generator — plenty for a GA. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs `fn` with random() drawing from a generator seeded with `seed`. */
export function withSeed<T>(seed: number, fn: () => T): T {
  const previous = current;
  current = mulberry32(seed);
  try {
    return fn();
  } finally {
    current = previous;
  }
}

/** A fresh seed for a run that should be reproducible later. */
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}
