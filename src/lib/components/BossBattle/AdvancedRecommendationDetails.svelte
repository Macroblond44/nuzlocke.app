<script>
  import { PIcon } from '$c/core'
  import { capitalise, regionise } from '$utils/string'
  import { createEventDispatcher, onMount } from 'svelte'
  import { Icon } from '$c/core'
  import { X, Sword, Shield, BarChart, Info, Settings } from '$icons'

  export let recommendations = []
  export let bossTeam = []
  export let userTeam = []
  export let gameMode = 'normal'
  export const recommendationMethod = 'advanced' // This modal is only for advanced mode
  export let open = false

  const dispatch = createEventDispatcher()

  // State for showing detailed calculations
  let showDetailedCalculations = false
  let selectedPokemon = null
  let selectedRivalPokemon = null
  let loadingCalculations = false
  let calculationDetails = null

  function closeModal() {
    open = false
    dispatch('close')
    // Reset state
    showDetailedCalculations = false
    selectedPokemon = null
    selectedRivalPokemon = null
    calculationDetails = null
  }

  function toggleDetailedCalculations(pokemon) {
    if (selectedPokemon === pokemon.name) {
      selectedPokemon = null
      showDetailedCalculations = false
      calculationDetails = null
    } else {
      selectedPokemon = pokemon.name
      showDetailedCalculations = true
      calculationDetails = null
    }
  }

  function showCalculationDetails(userPokemonName, rivalPokemonName) {
    selectedRivalPokemon = rivalPokemonName
    loadingCalculations = true
    
    try {
      // Find the recommendation for this user Pokemon
      const recommendation = recommendations.find(r => (r.name === userPokemonName))
      
      if (!recommendation) {
        console.error('Could not find Pokemon data for calculation', { userPokemonName })
        calculationDetails = { error: 'Could not find Pokemon data' }
        return
      }

      // Find the matchup for this rival Pokemon
      const matchup = recommendation.matchups?.find(m => m.rivalPokemon === rivalPokemonName)

      if (!matchup) {
        console.error('Could not find matchup data', { userPokemonName, rivalPokemonName })
        calculationDetails = { error: 'Could not find matchup data' }
        return
      }

      // Set the calculation details from the existing matchup data (now includes ALL data)
      calculationDetails = {
        // User Pokémon info
        userPokemon: userPokemonName,
        userLevel: matchup.userLevel,
        userAbility: matchup.userAbility,
        userNature: matchup.userNature,
        userItem: matchup.userItem,
        userMoves: matchup.userMoves,
        // Rival Pokémon info
        rivalPokemon: rivalPokemonName,
        rivalLevel: matchup.rivalLevel,
        rivalAbility: matchup.rivalAbility,
        rivalNature: matchup.rivalNature,
        rivalItem: matchup.rivalItem,
        rivalMoves: matchup.rivalMoves,
        // Battle results
        bestMove: matchup.bestMove,
        damageRange: matchup.damageRange,
        damagePercentage: matchup.damagePercentage,
        hitsToKO: matchup.hitsToKO,
        ohkoChance: matchup.ohkoChance || 0,
        twoHkoChance: matchup.twoHkoChance || 0,
        score: matchup.score
      }

    } catch (error) {
      console.error('Error fetching calculation details:', error)
      calculationDetails = { error: error.message }
    } finally {
      loadingCalculations = false
    }
  }

  function getWinLossIcon(result) {
    if (result.hitsToKO === 1) return 'text-green-600 dark:text-green-400'
    if (result.hitsToKO === 2) return 'text-yellow-600 dark:text-yellow-400'
    if (result.hitsToKO < 5) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  function getWinLossText(result) {
    const hitsToKO = result.hitsToKO;
    
    // Use the new precise KO calculation from server
    // The server now provides accurate koChance and isGuaranteedKO
    if (result.isGuaranteedKO === true || result.koChance === 100) {
      return `guaranteed ${hitsToKO}HKO`;
    }
    
    // Handle specific hit counts with chances
    if (hitsToKO === 1) {
      if (result.ohkoChance && result.ohkoChance > 0 && result.ohkoChance < 100) {
        return `${result.ohkoChance}% chance to OHKO`
      } else if (result.ohkoChance === 100) {
        return 'guaranteed OHKO'
      } else {
        return 'OHKO'
      }
    }
    if (hitsToKO === 2) {
      if (result.twoHkoChance && result.twoHkoChance > 0 && result.twoHkoChance < 100) {
        return `${result.twoHkoChance}% chance to 2HKO`
      } else if (result.twoHkoChance === 100) {
        return 'guaranteed 2HKO'
      } else {
        return '2HKO'
      }
    }
    
    // For 3HKO, 4HKO, etc., use general koChance
    if (hitsToKO >= 3) {
      if (result.koChance && result.koChance > 0 && result.koChance < 100) {
        return `${result.koChance}% chance to ${hitsToKO}HKO`;
      } else if (result.koChance === 100) {
        return `guaranteed ${hitsToKO}HKO`;
      }
    }
    
    return `${hitsToKO}HKO`
  }

  function formatPercentage(value) {
    return `${Math.round(value * 100)}%`
  }

  function formatDamageRange(damagePercentageRange, damageRange) {
    if (damagePercentageRange) {
      // Format as "123.8 - 152.3%"
      const [min, max] = damagePercentageRange.split(',');
      return `${min} - ${max}%`;
    }
    // Fallback to HP values if no percentage range available
    return damageRange || 'N/A';
  }

  /**
   * Format move sequence for display when multiple moves are used
   * @param {Object} battleSequence - Battle sequence data from server
   * @returns {string} Formatted move sequence or single move name
   */
  function formatMoveSequence(battleSequence) {
    if (!battleSequence || !battleSequence.userMoves || battleSequence.userMoves.length === 0) {
      return 'N/A';
    }

    // If only one move was used, show just that move
    if (battleSequence.userMoves.length === 1) {
      return capitalise(battleSequence.userMoves[0].move.replace(/-/g, ' '));
    }

    // Multiple moves used - compress repeated moves for better UX
    const moveNames = battleSequence.userMoves.map(move => 
      capitalise(move.move.replace(/-/g, ' '))
    );
    
    // Compress consecutive identical moves
    const compressedSequence = [];
    let currentMove = moveNames[0];
    let count = 1;
    
    for (let i = 1; i < moveNames.length; i++) {
      if (moveNames[i] === currentMove) {
        count++;
      } else {
        // Add the current move with count if > 1
        if (count === 1) {
          compressedSequence.push(currentMove);
        } else {
          compressedSequence.push(`${currentMove} ×${count}`);
        }
        currentMove = moveNames[i];
        count = 1;
      }
    }
    
    // Add the last move
    if (count === 1) {
      compressedSequence.push(currentMove);
    } else {
      compressedSequence.push(`${currentMove} ×${count}`);
    }
    
    return compressedSequence.join(' → ');
  }

  /**
   * Get move sequence title for tooltip (shows detailed info)
   * @param {Object} battleSequence - Battle sequence data from server
   * @returns {string} Detailed move sequence info
   */
  function getMoveSequenceTitle(battleSequence) {
    if (!battleSequence || !battleSequence.userMoves || battleSequence.userMoves.length === 0) {
      return 'No moves used';
    }

    if (battleSequence.userMoves.length === 1) {
      const move = battleSequence.userMoves[0];
      return `${capitalise(move.move.replace(/-/g, ' '))} (Turn ${move.turn}, ${move.damage.toFixed(1)} damage)`;
    }

    // Multiple moves - show detailed sequence
    const detailedMoves = battleSequence.userMoves.map(move => 
      `${capitalise(move.move.replace(/-/g, ' '))} (T${move.turn}, ${move.damage.toFixed(1)}dmg)`
    );
    
    return detailedMoves.join(' → ');
  }
</script>

{#if open}
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" tabindex="-1">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto" on:click|stopPropagation>
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
                   <Icon icon={Settings} class="text-green-600 dark:text-green-400" />
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            Advanced Recommendation Analysis
          </h2>
        </div>
        <button 
          on:click={closeModal}
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Icon icon={X} class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6">

        <!-- Pokemon Analysis -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Pokemon Analysis
          </h3>
          
          
          {#each recommendations as pokemon, index}
            {@const userPokemonData = userTeam.find(p => (p.name || p.alias) === pokemon.name)}
            <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                  <PIcon name={userPokemonData?.sprite || userPokemonData?.name || pokemon.name} class="w-12 h-12" />
                  <div>
                    <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
                      {regionise(capitalise(pokemon.name))}
                    </h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      Rank #{index + 1} • Score: {pokemon.score || 'N/A'}
                    </p>
                  </div>
                </div>
                <button
                  on:click={() => toggleDetailedCalculations(pokemon)}
                  class="flex items-center gap-2 px-3 py-2 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                >
                           <Icon icon={Settings} class="w-4 h-4" />
                  {selectedPokemon === pokemon.name ? 'Hide Details' : 'Show 1v1 Analysis'}
                </button>
              </div>

              <!-- Win/Loss Summary - Enhanced -->
              {#if pokemon.matchups}
                <div class="mb-4">
                  <div class="flex items-center justify-between mb-3">
                    <h5 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <Icon icon={BarChart} class="w-4 h-4 text-purple-500" />
                      Battle Summary: {pokemon.matchups.filter(m => m.userWins).length}/{pokemon.matchups.length} Victories
                    </h5>
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {#each pokemon.matchups as matchup}
                      <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border-2 {matchup.userWins ? 'border-green-400 dark:border-green-600' : 'border-red-400 dark:border-red-600'}">
                        <div class="flex items-center gap-2 mb-2">
                          <PIcon name={matchup.rivalPokemon} class="w-6 h-6" />
                          <div class="text-xs font-bold {matchup.userWins ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                            {matchup.userWins ? '✓ WIN' : '✗ LOSS'}
                          </div>
                        </div>
                        <div class="text-xs font-medium text-gray-900 dark:text-white mb-1">
                          {regionise(capitalise(matchup.rivalPokemon))}
                        </div>
                        {#if matchup.userWins}
                          <div class="text-xs text-gray-600 dark:text-gray-400">
                            {getWinLossText(matchup)}
                          </div>
                          <div class="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                            Your HP: {matchup.userFinalHP ? Math.round(matchup.userFinalHP) : '?'}/{matchup.userMaxHP || '?'}
                          </div>
                        {:else}
                          <div class="text-xs text-red-600 dark:text-red-400">
                            KO'd in {matchup.rivalHitsToKO || '?'} hit(s)
                          </div>
                          <div class="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">
                            Rival HP: {matchup.rivalFinalHP ? Math.round(matchup.rivalFinalHP) : '?'}/{matchup.rivalMaxHP || '?'}
                          </div>
                        {/if}
                        {#if matchup.battleSequence}
                          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={getMoveSequenceTitle(matchup.battleSequence)}>
                            {formatMoveSequence(matchup.battleSequence)}
                          </div>
                        {:else if matchup.bestMove}
                          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={matchup.bestMove}>
                            {capitalise(matchup.bestMove.replace(/-/g, ' '))}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Detailed Calculations -->
              {#if selectedPokemon === pokemon.name && showDetailedCalculations}
                <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                  <h5 class="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Icon icon={Info} class="w-4 h-4 text-green-500" />
                    Detailed 1v1 Analysis for {regionise(capitalise(pokemon.name))}
                  </h5>
                  
                  {#if pokemon.matchups}
                    <div class="space-y-4">
                      {#each pokemon.matchups as matchup}
                        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-3">
                              <PIcon name={matchup.rivalPokemon} class="w-8 h-8" />
                              <div>
                                <h6 class="font-medium text-gray-900 dark:text-white">
                                  vs {regionise(capitalise(matchup.rivalPokemon))}
                                </h6>
                                <p class="text-sm text-gray-600 dark:text-gray-400">
                                  {getWinLossText(matchup)}
                                </p>
                              </div>
                            </div>
                            <button
                              on:click={() => showCalculationDetails(pokemon.name, matchup.rivalPokemon)}
                              class="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                              disabled={loadingCalculations}
                            >
                              <Icon icon={Settings} class="w-4 h-4" />
                              {loadingCalculations && selectedRivalPokemon === matchup.rivalPokemon ? 'Calculating...' : 'Show Calculations'}
                            </button>
                          </div>

                          <!-- Battle Stats Grid -->
                          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <!-- Your Attack -->
                            <div class="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                              <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Your Attack</div>
                              <div class="font-semibold text-green-600 dark:text-green-400 text-sm mb-1" title={matchup.battleSequence ? getMoveSequenceTitle(matchup.battleSequence) : ''}>
                                {matchup.battleSequence ? formatMoveSequence(matchup.battleSequence) : (matchup.bestMove ? capitalise(matchup.bestMove.replace(/-/g, ' ')) : 'N/A')}
                              </div>
                              <div class="text-xs text-gray-500 dark:text-gray-400">
                                {getWinLossText(matchup)}
                              </div>
                            </div>
                            
                            <!-- Rival Attack -->
                            <div class="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                              <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Rival Attack</div>
                              <div class="font-semibold text-red-600 dark:text-red-400 text-sm mb-1">
                                {matchup.rivalBestMove && matchup.rivalBestMove !== 'No valid moves' 
                                  ? capitalise(matchup.rivalBestMove.replace(/-/g, ' ')) 
                                  : 'None'}
                              </div>
                              {#if matchup.rivalHitsToKO && matchup.rivalHitsToKO !== Infinity}
                                <div class="text-xs text-gray-500 dark:text-gray-400">
                                  {matchup.rivalHitsToKO}HKO
                                </div>
                              {:else}
                                <div class="text-xs text-gray-500 dark:text-gray-400">Can't KO</div>
                              {/if}
                            </div>
                            
                            <!-- Turn Order -->
                            <div class="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                              <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Turn Order</div>
                              <div class="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                                {matchup.userAttacksFirst ? '⚡ You First' : '⚡ Rival First'}
                              </div>
                              <div class="text-xs text-gray-500 dark:text-gray-400">
                                Speed: {matchup.userSpeed || '?'} vs {matchup.rivalSpeed || '?'}
                              </div>
                            </div>
                            
                            <!-- Battle Outcome -->
                            <div class="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                              <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Battle Result</div>
                              {#if matchup.userWins}
                                <div class="font-semibold text-green-600 dark:text-green-400 text-sm">
                                  ✓ Victory
                                </div>
                                <div class="text-xs text-green-500 dark:text-green-400">
                                  Your HP: {matchup.userFinalHP ? Math.round(matchup.userFinalHP) : '?'}/{matchup.userMaxHP || '?'}
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400">
                                  {matchup.turns || '?'} turn(s)
                                </div>
                              {:else}
                                <div class="font-semibold text-red-600 dark:text-red-400 text-sm">
                                  ✗ Defeat
                                </div>
                                <div class="text-xs text-orange-500 dark:text-orange-400">
                                  Rival HP: {matchup.rivalFinalHP ? Math.round(matchup.rivalFinalHP) : '?'}/{matchup.rivalMaxHP || '?'}
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400">
                                  {matchup.turns || '?'} turn(s)
                                </div>
                              {/if}
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  <!-- Calculation Details Modal -->
                  {#if calculationDetails && selectedRivalPokemon}
                    <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                      <h6 class="font-medium text-blue-900 dark:text-blue-100 mb-4 text-base">
                        Calculation Details: {regionise(capitalise(pokemon.name))} vs {regionise(capitalise(selectedRivalPokemon))}
                      </h6>
                      
                      {#if calculationDetails.error}
                        <div class="text-red-600 dark:text-red-400 text-sm">
                          Error: {calculationDetails.error}
                        </div>
                      {:else}
                        <div class="space-y-4 text-sm">
                          <!-- Pokémon Information -->
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Your Pokémon -->
                            <div class="bg-white dark:bg-gray-600 p-4 rounded-lg">
                              <h7 class="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                <Icon icon={Sword} class="w-4 h-4 text-green-600" />
                                Your Pokemon
                              </h7>
                              <div class="space-y-2 text-xs">
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Name:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">{regionise(capitalise(calculationDetails.userPokemon))}</span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Level:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">{calculationDetails.userLevel || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Ability:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">
                                    {calculationDetails.userAbility 
                                      ? (typeof calculationDetails.userAbility === 'string' 
                                        ? capitalise(calculationDetails.userAbility.replace(/-/g, ' '))
                                        : capitalise(calculationDetails.userAbility.name?.replace(/-/g, ' ') || 'Unknown'))
                                      : 'N/A'}
                                  </span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Nature:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">
                                    {calculationDetails.userNature && typeof calculationDetails.userNature === 'string' 
                                      ? capitalise(calculationDetails.userNature) 
                                      : 'N/A'}
                                  </span>
                                </div>
                                {#if calculationDetails.userItem && typeof calculationDetails.userItem === 'string'}
                                  <div class="flex justify-between">
                                    <span class="text-gray-600 dark:text-gray-400">Item:</span>
                                    <span class="font-medium text-gray-900 dark:text-white">{capitalise(calculationDetails.userItem.replace(/-/g, ' '))}</span>
                                  </div>
                                {/if}
                                {#if calculationDetails.userMoves && calculationDetails.userMoves.length > 0}
                                  <div class="mt-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                                    <span class="text-gray-600 dark:text-gray-400 font-semibold">Moves:</span>
                                    <div class="mt-1 space-y-1">
                                      {#each calculationDetails.userMoves as move}
                                        <div class="text-gray-900 dark:text-white pl-2">
                                          • {typeof move === 'string' ? capitalise(move.replace(/-/g, ' ')) : (move || 'N/A')}
                                        </div>
                                      {/each}
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            </div>

                            <!-- Rival Pokémon -->
                            <div class="bg-white dark:bg-gray-600 p-4 rounded-lg">
                              <h7 class="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                <Icon icon={Shield} class="w-4 h-4 text-red-600" />
                                Rival Pokemon
                              </h7>
                              <div class="space-y-2 text-xs">
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Name:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">{regionise(capitalise(calculationDetails.rivalPokemon))}</span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Level:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">{calculationDetails.rivalLevel || 'N/A'}</span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Ability:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">
                                    {calculationDetails.rivalAbility 
                                      ? (typeof calculationDetails.rivalAbility === 'string' 
                                        ? capitalise(calculationDetails.rivalAbility.replace(/-/g, ' '))
                                        : capitalise(calculationDetails.rivalAbility.name?.replace(/-/g, ' ') || 'Unknown'))
                                      : 'N/A'}
                                  </span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Nature:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">
                                    {calculationDetails.rivalNature && typeof calculationDetails.rivalNature === 'string' 
                                      ? capitalise(calculationDetails.rivalNature) 
                                      : 'N/A'}
                                  </span>
                                </div>
                                {#if calculationDetails.rivalItem && typeof calculationDetails.rivalItem === 'string'}
                                  <div class="flex justify-between">
                                    <span class="text-gray-600 dark:text-gray-400">Item:</span>
                                    <span class="font-medium text-gray-900 dark:text-white">{capitalise(calculationDetails.rivalItem.replace(/-/g, ' '))}</span>
                                  </div>
                                {/if}
                                {#if calculationDetails.rivalMoves && calculationDetails.rivalMoves.length > 0}
                                  <div class="mt-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                                    <span class="text-gray-600 dark:text-gray-400 font-semibold">Moves:</span>
                                    <div class="mt-1 space-y-1">
                                      {#each calculationDetails.rivalMoves.slice(0, 4) as move}
                                        <div class="text-gray-900 dark:text-white pl-2">
                                          • {typeof move === 'string' ? capitalise(move.replace(/-/g, ' ')) : (move || 'N/A')}
                                        </div>
                                      {/each}
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            </div>
                          </div>
                          
                          <!-- Battle Results -->
                          <div class="bg-white dark:bg-gray-600 p-4 rounded-lg">
                            <h7 class="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                              <Icon icon={BarChart} class="w-4 h-4 text-blue-600" />
                              Battle Calculation Results
                            </h7>
                            <div class="grid grid-cols-2 gap-4 text-xs">
                              <div class="space-y-2">
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Best Move:</span>
                                  <span class="font-semibold text-green-700 dark:text-green-300" title={calculationDetails.battleSequence ? getMoveSequenceTitle(calculationDetails.battleSequence) : ''}>
                                    {calculationDetails.battleSequence ? formatMoveSequence(calculationDetails.battleSequence) : (calculationDetails.bestMove ? capitalise(calculationDetails.bestMove.replace(/-/g, ' ')) : 'N/A')}
                                  </span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Damage Range:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">{formatDamageRange(calculationDetails.damagePercentageRange, calculationDetails.damageRange)}</span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Damage %:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">{calculationDetails.damagePercentage}</span>
                                </div>
                              </div>
                              <div class="space-y-2">
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Hits to KO:</span>
                                  <span class="font-semibold {getWinLossIcon(calculationDetails)}">
                                    {calculationDetails.hitsToKO}
                                  </span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">OHKO Chance:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">
                                    {formatPercentage(calculationDetails.ohkoChance / 100)}
                                  </span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">2HKO Chance:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">
                                    {formatPercentage(calculationDetails.twoHkoChance / 100)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <!-- Calculator Info -->
                          <div class="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-3 rounded-lg border border-green-200 dark:border-green-700">
                            <div class="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <Icon icon={Info} class="w-4 h-4 text-green-600" />
                              <span>
                                This calculation uses <strong>@smogon/calc</strong> with <strong>Radical Red 4.1</strong> data from npoint.io
                              </span>
                            </div>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Algorithm Info -->
        <div class="mt-8 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border-2 border-green-200 dark:border-green-700">
          <h4 class="font-medium text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
            <Icon icon={Info} class="w-5 h-5" />
            Advanced Turn-by-Turn Battle Simulation
          </h4>
          <ul class="text-sm text-green-800 dark:text-green-200 space-y-2">
            <li>• <strong>Calculator:</strong> @smogon/calc v0.10.0 with Generation 9 data</li>
            <li>• <strong>Simulation:</strong> Full turn-by-turn 1v1 battle simulation (up to 20 turns)</li>
            <li>• <strong>Move Selection:</strong> Dynamic per-turn optimal move selection based on:
              <ul class="ml-6 mt-1 space-y-1 text-xs">
                <li>→ Priority moves that guarantee KO</li>
                <li>→ Moves that guarantee KO (min damage ≥ remaining HP)</li>
                <li>→ Moves with highest KO probability</li>
                <li>→ Highest average damage as fallback</li>
              </ul>
            </li>
            <li>• <strong>Turn Order:</strong> Determined by move priority first, then speed stat</li>
            <li>• <strong>Scoring:</strong> 1 point per victory. Total score = number of rivals defeated in 1v1</li>
            <li>• <strong>Accuracy:</strong> Considers all stats, abilities, items, natures, IVs, EVs, and Nuzlocke level caps</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
{/if}
