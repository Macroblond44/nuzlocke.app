#!/usr/bin/env node
/**
 * Script to regenerate static league JSON files for Radical Red
 * 
 * Usage: node generate-radred-league.js
 * 
 * This script:
 * 1. Fetches enriched data from the /api/battle/radred/[id] endpoint for each gym leader
 * 2. Combines all leaders into a single JSON structure
 * 3. Saves the files to static/api/league/radred.{starter}.json
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = 'http://localhost:5173';
const STARTERS = ['fire', 'water', 'grass'];

// Get all boss IDs from league.json
async function getAllBossIds() {
  const { readFileSync } = await import('fs');
  const leagueData = JSON.parse(readFileSync('./src/lib/data/league.json', 'utf-8'));
  return Object.keys(leagueData.radred || {}).sort();
}

async function fetchLeaderData(leaderId) {
  const url = `${API_BASE}/api/battle/radred/${leaderId}.json`;
  console.log(`Fetching leader ${leaderId} from ${url}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch leader ${leaderId}: ${response.statusText}`);
  }
  
  return await response.json();
}

async function generateLeagueFile(starter, bossIds) {
  console.log(`\n=== Generating radred.${starter}.json ===`);
  console.log(`Total bosses to fetch: ${bossIds.length}`);
  
  const output = {};
  let successCount = 0;
  let errorCount = 0;
  
  // Fetch all bosses
  for (const id of bossIds) {
    try {
      const leaderData = await fetchLeaderData(id);
      output[id] = leaderData;
      successCount++;
      
      // Only log every 10th boss to avoid spam
      if (successCount % 10 === 0) {
        console.log(`  Progress: ${successCount}/${bossIds.length} bosses fetched...`);
      }
    } catch (error) {
      console.error(`✗ Error fetching boss ${id}:`, error.message);
      errorCount++;
      // Continue with other bosses even if one fails
    }
  }
  
  console.log(`\n✓ Successfully fetched ${successCount}/${bossIds.length} bosses`);
  if (errorCount > 0) {
    console.log(`⚠ Failed to fetch ${errorCount} bosses`);
  }
  
  // Save to file
  const outputPath = join(__dirname, 'static', 'api', 'league', `radred.${starter}.json`);
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✓ Saved to ${outputPath}`);
  
  return output;
}

async function main() {
  console.log('Starting generation of Radical Red league files...\n');
  console.log(`API Base: ${API_BASE}\n`);
  
  try {
    // Get all boss IDs from league.json
    const bossIds = await getAllBossIds();
    console.log(`Found ${bossIds.length} bosses in league.json`);
    console.log(`Boss IDs: ${bossIds.slice(0, 10).join(', ')}... (and ${bossIds.length - 10} more)\n`);
    
    // For now, generate only for fire starter (they all use the same data)
    // We can generate for all starters if they differ
    for (const starter of STARTERS) {
      await generateLeagueFile(starter, bossIds);
    }
    
    console.log('\n✅ All league files generated successfully!');
    console.log('\nGenerated files:');
    STARTERS.forEach(starter => {
      console.log(`  - static/api/league/radred.${starter}.json`);
    });
  } catch (error) {
    console.error('\n❌ Error generating league files:', error);
    process.exit(1);
  }
}

main();

