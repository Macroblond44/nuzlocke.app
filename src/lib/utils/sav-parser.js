/**
 * Radical Red Save File Parser
 * 
 * This module provides functionality to parse .sav files from Radical Red
 * and extract Pokemon data, player information, and game progress.
 * Based on the rr-pokemon-exporter project structure.
 */

// Constants from the Python project
const SAVE_FILE_SIZE = 128 * 1024; // 128KB
const SAVE_BLOCK_SIZE = 14 * 0x1000; // 14 sections of 4096 bytes each
const SAVE_SECTION_SIZE = 0x1000; // 4096 bytes
const POKEMON_SIZE = 0x64; // 100 bytes per Pokémon in party
const BOXMON_SIZE = 0x3A; // 58 bytes per Pokémon in box

// Party and box offsets
const PARTY_OFFSET = [0x38, 0x290];
const BOX_OFFSETS = {
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
  31: [0x0, 0xF80],
};

const FRLG_BOX_SECTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13];
const CFRU_BOX_SECTIONS = [30, 31, 2, 3, 0];

// Pokemon data offsets
const POKEMON_OFFSETS = {
  personal_id: [0x0, 0x4],
  nickname: [0x8, 0x12],
  species: [0x20, 0x22],
  held_item_id: [0x22, 0x24],
  evs: [0x38, 0x3E],
  ivs_data: [0x48, 0x4C],
  moves: [0x2C, 0x34],
  level: [0x54, 0x55],
};

const BOXMON_OFFSETS = {
  personal_id: [0x0, 0x4],
  nickname: [0x8, 0x12],
  species: [0x1C, 0x1E],
  held_item_id: [0x1E, 0x20],
  xp: [0x20, 0x24],
  moves: [0x27, 0x2C],
  evs: [0x2C, 0x32],
  ivs_data: [0x36, 0x3A],
};

// Nature mapping
const NATURES = {
  0: "Hardy", 1: "Lonely", 2: "Brave", 3: "Adamant", 4: "Naughty",
  5: "Bold", 6: "Docile", 7: "Relaxed", 8: "Impish", 9: "Lax",
  10: "Timid", 11: "Hasty", 12: "Serious", 13: "Jolly", 14: "Naive",
  15: "Modest", 16: "Mild", 17: "Quiet", 18: "Bashful", 19: "Rash",
  20: "Calm", 21: "Gentle", 22: "Sassy", 23: "Careful", 24: "Quirky"
};

/**
 * Parse a Radical Red .sav file and extract relevant data
 * @param {ArrayBuffer} savBuffer - The .sav file as ArrayBuffer
 * @returns {Object} Parsed save data
 */
export function parseRadicalRedSave(savBuffer) {
  const dataView = new DataView(savBuffer);
  
  // Basic validation
  if (savBuffer.byteLength < SAVE_FILE_SIZE) {
    throw new Error('Invalid save file: too small');
  }
  
  const saveData = {
    player: {},
    pokemon: {
      party: [],
      boxes: []
    },
    gameProgress: {},
    items: {},
    metadata: {
      fileSize: savBuffer.byteLength,
      version: '4.1' // Radical Red 4.1
    }
  };
  
  try {
    // Extract the active save block
    const activeBlock = getActiveBlock(dataView);
    
    // Extract player information
    saveData.player = extractPlayerInfo(activeBlock);
    
    // Extract Pokemon party (first 6 Pokemon)
    saveData.pokemon.party = extractPokemonParty(activeBlock);
    
    // Extract Pokemon boxes (PC storage)
    saveData.pokemon.boxes = extractPokemonBoxes(activeBlock);
    
    // Extract game progress
    saveData.gameProgress = extractGameProgress(activeBlock);
    
    // Extract items
    saveData.items = extractItems(activeBlock);
    
  } catch (error) {
    console.error('Error parsing save file:', error);
    throw new Error(`Failed to parse save file: ${error.message}`);
  }
  
  return saveData;
}

