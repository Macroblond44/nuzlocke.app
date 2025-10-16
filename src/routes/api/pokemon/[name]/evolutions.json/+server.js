import pokemonData from '$lib/data/pokemon-data.json'

/**
 * GET /api/pokemon/[name]/evolutions.json
 * 
 * Returns all possible evolutions for a Pokemon, with priority for game-specific data
 * when game parameter is provided.
 * 
 * Query parameters:
 * - game: Game key (e.g., 'radred', 'radred_hard')
 * 
 * Response format:
 * {
 *   "evolutions": [
 *     {
 *       "name": "Meowstic",
 *       "alias": "meowstic", 
 *       "method": "level",
 *       "level": 25,
 *       "conditions": []
 *     }
 *   ]
 * }
 */
export async function GET({ params, url }) {
  const { name } = params;
  const pokemonName = name.toLowerCase();
  
  // Get game parameter
  const game = url.searchParams.get('game') || url.searchParams.get('gameKey');
  
  // Default to Radical Red if no game specified
  const gameKey = game || 'radred';
  
  // Get game data from pokemon-data.json
  const gameData = pokemonData[gameKey];
  if (!gameData || !gameData.species) {
    return new Response(JSON.stringify({ evolutions: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate'
      }
    });
  }
  
  // Find the Pokemon by name (case insensitive)
  let targetPokemon = null;
  let targetId = null;
  
  for (const [id, species] of Object.entries(gameData.species)) {
    if (species.name && species.name.toLowerCase() === pokemonName) {
      targetPokemon = species;
      targetId = id;
      break;
    }
  }
  
  if (!targetPokemon || !targetPokemon.evolutions) {
    return new Response(JSON.stringify({ evolutions: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate'
      }
    });
  }
  
  // Process evolutions
  const evolutions = [];
  
  for (const evo of targetPokemon.evolutions) {
    const targetId = evo[2]; // Third element is the target ID
    const targetSpecies = gameData.species[targetId];
    
    if (targetSpecies && targetSpecies.name) {
      const evolution = {
        name: targetSpecies.name,
        key: targetSpecies.key || targetSpecies.name.toLowerCase().replace(/\s+/g, '-'),
        alias: targetSpecies.key || targetSpecies.name.toLowerCase().replace(/\s+/g, '-'),
        method: getEvolutionMethod(evo),
        level: evo[1] || null,
        conditions: getEvolutionConditions(evo)
      };
      
      evolutions.push(evolution);
    }
  }
  
  return new Response(JSON.stringify({ evolutions }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate'
    }
  });
}

/**
 * Determine evolution method from evolution data
 */
function getEvolutionMethod(evo) {
  const method = evo[0];
  
  // Common evolution methods in Radical Red
  switch (method) {
    case 4: return 'level';
    case 7: return 'stone';
    case 8: return 'trade';
    case 9: return 'friendship';
    case 10: return 'item';
    case 20: return 'level';
    case 21: return 'level';
    default: return 'level';
  }
}

/**
 * Get evolution conditions from evolution data
 */
function getEvolutionConditions(evo) {
  const conditions = [];
  
  // Add gender condition if applicable
  if (evo[0] === 21) { // Female evolution
    conditions.push('female');
  } else if (evo[0] === 20) { // Male evolution
    conditions.push('male');
  }
  
  // Add other conditions based on evolution data
  // This can be expanded based on the specific evolution requirements
  
  return conditions;
}
