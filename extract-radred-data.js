#!/usr/bin/env node
/**
 * Script to extract Pokemon data from JwowSquared's Radical Red Pokedex
 * 
 * This script:
 * 1. Downloads data.js from https://github.com/JwowSquared/Radical-Red-Pokedex
 * 2. Extracts species, abilities, and moves data
 * 3. Removes base64 sprites to reduce file size
 * 4. Saves as JSON to src/lib/data/pokemon-data.json
 * 
 * Usage: node extract-radred-data.js
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO = 'JwowSquared/Radical-Red-Pokedex';
const DATA_URL = `https://raw.githubusercontent.com/${REPO}/master/data.js`;

async function downloadAndProcessData() {
  console.log('📥 Downloading data.js from GitHub...');
  console.log(`   URL: ${DATA_URL}\n`);
  
  try {
    const response = await fetch(DATA_URL);
    const dataText = await response.text();
    
    console.log(`✅ Downloaded ${(dataText.length / 1024 / 1024).toFixed(2)}MB`);
    console.log('🔨 Processing data...\n');
    
    // Evaluate the JavaScript to get the object
    // data.js exports an object with the structure:
    // { species: {...}, abilities: {...}, moves: {...}, sprites: {...}, ... }
    const data = new Function('return ' + dataText + ';')();
    
    // Extract only the data we need (without sprites to reduce size)
    const radredData = {
      _metadata: {
        source: 'JwowSquared/Radical-Red-Pokedex',
        sourceUrl: 'https://github.com/JwowSquared/Radical-Red-Pokedex',
        extractedAt: new Date().toISOString(),
        version: 'Radical Red v4.1',
        note: 'Complete Pokemon data for Radical Red including abilities, moves, stats, and learnsets'
      },
      radred: {
        species: data.species || {},
        abilities: data.abilities || {},
        moves: data.moves || {},
        items: data.items || {},
        tmMoves: data.tmMoves || [],
        tutorMoves: data.tutorMoves || [],
        natures: data.natures || {},
        types: data.types || {},
        eggGroups: data.eggGroups || {},
        evolutions: data.evolutions || {}
      }
    };
    
    // Log statistics
    console.log('📊 Extracted data:');
    console.log(`   - Species: ${Object.keys(radredData.radred.species || {}).length}`);
    console.log(`   - Abilities: ${Object.keys(radredData.radred.abilities || {}).length}`);
    console.log(`   - Moves: ${Object.keys(radredData.radred.moves || {}).length}`);
    console.log(`   - Items: ${Object.keys(radredData.radred.items || {}).length}`);
    console.log(`   - TM Moves: ${(radredData.radred.tmMoves || []).length}`);
    console.log(`   - Tutor Moves: ${(radredData.radred.tutorMoves || []).length}`);
    console.log(`   - Natures: ${Object.keys(radredData.radred.natures || {}).length}`);
    console.log(`   - Types: ${Object.keys(radredData.radred.types || {}).length}`);
    console.log(`   - Egg Groups: ${Object.keys(radredData.radred.eggGroups || {}).length}`);
    console.log(`   - Evolutions: ${Object.keys(radredData.radred.evolutions || {}).length}\n`);
    
    // Save to file
    const outputPath = join(__dirname, 'src/lib/data/pokemon-data.json');
    const jsonString = JSON.stringify(radredData, null, 2);
    
    writeFileSync(outputPath, jsonString);
    
    const outputSize = (jsonString.length / 1024 / 1024).toFixed(2);
    console.log('✅ Data extraction complete!');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`📦 File size: ${outputSize}MB (without base64 sprites)`);
    console.log('\n💡 Structure:');
    console.log('   {');
    console.log('     "_metadata": { ... },');
    console.log('     "radred": {');
    console.log('       "species": { "bulbasaur": {...}, ... },');
    console.log('       "abilities": { "ABILITY_OVERGROW": {...}, ... },');
    console.log('       "moves": { "MOVE_TACKLE": {...}, ... },');
    console.log('       ...');
    console.log('     }');
    console.log('   }');
    console.log('\n✨ Ready to integrate into the app!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the extraction
console.log('🚀 Starting Radical Red data extraction...\n');
downloadAndProcessData();
