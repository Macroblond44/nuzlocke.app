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
    if (result.hitsToKO === 1) return 'OHKO'
    if (result.hitsToKO === 2) return '2HKO'
    return `${result.hitsToKO}HKO`
  }

  function formatPercentage(value) {
    return `${Math.round(value * 100)}%`
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" tabindex="-1">
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
        <!-- Boss Team Overview -->
        <div class="mb-8">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Boss Team Overview
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            {#each bossTeam as pokemon}
              <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                <PIcon name={pokemon.alias || pokemon.name} class="w-8 h-8 mx-auto mb-2" />
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {regionise(capitalise(pokemon.alias || pokemon.name))}
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400">
                  Lv. {pokemon.level || '??'}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Pokemon Analysis -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Pokemon Analysis
          </h3>
          
          {#each recommendations as pokemon, index}
            <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                  <PIcon name={pokemon.name} class="w-12 h-12" />
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

              <!-- Win/Loss Summary -->
              {#if pokemon.matchups}
                <div class="mb-4">
                  <h5 class="font-medium text-gray-900 dark:text-white mb-3">
                    Matchup Results:
                  </h5>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {#each pokemon.matchups as matchup}
                      <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                        <PIcon name={matchup.rivalPokemon} class="w-6 h-6 mx-auto mb-1" />
                        <div class="text-xs font-medium text-gray-900 dark:text-white">
                          {regionise(capitalise(matchup.rivalPokemon))}
                        </div>
                        <div class="text-xs {getWinLossIcon(matchup)} font-semibold">
                          {getWinLossText(matchup)}
                        </div>
                        {#if matchup.bestMove}
                          <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
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
                                  {getWinLossText(matchup)} • {matchup.damagePercentage}
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

                          <!-- Quick Stats -->
                          <div class="grid grid-cols-3 gap-3 text-sm">
                            <div class="text-center">
                              <div class="font-semibold text-gray-900 dark:text-white">
                                {matchup.bestMove ? capitalise(matchup.bestMove.replace(/-/g, ' ')) : 'N/A'}
                              </div>
                              <div class="text-xs text-gray-600 dark:text-gray-400">Best Move</div>
                            </div>
                            <div class="text-center">
                              <div class="font-semibold {getWinLossIcon(matchup)}">
                                {matchup.hitsToKO}
                              </div>
                              <div class="text-xs text-gray-600 dark:text-gray-400">Hits to KO</div>
                            </div>
                            <div class="text-center">
                              <div class="font-semibold text-gray-900 dark:text-white">
                                {matchup.damageRange}
                              </div>
                              <div class="text-xs text-gray-600 dark:text-gray-400">Damage Range</div>
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
                                    {calculationDetails.userAbility && typeof calculationDetails.userAbility === 'string' 
                                      ? capitalise(calculationDetails.userAbility.replace(/-/g, ' ')) 
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
                                    {calculationDetails.rivalAbility && typeof calculationDetails.rivalAbility === 'string' 
                                      ? capitalise(calculationDetails.rivalAbility.replace(/-/g, ' ')) 
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
                                  <span class="font-semibold text-green-700 dark:text-green-300">
                                    {calculationDetails.bestMove ? capitalise(calculationDetails.bestMove.replace(/-/g, ' ')) : 'N/A'}
                                  </span>
                                </div>
                                <div class="flex justify-between">
                                  <span class="text-gray-600 dark:text-gray-400">Damage Range:</span>
                                  <span class="font-medium text-gray-900 dark:text-white">{calculationDetails.damageRange}</span>
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
        <div class="mt-8 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h4 class="font-medium text-green-900 dark:text-green-100 mb-2">
            Advanced Algorithm Information
          </h4>
          <ul class="text-sm text-green-800 dark:text-green-200 space-y-1">
            <li>• <strong>Damage Calculator:</strong> Uses @smogon/calc with Radical Red 4.1 data</li>
            <li>• <strong>Data Source:</strong> npoint.io for accurate Radical Red stats, abilities, and moves</li>
            <li>• <strong>Calculation:</strong> 1v1 damage calculations considering all stats, abilities, and moves</li>
            <li>• <strong>Scoring:</strong> OHKO = 100pts, 2HKO = 50pts, fewer hits = higher score</li>
            <li>• <strong>Accuracy:</strong> Accounts for accuracy, critical hits, and damage variance</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
{/if}
