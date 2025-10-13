/**
 * Ability Modifiers for Pokémon Battle Calculations
 * 
 * This module handles special ability effects that modify damage calculations
 * beyond what @smogon/calc provides. These are game-specific mechanics that
 * need to be applied manually to ensure accurate battle simulations.
 */

/**
 * Applies ability-based damage modifications to a damage calculation result
 * @param {Object} damageResult - The result from @smogon/calc
 * @param {Object} attacker - The attacking Pokémon
 * @param {Object} defender - The defending Pokémon
 * @param {Object} move - The move being used
 * @param {number} defenderCurrentHP - Current HP of the defender
 * @param {number} defenderMaxHP - Maximum HP of the defender
 * @returns {Object} Modified damage result with ability effects applied
 */
export function applyAbilityModifiers(damageResult, attacker, defender, move, defenderCurrentHP, defenderMaxHP) {
  let modifiedResult = { ...damageResult };
  
  // Apply defender's ability effects
  modifiedResult = applyDefenderAbilities(modifiedResult, defender, move, defenderCurrentHP, defenderMaxHP);
  
  return modifiedResult;
}

/**
 * Applies defender ability effects to damage calculation
 * @param {Object} damageResult - The damage calculation result
 * @param {Object} defender - The defending Pokémon
 * @param {Object} move - The move being used
 * @param {number} defenderCurrentHP - Current HP of the defender
 * @param {number} defenderMaxHP - Maximum HP of the defender
 * @returns {Object} Modified damage result
 */
function applyDefenderAbilities(damageResult, defender, move, defenderCurrentHP, defenderMaxHP) {
  const defenderAbility = defender.ability?.toLowerCase() || defender.ability;
  
  // Sturdy: Prevents OHKO when at full HP
  if (defenderAbility === 'sturdy' && isAtFullHP(defenderCurrentHP, defenderMaxHP)) {
    damageResult = applySturdyEffect(damageResult, defenderMaxHP);
  }
  
  return damageResult;
}

/**
 * Checks if a Pokémon is at full HP
 * @param {number} currentHP - Current HP
 * @param {number} maxHP - Maximum HP
 * @returns {boolean} True if at full HP
 */
function isAtFullHP(currentHP, maxHP) {
  return currentHP >= maxHP;
}

/**
 * Applies Sturdy ability effect to damage calculation
 * @param {Object} damageResult - The damage calculation result
 * @param {number} defenderMaxHP - Maximum HP of the defender
 * @returns {Object} Modified damage result
 */
function applySturdyEffect(damageResult, defenderMaxHP) {
  const originalDamage = damageResult.damage;
  
  if (!originalDamage || originalDamage.length === 0) {
    return damageResult;
  }
  
  // Create a new damage array with Sturdy effect applied
  const sturdyDamage = originalDamage.map(damage => {
    // If the damage would be a OHKO (damage >= maxHP), reduce it to leave 1 HP
    if (damage >= defenderMaxHP) {
      return defenderMaxHP - 1;
    }
    return damage;
  });
  
  // Update the damage result
  return {
    ...damageResult,
    damage: sturdyDamage,
    // Update description to reflect Sturdy effect
    desc: damageResult.desc ? damageResult.desc.replace('OHKO', '2HKO (Sturdy)') : 'Sturdy prevents OHKO'
  };
}

/**
 * Checks if a move would be affected by Sturdy
 * @param {Object} damageResult - The damage calculation result
 * @param {number} defenderMaxHP - Maximum HP of the defender
 * @returns {boolean} True if Sturdy would affect this move
 */
export function wouldSturdyPreventKO(damageResult, defenderMaxHP) {
  if (!damageResult.damage || damageResult.damage.length === 0) {
    return false;
  }
  
  // Check if any damage value would be a OHKO
  return damageResult.damage.some(damage => damage >= defenderMaxHP);
}

/**
 * Gets a list of all supported ability modifiers
 * @returns {Array} List of ability modifier names
 */
export function getSupportedAbilityModifiers() {
  return [
    'sturdy',
    // Future abilities can be added here
    // 'focus-sash',
    // 'wonder-guard',
    // etc.
  ];
}
