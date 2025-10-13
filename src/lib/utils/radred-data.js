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
  
  // If string name, search by name or key
  const normalizedName = identifier.toLowerCase().trim();
  
  const entry = Object.values(species).find(s => {
    const nameMatch = s.name?.toLowerCase() === normalizedName;
    const keyMatch = s.key?.toLowerCase() === normalizedName;
    const nameNormalizedMatch = s.name?.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName.replace(/[^a-z0-9]/g, '');
    const keyNormalizedMatch = s.key?.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName.replace(/[^a-z0-9]/g, '');
    
    return nameMatch || keyMatch || nameNormalizedMatch || keyNormalizedMatch;
  });
  
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
  // Based on Radical Red Pokedex source code:
  // a[0] = Hidden ability (speciesAbilitiesHidden)
  // a[1] = Primary ability (speciesAbilitiesPrimary) 
  // a[2] = Secondary ability (speciesAbilitiesSecondary)
  for (let i = 0; i < species.abilities.length; i++) {
    const [abilityId, slot] = species.abilities[i];
    if (abilityId === 0) continue; // Skip empty slots
    
    const abilityData = abilities[abilityId];
    if (!abilityData) continue;
    
    const abilityName = abilityData.names?.[0] || `Ability_${abilityId}`;
    
    result.push({
      id: abilityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      name: abilityName,
      label: abilityName,
      isHidden: i === 0, // a[0] is the hidden ability
      slot: i + 1,
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
  const result = {
    levelUp: [],
    tm: [],
    tutor: [],
    egg: []
  };
  
  // Level-up moves: [[moveId, level], ...]
  if (species.levelupMoves && Array.isArray(species.levelupMoves)) {
    species.levelupMoves.forEach(([moveId, level]) => {
      const moveData = moves[moveId];
      if (moveData) {
        result.levelUp.push({
          id: moveData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          name: moveData.name,
          type: getTypeName(moveData.type),
          power: moveData.power,
          accuracy: moveData.accuracy,
          pp: moveData.pp,
          damage_class: getDamageClassName(moveData.split),
          priority: moveData.priority,
          effect: moveData.description || '',
          level: level
        });
      }
    });
  }
  
  // Sort level-up moves by level
  result.levelUp.sort((a, b) => a.level - b.level);
  
  return result;
}

/**
 * Type ID to name mapping
 */
const TYPE_NAMES = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost',
  'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon',
  'dark', 'fairy', 'stellar'
];

/**
 * Split ID to damage class mapping
 * 0 = physical, 1 = special, 2 = status
 */
const DAMAGE_CLASS_NAMES = ['physical', 'special', 'status'];

/**
 * Format move data to standard structure expected by MoveCard
 */
function formatMove(moveData, moveId) {
  const types = pokemonData.radred?.types || {};
  const moveName = moveData.name || `Move_${moveId}`;
  
  // Get type name from type ID
  const typeData = types[moveData.type];
  const typeName = typeData?.name?.toLowerCase() || TYPE_NAMES[moveData.type] || 'normal';
  
  // Get damage class from split (0=physical, 1=special, 2=status)
  const damageClass = DAMAGE_CLASS_NAMES[moveData.split] || 'status';
  
  return {
    id: moveName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    name: moveName,
    type: typeName,
    power: moveData.power || null,
    accuracy: moveData.accuracy || null,
    pp: moveData.pp || null,
    damage_class: damageClass,
    priority: moveData.priority || 0,
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

/**
 * Evolution method constants
 * Based on Pokémon Essentials/Pokémon data structure
 */
const EVOLUTION_METHODS = {
  1: 'friendship',      // Friendship
  2: 'friendship-day',  // Friendship during day
  3: 'friendship-night',// Friendship during night
  4: 'level',          // Level up
  5: 'trade',          // Trade
  6: 'trade-item',     // Trade holding item
  7: 'item',           // Use item
  8: 'level-attack',   // Level with Attack > Defense
  9: 'level-defense',  // Level with Attack < Defense
  10: 'level-equal',   // Level with Attack = Defense
  // ... more methods exist but these are the most common
  254: 'mega',         // Mega evolution
  255: 'primal'        // Primal reversion
};

/**
 * Get evolution data for a Pokemon
 * @param {string} pokemonName - Pokemon name (e.g., "bulbasaur")
 * @returns {Array} Array of evolution objects with format:
 *   [{ method: 'level', parameter: 16, evolvedForm: 'ivysaur', evolvedFormId: 2 }]
 */
export function getPokemonEvolutions(pokemonName) {
  const species = getSpecies(pokemonName);
  
  if (!species || !species.evolutions || species.evolutions.length === 0) {
    return [];
  }
  
  const allSpecies = pokemonData.radred?.species || {};
  const result = [];
  
  // species.evolutions format: [[method, parameter, evolvedFormId, 0], ...]
  // Example: [4, 16, 2, 0] = Level 16 → Ivysaur (ID: 2)
  for (const [methodId, parameter, evolvedFormId, _unused] of species.evolutions) {
    const evolvedSpecies = allSpecies[evolvedFormId];
    
    if (!evolvedSpecies) {
      console.warn(`[getPokemonEvolutions] Evolution target ID ${evolvedFormId} not found for ${pokemonName}`);
      continue;
    }
    
    const methodName = EVOLUTION_METHODS[methodId] || `unknown-${methodId}`;
    const evolvedFormName = evolvedSpecies.name.toLowerCase();
    
    result.push({
      method: methodName,
      parameter: parameter,
      evolvedForm: evolvedFormName,
      evolvedFormId: evolvedFormId,
      // For level-based evolutions, include the level for easy access
      ...(methodName === 'level' && { level: parameter })
    });
  }
  
  return result;
}

/**
 * Get the evolved form of a Pokemon at a specific level
 * Returns the highest evolution stage reachable at the given level
 * 
 * @param {string} pokemonName - Pokemon name
 * @param {number} level - Target level (usually level cap)
 * @returns {string|null} Evolved form name or null if no evolution at this level
 */
export function getEvolvedFormAtLevel(pokemonName, level) {
  let currentForm = pokemonName.toLowerCase();
  let evolved = false;
  
  // Keep evolving until we can't anymore
  // This handles multi-stage evolutions (e.g., Bulbasaur → Ivysaur → Venusaur)
  let attempts = 0;
  const MAX_ATTEMPTS = 10; // Prevent infinite loops
  
  while (attempts < MAX_ATTEMPTS) {
    const evolutions = getPokemonEvolutions(currentForm);
    
    // Find level-based evolution that can be reached
    const levelEvolution = evolutions.find(evo => 
      evo.method === 'level' && evo.level <= level
    );
    
    if (levelEvolution) {
      currentForm = levelEvolution.evolvedForm;
      evolved = true;
      attempts++;
    } else {
      // No more evolutions available at this level
      break;
    }
  }
  
  return evolved ? currentForm : null;
}

/**
 * Get type name by ID
 * @param {number} typeId - Type ID
 * @returns {string} Type name
 */
function getTypeName(typeId) {
  const types = pokemonData.radred?.types || {};
  const typeData = types[typeId];
  return typeData?.name?.toLowerCase() || 'normal';
}

/**
 * Get damage class name by split value
 * @param {number} split - Split value (0=physical, 1=special, 2=status)
 * @returns {string} Damage class name
 */
function getDamageClassName(split) {
  switch (split) {
    case 0: return 'physical';
    case 1: return 'special';
    case 2: return 'status';
    default: return 'status';
  }
}


