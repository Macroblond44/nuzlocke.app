<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import { Icon } from '$c/core'
  import { X } from '$icons'
  import AutoCompleteV2 from '$c/core/AutoCompleteV2.svelte'
  import { Natures } from '$lib/data/natures'

  export let pokemonName = ''
  export let currentNature = null
  export let open = false

  const dispatch = createEventDispatcher()

  let natureSearch = ''

  function handleSave() {
    dispatch('save', {
      nature: currentNature?.id || null
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
          Select Nature
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {pokemonName}
        </p>
      </div>

      <!-- Nature Selection -->
      <div class="mb-6">
        <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Nature
        </label>
        
        <AutoCompleteV2
          itemF={(_) => Natures}
          max={Natures.length}
          bind:search={natureSearch}
          bind:selected={currentNature}
          id="nature-selector"
          name="nature-selector"
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
