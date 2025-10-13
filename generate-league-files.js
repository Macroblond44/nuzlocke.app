#!/usr/bin/env node
/**
 * Generate Static League Files for All Games
 * 
 * This script generates optimized league files for all supported games by:
 * 1. Reading league.json (contains all trainer/leader data)
 * 2. Enriching with pokemon-data.json (correct base stats for romhacks)
 * 3. Formatting moves and abilities correctly
 * 4. Saving to static/api/league/[game].[starter].json
 * 
 * Usage: node generate-league-files.js [options]
 * 
 * Options:
 *   --game=GAME_ID          Generate files only for specific game (e.g., radred, emkaizo)
 *   --games=GAME1,GAME2     Generate files for multiple games (comma-separated)
 *   --debug, -d             Enable verbose logging
 *   --help, -h              Show this help message
 * 
 * Examples:
 *   node generate-league-files.js                              # Generate all games
 *   node generate-league-files.js --game=radred                # Only Radical Red
 *   node generate-league-files.js --games=radred,emkaizo       # Multiple games
 *   node generate-league-files.js --debug                      # With verbose output
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Pokedex from 'pokedex-promise-v2';

const P = new Pokedex();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ========== CONFIGURATION ==========

const STARTERS = ['fire', 'water', 'grass'];
const OUTPUT_DIR = join(__dirname, 'static', 'api', 'league');

// Parse command line arguments
const args = process.argv.slice(2);
const DEBUG = args.includes('--debug') || args.includes('-d');
const HELP = args.includes('--help') || args.includes('-h');

// Support both --game=radred and --games=radred,emkaizo
const singleGame = args.find(arg => arg.startsWith('--game='))?.split('=')[1];
const multipleGames = args.find(arg => arg.startsWith('--games='))?.split('=')[1];

let GAME_FILTER = null;
if (singleGame) {
  GAME_FILTER = [singleGame];
} else if (multipleGames) {
  GAME_FILTER = multipleGames.split(',').map(g => g.trim());
}

// ========== HELPER FUNCTIONS ==========

/**
 * Log message (only if debug enabled)
 */
