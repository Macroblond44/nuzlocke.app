#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the parser functions (we'll need to extract them)
// For now, let's implement the core parsing logic directly

async function testSavParser(savFilePath) {
  console.log('🔍 [Test] Starting .sav file parsing...');
  console.log('🔍 [Test] File path:', savFilePath);
  
  try {
    // Read the .sav file
    const arrayBuffer = readFileSync(savFilePath).buffer;
    console.log('🔍 [Test] File size:', arrayBuffer.byteLength, 'bytes');
    
    // Parse the save file
    const saveData = await parseRadicalRedSave(arrayBuffer);
    console.log('🔍 [Test] Parsing complete!');
    console.log('🔍 [Test] Results:', JSON.stringify(saveData, null, 2));
    
    return saveData;
  } catch (error) {
    console.error('❌ [Test] Error parsing save file:', error);
    throw error;
  }
}

// Accurate .sav parser based on rr-pokemon-exporter Python implementation
async function parseRadicalRedSave(arrayBuffer) {
  console.log('🔍 [Test] Starting accurate Radical Red parsing...');
  
  // Constants from rr-pokemon-exporter
  const SAVE_FILE_SIZE = 128 * 1024  // 128KB
  const RTC_SAVE_SIZE = SAVE_FILE_SIZE + 0x10  // 16 bytes footer
  const SAVE_SECTION_SIZE = 0x1000  // 4096 bytes
  const SAVE_BLOCK_SIZE = 14 * 0x1000  // 14 sections of 4096 bytes each
  const PARTY_OFFSET = [0x38, 0x290]
  const POKEMON_SIZE = 0x64  // 100 bytes per Pokémon in party
  const BOXMON_SIZE = 0x3A  // 58 bytes per Pokémon in box
  
  // Validate file size
  if (arrayBuffer.byteLength === SAVE_FILE_SIZE) {
    console.log('🔍 [Test] Standard save file size detected')
  } else if (arrayBuffer.byteLength === RTC_SAVE_SIZE) {
    console.log('🔍 [Test] RTC save file size detected, trimming footer')
    arrayBuffer = arrayBuffer.slice(0, SAVE_FILE_SIZE)
  } else {
    throw new Error(`Invalid save file size: ${arrayBuffer.byteLength} bytes`)
  }
  
  const dataView = new DataView(arrayBuffer)
  
  // Split into blocks A and B
  const blockA = arrayBuffer.slice(0, SAVE_BLOCK_SIZE)
  const blockB = arrayBuffer.slice(SAVE_BLOCK_SIZE, SAVE_BLOCK_SIZE * 2)
  
  console.log('🔍 [Test] Block A size:', blockA.byteLength)
  console.log('🔍 [Test] Block B size:', blockB.byteLength)
  
  // Determine active block
  const activeBlock = determineActiveBlock(dataView)
  console.log('🔍 [Test] Active block determined:', activeBlock)
  
  // Extract Pokemon from active block
  const party = extractPartyFromBlock(activeBlock, dataView)
  const boxes = extractBoxesFromBlock(activeBlock, dataView)
  
  const saveData = {
    player: { name: 'Player', id: 0, money: 0 },
    pokemon: { party, boxes },
    gameProgress: { badges: 0, currentMap: 0, gameTime: 0 },
    items: {},
    metadata: { fileSize: arrayBuffer.byteLength, version: '4.1' }
  }
  
  console.log('🔍 [Test] Parsing complete:', saveData)
  return saveData
}

function determineActiveBlock(dataView) {
  console.log('🔍 [Test] Determining active block...')
  
  // Get save indices from both blocks
  const blockAIndex = dataView.getUint32(13 * 0x1000 + 0xFF4, true) // Section 13, offset 0xFF4
  const blockBIndex = dataView.getUint32(27 * 0x1000 + 0xFF4, true) // Section 27, offset 0xFF4
  
  console.log('🔍 [Test] Block A index:', blockAIndex)
  console.log('🔍 [Test] Block B index:', blockBIndex)
  
  if (blockAIndex === 0xFFFFFFFF && blockBIndex === 0xFFFFFFFF) {
    throw new Error('Both blocks are invalid')
  }
  
  if (blockAIndex === 0xFFFFFFFF && blockBIndex !== 0xFFFFFFFF) {
    return 'B'
  } else if (blockBIndex === 0xFFFFFFFF && blockAIndex !== 0xFFFFFFFF) {
    return 'A'
  } else if (blockAIndex >= blockBIndex) {
    return 'A'
  } else {
    return 'B'
  }
}

