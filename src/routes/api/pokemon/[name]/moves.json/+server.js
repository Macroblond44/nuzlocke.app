import Pokedex from 'pokedex-promise-v2';
import { getPokemonMoves, hasSpecies } from '$lib/utils/radred-data.js';

const P = new Pokedex();

/**
 * GET /api/pokemon/[name]/moves.json
 * 
 * Returns all moves a Pokemon can learn, with priority for Radical Red data
 * when game=radred is passed as query parameter.
 * 
 * Response format:
 * {
 *   levelUp: [{ id, name, type, power, accuracy, pp, damage_class, priority, effect, level }],
 *   tm: [],
 *   tutor: [],
 *   egg: []
 * }
 */
export async function GET({ params, url }) {
  const { name } = params;
  const pokemonName = name.toLowerCase();
  
  // Only use Radical Red data if explicitly requested via query parameter
  const game = url.searchParams.get('game') || url.searchParams.get('gameKey');
  const useRadredData = game === 'radred' || game === 'radred_hard';
  
  // Strategy 1: Try Radical Red data first (only for Radical Red games)
  if (useRadredData && hasSpecies(pokemonName)) {
    try {
      const moves = getPokemonMoves(pokemonName);
      
      if (moves.levelUp.length > 0 || moves.tm.length > 0 || moves.tutor.length > 0 || moves.egg.length > 0) {
        console.log(`[Moves] Using Radical Red data for ${pokemonName}`);
        return new Response(JSON.stringify(moves), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400',
            'X-Data-Source': 'radred'
          }
        });
      }
    } catch (error) {
      console.warn(`[Moves] Radical Red data failed for ${pokemonName}, falling back to PokeAPI:`, error.message);
    }
  }
  
  // Strategy 2: Fallback to PokeAPI
  try {
    console.log(`[Moves] Using PokeAPI for ${pokemonName}`);
    const pokemon = await P.getPokemonByName(pokemonName);
    
    // Extract level-up moves
    const levelUpMoves = pokemon.moves
      .filter(m => m.version_group_details.some(v => v.move_learn_method.name === 'level-up'))
      .map(m => {
        const versionDetail = m.version_group_details.find(v => v.move_learn_method.name === 'level-up');
        return {
          level: versionDetail.level_learned_at,
          moveUrl: m.move.url
        };
      })
      .sort((a, b) => a.level - b.level);
    
    // Fetch move details (limit to avoid too many requests)
    const movePromises = levelUpMoves.slice(0, 50).map(async ({ level, moveUrl }) => {
      try {
        const moveData = await fetch(moveUrl).then(r => r.json());
        return {
          id: moveData.name,
          name: moveData.name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          type: moveData.type?.name || 'normal',
          power: moveData.power,
          accuracy: moveData.accuracy,
          pp: moveData.pp,
          damage_class: moveData.damage_class?.name || 'status',
          priority: moveData.priority || 0,
          effect: moveData.effect_entries.find(e => e.language.name === 'en')?.short_effect || '',
          level
        };
      } catch (err) {
        console.error(`Failed to fetch move ${moveUrl}:`, err);
        return null;
      }
    });
    
    const levelUp = (await Promise.all(movePromises)).filter(Boolean);
    
    return new Response(JSON.stringify({
      levelUp,
      tm: [],
      tutor: [],
      egg: []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'X-Data-Source': 'pokeapi'
      }
    });
  } catch (error) {
    console.error(`[Moves] Error fetching moves for ${pokemonName}:`, error.message);
    
    return new Response(JSON.stringify({
      levelUp: [],
      tm: [],
      tutor: [],
      egg: []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Data-Source': 'none'
      }
    });
  }
}

