<script>
  import { Recommendation, BoxTeam, Advice } from './'
  import RecommendationDetails from './RecommendationDetails.svelte'
  import AdvancedRecommendationDetails from './AdvancedRecommendationDetails.svelte'

  import TypeLogo from '$c/type-logo.svelte'
  import { Icon, Tooltip, Accordion } from '$c/core'
  import { Info, Settings } from '$icons'

  import { summarise } from '$utils/types'
  import { capitalise } from '$utils/string'
  import { getSetting } from '$lib/components/Settings/_data'
  import { parse, activeGame, savedGames } from '$lib/store'

  export let name,
    team = [],
    gym = [], // Boss team
    box = [],
    recommendations = [],
    advice = {}

  let showDebugModal = false
  let showAdvancedDebugModal = false
  let recommendationMethod = 'basic' // 'basic' or 'advanced'
  let defaultRecommendationSetting = 0 // 0 = Basic, 1 = Advanced
  let validationError = null
  let currentGameKey = '' // Store the current game key (e.g., 'radred', 'emerald', etc.)

  // Load default recommendation method from settings and game key
  savedGames.subscribe(parse(saves => {
    const currentSave = saves[$activeGame] || {}
    const { settings, game } = currentSave
    currentGameKey = game || ''
    const settingValue = (settings || '011101000')[getSetting('recommendation-method')]
    defaultRecommendationSetting = parseInt(settingValue) || 0
    // Set initial recommendation method based on settings
    if (recommendationMethod === 'basic') {
      recommendationMethod = defaultRecommendationSetting === 1 ? 'advanced' : 'basic'
    }
  }))

  function validatePokemonForAdvanced() {
    const missingData = []
    
    for (const pokemon of box) {
      const hasAbility = pokemon.original?.ability
      const hasMoves = (pokemon.original?.moves || []).length > 0
      
      if (!hasAbility && !hasMoves) {
        missingData.push({
          name: pokemon.name || pokemon.alias,
          missing: 'ability and moves'
        })
      } else if (!hasAbility) {
        missingData.push({
          name: pokemon.name || pokemon.alias,
          missing: 'ability'
        })
      } else if (!hasMoves) {
        missingData.push({
          name: pokemon.name || pokemon.alias,
          missing: 'moves'
        })
      }
    }
    
    return missingData
  }

  function handleMethodChange(method) {
    if (method === 'advanced') {
      const missingData = validatePokemonForAdvanced()
      
      if (missingData.length > 0) {
        validationError = `Cannot use advanced recommendations. The following Pokémon need to be configured: ${missingData.map(p => `${p.name} (missing ${p.missing})`).join(', ')}. Please go to the Game page and click on the Status or Nature field to open the configuration modal and add missing data.`
        // Don't change the method
        return
      }
    }
    
    // Clear error and change method
    validationError = null
    recommendationMethod = method
  }

  function handleCloseDebug() {
    showDebugModal = false
  }

  function handleCloseAdvancedDebug() {
    showAdvancedDebugModal = false
  }

  function handleShowCalculations() {
    if (recommendationMethod === 'advanced') {
      showAdvancedDebugModal = true
    } else {
      showDebugModal = true
    }
  }
</script>

<div
  class="rec-card relative z-20 mx-auto h-auto translate-y-20 rounded-b-lg bg-white px-4 py-2 dark:bg-gray-900 md:translate-y-24 md:py-4 md:px-8 md:pb-2"
