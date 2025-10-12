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
    
    // Load Radical Red preloaded data
    console.log(`[Radical Red Data] Loading preloaded trainer data...`);
    const radredResponse = await fetch('https://api.npoint.io/ced457ba9aa55731616c');
    console.log(`[Radical Red Data] Response status: ${radredResponse.status}`);
    console.log(`[Radical Red Data] Response ok: ${radredResponse.ok}`);
    
    if (!radredResponse.ok) {
      throw new Error(`Failed to fetch Radical Red data: ${radredResponse.status} ${radredResponse.statusText}`);
    }
    
    const radredData = await radredResponse.json();
    console.log(`[Radical Red Data] Data type: ${typeof radredData}`);
    console.log(`[Radical Red Data] Data keys (first 10): ${Object.keys(radredData).slice(0, 10)}`);
    console.log(`[Radical Red Data] Total keys: ${Object.keys(radredData).length}`);
    
    // Check if it has trainers property or if it's organized differently
    if (radredData.trainers) {
      console.log(`[Radical Red Data] Found trainers property with ${Object.keys(radredData.trainers).length} trainers`);
    } else {
      console.log(`[Radical Red Data] No trainers property found, data structure:`, {
        firstKey: Object.keys(radredData)[0],
        sampleValue: radredData[Object.keys(radredData)[0]]
      });
    }
    
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
        console.log(`[Matchup] Processing rival: ${rivalMon.name} (level ${rivalMon.level})`);
        const matchup = calculateMatchup(gen, userMonCapped, rivalMon, radredData);
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
function calculateMatchup(gen, userMon, rivalMon, radredData) {
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
    console.log(`Rival Pokemon (using preloaded data):`, {
      name: rivalMon.name,
      level: rivalMon.level
      // Let the calculator use its preloaded Radical Red data for ability, nature, item, moves
    });
    
    // Try to find preloaded data for this rival Pokémon
    let preloadedRivalData = null;
    console.log(`[Preloaded Data] Searching for ${rivalMon.name} in Radical Red data...`);
    
    if (radredData && typeof radredData === 'object') {
      // The data is organized by Pokémon name directly
      const pokemonName = rivalMon.name.toLowerCase();
      console.log(`[Preloaded Data] Looking for key: "${rivalMon.name}"`);
      console.log(`[Preloaded Data] Available keys include: ${Object.keys(radredData).slice(0, 20).join(', ')}...`);
      
      // Search for exact match first
      if (radredData[rivalMon.name]) {
        console.log(`[Preloaded Data] Found exact match for ${rivalMon.name}`);
        // Find the trainer that matches our level or use the first one
        const trainers = radredData[rivalMon.name];
        const trainerEntries = Object.entries(trainers);
        console.log(`[Preloaded Data] Available trainers for ${rivalMon.name}: ${trainerEntries.map(([name, data]) => `${name} (L${data.level})`).join(', ')}`);
        
        // Try to find a trainer with matching level
        let matchingTrainer = trainerEntries.find(([trainerName, data]) => 
          data.level === parseInt(rivalMon.level)
        );
        
        // If no exact level match, use the first trainer
        if (!matchingTrainer && trainerEntries.length > 0) {
          matchingTrainer = trainerEntries[0];
          console.log(`[Preloaded Data] No exact level match, using first trainer: ${matchingTrainer[0]}`);
        }
        
        if (matchingTrainer) {
          const [trainerName, data] = matchingTrainer;
          preloadedRivalData = data;
          console.log(`[Preloaded Data] Found ${rivalMon.name} (${trainerName}):`, preloadedRivalData);
        }
      } else {
        console.log(`[Preloaded Data] No exact match found for ${rivalMon.name}`);
        // Try case-insensitive search
        const lowerCaseKey = Object.keys(radredData).find(key => key.toLowerCase() === rivalMon.name.toLowerCase());
        if (lowerCaseKey) {
          console.log(`[Preloaded Data] Found case-insensitive match: ${lowerCaseKey}`);
          const trainers = radredData[lowerCaseKey];
          const trainerEntries = Object.entries(trainers);
          if (trainerEntries.length > 0) {
            const [trainerName, data] = trainerEntries[0];
            preloadedRivalData = data;
            console.log(`[Preloaded Data] Using ${lowerCaseKey} (${trainerName}):`, preloadedRivalData);
          }
        } else {
          console.log(`[Preloaded Data] No match found for ${rivalMon.name} (case-sensitive or case-insensitive)`);
        }
      }
    } else {
      console.log(`[Preloaded Data] radredData is not valid:`, { type: typeof radredData, isObject: radredData && typeof radredData === 'object' });
    }
    
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
    
    // Create defender using preloaded Radical Red data if available
    let defender;
    if (preloadedRivalData) {
      console.log(`[Preloaded Data] Using preloaded data for ${rivalMon.name}`);
      defender = new Pokemon(gen, rivalMon.name, {
        level: parseInt(rivalMon.level) || 50,
        ability: preloadedRivalData.ability || undefined,
        nature: preloadedRivalData.nature || 'Hardy',
        ivs: preloadedRivalData.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        evs: preloadedRivalData.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        item: preloadedRivalData.item || undefined
      });
      
      // Update rivalMon with preloaded moves for damage calculation
      if (preloadedRivalData.moves && Array.isArray(preloadedRivalData.moves)) {
        rivalMon.moves = preloadedRivalData.moves;
        console.log(`[Preloaded Data] Updated moves for ${rivalMon.name}:`, preloadedRivalData.moves);
      }
    } else {
      console.log(`[Preloaded Data] No preloaded data found for ${rivalMon.name}, using basic data`);
      defender = new Pokemon(gen, rivalMon.name, {
        level: parseInt(rivalMon.level) || 50
        // Use default stats if no preloaded data
      });
    }
    
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