function debug(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Capitalize first letter of each word
 */
function titleCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get Pokemon data from pokemon-data.json (stats and types)
 * 
 * @param {string} pokemonName - Pokemon name
 * @param {object} pokemonData - pokemon-data.json content
 * @param {string} game - Game identifier
 * @returns {object|null} Pokemon data with stats and types, or null
 */
function getPokemonDataFromRadRed(pokemonName, pokemonData, game) {
  // For Radical Red games, use pokemon-data.json
  if (game === 'radred' || game === 'radred_hard') {
    const species = pokemonData.radred?.species || {};
    const types = pokemonData.radred?.types || {};
    
    // Search by name or key field (key field includes regional forms like "Geodude-Alola")
    const normalizedName = pokemonName.toLowerCase().trim();
    const entry = Object.values(species).find(s => {
      const speciesName = s.name?.toLowerCase() || '';
      const speciesKey = s.key?.toLowerCase() || '';
      const speciesNormalized = speciesName.replace(/[^a-z0-9]/g, '');
      const keyNormalized = speciesKey.replace(/[^a-z0-9]/g, '');
      const searchNormalized = normalizedName.replace(/[^a-z0-9]/g, '');
      
      // Try exact match on name, exact match on key, or normalized matches
      return speciesName === normalizedName ||
             speciesKey === normalizedName ||
             speciesNormalized === searchNormalized ||
             keyNormalized === searchNormalized;
    });
    
    if (entry) {
      const result = {};
      
      // Get stats
      if (entry.stats) {
        // pokemon-data.json format: [hp, atk, def, spe, spa, spd]
        result.stats = {
          hp: entry.stats[0],
          atk: entry.stats[1],
          def: entry.stats[2],
          spa: entry.stats[4],
          spd: entry.stats[5],
          spe: entry.stats[3]
        };
      }
      
      // Get types
      if (entry.type && Array.isArray(entry.type)) {
        result.types = entry.type.map(typeId => {
          const typeData = types[typeId];
          return typeData?.name?.toLowerCase() || 'normal';
        });
      }
      
      return result;
    }
  }
  
  return null;
}

/**
 * Fetch move data from PokeAPI and format it
 * 
 * @param {string} moveName - Move name (kebab-case)
 * @returns {Promise<object>} Formatted move object with type, power, damage_class
 */
async function fetchAndFormatMove(moveName) {
  try {
    // Handle Hidden Power variants specially
    let apiMoveName = moveName;
    let hiddenPowerType = null;
    
    if (moveName.startsWith('hidden-power-')) {
      hiddenPowerType = moveName.replace('hidden-power-', '');
      apiMoveName = 'hidden-power'; // PokeAPI uses base "hidden-power"
    }
    
    const moveData = await P.getMoveByName(apiMoveName);
    
    const formattedMove = {
      name: moveData.names.find(n => n.language.name === 'en')?.name || titleCase(moveName),
      type: moveData.type?.name || null,
      power: moveData.power,
      damage_class: moveData.damage_class?.name || null,
      priority: moveData.priority || 0,
      effect: moveData.effect_entries?.find(e => e.language.name === 'en')?.short_effect || null
    };
    
    // For Hidden Power, override the name and type
    if (hiddenPowerType) {
      formattedMove.name = 'Hidden Power';
      formattedMove.type = hiddenPowerType;
    }
    
    return formattedMove;
  } catch (error) {
    debug(`    ⚠️ Failed to fetch move ${moveName} from PokeAPI:`, error.message);
    
    // Fallback: return basic formatted name
    if (moveName.startsWith('hidden-power-')) {
      const hpType = moveName.replace('hidden-power-', '');
      return {
        name: 'Hidden Power',
        type: hpType,
        power: 60,
        damage_class: 'special'
      };
    }
    
    return {
      name: titleCase(moveName),
      type: null,
      power: null,
      damage_class: null
    };
  }
}

/**
 * Fetch ability data from PokeAPI and format it
 * 
 * @param {string} abilityName - Ability name (kebab-case)
 * @returns {Promise<object>} Formatted ability object with name and effect
 */
async function fetchAndFormatAbility(abilityName) {
  if (!abilityName || abilityName === 'unknown') {
    return { name: 'Unknown', effect: null };
  }
  
  try {
    const abilityData = await P.getAbilityByName(abilityName);
    
    return {
      name: abilityData.names.find(n => n.language.name === 'en')?.name || titleCase(abilityName),
      effect: abilityData.effect_entries?.find(e => e.language.name === 'en')?.short_effect || null
    };
  } catch (error) {
    debug(`    ⚠️ Failed to fetch ability ${abilityName} from PokeAPI:`, error.message);
    
    // Fallback: return formatted name
    return {
      name: titleCase(abilityName),
      effect: null
    };
  }
}

/**
 * Fetch and format held item data from PokeAPI
 * 
 * @param {string|object} item - Item name or item object
 * @returns {Promise<object>} Formatted item object with PokeAPI data
 */
async function fetchAndFormatHeldItem(item) {
  if (!item || item === 'none') return null;
  
  // If it's already an object with effect, return as is
  if (typeof item === 'object' && item.effect) {
    return {
      sprite: item.sprite || item.name,
      name: item.name || titleCase(item.sprite || ''),
      effect: item.effect || item.description
    };
  }
  
  const itemName = typeof item === 'string' ? item : (item.name || item.sprite);
  
  try {
    const itemData = await P.getItemByName(itemName);
    
    return {
      sprite: itemName,
      name: itemData.names.find(n => n.language.name === 'en')?.name || titleCase(itemName),
      effect: itemData.effect_entries?.[0]?.short_effect || 
              itemData.flavor_text_entries?.find(entry => entry.language.name === 'en')?.text ||
              null
    };
  } catch (error) {
    debug(`    ⚠️ Failed to fetch item ${itemName} from PokeAPI:`, error.message);
    
    // Fallback: return basic formatted data
    return {
      sprite: itemName,
      name: titleCase(itemName),
      effect: null
    };
  }
}

/**
 * Enrich Pokemon data with PokeAPI data, then override stats with pokemon-data.json
 * 
 * Strategy:
 * 1. Fetch moves and abilities from PokeAPI (for type, power, damage_class, effects)
 * 2. Get base stats from pokemon-data.json (for correct romhack stats)
 * 3. Combine both (PokeAPI enrichment + pokemon-data.json stats override)
 * 
 * @param {object} pokemon - Pokemon data from league.json
 * @param {object} pokemonData - pokemon-data.json content
 * @param {string} game - Game identifier
 * @returns {Promise<object>} Enriched Pokemon data
 */
async function enrichPokemonData(pokemon, pokemonData, game) {
  debug(`  Enriching ${pokemon.name}...`);
  
  // Step 1: Fetch Pokemon from PokeAPI to get types and sprite (handles regional forms correctly)
  let pokemonTypes = pokemon.types || ['normal'];
  let pokemonSprite = pokemon.sprite || pokemon.name;
  let pokemonAlias = null;
  
  try {
    const pokeApiData = await P.getPokemonByName(pokemon.name);
    pokemonTypes = pokeApiData.types.map(t => t.type.name);
    
    // Extract sprite from PokeAPI sprites.front_default
    const spriteMatch = pokeApiData.sprites?.front_default?.match(/\/sprites\/pokemon\/([0-9]+)/);
    if (spriteMatch) {
      pokemonSprite = spriteMatch[1];
    }
    
    // Set alias if name differs from species name (for regional forms)
    if (pokeApiData.name !== pokeApiData.species?.name) {
      pokemonAlias = pokeApiData.name;
    }
    
    debug(`    Types from PokeAPI: ${pokemonTypes.join(', ')}`);
    debug(`    Sprite from PokeAPI: ${pokemonSprite}`);
    debug(`    Alias from PokeAPI: ${pokemonAlias || 'none'}`);
  } catch (error) {
    debug(`    ⚠️ Could not fetch from PokeAPI, using league.json data: ${pokemonTypes.join(', ')}`);
  }
  
  // Step 2: Fetch and enrich moves from PokeAPI
  const enrichedMoves = await Promise.all(
    (pokemon.moves || []).map(move => fetchAndFormatMove(move))
  );
  debug(`    Moves enriched: ${enrichedMoves.length}`);
  
  // Step 3: Fetch and enrich ability from PokeAPI
  const abilityName = pokemon.ability || pokemon.abilities?.[0] || 'unknown';
  const enrichedAbility = await fetchAndFormatAbility(abilityName);
  debug(`    Ability enriched: ${enrichedAbility.name}`);
  
  // Step 4: Fetch and enrich held item from PokeAPI
  const enrichedHeldItem = await fetchAndFormatHeldItem(pokemon.held);
  debug(`    Held item enriched: ${enrichedHeldItem?.name || 'none'}`);
  
  // Step 5: Get correct data from pokemon-data.json (stats and types)
  const radredData = getPokemonDataFromRadRed(pokemon.name, pokemonData, game);
  
  if (radredData?.stats) {
    debug(`    Stats from pokemon-data.json: hp=${radredData.stats.hp}, atk=${radredData.stats.atk}, def=${radredData.stats.def}, spa=${radredData.stats.spa}, spd=${radredData.stats.spd}, spe=${radredData.stats.spe}`);
  } else {
    debug(`    ⚠️ No base stats found in pokemon-data.json, using defaults`);
  }
  
  if (radredData?.types) {
    debug(`    Types from pokemon-data.json: ${radredData.types.join(', ')}`);
  }
  
  // Step 6: Combine everything
  return {
    name: pokemon.name,
    alias: pokemonAlias, // Important for frontend sprite lookup
    level: pokemon.level,
    moves: enrichedMoves,
    ability: enrichedAbility,
    held: enrichedHeldItem, // Now enriched with PokeAPI data
    nature: pokemon.nature || 'Hardy',
    evs: pokemon.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: pokemon.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    sprite: pokemonSprite, // From PokeAPI sprites
    // Use types from PokeAPI (handles regional forms correctly)
    types: pokemonTypes,
    // Stats from pokemon-data.json take priority (correct romhack stats)
    stats: radredData?.stats || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }
  };
}

