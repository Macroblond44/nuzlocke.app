/**
 * Utility functions for accessing Radical Red Pokemon data
 * 
 * This module provides helpers to access pokemon-data.json with proper
 * ID resolution and fallback mechanisms.
 */

import pokemonData from '$lib/data/pokemon-data.json';

/**
 * Get species data by name or ID
 * @param {string|number} identifier - Pokemon name or ID
 * @returns {object|null} Species data or null if not found
 */
export function getSpecies(identifier) {
  const species = pokemonData.radred?.species || {};
  
  // If numeric ID, return directly
  if (typeof identifier === 'number' || !isNaN(identifier)) {
    return species[identifier] || null;
  }
  
  // If string name, search by name
  const normalizedName = identifier.toLowerCase().trim();
  const entry = Object.values(species).find(s => 
    s.name?.toLowerCase() === normalizedName ||
    s.name?.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName.replace(/[^a-z0-9]/g, '')
  );
  
  return entry || null;
}

/**
 * Get ability data by ID
 * @param {number} abilityId - Ability ID
 * @returns {object|null} Ability data or null if not found
 */
export function getAbility(abilityId) {
  const abilities = pokemonData.radred?.abilities || {};
  return abilities[abilityId] || null;
}

/**
 * Get abilities for a specific Pokemon
 * @param {string} pokemonName - Pokemon name (e.g., "pikachu", "geodude-alola")
 * @returns {Array} Array of abilities with format { id, name, isHidden, slot }
 */
export function getPokemonAbilities(pokemonName) {
  const species = getSpecies(pokemonName);
  
  if (!species || !species.abilities) {
    return [];
  }
  
  const abilities = pokemonData.radred?.abilities || {};
  const result = [];
  
  // species.abilities format: [[abilityId, slot], [abilityId, slot], ...]
  // slot 0 = regular ability, slot 1+ = hidden ability
  for (const [abilityId, slot] of species.abilities) {
    if (abilityId === 0) continue; // Skip empty slots
    
    const abilityData = abilities[abilityId];
    if (!abilityData) continue;
    
    const abilityName = abilityData.names?.[0] || `Ability_${abilityId}`;
    
    result.push({
      id: abilityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      name: abilityName,
      label: abilityName,
      isHidden: slot > 0,
      slot: slot + 1,
      effect: abilityData.description || ''
    });
  }
  
  return result;
}

/**
 * Get move data by ID
 * @param {number} moveId - Move ID
 * @returns {object|null} Move data or null if not found
 */
export function getMove(moveId) {
  const moves = pokemonData.radred?.moves || {};
  return moves[moveId] || null;
}

/**
 * Get all moves a Pokemon can learn
 * @param {string} pokemonName - Pokemon name
 * @returns {object} Object with levelUp, tm, tutor, and egg moves
 */
export function getPokemonMoves(pokemonName) {
  const species = getSpecies(pokemonName);
  
  if (!species) {
    return { levelUp: [], tm: [], tutor: [], egg: [] };
  }
  
  const moves = pokemonData.radred?.moves || {};
  const tmMovesList = pokemonData.radred?.tmMoves || [];
  const tutorMovesList = pokemonData.radred?.tutorMoves || [];
  
  // Level-up moves: [[moveId, level], ...]
  const levelUp = (species.levelupMoves || []).map(([moveId, level]) => {
    const moveData = moves[moveId];
    return moveData ? {
      level,
      ...formatMove(moveData, moveId)
    } : null;
  }).filter(m => m);
  
  // TM moves (array of moveIds that match TM list)
  // TODO: Implement TM move extraction
  
  // Tutor moves
  // TODO: Implement tutor move extraction
  
  // Egg moves
  // TODO: Implement egg move extraction
  
  return {
    levelUp,
    tm: [],
    tutor: [],
    egg: []
  };
}

/**
 * Format move data to standard structure
 */
function formatMove(moveData, moveId) {
  const moveName = moveData.names?.[0] || `Move_${moveId}`;
  
  return {
    id: moveName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    name: moveName,
    type: moveData.type || 'normal',
    power: moveData.power || null,
    accuracy: moveData.accuracy || null,
    pp: moveData.pp || null,
    damageClass: moveData.damageClass || 'status',
    effect: moveData.description || ''
  };
}

/**
 * Check if Pokemon exists in Radical Red data
 * @param {string} pokemonName - Pokemon name
 * @returns {boolean}
 */
export function hasSpecies(pokemonName) {
  return getSpecies(pokemonName) !== null;
}

