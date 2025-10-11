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
 *   rivalPokemon: [{ name, level, ability, nature, moves: [{ name, type, power, damage_class }], stats, item }]
 * }
 */

import { calculate, Pokemon, Move, Generations } from '@smogon/calc';

export async function POST({ request }) {
  try {
    const { userPokemon, rivalPokemon } = await request.json();
    
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
    
    // Calculate level cap (max level of rival Pokémon) for Nuzlocke rules
    const levelCap = Math.max(...rivalPokemon.map(p => parseInt(p.level) || 50));
    console.log(`[Level Cap] Applying Nuzlocke level cap: ${levelCap}`);
    
    // Use Generation 8 as base (similar to Radical Red mechanics)
    const gen = Generations.get(8);
    
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
          // Add OHKO/2HKO chances as percentages
          ohkoChance: matchup.canOHKO ? 100 : 0,
          twoHkoChance: matchup.canTwoHKO ? 100 : 0,
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
    console.log(`Rival Pokemon:`, {
      name: rivalMon.name,
      level: rivalMon.level,
      ability: typeof rivalMon.ability === 'object' ? rivalMon.ability.name : rivalMon.ability,
      nature: rivalMon.nature,
      item: rivalMon.item,
      moves: rivalMon.moves
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
    
    const defender = new Pokemon(gen, rivalMon.name, {
      level: parseInt(rivalMon.level) || 50,
      ability: (typeof rivalMon.ability === 'object' ? rivalMon.ability.name : rivalMon.ability) || undefined,
      nature: rivalMon.nature || 'Hardy',
      item: rivalMon.item || undefined
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
            description: result.desc()
          });
          
          // Validate that result has damage
          if (!result.damage) {
            console.log(`    ❌ No damage for this move, skipping`);
            continue;
          }
          
          const avgDamage = result.damage && typeof result.damage === 'object' 
            ? (result.damage[0] + result.damage[result.damage.length - 1]) / 2 
            : result.damage || 0;
          
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
    
    // Calculate win probability (simplified)
    const canOHKO = damageRange[0] >= defenderHP;
    const canTwoHKO = damageRange[0] * 2 >= defenderHP;
    
    console.log(`  Can OHKO: ${canOHKO}`);
    console.log(`  Can 2HKO: ${canTwoHKO}`);
    
    let winProbability = 0;
    if (canOHKO) {
      winProbability = 100;
    } else if (canTwoHKO) {
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
      hitsToKO,
      winProbability,
      canOHKO,
      canTwoHKO,
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

