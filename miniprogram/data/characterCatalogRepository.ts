import { HanziCharacter } from '../domain/models'

const level1 = require('../resources/characters_level1.js') as HanziCharacter[]
const level2 = require('../resources/characters_level2.js') as HanziCharacter[]
const level3 = require('../resources/characters_level3.js') as HanziCharacter[]
const level4 = require('../resources/characters_level4.js') as HanziCharacter[]

let cached: HanziCharacter[] | null = null
let byId: Record<string, HanziCharacter> | null = null

export function loadCatalog(): HanziCharacter[] {
  if (cached) return cached

  const merged = [...level1, ...level2, ...level3, ...level4]
  const seen = new Set<string>()
  cached = merged.filter((char) => {
    if (seen.has(char.id)) return false
    seen.add(char.id)
    return true
  })
  byId = Object.fromEntries(cached.map((c) => [c.id, c]))
  return cached
}

export function getCharacter(id: string): HanziCharacter | undefined {
  if (!byId) loadCatalog()
  return byId ? byId[id] : undefined
}

export function getCatalogById(): Record<string, HanziCharacter> {
  if (!byId) loadCatalog()
  return byId || {}
}
