#!/usr/bin/env node

/**
 * Script to add natures, IVs, and EVs from npoint.io to league.json for Radical Red
 * 
 * Usage: node add-radred-natures.js
 * 
 * This script:
 * 1. Fetches Radical Red data from npoint.io
 * 2. Reads league.json
 * 3. For each Radical Red boss's Pokemon, finds matching data by name and level
 * 4. Adds nature, IVs, and EVs to the Pokemon data
 * 5. Writes updated league.json
 */

const fs = require('fs');
const path = require('path');

const NPOINT_URL = 'https://api.npoint.io/ced457ba9aa55731616c';
const LEAGUE_JSON_PATH = path.join(__dirname, 'src', 'lib', 'data', 'league.json');

// Mapping from npoint.io stat abbreviations to our format
const STAT_MAP = {
  'hp': 'hp',
  'at': 'atk',
  'df': 'def',
  'sa': 'spa',
  'sd': 'spd',
  'sp': 'spe'
};

async function fetchRadicalRedData() {
  console.log('Fetching Radical Red data from npoint.io...');
  const response = await fetch(NPOINT_URL);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`✓ Loaded data for ${Object.keys(data).length} Pokemon`);
  return data;
}

function normalizeAbility(ability) {
  if (!ability) return null;
  // Remove spaces and convert to lowercase for comparison
  return ability.toLowerCase().replace(/\s+/g, '');
}

function findMatchingTrainer(radredData, pokemonName, level, ability) {
  // Try to find the Pokemon in the data
  const pokemonData = radredData[pokemonName];
  if (!pokemonData) {
    return null;
  }
  
  // Find trainer with matching level
  const trainers = Object.entries(pokemonData);
  
  // First try exact level match
  let match = trainers.find(([trainerName, data]) => data.level === level);
  
  // If multiple matches with same level, try to match by ability
  if (ability && trainers.filter(([, data]) => data.level === level).length > 1) {
    const normalizedAbility = normalizeAbility(ability);
    match = trainers.find(([trainerName, data]) => 
      data.level === level && 
      normalizeAbility(data.ability) === normalizedAbility
    );
  }
  
  // If still no match, use first trainer with matching level
  if (!match) {
    match = trainers.find(([, data]) => data.level === level);
  }
  
  return match ? match[1] : null;
}

function convertIVsToOurFormat(npointIVs) {
  if (!npointIVs || typeof npointIVs !== 'object') {
    return null;
  }
  
  const converted = {};
  for (const [npointStat, value] of Object.entries(npointIVs)) {
    const ourStat = STAT_MAP[npointStat];
    if (ourStat) {
      converted[ourStat] = value;
    }
  }
  
  // Fill in missing IVs with 31 (default max)
  const allStats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  for (const stat of allStats) {
    if (!(stat in converted)) {
      converted[stat] = 31;
    }
  }
  
  return converted;
}

function convertEVsToOurFormat(npointEVs) {
  if (!npointEVs || typeof npointEVs !== 'object') {
    return null;
  }
  
  const converted = {};
  for (const [npointStat, value] of Object.entries(npointEVs)) {
    const ourStat = STAT_MAP[npointStat];
    if (ourStat) {
      converted[ourStat] = value;
    }
  }
  
  // Fill in missing EVs with 0 (default)
  const allStats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  for (const stat of allStats) {
    if (!(stat in converted)) {
      converted[stat] = 0;
    }
  }
  
  return converted;
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function normalizePokemonName(name) {
  // Convert from our format (e.g., "geodude-alola") to npoint format (e.g., "Geodude-Alola")
  return name
    .split('-')
    .map(part => capitalizeFirstLetter(part))
    .join('-');
}

async function main() {
  try {
    // Fetch Radical Red data
    const radredData = await fetchRadicalRedData();
    
    // Read league.json
    console.log('\nReading league.json...');
    const leagueData = JSON.parse(fs.readFileSync(LEAGUE_JSON_PATH, 'utf8'));
    
    // Find Radical Red entries
    const radredData_league = leagueData.radred;
    if (!radredData_league || typeof radredData_league !== 'object') {
      console.error('✗ No radred entries found in league.json');
      console.log('Available keys:', Object.keys(leagueData).slice(0, 10));
      process.exit(1);
    }
    
    const bossKeys = Object.keys(radredData_league);
    console.log(`✓ Found ${bossKeys.length} Radical Red boss entries\n`);
    
    let totalPokemon = 0;
    let updatedPokemon = 0;
    let notFoundPokemon = 0;
    
    // Process each boss
    for (const bossKey of bossKeys) {
      const boss = radredData_league[bossKey];
      console.log(`Processing ${boss.name} (${bossKey})...`);
      
      if (!boss.pokemon || !Array.isArray(boss.pokemon)) {
        console.log(`  ⚠ No pokemon array found, skipping`);
        continue;
      }
      
      for (const pokemon of boss.pokemon) {
        totalPokemon++;
        
        // Normalize Pokemon name for lookup
        const normalizedName = normalizePokemonName(pokemon.name);
        const level = parseInt(pokemon.level);
        
        // Find matching trainer data
        const trainerData = findMatchingTrainer(
          radredData, 
          normalizedName, 
          level,
          pokemon.ability
        );
        
        if (trainerData) {
          // Add nature
          if (trainerData.nature) {
            pokemon.nature = trainerData.nature;
          }
          
          // Add IVs
          if (trainerData.ivs) {
            pokemon.ivs = convertIVsToOurFormat(trainerData.ivs);
          }
          
          // Add EVs
          if (trainerData.evs) {
            pokemon.evs = convertEVsToOurFormat(trainerData.evs);
          }
          
          updatedPokemon++;
          console.log(`  ✓ ${pokemon.name} (L${level}): nature=${pokemon.nature || 'N/A'}, IVs=${pokemon.ivs ? 'Yes' : 'No'}, EVs=${pokemon.evs ? 'Yes' : 'No'}`);
        } else {
          notFoundPokemon++;
          console.log(`  ✗ ${pokemon.name} (L${level}): No matching data found`);
        }
      }
    }
    
    // Write updated league.json
    console.log(`\nWriting updated league.json...`);
    fs.writeFileSync(
      LEAGUE_JSON_PATH, 
      JSON.stringify(leagueData, null, 2), 
      'utf8'
    );
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✓ Successfully updated league.json`);
    console.log(`  Total Pokemon: ${totalPokemon}`);
    console.log(`  Updated: ${updatedPokemon}`);
    console.log(`  Not found: ${notFoundPokemon}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (notFoundPokemon > 0) {
      console.log(`⚠ ${notFoundPokemon} Pokemon couldn't be matched with npoint.io data`);
      console.log(`  These will use default values (Hardy nature, 31 IVs, 0 EVs)\n`);
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

