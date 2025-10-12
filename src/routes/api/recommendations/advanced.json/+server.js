/**
 * Advanced recommendation endpoint using @smogon/calc
 * 
 * Performs 1v1 damage calculations between user's Pokémon and rival Pokémon
 * to provide more accurate recommendations based on:
 * - Actual damage calculations
 * - Number of hits to KO
 * - Best move to use
 * - Win probability
 * 
 * POST /api/recommendations/advanced.json
 * Body: {
 *   userPokemon: [{ name, level, ability, nature, moves: [string], evs, ivs, item }],
 *   rivalPokemon: [{ name, level, ability, nature, moves: [{ name, type, power, damage_class }], stats (base stats), item }]
 * }
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

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { userPokemon, rivalPokemon, game } = body;
    
    console.log('[Request] Received body keys:', Object.keys(body));
    console.log('[Request] Game parameter:', game, 'Type:', typeof game);
    
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
    const genNumber = gameConfig.calcGen || 9; // Default to Gen 9 for modern romhacks
    
    console.log(`[Calculator] Using @smogon/calc with Generation ${genNumber} for game: ${game}`);
    
    // Calculate level cap (max level of rival Pokémon) for Nuzlocke rules
    const levelCap = Math.max(...rivalPokemon.map(p => parseInt(p.level) || 50));
    console.log(`[Level Cap] Applying Nuzlocke level cap: ${levelCap}`);
    
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
      
      recommendations.push({
        pokemon: userMon.name,
        level: cappedLevel, // Use capped level for display
        originalLevel: userMon.level, // Store original level for reference
        matchups: matchups, // Return ALL matchups (not just top 3)
        overallScore: calculateOverallScore(matchups)
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
 * Calculate matchup between user's Pokémon and rival's Pokémon
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
    const attacker = new Pokemon(gen, userMon.name, {
      level: userMon.level || 50,
      ability: userMon.ability || undefined,
      nature: userMon.nature || 'Hardy',
      ivs: userMon.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: userMon.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      item: userMon.item || undefined
    });
    
    console.log(`Attacker created:`, {
      name: attacker.name,
      level: attacker.level,
      ability: attacker.ability,
      nature: attacker.nature,
      item: attacker.item,
      baseStats: attacker.species.baseStats,
      ivs: attacker.ivs,
      evs: attacker.evs,
      calculatedStats: {
        hp: attacker.maxHP(),
        atk: attacker.rawStats.atk,
        def: attacker.rawStats.def,
        spa: attacker.rawStats.spa,
        spd: attacker.rawStats.spd,
        spe: attacker.rawStats.spe
      }
    });
    
    // Create defender using data from static league file (radred.fire.json or equivalent)
    // Extract ability name if it's an object
    const rivalAbilityName = typeof rivalMon.ability === 'object' && rivalMon.ability !== null
      ? rivalMon.ability.name
      : rivalMon.ability;
    
    // Extract item name if it's an object
    const rivalItemName = typeof rivalMon.item === 'object' && rivalMon.item !== null
      ? (rivalMon.item.sprite || rivalMon.item.name)
      : rivalMon.item;
    
    // Default IVs and EVs (will be overridden when we add them to league.json in the future)
    const defaultIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    const defaultEVs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    
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
    
    const defender = new Pokemon(gen, rivalMon.name, {
      level: parseInt(rivalMon.level) || 50,
      ability: rivalAbilityName || undefined,
      nature: rivalMon.nature || 'Hardy',
      ivs: rivalMon.ivs || defaultIVs,
      evs: rivalMon.evs || defaultEVs,
      item: rivalItemName || undefined,
      overrides: baseStats ? { baseStats } : undefined // Override base stats if provided
    });
    
    console.log(`Defender created:`, {
      name: defender.name,
      level: defender.level,
      ability: defender.ability,
      nature: defender.nature,
      item: defender.item,
      baseStats: defender.species.baseStats,
      ivs: defender.ivs,
      evs: defender.evs,
      calculatedStats: {
        hp: defender.maxHP(),
        atk: defender.rawStats.atk,
        def: defender.rawStats.def,
        spa: defender.rawStats.spa,
        spd: defender.rawStats.spd,
        spe: defender.rawStats.spe
      }
    });
    
    // Find best move from user's moveset
    let bestMove = null;
    let maxDamage = 0;
    let bestResult = null;
    
    if (userMon.moves && userMon.moves.length > 0) {
      for (const moveName of userMon.moves) {
        // Handle move name if it's an object or string
        const actualMoveName = typeof moveName === 'object' ? (moveName.name || moveName) : moveName;
        
        if (!actualMoveName || actualMoveName === '(No Move)') continue;
        
        try {
          const move = new Move(gen, actualMoveName);
          
          // Skip status moves (they don't deal damage)
          if (move.category === 'Status') {
            continue;
          }
          
          const result = calculate(gen, attacker, defender, move);
          
          console.log(`  Move "${actualMoveName}":`, {
            category: move.category,
            power: move.bp,
            type: move.type,
            damage: result.damage,
            damageType: typeof result.damage,
            damageIsArray: Array.isArray(result.damage),
            damageLength: result.damage?.length,
            attacker: result.attacker?.name,
            defender: result.defender?.name,
            description: result.desc ? result.desc() : 'NO DESC FUNCTION'
          });
          
          // Validate that result has damage and it's a valid array
          if (!result.damage || (Array.isArray(result.damage) && result.damage.length === 0)) {
            console.log(`    ❌ No valid damage for this move, skipping`);
            continue;
          }
          
          const avgDamage = Array.isArray(result.damage) && result.damage.length > 0
            ? (result.damage[0] + result.damage[result.damage.length - 1]) / 2 
            : (typeof result.damage === 'number' ? result.damage : 0);
          
          console.log(`    Average damage: ${avgDamage}, Max damage so far: ${maxDamage}`);
          
          if (avgDamage > maxDamage) {
            maxDamage = avgDamage;
            bestMove = actualMoveName;
            bestResult = result;
            console.log(`    ✅ New best move! ${actualMoveName} with ${avgDamage} avg damage`);
          }
        } catch (moveError) {
          console.warn(`[Matchup] Could not calculate move ${actualMoveName}:`, moveError.message);
        }
      }
    }
    
    if (!bestResult) {
      return {
        bestMove: 'No valid moves',
        damageRange: [0, 0],
        hitsToKO: Infinity,
        winProbability: 0,
        canOHKO: false,
        canTwoHKO: false
      };
    }
    
    const damage = bestResult.damage;
    const damageRange = typeof damage === 'object' ? [damage[0], damage[damage.length - 1]] : [damage, damage];
    const defenderHP = defender.maxHP();
    
    console.log(`\n📊 FINAL CALCULATION RESULTS:`);
    console.log(`  Best Move: ${bestMove}`);
    console.log(`  Damage Range: [${damageRange[0]}, ${damageRange[1]}]`);
    console.log(`  Defender HP: ${defenderHP}`);
    
    // Calculate hits to KO
    const avgDamage = (damageRange[0] + damageRange[1]) / 2;
    const hitsToKO = Math.ceil(defenderHP / avgDamage);
    
    console.log(`  Average Damage: ${avgDamage}`);
    console.log(`  Hits to KO: ${hitsToKO}`);
    
    // Calculate win probability and parse OHKO chances from description
    const canOHKO = damageRange[0] >= defenderHP;
    const canTwoHKO = damageRange[0] * 2 >= defenderHP;
    
    // Parse KO chances and damage percentages from the best result description
    let ohkoChance = 0;
    let twoHkoChance = 0;
    let isGuaranteedKO = false;
    let koChance = 0;
    let damagePercentageRange = null;
    
    if (bestResult && bestResult.desc) {
      const desc = bestResult.desc();
      console.log(`  Parsing description: "${desc}"`);
      
      // Extract damage percentage range from description (e.g., "39.4 - 47.3%")
      const percentageMatch = desc.match(/\((\d+\.?\d*) - (\d+\.?\d*)%\)/);
      if (percentageMatch) {
        const minPercent = parseFloat(percentageMatch[1]);
        const maxPercent = parseFloat(percentageMatch[2]);
        damagePercentageRange = [minPercent, maxPercent];
        console.log(`  Found damage percentage range: ${minPercent}% - ${maxPercent}%`);
      }
      
      // Check for guaranteed KOs of any type (OHKO, 2HKO, 3HKO, etc.)
      const guaranteedMatch = desc.match(/guaranteed (\d+)HKO/);
      if (guaranteedMatch) {
        const guaranteedHits = parseInt(guaranteedMatch[1]);
        isGuaranteedKO = true;
        koChance = 100;
        
        // Set specific OHKO/2HKO flags
        if (guaranteedHits === 1) {
          ohkoChance = 100;
        } else if (guaranteedHits === 2) {
          twoHkoChance = 100;
        }
        
        console.log(`  Found guaranteed ${guaranteedHits}HKO`);
      } else {
        // Look for percentage chances
        const ohkoMatch = desc.match(/(\d+)% chance to OHKO/);
        if (ohkoMatch) {
          ohkoChance = parseInt(ohkoMatch[1]);
        }
        
        const twoHkoMatch = desc.match(/(\d+)% chance to 2HKO/);
        if (twoHkoMatch) {
          twoHkoChance = parseInt(twoHkoMatch[1]);
        }
        
        // Look for other percentage chances (3HKO, 4HKO, etc.)
        const koMatch = desc.match(/(\d+)% chance to (\d+)HKO/);
        if (koMatch) {
          koChance = parseInt(koMatch[1]);
          console.log(`  Found ${koChance}% chance to ${koMatch[2]}HKO`);
        }
      }
    }
    
    console.log(`  Can OHKO: ${canOHKO}`);
    console.log(`  Can 2HKO: ${canTwoHKO}`);
    console.log(`  OHKO Chance: ${ohkoChance}%`);
    console.log(`  2HKO Chance: ${twoHkoChance}%`);
    console.log(`  Is Guaranteed KO: ${isGuaranteedKO}`);
    console.log(`  KO Chance: ${koChance}%`);
    
    let winProbability = 0;
    if (canOHKO || ohkoChance === 100 || (hitsToKO === 1 && isGuaranteedKO)) {
      winProbability = 100;
    } else if (canTwoHKO || twoHkoChance === 100 || (hitsToKO === 2 && isGuaranteedKO)) {
      winProbability = 80;
    } else if (hitsToKO <= 3) {
      winProbability = 60;
    } else if (hitsToKO <= 4) {
      winProbability = 40;
    } else {
      winProbability = 20;
    }
    
    console.log(`  Win Probability: ${winProbability}`);
    console.log(`========================================\n`);
    
    return {
      bestMove,
      damageRange,
      damagePercentageRange, // Add percentage range from description
      hitsToKO,
      winProbability,
      canOHKO: canOHKO || ohkoChance === 100,
      canTwoHKO: canTwoHKO || twoHkoChance === 100,
      ohkoChance,
      twoHkoChance,
      isGuaranteedKO,
      koChance,
      damagePercent: Math.round((avgDamage / defenderHP) * 100)
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
 * Calculate overall score for a Pokémon based on its matchups
 */
function calculateOverallScore(matchups) {
  if (!matchups || matchups.length === 0) return 0;
  
  const totalWinProb = matchups.reduce((sum, m) => sum + m.winProbability, 0);
  const avgWinProb = totalWinProb / matchups.length;
  
  // Bonus for having at least one OHKO matchup
  const hasOHKO = matchups.some(m => m.canOHKO);
  const ohkoBonus = hasOHKO ? 10 : 0;
  
  // Bonus for multiple 2HKO matchups
  const twoHKOCount = matchups.filter(m => m.canTwoHKO).length;
  const twoHKOBonus = twoHKOCount * 5;
  
  return Math.min(100, avgWinProb + ohkoBonus + twoHKOBonus);
}

