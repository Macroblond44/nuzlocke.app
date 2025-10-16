<script>
  import { createEventDispatcher, getContext } from 'svelte'
  import Icon from '@iconify/svelte/dist/OfflineIcon.svelte'
  import { File, X, Check, Error } from '$lib/components/icons/IconSet.ts'
  
  const dispatch = createEventDispatcher()
  
  export let isOpen = false
  export let gameKey = ''
  
  // Debug logging
  $: console.log('🔍 [SavImporter] Component props:', { isOpen, gameKey })
  
  // Get game context
  const { getPkmn } = getContext('game')
  
  let fileInput
  let selectedFile = null
  let isProcessing = false
  let importResults = null
  let error = null
  
  // Route assignment modal state
  let showRouteAssignment = false
  let availableRoutes = []
  let routeAssignments = {} // pokemonId -> routeName
  let pokemonValidRoutes = {} // pokemonId -> validRoutes[]
  
  // Only show for Radical Red games
  $: showImporter = isOpen && gameKey && gameKey.includes('radred')
  $: console.log('🔍 [SavImporter] showImporter calculation:', { isOpen, gameKey, showImporter })
  
  function handleFileSelect(event) {
    console.log('🔍 [SavImporter] handleFileSelect called')
    const file = event.target.files[0]
    if (file && file.name.endsWith('.sav')) {
      selectedFile = file
      error = null
      importResults = null
      console.log('🔍 [SavImporter] Valid .sav file selected:', file.name, file.size, 'bytes')
    } else {
      error = 'Please select a valid .sav file'
      console.log('🔍 [SavImporter] Invalid file selected:', file?.name)
    }
  }
  
  async function processSaveFile() {
    if (!selectedFile) return
    
    isProcessing = true
    error = null
    importResults = null
    
    try {
      console.log('🔍 [SavImporter] Starting file processing...')
      console.log('🔍 [SavImporter] File size:', selectedFile.size, 'bytes')
      
      // Use the Python parser via API
      const formData = new FormData()
      formData.append('savFile', selectedFile)
      
      console.log('🔍 [SavImporter] Calling Python parser API...')
      const response = await fetch('/api/parse-sav', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to parse save file')
      }
      
      const result = await response.json()
            console.log('🔍 [SavImporter] Python parser result:', result)
            console.log('🔍 [SavImporter] Data structure:', {
              party: result.data.party,
              boxes: result.data.boxes,
              partyLength: result.data.party?.length,
              boxesLength: result.data.boxes?.length
            })
            
            // Log first Pokemon from party to see structure
            if (result.data.party && result.data.party.length > 0) {
              console.log('🔍 [SavImporter] First party Pokemon:', result.data.party[0])
            }
            
            // Log first Pokemon from boxes to see structure
            if (result.data.boxes && result.data.boxes.length > 0 && result.data.boxes[0].length > 0) {
              console.log('🔍 [SavImporter] First box Pokemon:', result.data.boxes[0][0])
            }
            
            if (!result.success) {
              throw new Error(result.error || 'Failed to parse save file')
            }
            
            // Convert the Python parser result to our format
            const pokemonData = result.data
      
      // Convert Pokemon data to the expected format
      const convertPokemonData = (pokemonList, location) => {
        return pokemonList.map(pokemon => ({
          species_id: pokemon.species_id,
          name: pokemon.name,
          level: pokemon.level,
          nickname: pokemon.nickname || null,
          pokemon: pokemon.name || `Unknown Pokemon`, // Use the actual name from parser
          location: location,
          ability_index: pokemon.ability_index,
          ability_name: pokemon.ability_name,
          nature: pokemon.nature,
          move_ids: pokemon.move_ids,
          move_names: pokemon.move_names,
          held_item_id: pokemon.held_item_id,
          held_item_name: pokemon.held_item_name,
          ivs: pokemon.ivs,
          evs: pokemon.evs,
          isEgg: pokemon.is_egg || false,
          hasHiddenAbility: pokemon.has_hidden_ability || false,
          isValid: true
        }))
      }
      
      const partyPokemon = convertPokemonData(pokemonData.party || [], 'Party')
      const boxPokemon = convertPokemonData((pokemonData.boxes || []).flat(), 'Box')
      
      importResults = {
        player: { name: 'Player', id: 0, money: 0 },
        pokemon: partyPokemon.concat(boxPokemon),
        gameProgress: { badges: 0, currentMap: 0, gameTime: 0 },
        totalPokemon: partyPokemon.length + boxPokemon.length
      }
      
      console.log('Save file processed successfully!')
      console.log('Player:', importResults.player)
      console.log('Pokemon found:', importResults.pokemon.length)
      console.log('Party Pokemon:', pokemonData.party)
      console.log('Box Pokemon:', pokemonData.boxes)
      
    } catch (err) {
      error = `Failed to process save file: ${err.message}`
      console.error('Save file processing error:', err)
    } finally {
      isProcessing = false
    }
  }
  
  async function processSaveData(saveData) {
    const processedPokemon = []
    
    // Process party Pokemon
    for (const pokemon of saveData.pokemon.party) {
      if (pokemon.isValid) {
        const processed = await convertPokemonData(pokemon, 'party')
        if (processed) processedPokemon.push(processed)
      }
    }
    
    // Process box Pokemon
    for (const box of saveData.pokemon.boxes) {
      for (const pokemon of box) {
        if (pokemon.isValid) {
          const processed = await convertPokemonData(pokemon, 'box')
          if (processed) processedPokemon.push(processed)
        }
      }
    }
    
    return { pokemon: processedPokemon }
  }
  
  async function convertPokemonData(pokemonData, location) {
    try {
      console.log('🔍 [SavImporter] Converting Pokemon data:', pokemonData)
      
      // Convert species ID to Pokemon name
      const speciesName = getSpeciesNameById(pokemonData.species)
      if (!speciesName) {
        console.warn(`Pokemon species ${pokemonData.species} not found in species map`)
        return null
      }
      
      console.log('🔍 [SavImporter] Species name:', speciesName)
      
      // Get Pokemon data from the app's data
      const pokemonInfo = await getPkmn(speciesName)
      if (!pokemonInfo) {
        console.warn(`Pokemon ${speciesName} not found in app data`)
        return null
      }
      
      // Convert moves from IDs to names (simplified for now)
      const moveNames = pokemonData.moves.map(moveId => `Move_${moveId}`)
      
      return {
        // Basic Pokemon info
        pokemon: pokemonInfo.alias,
        nickname: pokemonData.nickname || null,
        level: pokemonData.level,
        
        // Configuration
        ability: `Ability_${pokemonData.species}`, // Simplified
        nature: pokemonData.nature,
        moves: moveNames,
        gender: null, // Would need to extract from save data
        
        // Status
        status: 1, // Captured
        death: null,
        resetd: null,
        
        // Location
        location: location,
        
        // Metadata
        isShiny: false, // Would need to extract from save data
        originalData: pokemonData
      }
      
    } catch (err) {
      console.error('Error converting Pokemon data:', err)
      return null
    }
  }
  
  async function importToApp() {
    if (importResults) {
      console.log('🔄 [SavImporter] Starting route assignment...')
      
      // Get current active game ID
      const activeGameId = localStorage.getItem('nuzlocke')
      console.log('🔍 [SavImporter] Active game ID:', activeGameId)
      
      if (!activeGameId) {
        error = 'No active game found. Please create a game first.'
        return
      }
      
      // Load available routes for Radical Red
      try {
        const response = await fetch('/api/route/radred.json')
        const routes = await response.json()
        availableRoutes = routes.filter(route => route.type === 'route')
        console.log('🔍 [SavImporter] Loaded routes:', availableRoutes.length)
        
        // Initialize route assignments and valid routes
        routeAssignments = {}
        pokemonValidRoutes = {}
        console.log('🔍 [SavImporter] importResults:', importResults)
        console.log('🔍 [SavImporter] importResults.pokemon:', importResults.pokemon)
        
        if (importResults.pokemon) {
          console.log('🔍 [SavImporter] Processing', importResults.pokemon.length, 'Pokémon')
          importResults.pokemon.forEach((pokemon, index) => {
            console.log(`🔍 [SavImporter] Pokémon ${index}:`, pokemon)
            if (pokemon && pokemon.name) {
              const pokemonId = `pokemon_${index}`
              
              // Get valid routes for this Pokemon
              const validRoutes = getValidRoutesForPokemon(pokemon.name, availableRoutes)
              pokemonValidRoutes[pokemonId] = validRoutes
              
              // Auto-assign route based on valid options
              if (validRoutes.length === 1) {
                routeAssignments[pokemonId] = validRoutes[0].name
                console.log(`🎯 [SavImporter] Auto-assigned ${pokemon.name} to ${validRoutes[0].name} (only option)`)
              } else if (index === 0 && validRoutes.some(r => r.name === 'Starter')) {
                routeAssignments[pokemonId] = 'Starter'
                console.log(`🎯 [SavImporter] Auto-assigned ${pokemon.name} to Starter (first Pokemon)`)
              } else {
                routeAssignments[pokemonId] = ''
                console.log(`🔍 [SavImporter] ${pokemon.name} has ${validRoutes.length} valid routes:`, validRoutes.map(r => r.name))
              }
            }
          })
        }
        
        // Show route assignment modal
        showRouteAssignment = true
        
      } catch (err) {
        console.error('❌ [SavImporter] Failed to load routes:', err)
        error = 'Failed to load available routes. Please try again.'
      }
    }
  }
  
  async function confirmRouteAssignments() {
    console.log('🔄 [SavImporter] Confirming route assignments...')
    
    // Get current active game ID
    const activeGameId = localStorage.getItem('nuzlocke')
    
    // Convert Pokemon data to localStorage format with assigned routes
    const gameData = {}
    
    if (importResults.pokemon) {
      for (const [index, pokemon] of importResults.pokemon.entries()) {
        if (pokemon && pokemon.name) {
          const pokemonId = `pokemon_${index}`
          const assignedRoute = routeAssignments[pokemonId]
          
          if (assignedRoute) {
            gameData[assignedRoute] = {
              pokemon: pokemon.name.toLowerCase(),
              status: 1, // Captured
              nature: pokemon.nature || 'bashful',
              ability: pokemon.ability_name || 'overgrow',
              location: assignedRoute,
              nickname: pokemon.nickname || '',
              moves: await getMoveDetails(pokemon.move_names || [])
            }
            console.log(`✅ [SavImporter] Added ${pokemon.name} to ${assignedRoute}`)
          }
        }
      }
    }
    
    // Save to localStorage
    const gameKey = `nuzlocke.${activeGameId}`
    localStorage.setItem(gameKey, JSON.stringify(gameData))
    
    console.log('✅ [SavImporter] Data saved to localStorage:', gameData)
    console.log('✅ [SavImporter] Total Pokemon imported:', Object.keys(gameData).length)
    
    // Dispatch success event
    dispatch('import', {
      success: true,
      pokemonCount: Object.keys(gameData).length,
      gameData
    })
    
    // Close both modals
    showRouteAssignment = false
    closeImporter()
  }
  
  function cancelRouteAssignment() {
    showRouteAssignment = false
    routeAssignments = {}
  }
  
  // Function to get valid routes for a Pokemon based on encounters
  function getValidRoutesForPokemon(pokemonName, allRoutes) {
    const pokemonLower = pokemonName.toLowerCase()
    const validRoutes = []
    
    // Special case for starters
    if (pokemonLower === 'piplup' || pokemonLower === 'chimchar' || pokemonLower === 'turtwig') {
      validRoutes.push({ name: 'Starter', type: 'route' })
      return validRoutes
    }
    
    // Check each route for encounters
    allRoutes.forEach(route => {
      if (route.encounters && route.encounters.includes(pokemonLower)) {
        validRoutes.push(route)
      }
    })
    
    // If no specific encounters found, allow all routes (fallback)
    if (validRoutes.length === 0) {
      console.warn(`No specific encounters found for ${pokemonName}, allowing all routes`)
      return allRoutes
    }
    
    return validRoutes
  }
  
  // Function to get complete move details from API
  async function getMoveDetails(moveNames) {
    if (!moveNames || moveNames.length === 0) return []
    
    try {
      const movePromises = moveNames.map(async (moveName) => {
        try {
          const response = await fetch(`/api/move/${moveName.toLowerCase().replace(/\s+/g, '-')}.json`)
          if (response.ok) {
            const moveData = await response.json()
            return {
              id: moveName.toLowerCase().replace(/\s+/g, '-'),
              name: moveData.name,
              type: moveData.type,
              power: moveData.power,
              accuracy: moveData.accuracy,
              pp: moveData.pp,
              damage_class: moveData.damage_class,
              priority: moveData.priority,
              effect: moveData.effect,
              level: 1 // Default level, could be enhanced later
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch move details for ${moveName}:`, error)
        }
        
        // Fallback to basic move data
        return {
          id: moveName.toLowerCase().replace(/\s+/g, '-'),
          name: moveName,
          type: 'normal',
          power: null,
          accuracy: null,
          pp: null,
          damage_class: 'status',
          priority: 0,
          effect: '',
          level: 1
        }
      })
      
      const moves = await Promise.all(movePromises)
      console.log(`✅ [SavImporter] Fetched details for ${moves.length} moves`)
      return moves
    } catch (error) {
      console.error('❌ [SavImporter] Error fetching move details:', error)
      return []
    }
  }
  
  function closeImporter() {
    console.log('🔍 [SavImporter] closeImporter called')
    isOpen = false
    selectedFile = null
    importResults = null
    error = null
    if (fileInput) fileInput.value = ''
  }
  
  function clearFile() {
    selectedFile = null
    importResults = null
    error = null
    if (fileInput) fileInput.value = ''
  }
  
  // Accurate .sav parser based on rr-pokemon-exporter Python implementation
  async function parseRadicalRedSave(arrayBuffer) {
    console.log('🔍 [SavImporter] Starting accurate Radical Red parsing...')
    
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
      console.log('🔍 [SavImporter] Standard save file size detected')
    } else if (arrayBuffer.byteLength === RTC_SAVE_SIZE) {
      console.log('🔍 [SavImporter] RTC save file size detected, trimming footer')
      arrayBuffer = arrayBuffer.slice(0, SAVE_FILE_SIZE)
    } else {
      throw new Error(`Invalid save file size: ${arrayBuffer.byteLength} bytes`)
    }
    
    const dataView = new DataView(arrayBuffer)
    
    // Split into blocks A and B
    const blockA = arrayBuffer.slice(0, SAVE_BLOCK_SIZE)
    const blockB = arrayBuffer.slice(SAVE_BLOCK_SIZE, SAVE_BLOCK_SIZE * 2)
    
    console.log('🔍 [SavImporter] Block A size:', blockA.byteLength)
    console.log('🔍 [SavImporter] Block B size:', blockB.byteLength)
    
    // Determine active block
    const activeBlock = determineActiveBlock(dataView)
    console.log('🔍 [SavImporter] Active block determined:', activeBlock)
    
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
    
    console.log('🔍 [SavImporter] Parsing complete:', saveData)
    return saveData
  }
  
  function determineActiveBlock(dataView) {
    console.log('🔍 [SavImporter] Determining active block...')
    
    // Get save indices from both blocks
    const blockAIndex = dataView.getUint32(13 * 0x1000 + 0xFF4, true) // Section 13, offset 0xFF4
    const blockBIndex = dataView.getUint32(27 * 0x1000 + 0xFF4, true) // Section 27, offset 0xFF4
    
    console.log('🔍 [SavImporter] Block A index:', blockAIndex)
    console.log('🔍 [SavImporter] Block B index:', blockBIndex)
    
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
    console.log('🔍 [SavImporter] Extracting party from block', activeBlock)
    const party = []
    
    // Calculate base offset for the active block
    const baseOffset = activeBlock === 'A' ? 0 : 14 * 0x1000
    
    // Extract party data from section 1
    const section1Offset = baseOffset + 1 * 0x1000
    const partyDataOffset = section1Offset + 0x38
    const partyDataLength = 0x290
    
    console.log('🔍 [SavImporter] Party data offset:', partyDataOffset)
    
    for (let i = 0; i < 6; i++) {
      const pokemonOffset = partyDataOffset + (i * 0x64)
      
      if (pokemonOffset + 0x64 <= dataView.byteLength) {
        const species = dataView.getUint16(pokemonOffset + 0x20, true)
        const level = dataView.getUint8(pokemonOffset + 0x54)
        
        console.log(`🔍 [SavImporter] Party slot ${i}: species=${species}, level=${level}`)
        
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
          console.log(`🔍 [SavImporter] Valid Pokemon found in party slot ${i}:`, pokemon)
        }
      }
    }
    
    console.log(`🔍 [SavImporter] Party extraction complete: ${party.length} Pokemon found`)
    return party
  }
  
  // Load species data from the real JSON file
  let speciesData = null;
  
  // Load species data on component mount
  async function loadSpeciesData() {
    try {
      const response = await fetch('/src/lib/data/species.json');
      speciesData = await response.json();
      console.log('🔍 [SavImporter] Loaded species data:', speciesData.length, 'species');
    } catch (error) {
      console.warn('⚠️ [SavImporter] Could not load species.json, using fallback mapping');
    }
  }
  
  // Load species data when component mounts
  loadSpeciesData();
  
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
  
  function extractBoxesFromBlock(activeBlock, dataView) {
    console.log('🔍 [SavImporter] Extracting boxes from block', activeBlock)
    const boxes = []
    
    // Calculate base offset for the active block
    const baseOffset = activeBlock === 'A' ? 0 : 14 * 0x1000
    
    // Box sections and offsets (from constants.py)
    const boxSections = [0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13]
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
      13: [0x0, 0x1A8]
    }
    
    for (const sectionId of boxSections) {
      const boxPokemon = []
      const sectionOffset = baseOffset + sectionId * 0x1000
      const [boxStart, boxLength] = boxOffsets[sectionId]
      
      console.log(`🔍 [SavImporter] Processing box section ${sectionId} at offset ${sectionOffset + boxStart}`)
      
      for (let slot = 0; slot < 30; slot++) {
        const pokemonOffset = sectionOffset + boxStart + (slot * 0x3A)
        
        if (pokemonOffset + 0x3A <= dataView.byteLength) {
          const species = dataView.getUint16(pokemonOffset + 0x1C, true)
          const level = dataView.getUint8(pokemonOffset + 0x33)
          
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
            boxPokemon.push(pokemon)
            console.log(`🔍 [SavImporter] Valid Pokemon found in box ${sectionId}, slot ${slot}:`, pokemon)
          }
        }
      }
      
      boxes.push(boxPokemon)
      console.log(`🔍 [SavImporter] Box ${sectionId} complete: ${boxPokemon.length} Pokemon found`)
    }
    
    console.log(`🔍 [SavImporter] Box extraction complete: ${boxes.length} boxes processed`)
    return boxes
  }
</script>

{#if showImporter}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <!-- Debug: Modal is rendering -->
    <script>
      console.log('🔍 [SavImporter] Real modal is rendering!')
    </script>
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Import Radical Red Save File
        </h2>
        <button
          on:click={closeImporter}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Icon icon={X} class="w-6 h-6" />
        </button>
      </div>
      
      <div class="space-y-4">
        <!-- File Selection -->
        <div>
          <label for="sav-file-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select .sav file
          </label>
          <div class="flex items-center space-x-4">
            <input
              id="sav-file-input"
              bind:this={fileInput}
              type="file"
              accept=".sav"
              on:change={handleFileSelect}
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {#if selectedFile}
              <button
                on:click={clearFile}
                class="text-red-500 hover:text-red-700"
              >
                <Icon icon={X} class="w-4 h-4" />
              </button>
            {/if}
          </div>
        </div>
        
        <!-- Error Display -->
        {#if error}
          <div class="bg-red-50 border border-red-200 rounded-md p-3">
            <div class="flex">
              <Icon icon={Error} class="w-5 h-5 text-red-400 mr-2" />
              <p class="text-sm text-red-800">{error}</p>
            </div>
          </div>
        {/if}
        
        <!-- Process Button -->
        {#if selectedFile && !importResults}
          <button
            on:click={processSaveFile}
            disabled={isProcessing}
            class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {#if isProcessing}
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            {:else}
              <Icon icon={File} class="w-4 h-4 mr-2" />
              Process Save File
            {/if}
          </button>
        {/if}
        
        <!-- Results Display -->
        {#if importResults}
          <div class="bg-green-50 border border-green-200 rounded-md p-4">
            <div class="flex items-center mb-2">
              <Icon icon={Check} class="w-5 h-5 text-green-400 mr-2" />
              <h3 class="text-sm font-medium text-green-800">Save file processed successfully!</h3>
            </div>
            
            <div class="text-sm text-green-700 space-y-1">
              <p><strong>Player:</strong> {importResults.player.name}</p>
              <p><strong>Pokemon found:</strong> {importResults.totalPokemon}</p>
              <p><strong>Money:</strong> {importResults.player.money.toLocaleString()}</p>
            </div>
            
            <!-- Pokemon Preview -->
            {#if importResults.pokemon.length > 0}
              <div class="mt-4">
                <h4 class="text-sm font-medium text-green-800 mb-2">Pokemon Preview:</h4>
                <div class="max-h-32 overflow-y-auto space-y-1">
                  {#each importResults.pokemon.slice(0, 10) as pokemon}
                    <div class="text-xs text-green-700 border-b border-green-200 pb-1 mb-1">
                      <div class="font-medium">{pokemon.nickname || pokemon.pokemon} (Lv.{pokemon.level}) - {pokemon.location}</div>
                      <div class="text-green-600">
                        <span class="font-medium">Ability:</span> {pokemon.ability_name || 'Unknown'} | 
                        <span class="font-medium">Nature:</span> {pokemon.nature || 'Unknown'} | 
                        <span class="font-medium">Item:</span> {pokemon.held_item_name || 'None'}
                      </div>
                      <div class="text-green-600">
                        <span class="font-medium">Moves:</span> {pokemon.move_names ? pokemon.move_names.join(', ') : 'Unknown'}
                      </div>
                    </div>
                  {/each}
                  {#if importResults.pokemon.length > 10}
                    <div class="text-xs text-green-600">... and {importResults.pokemon.length - 10} more</div>
                  {/if}
                </div>
              </div>
            {/if}
            
            <!-- Import Button -->
            <button
              on:click={importToApp}
              class="mt-4 w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center"
            >
              <Icon icon={Check} class="w-4 h-4 mr-2" />
              Import to App
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Route Assignment Modal -->
{#if showRouteAssignment}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Assign Routes to Pokémon
          </h3>
          <button
            on:click={cancelRouteAssignment}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Icon icon={X} class="w-6 h-6" />
          </button>
        </div>
        
        <div class="space-y-4 max-h-96 overflow-y-auto">
          {#if importResults && importResults.pokemon}
            {#each importResults.pokemon as pokemon, index}
              {@const pokemonId = `pokemon_${index}`}
              {#if pokemon && pokemon.name}
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div class="flex items-center space-x-4">
                    <!-- Pokemon Info -->
                    <div class="flex-1">
                      <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <span class="text-lg">🎮</span>
                        </div>
                        <div>
                          <h4 class="font-medium text-gray-900 dark:text-white">
                            {pokemon.name}
                          </h4>
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            Level {pokemon.level || 'Unknown'} • {pokemon.nature || 'Unknown'} Nature
                          </p>
                          {#if pokemon.nickname}
                            <p class="text-sm text-blue-600 dark:text-blue-400">
                              "{pokemon.nickname}"
                            </p>
                          {/if}
                        </div>
                      </div>
                    </div>
                    
                    <!-- Route Selector -->
                    <div class="flex-1">
                      <label for="route-{pokemonId}" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Capture Route
                        {#if pokemonValidRoutes[pokemonId]}
                          <span class="text-xs text-blue-600 dark:text-blue-400 ml-1">
                            ({pokemonValidRoutes[pokemonId].length} valid routes)
                          </span>
                        {/if}
                      </label>
                      <select
                        id="route-{pokemonId}"
                        bind:value={routeAssignments[pokemonId]}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select a route...</option>
                        {#each (pokemonValidRoutes[pokemonId] || availableRoutes) as route}
                          <option value={route.name}>{route.name}</option>
                        {/each}
                      </select>
                    </div>
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            on:click={cancelRouteAssignment}
            class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            on:click={confirmRouteAssignments}
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
          >
            <Icon icon={Check} class="w-4 h-4 mr-2" />
            Import Pokémon
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