/**
 * Get the active save block from the save file
 * @param {DataView} dataView - DataView of the save file
 * @returns {Object} Active save block
 */
function getActiveBlock(dataView) {
  // Split the save file into two blocks
  const blockA = new DataView(dataView.buffer, 0, SAVE_BLOCK_SIZE);
  const blockB = new DataView(dataView.buffer, SAVE_BLOCK_SIZE, SAVE_BLOCK_SIZE);
  
  // Get save indices to determine which block is active
  const blockAIndex = getSaveIndex(blockA);
  const blockBIndex = getSaveIndex(blockB);
  
  // Choose active block based on save index (same logic as Python)
  if (blockAIndex === 0xFFFFFFFF && blockBIndex === 0xFFFFFFFF) {
    throw new Error("Both blocks are invalid.");
  }
  
  if (blockAIndex === 0xFFFFFFFF && blockBIndex !== 0xFFFFFFFF) {
    return blockB;
  } else if (blockBIndex === 0xFFFFFFFF && blockAIndex !== 0xFFFFFFFF) {
    return blockA;
  } else if (blockAIndex >= blockBIndex) {
    return blockA;
  } else {
    return blockB;
  }
}

/**
 * Get save index from a block
 * @param {DataView} block - Save block
 * @returns {number} Save index
 */
function getSaveIndex(block) {
  // Save index is at offset 0xFFC in each section
  return block.getUint32(0xFFC, true);
}

/**
 * Extract player information from save file
 * @param {DataView} activeBlock - Active save block
 * @returns {Object} Player information
 */
function extractPlayerInfo(activeBlock) {
  // Player name is in section 1, offset 0x2598
  const section1 = getSection(activeBlock, 1);
  const nameOffset = 0x2598;
  const playerName = decodeGBAString(section1, nameOffset, 7);
  
  // Player ID and money are in section 0
  const section0 = getSection(activeBlock, 0);
  const playerId = section0.getUint32(0x2000000, true);
  const money = section0.getUint32(0x2000004, true);
  
  return {
    name: playerName,
    id: playerId,
    money: money
  };
}

/**
 * Extract Pokemon party (first 6 Pokemon)
 * @param {DataView} activeBlock - Active save block
 * @returns {Array} Array of Pokemon data
 */
function extractPokemonParty(activeBlock) {
  const party = [];
  const section1 = getSection(activeBlock, 1);
  
  // Extract party data from section 1
  const partyData = getSlice(section1, PARTY_OFFSET[0], PARTY_OFFSET[1]);
  
  // Split into individual Pokemon (100 bytes each)
  for (let i = 0; i < 6; i++) {
    const offset = i * POKEMON_SIZE;
    if (offset + POKEMON_SIZE <= partyData.byteLength) {
      const pokemonData = new DataView(partyData.buffer, partyData.byteOffset + offset, POKEMON_SIZE);
      const pokemon = parsePartyPokemon(pokemonData);
      if (pokemon && pokemon.species !== 0) {
        party.push(pokemon);
      }
    }
  }
  
  return party;
}

/**
 * Extract Pokemon from PC boxes
 * @param {DataView} activeBlock - Active save block
 * @returns {Array} Array of Pokemon boxes
 */
function extractPokemonBoxes(activeBlock) {
  const boxes = [];
  
  // Extract vanilla boxes
  for (const sectionId of FRLG_BOX_SECTIONS) {
    const section = getSection(activeBlock, sectionId);
    const boxData = getSlice(section, BOX_OFFSETS[sectionId][0], BOX_OFFSETS[sectionId][1]);
    
    const boxPokemon = [];
    for (let i = 0; i < 30; i++) { // 30 Pokemon per box
      const offset = i * BOXMON_SIZE;
      if (offset + BOXMON_SIZE <= boxData.byteLength) {
        const pokemonData = new DataView(boxData.buffer, boxData.byteOffset + offset, BOXMON_SIZE);
        const pokemon = parseBoxPokemon(pokemonData);
        if (pokemon && pokemon.species !== 0) {
          boxPokemon.push(pokemon);
        }
      }
    }
    boxes.push(boxPokemon);
  }
  
  return boxes;
}

