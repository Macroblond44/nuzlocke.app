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
import { applyAbilityModifiers, wouldSturdyPreventKO } from '$lib/utils/ability-modifiers.js';
import { isFirstTurnOnlyMove, canUseMoveInTurn } from '$lib/data/first-turn-only-moves.js';

// ========== CONSTANTS ==========
const MAX_BATTLE_TURNS = 5; // Limit to prevent exponential calculation complexity (16^6 = 16.8M combinations)
const DEFAULT_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const DEFAULT_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/**
 * Blacklist of moves that should NOT be considered for user Pokémon in Nuzlocke mode
 * These moves are too risky because they can KO the user's Pokémon, and in Nuzlocke,
 * dead Pokémon are lost forever.
 * 
 * Categories:
 * - Self-destruct moves: Explosion, Self-Destruct, Misty Explosion, etc.
 * - High recoil moves: Take Down, Double-Edge, Brave Bird, Flare Blitz, etc.
 * - HP sacrifice moves: Belly Drum, Curse (Ghost-type), Mind Blown, etc.
 * - Moves with serious drawbacks: Final Gambit, Memento, Healing Wish, Lunar Dance
 * 
 * Note: This only applies to user Pokémon, not rival Pokémon.
 */
const BLACKLISTED_MOVES = new Set([
  // Self-destruct moves (KO user)
  'explosion',
  'self-destruct',
  
  // Delayed damage moves (hit 2 turns later, too unreliable for Nuzlocke)
  'future-sight'
]);

/**
 * Blacklist of abilities that require gender data we don't have for rival Pokémon.
 * These abilities affect damage calculations based on gender, which we can't accurately calculate
 * without knowing the gender of opponent Pokémon. When a user's Pokémon has one of these abilities,
 * we'll replace it with a neutral ability for calculation purposes.
 * 
 * Examples:
 * - Rivalry: Boosts damage by 25% if same gender, reduces by 25% if opposite
 * - Cute Charm: May infatuate opponent of opposite gender
 */
const BLACKLISTED_ABILITIES = new Set([
  'rivalry'
]);

/**
 * Neutral ability to use when replacing blacklisted abilities.
 * Illuminate has no effect on damage calculations or battle mechanics,
 * making it perfect as a neutral replacement.
 */
const NEUTRAL_ABILITY = 'Illuminate';

// Pokémon with cosmetic-only forms that @smogon/calc doesn't recognize
// These forms have identical stats/types/abilities, only appearance differs
const COSMETIC_FORMS = {
  // Burmy forms (trash/sandy/plant are cosmetic)
  'burmy-trash': 'burmy',
  'burmy-sandy': 'burmy',
  'burmy-plant': 'burmy',
  
  // Shellos forms (east/west are cosmetic)
  'shellos-east': 'shellos',
  'shellos-west': 'shellos',
  
  // Gastrodon forms (east/west are cosmetic)
  'gastrodon-east': 'gastrodon',
  'gastrodon-west': 'gastrodon',
  
  // Vivillon patterns (cosmetic variants)
  'vivillon-meadow': 'vivillon',
  'vivillon-polar': 'vivillon',
  'vivillon-tundra': 'vivillon',
  'vivillon-continental': 'vivillon',
  'vivillon-garden': 'vivillon',
  'vivillon-elegant': 'vivillon',
  'vivillon-icy-snow': 'vivillon',
  'vivillon-modern': 'vivillon',
  'vivillon-marine': 'vivillon',
  'vivillon-archipelago': 'vivillon',
  'vivillon-high-plains': 'vivillon',
  'vivillon-sandstorm': 'vivillon',
  'vivillon-river': 'vivillon',
  'vivillon-monsoon': 'vivillon',
  'vivillon-savanna': 'vivillon',
  'vivillon-sun': 'vivillon',
  'vivillon-ocean': 'vivillon',
  'vivillon-jungle': 'vivillon',
  'vivillon-fancy': 'vivillon',
  'vivillon-pokeball': 'vivillon',
  
  // Flabébé colors (cosmetic)
  'flabebe-red': 'flabebe',
  'flabebe-yellow': 'flabebe',
  'flabebe-orange': 'flabebe',
  'flabebe-blue': 'flabebe',
  'flabebe-white': 'flabebe',
  
  // Floette colors (cosmetic)
  'floette-red': 'floette',
  'floette-yellow': 'floette',
  'floette-orange': 'floette',
  'floette-blue': 'floette',
  'floette-white': 'floette',
  
  // Florges colors (cosmetic)
  'florges-red': 'florges',
  'florges-yellow': 'florges',
  'florges-orange': 'florges',
  'florges-blue': 'florges',
  'florges-white': 'florges',
  
  // Furfrou trims (cosmetic)
  'furfrou-heart': 'furfrou',
  'furfrou-star': 'furfrou',
  'furfrou-diamond': 'furfrou',
  'furfrou-debutante': 'furfrou',
  'furfrou-matron': 'furfrou',
  'furfrou-dandy': 'furfrou',
  'furfrou-la-reine': 'furfrou',
  'furfrou-kabuki': 'furfrou',
  'furfrou-pharaoh': 'furfrou',
  
  // Minior cores (cosmetic, Shell form is the battle form)
  'minior-red': 'minior',
  'minior-orange': 'minior',
  'minior-yellow': 'minior',
  'minior-green': 'minior',
  'minior-blue': 'minior',
  'minior-indigo': 'minior',
  'minior-violet': 'minior'
};
const DEFAULT_CALC_GEN = 9; // Modern romhacks use Gen 9

// KO Analysis constants
const GUARANTEED_KO_THRESHOLD = 100; // 100% chance = guaranteed
const SINGLE_MOVE_THRESHOLD = 1; // For single move vs multi-move logic