function extractPartyFromBlock(activeBlock, dataView) {
  console.log('🔍 [Test] Extracting party from block', activeBlock)
  const party = []
  
  // Calculate base offset for the active block
  const baseOffset = activeBlock === 'A' ? 0 : 14 * 0x1000
  
  // Extract party data from section 1
  const section1Offset = baseOffset + 1 * 0x1000
  const partyDataOffset = section1Offset + 0x38
  const partyDataLength = 0x290
  
  console.log('🔍 [Test] Party data offset:', partyDataOffset)
  
  for (let i = 0; i < 6; i++) {
    const pokemonOffset = partyDataOffset + (i * 0x64)
    
    if (pokemonOffset + 0x64 <= dataView.byteLength) {
      const species = dataView.getUint16(pokemonOffset + 0x20, true)
      const level = dataView.getUint8(pokemonOffset + 0x54)
      
      console.log(`🔍 [Test] Party slot ${i}: species=${species}, level=${level}`)
      
      if (species > 0 && species < 1000 && level > 0 && level <= 100) {
        const pokemon = {
          species,
          level,
          nickname: null,
          moves: [1, 2, 3, 4],
          nature: 'Hardy',
          isEgg: false,
          hasHiddenAbility: false,
          isValid: true
        }
        party.push(pokemon)
        console.log(`🔍 [Test] Valid Pokemon found in party slot ${i}:`, pokemon)
      }
    }
  }
  
  console.log(`🔍 [Test] Party extraction complete: ${party.length} Pokemon found`)
  return party
}

function extractBoxesFromBlock(activeBlock, dataView) {
  console.log('🔍 [Test] Extracting boxes from block', activeBlock)
  
  // Calculate base offset for the active block
  const baseOffset = activeBlock === 'A' ? 0 : 14 * 0x1000
  
  // Box sections in the correct order (from constants.py)
  const FRLG_BOX_SECTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13]
  const CFRU_BOX_SECTIONS = [30, 31, 2, 3, 0]
  
  const boxOffsets = {
    0: [0xB0, 0x77C],
    2: [0xF18, 0xFF0],
    3: [0x0, 0xCC0],
    5: [0x4, 0xFF0],
    6: [0x0, 0xFF0],
    7: [0x0, 0xFF0],
    8: [0x0, 0xFF0],
    9: [0x0, 0xFF0],
    10: [0x0, 0xFF0],
    11: [0x0, 0xFF0],
    12: [0x0, 0xFF0],
    13: [0x0, 0x1A8],
    30: [0xB0C, 0xFF0],
    31: [0x0, 0xF80]
  }
  
  // Extract vanilla boxes (FRLG_BOX_SECTIONS)
  let allBoxData = []
  
  for (const sectionId of FRLG_BOX_SECTIONS) {
    const sectionOffset = baseOffset + sectionId * 0x1000
    const [boxStart, boxLength] = boxOffsets[sectionId]
    const boxDataOffset = sectionOffset + boxStart
    const boxDataLength = boxLength
    
    console.log(`🔍 [Test] Extracting FRLG box section ${sectionId} from offset ${boxDataOffset}, length ${boxDataLength}`)
    
    // Extract the box data as raw bytes
    const boxData = new Uint8Array(dataView.buffer, boxDataOffset, boxDataLength)
    allBoxData.push(boxData)
  }
  
  // Extract CFRU boxes (CFRU_BOX_SECTIONS)
  for (const sectionId of CFRU_BOX_SECTIONS) {
    let sectionOffset, boxDataOffset, boxDataLength
    
    if (sectionId === 30 || sectionId === 31) {
      // These are in the expanded block
      sectionOffset = 28 * 0x1000 // CFRU sections start at 28
      const [boxStart, boxLength] = boxOffsets[sectionId]
      boxDataOffset = sectionOffset + boxStart
      boxDataLength = boxLength
    } else {
      // These are in the active block
      sectionOffset = baseOffset + sectionId * 0x1000
      const [boxStart, boxLength] = boxOffsets[sectionId]
      boxDataOffset = sectionOffset + boxStart
      boxDataLength = boxLength
    }
    
    console.log(`🔍 [Test] Extracting CFRU box section ${sectionId} from offset ${boxDataOffset}, length ${boxDataLength}`)
    
    // Extract the box data as raw bytes
    const boxData = new Uint8Array(dataView.buffer, boxDataOffset, boxDataLength)
    allBoxData.push(boxData)
  }
  
  // Combine all box data into one array
  const totalLength = allBoxData.reduce((sum, data) => sum + data.length, 0)
  const combinedBoxData = new Uint8Array(totalLength)
  let offset = 0
  for (const data of allBoxData) {
    combinedBoxData.set(data, offset)
    offset += data.length
  }
  
  console.log(`🔍 [Test] Combined box data length: ${combinedBoxData.length} bytes`)
  
  // Now parse Pokemon from the combined data
  const boxes = []
  let currentBox = []
  let pokemonCount = 0
  
  for (let i = 0; i < combinedBoxData.length; i += 0x3A) {
    if (i + 0x3A <= combinedBoxData.length) {
      // Create a DataView for this Pokemon's data
      const pokemonData = new DataView(combinedBoxData.buffer, combinedBoxData.byteOffset + i, 0x3A)
      
      const species = pokemonData.getUint16(0x1C, true)
      // Box Pokemon don't have level directly stored, we need to calculate it from XP
      const xp = pokemonData.getUint32(0x20, true)
      // For now, let's use a default level calculation or skip level validation
      const level = 1 // Default level for box Pokemon
      
      console.log(`🔍 [Test] Pokemon ${pokemonCount}: species=${species}, level=${level}, xp=${xp}, offset=${i}`)
      
      if (species > 0 && species < 1000) {
        const pokemon = {
          species,
          level,
          nickname: null,
          moves: [1, 2, 3, 4],
          nature: 'Hardy',
          isEgg: false,
          hasHiddenAbility: false,
          isValid: true
        }
        currentBox.push(pokemon)
        console.log(`🔍 [Test] Valid Pokemon found:`, pokemon)
      }
      
      pokemonCount++
      
      // Every 30 Pokemon, start a new box
      if (pokemonCount % 30 === 0) {
        boxes.push(currentBox)
        console.log(`🔍 [Test] Box ${boxes.length - 1} complete: ${currentBox.length} Pokemon found`)
        currentBox = []
      }
    }
  }
  
  // Add the last box if it has Pokemon
  if (currentBox.length > 0) {
    boxes.push(currentBox)
    console.log(`🔍 [Test] Final box complete: ${currentBox.length} Pokemon found`)
  }
  
  console.log(`🔍 [Test] Box extraction complete: ${boxes.length} boxes processed`)
  return boxes
}