/**
 * Parse a Pokemon from party data
 * @param {DataView} pokemonData - Pokemon data bytes
 * @returns {Object} Parsed Pokemon data
 */
function parsePartyPokemon(pokemonData) {
  try {
    const species = pokemonData.getUint16(POKEMON_OFFSETS.species[0], true);
    const level = pokemonData.getUint8(POKEMON_OFFSETS.level[0]);
    const nickname = decodeGBAString(pokemonData, POKEMON_OFFSETS.nickname[0], 10);
    
    // Extract moves
    const moves = [];
    for (let i = 0; i < 4; i++) {
      const move = pokemonData.getUint16(POKEMON_OFFSETS.moves[0] + (i * 2), true);
      if (move !== 0) {
        moves.push(move);
      }
    }
    
    // Extract EVs
    const evs = [];
    for (let i = 0; i < 6; i++) {
      evs.push(pokemonData.getUint8(POKEMON_OFFSETS.evs[0] + i));
    }
    
    // Extract IVs and flags
    const ivsData = pokemonData.getUint32(POKEMON_OFFSETS.ivs_data[0], true);
    const ivs = unpackIVs(ivsData);
    const isEgg = (ivsData & 0x80000000) !== 0;
    const hasHiddenAbility = (ivsData & 0x40000000) !== 0;
    
    // Calculate nature from personality value
    const personalityValue = pokemonData.getUint32(POKEMON_OFFSETS.personal_id[0], true);
    const nature = personalityValue % 25;
    
    return {
      species,
      level,
      nickname: nickname || null,
      moves,
      evs,
      ivs,
      nature: NATURES[nature] || 'Hardy',
      isEgg,
      hasHiddenAbility,
      isValid: species !== 0 && level > 0 && level <= 100
    };
    
  } catch (error) {
    console.warn('Error parsing party Pokemon:', error);
    return null;
  }
}

/**
 * Parse a Pokemon from box data
 * @param {DataView} pokemonData - Pokemon data bytes
 * @returns {Object} Parsed Pokemon data
 */
function parseBoxPokemon(pokemonData) {
  try {
    const species = pokemonData.getUint16(BOXMON_OFFSETS.species[0], true);
    const xp = pokemonData.getUint32(BOXMON_OFFSETS.xp[0], true);
    const level = xpToLevel(xp);
    const nickname = decodeGBAString(pokemonData, BOXMON_OFFSETS.nickname[0], 10);
    
    // Extract moves
    const moves = [];
    for (let i = 0; i < 4; i++) {
      const move = pokemonData.getUint16(BOXMON_OFFSETS.moves[0] + (i * 2), true);
      if (move !== 0) {
        moves.push(move);
      }
    }
    
    // Extract EVs
    const evs = [];
    for (let i = 0; i < 6; i++) {
      evs.push(pokemonData.getUint8(BOXMON_OFFSETS.evs[0] + i));
    }
    
    // Extract IVs and flags
    const ivsData = pokemonData.getUint32(BOXMON_OFFSETS.ivs_data[0], true);
    const ivs = unpackIVs(ivsData);
    const isEgg = (ivsData & 0x80000000) !== 0;
    const hasHiddenAbility = (ivsData & 0x40000000) !== 0;
    
    // Calculate nature from personality value
    const personalityValue = pokemonData.getUint32(BOXMON_OFFSETS.personal_id[0], true);
    const nature = personalityValue % 25;
    
    return {
      species,
      level,
      nickname: nickname || null,
      moves,
      evs,
      ivs,
      nature: NATURES[nature] || 'Hardy',
      isEgg,
      hasHiddenAbility,
      isValid: species !== 0 && level > 0 && level <= 100
    };
    
  } catch (error) {
    console.warn('Error parsing box Pokemon:', error);
    return null;
  }
}

