const SEED_RESOLUTION_MS = 60_000;

const MOCK_SEED = Math.round(Date.now() / SEED_RESOLUTION_MS);

export const MOCK_NOW_MS = MOCK_SEED * SEED_RESOLUTION_MS;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(namespace: string): number {
  let hash = 2166136261;
  for (let index = 0; index < namespace.length; index++) {
    hash ^= namespace.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash ^ MOCK_SEED) >>> 0;
}

export function createMockRng(namespace: string): () => number {
  return mulberry32(hashSeed(namespace));
}
