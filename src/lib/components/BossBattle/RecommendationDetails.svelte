<script>
  import { PIcon } from '$c/core'
  import { capitalise, regionise } from '$utils/string'
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '$c/core'
  import { X, Settings, Shield, Sword, BarChart, Info } from '$icons'

  export let recommendations = []
  export let bossTeam = []
  export let advice = {}
  export let open = false

  const dispatch = createEventDispatcher()

  // State for showing detailed calculations
  let showDetailedCalculations = false
  let selectedPokemon = null

  function closeModal() {
    open = false
    dispatch('close')
  }

  function formatScore(score) {
    return score >= 0 ? `+${score}` : `${score}`
  }

  function getScoreColor(score) {
    if (score > 0) return 'text-green-600 dark:text-green-400'
    if (score < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  function toggleDetailedCalculations(pokemon) {
    if (selectedPokemon === pokemon.name) {
      selectedPokemon = null
      showDetailedCalculations = false
    } else {
      selectedPokemon = pokemon.name
      showDetailedCalculations = true
    }
  }

  // Get offensive breakdown from pre-calculated data
  function getOffensiveBreakdown(pokemon) {
    const breakdown = pokemon.calculationDetails?.offensiveBreakdown || []
    const totalScore = pokemon.offTypeAdv || 0
    
    // Format defender types for display
    const formattedBreakdown = breakdown.map(item => ({
      ...item,
      defenderTypes: (item.defenderTypes || []).map(t => capitalise(t)).join('/')
    }))
    
    // Filter out neutral matchups if there are too many
    const myTypes = pokemon.types || []
    const shouldShowNeutral = myTypes.length * bossTeam.length <= 8
    
    return {
      breakdown: shouldShowNeutral 
        ? formattedBreakdown 
        : formattedBreakdown.filter(item => item.score !== 0),
      totalScore
    }
  }

  // Get defensive breakdown from pre-calculated data
  function getDefensiveBreakdown(pokemon) {
    const breakdown = pokemon.calculationDetails?.defensiveBreakdown || []
    const totalScore = pokemon.defTypeAdv || 0
    
    // Filter out neutral matchups if there are too many
    const shouldShowNeutral = breakdown.length <= 8
    
    return {
      breakdown: shouldShowNeutral 
        ? breakdown 
        : breakdown.filter(item => item.score !== 0),
      totalScore
    }
  }

  // Get boss team types for analysis
  function getBossTeamTypes() {
    return [...new Set(bossTeam.map(poke => poke.types || []).flat())]
  }

  // Get boss team moves for detailed analysis
  function getBossMoves() {
    return bossTeam
      .map(poke => poke.original?.moves || [])
      .flat()
      .filter(move => move.damage_class !== 'status')
  }

  // Get boss team stats for display
  function getBossStats() {
    return bossTeam.map(poke => ({
      name: poke.name || poke.alias,
      types: poke.types || [],
      moves: (poke.original?.moves || []).filter(m => m.damage_class !== 'status'),
      stats: poke.original?.stats || poke.baseStats || {}
    }))
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" on:click={closeModal}>
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" on:click|stopPropagation>
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <Icon icon={Settings} class="text-blue-600 dark:text-blue-400" />
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            Recommendation Analysis
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
        <!-- Boss Team Analysis -->
        <div class="mb-8">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Boss Team Analysis
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 class="font-medium mb-2 text-gray-900 dark:text-white">Team Weaknesses</h4>
              <div class="flex flex-wrap gap-2">
                {#each advice.weak || [] as type}
                  <span class="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-sm">
                    {type}
                  </span>
                {/each}
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 class="font-medium mb-2 text-gray-900 dark:text-white">Team Resistances</h4>
              <div class="flex flex-wrap gap-2">
                {#each advice.resist || [] as type}
                  <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm">
                    {type}
                  </span>
                {/each}
              </div>
            </div>
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
                      Rank #{index + 1}
                    </p>
                  </div>
                </div>
                <button
                  on:click={() => toggleDetailedCalculations(pokemon)}
                  class="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  <Icon icon={Settings} class="w-4 h-4" />
                  {selectedPokemon === pokemon.name ? 'Hide Details' : 'Show Calculations'}
                </button>
              </div>

              <!-- Score Breakdown -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Offensive Scores -->
                <div class="space-y-3">
                  <h5 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon icon={Sword} class="w-4 h-4 text-red-500" />
                    Offensive Analysis
                  </h5>
                  
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span>Type Advantage Score:</span>
                      <span class={getScoreColor(pokemon.offTypeAdv)}>
                        {formatScore(pokemon.offTypeAdv)}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span>Stat Advantage Score:</span>
                      <span class={getScoreColor(pokemon.offStatAdv)}>
                        {formatScore(pokemon.offStatAdv)}
                      </span>
                    </div>
                    <div class="flex justify-between font-medium">
                      <span>Total Offensive:</span>
                      <span class={getScoreColor(pokemon.offAdv)}>
                        {formatScore(pokemon.offAdv)}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Defensive Scores -->
                <div class="space-y-3">
                  <h5 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon icon={Shield} class="w-4 h-4 text-blue-500" />
                    Defensive Analysis
                  </h5>
                  
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span>Type Resistance Score:</span>
                      <span class={getScoreColor(pokemon.defTypeAdv)}>
                        {formatScore(pokemon.defTypeAdv)}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span>Stat Resistance Score:</span>
                      <span class={getScoreColor(pokemon.defStatAdv)}>
                        {formatScore(pokemon.defStatAdv)}
                      </span>
                    </div>
                    <div class="flex justify-between font-medium">
                      <span>Total Defensive:</span>
                      <span class={getScoreColor(pokemon.defAdv)}>
                        {formatScore(pokemon.defAdv)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Percentages -->
              <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <h5 class="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                  <Icon icon={BarChart} class="w-4 h-4 text-green-500" />
                  Effectiveness Percentages
                </h5>
                <div class="grid grid-cols-3 gap-4 text-sm">
                  <div class="text-center">
                    <div class="text-lg font-semibold text-green-600 dark:text-green-400">
                      {Math.round(pokemon.resistPct * 100)}%
                    </div>
                    <div class="text-gray-600 dark:text-gray-400">Resistant</div>
                  </div>
                  <div class="text-center">
                    <div class="text-lg font-semibold text-red-600 dark:text-red-400">
                      {Math.round(pokemon.weakPct * 100)}%
                    </div>
                    <div class="text-gray-600 dark:text-gray-400">Weak</div>
                  </div>
                  <div class="text-center">
                    <div class="text-lg font-semibold text-purple-600 dark:text-purple-400">
                      {Math.round(pokemon.immunePct * 100)}%
                    </div>
                    <div class="text-gray-600 dark:text-gray-400">Immune</div>
                  </div>
                </div>
              </div>

                    <!-- Detailed Calculations -->
                    {#if selectedPokemon === pokemon.name && showDetailedCalculations}
                      {@const offTypeCalc = getOffensiveBreakdown(pokemon)}
                      {@const defTypeCalc = getDefensiveBreakdown(pokemon)}
                
                <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                  <h5 class="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Icon icon={Info} class="w-4 h-4 text-blue-500" />
                    Detailed Calculations for {regionise(capitalise(pokemon.name))}
                  </h5>
                  
                  <div class="space-y-6">
                    <!-- Offensive Type Advantage Calculations -->
                    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <h6 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Icon icon={Sword} class="w-4 h-4 text-red-500" />
                        Offensive Type Advantage: {formatScore(pokemon.offTypeAdv)}
                      </h6>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        <strong>Your types:</strong> {(pokemon.types || []).map(t => capitalise(t)).join(', ') || 'Unknown'}
                      </p>
                      
                      {#if offTypeCalc.breakdown.length > 0}
                        <div class="space-y-1">
                          {#each offTypeCalc.breakdown as calc}
                            <div class="flex justify-between items-center p-2 bg-white dark:bg-gray-600 rounded text-xs">
                              <span class="text-gray-700 dark:text-gray-300">
                                <span class="font-medium">{capitalise(calc.attackType)}</span> vs <strong>{regionise(capitalise(calc.defenderName))}</strong> <span class="text-gray-500">({calc.defenderTypes})</span>
                              </span>
                              <span class="font-mono flex items-center gap-2">
                                <span class="text-gray-500 dark:text-gray-400">{calc.effectiveness}x</span>
                                <span class="{getScoreColor(calc.score)} font-medium">{formatScore(calc.score)}</span>
                              </span>
                            </div>
                          {/each}
                          <div class="flex justify-between items-center p-2 bg-blue-100 dark:bg-blue-800 rounded font-medium text-sm mt-3">
                            <span>Total:</span>
                            <span class={getScoreColor(offTypeCalc.totalScore)}>{formatScore(offTypeCalc.totalScore)}</span>
                          </div>
                        </div>
                      {:else}
                        <p class="text-sm text-gray-500 dark:text-gray-400 italic">No type matchups</p>
                      {/if}
                    </div>

                    <!-- Defensive Type Resistance Calculations -->
                    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <h6 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Icon icon={Shield} class="w-4 h-4 text-blue-500" />
                        Defensive Type Resistance: {formatScore(pokemon.defTypeAdv)}
                      </h6>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        <strong>Your types:</strong> {(pokemon.types || []).map(t => capitalise(t)).join(', ') || 'Unknown'}
                      </p>
                      
                      {#if defTypeCalc.breakdown.length > 0}
                        <div class="space-y-1">
                          {#each defTypeCalc.breakdown as calc}
                            <div class="flex justify-between items-center p-2 bg-white dark:bg-gray-600 rounded text-xs">
                              <span class="text-gray-700 dark:text-gray-300">
                                <strong>{capitalise(calc.moveName.replace(/-/g, ' '))}</strong> <span class="text-gray-500">({capitalise(calc.moveType)})</span>
                              </span>
                              <span class="font-mono flex items-center gap-2">
                                <span class="text-gray-500 dark:text-gray-400">{calc.effectiveness}x</span>
                                <span class="{getScoreColor(calc.score)} font-medium">{formatScore(calc.score)}</span>
                              </span>
                            </div>
                          {/each}
                          <div class="flex justify-between items-center p-2 bg-blue-100 dark:bg-blue-800 rounded font-medium text-sm mt-3">
                            <span>Total:</span>
                            <span class={getScoreColor(defTypeCalc.totalScore)}>{formatScore(defTypeCalc.totalScore)}</span>
                          </div>
                        </div>
                      {:else}
                        <p class="text-sm text-gray-500 dark:text-gray-400 italic">No boss moves for analysis</p>
                      {/if}
                    </div>

                    <!-- Stat Scores Summary -->
                    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <h6 class="font-medium text-gray-900 dark:text-white mb-3">
                        Stat Scores
                      </h6>
                      <div class="space-y-2 text-sm">
                        <div class="flex justify-between items-center p-2 bg-white dark:bg-gray-600 rounded">
                          <span class="text-gray-700 dark:text-gray-300">Offensive Stat Advantage</span>
                          <span class={getScoreColor(pokemon.offStatAdv)}>{formatScore(pokemon.offStatAdv)}</span>
                        </div>
                        <div class="flex justify-between items-center p-2 bg-white dark:bg-gray-600 rounded">
                          <span class="text-gray-700 dark:text-gray-300">Defensive Stat Advantage</span>
                          <span class={getScoreColor(pokemon.defStatAdv)}>{formatScore(pokemon.defStatAdv)}</span>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
                          Stat scores compare your Pokémon's Attack/Defense against the boss team's stats
                        </p>
                      </div>
                    </div>

                    <!-- Final Calculation -->
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h6 class="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Final Scores
                      </h6>
                      <div class="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                        <div class="p-3 bg-white/50 dark:bg-white/10 rounded">
                          <strong>Total Offensive:</strong> {formatScore(pokemon.offTypeAdv)} (type) × {formatScore(pokemon.offStatAdv)} (stats) = <span class={getScoreColor(pokemon.offAdv)}>{formatScore(pokemon.offAdv)}</span>
                        </div>
                        <div class="p-3 bg-white/50 dark:bg-white/10 rounded">
                          <strong>Total Defensive:</strong> {formatScore(pokemon.defTypeAdv)} (type) × {formatScore(pokemon.defStatAdv)} (stats) = <span class={getScoreColor(pokemon.defAdv)}>{formatScore(pokemon.defAdv)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Algorithm Info -->
        <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">
            How the Algorithm Works
          </h4>
          <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• <strong>Offensive Score:</strong> Type advantage × Stat advantage</li>
            <li>• <strong>Defensive Score:</strong> Type resistance × Stat resistance</li>
            <li>• <strong>Type Advantage:</strong> 4x = +4, 2x = +2, 0.5x = -1, 0x = -4</li>
            <li>• <strong>Type Resistance:</strong> Immune = +8, 4x resist = +4, 2x resist = +2</li>
            <li>• Only Pokémon with positive scores in both categories are recommended</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
{/if}