// Load species data from the real JSON file
let speciesData = null;
try {
  const speciesJsonPath = join(__dirname, 'src/lib/data/species.json');
  const speciesJson = readFileSync(speciesJsonPath, 'utf8');
  speciesData = JSON.parse(speciesJson);
  console.log('🔍 [Test] Loaded species data:', speciesData.length, 'species');
} catch (error) {
  console.warn('⚠️ [Test] Could not load species.json, using fallback mapping');
}

function getSpeciesNameById(speciesId) {
  if (speciesData && speciesId >= 1 && speciesId <= speciesData.length) {
    return speciesData[speciesId - 1].toLowerCase(); // Convert to lowercase for consistency
  }
  
  // Fallback mapping for basic species
  const fallbackMap = {
    1: 'bulbasaur', 2: 'ivysaur', 3: 'venusaur', 4: 'charmander', 5: 'charmeleon', 6: 'charizard',
    7: 'squirtle', 8: 'wartortle', 9: 'blastoise', 10: 'caterpie', 11: 'metapod', 12: 'butterfree',
    13: 'weedle', 14: 'kakuna', 15: 'beedrill', 16: 'pidgey', 17: 'pidgeotto', 18: 'pidgeot',
    19: 'rattata', 20: 'raticate', 21: 'spearow', 22: 'fearow', 23: 'ekans', 24: 'arbok',
    25: 'pikachu', 26: 'raichu', 27: 'sandshrew', 28: 'sandslash', 29: 'nidoran-f', 30: 'nidorina',
    31: 'nidoqueen', 32: 'nidoran-m', 33: 'nidorino', 34: 'nidoking', 35: 'clefairy', 36: 'clefable',
    37: 'vulpix', 38: 'ninetales', 39: 'jigglypuff', 40: 'wigglytuff', 41: 'zubat', 42: 'golbat',
    43: 'oddish', 44: 'gloom', 45: 'vileplume', 46: 'paras', 47: 'parasect', 48: 'venonat',
    49: 'venomoth', 50: 'diglett', 51: 'dugtrio', 52: 'meowth', 53: 'persian', 54: 'psyduck',
    55: 'golduck', 56: 'mankey', 57: 'primeape', 58: 'growlithe', 59: 'arcanine', 60: 'poliwag',
    61: 'poliwhirl', 62: 'poliwrath', 63: 'abra', 64: 'kadabra', 65: 'alakazam', 66: 'machop',
    67: 'machoke', 68: 'machamp', 69: 'bellsprout', 70: 'weepinbell', 71: 'victreebel', 72: 'tentacool',
    73: 'tentacruel', 74: 'geodude', 75: 'graveler', 76: 'golem', 77: 'ponyta', 78: 'rapidash',
    79: 'slowpoke', 80: 'slowbro', 81: 'magnemite', 82: 'magneton', 83: 'farfetchd', 84: 'doduo',
    85: 'dodrio', 86: 'seel', 87: 'dewgong', 88: 'grimer', 89: 'muk', 90: 'shellder',
    91: 'cloyster', 92: 'gastly', 93: 'haunter', 94: 'gengar', 95: 'onix', 96: 'drowzee',
    97: 'hypno', 98: 'krabby', 99: 'kingler', 100: 'voltorb', 101: 'electrode', 102: 'exeggcute',
    103: 'exeggutor', 104: 'cubone', 105: 'marowak', 106: 'hitmonlee', 107: 'hitmonchan', 108: 'lickitung',
    109: 'koffing', 110: 'weezing', 111: 'rhyhorn', 112: 'rhydon', 113: 'chansey', 114: 'tangela',
    115: 'kangaskhan', 116: 'horsea', 117: 'seadra', 118: 'goldeen', 119: 'seaking', 120: 'staryu',
    121: 'starmie', 122: 'mr-mime', 123: 'scyther', 124: 'jynx', 125: 'electabuzz', 126: 'magmar',
    127: 'pinsir', 128: 'tauros', 129: 'magikarp', 130: 'gyarados', 131: 'lapras', 132: 'ditto',
    133: 'eevee', 134: 'vaporeon', 135: 'jolteon', 136: 'flareon', 137: 'porygon', 138: 'omanyte',
    139: 'omastar', 140: 'kabuto', 141: 'kabutops', 142: 'aerodactyl', 143: 'snorlax', 144: 'articuno',
    145: 'zapdos', 146: 'moltres', 147: 'dratini', 148: 'dragonair', 149: 'dragonite', 150: 'mewtwo',
    151: 'mew'
  }
  
  return fallbackMap[speciesId] || `unknown-${speciesId}`;
}

