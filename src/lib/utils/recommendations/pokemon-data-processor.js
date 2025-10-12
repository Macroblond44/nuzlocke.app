/**
 * Pokémon Data Processing Utilities
 * 
 * Shared utilities for converting Pokémon data between different formats
 * for use with the advanced recommendations API and other components.
 * 
 * This module eliminates code duplication between:
 * - ProgressModal.svelte (boss battle recommendations)
 * - RouteRecommendations.svelte (route recommendations)
 */

import { getEvolvedFormAtLevel, hasSpecies } from '$lib/utils/radred-data.js';

/**
 * Auto-evolve a Pokémon to its highest form based on level cap
 * 
 * This function checks if a Pokémon should be evolved based on the level cap
 * and returns the evolved form name if applicable. Handles multi-stage evolutions.
 * 
 * @param {string} pokemonName - Original Pokémon name
 * @param {number} levelCap - Target level (Nuzlocke level cap)
 * @param {string} game - Game identifier (e.g., 'radred', 'radred_hard')
 * @returns {string} Evolved form name or original name if no evolution
 */
function autoEvolvePokemon(pokemonName, levelCap, game = '') {
  // Only auto-evolve for Radical Red games (where we have evolution data)
  const isRadredGame = game === 'radred' || game === 'radred_hard';
  
  if (!isRadredGame || !pokemonName) {
    return pokemonName;
  }
  
  // Check if Pokemon exists in Radical Red data
  if (!hasSpecies(pokemonName)) {
    console.log(`[Auto-Evolve] ${pokemonName} not found in Radical Red data, keeping original form`);
    return pokemonName;
  }
  
  try {
    const evolvedForm = getEvolvedFormAtLevel(pokemonName, levelCap);
    
    if (evolvedForm) {
      console.log(`[Auto-Evolve] ${pokemonName} → ${evolvedForm} at level ${levelCap}`);
      return evolvedForm;
    }
    
    console.log(`[Auto-Evolve] ${pokemonName} does not evolve at level ${levelCap}`);
    return pokemonName;
  } catch (error) {
    console.warn(`[Auto-Evolve] Error evolving ${pokemonName}:`, error.message);
    return pokemonName; // Return original on error
  }
}

/**
 * Convert captured Pokémon data to the format expected by advanced recommendations API
 * 
 * Auto-evolves Pokémon based on level cap before formatting.
 * 
 * @param {Array} capturedPokemon - Array of captured Pokémon with full data
 * @param {number} levelCap - Maximum level to apply (Nuzlocke level cap)
 * @param {string} game - Game identifier for evolution data (e.g., 'radred')
 * @returns {Array} Formatted user Pokémon data
 */
export function formatCapturedPokemonForAPI(capturedPokemon, levelCap = 50, game = '') {
  return capturedPokemon.map(pokemon => {
    const originalName = pokemon.alias || pokemon.name;
    const pokemonLevel = Math.min(pokemon.original?.level || 50, levelCap);
    
    // Auto-evolve based on level cap
    const evolvedName = autoEvolvePokemon(originalName, levelCap, game);
    
    return {
      name: evolvedName,
      level: pokemonLevel,
      ability: pokemon.original?.ability || pokemon.abilities?.[0]?.name || 'unknown',
      nature: pokemon.original?.nature || 'Hardy',
      moves: (pokemon.original?.moves || pokemon.moves || []).map(m => 
        typeof m === 'string' ? m : (m.name || m)
      ),
      item: pokemon.original?.held?.name || pokemon.original?.held || 'none',
      evs: pokemon.original?.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: pokemon.original?.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
    };
  });
}

/**
 * Convert route Pokémon data to the format expected by advanced recommendations API
 * 
 * Auto-evolves Pokémon based on level cap before formatting.
 * 
 * For route Pokémon (wild encounters), the API will:
 * - Fetch ALL attacking moves learnable up to level cap
 * - Select a random non-hidden ability
 * - Calculate optimal move selection during battle simulation
 * 
 * @param {Array} routePokemon - Array of route Pokémon (from encounters)
 * @param {number} levelCap - Maximum level to apply (Nuzlocke level cap)
 * @param {string} game - Game identifier for evolution data (e.g., 'radred')
 * @returns {Array} Formatted user Pokémon data
 */
export function formatRoutePokemonForAPI(routePokemon, levelCap = 50, game = '') {
  return routePokemon.map(pokemon => {
    const originalName = pokemon.name || pokemon.alias;
    
    // Auto-evolve based on level cap
    const evolvedName = autoEvolvePokemon(originalName, levelCap, game);
    
    return {
      name: evolvedName,
      level: levelCap, // Apply level cap to route pokemon
      ability: null, // Will be randomly selected by the API (non-hidden)
      nature: 'Hardy', // Default nature (neutral)
      item: 'none',
      moves: [], // Will fetch ALL attacking moves learnable up to level cap
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    };
  });
}

