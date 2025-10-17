<script>
  import { createEventDispatcher } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  
  import { Icon, PIcon, IconButton } from '$c/core'
  import { X } from '$icons'
  import AutoCompleteV2 from '$c/core/AutoCompleteV2.svelte'
  
  import { Natures } from '$lib/data/natures'
  import { NuzlockeStates } from '$lib/data/states'
  import { capitalise } from '$lib/utils/string'
  
  export let pokemon = null
  export let location = ''
  export let gameKey = ''
  export let initialData = {}
  
  
  const dispatch = createEventDispatcher()
  
  let nickname = initialData.nickname || ''
  let status = initialData.status ? Object.values(NuzlockeStates).find(s => s.id === initialData.status) : null
  let nature = initialData.nature ? Natures.find(n => n.id === initialData.nature) : null
  let gender = initialData.gender || null // 'male' | 'female' | 'genderless' | null
  
  // Handle ability - it can be a string (ability id) or an object
  let ability = null
  if (initialData.ability) {
    if (typeof initialData.ability === 'string') {
      ability = { id: initialData.ability, name: formatAbilityName(initialData.ability), label: formatAbilityName(initialData.ability) }
    } else if (initialData.ability.id) {
      ability = initialData.ability
    }
  }
  
  // Handle moves - array of move objects
  let moves = initialData.moves || []
  let selectedMoves = [...moves] // Copy to avoid mutating initialData
  
  // Search bindings
  let statusSearch = ''
  let natureSearch = ''
  let abilitySearch = ''
  let moveSearches = ['', '', '', ''] // Search text for each of the 4 move slots
  
  // Available data for the selected Pokemon
  let availableAbilities = []
  let availableMoves = []
  let abilitiesDataSource = null // Track abilities data source: 'radred' or 'pokeapi'
  let movesDataSource = null // Track moves data source: 'radred' or 'pokeapi'
  
  // Fetch abilities and moves when Pokemon is selected
  $: if (pokemon?.alias) {
    const timestamp = Date.now();
    const gameParam = gameKey ? `game=${gameKey}&` : '';
    
    // Fetch abilities
    fetch(`/api/pokemon/${pokemon.alias}/abilities.json?${gameParam}_t=${timestamp}`)
      .then(res => {
        const source = res.headers.get('X-Data-Source');
        abilitiesDataSource = source;
        return res.json();
      })
      .then(abilities => {
        availableAbilities = abilities
      })
      .catch(err => {
        console.error('Error fetching abilities:', err)
        availableAbilities = []
        abilitiesDataSource = null
      })
    
      // Fetch moves
      fetch(`/api/pokemon/${pokemon.alias}/moves.json?${gameParam}_t=${timestamp}`)
        .then(res => {
          const source = res.headers.get('X-Data-Source');
          movesDataSource = source;
          return res.json();
        })
        .then(data => {
          // Use only level-up moves, already sorted by level in ascending order from the API
          availableMoves = data.levelUp || []
        })
        .catch(err => {
          console.error('Error fetching moves:', err)
          availableMoves = []
          movesDataSource = null
        })
  }
  
  function formatAbilityName(abilityId) {
    return abilityId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  function handleSave() {
    // Filter out null/undefined moves
    const validMoves = selectedMoves.filter(m => m && m.id)
    
    const dataToSave = {
      nickname,
      status: status?.id,
      nature: nature?.id,
      ability: ability?.id,
      moves: validMoves,
      gender
    }
    
    console.log('📤 [PokemonConfigModal] Dispatching save with data:', dataToSave)
    
    dispatch('save', dataToSave)
  }
  
  function handleClose() {
    dispatch('close')
  }
</script>

{#if pokemon}
  <!-- Modal backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    on:click={handleClose}
    transition:fade={{ duration: 200 }}
  >
    <!-- Modal content -->
    <div
      class="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      on:click|stopPropagation
      transition:fly={{ y: 20, duration: 300 }}
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
        <div class="mb-4 flex justify-center">
          <PIcon name={pokemon.sprite || pokemon.alias || pokemon.name} className="transform scale-150" />
        </div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {capitalise(pokemon.label || pokemon.alias)}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {location}
        </p>
      </div>
      
      <!-- Form fields -->
      <div class="space-y-4">
        <!-- Nickname -->
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nickname
          </label>
          <input
            type="text"
            bind:value={nickname}
            placeholder="Enter nickname..."
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        
        <!-- Status -->
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <AutoCompleteV2
                    itemF={(_) => Object.values(NuzlockeStates)}
                    labelF={(_) => _.state}
                    bind:search={statusSearch}
                    bind:selected={status}
                    id="{location} Status Modal"
                    name="{location} Status Modal"
                    placeholder="Select status..."
                    class="w-full"
                    inset="2.5rem"
                  >
                    <div
                      class="group -mx-1 flex inline-flex w-full items-center py-2 px-1 md:py-3"
                      slot="option"
                      let:option
                      let:label
                    >
                      <Icon inline={true} class="mx-2 fill-current" icon={option.icon} />
                      {@html label}
                    </div>
                    
                    <svelte:fragment slot="icon" let:iconClass>
                      {#if status}
                        <Icon
                          inline={true}
                          class="{iconClass} left-3 fill-current"
                          icon={status.icon}
                        />
                      {/if}
                    </svelte:fragment>
                  </AutoCompleteV2>
                </div>
        
        <!-- Nature -->
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nature
          </label>
          <AutoCompleteV2
            itemF={(_) => Natures}
            max={Natures.length}
            bind:search={natureSearch}
            bind:selected={nature}
            id="{location} Nature Modal"
            name="{location} Nature Modal"
            placeholder="Select nature..."
            class="w-full"
          >
            <div
              class="group -mx-1 flex w-full items-center justify-between py-2 px-1 md:py-3"
              slot="option"
              let:option
              let:label
            >
              <span>{@html label}</span>
              {#if option.value.length}
                <span class="-my-4 -mr-3 flex items-end gap-x-2 text-xs sm:flex-col sm:gap-x-0">
                  <span class="inline-flex items-center justify-end text-orange-400 dark:group-hover:text-orange-800">
                    {option.value[0]}
                    <Icon inline={true} icon={Icon} class="fill-current" />
                  </span>
                  <span class="inline-flex items-center text-blue-300 dark:group-hover:text-blue-600">
                    {option.value[1]}
                  </span>
                </span>
              {/if}
            </div>
          </AutoCompleteV2>
        </div>
        
        <!-- Gender -->
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Gender
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              on:click={() => gender = 'male'}
              class="p-3 rounded-lg border-2 transition-all duration-200 {gender === 'male'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
            >
              <div class="flex flex-col items-center gap-1">
                <span class="text-2xl text-blue-500">♂</span>
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Male</span>
              </div>
            </button>
            
            <button
              type="button"
              on:click={() => gender = 'female'}
              class="p-3 rounded-lg border-2 transition-all duration-200 {gender === 'female'
                ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
            >
              <div class="flex flex-col items-center gap-1">
                <span class="text-2xl text-pink-500">♀</span>
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Female</span>
              </div>
            </button>
            
            <button
              type="button"
              on:click={() => gender = 'genderless'}
              class="p-3 rounded-lg border-2 transition-all duration-200 {gender === 'genderless'
                ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
            >
              <div class="flex flex-col items-center gap-1">
                <span class="text-2xl text-gray-500">○</span>
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">None</span>
              </div>
            </button>
          </div>
          
          {#if gender !== null}
            <button
              type="button"
              on:click={() => gender = null}
              class="mt-2 w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            >
              Clear selection
            </button>
          {/if}
        </div>
        
        <!-- Ability -->
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Ability
          </label>
          <AutoCompleteV2
            itemF={(_) => availableAbilities}
            max={availableAbilities.length}
            bind:search={abilitySearch}
            bind:selected={ability}
            id="{location} Ability Modal"
            name="{location} Ability Modal"
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
        </div>
        
        <!-- Moves (4 slots) -->
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Moves (up to 4)
          </label>
          
          <!-- Data source warning -->
          {#if abilitiesDataSource === 'pokeapi' || movesDataSource === 'pokeapi'}
            <div class="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
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
                    {#if abilitiesDataSource === 'pokeapi' && movesDataSource === 'pokeapi'}
                      Abilities and move levels may not be accurate for this game. Consider using Radical Red specific data for better accuracy.
                    {:else if abilitiesDataSource === 'pokeapi'}
                      Abilities may not be accurate for this game. Consider using Radical Red specific data for better accuracy.
                    {:else if movesDataSource === 'pokeapi'}
                      Move levels may not be accurate for this game. Consider using Radical Red specific data for better accuracy.
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/if}
          
          <div class="space-y-2">
            {#each [0, 1, 2, 3] as i}
              <AutoCompleteV2
                itemF={(_) => availableMoves}
                labelF={(move) => move.name}
                max={20}
                bind:search={moveSearches[i]}
                bind:selected={selectedMoves[i]}
                id="{location} Move {i + 1} Modal"
                name="{location} Move {i + 1} Modal"
                placeholder="Move {i + 1}..."
                class="w-full"
                disabled={availableMoves.length === 0}
              >
                <div
                  class="group -mx-1 flex w-full items-center justify-between py-2 px-1 md:py-3"
                  slot="option"
                  let:option
                  let:label
                >
                  <span>{@html label}</span>
                  {#if option.level}
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      Lv. {option.level}
                    </span>
                  {/if}
                </div>
              </AutoCompleteV2>
            {/each}
          </div>
        </div>
      </div>
      
      <!-- Action buttons -->
      <div class="mt-6 flex gap-x-3">
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

