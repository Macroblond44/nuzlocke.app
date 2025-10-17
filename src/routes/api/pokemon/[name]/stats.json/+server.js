import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET({ params, url }) {
  try {
    const { name } = params
    const game = url.searchParams.get('game') || 'radred'
    
    if (!name) {
      return new Response(JSON.stringify({ error: 'Pokemon name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Load pokemon data
    const pokemonDataPath = join(process.cwd(), 'src/lib/data/pokemon-data.json')
    const pokemonData = JSON.parse(readFileSync(pokemonDataPath, 'utf8'))
    
    if (!pokemonData[game]) {
      return new Response(JSON.stringify({ error: `Game '${game}' not found` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const gameData = pokemonData[game]
    const species = gameData.species[name]
    
    if (!species) {
      return new Response(JSON.stringify({ error: `Pokemon '${name}' not found in game '${game}'` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Map type IDs to names
    const typeMap = {
      0: 'normal', 1: 'fighting', 2: 'flying', 3: 'poison', 4: 'ground',
      5: 'rock', 6: 'bug', 7: 'ghost', 8: 'steel', 9: 'fire',
      10: 'water', 11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic',
      15: 'ice', 16: 'dragon', 17: 'dark', 23: 'fairy'
    }
    
    const getTypeName = (typeId) => typeMap[typeId] || 'unknown'

    // Return stats in correct order: HP, atk, def, spe, spa, spd
    const stats = {
      name: species.name || species.key,
      key: species.key || species.name?.toLowerCase().replace(/\s+/g, '-'),
      alias: (species.key || species.name).toLowerCase().replace(/\s+/g, '-'),
      types: species.type ? species.type.map(t => getTypeName(t)) : [],
      baseStats: {
        hp: species.stats[0] || 0,
        atk: species.stats[1] || 0,
        def: species.stats[2] || 0,
        spe: species.stats[3] || 0,
        spa: species.stats[4] || 0,
        spd: species.stats[5] || 0
      },
      total: species.stats ? species.stats.reduce((a, b) => a + b, 0) : 0
    }

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Error fetching Pokemon stats:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