/**
 * Convert rival/boss Pokémon data to the format expected by advanced recommendations API
 * 
 * @param {Array} rivalPokemon - Array of rival Pokémon (boss team or gym team)
 * @returns {Array} Formatted rival Pokémon data
 */
export function formatRivalPokemonForAPI(rivalPokemon) {
  return rivalPokemon.map(pokemon => ({
    name: pokemon.alias || pokemon.name,
    level: pokemon.original?.level || pokemon.level || 50,
    ability: pokemon.original?.ability || pokemon.ability || pokemon.abilities?.[0]?.name || 'unknown',
    nature: pokemon.original?.nature || pokemon.nature || 'Hardy',
    moves: (pokemon.original?.moves || pokemon.moves || []).map(m => {
      if (typeof m === 'string') return m;
      
      // Special handling for Hidden Power - preserve type information
      if (m.name === 'Hidden Power' && m.type) {
        return `${m.name} ${m.type}`; // e.g., "Hidden Power grass"
      }
      
      return m.name || m;
    }),
    item: pokemon.original?.held?.name || pokemon.original?.held || pokemon.held?.name || pokemon.held || 'none',
    stats: pokemon.stats || pokemon.baseStats || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    evs: pokemon.original?.evs || pokemon.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: pokemon.original?.ivs || pokemon.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
  }))
}

/**
 * Convert boss team data from RouteRecommendations format to API format
 * 
 * This function handles the same data structure as ProgressModal's fetchPkmnSet:
 * { original: { name, level, ability, nature, moves, item }, ...pokemonData }
 * 
 * @param {Array} bossTeam - Boss team from RouteRecommendations or ProgressModal
 * @returns {Array} Formatted rival Pokémon data
 */
export function formatBossTeamForAPI(bossTeam) {
  return bossTeam.map(bossPokemon => {
    // Extract data from the same structure as ProgressModal uses
    const original = bossPokemon.original || {}
    
    return {
      name: bossPokemon.alias || bossPokemon.name || original.name,
      level: original.level || bossPokemon.level || 50,
      ability: original.ability || bossPokemon.ability || bossPokemon.abilities?.[0]?.name || 'unknown',
      nature: original.nature || bossPokemon.nature || 'Hardy',
      moves: (original.moves || bossPokemon.moves || []).map(m => {
        if (typeof m === 'string') return m;
        
        // Special handling for Hidden Power - preserve type information
        if (m.name === 'Hidden Power' && m.type) {
          return `${m.name} ${m.type}`; // e.g., "Hidden Power grass"
        }
        
        return m.name || m;
      }),
      item: original.held?.name || original.held || bossPokemon.held?.name || bossPokemon.held || original.item || bossPokemon.item || 'none',
      // IMPORTANT: Use stats from league file (original), not from getPkmn (bossPokemon)
      // League file has the correct stats for trainers/bosses from static files
      stats: original.stats || bossPokemon.stats || bossPokemon.baseStats || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      evs: original.evs || bossPokemon.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: original.ivs || bossPokemon.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
    }
  })
}

/**
 * Calculate level cap from rival Pokémon levels
 * 
 * @param {Array} rivalPokemon - Array of rival Pokémon
 * @returns {number} Maximum level among rivals (Nuzlocke level cap)
 */
export function calculateLevelCap(rivalPokemon) {
  return Math.max(...rivalPokemon.map(p => parseInt(p.level || p.original?.level) || 50))
}

/**
 * Validate Pokémon data for advanced recommendations
 * 
 * @param {Array} userPokemon - User's Pokémon data
 * @returns {Object} Validation result with missing data info
 */
export function validatePokemonForAdvancedRecommendations(userPokemon) {
  const missingData = []
  
  for (const pokemon of userPokemon) {
    const hasAbility = pokemon.ability && pokemon.ability !== 'unknown' && pokemon.ability !== null
    const hasMoves = pokemon.moves && pokemon.moves.length > 0
    
    if (!hasAbility && !hasMoves) {
      missingData.push({
        name: pokemon.name || pokemon.alias,
        missing: 'ability and moves'
      })
    } else if (!hasAbility) {
      missingData.push({
        name: pokemon.name || pokemon.alias,
        missing: 'ability'
      })
    } else if (!hasMoves) {
      missingData.push({
        name: pokemon.name || pokemon.alias,
        missing: 'moves'
      })
    }
  }
  
  return {
    isValid: missingData.length === 0,
    missingData
  }
}

/**
 * Create error message for missing Pokémon data
 * 
 * @param {Array} missingData - Array of missing data info
 * @returns {string} User-friendly error message
 */
export function createMissingDataErrorMessage(missingData) {
  const errorMsg = missingData.map(p => `${p.name} (missing ${p.missing})`).join(', ')
  return `Cannot use advanced recommendations. The following Pokémon need to be configured: ${errorMsg}. Please click on the Status or Nature field to open the configuration modal and add missing data.`
}