/**
 * Extract game progress information
 * @param {DataView} activeBlock - Active save block
 * @returns {Object} Game progress data
 */
function extractGameProgress(activeBlock) {
  const section0 = getSection(activeBlock, 0);
  
  // Badges obtained
  const badges = section0.getUint32(0x2000008, true);
  
  // Current location/map
  const currentMap = section0.getUint16(0x200000C, true);
  
  // Game time
  const gameTime = section0.getUint32(0x200000E, true);
  
  return {
    badges,
    currentMap,
    gameTime
  };
}

/**
 * Extract items from bag
 * @param {DataView} activeBlock - Active save block
 * @returns {Object} Items data
 */
function extractItems(activeBlock) {
  // Simplified - would need more complex logic for full item extraction
  return {};
}

/**
 * Get a section from the save block
 * @param {DataView} block - Save block
 * @param {number} sectionId - Section ID
 * @returns {DataView} Section data
 */
function getSection(block, sectionId) {
  const offset = sectionId * SAVE_SECTION_SIZE;
  return new DataView(block.buffer, block.byteOffset + offset, SAVE_SECTION_SIZE);
}

/**
 * Get a slice of data from a DataView
 * @param {DataView} dataView - Source DataView
 * @param {number} start - Start offset
 * @param {number} end - End offset
 * @returns {DataView} Slice of data
 */
function getSlice(dataView, start, end) {
  return new DataView(dataView.buffer, dataView.byteOffset + start, end - start);
}

/**
 * Decode GBA string from bytes
 * @param {DataView} dataView - DataView containing the string
 * @param {number} offset - String offset
 * @param {number} maxLength - Maximum length to read
 * @returns {string} Decoded string
 */
function decodeGBAString(dataView, offset, maxLength) {
  let result = '';
  for (let i = 0; i < maxLength; i++) {
    const char = dataView.getUint8(offset + i);
    if (char === 0) break;
    result += String.fromCharCode(char);
  }
  return result;
}

/**
 * Unpack IVs from packed data
 * @param {number} ivsData - Packed IV data
 * @returns {Array} Array of 6 IV values
 */
function unpackIVs(ivsData) {
  const ivs = [];
  for (let i = 0; i < 6; i++) {
    ivs.push((ivsData >> (i * 5)) & 0x1F);
  }
  return ivs;
}

/**
 * Convert XP to level (simplified)
 * @param {number} xp - Experience points
 * @returns {number} Level
 */
function xpToLevel(xp) {
  // Simplified level calculation - would need proper growth rate lookup
  if (xp < 100) return 1;
  if (xp < 300) return 2;
  if (xp < 600) return 3;
  if (xp < 1000) return 4;
  if (xp < 1500) return 5;
  if (xp < 2100) return 6;
  if (xp < 2800) return 7;
  if (xp < 3600) return 8;
  if (xp < 4500) return 9;
  if (xp < 5500) return 10;
  // Continue with more levels...
  return Math.min(Math.floor(Math.sqrt(xp / 10)), 100);
}

/**
 * Convert Pokemon species ID to name
 * @param {number} speciesId - Pokemon species ID
 * @returns {string} Pokemon name
 */
export function getPokemonName(speciesId) {
  // This would need to be mapped to actual Pokemon names
  return `Pokemon_${speciesId}`;
}

/**
 * Convert ability ID to name
 * @param {number} abilityId - Ability ID
 * @returns {string} Ability name
 */
export function getAbilityName(abilityId) {
  // This would need to be mapped to actual ability names
  return `Ability_${abilityId}`;
}

/**
 * Convert move ID to name
 * @param {number} moveId - Move ID
 * @returns {string} Move name
 */
export function getMoveName(moveId) {
  // This would need to be mapped to actual move names
  return `Move_${moveId}`;
}

/**
 * Convert nature ID to name
 * @param {number} natureId - Nature ID
 * @returns {string} Nature name
 */
export function getNatureName(natureId) {
  return NATURES[natureId] || 'Hardy';
}
