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

// ========== SCORING WEIGHTS ==========
const SCORE_WIN = 1;
const SCORE_LOSS = 0;

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
 * Helper: Parse KO chances and damage percentages from description
 */
function parseCalculationDescription(desc, damageRange, defenderHP) {
  let ohkoChance = 0;
  let twoHkoChance = 0;
  let isGuaranteedKO = false;
  let koChance = 0;
  let damagePercentageRange = null;
  
  console.log(`    [parseCalculationDescription] Input description: "${desc}"`);
  
  if (!desc) {
    console.log(`    [parseCalculationDescription] ⚠️ No description provided`);
    return { ohkoChance, twoHkoChance, isGuaranteedKO, koChance, damagePercentageRange };
  }
  
  // Extract damage percentage range (e.g., "39.4 - 47.3%")
  const percentageMatch = desc.match(/\((\d+\.?\d*) - (\d+\.?\d*)%\)/);
  if (percentageMatch) {
    damagePercentageRange = [parseFloat(percentageMatch[1]), parseFloat(percentageMatch[2])];
    console.log(`    [parseCalculationDescription] 📊 Damage %: ${damagePercentageRange[0]}-${damagePercentageRange[1]}%`);
  }
  
  // Check for guaranteed KOs
  const guaranteedMatch = desc.match(/guaranteed (\d+)HKO/);
  if (guaranteedMatch) {
    const guaranteedHits = parseInt(guaranteedMatch[1]);
    isGuaranteedKO = true;
    koChance = 100;
    
    if (guaranteedHits === 1) ohkoChance = 100;
    else if (guaranteedHits === 2) twoHkoChance = 100;
    
    console.log(`    [parseCalculationDescription] ✅ Guaranteed ${guaranteedHits}HKO detected`);
    console.log(`    [parseCalculationDescription] → OHKO: ${ohkoChance}%, 2HKO: ${twoHkoChance}%`);
  } else {
    // Look for percentage chances (support both integer and decimal percentages)
    const ohkoMatch = desc.match(/(\d+\.?\d*)% chance to OHKO/);
    if (ohkoMatch) {
      ohkoChance = parseFloat(ohkoMatch[1]);
      console.log(`    [parseCalculationDescription] 🎯 OHKO chance: ${ohkoChance}%`);
    }
    
    const twoHkoMatch = desc.match(/(\d+\.?\d*)% chance to 2HKO/);
    if (twoHkoMatch) {
      twoHkoChance = parseFloat(twoHkoMatch[1]);
      console.log(`    [parseCalculationDescription] 🎯 2HKO chance: ${twoHkoChance}%`);
    }
    
    const koMatch = desc.match(/(\d+\.?\d*)% chance to (\d+)HKO/);
    if (koMatch) {
      koChance = parseFloat(koMatch[1]);
      console.log(`    [parseCalculationDescription] 🎯 General KO chance: ${koChance}% for ${koMatch[2]}HKO`);
    }
  }
  
  console.log(`    [parseCalculationDescription] Final result: OHKO=${ohkoChance}%, 2HKO=${twoHkoChance}%, guaranteed=${isGuaranteedKO}`);
  
  return { ohkoChance, twoHkoChance, isGuaranteedKO, koChance, damagePercentageRange };
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
      const avgDamage = (damageRange[0] + damageRange[1]) / 2;
      const minDamage = damageRange[0];
      const maxDamage = damageRange[1];
      
      console.log(`    ✅ ${actualMoveName}: ${minDamage}-${maxDamage} damage (avg: ${avgDamage.toFixed(1)}, priority: ${move.priority || 0})`);
      
      moveResults.push({
        name: actualMoveName,
        priority: move.priority || 0,
        avgDamage,
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
 * Helper: Execute a single attack
 * Returns new HP after attack
 */
function executeAttack(attacker, defender, move, currentHP) {
  if (!move) return currentHP;
  return currentHP - move.avgDamage;
}

/**
 * Helper: Select optimal move considering current HP and priority
 * 
 * Strategy:
 * 1. If a priority move can guarantee KO → use it
 * 2. Among moves that guarantee KO → use the one with highest damage
 * 3. Among moves that can potentially KO → use the one with highest max damage
 * 4. Otherwise → use move with highest average damage
 */
function selectOptimalMove(moveResults, defenderCurrentHP, needsPriority = false) {
  if (!moveResults || moveResults.length === 0) {
    return null;
  }
  
  const priorityMoves = moveResults.filter(m => m.priority > 0);
  
  // Strategy 1: Priority move that guarantees KO
  if (needsPriority && priorityMoves.length > 0) {
    const priorityKO = priorityMoves.find(m => m.minDamage >= defenderCurrentHP);
    if (priorityKO) return priorityKO;
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
      nature: userMon.nature,
      item: userMon.item,
      moves: userMon.moves
    });
    console.log(`Rival Pokemon (from static league file):`, {
      name: rivalMon.name,
      level: rivalMon.level,
      ability: rivalMon.ability,
      nature: rivalMon.nature,
      item: rivalMon.item,
      baseStats: rivalMon.stats, // Base stats from radred.fire.json (or equivalent)
      moves: rivalMon.moves?.map(m => typeof m === 'string' ? m : (m.name || m))
    });
    
    // Create Pokémon objects with proper stats
    // Note: item must be undefined (not 'none') when there's no item
    const userItem = userMon.item && userMon.item !== 'none' ? userMon.item : undefined;
    
    const userPokemon = new Pokemon(gen, userMon.name, {
      level: userMon.level || 50,
      ability: userMon.ability || undefined,
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
    const rivalAbilityName = typeof rivalMon.ability === 'object' && rivalMon.ability !== null
      ? rivalMon.ability.name
      : rivalMon.ability;
    
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
    const rivalMoves = rivalMon.moves?.map(m => typeof m === 'string' ? m : (m.name || m)) || [];
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
    
    console.log(`\n[BATTLE START]`);
    console.log(`  User: ${userMon.name} (${userCurrentHP} HP, ${userSpeed} Speed)`);
    console.log(`  Rival: ${rivalMon.name} (${rivalCurrentHP} HP, ${rivalSpeed} Speed)`);
    
    while (userCurrentHP > 0 && rivalCurrentHP > 0 && turn <= MAX_BATTLE_TURNS) {
      console.log(`\n--- Turn ${turn} ---`);
      
      // Select optimal moves for this turn
      userSelectedMove = selectOptimalMove(userMoveOptions, rivalCurrentHP, rivalSpeed > userSpeed);
      rivalSelectedMove = rivalMoveOptions.length > 0 
        ? selectOptimalMove(rivalMoveOptions, userCurrentHP, userSpeed > rivalSpeed)
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
        const newHP = executeAttack(null, null, firstAttacker.move, firstAttacker.targetHP);
        firstAttacker.setHP(newHP);
        console.log(`  ${firstAttacker.name} deals ${firstAttacker.move.avgDamage.toFixed(1)} damage → ${newHP <= 0 ? 'FAINTED!' : `${Math.max(0, newHP).toFixed(1)}/${firstAttacker.maxHP} HP`}`);
        
        if (newHP <= 0) {
          battleLog.push(`Turn ${turn}: ${firstAttacker.name}'s ${firstAttacker.move.name} wins the battle`);
          break;
        }
      }
      
      // Second attacker counterattacks (if still alive)
      if (secondAttacker.move) {
        const newHP = executeAttack(null, null, secondAttacker.move, secondAttacker.targetHP);
        secondAttacker.setHP(newHP);
        console.log(`  ${secondAttacker.name} deals ${secondAttacker.move.avgDamage.toFixed(1)} damage → ${newHP <= 0 ? 'FAINTED!' : `${Math.max(0, newHP).toFixed(1)}/${secondAttacker.maxHP} HP`}`);
        
        if (newHP <= 0) {
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
    
    // ========== STEP 3: Parse detailed data for the moves used ==========
    // Use the last selected moves from the battle simulation
    const finalUserMove = userSelectedMove || userMoveOptions[0];
    const finalRivalMove = rivalSelectedMove || (rivalMoveOptions[0] || null);
    
    const userDesc = finalUserMove?.result?.desc ? finalUserMove.result.desc() : '';
    const rivalDesc = finalRivalMove?.result?.desc ? finalRivalMove.result.desc() : '';
    
    console.log(`\n[KO CHANCE CALCULATION]`);
    console.log(`  User move: ${finalUserMove?.name || 'None'}`);
    console.log(`  User damage: ${finalUserMove?.damageRange?.[0] || 0}-${finalUserMove?.damageRange?.[1] || 0}`);
    console.log(`  Rival HP: ${rivalMaxHP}`);
    const userKOData = parseCalculationDescription(userDesc, finalUserMove?.damageRange || [0, 0], rivalMaxHP);
    
    console.log(`\n  Rival move: ${finalRivalMove?.name || 'None'}`);
    console.log(`  Rival damage: ${finalRivalMove?.damageRange?.[0] || 0}-${finalRivalMove?.damageRange?.[1] || 0}`);
    console.log(`  User HP: ${userMaxHP}`);
    const rivalKOData = parseCalculationDescription(rivalDesc, finalRivalMove?.damageRange || [0, 0], userMaxHP);
    
    // Calculate estimated turns to KO (for display purposes)
    const userHitsToKO = finalUserMove ? Math.ceil(rivalMaxHP / finalUserMove.avgDamage) : Infinity;
    const rivalHitsToKO = finalRivalMove ? Math.ceil(userMaxHP / finalRivalMove.avgDamage) : Infinity;
    
    // ========== STEP 4: Return comprehensive battle data ==========
    return {
      // Battle result
      userWins,
      battleOutcome,
      battleLog,
      turns: turn - 1,
      
      // User's attack data
      bestMove: finalUserMove?.name || 'No valid moves',
      damageRange: finalUserMove?.damageRange || [0, 0],
      damagePercentageRange: userKOData.damagePercentageRange,
      hitsToKO: userHitsToKO,
      canOHKO: userKOData.ohkoChance === 100,
      canTwoHKO: userKOData.twoHkoChance === 100,
      ohkoChance: userKOData.ohkoChance,
      twoHkoChance: userKOData.twoHkoChance,
      isGuaranteedKO: userKOData.isGuaranteedKO,
      koChance: userKOData.koChance,
      damagePercent: finalUserMove ? Math.round((finalUserMove.avgDamage / rivalMaxHP) * 100) : 0,
      
      // Rival's attack data
      rivalBestMove: finalRivalMove?.name || 'No valid moves',
      rivalDamageRange: finalRivalMove?.damageRange || [0, 0],
      rivalDamagePercentageRange: rivalKOData.damagePercentageRange,
      rivalHitsToKO: rivalHitsToKO,
      rivalCanOHKO: rivalKOData.ohkoChance === 100,
      rivalCanTwoHKO: rivalKOData.twoHkoChance === 100,
      rivalOhkoChance: rivalKOData.ohkoChance,
      rivalDamagePercent: finalRivalMove ? Math.round((finalRivalMove.avgDamage / userMaxHP) * 100) : 0,
      
      // Speed & turn order data
      userSpeed,
      rivalSpeed,
      userMovePriority: finalUserMove?.priority || 0,
      rivalMovePriority: finalRivalMove?.priority || 0,
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

