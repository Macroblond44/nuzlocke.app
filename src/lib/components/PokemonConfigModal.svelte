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
  
  // Handle ability - it can be a string (ability id) or an object
  let ability = null
  if (initialData.ability) {
    if (typeof initialData.ability === 'string') {
      ability = { id: initialData.ability, name: formatAbilityName(initialData.ability), label: formatAbilityName(initialData.ability) }
    } else if (initialData.ability.id) {
      ability = initialData.ability
    }
  }
  
  // Search bindings
  let statusSearch = ''
  let natureSearch = ''
  let abilitySearch = ''
  
  // Available abilities for the selected Pokemon
  let availableAbilities = []
  
  // Fetch abilities when Pokemon is selected
  $: if (pokemon?.alias) {
    const gameParam = gameKey ? `?game=${gameKey}` : '';
    fetch(`/api/pokemon/${pokemon.alias}/abilities.json${gameParam}`)
      .then(res => res.json())
      .then(abilities => {
        availableAbilities = abilities
      })
      .catch(err => {
        console.error('Error fetching abilities:', err)
        availableAbilities = []
      })
  }
  
  function formatAbilityName(abilityId) {
    return abilityId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  function handleSave() {
    dispatch('save', {
      nickname,
      status: status?.id,
      nature: nature?.id,
      ability: ability?.id
    })
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
      class="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
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
          <PIcon name={pokemon.sprite} className="transform scale-150" />
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