/**
 * Generate league file for a specific game and starter
 * 
 * @param {string} gameId - Game ID (e.g., 'radred', 'emkaizo')
 * @param {string} starter - Starter type ('fire', 'water', 'grass')
 * @param {object} leagueData - League data from league.json
 * @param {object} pokemonData - Pokemon data from pokemon-data.json
 * @returns {Promise<object>} Generated league data
 */
async function generateLeagueData(gameId, starter, leagueData, pokemonData) {
  const gameLeague = leagueData[gameId];
  
  if (!gameLeague) {
    debug(`  ⚠️ No league data found for ${gameId}`);
    return null;
  }
  
  const output = {};
  
  for (const [leaderId, leaderData] of Object.entries(gameLeague)) {
    debug(`  Processing leader ${leaderId}: ${leaderData.name}`);
    
    const filteredPokemon = leaderData.pokemon
      .filter(p => !p.starter || starter === 'all' || p.starter === starter);
    
    // Enrich each Pokemon (async operations for PokeAPI)
    const enrichedPokemon = await Promise.all(
      filteredPokemon.map(p => enrichPokemonData(p, pokemonData, gameId))
    );
    
    output[leaderId] = {
      name: leaderData.name,
      speciality: leaderData.speciality,
      img: leaderData.img,
      pokemon: enrichedPokemon
    };
    
    debug(`    ${enrichedPokemon.length} Pokemon processed`);
  }
  
  return output;
}

