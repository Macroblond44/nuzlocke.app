<script>
  import { onMount } from 'svelte'
  import { PIcon, Icon, Tooltip } from '$c/core'
  import { X, Search } from '$icons'
  import { updatePokemon } from '$lib/store'

  import { createEventDispatcher } from 'svelte'
  
  const dispatch = createEventDispatcher()
  
  export let pokemonName = ''
  export let open = false
  export let pokemonData = null // The full Pokemon data object

  let items = []
  let filteredItems = []
  let searchTerm = ''
  let loading = true
  let error = null

  // Close modal on escape key
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      dispatch('close')
    }
  }

  // Filter items based on search term
  function filterItems() {
    if (!searchTerm.trim()) {
      filteredItems = items
      return
    }
    
    const term = searchTerm.toLowerCase()
    filteredItems = items.filter(item => 
      item.name.toLowerCase().includes(term) ||
      (item.effect && item.effect.toLowerCase().includes(term))
    )
  }

  // Handle item selection
  function selectItem(item) {
    if (pokemonData) {
      // Update the Pokemon data with the new item
      const updatedPokemon = {
        ...pokemonData,
        held: item
      }
      updatePokemon(updatedPokemon)
    } else {
      console.error('❌ [ItemSelector] pokemonData is not defined')
    }
    
    dispatch('close')
  }

  // Clear current item
  function clearItem() {
    if (pokemonData) {
      // Update the Pokemon data to remove the item
      const updatedPokemon = {
        ...pokemonData,
        held: null
      }
      updatePokemon(updatedPokemon)
    } else {
      console.error('❌ [ItemSelector] pokemonData is not defined')
    }
    
    dispatch('close')
  }

  // Fetch items from API
  async function fetchItems() {
    try {
      loading = true
      error = null
      
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5173' 
        : 'https://nuzlocke.app'
      
      const response = await fetch(`${baseUrl}/api/items.json`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.status}`)
      }
      
      const data = await response.json()
      items = data
      filteredItems = data
      
    } catch (err) {
      console.error('Error fetching items:', err)
      error = err.message
    } finally {
      loading = false
    }
  }

  // Watch for search term changes
  $: if (searchTerm !== undefined) {
    filterItems()
  }

  onMount(() => {
    if (open) {
      fetchItems()
    }
  })

  // Refetch when modal opens
  $: if (open && items.length === 0) {
    fetchItems()
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Select Item for {pokemonName}
        </h3>
        <button
          on:click={() => dispatch('close')}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Icon icon={X} class="h-6 w-6" />
        </button>
      </div>

      <!-- Search -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="relative">
          <Icon icon={Search} class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Search items..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if loading}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span class="ml-2 text-gray-600 dark:text-gray-400">Loading items...</span>
          </div>
        {:else if error}
          <div class="text-center py-8">
            <p class="text-red-600 dark:text-red-400 mb-4">Error loading items: {error}</p>
            <button
              on:click={fetchItems}
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        {:else}
          <!-- Clear item option -->
          <div class="mb-4">
            <button
              on:click={clearItem}
              class="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="flex items-center">
                <div class="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-600 rounded mr-3">
                  <span class="text-gray-500 dark:text-gray-400 text-sm">×</span>
                </div>
                <div>
                  <div class="font-medium text-gray-900 dark:text-white">No Item</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">Remove current item</div>
                </div>
              </div>
            </button>
          </div>

          <!-- Items list -->
          <div class="space-y-2">
            {#each filteredItems as item (item.id)}
              <button
                on:click={() => {
                  console.log('[ItemSelector] Button clicked for item:', item.name)
                  selectItem(item)
                }}
                class="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div class="flex items-center">
                  <div class="w-8 h-8 flex items-center justify-center mr-3">
                    <PIcon type="item" name={item.sprite} />
                  </div>
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-white">{item.name}</div>
                    {#if item.effect}
                      <div class="text-sm text-gray-500 dark:text-gray-400">
                        {item.effect.replace(/^Held: +/g, '')}
                      </div>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>

          {#if filteredItems.length === 0 && searchTerm}
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
              No items found matching "{searchTerm}"
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