// Main execution
async function main() {
  const savFilePath = process.argv[2] || './radicalred 4.1.sav'
  
  console.log('🚀 [Test] Starting .sav parser test...')
  console.log('🚀 [Test] Looking for .sav file at:', savFilePath)
  
  try {
    const result = await testSavParser(savFilePath)
    
    console.log('\n✅ [Test] SUCCESS! Parsing completed successfully!')
    console.log('📊 [Test] Summary:')
    console.log(`   - Party Pokemon: ${result.pokemon.party.length}`)
    console.log(`   - Box Pokemon: ${result.pokemon.boxes.reduce((total, box) => total + box.length, 0)}`)
    console.log(`   - Total Pokemon: ${result.pokemon.party.length + result.pokemon.boxes.reduce((total, box) => total + box.length, 0)}`)
    
    // Show first few Pokemon found
    if (result.pokemon.party.length > 0) {
      console.log('\n🎮 [Test] Party Pokemon:')
      result.pokemon.party.forEach((pkmn, i) => {
        const speciesName = getSpeciesNameById(pkmn.species)
        console.log(`   ${i + 1}. ${speciesName} (Lv.${pkmn.level})`)
      })
    }
    
    if (result.pokemon.boxes.some(box => box.length > 0)) {
      console.log('\n📦 [Test] Box Pokemon:')
      result.pokemon.boxes.forEach((box, boxIndex) => {
        if (box.length > 0) {
          console.log(`   Box ${boxIndex}:`)
          box.forEach((pkmn, i) => {
            const speciesName = getSpeciesNameById(pkmn.species)
            console.log(`     ${i + 1}. ${speciesName} (Lv.${pkmn.level})`)
          })
        }
      })
    }
    
  } catch (error) {
    console.error('\n❌ [Test] FAILED! Error during parsing:')
    console.error(error.message)
    process.exit(1)
  }
}

// Run the test
main().catch(console.error)