/**
 * Normalize Pokémon name for @smogon/calc compatibility
 * 
 * Some Pokémon have cosmetic-only forms (Burmy, Shellos, Vivillon, etc.) that:
 * - Have identical stats, types, and abilities across all forms
 * - Are not recognized by @smogon/calc (which only knows the base form)
 * - Only differ in appearance/sprite
 * 
 * This function maps cosmetic forms to their base form so the calculator works.
 * 
 * Regional forms (Alolan, Galarian, etc.) are NOT cosmetic and should NOT be normalized.
 * 
 * @param {string} pokemonName - Original Pokémon name (e.g., "burmy-trash", "geodude-alola")
 * @returns {string} Normalized name for calculator (e.g., "burmy", "geodude-alola")
 */
function normalizeForCalculator(pokemonName) {
  if (!pokemonName) return pokemonName;
  
  const normalized = pokemonName.toLowerCase().trim();
  
  // Check if this is a cosmetic form
  if (COSMETIC_FORMS[normalized]) {
    console.log(`[Name Normalization] ${pokemonName} → ${COSMETIC_FORMS[normalized]} (cosmetic form)`);
    return COSMETIC_FORMS[normalized];
  }
  
  // Not a cosmetic form, return as-is (preserves regional forms like "geodude-alola")
  return normalized;
}
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
    let { userPokemon, rivalPokemon, game, gameMode, gameKey } = body;
    
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
    console.log(`[Game] Detected game: ${gameKey || game || 'unknown'}`);
    
    // Get game configuration
    const detectedGame = gameKey || game;
    const gameConfig = gamesData[detectedGame] || {};
    const genNumber = gameConfig.calcGen || DEFAULT_CALC_GEN;
    
    console.log(`[Calculator] Using @smogon/calc with Generation ${genNumber} for game: ${detectedGame}`);
    
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
      
      // Fetch ALL learnable attacking moves for user Pokémon (similar to route mode)
      let userMonWithAllMoves = userMonCapped;
      try {
        // Use Radical Red data directly instead of HTTP fetch
        const { getPokemonMoves, hasSpecies } = await import('$lib/utils/radred-data.js');
        
        if (gameKey === 'radred' && hasSpecies(userMon.name)) {
          const movesData = getPokemonMoves(userMon.name);
          
          // Filter moves learnable up to level cap and only attacking moves
          const learnableMoves = (movesData.levelUp || [])
            .filter(m => m.level <= levelCap && m.damage_class !== 'status')
            .map(m => m.id || m.name);
          
          console.log(`[User Pokemon] ${userMon.name}: ${learnableMoves.length} learnable attacking moves available`);
          
          // Use ALL available attacking moves for calculations
          userMonWithAllMoves = {
            ...userMonCapped,
            moves: learnableMoves
          };
        } else {
          console.log(`[User Pokemon] No Radical Red data available for ${userMon.name}, using equipped moves only`);
        }
      } catch (error) {
        console.log(`[User Pokemon] Error fetching moves for ${userMon.name}:`, error.message);
        // Continue with equipped moves only
      }
      
      const matchups = [];
      
      for (const rivalMon of rivalPokemon) {
        console.log(`[Matchup] Processing rival: ${rivalMon.name} (level ${rivalMon.level})`);
        
        // Calculate with ALL learnable moves (for suggestions)
        const matchupWithAllMoves = calculateMatchup(gen, userMonWithAllMoves, rivalMon);
        
        // Calculate with EQUIPPED moves only (for UI display)
        const matchupWithEquippedMoves = calculateMatchup(gen, userMonCapped, rivalMon);
        
        matchups.push({
          // Rival Pokémon info
          rivalPokemon: rivalMon.name,  // Changed from rivalName to rivalPokemon
          rivalLevel: rivalMon.level,
          rivalAbility: rivalMon.ability,
          rivalNature: rivalMon.nature,
          rivalItem: rivalMon.item,
          rivalMoves: rivalMon.moves?.map(m => typeof m === 'string' ? m : (m.name || m)) || [],
          // User Pokémon info
          userLevel: userMonWithAllMoves.level,
          userAbility: userMonWithAllMoves.ability,
          userNature: userMonWithAllMoves.nature,
          userItem: userMonWithAllMoves.item,
          userMoves: userMon.moves || [], // Show only equipped moves in UI
          // Calculation results (use equipped moves for UI display)
          ...matchupWithEquippedMoves,
          // Store all moves calculation for suggestions
          _allMovesCalculation: matchupWithAllMoves,
          // Ensure damagePercentage exists (alias for damagePercent)
          damagePercentage: matchupWithEquippedMoves.damagePercent ? `${matchupWithEquippedMoves.damagePercent}%` : 'N/A',
          damageRange: matchupWithEquippedMoves.damageRange ? `${matchupWithEquippedMoves.damageRange[0]},${matchupWithEquippedMoves.damageRange[1]}` : 'N/A',
          // Add damage percentage range from description parsing
          damagePercentageRange: matchupWithEquippedMoves.damagePercentageRange ? `${matchupWithEquippedMoves.damagePercentageRange[0]},${matchupWithEquippedMoves.damagePercentageRange[1]}` : null,
          // Add OHKO/2HKO chances as percentages (use parsed values from description)
          ohkoChance: matchupWithEquippedMoves.ohkoChance || (matchupWithEquippedMoves.canOHKO ? 100 : 0),
          twoHkoChance: matchupWithEquippedMoves.twoHkoChance || (matchupWithEquippedMoves.canTwoHKO ? 100 : 0),
          // Add guaranteed KO and general KO chance information
          isGuaranteedKO: matchupWithEquippedMoves.isGuaranteedKO || false,
          koChance: matchupWithEquippedMoves.koChance || 0,
          score: matchupWithEquippedMoves.winProbability || 0
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
 * Calculate remaining HP for the winning Pokémon
 * @param {Object} winner - The winning Pokémon data
 * @param {Array} movesUsed - Array of moves used by the winner
 * @param {Array} moveOptions - Available move options for the winner
 * @returns {number} Remaining HP after battle
 */
function calculateWinnerRemainingHP(winner, winnerMovesUsed, winnerMoveOptions, loser, loserMovesUsed, loserMoveOptions, winnerSpeed, loserSpeed) {
  const debugInfo = {
    functionCalled: true,
    winner: winner?.name,
    loser: loser?.name,
    winnerSpeed,
    loserSpeed,
    turns: []
  };
  
  // Get the winner's max HP from the appropriate property
  // For @smogon/calc Pokemon objects, use rawStats.hp or stats.hp
  const maxHP = winner?.rawStats?.hp || winner?.stats?.hp || winner?.calculatedStats?.hp || winner?.hp || 0;
  
  debugInfo.maxHP = maxHP;
  
  if (!loserMovesUsed || loserMovesUsed.length === 0) {
    console.log(`[HP CALCULATION] No loser moves, returning max HP: ${maxHP}`);
    debugInfo.noLoserMoves = true;
    winner._hpDebug = debugInfo;
    return maxHP;
  }
  
  let totalDamageReceived = 0;
  
  console.log(`[HP CALCULATION] Calculating HP for winner ${winner?.name}`);
  console.log(`[HP CALCULATION] Loser moves used:`, loserMovesUsed.map(m => `${m.move} (${m.damage} dmg)`));
  
  // Simply sum up the damage from loser moves (damage already calculated in battleSequence)
  for (let turn = 0; turn < loserMovesUsed.length; turn++) {
    const loserMove = loserMovesUsed[turn];
    const damage = loserMove.damage || 0; // Use the pre-calculated damage from battleSequence
    
    totalDamageReceived += damage;
    
    debugInfo.turns.push({
      turn: turn + 1,
      move: loserMove.move,
      damage
    });
    
    console.log(`[HP CALCULATION] Turn ${turn + 1}: ${loserMove.move} deals ${damage} damage`);
  }
  
  const remainingHP = Math.max(0, maxHP - totalDamageReceived);
  
  debugInfo.totalDamageReceived = totalDamageReceived;
  debugInfo.startingHP = maxHP;
  debugInfo.remainingHP = remainingHP;
  
  console.log(`[HP CALCULATION] Total damage received: ${totalDamageReceived}`);
  console.log(`[HP CALCULATION] Starting HP: ${maxHP}`);
  console.log(`[HP CALCULATION] Remaining HP: ${remainingHP}`);
  
  winner._hpDebug = debugInfo;
  
  return remainingHP;
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
 * Calculate KO probability for a single move
 * 
 * Important: We need to manually check if the move can KO based on damage array,
 * because @smogon/calc's kochance() assumes full HP and doesn't accept custom HP values.
 */
function calculateSingleMoveKO(gen, attacker, defender, moveUsed, defenderHP) {
  const moveResult = calculate(gen, attacker, defender, new Move(gen, moveUsed.move));
  
  // Apply ability modifiers (e.g., Sturdy)
  const modifiedResult = applyAbilityModifiers(
    moveResult, 
    attacker, 
    defender, 
    moveUsed, 
    defenderHP, 
    defenderHP // Current HP = Max HP for single move calculation
  );
  
  const damageArray = modifiedResult.damage;
  
  if (!damageArray || damageArray.length === 0) {
    return createKOAnalysisResult(0, false, 'No damage', SINGLE_MOVE_THRESHOLD);
  }
  
  // Count how many damage values can KO the defender
  const koCount = damageArray.filter(damage => damage >= defenderHP).length;
  const totalCombinations = damageArray.length;
  const koProbability = koCount / totalCombinations;
  const koPercentage = roundPercentage(koProbability);
  
  // Build description
  let description;
  if (koProbability === 1) {
    description = 'guaranteed OHKO';
  } else if (koProbability > 0) {
    description = `${koPercentage}% chance to OHKO`;
  } else {
    description = 'cannot OHKO';
  }
  
  return createKOAnalysisResult(
    koPercentage,
    koProbability === 1,
    description,
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
    
    // Apply ability modifiers (e.g., Sturdy) for each move
    const modifiedResult = applyAbilityModifiers(
      moveResult, 
      attacker, 
      defender, 
      moveUsed, 
      defenderHP, 
      defenderHP // Current HP = Max HP for multi-move calculation
    );
    
    const damageArray = modifiedResult.damage;
    
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
function calculateAllMoves(gen, attacker, defender, movesList, isUserPokemon = false, turnNumber = 1) {
  const moveResults = [];
  
  if (!movesList || movesList.length === 0) {
    console.log(`  ⚠️  No moves available for ${attacker.name}`);
    return moveResults;
  }
  
  console.log(`  📋 Analyzing ${movesList.length} moves for ${attacker.name} (Turn ${turnNumber}):`);
  
  for (const moveName of movesList) {
    const actualMoveName = typeof moveName === 'object' ? (moveName.name || moveName) : moveName;
    
    if (!actualMoveName || actualMoveName === '(No Move)') continue;
    
    // Skip first-turn-only moves if not on first turn
    if (!canUseMoveInTurn(actualMoveName, turnNumber)) {
      console.log(`     🚫 Skipping ${actualMoveName} (only works on first turn)`);
      continue;
    }
    
    try {
      const move = new Move(gen, actualMoveName);
      
      // Skip blacklisted moves for user Pokémon in Nuzlocke mode
      // These moves are too risky (self-destruct, high recoil, etc.)
      if (isUserPokemon && BLACKLISTED_MOVES.has(move.name.toLowerCase().replace(/\s+/g, '-'))) {
        console.log(`     🚫 Skipping blacklisted move: ${move.name} (too risky for Nuzlocke)`);
        continue;
      }
      
      // Skip status moves (no damage)
      if (move.category === 'Status') continue;
      
      // Validate Pokémon objects
      if (!attacker?.species || !defender?.species) {
        console.log(`     ❌ Invalid Pokémon data for ${actualMoveName}`);
        continue;
      }
      
      const result = calculate(gen, attacker, defender, move);
      
      // Apply ability modifiers (e.g., Sturdy)
      const modifiedResult = applyAbilityModifiers(
        result, 
        attacker, 
        defender, 
        move, 
        defender.calculatedStats?.hp || defender.rawStats?.hp || defender.stats?.hp || defender.hp || 0,
        defender.calculatedStats?.hp || defender.rawStats?.hp || defender.stats?.hp || defender.hp || 0
      );
      
      if (!modifiedResult.damage || (Array.isArray(modifiedResult.damage) && modifiedResult.damage.length === 0)) {
        continue; // Skip moves with no damage
      }
      
      const damageRange = extractDamage(modifiedResult);
      const medianDamage = calculateMedianDamage(modifiedResult.damage);
      const minDamage = damageRange[0];
      const maxDamage = damageRange[1];
      const priorityIndicator = move.priority > 0 ? ` [Priority +${move.priority}]` : '';
      
      console.log(`     • ${actualMoveName.padEnd(18)} ${minDamage}-${maxDamage} HP (median: ${medianDamage})${priorityIndicator}`);
      
      moveResults.push({
        name: actualMoveName,
        priority: move.priority || 0,
        avgDamage: medianDamage,
        minDamage,
        maxDamage,
        damageRange,
        result: modifiedResult
      });
    } catch (moveError) {
      // Silently skip failed moves to reduce noise
    }
  }
  
  console.log(`  ✅ ${moveResults.length} valid attacking moves available\n`);
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
 * Helper: Create battle move record for tracking
 * @param {string} moveName - Name of the move used
 * @param {number} turn - Turn number when used
 * @param {number} damage - Median damage value (for logging only)
 * @param {number} targetHP - Target's max HP (unchanging)
 * @returns {Object} Move record object
 */
function createMoveRecord(moveName, turn, damage, targetHP) {
  return {
    move: moveName,
    turn,
    damage,
    targetHP
  };
}

/**
 * Helper: Get user's last move priority
 */
function getUserMovePriority(userMovesUsed, userMoveOptions) {
  const userLastMove = userMoveOptions.find(m => m.name === userMovesUsed[userMovesUsed.length - 1]?.move);
  return userLastMove?.priority || 0;
}

/**
 * Helper: Get rival's last move priority
 */
function getRivalMovePriority(rivalMovesUsed, rivalMoveOptions) {
  const rivalLastMove = rivalMoveOptions.find(m => m.name === rivalMovesUsed[rivalMovesUsed.length - 1]?.move);
  return rivalLastMove?.priority || 0;
}

/**
 * Helper: Handle battle outcome when both sides can KO
 * @param {number} turn - Current turn number
 * @param {Object} userKOData - User's KO data
 * @param {Object} rivalKOData - Rival's KO data
 * @param {Array} userMovesUsed - User's moves used
 * @param {Array} rivalMovesUsed - Rival's moves used
 * @param {Array} userMoveOptions - User's move options
 * @param {Array} rivalMoveOptions - Rival's move options
 * @param {number} userSpeed - User's speed stat
 * @param {number} rivalSpeed - Rival's speed stat
 * @param {Array} battleLog - Battle log array
 * @param {Object} userPokemon - User's Pokémon data
 * @param {Object} rivalPokemon - Rival's Pokémon data
 * @returns {Object} Object with winner info and remaining HP
 */
function handleBothCanKO(turn, userKOData, rivalKOData, userMovesUsed, rivalMovesUsed,
                         userMoveOptions, rivalMoveOptions, userSpeed, rivalSpeed, battleLog,
                         userPokemon, rivalPokemon) {
  const userPriority = getUserMovePriority(userMovesUsed, userMoveOptions);
  const rivalPriority = getRivalMovePriority(rivalMovesUsed, rivalMoveOptions);
  
  const userWinsBySpeed = determineWinnerBySpeed(userSpeed, rivalSpeed, userPriority, rivalPriority);
  
  console.log(`\n  ⚡ Both can KO - winner determined by speed/priority!`);
  console.log(`     User:  ${userKOData.probability}% ${userMovesUsed.length}HKO (Speed: ${userSpeed}, Priority: ${userPriority})`);
  console.log(`     Rival: ${rivalKOData.probability}% ${rivalMovesUsed.length}HKO (Speed: ${rivalSpeed}, Priority: ${rivalPriority})`);
  
  if (userWinsBySpeed) {
    console.log(`  ✅ USER WINS by speed/priority advantage!`);
    battleLog.push(`Turn ${turn}: User wins (faster/priority) with ${userKOData.probability}% ${userMovesUsed.length}HKO`);
    
    // Calculate remaining HP for the winning user
    const remainingHP = calculateWinnerRemainingHP(userPokemon, userMovesUsed, userMoveOptions, rivalPokemon, rivalMovesUsed, rivalMoveOptions, userSpeed, rivalSpeed);
    console.log(`[BATTLE RESULT] User remaining HP: ${remainingHP}/${userPokemon.rawStats?.hp || userPokemon.stats?.hp || 'unknown'}`);
    
    return { winner: 'user', remainingHP };
  } else {
    console.log(`  ❌ RIVAL WINS by speed/priority advantage!`);
    battleLog.push(`Turn ${turn}: Rival wins (faster/priority) with ${rivalKOData.probability}% ${rivalMovesUsed.length}HKO`);
    
    // Calculate remaining HP for the winning rival
    const remainingHP = calculateWinnerRemainingHP(rivalPokemon, rivalMovesUsed, rivalMoveOptions, userPokemon, userMovesUsed, userMoveOptions, rivalSpeed, userSpeed);
    console.log(`[BATTLE RESULT] Rival remaining HP: ${remainingHP}/${rivalPokemon.rawStats?.hp || rivalPokemon.stats?.hp || 'unknown'}`);
    
    return { winner: 'rival', remainingHP };
  }
}

/**
 * Helper: Handle battle outcome when only user can KO
 * @param {number} turn - Current turn number
 * @param {Object} userKOData - User's KO data
 * @param {Array} userMovesUsed - User's moves used
 * @param {Array} battleLog - Battle log array
 * @param {Object} userPokemon - User's Pokémon data
 * @param {Array} userMoveOptions - User's move options
 * @returns {number} Remaining HP of the winning user Pokémon
 */
function handleUserWins(turn, userKOData, userMovesUsed, battleLog, userPokemon, userMoveOptions, rivalPokemon, rivalMovesUsed, rivalMoveOptions, userSpeed, rivalSpeed) {
  console.log(`\n  ✅ USER WINS - ${userKOData.probability}% chance to ${userMovesUsed.length}HKO detected!`);
  battleLog.push(`Turn ${turn}: User wins with ${userKOData.probability}% ${userMovesUsed.length}HKO`);
  
  // Calculate remaining HP for the winning user
  const remainingHP = calculateWinnerRemainingHP(userPokemon, userMovesUsed, userMoveOptions, rivalPokemon, rivalMovesUsed, rivalMoveOptions, userSpeed, rivalSpeed);
  console.log(`[BATTLE RESULT] User remaining HP: ${remainingHP}/${userPokemon.rawStats?.hp || userPokemon.stats?.hp || 'unknown'}`);
  
  return remainingHP;
}

/**
 * Helper: Handle battle outcome when only rival can KO
 * @param {number} turn - Current turn number
 * @param {Object} rivalKOData - Rival's KO data
 * @param {Array} rivalMovesUsed - Rival's moves used
 * @param {Array} battleLog - Battle log array
 * @param {Object} rivalPokemon - Rival's Pokémon data
 * @param {Array} rivalMoveOptions - Rival's move options
 * @returns {number} Remaining HP of the winning rival Pokémon
 */
function handleRivalWins(turn, rivalKOData, rivalMovesUsed, battleLog, rivalPokemon, rivalMoveOptions, userPokemon, userMovesUsed, userMoveOptions, rivalSpeed, userSpeed) {
  console.log(`\n  ❌ RIVAL WINS - ${rivalKOData.probability}% chance to ${rivalMovesUsed.length}HKO detected!`);
  battleLog.push(`Turn ${turn}: Rival wins with ${rivalKOData.probability}% ${rivalMovesUsed.length}HKO`);
  
  // Calculate remaining HP for the winning rival
  const remainingHP = calculateWinnerRemainingHP(rivalPokemon, rivalMovesUsed, rivalMoveOptions, userPokemon, userMovesUsed, userMoveOptions, rivalSpeed, userSpeed);
  console.log(`[BATTLE RESULT] Rival remaining HP: ${remainingHP}/${rivalPokemon.rawStats?.hp || rivalPokemon.stats?.hp || 'unknown'}`);
  
  return remainingHP;
}

/**
 * Helper: Determine battle winner when both sides can KO
 * 
 * @param {number} userSpeed - User's speed stat
 * @param {number} rivalSpeed - Rival's speed stat
 * @param {number} userPriority - User's move priority
 * @param {number} rivalPriority - Rival's move priority
 * @returns {boolean} True if user wins, false if rival wins
 */
function determineWinnerBySpeed(userSpeed, rivalSpeed, userPriority, rivalPriority) {
  // Priority moves take precedence
  if (userPriority > rivalPriority) {
    return true; // User has priority advantage
  }
  
  if (rivalPriority > userPriority) {
    return false; // Rival has priority advantage
  }
  
  // Same priority - faster Pokémon wins
  return userSpeed >= rivalSpeed;
}

/**
 * Helper: Select optimal move considering move sequence KO probability
 * 
 * Strategy:
 * 1. If a priority move + previous moves GUARANTEES KO (100%) → use it
 * 2. Among moves that + previous moves guarantee KO → use the one with highest damage
 * 3. Among moves that + previous moves can potentially KO → use the one with highest KO probability
 * 4. Otherwise → use move with highest average damage
 */
function selectOptimalMove(gen, attacker, defender, moveResults, defenderMaxHP, movesUsedSoFar = []) {
  if (!moveResults || moveResults.length === 0) {
    return null;
  }
  
  const priorityMoves = moveResults.filter(m => m.priority > 0);
  
  // Strategy 1: Priority move that GUARANTEES KO when combined with previous moves
  if (priorityMoves.length > 0 && movesUsedSoFar.length > 0) {
    for (const priorityMove of priorityMoves) {
      const testSequence = [...movesUsedSoFar, { move: priorityMove.name, damage: priorityMove.avgDamage }];
      const koData = calculateMoveSequenceKOProbability(gen, attacker, defender, testSequence, defenderMaxHP);
      if (koData.probability === 100) {
        console.log(`  ⚡ Priority move ${priorityMove.name} guarantees KO with previous moves!`);
        return priorityMove;
      }
    }
  }
  
  // Strategy 2: Move that guarantees KO when combined with previous moves
  // Priority: 1) Priority moves, 2) Higher damage
  let bestGuaranteedKO = null;
  let bestGuaranteedKOPriority = -1;
  let bestGuaranteedKODamage = 0;
  
  for (const move of moveResults) {
    const testSequence = [...movesUsedSoFar, { move: move.name, damage: move.avgDamage }];
    const koData = calculateMoveSequenceKOProbability(gen, attacker, defender, testSequence, defenderMaxHP);
    
    if (koData.probability === 100) {
      const movePriority = move.priority || 0;
      const shouldSelect = 
        !bestGuaranteedKO || // No previous best
        movePriority > bestGuaranteedKOPriority || // Higher priority
        (movePriority === bestGuaranteedKOPriority && move.avgDamage > bestGuaranteedKODamage); // Same priority, higher damage
      
      if (shouldSelect) {
        bestGuaranteedKO = move;
        bestGuaranteedKOPriority = movePriority;
        bestGuaranteedKODamage = move.avgDamage;
      }
    }
  }
  
  if (bestGuaranteedKO) {
    return bestGuaranteedKO;
  }
  
  // Strategy 3: Move with best KO probability when combined with previous moves
  let bestPossibleKO = null;
  let bestKOProbability = 0;
  
  for (const move of moveResults) {
    const testSequence = [...movesUsedSoFar, { move: move.name, damage: move.avgDamage }];
    const koData = calculateMoveSequenceKOProbability(gen, attacker, defender, testSequence, defenderMaxHP);
    if (koData.probability > bestKOProbability) {
      bestPossibleKO = move;
      bestKOProbability = koData.probability;
    }
  }
  
  if (bestPossibleKO && bestKOProbability > 0) {
    return bestPossibleKO;
  }
  
  // Strategy 4: Highest average damage
  return moveResults.reduce((best, current) => 
    current.avgDamage > best.avgDamage ? current : best
  );
}

/**
 * Calculate complete 1v1 battle simulation using KO probability analysis
 * 
 * NEW BATTLE SIMULATION STRATEGY (No HP Modification):
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. Calculate all possible moves for both Pokémon (damage, priority)
 * 
 * 2. Simulate battle turn-by-turn WITHOUT modifying HP:
 *    - Select optimal move based on FULL HP (not reduced)
 *    - Record moves used by both sides
 *    - After EACH turn, calculate KO probability using exact damage arrays
 *    - Battle ends when EITHER side has >0% KO probability
 * 
 * 3. KO Probability Calculation (per turn):
 *    - Uses @smogon/calc's exact "Possible damage amounts" arrays
 *    - Calculates all possible damage combinations
 *    - Returns precise probability of KO (e.g., 8.6% for 2HKO)
 * 
 * Move Selection Logic:
 * - Priority moves that guarantee KO → highest priority
 * - Guaranteed KO moves (min damage >= HP) → second priority  
 * - Possible KO moves (max damage >= HP) → third priority
 * - Highest median damage → fallback
 * 
 * Example: Croconaw vs Clodsire (111 HP)
 * - Turn 1: ice-fang selected, 0% KO chance → continue
 * - Turn 2: ice-fang selected again, 8.6% 2HKO chance → BATTLE ENDS
 * 
 * @param {Generation} gen - @smogon/calc Generation instance
 * @param {Object} userMon - User's Pokémon data
 * @param {Object} rivalMon - Rival's Pokémon data
 * @returns {Object} Battle result with winner, KO probabilities, and move sequences
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
    let userAbility = normalizeAbilityName(userMon.ability);
    
    // Check if ability is blacklisted (requires gender data we don't have)
    const abilityIdLower = userMon.ability?.toLowerCase().replace(/\s+/g, '-');
    if (BLACKLISTED_ABILITIES.has(abilityIdLower)) {
      console.log(`⚠️ [Ability Blacklist] ${userMon.name}'s ability "${userAbility}" requires gender data. Replacing with "${NEUTRAL_ABILITY}".`);
      userAbility = NEUTRAL_ABILITY; // Use neutral ability that doesn't affect damage calculations
    }
    
    const userNameForCalc = normalizeForCalculator(userMon.name);
    
    const userPokemon = new Pokemon(gen, userNameForCalc, {
      level: userMon.level || 50,
      ability: userAbility,
      abilityOn: true, // Always enable abilities for proper stat modifiers
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
    const baseStats = rivalMon.stats ? {
      hp: rivalMon.stats.hp,
      atk: rivalMon.stats.atk,
      def: rivalMon.stats.def,
      spa: rivalMon.stats.spa,
      spd: rivalMon.stats.spd,
      spe: rivalMon.stats.spe
    } : undefined;
    
    console.log(`[Base Stats] Using ${baseStats ? 'provided' : 'default'} base stats for ${rivalMon.name}:`, baseStats);
    
    const rivalNameForCalc = normalizeForCalculator(rivalMon.name);
    
    const rivalPokemon = new Pokemon(gen, rivalNameForCalc, {
      level: parseInt(rivalMon.level) || 50,
      ability: rivalAbilityName || undefined,
      abilityOn: true, // Always enable abilities for proper stat modifiers
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
    
    // ========== STEP 1: Prepare move lists (will be recalculated each turn) ==========
    console.log(`\n[1v1 SIMULATION] Preparing move lists...`);
    
    // Process rival moves, handling special cases like Hidden Power with type
    const rivalMoves = rivalMon.moves?.map(m => {
      if (typeof m === 'string') return m;
      
      // Special handling for Hidden Power - include type information
      if (m.name === 'Hidden Power' && m.type) {
        return `${m.name} ${m.type}`; // e.g., "Hidden Power grass"
      }
      
      return m.name || m;
    }) || [];
    
    // Move validation will be done inside the battle loop
    
    // ========== STEP 2: Simulate turn-by-turn battle with KO probability checks ==========
    const userMaxHP = userPokemon.maxHP();
    const rivalMaxHP = rivalPokemon.maxHP();
    const userSpeed = userPokemon.rawStats.spe;
    const rivalSpeed = rivalPokemon.rawStats.spe;
    
    let turn = 1;
    let battleLog = [];
    
    // Track moves used in battle sequence (WITHOUT actually modifying HP)
    let userMovesUsed = [];
    let rivalMovesUsed = [];
    
    // Track who wins based on KO probability
    let userWins = false;
    let rivalWins = false;
    let winnerRemainingHP = null;
    
    console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  BATTLE SIMULATION - KO PROBABILITY ANALYSIS              ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝`);
    console.log(`  👤 ${userMon.name.padEnd(20)} ${userMaxHP} HP | ${userSpeed} Speed`);
    console.log(`  🎯 ${rivalMon.name.padEnd(20)} ${rivalMaxHP} HP | ${rivalSpeed} Speed`);
    console.log(`  ⚡ Strategy: Find first turn with >0% KO probability\n`);
    
    while (!userWins && !rivalWins && turn <= MAX_BATTLE_TURNS) {
      console.log(`${'─'.repeat(60)}`);
      console.log(`Turn ${turn}`);
      console.log(`${'─'.repeat(60)}`);
      
      // Recalculate move options for this turn (filters first-turn-only moves)
      const userMoveOptions = calculateAllMoves(gen, userPokemon, rivalPokemon, userMon.moves, true, turn);
      const rivalMoveOptions = calculateAllMoves(gen, rivalPokemon, userPokemon, rivalMoves, false, turn);
      
      // Select optimal moves for this turn considering previous moves
      const userSelectedMove = selectOptimalMove(gen, userPokemon, rivalPokemon, userMoveOptions, rivalMaxHP, userMovesUsed);
      const rivalSelectedMove = rivalMoveOptions.length > 0 
        ? selectOptimalMove(gen, rivalPokemon, userPokemon, rivalMoveOptions, userMaxHP, rivalMovesUsed)
        : null;
      
      if (!userSelectedMove) {
        console.log(`❌ User has no valid moves remaining`);
        rivalWins = true;
        break;
      }
      
      // Determine turn order (who attacks first)
      const userAttacksFirst = determineFirstAttacker(userSelectedMove, rivalSelectedMove, userSpeed, rivalSpeed);
      
      const userPriorityStr = userSelectedMove.priority > 0 ? ` +${userSelectedMove.priority}` : '';
      const rivalPriorityStr = rivalSelectedMove?.priority > 0 ? ` +${rivalSelectedMove.priority}` : '';
      
      console.log(`  👤 User chooses:  ${userSelectedMove.name}${userPriorityStr}`);
      console.log(`  🎯 Rival chooses: ${rivalSelectedMove?.name || 'None'}${rivalPriorityStr}`);
      console.log(`  ⚡ First strike:  ${userAttacksFirst ? 'User' : 'Rival'}\n`);
      
      // ========== Execute moves in order and check for KO after each ==========
      
      // First attacker always executes their move
      if (userAttacksFirst) {
        userMovesUsed.push(createMoveRecord(userSelectedMove.name, turn, userSelectedMove.avgDamage, rivalMaxHP));
      } else if (rivalSelectedMove) {
        rivalMovesUsed.push(createMoveRecord(rivalSelectedMove.name, turn, rivalSelectedMove.avgDamage, userMaxHP));
      }
      
      // ========== CRITICAL: Calculate KO probability after first attacker ==========
      console.log(`  🎲 KO Probability Check:`);
      
      // Calculate KO probabilities after first attacker
      const userKODataAfterFirst = calculateMoveSequenceKOProbability(gen, userPokemon, rivalPokemon, userMovesUsed, rivalMaxHP);
      const rivalKODataAfterFirst = rivalMovesUsed.length > 0 
        ? calculateMoveSequenceKOProbability(gen, rivalPokemon, userPokemon, rivalMovesUsed, userMaxHP)
        : { probability: 0, isGuaranteed: false };
      
      // Determine if first attacker KO'd
      const firstAttackerKOd = userAttacksFirst ? userKODataAfterFirst.probability > 0 : rivalKODataAfterFirst.probability > 0;
      
      // Only allow second attacker to move if first attacker didn't KO
      if (!firstAttackerKOd) {
        // First attacker didn't KO, second attacker can attack
        if (userAttacksFirst && rivalSelectedMove) {
          rivalMovesUsed.push(createMoveRecord(rivalSelectedMove.name, turn, rivalSelectedMove.avgDamage, userMaxHP));
        } else if (!userAttacksFirst) {
          userMovesUsed.push(createMoveRecord(userSelectedMove.name, turn, userSelectedMove.avgDamage, rivalMaxHP));
        }
      } else {
        console.log(`  🎯 First attacker has KO probability, second attacker doesn't get to move`);
      }
      
      // Calculate final KO probabilities for this turn (after both attackers)
      const userKOData = calculateMoveSequenceKOProbability(gen, userPokemon, rivalPokemon, userMovesUsed, rivalMaxHP);
      const userMoveSeq = userMovesUsed.map(m => m.move).join(' → ');
      console.log(`     User:  ${userKOData.probability.toString().padStart(5)}% (${userMoveSeq})`);
      
      let rivalKOData = { probability: 0, isGuaranteed: false };
      if (rivalMovesUsed.length > 0) {
        rivalKOData = calculateMoveSequenceKOProbability(gen, rivalPokemon, userPokemon, rivalMovesUsed, userMaxHP);
        const rivalMoveSeq = rivalMovesUsed.map(m => m.move).join(' → ');
        console.log(`     Rival: ${rivalKOData.probability.toString().padStart(5)}% (${rivalMoveSeq})`);
      }
      
      // ========== Battle End Condition: Check for KO Probability ==========
      const userCanKO = userKOData.probability > 0;
      const rivalCanKO = rivalKOData.probability > 0;
      
      if (userCanKO || rivalCanKO) {
        // At least one side can KO - determine the winner
        if (userCanKO && rivalCanKO) {
          // Both can KO - winner determined by speed/priority
          const bothResult = handleBothCanKO(
            turn, userKOData, rivalKOData, userMovesUsed, rivalMovesUsed,
            userMoveOptions, rivalMoveOptions, userSpeed, rivalSpeed,
            battleLog, userPokemon, rivalPokemon
          );
          userWins = bothResult.winner === 'user';
          rivalWins = bothResult.winner === 'rival';
          winnerRemainingHP = bothResult.remainingHP;
        } else if (userCanKO) {
          // Only user can KO
          winnerRemainingHP = handleUserWins(turn, userKOData, userMovesUsed, battleLog, userPokemon, userMoveOptions, rivalPokemon, rivalMovesUsed, rivalMoveOptions, userSpeed, rivalSpeed);
          userWins = true;
        } else {
          // Only rival can KO
          winnerRemainingHP = handleRivalWins(turn, rivalKOData, rivalMovesUsed, battleLog, rivalPokemon, rivalMoveOptions, userPokemon, userMovesUsed, userMoveOptions, rivalSpeed, userSpeed);
          rivalWins = true;
        }
        break;
      }
      
      console.log(`\n  ⏩ No KO probability detected, continuing...\n`);
      turn++;
    }
    
    // Determine final battle outcome and check if max turns was reached
    const maxTurnsReached = turn > MAX_BATTLE_TURNS && !userWins && !rivalWins;
    const battleOutcome = battleLog[battleLog.length - 1] || `Battle timeout after ${MAX_BATTLE_TURNS} turns`;
    
    if (maxTurnsReached) {
      console.log(`\n⚠️  MAX TURNS LIMIT REACHED (${MAX_BATTLE_TURNS} turns)`);
      console.log(`    Calculation stopped to prevent exponential complexity (16^${MAX_BATTLE_TURNS + 1} combinations)`);
    }
    
    // ========== STEP 3: Calculate final KO probabilities ==========
    console.log(`${'═'.repeat(60)}`);
    
    // Calculate final KO probabilities for both sides
    const finalUserKOData = calculateMoveSequenceKOProbability(gen, userPokemon, rivalPokemon, userMovesUsed, rivalMaxHP);
    const finalRivalKOData = rivalMovesUsed.length > 0 
      ? calculateMoveSequenceKOProbability(gen, rivalPokemon, userPokemon, rivalMovesUsed, userMaxHP)
      : { probability: 0, isGuaranteed: false, description: 'No moves', hitsToKO: 0 };
    
    const userMoveSequence = userMovesUsed.map(m => m.move).join(' → ');
    const rivalMoveSequence = rivalMovesUsed.length > 0 ? rivalMovesUsed.map(m => m.move).join(' → ') : 'None';
    
    console.log(`\n📊 FINAL BATTLE STATISTICS`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Winner:        ${userWins ? '👤 USER' : '🎯 RIVAL'}`);
    console.log(`  Turns played:  ${turn - 1}`);
    console.log(`\n  User Strategy:`);
    console.log(`    Moves:       ${userMoveSequence}`);
    console.log(`    KO Chance:   ${finalUserKOData.probability}% to ${userMovesUsed.length}HKO ${finalUserKOData.isGuaranteed ? '✓ GUARANTEED' : ''}`);
    console.log(`\n  Rival Strategy:`);
    console.log(`    Moves:       ${rivalMoveSequence}`);
    console.log(`    KO Chance:   ${finalRivalKOData.probability}% to ${rivalMovesUsed.length}HKO ${finalRivalKOData.isGuaranteed ? '✓ GUARANTEED' : ''}`);
    console.log(`${'═'.repeat(60)}\n`);
    
    // ========== STEP 4: Build and return comprehensive battle data ==========
    // Recalculate move options for first turn to get move details
    const firstTurnUserMoves = calculateAllMoves(gen, userPokemon, rivalPokemon, userMon.moves, true, 1);
    const firstTurnRivalMoves = calculateAllMoves(gen, rivalPokemon, userPokemon, rivalMoves, false, 1);
    
    const firstUserMove = firstTurnUserMoves.find(m => m.name === userMovesUsed[0]?.move);
    const firstRivalMove = firstTurnRivalMoves.find(m => m.name === rivalMovesUsed[0]?.move);
    
    return {
      // ===== Battle Outcome =====
      userWins,
      battleOutcome,
      battleLog,
      turns: turn - 1,
      maxTurnsReached, // Flag to indicate if calculation was stopped due to complexity
      
      // ===== User Attack Data =====
      bestMove: userMovesUsed[0]?.move || 'No valid moves',
      damageRange: firstUserMove?.damageRange || [0, 0],
      hitsToKO: userMovesUsed.length,
      canOHKO: finalUserKOData.hitsToKO === SINGLE_MOVE_THRESHOLD,
      canTwoHKO: finalUserKOData.hitsToKO === 2,
      ohkoChance: finalUserKOData.hitsToKO === SINGLE_MOVE_THRESHOLD ? finalUserKOData.probability : 0,
      twoHkoChance: finalUserKOData.hitsToKO === 2 ? finalUserKOData.probability : 0,
      isGuaranteedKO: finalUserKOData.isGuaranteed,
      koChance: finalUserKOData.probability,
      damagePercent: firstUserMove 
        ? Math.round((firstUserMove.avgDamage / rivalMaxHP) * GUARANTEED_KO_THRESHOLD) 
        : 0,
      
      // ===== Battle Sequence =====
      battleSequence: {
        userMoves: userMovesUsed,
        rivalMoves: rivalMovesUsed,
        totalTurns: turn - 1,
        winningMove: userWins 
          ? userMovesUsed[userMovesUsed.length - 1]?.move 
          : rivalMovesUsed[rivalMovesUsed.length - 1]?.move
      },
      
      // ===== Rival Attack Data =====
      rivalBestMove: rivalMovesUsed[0]?.move || 'No valid moves',
      rivalDamageRange: firstRivalMove?.damageRange || [0, 0],
      rivalHitsToKO: rivalMovesUsed.length,
      rivalCanOHKO: finalRivalKOData.hitsToKO === SINGLE_MOVE_THRESHOLD,
      rivalCanTwoHKO: finalRivalKOData.hitsToKO === 2,
      rivalOhkoChance: finalRivalKOData.hitsToKO === SINGLE_MOVE_THRESHOLD 
        ? finalRivalKOData.probability 
        : 0,
      rivalDamagePercent: firstRivalMove 
        ? Math.round((firstRivalMove.avgDamage / userMaxHP) * GUARANTEED_KO_THRESHOLD) 
        : 0,
      
      // ===== Speed & Turn Order =====
      userSpeed,
      rivalSpeed,
      userMovePriority: firstUserMove?.priority || 0,
      rivalMovePriority: firstRivalMove?.priority || 0,
      userAttacksFirst: userSpeed >= rivalSpeed,
      
      // ===== HP Information =====
      userMaxHP,
      rivalMaxHP,
      winnerRemainingHP: winnerRemainingHP,
      // HP remaining for the winning Pokémon after battle
      
      // ===== Debug Information =====
      hpDebug: userPokemon._hpDebug || rivalPokemon._hpDebug || null,
      
      // ===== Scoring =====
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
 * HP-based scoring system:
 * - If user wins: score = 1 * (remainingHP / maxHP)
 * - If user loses: score = 0
 * - Total score = sum of all individual matchup scores
 * 
 * This provides more nuanced scoring: a Pokémon that wins with 50% HP remaining
 * scores 0.5 points, while one that wins with full HP scores 1.0 points.
 */
function calculateOverallScore(matchups) {
  if (!matchups || matchups.length === 0) return 0;
  
  let totalScore = 0;
  
  for (const matchup of matchups) {
    if (matchup.userWins && matchup.winnerRemainingHP !== null && matchup.userMaxHP) {
      // Calculate HP percentage remaining (0.0 to 1.0)
      const hpPercentage = Math.max(0, Math.min(1, matchup.winnerRemainingHP / matchup.userMaxHP));
      totalScore += hpPercentage;
    }
    // If user loses (userWins = false), score remains 0
  }
  
  return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
}

