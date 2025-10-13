import Pokedex from 'pokedex-promise-v2';
import { getPokemonAbilities, hasSpecies } from '$lib/utils/radred-data.js';

const P = new Pokedex();

/**
 * GET /api/pokemon/[name]/abilities.json
 * 
 * Returns the available abilities for a specific Pokemon
 * Uses Radical Red data if available, falls back to PokeAPI
 * 
 * Example response:
 * [
 *   { id: "blaze", name: "Blaze", label: "Blaze", isHidden: false, slot: 1, effect: "..." },
 *   { id: "solar-power", name: "Solar Power", label: "Solar Power", isHidden: true, slot: 2, effect: "..." }
 * ]
 */
export async function GET({ params, url }) {
  const { name } = params;
  const pokemonName = name.toLowerCase();
  
  // Only use Radical Red data if explicitly requested via query parameter
  // Frontend should pass ?game=radred for Radical Red games
  const game = url.searchParams.get('game');
  const useRadredData = game === 'radred' || game === 'radred_hard';
  
  // Strategy 1: Try Radical Red data first (only for Radical Red games)
  if (useRadredData && hasSpecies(pokemonName)) {
    try {
      const abilities = getPokemonAbilities(pokemonName);
      
      if (abilities.length > 0) {
        return new Response(JSON.stringify(abilities), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400',
            'X-Data-Source': 'radred'
          }
        });
      }
    } catch (error) {
      console.warn(`[Abilities] Radical Red data failed for ${pokemonName}, falling back to PokeAPI:`, error.message);
    }
  }
  
  // Strategy 2: Fallback to PokeAPI
  try {
    console.log(`[Abilities] Using PokeAPI for ${pokemonName}`);
    const pokemon = await P.getPokemonByName(pokemonName);
    
    // Transform abilities to our format
    const abilities = pokemon.abilities.map(a => ({
      id: a.ability.name,
      name: a.ability.name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      label: a.ability.name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      isHidden: a.is_hidden,
      slot: a.slot,
      effect: '' // PokeAPI doesn't provide effect in basic call
    }));
    
    return new Response(JSON.stringify(abilities), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'X-Data-Source': 'pokeapi'
      }
    });
  } catch (error) {
    console.error(`[Abilities] Error fetching abilities for ${pokemonName}:`, error.message);
    
    // Return empty array if Pokemon not found in both sources
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Data-Source': 'none'
      }
    });
  }
}

