import Pokedex from 'pokedex-promise-v2';
import { getMove, hasSpecies } from '$lib/utils/radred-data.js';

const P = new Pokedex();

/**
 * GET /api/move/[name].json
 * 
 * Returns complete move data for a given move name.
 * Uses Radical Red data when available, falls back to PokeAPI.
 * 
 * Response format:
 * {
 *   name: string,
 *   power: number | null,
 *   type: string,
 *   damage_class: string,
 *   priority: number,
 *   effect: string,
 *   pp: number | null,
 *   accuracy: number | null
 * }
 */
export async function GET({ params, url }) {
  const { name } = params;
  const moveName = name.toLowerCase().replace(/\s+/g, '-');
  
  // Check if we have Radical Red data for this move
  try {
    // Try to find the move in Radical Red data
    const moves = require('$lib/data/pokemon-data.json').radred?.moves || {};
    const moveId = Object.keys(moves).find(id => {
      const move = moves[id];
      const moveSlug = move.name?.toLowerCase().replace(/\s+/g, '-');
      return moveSlug === moveName;
    });
    
    if (moveId && moves[moveId]) {
      const moveData = moves[moveId];
      const types = require('$lib/data/pokemon-data.json').radred?.types || {};
      
      // Format move data to match MoveCard expectations
      const formattedMove = {
        name: moveData.name || `Move_${moveId}`,
        type: types[moveData.type]?.name?.toLowerCase() || 'normal',
        power: moveData.power || null,
        accuracy: moveData.accuracy || null,
        pp: moveData.pp || null,
        damage_class: moveData.split === 0 ? 'physical' : moveData.split === 1 ? 'special' : 'status',
        priority: moveData.priority || 0,
        effect: moveData.description || ''
      };
      
      console.log(`[Move] Using Radical Red data for ${moveName}`);
      return new Response(JSON.stringify(formattedMove), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
          'X-Data-Source': 'radred'
        }
      });
    }
  } catch (error) {
    console.warn(`[Move] Radical Red data not found for ${moveName}, falling back to PokeAPI:`, error.message);
  }
  
  // Fallback to PokeAPI
  try {
    console.log(`[Move] Using PokeAPI for ${moveName}`);
    const moveData = await P.getMoveByName(moveName);
    
    const formattedMove = {
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
      effect: moveData.effect_entries.find(e => e.language.name === 'en')?.short_effect || ''
    };
    
    return new Response(JSON.stringify(formattedMove), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'X-Data-Source': 'pokeapi'
      }
    });
  } catch (error) {
    console.error(`[Move] Error fetching move ${moveName}:`, error.message);
    
    // Return minimal move data if all else fails
    const fallbackMove = {
      name: moveName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      type: 'normal',
      power: null,
      accuracy: null,
      pp: null,
      damage_class: 'status',
      priority: 0,
      effect: ''
    };
    
    return new Response(JSON.stringify(fallbackMove), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Data-Source': 'fallback'
      }
    });
  }
}