>
  <div
    class="mx-auto flex w-auto flex-wrap items-start pt-2 md:w-[48ch] md:pt-0"
  >
    <slot name="tabs" />

    <BoxTeam on:clear on:reset on:select {team} {box} boss={{ name }} />

    <Accordion className="md:-ml-4 -mb-2 py-2">
      <h2 slot="heading">Team analysis</h2>
      <div
        slot="item"
        class="mt-4 mb-2 flex flex-wrap items-center justify-center gap-1 gap-y-4"
      >
        {#key team}
          {#await summarise(team) then result}
            {#if result.result}
              {#each result.result as [type, { resist = 0, weak = 0 }]}
                <div class="grid-rows-13 grid gap-1">
                  {#each Array(result.max - resist).fill() as _}
                    <span class="h-1 w-8 rounded-sm bg-gray-100 dark:bg-gray-700" />
                  {/each}
                  {#each Array(resist).fill() as _}
                    <span class="h-1 w-8 rounded-sm bg-green-500" />
                  {/each}
                  <TypeLogo class="scale-75" {type}>
                    <p class="py-2 px-1 text-center">
                      <b>{resist || 'None'}</b>
                      of your Team resist{resist === 1 ? 's' : ''}
                      <b>{capitalise(type)}</b>
                      <br />
                      <b>{weak || 'None'}</b> of your Team {weak === 1
                        ? 'is'
                        : 'are'} weak to
                      <b>{capitalise(type)}</b>
                    </p>
                  </TypeLogo>
                  {#each Array(weak).fill() as _}
                    <span class="h-1 w-8 rounded-sm bg-red-500" />
                  {/each}
                  {#each Array(result.max - weak).fill() as _}
                    <span class="h-1 w-8 rounded-sm bg-gray-100 dark:bg-gray-700" />
                  {/each}
                </div>
              {/each}
            {/if}
          {/await}
        {/key}
      </div>
    </Accordion>

    <Accordion className="md:-ml-4 -mb-2">
      <h2 slot="heading" class="my-4 inline-flex w-full">
        Recommendations
        <span class="ml-2 cursor-help">
          <Icon class="inline scale-150" inline icon={Info} />
          <Tooltip side="right">
            Based on {name}'s team's movesets, weaknesses and your Pokemon's
            beneficial stats and both resistive and offesnsive potential. You
            should still use your own knowledge to properly craft a team.
          </Tooltip>
        </span>
      </h2>

      <div slot="item" class="flex w-auto flex-col">
        <!-- Recommendation Method Selector -->
        <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Recommendation Method:
            </span>
            <div class="flex gap-2">
              <button
                on:click={() => handleMethodChange('basic')}
                class="px-3 py-1.5 text-sm rounded-lg transition-all {recommendationMethod === 'basic' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}"
              >
                Basic
              </button>
              <button
                on:click={() => handleMethodChange('advanced')}
                class="px-3 py-1.5 text-sm rounded-lg transition-all {recommendationMethod === 'advanced' 
                  ? 'bg-green-600 text-white shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}"
              >
                Advanced
              </button>
            </div>
          </div>
          
          {#if validationError}
            <div class="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-xs text-red-800 dark:text-red-200">
                <strong>⚠️ Validation Error:</strong><br/>
                {validationError}
              </p>
            </div>
          {:else}
            <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
              {#if recommendationMethod === 'basic'}
                <span class="inline-flex items-center gap-1">
                  <span class="w-2 h-2 bg-blue-600 rounded-full"></span>
                  Type matchups and coverage analysis
                </span>
              {:else}
                <span class="inline-flex items-center gap-1">
                  <span class="w-2 h-2 bg-green-600 rounded-full"></span>
                  Precise damage calculations with move analysis
                </span>
              {/if}
            </p>
          {/if}
        </div>

        <div class="flex w-auto flex-wrap">
          <div class="md:min-w-1/2 w-full md:flex-1">
            <ul class="my-2 flex flex-wrap justify-around gap-x-6 gap-y-4 md:justify-start">
              {#each recommendations.slice(0, 6) as poke, i}
                <Recommendation {...poke} {i} />
              {/each}
            </ul>
          {#if advice.dmgclass}
            {@const dclass = advice.dmgclass[0]}
            {@const defclass =
              dclass === 'physical' ? 'Defense' : 'Special Defense'}
            <p
              class="mt-2 w-auto text-center text-xs italic max-md:mb-2 md:text-left"
            >
              {name}'s team only uses <b>{dclass}</b> moves.
              <br class="hidden md:block" />
              You should use Pokemon with a high <b>{defclass}</b> stat.
            </p>
          {/if}
        </div>

        <div class="md:min-w-1/2 flex w-full flex-col justify-start md:flex-1">
          <Advice types={advice.weak}>
            {name}'s team are <b class="dark:text-gray-400">all</b> weak to:
          </Advice>

          <Advice types={advice.resist}>
            {name}'s team are <b class="dark:text-gray-400">all</b> resistant to:
          </Advice>

          <Advice types={advice.immunity}>
            {name}'s team have immunities to:
          </Advice>
        </div>
        </div>
      </div>
    </Accordion>

    <!-- Debug Button -->
    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
      <button
        on:click={handleShowCalculations}
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Icon icon={Settings} class="w-4 h-4" />
        Show calculation details
      </button>
    </div>

    <slot />
  </div>
</div>

<!-- Debug Modal -->
<RecommendationDetails
  bind:open={showDebugModal}
  {recommendations}
  bossTeam={team}
  {advice}
  on:close={handleCloseDebug}
/>

<!-- Advanced Debug Modal -->
<AdvancedRecommendationDetails
  bind:open={showAdvancedDebugModal}
  {recommendations}
  bossTeam={gym}
  userTeam={box}
  gameMode={currentGameKey}
  recommendationMethod={recommendationMethod}
  on:close={handleCloseAdvancedDebug}
/>

<style>
  p {
    @apply text-xs italic text-gray-500 max-md:text-center;
  }
  h2 {
    @apply text-sm font-bold;
  }
</style>
