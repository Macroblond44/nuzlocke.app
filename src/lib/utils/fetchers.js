import { browser } from '$app/environment'
import { getGen } from '$store'

import { DATA } from '$utils/rewrites'
import { normalise } from '$utils/string'
import pokemonData from '$lib/data/pokemon-data.json'

// Type ID to name mapping for Radical Red
const typeMap = {
  0: 'normal', 1: 'fighting', 2: 'flying', 3: 'poison', 4: 'ground',
  5: 'rock', 6: 'bug', 7: 'ghost', 8: 'steel', 10: 'fire',
  11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice',
  16: 'dragon', 17: 'dark', 23: 'fairy'
}

const getTypeName = (typeId) => typeMap[typeId] || 'normal'

// Cache for evolution data
const evolutionCache = {}

/**
 * Fetch evolutions for a Pokemon using the new API
 */
export const fetchEvolutions = async (pokemonName, gameKey = 'radred') => {
  const cacheKey = `${pokemonName}-${gameKey}`
  
  if (evolutionCache[cacheKey]) {
    return evolutionCache[cacheKey]
  }
  
  try {
    const response = await fetch(`/api/pokemon/${pokemonName}/evolutions.json?game=${gameKey}`)
    if (response.ok) {
      const data = await response.json()
      evolutionCache[cacheKey] = data.evolutions || []
      return data.evolutions || []
    }
  } catch (error) {
    console.warn(`Failed to fetch evolutions for ${pokemonName}:`, error)
  }
  
  return []
}

const data = {}
export const fetchData = async () => {
  if (!browser) return

  const gen = await getGen()
  
  // For Radical Red, use pokemon-data.json directly
  if (gen === 'radred' || gen === 'radred_hard') {
    if (data[gen]) return data[gen] // Return cached data if exists
    
    console.time(`data:${gen}`)
    console.log(`[fetchData] Loading Radical Red data from pokemon-data.json`)
    
    // Load from pokemon-data.json
    const gameData = pokemonData.radred
    if (!gameData) {
      console.error(`[fetchData] No Radical Red data found in pokemon-data.json`)
      return { idMap: {}, aliasMap: {}, nameMap: {} }
    }
    
    let result = { idMap: {}, aliasMap: {}, nameMap: {}, keyMap: {} }
    
    // First pass: collect all species data
    const speciesMap = {}
    for (const [id, species] of Object.entries(gameData.species)) {
      if (!species.name) continue
      speciesMap[id] = species
    }
    
    // Second pass: process species with evolution lookups
    for (const [id, species] of Object.entries(gameData.species)) {
      if (!species.name) continue
      
      // Process evolutions - get target names by ID
      const evos = []
      if (species.evolutions) {
        for (const evo of species.evolutions) {
          const targetId = evo[2] // Third element is the target ID
          if (targetId && speciesMap[targetId]) {
            const targetSpecies = speciesMap[targetId]
            // Use key if available, otherwise use name
            const targetKey = targetSpecies.key || targetSpecies.name
            if (targetKey) {
              evos.push(targetKey.toLowerCase().replace(/\s+/g, '-'))
            }
          }
        }
      }
      
      const pokemon = {
        num: parseInt(id),
        name: species.name || species.key,
        key: species.key || species.name?.toLowerCase().replace(/\s+/g, '-'),
        alias: (species.key || species.name).toLowerCase().replace(/\s+/g, '-'),
        sprite: species.dexID || parseInt(id),
        types: species.type ? species.type.map(t => getTypeName(t)) : [],
        baseStats: {
          hp: species.stats[0] || 0,
          atk: species.stats[1] || 0,
          def: species.stats[2] || 0,
          spa: species.stats[3] || 0,
          spd: species.stats[4] || 0,
          spe: species.stats[5] || 0
        },
        total: species.stats ? species.stats.reduce((a, b) => a + b, 0) : 0,
        evos: evos,
        evoline: species.evoline || (species.name || species.key).toLowerCase().replace(/\s+/g, '-')
      }
      
      
      result.idMap[pokemon.num] = pokemon
      // Use alias directly since it now prioritizes key
      result.aliasMap[normalise(pokemon.alias)] = pokemon
      result.nameMap[normalise(pokemon.name.toLowerCase())] = pokemon
      if (pokemon.key) {
        result.keyMap[normalise(pokemon.key.toLowerCase())] = pokemon
      }
      
      
    }
    
    console.timeLog(`data:${gen}`)
    console.timeEnd(`data:${gen}`)
    
    data[gen] = result
    return data[gen]
  }
  
  // For other games, use the legacy system
  const uri = `${DATA}/pokemon/${gen}.json`

  if (data[gen]) return data[gen] // Return the raw data if it exists

  if (!data[uri]) {
    console.time(`data:${gen}`)
    data[uri] = fetch(uri) // "Cache" the promise rather than make a new fetch each time
      .then((res) => res.json())
      .then((data) => {
        console.timeLog(`data:${gen}`)
        let result = { idMap: {}, aliasMap: {}, nameMap: {}, keyMap: {} }
        for (const d of data) {
          result.idMap[d.num] = d
          result.aliasMap[normalise(d.alias)] = d
          result.nameMap[normalise(d.name.toLowerCase())] = d
        }
        console.timeEnd(`data:${gen}`)
        return result
      })
  }

  data[gen] = await data[uri]
  return data[gen]
}

const league = {}
export const fetchLeague = async (game, starter = 'fire') => {
  if (!browser) return

  const id = `${game}@${starter}`
  // Add cache-busting timestamp to force reload of league files
  const uri = `${DATA}/league/${game}.${starter}.json?v=${Date.now()}`

  // Temporarily disable in-memory cache to ensure fresh data
  // if (league[id]) return league[id]
  if (!league[uri]) league[uri] = fetch(uri).then((res) => res.json())

  console.time(`league:${id}`)
  league[id] = await league[uri]
  console.timeEnd(`league:${id}`)
  console.log(`[fetchLeague] Loaded ${id}, sample stats for first pokemon:`, league[id]?.['1']?.pokemon?.[0]?.stats || league[id]?.['2']?.pokemon?.[0]?.stats)
  return league[id]
}

const route = {}
export const fetchRoute = async (game) => {
  if (!browser) return

  const uri = `/api/route/${game}.json`
  if (route[game]) return route[game]
  if (!route[uri]) route[uri] = fetch(uri).then((res) => res.json())

  console.time(`route:${game}`)
  route[game] = await route[uri]
  console.timeEnd(`route:${game}`)
  return route[game]
}

const trainers = {}
export const fetchTrainers = async (game) => {
  if (!browser) return

  const uri = `/api/${game}/trainers.json`
  if (trainers[game]) return trainers[game]
  if (!trainers[uri]) trainers[uri] = fetch(uri).then((res) => res.json())

  console.time(`trainres:${game}`)
  trainers[game] = await trainers[uri]
  console.time(`trainres:${game}`)
  return trainers[game]
}
