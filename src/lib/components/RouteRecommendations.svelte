<script>
  import { onMount, getContext } from 'svelte'
  import { PIcon, Icon } from '$c/core'
  import { capitalise, regionise } from '$utils/string'
  import { X, Settings, Shield, Sword, BarChart, Info, Target } from '$icons'
  import advisorTeam from '$utils/advice/advisor-team'
  import AdvancedRecommendationDetails from '$lib/components/BossBattle/AdvancedRecommendationDetails.svelte'
  import { parse, activeGame, savedGames } from '$lib/store'
  import { getSetting } from '$lib/components/Settings/_data'
  import { createRecommendationManager, RECOMMENDATION_METHODS } from '$lib/utils/recommendations/recommendation-manager.js'

  export let open = false
  export let routeName = ''
  export let encounters = [] // Array of Pokemon IDs available in this route
  export let gameKey = ''
  export let starter = 'fire'

  const { getPkmn, getPkmns, getLeague } = getContext('game')

  let availableBosses = []
  let selectedBoss = null
  let bossTeam = []
  let recommendations = []
  let advice = {}
  let loading = true
  let encounterPokemon = []

  // State for detailed calculations
  let showDetailedCalculations = false
  let selectedPokemon = null
  
  // State for advanced modal
  let showAdvancedModal = false
  
  // Recommendation manager instance
  let recommendationManager = createRecommendationManager()

  // Load default recommendation method from settings (only once)
  let settingsLoaded = false
  savedGames.subscribe(parse(saves => {
    if (!settingsLoaded) {
      const { settings } = saves[$activeGame] || {}
      console.log('[Route Recommendations] Game settings:', settings)
      
      recommendationManager.updateMethodFromSettings(settings, getSetting)
      console.log('[Route Recommendations] Final recommendation method:', recommendationManager.getCurrentMethod())
      settingsLoaded = true
    }
  }))

  onMount(async () => {
    // Fetch league data to populate boss list
    const leagueData = await getLeague(gameKey, starter)
    if (leagueData) {
      availableBosses = Object.entries(leagueData)
        .map(([key, boss]) => ({
          id: key,
          name: boss.name,
          speciality: boss.speciality,
          location: boss.location || `Badge ${key}`,
          pokemon: boss.pokemon
        }))
        .sort((a, b) => parseInt(a.id) - parseInt(b.id))
    }

    // Fetch all Pokemon for this route
    const pkmnData = await getPkmns(encounters)
    encounterPokemon = Object.values(pkmnData).filter(p => p)
    
    loading = false
  })

  async function loadBoss(bossId) {
    console.log('[Route Recommendations] Loading boss:', bossId)
    console.log('[Route Recommendations] Current recommendation method:', recommendationManager.getCurrentMethod())
    console.log('[Route Recommendations] Encounter pokemon count:', encounterPokemon.length)
    
    loading = true
    selectedBoss = availableBosses.find(b => b.id === bossId)
    console.log('[Route Recommendations] Selected boss:', selectedBoss)
    
    // Fetch full Pokemon data for boss team using individual getPkmn calls
    bossTeam = await Promise.all(
      selectedBoss.pokemon.map(async (p) => {
        const pkmnData = await getPkmn(p.name)
        
        // Debug: Log stats from league file
        if (p.name === 'floatzel') {
          console.log('[Route Recommendations] Floatzel from league file:', {
            name: p.name,
            stats: p.stats,
            moves: p.moves
          })
        }
        
        return {
          ...pkmnData,
          original: p,
          name: p.name,
          alias: pkmnData?.alias || p.name
        }
      })
    )
    console.log('[Route Recommendations] Boss team loaded:', bossTeam.length, 'pokemon')

    // Run recommendation algorithm based on method
    if (recommendationManager.isAdvanced()) {
      console.log('[Route Recommendations] Using advanced recommendations')
      try {
        const result = await recommendationManager.loadAdvancedRecommendationsForRoute(
          encounterPokemon, 
          bossTeam, 
          gameKey
        )
        console.log('[Route Recommendations] Advanced recommendations result:', result.length, 'recommendations')
        
        // Don't auto-open the modal - let user click the button instead
        // This prevents having two modals open at once
      } catch (error) {
        console.error('[Route Recommendations] Advanced recommendations error:', error.message)
        // Fallback to basic recommendations on error
        const result = advisorTeam(encounterPokemon, bossTeam)
        recommendations = result.recommendations
        advice = result.advice
        console.log('[Route Recommendations] Fallback to basic recommendations:', recommendations.length, 'recommendations')
      }
    } else {
      console.log('[Route Recommendations] Using basic recommendations')
      const result = advisorTeam(encounterPokemon, bossTeam)
      recommendations = result.recommendations
      advice = result.advice
      console.log('[Route Recommendations] Basic recommendations result:', recommendations.length, 'recommendations')
    }
    
    loading = false
  }

  function toggleRecommendationMethod() {
    recommendationManager.toggleMethod()
    
    // Reload boss data if a boss is selected
    if (selectedBoss) {
      loadBoss(selectedBoss.id)
    }
  }

  function normaliseKey(name) {
    return name.replace(/[-\.]/g, '').toLowerCase()
  }

  function closeModal() {
    open = false
    selectedBoss = null
    recommendations = []
    recommendationManager.reset()
    showDetailedCalculations = false
    selectedPokemon = null
  }


  function toggleDetailedCalculations(pokemon) {
    if (recommendationManager.isAdvanced()) {
      // For advanced mode, open the advanced calculations modal
      console.log('[Route Recommendations] Opening advanced modal for:', pokemon.name)
      console.log('[Route Recommendations] Pokemon data:', pokemon)
      recommendationManager.showAdvancedModal(pokemon)
    } else {
      // For basic mode, use the existing detailed calculations
      if (selectedPokemon === pokemon.name) {
        selectedPokemon = null
        showDetailedCalculations = false
      } else {
        selectedPokemon = pokemon.name
        showDetailedCalculations = true
      }
    }
  }

  function formatScore(score) {
    return score >= 0 ? `+${score}` : `${score}`
  }

  function getScoreColor(score) {
    if (score > 0) return 'text-green-600 dark:text-green-400'
    if (score < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
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

  $: if (open && !availableBosses.length && !loading) {
    onMount()
  }
</script>

  {#if open}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" on:click={closeModal}>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto relative z-[10000]" on:click|stopPropagation>
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
        <div class="flex items-center gap-3">
          <Icon icon={Target} class="text-purple-600 dark:text-purple-400" />
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            Route Recommendations: {routeName}
          </h2>
        </div>
        <div class="flex items-center gap-3">
          {#if selectedBoss}
            <button 
              on:click={toggleRecommendationMethod}
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors {recommendationManager.getCurrentMethod() === 'basic' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}"
            >
              <Icon icon={recommendationManager.getCurrentMethod() === 'basic' ? BarChart : Info} class="w-4 h-4 mr-2" />
              {recommendationManager.getCurrentMethod() === 'basic' ? 'Basic' : 'Advanced'}
            </button>
          {/if}
          <button 
            on:click={closeModal}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Icon icon={X} class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        {#if loading}
          <div class="flex items-center justify-center py-12">
            <div class="text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        {:else if !selectedBoss}
          <!-- Boss Selection -->
          <div class="space-y-4">
            <div class="flex items-center gap-2 mb-6">
              <Icon icon={Target} class="text-blue-600 dark:text-blue-400" />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Select a Boss to Compare Against
              </h3>
            </div>
            
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Available Pokémon in <strong>{routeName}</strong>: {encounterPokemon.length}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each availableBosses as boss}
                <button
                  on:click={() => loadBoss(boss.id)}
                  class="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                >
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 dark:text-white">
                      {boss.name}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                      {boss.location}
                    </div>
                    {#if boss.speciality}
                      <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Type: <span class="uppercase font-medium">{boss.speciality}</span>
                      </div>
                    {/if}
                  </div>
                  <div class="text-gray-400">
                    <Icon icon={Target} class="w-5 h-5" />
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <!-- Recommendations Display -->
          <div class="space-y-6">
            <!-- Boss Info Header -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    Comparing against: {selectedBoss.name}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {selectedBoss.location} • {bossTeam.length} Pokémon
                  </p>
                </div>
                <button
                  on:click={() => { selectedBoss = null; recommendations = [] }}
                  class="px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Change Boss
                </button>
              </div>
            </div>

            <!-- Boss Team Analysis -->
            <div>
              <h4 class="text-md font-semibold mb-3 text-gray-900 dark:text-white">
                Boss Team Analysis
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h5 class="font-medium mb-2 text-gray-900 dark:text-white">Team Weaknesses</h5>
                  <div class="flex flex-wrap gap-2">
                    {#each advice.weak || [] as type}
                      <span class="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-sm uppercase">
                        {type}
                      </span>
                    {/each}
                    {#if !advice.weak?.length}
                      <span class="text-sm text-gray-500 dark:text-gray-400 italic">None</span>
                    {/if}
                  </div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h5 class="font-medium mb-2 text-gray-900 dark:text-white">Team Resistances</h5>
                  <div class="flex flex-wrap gap-2">
                    {#each advice.resist || [] as type}
                      <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm uppercase">
                        {type}
                      </span>
                    {/each}
                    {#if !advice.resist?.length}
                      <span class="text-sm text-gray-500 dark:text-gray-400 italic">None</span>
                    {/if}
                  </div>
                </div>
              </div>
            </div>

            <!-- Recommendations List -->
            <div>
              <h4 class="text-md font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon={recommendationManager.getCurrentMethod() === 'basic' ? BarChart : Info} class="text-green-600 dark:text-green-400" />
                Recommended Pokémon from {routeName}
                {#if recommendationManager.getCurrentMethod() === 'advanced'}
                  <button
                    on:click={() => {
                      console.log('[Route Recommendations] Header button clicked')
                      console.log('[Route Recommendations] Advanced recommendations:', recommendationManager.getAdvancedRecommendations())
                      showAdvancedModal = true
                      console.log('[Route Recommendations] showAdvancedModal set to:', showAdvancedModal)
                    }}
                    class="text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                    disabled={recommendationManager.isLoadingAdvanced() || recommendationManager.getAdvancedRecommendations().length === 0}
                  >
                    Advanced Analysis
                  </button>
                {/if}
              </h4>
              
              {#if recommendationManager.isLoadingAdvanced()}
                <div class="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p class="text-gray-600 dark:text-gray-400">
                    Calculating advanced battle simulations...
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    This may take a moment as we simulate 1v1 battles for each Pokémon.
                  </p>
                </div>
              {:else if recommendationManager.getCurrentMethod() === 'advanced' && recommendationManager.getAdvancedRecommendations().length === 0}
                <div class="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p class="text-gray-600 dark:text-gray-400">
                    No advanced recommendations available.
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Try switching to basic mode or select a different boss.
                  </p>
                </div>
              {:else if recommendationManager.getCurrentMethod() === 'basic' && recommendations.length === 0}
                <div class="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p class="text-gray-600 dark:text-gray-400">
                    No strong recommendations found for this matchup.
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Try selecting a different boss or check other routes.
                  </p>
                </div>
              {:else}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {#if recommendationManager.getCurrentMethod() === 'advanced'}
                    <!-- Advanced mode: Show loading or message -->
                    {#if recommendationManager.isLoadingAdvanced()}
                      <div class="col-span-2 text-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                        <p class="text-gray-600 dark:text-gray-400">Loading advanced recommendations...</p>
                      </div>
                    {:else if recommendationManager.getAdvancedRecommendations().length > 0}
                      <div class="col-span-2 text-center py-8">
                        <div class="mb-4">
                          <Icon icon={Target} class="w-12 h-12 text-green-500 mx-auto mb-2" />
                          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Advanced Analysis Ready
                          </h3>
                          <p class="text-gray-600 dark:text-gray-400">
                            Click "Advanced Analysis" above to view detailed 1v1 battle simulations
                          </p>
                          <button
                            on:click={() => {
                              console.log('[Route Recommendations] Opening advanced modal...')
                              console.log('[Route Recommendations] Advanced recommendations:', recommendationManager.getAdvancedRecommendations())
                              console.log('[Route Recommendations] Boss team:', bossTeam)
                              showAdvancedModal = true
                              console.log('[Route Recommendations] showAdvancedModal set to:', showAdvancedModal)
                            }}
                            class="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                          >
                            View Advanced Analysis
                          </button>
                        </div>
                      </div>
                    {:else}
                      <div class="col-span-2 text-center py-8">
                        <p class="text-gray-600 dark:text-gray-400">
                          No advanced recommendations available. Try selecting a different boss.
                        </p>
                      </div>
                    {/if}
                  {:else}
                    {#each recommendations as pokemon, index}
                      <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between mb-3">
                          <div class="flex items-center gap-3">
                            <PIcon name={pokemon.name} class="w-12 h-12" />
                            <div>
                              <h5 class="font-semibold text-gray-900 dark:text-white">
                                {regionise(capitalise(pokemon.name))}
                              </h5>
                              <p class="text-xs text-gray-600 dark:text-gray-400">
                                Rank #{index + 1}
                              </p>
                            </div>
                          </div>
                          <button
                            on:click={() => toggleDetailedCalculations(pokemon)}
                            class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          >
                            {selectedPokemon === pokemon.name ? 'Hide' : 'Details'}
                          </button>
                        </div>

                        <!-- Quick Summary -->
                        <div class="grid grid-cols-2 gap-3 text-xs">
                          <div class="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            <div class="flex items-center gap-1 mb-1">
                              <Icon icon={Sword} class="w-3 h-3 text-red-500" />
                              <span class="font-medium text-gray-700 dark:text-gray-300">Offensive</span>
                            </div>
                            <div class={`text-lg font-bold ${getScoreColor(pokemon.offAdv)}`}>
                              {formatScore(pokemon.offAdv)}
                            </div>
                          </div>
                          <div class="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                            <div class="flex items-center gap-1 mb-1">
                              <Icon icon={Shield} class="w-3 h-3 text-blue-500" />
                              <span class="font-medium text-gray-700 dark:text-gray-300">Defensive</span>
                            </div>
                            <div class={`text-lg font-bold ${getScoreColor(pokemon.defAdv)}`}>
                              {formatScore(pokemon.defAdv)}
                            </div>
                          </div>
                        </div>

                        <!-- Effectiveness Percentages -->
                        <div class="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                          <div>
                            <div class="font-semibold text-green-600 dark:text-green-400">
                              {Math.round(pokemon.resistPct * 100)}%
                            </div>
                            <div class="text-gray-600 dark:text-gray-400">Resist</div>
                          </div>
                          <div>
                            <div class="font-semibold text-red-600 dark:text-red-400">
                              {Math.round(pokemon.weakPct * 100)}%
                            </div>
                            <div class="text-gray-600 dark:text-gray-400">Weak</div>
                          </div>
                          <div>
                            <div class="font-semibold text-purple-600 dark:text-purple-400">
                              {Math.round(pokemon.immunePct * 100)}%
                            </div>
                            <div class="text-gray-600 dark:text-gray-400">Immune</div>
                          </div>
                        </div>
                        
                        <!-- Detailed Calculations for Basic Mode -->
                        {#if selectedPokemon === pokemon.name && showDetailedCalculations}
                        {@const offTypeCalc = getOffensiveBreakdown(pokemon)}
                        {@const defTypeCalc = getDefensiveBreakdown(pokemon)}
                        
                        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <h6 class="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-3 text-sm">
                            <Icon icon={Info} class="w-4 h-4 text-blue-500" />
                            Detailed Breakdown
                          </h6>
                          
                          <div class="space-y-3">
                            <!-- Offensive Type Advantage -->
                            <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs">
                              <div class="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Icon icon={Sword} class="w-3 h-3 text-red-500" />
                                Offensive: {formatScore(pokemon.offTypeAdv)}
                              </div>
                              <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                Types: {(pokemon.types || []).map(t => capitalise(t)).join(', ')}
                              </div>
                              
                              {#if offTypeCalc.breakdown.length > 0}
                                <div class="space-y-1">
                                  {#each offTypeCalc.breakdown as calc}
                                    <div class="flex justify-between items-center p-1.5 bg-white dark:bg-gray-600 rounded text-xs">
                                      <span class="text-gray-700 dark:text-gray-300">
                                        <span class="font-medium">{capitalise(calc.attackType)}</span> vs <strong>{regionise(capitalise(calc.defenderName))}</strong>
                                      </span>
                                      <span class="font-mono flex items-center gap-1.5">
                                        <span class="text-gray-500 dark:text-gray-400">{calc.effectiveness}x</span>
                                        <span class="{getScoreColor(calc.score)} font-medium">{formatScore(calc.score)}</span>
                                      </span>
                                    </div>
                                  {/each}
                                </div>
                              {/if}
                            </div>

                            <!-- Defensive Type Resistance -->
                            <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs">
                              <div class="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Icon icon={Shield} class="w-3 h-3 text-blue-500" />
                                Defensive: {formatScore(pokemon.defTypeAdv)}
                              </div>
                              
                              {#if defTypeCalc.breakdown.length > 0}
                                <div class="space-y-1">
                                  {#each defTypeCalc.breakdown.slice(0, 8) as calc}
                                    <div class="flex justify-between items-center p-1.5 bg-white dark:bg-gray-600 rounded text-xs">
                                      <span class="text-gray-700 dark:text-gray-300">
                                        <strong>{capitalise(calc.moveName.replace(/-/g, ' '))}</strong>
                                      </span>
                                      <span class="font-mono flex items-center gap-1.5">
                                        <span class="text-gray-500 dark:text-gray-400">{calc.effectiveness}x</span>
                                        <span class="{getScoreColor(calc.score)} font-medium">{formatScore(calc.score)}</span>
                                      </span>
                                    </div>
                                  {/each}
                                  {#if defTypeCalc.breakdown.length > 8}
                                    <p class="text-xs text-gray-500 dark:text-gray-400 italic text-center pt-1">
                                      +{defTypeCalc.breakdown.length - 8} more moves...
                                    </p>
                                  {/if}
                                </div>
                              {/if}
                            </div>

                            <!-- Stats Summary -->
                            <div class="grid grid-cols-2 gap-2 text-xs">
                              <div class="bg-white dark:bg-gray-600 p-2 rounded">
                                <div class="text-gray-600 dark:text-gray-400">Off. Stat</div>
                                <div class={`font-bold ${getScoreColor(pokemon.offStatAdv)}`}>
                                  {formatScore(pokemon.offStatAdv)}
                                </div>
                              </div>
                              <div class="bg-white dark:bg-gray-600 p-2 rounded">
                                <div class="text-gray-600 dark:text-gray-400">Def. Stat</div>
                                <div class={`font-bold ${getScoreColor(pokemon.defStatAdv)}`}>
                                  {formatScore(pokemon.defStatAdv)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/if}
                      </div>
                    {/each}
                  {/if}
                </div>

                <!-- Summary Info -->
                <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h5 class="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <Icon icon={Info} class="w-4 h-4" />
                    How to Use These Recommendations
                  </h5>
                  <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Higher scores (green) indicate better matchups</li>
                    <li>Offensive score shows how well the Pokémon attacks the boss team</li>
                    <li>Defensive score shows how well it resists the boss's moves</li>
                    <li>Click "Details" to see the full calculation breakdown</li>
                    <li>Consider both scores when building your team</li>
                  </ul>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Advanced Recommendation Details Modal -->
{#if showAdvancedModal}
  <AdvancedRecommendationDetails
    open={showAdvancedModal}
    on:close={() => showAdvancedModal = false}
    recommendations={recommendationManager.getAdvancedRecommendations()}
    bossTeam={bossTeam}
    userTeam={encounterPokemon}
    gameMode="route"
  />
{/if}

