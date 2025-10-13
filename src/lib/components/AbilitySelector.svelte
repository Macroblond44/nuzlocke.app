<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import { Icon } from '$c/core'
  import { X } from '$icons'
  import AutoCompleteV2 from '$c/core/AutoCompleteV2.svelte'

  export let pokemonName = ''
  export let gameKey = ''
  export let currentAbility = null
  export let open = false

  const dispatch = createEventDispatcher()

  let abilitySearch = ''
  let availableAbilities = []
  let loading = false
  let abilitiesDataSource = null

  // Fetch abilities when Pokemon changes
  $: if (pokemonName && open) {
    fetchAbilities()
  }

  async function fetchAbilities() {
    loading = true
    try {
      const timestamp = Date.now()
      const gameParam = gameKey ? `game=${gameKey}&` : ''
      
      const response = await fetch(`/api/pokemon/${pokemonName}/abilities.json?${gameParam}_t=${timestamp}`)
      abilitiesDataSource = response.headers.get('X-Data-Source')
      
      const abilities = await response.json()
      availableAbilities = abilities || []
    } catch (error) {
      console.error('Error fetching abilities:', error)
      availableAbilities = []
    } finally {
      loading = false
    }
  }

  function handleSave() {
    dispatch('save', {
      ability: currentAbility?.id || null
    })
    handleClose()
  }

  function handleClose() {
    dispatch('close')
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    on:click={handleClose}
    transition:fade={{ duration: 200 }}
  >
    <div
      class="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      on:click|stopPropagation
    >
      <!-- Close button -->
      <button
        on:click={handleClose}
        class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <Icon icon={X} height="1.5em" />
      </button>
      
      <!-- Header -->
      <div class="mb-6 text-center">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          Select Ability
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {pokemonName}
        </p>
      </div>

      <!-- Data source warning -->
      {#if abilitiesDataSource === 'pokeapi'}
        <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-amber-800 dark:text-amber-200">
                Data from PokeAPI
              </h3>
              <div class="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Abilities may not be accurate for this game.
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Ability Selection -->
      <div class="mb-6">
        <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Ability
        </label>
        
        {#if loading}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            <span class="ml-3 text-gray-600 dark:text-gray-400">Loading abilities...</span>
          </div>
        {:else}
          <AutoCompleteV2
            itemF={(_) => availableAbilities}
            max={availableAbilities.length}
            bind:search={abilitySearch}
            bind:selected={currentAbility}
            id="ability-selector"
            name="ability-selector"
            placeholder="Select ability..."
            class="w-full"
            disabled={availableAbilities.length === 0}
          >
            <div
              class="group -mx-1 flex w-full items-center justify-between py-2 px-1 md:py-3"
              slot="option"
              let:option
              let:label
            >
              <span>{@html label}</span>
              {#if option.isHidden}
                <span class="text-xs text-purple-400 dark:text-purple-300">
                  Hidden
                </span>
              {/if}
            </div>
          </AutoCompleteV2>
        {/if}
      </div>

      <!-- Action buttons -->
      <div class="flex gap-x-3">
        <button
          on:click={handleClose}
          class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          on:click={handleSave}
          class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}
