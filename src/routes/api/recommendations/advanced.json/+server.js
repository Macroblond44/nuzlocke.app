/**
 * Advanced recommendation endpoint using @smogon/calc
 * 
 * Performs 1v1 damage calculations between user's Pokémon and rival Pokémon
 * to provide more accurate recommendations based on:
 * - Actual damage calculations
 * - Number of hits to KO
 * - Best move to use (evaluates ALL available moves)
 * - Win probability
 * 
 * POST /api/recommendations/advanced.json
 * Body: {
 *   userPokemon: [{ name, level, ability, nature, moves: [string], evs, ivs, item }],
 *   rivalPokemon: [{ name, level, ability, nature, moves: [{ name, type, power, damage_class }], stats (base stats), item }],
 *   gameMode: 'route' | 'normal' (optional)
 * }
 * 
 * For route mode (gameMode: 'route'):
 * - Fetches ALL attacking moves learnable up to level cap
 * - Calculator evaluates all moves and selects optimal move for each turn
 * - More realistic simulation as Pokémon can use their full movepool
 * 
 * Note: rivalPokemon.stats should contain the BASE STATS from the static league file (e.g., radred.fire.json)
 * which already includes any romhack-specific stat modifications.
 */

/**
 * Multi-game damage calculator with romhack support
 * 
 * Uses @smogon/calc (v0.10.0+) with Generation 9 which includes all Pokémon from Gen 1-9.
 * Custom base stats for romhacks are pre-processed and stored in static league files.
 * 
 * How it works:
 * 1. Reads `calcGen` from games.json (e.g., calcGen: 9 for Radical Red)
 * 2. Uses @smogon/calc's Generations.get(calcGen) to load the appropriate generation
 * 3. Receives custom base stats from static league files (e.g., radred.fire.json)
 * 4. Overrides default base stats using the `overrides` parameter in Pokemon constructor
 * 
 * Configuration per game in games.json:
 * - calcGen: Generation number for species/moves pool (9 for modern romhacks, includes Gen 1-9)
 */

import { calculate, Pokemon, Move, Generations } from '@smogon/calc';
import gamesData from '$lib/data/games.json';

// ========== CONSTANTS ==========
const MAX_BATTLE_TURNS = 20; // Prevent infinite battle loops
const DEFAULT_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const DEFAULT_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const DEFAULT_CALC_GEN = 9; // Modern romhacks use Gen 9

// KO Analysis constants
const GUARANTEED_KO_THRESHOLD = 100; // 100% chance = guaranteed
const SINGLE_MOVE_THRESHOLD = 1; // For single move vs multi-move logic
const PERCENTAGE_DECIMAL_PLACES = 1; // Round percentages to 1 decimal place

// ========== SCORING WEIGHTS ==========
const SCORE_WIN = 1;
const SCORE_LOSS = 0;

// ========== HELPER FUNCTIONS ==========

/**
 * Round percentage to specified decimal places
 * @param {number} probability - Probability value (0-1)
 * @returns {number} Rounded percentage
 */
function roundPercentage(probability) {
  const multiplier = Math.pow(10, PERCENTAGE_DECIMAL_PLACES);
  return Math.round(probability * GUARANTEED_KO_THRESHOLD * multiplier) / multiplier;
}

/**
 * Normalize ability name for @smogon/calc
 * Converts from various formats to the format expected by @smogon/calc
 * 
 * @param {string} abilityName - Ability name in any format
 * @returns {string} Normalized ability name
 * 
 * Examples:
 *   'strong-jaw' → 'Strong Jaw'
 *   'overgrow' → 'Overgrow'
 *   'Lightning Rod' → 'Lightning Rod'
 */
