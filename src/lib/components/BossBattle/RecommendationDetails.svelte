<script>
  import { PIcon } from '$c/core'
  import { capitalise, regionise } from '$utils/string'
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '$c/core'
  import { X, Settings, Shield, Sword, BarChart } from '$icons'

  export let recommendations = []
  export let bossTeam = []
  export let advice = {}
  export let open = false

  const dispatch = createEventDispatcher()

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

  function getTypeEffectiveness(attackerType, defenderTypes) {
    // Simplified type effectiveness calculation
    const typeChart = {
      grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
      water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
      fire: { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
      electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
      fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
      rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
      ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
      // Add more types as needed
    }
    
    if (!typeChart[attackerType]) return 1
    
    return defenderTypes.reduce((total, type) => {
      const effectiveness = typeChart[attackerType][type] || 1
      return total * effectiveness
    }, 1)
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
              <div class="flex items-center gap-4 mb-4">
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
