/**
 * Script to analyze the Radical Red .sav file structure
 * This will help us find the correct offsets for Pokemon data
 */

import fs from 'fs'

const SAV_FILE = 'radicalred 4.1.sav'

function analyzeSaveFile() {
  console.log('🔍 Analyzing Radical Red save file structure...')
  
  try {
    const buffer = fs.readFileSync(SAV_FILE)
    const dataView = new DataView(buffer.buffer)
    
    console.log(`📁 File size: ${buffer.length} bytes`)
    
    // Look for common patterns in Pokemon save files
    console.log('\n🔍 Searching for Pokemon data patterns...')
    
    // Search for potential Pokemon data (non-zero values in expected ranges)
    const potentialPokemonOffsets = []
    
    for (let i = 0; i < buffer.length - 100; i += 4) {
      // Look for species IDs (1-1000 range)
      const species = dataView.getUint16(i, true)
      if (species >= 1 && species <= 1000) {
        // Check if this looks like a Pokemon data block
        const level = dataView.getUint8(i + 0x21)
        if (level >= 1 && level <= 100) {
          potentialPokemonOffsets.push({
            offset: i,
            species,
            level,
            hex: i.toString(16).padStart(8, '0')
          })
        }
      }
    }
    
    console.log(`\n🎯 Found ${potentialPokemonOffsets.length} potential Pokemon data blocks:`)
    potentialPokemonOffsets.slice(0, 20).forEach(pokemon => {
      console.log(`  Offset 0x${pokemon.hex}: Species ${pokemon.species}, Level ${pokemon.level}`)
    })
    
    // Look for player name (ASCII text)
    console.log('\n👤 Searching for player name...')
    const nameOffsets = []
    for (let i = 0; i < buffer.length - 10; i++) {
      let name = ''
      for (let j = 0; j < 10; j++) {
        const char = dataView.getUint8(i + j)
        if (char >= 32 && char <= 126) { // Printable ASCII
          name += String.fromCharCode(char)
        } else {
          break
        }
      }
      if (name.length >= 3 && name.length <= 7) {
        nameOffsets.push({ offset: i, name, hex: i.toString(16).padStart(8, '0') })
      }
    }
    
    console.log(`\n📝 Found ${nameOffsets.length} potential player names:`)
    nameOffsets.slice(0, 10).forEach(name => {
      console.log(`  Offset 0x${name.hex}: "${name.name}"`)
    })
    
    // Look for money (large numbers)
    console.log('\n💰 Searching for money values...')
    const moneyOffsets = []
    for (let i = 0; i < buffer.length - 4; i += 4) {
      const value = dataView.getUint32(i, true)
      if (value >= 1000 && value <= 999999) { // Reasonable money range
        moneyOffsets.push({ offset: i, value, hex: i.toString(16).padStart(8, '0') })
      }
    }
    
    console.log(`\n💵 Found ${moneyOffsets.length} potential money values:`)
    moneyOffsets.slice(0, 10).forEach(money => {
      console.log(`  Offset 0x${money.hex}: ${money.value.toLocaleString()}`)
    })
    
    // Look for badges (bit flags)
    console.log('\n🏆 Searching for badge data...')
    const badgeOffsets = []
    for (let i = 0; i < buffer.length - 4; i += 4) {
      const value = dataView.getUint32(i, true)
      // Badge flags are typically 1-8 bits set
      const bitCount = (value >>> 0).toString(2).split('1').length - 1
      if (bitCount >= 1 && bitCount <= 8 && value < 256) {
        badgeOffsets.push({ offset: i, value, bitCount, hex: i.toString(16).padStart(8, '0') })
      }
    }
    
    console.log(`\n🥇 Found ${badgeOffsets.length} potential badge values:`)
    badgeOffsets.slice(0, 10).forEach(badge => {
      console.log(`  Offset 0x${badge.hex}: ${badge.value} (${badge.bitCount} badges)`)
    })
    
    // Generate a summary
    console.log('\n📊 Analysis Summary:')
    console.log(`  File size: ${buffer.length} bytes`)
    console.log(`  Potential Pokemon: ${potentialPokemonOffsets.length}`)
    console.log(`  Potential names: ${nameOffsets.length}`)
    console.log(`  Potential money: ${moneyOffsets.length}`)
    console.log(`  Potential badges: ${badgeOffsets.length}`)
    
    // Save detailed results to file
    const results = {
      fileSize: buffer.length,
      potentialPokemon: potentialPokemonOffsets,
      potentialNames: nameOffsets,
      potentialMoney: moneyOffsets,
      potentialBadges: badgeOffsets
    }
    
    fs.writeFileSync('sav-analysis.json', JSON.stringify(results, null, 2))
    console.log('\n💾 Detailed analysis saved to sav-analysis.json')
    
  } catch (error) {
    console.error('❌ Error analyzing save file:', error)
  }
}

analyzeSaveFile()