function normalizeAbilityName(abilityName) {
  if (!abilityName || abilityName === 'unknown') return undefined;
  
  // If already in correct format (capitalized with spaces), return as is
  if (abilityName.includes(' ') && abilityName[0] === abilityName[0].toUpperCase()) {
    return abilityName;
  }
  
  // Convert kebab-case or lowercase to Title Case with spaces
  return abilityName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    let { userPokemon, rivalPokemon, game, gameMode } = body;
    
    console.log('[Request] Received body keys:', Object.keys(body));
    console.log('[Request] Game parameter:', game, 'Type:', typeof game);
    console.log('[Request] Game mode:', gameMode);
    
    if (!userPokemon || !rivalPokemon) {
      return new Response(JSON.stringify({ 
        error: 'Missing required data',
        message: 'Both userPokemon and rivalPokemon are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`[Advanced Recommendations] Calculating matchups for ${userPokemon.length} user Pokémon vs ${rivalPokemon.length} rival Pokémon`);
    console.log(`[Game] Detected game: ${game || 'unknown'}`);
    
    // Get game configuration
    const gameConfig = gamesData[game] || {};
    const genNumber = gameConfig.calcGen || DEFAULT_CALC_GEN;
    
    console.log(`[Calculator] Using @smogon/calc with Generation ${genNumber} for game: ${game}`);
    
    // Calculate level cap (max level of rival Pokémon) for Nuzlocke rules
    const levelCap = Math.max(...rivalPokemon.map(p => parseInt(p.level) || 50));
    console.log(`[Level Cap] Applying Nuzlocke level cap: ${levelCap}`);
    
    // If this is route mode, we need to fetch moves and abilities for route Pokémon
    if (gameMode === 'route') {
      console.log('[Route Mode] Fetching moves and abilities for route Pokémon...');
      console.log('[Route Mode] Using game-specific data for:', game);
      
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5173' 
        : 'https://nuzlocke.app';
      
      const gameParam = game ? `?game=${game}` : '';
      
      userPokemon = await Promise.all(userPokemon.map(async (pokemon) => {
        try {
          const pokemonName = pokemon.name.toLowerCase();
          console.log(`[Route Mode] Processing ${pokemonName}...`);
          
          // Fetch abilities using the same endpoint as PokemonConfigModal
          const abilitiesUrl = `${baseUrl}/api/pokemon/${pokemonName}/abilities.json${gameParam}`;
          const abilitiesResponse = await fetch(abilitiesUrl);
          
          if (!abilitiesResponse.ok) {
            throw new Error(`Failed to fetch abilities: ${abilitiesResponse.status}`);
          }
          
          const abilitiesData = await abilitiesResponse.json();
          console.log(`[Route Mode] ${pokemonName} - Abilities source: ${abilitiesResponse.headers.get('X-Data-Source')}`);
          
          // Get non-hidden abilities
          const nonHiddenAbilities = abilitiesData.filter(a => !a.isHidden);
          
          // Select a random non-hidden ability
          const selectedAbility = nonHiddenAbilities.length > 0
            ? nonHiddenAbilities[Math.floor(Math.random() * nonHiddenAbilities.length)].id
            : null;
          
          // Fetch moves using the same endpoint as PokemonConfigModal
          const movesUrl = `${baseUrl}/api/pokemon/${pokemonName}/moves.json${gameParam}`;
          const movesResponse = await fetch(movesUrl);
          
          if (!movesResponse.ok) {
            throw new Error(`Failed to fetch moves: ${movesResponse.status}`);
          }
          
          const movesData = await movesResponse.json();
          console.log(`[Route Mode] ${pokemonName} - Moves source: ${movesResponse.headers.get('X-Data-Source')}`);
          
          // Filter moves learnable up to level cap and only attacking moves
          const learnableMoves = (movesData.levelUp || [])
            .filter(m => m.level <= levelCap && m.damage_class !== 'status')
            .map(m => m.id || m.name);
          
          // Use ALL available attacking moves (no limit)
          // The calculator will evaluate all moves and select the best one for each matchup
          const selectedMoves = learnableMoves;
          
          console.log(`[Route Mode] ${pokemonName}: ${selectedMoves.length} attacking moves available, ability: ${selectedAbility}`);
          
          return {
            ...pokemon,
            moves: selectedMoves,
            ability: selectedAbility
          };
        } catch (error) {
          console.error(`[Route Mode] Error fetching data for ${pokemon.name}:`, error.message);
          // Return with default moves if fetch fails
          return {
            ...pokemon,
            moves: ['Tackle'], // Fallback move
            ability: null
          };
        }
      }));
    }
    
    const gen = Generations.get(genNumber);
    console.log(`[Generation] Using Generation ${gen.num}`);
    
    const recommendations = [];
    
    // Calculate matchups for each user Pokémon against each rival Pokémon
    for (const userMon of userPokemon) {
      // Apply level cap to user Pokémon
      const cappedLevel = Math.min(userMon.level || 50, levelCap);
      const userMonCapped = { ...userMon, level: cappedLevel };
      
      if (userMon.level !== cappedLevel) {
        console.log(`[Level Cap] ${userMon.name}: ${userMon.level} → ${cappedLevel}`);
      }
      const matchups = [];
      
      for (const rivalMon of rivalPokemon) {
        console.log(`[Matchup] Processing rival: ${rivalMon.name} (level ${rivalMon.level})`);
        const matchup = calculateMatchup(gen, userMonCapped, rivalMon);
        matchups.push({
          // Rival Pokémon info
          rivalPokemon: rivalMon.name,  // Changed from rivalName to rivalPokemon
          rivalLevel: rivalMon.level,
          rivalAbility: rivalMon.ability,
          rivalNature: rivalMon.nature,
          rivalItem: rivalMon.item,
          rivalMoves: rivalMon.moves?.map(m => typeof m === 'string' ? m : (m.name || m)) || [],
          // User Pokémon info
          userLevel: userMonCapped.level,
          userAbility: userMonCapped.ability,
          userNature: userMonCapped.nature,
          userItem: userMonCapped.item,
          userMoves: userMonCapped.moves || [],
          // Calculation results
          ...matchup,
          // Ensure damagePercentage exists (alias for damagePercent)
          damagePercentage: matchup.damagePercent ? `${matchup.damagePercent}%` : 'N/A',
          damageRange: matchup.damageRange ? `${matchup.damageRange[0]},${matchup.damageRange[1]}` : 'N/A',
          // Add damage percentage range from description parsing
          damagePercentageRange: matchup.damagePercentageRange ? `${matchup.damagePercentageRange[0]},${matchup.damagePercentageRange[1]}` : null,
          // Add OHKO/2HKO chances as percentages (use parsed values from description)
          ohkoChance: matchup.ohkoChance || (matchup.canOHKO ? 100 : 0),
          twoHkoChance: matchup.twoHkoChance || (matchup.canTwoHKO ? 100 : 0),
          // Add guaranteed KO and general KO chance information
          isGuaranteedKO: matchup.isGuaranteedKO || false,
          koChance: matchup.koChance || 0,
          score: matchup.winProbability || 0
        });
      }
      
      // Sort by win probability (descending)
      matchups.sort((a, b) => b.winProbability - a.winProbability);
      
      // Calculate battle statistics
      const wins = matchups.filter(m => m.userWins).length;
      const losses = matchups.length - wins;
      const winRate = matchups.length > 0 ? (wins / matchups.length) * 100 : 0;
      const score = calculateOverallScore(matchups);
      
      recommendations.push({
        name: userMon.name, // Use 'name' for consistency with UI
        pokemon: userMon.name,
        level: cappedLevel, // Use capped level for display
        originalLevel: userMon.level, // Store original level for reference
        matchups: matchups, // Return ALL matchups (not just top 3)
        overallScore: score,
        score: score, // Alias for consistency
        wins: wins,
        losses: losses,
        winRate: winRate,
        totalMatchups: matchups.length
      });
    }
    
    // Sort recommendations by overall score (best counters first)
    recommendations.sort((a, b) => b.overallScore - a.overallScore);
    
    return new Response(JSON.stringify({
      recommendations,
      method: 'advanced',
      levelCap: levelCap,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('[Advanced Recommendations] Error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to calculate advanced recommendations',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Helper: Extract numeric damage from calculation result
 */
function extractDamage(result) {
  if (!result.damage) return [0, 0];
  
  if (Array.isArray(result.damage) && result.damage.length > 0) {
    return [result.damage[0], result.damage[result.damage.length - 1]];
  }
  
  if (typeof result.damage === 'number') {
    return [result.damage, result.damage];
  }
  
  return [0, 0];
}

/**
 * Helper: Calculate median damage from @smogon/calc damage array
 * @param {Array|number} damage - Damage array or single number from @smogon/calc
 * @returns {number} Median damage using realistic damage values
 */
function calculateMedianDamage(damage) {
  if (!damage) return 0;
  
  if (typeof damage === 'number') {
    return damage;
  }
  
  if (Array.isArray(damage) && damage.length > 0) {
    // Sort the damage values
    const sortedDamage = [...damage].sort((a, b) => a - b);
    const length = sortedDamage.length;
    
    // Calculate median position
    const medianIndex = Math.floor(length / 2);
    
    if (length % 2 === 1) {
      // Odd length: return middle value
      return sortedDamage[medianIndex];
    } else {
      // Even length: return the higher of the two middle values
      // This ensures we use a realistic damage value that actually exists
      return sortedDamage[medianIndex];
    }
  }
  
  return 0;
}

/**
 * Calculate mathematically accurate KO probability for a move sequence
 * 
 * This function uses the exact damage arrays from @smogon/calc to calculate
 * the precise probability of achieving a KO with a sequence of moves.
 * 
 * @param {Generation} gen - @smogon/calc Generation instance
 * @param {Pokemon} attacker - Attacker Pokémon instance
 * @param {Pokemon} defender - Defender Pokémon instance  
 * @param {Array} movesUsed - Array of moves used in battle sequence
 * @param {number} defenderHP - Defender's total HP
 * @returns {Object} KO probability analysis with probability, isGuaranteed, description
 */
function calculateMoveSequenceKOProbability(gen, attacker, defender, movesUsed, defenderHP) {
  if (!movesUsed || movesUsed.length === 0) {
    return createKOAnalysisResult(0, false, 'No moves used', 0);
  }

  try {
    // Single move case - use @smogon/calc kochance directly for efficiency
    if (movesUsed.length === 1) {
      return calculateSingleMoveKO(gen, attacker, defender, movesUsed[0], defenderHP);
    }

    // Multi-move case - calculate exact probability using damage arrays
    return calculateMultiMoveKO(gen, attacker, defender, movesUsed, defenderHP);
    
  } catch (error) {
    console.log(`  ⚠️ Error calculating KO probability: ${error.message}`);
    return createKOAnalysisResult(0, false, 'Calculation error', movesUsed.length);
  }
}

/**
 * Calculate KO probability for a single move using @smogon/calc
 */
function calculateSingleMoveKO(gen, attacker, defender, moveUsed, defenderHP) {
  const moveResult = calculate(gen, attacker, defender, new Move(gen, moveUsed.move));
  const koChance = moveResult.kochance();
  const koPercentage = roundPercentage(koChance.chance);
  
  return createKOAnalysisResult(
    koPercentage,
    koChance.chance === 1,
    koChance.text,
    SINGLE_MOVE_THRESHOLD
  );
}

/**
 * Calculate KO probability for multiple moves using exact damage arrays
 */
function calculateMultiMoveKO(gen, attacker, defender, movesUsed, defenderHP) {
  console.log(`  🧮 Calculating ${movesUsed.length}-move sequence probability:`);
  
  // Get exact damage arrays from @smogon/calc for each move
  const damageArrays = movesUsed.map((moveUsed, index) => {
    const moveResult = calculate(gen, attacker, defender, new Move(gen, moveUsed.move));
    const damageArray = moveResult.damage;
    
    console.log(`     Turn ${index + 1}: ${moveUsed.move.padEnd(15)} | Damage range: ${Math.min(...damageArray)}-${Math.max(...damageArray)} HP (${damageArray.length} possible values)`);
    
    return {
      moveName: moveUsed.move,
      damageArray
    };
  });

  // Calculate exact probability using damage arrays
  console.log(`     Target: ${defenderHP} HP`);
  const probability = calculateExactSequenceProbability(damageArrays, defenderHP);
  
  const koPercentage = roundPercentage(probability);
  
  return createKOAnalysisResult(
    koPercentage,
    probability === 1,
    `${koPercentage}% chance to ${movesUsed.length}HKO`,
    movesUsed.length
  );
}

/**
 * Create a standardized KO analysis result object
 */
function createKOAnalysisResult(probability, isGuaranteed, description, hitsToKO) {
  return {
    probability,
    isGuaranteed,
    description,
    hitsToKO
  };
}

/**
 * Calculate exact KO probability using damage arrays from @smogon/calc
 * 
 * Uses a recursive approach to calculate all possible damage combinations
 * and determine the probability of achieving the target damage.
 * 
 * @param {Array} damageArrays - Array of {moveName, damageArray} objects
 * @param {number} targetDamage - Target damage needed for KO
 * @returns {number} Probability of achieving target damage or more (0-1)
 */
function calculateExactSequenceProbability(damageArrays, targetDamage) {
  if (damageArrays.length === 0) return 0;
  
  // Single move case - simple probability calculation
  if (damageArrays.length === 1) {
    const damageArray = damageArrays[0].damageArray;
    const koCount = damageArray.filter(damage => damage >= targetDamage).length;
    const probability = koCount / damageArray.length;
    
    console.log(`     Result: ${koCount}/${damageArray.length} combinations achieve KO = ${roundPercentage(probability)}%`);
    return probability;
  }

  // Multi-move case - calculate all combinations recursively
  const totalCombinations = damageArrays.reduce((total, arr) => total * arr.damageArray.length, 1);
  console.log(`     Analyzing ${totalCombinations.toLocaleString()} possible damage combinations...`);
  
  const probability = calculateCombinationProbability(damageArrays, targetDamage);
  
  console.log(`     Result: ${roundPercentage(probability)}% chance to achieve ${targetDamage}+ damage`);
  return probability;
}

/**
 * Recursively calculate probability of achieving target damage across all move combinations
 */
function calculateCombinationProbability(damageArrays, targetDamage, moveIndex = 0, currentDamage = 0) {
  // Base case: all moves have been considered
  if (moveIndex === damageArrays.length) {
    return currentDamage >= targetDamage ? 1 : 0;
  }
  
  let totalProbability = 0;
  const currentMove = damageArrays[moveIndex];
  
  // For each possible damage value of current move, recurse to next move
  for (const damage of currentMove.damageArray) {
    const newDamage = currentDamage + damage;
    const probability = calculateCombinationProbability(damageArrays, targetDamage, moveIndex + 1, newDamage);
    totalProbability += probability / currentMove.damageArray.length;
  }
  
  return totalProbability;
}


/**
 * Helper: Calculate all moves with their damage and priority
 * Returns array of all valid moves with their calculation results
 */
function calculateAllMoves(gen, attacker, defender, movesList) {
  const moveResults = [];
  
  if (!movesList || movesList.length === 0) {
    console.log(`  [calculateAllMoves] No moves provided`);
    return moveResults;
  }
  
  console.log(`  [calculateAllMoves] Processing ${movesList.length} moves for ${attacker.name} vs ${defender.name}`);
  
  for (const moveName of movesList) {
    const actualMoveName = typeof moveName === 'object' ? (moveName.name || moveName) : moveName;
    
    if (!actualMoveName || actualMoveName === '(No Move)') {
      console.log(`    ⚠️ Skipping invalid move name:`, moveName);
      continue;
    }
    
    try {
      const move = new Move(gen, actualMoveName);
      
      // Skip status moves
      if (move.category === 'Status') {
        console.log(`    ℹ️ Skipping status move: ${actualMoveName}`);
        continue;
      }
      
      // Validate Pokémon objects before calculation
      if (!attacker || !attacker.species || !defender || !defender.species) {
        console.log(`    ❌ Invalid Pokémon objects for ${actualMoveName}`);
        console.log(`      Attacker valid: ${!!attacker?.species}, Defender valid: ${!!defender?.species}`);
        continue;
      }
      
      const result = calculate(gen, attacker, defender, move);
      
      if (!result.damage || (Array.isArray(result.damage) && result.damage.length === 0)) {
        console.log(`    ⚠️ No damage calculated for: ${actualMoveName}`);
        continue;
      }
      
      const damageRange = extractDamage(result);
      const medianDamage = calculateMedianDamage(result.damage);
      const minDamage = damageRange[0];
      const maxDamage = damageRange[1];
      
      console.log(`    ✅ ${actualMoveName}: ${minDamage}-${maxDamage} damage (median: ${medianDamage}, priority: ${move.priority || 0})`);
      
      moveResults.push({
        name: actualMoveName,
        priority: move.priority || 0,
        avgDamage: medianDamage, // Use median instead of average
        minDamage,
        maxDamage,
        damageRange,
        result
      });
    } catch (moveError) {
      console.log(`    ❌ Failed to calculate ${actualMoveName}: ${moveError.message}`);
    }
  }
  
  console.log(`  [calculateAllMoves] Result: ${moveResults.length} valid attacking moves found`);
  return moveResults;
}

/**
 * Helper: Determine turn order based on move priority and speed
 */
function determineFirstAttacker(userMove, rivalMove, userSpeed, rivalSpeed) {
  const userPriority = userMove?.priority || 0;
  const rivalPriority = rivalMove?.priority || 0;
  
  // Priority moves go first
  if (userPriority !== rivalPriority) {
    return userPriority > rivalPriority;
  }
  
  // Same priority → faster Pokémon goes first
  return userSpeed >= rivalSpeed;
}

/**
 * Helper: Execute a single attack with KO detection
 * Returns { newHP, isKO, actualDamage }
 */
function executeAttack(attacker, defender, move, currentHP) {
  if (!move) return { newHP: currentHP, isKO: false, actualDamage: 0 };
  
  // Check if move can potentially KO (max damage >= current HP)
  if (move.maxDamage >= currentHP) {
    // Move can KO - simulate KO with median damage for consistency
    const actualDamage = Math.min(move.avgDamage, currentHP);
    return { 
      newHP: 0, 
      isKO: true, 
      actualDamage: actualDamage 
    };
  }
  
  // Move cannot KO - use median damage
  const actualDamage = move.avgDamage;
  return { 
    newHP: currentHP - actualDamage, 
    isKO: false, 
    actualDamage: actualDamage 
  };
}

/**
 * Helper: Create battle move record for tracking
 * @param {string} moveName - Name of the move used
 * @param {number} turn - Turn number when used
 * @param {number} damage - Actual damage dealt
 * @param {number} targetHP - Target's HP before the attack
 * @returns {Object} Move record object
 */
function createMoveRecord(moveName, turn, damage, targetHP) {
  return {
    move: moveName,
    turn,
    damage,
    targetHP,
    timestamp: Date.now() // For debugging purposes
  };
}

/**
 * Helper: Select optimal move considering current HP and priority
 * 
 * Strategy:
 * 1. If a priority move GUARANTEES KO → use it
 * 2. Among moves that guarantee KO → use the one with highest damage
 * 3. Among moves that can potentially KO → use the one with highest max damage
 * 4. Otherwise → use move with highest average damage
 */
function selectOptimalMove(moveResults, defenderCurrentHP, needsPriority = false) {
  if (!moveResults || moveResults.length === 0) {
    return null;
  }
  
  const priorityMoves = moveResults.filter(m => m.priority > 0);
  
  // Strategy 1: Priority move that GUARANTEES KO
  if (needsPriority && priorityMoves.length > 0) {
    const priorityGuaranteedKO = priorityMoves.find(m => m.minDamage >= defenderCurrentHP);
    if (priorityGuaranteedKO) return priorityGuaranteedKO;
  }
  
  // Strategy 2: Move that guarantees KO with highest damage
  const guaranteedKOMoves = moveResults.filter(m => m.minDamage >= defenderCurrentHP);
  if (guaranteedKOMoves.length > 0) {
    return guaranteedKOMoves.reduce((best, current) => 
      current.avgDamage > best.avgDamage ? current : best
    );
  }
  
  // Strategy 3: Move with best KO chance
  const possibleKO = moveResults.filter(m => m.maxDamage >= defenderCurrentHP);
  if (possibleKO.length > 0) {
    return possibleKO.reduce((best, current) => 
      current.maxDamage > best.maxDamage ? current : best
    );
  }
  
  // Strategy 4: Highest average damage
  return moveResults.reduce((best, current) => 
    current.avgDamage > best.avgDamage ? current : best
  );
}

/**
 * Calculate complete 1v1 battle simulation between user's Pokémon and rival's Pokémon
 * 
 * Battle Simulation Strategy:
 * 1. Calculate all possible moves for both Pokémon (with damage, priority, etc.)
 * 2. Simulate battle turn-by-turn (up to MAX_BATTLE_TURNS):
 *    - Select optimal move based on current HP and battle state
 *    - Consider priority moves for securing KOs
 *    - Determine turn order (priority > speed)
 *    - Execute attacks and update HP
 * 3. Battle ends when one Pokémon faints or max turns reached
 * 
 * Move Selection Logic (per turn):
 * - Priority moves that can KO → highest priority
 * - Guaranteed KO moves (min damage >= HP) → second priority  
 * - Possible KO moves (max damage >= HP) → third priority
 * - Highest average damage → fallback
 * 
 * @param {Generation} gen - @smogon/calc Generation instance
 * @param {Object} userMon - User's Pokémon data
 * @param {Object} rivalMon - Rival's Pokémon data
 * @returns {Object} Battle result with winner, moves used, damage, and detailed stats
 */
function calculateMatchup(gen, userMon, rivalMon) {
  
  try {
    console.log(`\n========== CALCULATING MATCHUP ==========`);
    console.log(`User Pokemon:`, {
      name: userMon.name,
      level: userMon.level,
      ability: userMon.ability,
      abilityNormalized: normalizeAbilityName(userMon.ability),
      nature: userMon.nature,
      item: userMon.item,
      moves: userMon.moves
    });
    console.log(`Rival Pokemon (from league JSON):`, {
      name: rivalMon.name,
      level: rivalMon.level,
      ability: rivalMon.ability,
      nature: rivalMon.nature,
      item: rivalMon.item,
      baseStats: rivalMon.stats, // Base stats from league file (e.g., radred.water.json)
      moves: rivalMon.moves // Already processed by formatBossTeamForAPI with Hidden Power type
    });
    
    // Create Pokémon objects with proper stats
    // Note: item must be undefined (not 'none') when there's no item
    const userItem = userMon.item && userMon.item !== 'none' ? userMon.item : undefined;
    
    // Normalize ability name for @smogon/calc (converts 'strong-jaw' → 'Strong Jaw')
    const userAbility = normalizeAbilityName(userMon.ability);
    
    const userPokemon = new Pokemon(gen, userMon.name, {
      level: userMon.level || 50,
      ability: userAbility,
      nature: userMon.nature || 'Hardy',
      ivs: userMon.ivs || DEFAULT_IVS,
      evs: userMon.evs || DEFAULT_EVS,
      item: userItem
    });
    
    console.log(`User Pokemon created:`, {
      name: userPokemon.name,
      level: userPokemon.level,
      ability: userPokemon.ability,
      nature: userPokemon.nature,
      item: userPokemon.item,
      baseStats: userPokemon.species.baseStats,
      ivs: userPokemon.ivs,
      evs: userPokemon.evs,
      calculatedStats: {
        hp: userPokemon.maxHP(),
        atk: userPokemon.rawStats.atk,
        def: userPokemon.rawStats.def,
        spa: userPokemon.rawStats.spa,
        spd: userPokemon.rawStats.spd,
        spe: userPokemon.rawStats.spe
      }
    });
    
    // Create rival Pokémon using data from static league file (radred.fire.json or equivalent)
    // Extract ability name if it's an object
    const rivalAbilityRaw = typeof rivalMon.ability === 'object' && rivalMon.ability !== null
      ? rivalMon.ability.name
      : rivalMon.ability;
    
    // Normalize ability name for @smogon/calc (converts 'technician' → 'Technician')
    const rivalAbilityName = normalizeAbilityName(rivalAbilityRaw);
    
    // Extract item name if it's an object
    let rivalItemName = typeof rivalMon.item === 'object' && rivalMon.item !== null
      ? (rivalMon.item.sprite || rivalMon.item.name)
      : rivalMon.item;
    
    // Ensure 'none' is converted to undefined for @smogon/calc
    if (rivalItemName === 'none' || rivalItemName === 'None' || rivalItemName === '') {
      rivalItemName = undefined;
    }
    
    // Use base stats from static league file (already includes romhack modifications)
    console.log(`[DEBUG] rivalMon.stats received:`, rivalMon.stats);
    
    const baseStats = rivalMon.stats ? {
      hp: rivalMon.stats.hp,
      atk: rivalMon.stats.atk,
      def: rivalMon.stats.def,
      spa: rivalMon.stats.spa,
      spd: rivalMon.stats.spd,
      spe: rivalMon.stats.spe
    } : undefined;
    
    console.log(`[Base Stats] Using ${baseStats ? 'provided' : 'default'} base stats for ${rivalMon.name}:`, baseStats);
    console.log(`[DEBUG] Expected for Floatzel: { hp: 85, atk: 90, def: 55, spa: 95, spd: 50, spe: 115 }`);
    
    const rivalPokemon = new Pokemon(gen, rivalMon.name, {
      level: parseInt(rivalMon.level) || 50,
      ability: rivalAbilityName || undefined,
      nature: rivalMon.nature || 'Hardy',
      ivs: rivalMon.ivs || DEFAULT_IVS,
      evs: rivalMon.evs || DEFAULT_EVS,
      item: rivalItemName || undefined,
      overrides: baseStats ? { baseStats } : undefined // Override base stats if provided
    });
    
    console.log(`Rival Pokemon created:`, {
      name: rivalPokemon.name,
      level: rivalPokemon.level,
      ability: rivalPokemon.ability,
      nature: rivalPokemon.nature,
      item: rivalPokemon.item,
      baseStats: rivalPokemon.species.baseStats,
      ivs: rivalPokemon.ivs,
      evs: rivalPokemon.evs,
      calculatedStats: {
        hp: rivalPokemon.maxHP(),
        atk: rivalPokemon.rawStats.atk,
        def: rivalPokemon.rawStats.def,
        spa: rivalPokemon.rawStats.spa,
        spd: rivalPokemon.rawStats.spd,
        spe: rivalPokemon.rawStats.spe
      }
    });
    
    // ========== STEP 1: Calculate all possible moves for both Pokémon ==========
    console.log(`\n[1v1 SIMULATION] Calculating all move options...`);
    const userMoveOptions = calculateAllMoves(gen, userPokemon, rivalPokemon, userMon.moves);
    
    // Process rival moves, handling special cases like Hidden Power with type
    const rivalMoves = rivalMon.moves?.map(m => {
      if (typeof m === 'string') return m;
      
      // Special handling for Hidden Power - include type information
      if (m.name === 'Hidden Power' && m.type) {
        return `${m.name} ${m.type}`; // e.g., "Hidden Power grass"
      }
      
      return m.name || m;
    }) || [];
    
    const rivalMoveOptions = calculateAllMoves(gen, rivalPokemon, userPokemon, rivalMoves);
    
    if (userMoveOptions.length === 0) {
      console.log(`  ❌ User has no valid attacking moves`);
      return {
        userWins: false,
        bestMove: 'No valid moves',
        rivalBestMove: null,
        damageRange: [0, 0],
        rivalDamageRange: [0, 0],
        hitsToKO: Infinity,
        rivalHitsToKO: 0,
        userSpeed: userPokemon.rawStats.spe,
        rivalSpeed: rivalPokemon.rawStats.spe,
        userAttacksFirst: false,
        winProbability: 0,
        score: 0
      };
    }
    
    // ========== STEP 2: Simulate turn-by-turn battle ==========
    const userMaxHP = userPokemon.maxHP();
    const rivalMaxHP = rivalPokemon.maxHP();
    const userSpeed = userPokemon.rawStats.spe;
    const rivalSpeed = rivalPokemon.rawStats.spe;
    
    let userCurrentHP = userMaxHP;
    let rivalCurrentHP = rivalMaxHP;
    let turn = 1;
    
    let userSelectedMove = null;
    let rivalSelectedMove = null;
    let battleLog = [];
    
    // Track moves used in battle sequence
    let userMovesUsed = [];
    let rivalMovesUsed = [];
    
    console.log(`\n[BATTLE START]`);
    console.log(`  User: ${userMon.name} (${userCurrentHP} HP, ${userSpeed} Speed)`);
    console.log(`  Rival: ${rivalMon.name} (${rivalCurrentHP} HP, ${rivalSpeed} Speed)`);
    
    while (userCurrentHP > 0 && rivalCurrentHP > 0 && turn <= MAX_BATTLE_TURNS) {
      console.log(`\n--- Turn ${turn} ---`);
      
      // Select optimal moves for this turn
      // Always consider priority moves (needsPriority = true) for optimal strategy
      userSelectedMove = selectOptimalMove(userMoveOptions, rivalCurrentHP, true);
      rivalSelectedMove = rivalMoveOptions.length > 0 
        ? selectOptimalMove(rivalMoveOptions, userCurrentHP, true)
        : null;
      
      if (!userSelectedMove) {
        console.log(`  User has no valid moves, LOSES`);
        break;
      }
      
      // Determine turn order
      const userAttacksFirst = determineFirstAttacker(userSelectedMove, rivalSelectedMove, userSpeed, rivalSpeed);
      
      console.log(`  User: ${userSelectedMove.name} (priority ${userSelectedMove.priority})`);
      console.log(`  Rival: ${rivalSelectedMove?.name || 'None'} (priority ${rivalSelectedMove?.priority || 0})`);
      console.log(`  → ${userAttacksFirst ? 'User' : 'Rival'} goes first`);
      
      // Execute turn (first attacker, then second)
      const [firstAttacker, secondAttacker] = userAttacksFirst 
        ? [
            { name: 'User', move: userSelectedMove, targetHP: rivalCurrentHP, maxHP: rivalMaxHP, setHP: (hp) => rivalCurrentHP = hp },
            { name: 'Rival', move: rivalSelectedMove, targetHP: userCurrentHP, maxHP: userMaxHP, setHP: (hp) => userCurrentHP = hp }
          ]
        : [
            { name: 'Rival', move: rivalSelectedMove, targetHP: userCurrentHP, maxHP: userMaxHP, setHP: (hp) => userCurrentHP = hp },
            { name: 'User', move: userSelectedMove, targetHP: rivalCurrentHP, maxHP: rivalMaxHP, setHP: (hp) => rivalCurrentHP = hp }
          ];
      
      // First attacker attacks
      if (firstAttacker.move) {
        const attackResult = executeAttack(null, null, firstAttacker.move, firstAttacker.targetHP);
        firstAttacker.setHP(attackResult.newHP);
        console.log(`  ${firstAttacker.name} deals ${attackResult.actualDamage.toFixed(1)} damage → ${attackResult.isKO ? 'FAINTED!' : `${Math.max(0, attackResult.newHP).toFixed(1)}/${firstAttacker.maxHP} HP`}`);
        
        // Track move used
        const moveRecord = createMoveRecord(firstAttacker.move.name, turn, attackResult.actualDamage, firstAttacker.targetHP);
        if (firstAttacker.name === 'User') {
          userMovesUsed.push(moveRecord);
        } else {
          rivalMovesUsed.push(moveRecord);
        }
        
        if (attackResult.isKO) {
          battleLog.push(`Turn ${turn}: ${firstAttacker.name}'s ${firstAttacker.move.name} wins the battle`);
          break;
        }
      }
      
      // Second attacker counterattacks (if still alive)
      if (secondAttacker.move) {
        const attackResult = executeAttack(null, null, secondAttacker.move, secondAttacker.targetHP);
        secondAttacker.setHP(attackResult.newHP);
        console.log(`  ${secondAttacker.name} deals ${attackResult.actualDamage.toFixed(1)} damage → ${attackResult.isKO ? 'FAINTED!' : `${Math.max(0, attackResult.newHP).toFixed(1)}/${secondAttacker.maxHP} HP`}`);
        
        // Track move used
        const moveRecord = createMoveRecord(secondAttacker.move.name, turn, attackResult.actualDamage, secondAttacker.targetHP);
        if (secondAttacker.name === 'User') {
          userMovesUsed.push(moveRecord);
        } else {
          rivalMovesUsed.push(moveRecord);
        }
        
        if (attackResult.isKO) {
          battleLog.push(`Turn ${turn}: ${secondAttacker.name}'s ${secondAttacker.move.name} wins the battle`);
          break;
        }
      }
      
      turn++;
    }
    
    const userWins = rivalCurrentHP <= 0 && userCurrentHP > 0;
    const battleOutcome = battleLog[battleLog.length - 1] || `Battle timeout after ${MAX_BATTLE_TURNS} turns`;
    
    console.log(`\n[BATTLE RESULT] ${userWins ? '✅ USER WINS' : '❌ RIVAL WINS'}`);
    console.log(`  Final HP: User ${Math.max(0, userCurrentHP).toFixed(1)}/${userMaxHP} | Rival ${Math.max(0, rivalCurrentHP).toFixed(1)}/${rivalMaxHP}`);
    console.log(`  Outcome: ${battleOutcome}`);
    console.log(`========================================\n`);
    
    // ========== STEP 3: Calculate battle statistics based on actual moves used ==========
    console.log(`\n[BATTLE SEQUENCE ANALYSIS]`);
    console.log(`  User moves used:`, userMovesUsed.map(m => `${m.move} (T${m.turn}, ${m.damage}dmg)`).join(', '));
    console.log(`  Rival moves used:`, rivalMovesUsed.map(m => `${m.move} (T${m.turn}, ${m.damage}dmg)`).join(', '));
    
    // Calculate actual turns to KO based on battle sequence
    const actualUserHitsToKO = userMovesUsed.length;
    const actualRivalHitsToKO = rivalMovesUsed.length;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[BATTLE RESULTS SUMMARY]`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  ✅ Winner: ${userWins ? 'USER' : 'RIVAL'}`);
    console.log(`  🔄 Total turns: ${turn - 1}`);
    console.log(`  ❤️  Final HP: User ${Math.max(0, userCurrentHP).toFixed(1)}/${userMaxHP} | Rival ${Math.max(0, rivalCurrentHP).toFixed(1)}/${rivalMaxHP}`);
    
    console.log(`\n[USER BATTLE ANALYSIS]`);
    console.log(`  📊 Moves used: ${userMovesUsed.map(m => m.move).join(' → ')}`);
    console.log(`  🎯 Hits to KO: ${actualUserHitsToKO}HKO`);
    console.log(`  💪 Total damage dealt: ${userMovesUsed.reduce((sum, m) => sum + m.damage, 0).toFixed(1)} HP`);
    
    console.log(`\n[RIVAL BATTLE ANALYSIS]`);
    console.log(`  📊 Moves used: ${rivalMovesUsed.map(m => m.move).join(' → ')}`);
    console.log(`  🎯 Hits to KO: ${actualRivalHitsToKO}HKO`);
    console.log(`  💪 Total damage dealt: ${rivalMovesUsed.reduce((sum, m) => sum + m.damage, 0).toFixed(1)} HP`);
    
    // Calculate mathematically accurate KO probability using exact damage arrays
    console.log(`\n[MATHEMATICAL KO PROBABILITY ANALYSIS]`);
    console.log(`  📐 Using exact damage arrays from @smogon/calc`);
    const userKOData = calculateMoveSequenceKOProbability(gen, userPokemon, rivalPokemon, userMovesUsed, rivalMaxHP);
    
    console.log(`  🎲 User KO Probability:`);
    console.log(`     - Move sequence: ${userMovesUsed.map(m => m.move).join(' → ')}`);
    console.log(`     - Probability: ${userKOData.probability}%`);
    console.log(`     - Guaranteed: ${userKOData.isGuaranteed ? 'YES ✓' : 'NO ✗'}`);
    console.log(`     - Description: ${userKOData.description}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // ========== STEP 4: Return comprehensive battle data ==========
    return {
      // Battle result
      userWins,
      battleOutcome,
      battleLog,
      turns: turn - 1,
      
      // User's attack data (based on mathematically accurate sequence calculation)
      bestMove: userMovesUsed[0]?.move || 'No valid moves',
      damageRange: (() => {
        const firstUserMove = userMoveOptions.find(m => m.name === userMovesUsed[0]?.move);
        return firstUserMove?.damageRange || [0, 0];
      })(),
      hitsToKO: actualUserHitsToKO, // Based on actual battle sequence
      // Use mathematically accurate KO information
      canOHKO: userKOData.hitsToKO === SINGLE_MOVE_THRESHOLD,
      canTwoHKO: userKOData.hitsToKO === 2,
      ohkoChance: userKOData.hitsToKO === SINGLE_MOVE_THRESHOLD ? userKOData.probability : 0,
      twoHkoChance: userKOData.hitsToKO === 2 ? userKOData.probability : 0,
      isGuaranteedKO: userKOData.isGuaranteed,
      koChance: userKOData.probability,
      damagePercent: (() => {
        const firstUserMove = userMoveOptions.find(m => m.name === userMovesUsed[0]?.move);
        return firstUserMove ? Math.round((firstUserMove.avgDamage / rivalMaxHP) * GUARANTEED_KO_THRESHOLD) : 0;
      })(),
      
      // Battle sequence information
      battleSequence: {
        userMoves: userMovesUsed,
        rivalMoves: rivalMovesUsed,
        totalTurns: turn - 1,
        winningMove: userWins ? userMovesUsed[userMovesUsed.length - 1]?.move : rivalMovesUsed[rivalMovesUsed.length - 1]?.move
      },
      
      // Rival's attack data (based on actual battle sequence)
      rivalBestMove: rivalMovesUsed[0]?.move || 'No valid moves',
      rivalDamageRange: (() => {
        const firstRivalMove = rivalMoveOptions.find(m => m.name === rivalMovesUsed[0]?.move);
        return firstRivalMove?.damageRange || [0, 0];
      })(),
      rivalHitsToKO: actualRivalHitsToKO, // Based on actual battle sequence
      // Use actual battle results for rival KO information
      rivalCanOHKO: actualRivalHitsToKO === SINGLE_MOVE_THRESHOLD,
      rivalCanTwoHKO: actualRivalHitsToKO === 2,
      rivalOhkoChance: actualRivalHitsToKO === SINGLE_MOVE_THRESHOLD ? GUARANTEED_KO_THRESHOLD : 0,
      rivalDamagePercent: (() => {
        const firstRivalMove = rivalMoveOptions.find(m => m.name === rivalMovesUsed[0]?.move);
        return firstRivalMove ? Math.round((firstRivalMove.avgDamage / userMaxHP) * GUARANTEED_KO_THRESHOLD) : 0;
      })(),
      
      // Speed & turn order data
      userSpeed,
      rivalSpeed,
      userMovePriority: (() => {
        const firstUserMove = userMoveOptions.find(m => m.name === userMovesUsed[0]?.move);
        return firstUserMove?.priority || 0;
      })(),
      rivalMovePriority: (() => {
        const firstRivalMove = rivalMoveOptions.find(m => m.name === rivalMovesUsed[0]?.move);
        return firstRivalMove?.priority || 0;
      })(),
      userAttacksFirst: userSpeed >= rivalSpeed, // First turn only
      
      // HP after battle
      userFinalHP: Math.max(0, userCurrentHP),
      rivalFinalHP: Math.max(0, rivalCurrentHP),
      userMaxHP,
      rivalMaxHP,
      
      // Scoring
      winProbability: userWins ? 100 : 0,
      score: userWins ? SCORE_WIN : SCORE_LOSS
    };
    
  } catch (error) {
    console.error(`[Matchup] Error calculating matchup:`, error.message);
    return {
      bestMove: 'Error',
      damageRange: [0, 0],
      hitsToKO: Infinity,
      winProbability: 0,
      canOHKO: false,
      canTwoHKO: false,
      error: error.message
    };
  }
}

/**
 * Calculate overall score for a Pokémon based on 1v1 battle results
 * 
 * Simple scoring system:
 * - 1 point for each rival Pokémon defeated in 1v1
 * - Total score = number of victories
 * 
 * This allows easy comparison: a Pokémon that wins 3/4 matchups scores 3 points
 */
function calculateOverallScore(matchups) {
  if (!matchups || matchups.length === 0) return 0;
  
  // Count number of victories (userWins = true)
  const victories = matchups.filter(m => m.userWins).length;
  
  return victories;
}