/**
 * Main execution function
 */
async function main() {
  if (HELP) {
    console.log(`
Generate Static League Files for All Games

Usage: node generate-league-files.js [options]

Options:
  --game=GAME_ID          Generate files only for specific game (e.g., radred, emkaizo)
  --games=GAME1,GAME2     Generate files for multiple games (comma-separated)
  --debug, -d             Enable verbose logging
  --help, -h              Show this help message

Examples:
  node generate-league-files.js                              # Generate all games
  node generate-league-files.js --game=radred                # Only Radical Red
  node generate-league-files.js --games=radred,emkaizo       # Multiple specific games
  node generate-league-files.js --game=radred --debug        # With verbose output
  
Game IDs available: radred, emkaizo, blazingem, unbound, stormsilv, sacredgold, and more
    `);
    process.exit(0);
  }
  
  console.log('🚀 Starting league file generation...\n');
  
  try {
    // Load source data
    console.log('📥 Loading source data...');
    const leagueData = JSON.parse(readFileSync('./src/lib/data/league.json', 'utf-8'));
    const pokemonData = JSON.parse(readFileSync('./src/lib/data/pokemon-data.json', 'utf-8'));
    const gamesConfig = JSON.parse(readFileSync('./src/lib/data/games.json', 'utf-8'));
    
    console.log(`✅ Loaded league.json (${Object.keys(leagueData).length} games)`);
    console.log(`✅ Loaded pokemon-data.json`);
    console.log(`✅ Loaded games.json (${Object.keys(gamesConfig).length} games)\n`);
    
    // Ensure output directory exists
    mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // Get list of games to process
    const gamesToProcess = GAME_FILTER 
      ? GAME_FILTER
      : Object.keys(leagueData);
    
    console.log(`📋 Games to process: ${gamesToProcess.length}`);
    if (GAME_FILTER) {
      console.log(`   Filtering for: ${GAME_FILTER.join(', ')}\n`);
    } else {
      console.log(`   Processing all games\n`);
    }
    
    let totalFiles = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Process each game
    for (const gameId of gamesToProcess) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing: ${gameId}`);
      console.log('='.repeat(60));
      
      const gameInfo = gamesConfig[gameId];
      const gameLeague = leagueData[gameId];
      
      if (!gameLeague) {
        console.log(`  ⚠️ No league data found in league.json, skipping`);
        continue;
      }
      
      const leaderCount = Object.keys(gameLeague).length;
      console.log(`  Leaders found: ${leaderCount}`);
      
      // Generate for each starter
      for (const starter of STARTERS) {
        try {
          console.log(`  Generating ${gameId}.${starter}.json...`);
          
          const leagueFileData = await generateLeagueData(gameId, starter, leagueData, pokemonData);
          
          if (!leagueFileData) {
            console.log(`    ⚠️ No data generated, skipping`);
            continue;
          }
          
          const outputPath = join(OUTPUT_DIR, `${gameId}.${starter}.json`);
          const jsonString = JSON.stringify(leagueFileData, null, 2);
          writeFileSync(outputPath, jsonString, 'utf-8');
          
          const fileSize = (jsonString.length / 1024).toFixed(2);
          console.log(`    ✅ Saved: ${fileSize}KB`);
          console.log(`       ${outputPath}`);
          
          totalFiles++;
          successCount++;
        } catch (error) {
          console.error(`    ❌ Error generating ${gameId}.${starter}.json:`, error.message);
          if (DEBUG) {
            console.error(error.stack);
          }
          errorCount++;
        }
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully generated: ${successCount} files`);
    if (errorCount > 0) {
      console.log(`❌ Failed: ${errorCount} files`);
    }
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`\n🎉 League file generation complete!`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();

