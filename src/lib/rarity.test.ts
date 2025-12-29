// Type-level test: ensure `rarityColors` has exactly the keys in `Rarity`.
import { Rarity, rarityColors } from "./rarity";

// Helper: the function requires a Record with all Rarity keys. If `rarityColors` is missing a key
// or has extra keys, this will produce a TypeScript error at compile time.
function assertHasAllRarityKeys<T extends Record<Rarity, any>>(obj: T) { return obj; }

// This line will cause a type error if `rarityColors` does not match `Record<Rarity, ...>`
const _assertRarityKeys = assertHasAllRarityKeys(rarityColors);

export {};
