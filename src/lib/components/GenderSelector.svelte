<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import { Icon } from '$c/core'
  import { X } from '$icons'

  export let pokemonName = ''
  export let currentGender = null // 'male' | 'female' | 'genderless' | null
  export let open = false

  const dispatch = createEventDispatcher()

  // Gender options with symbols and colors
  const genderOptions = [
    { id: 'male', label: 'Male', symbol: '♂', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-300 dark:border-blue-700' },
    { id: 'female', label: 'Female', symbol: '♀', color: 'text-pink-500', bgColor: 'bg-pink-50 dark:bg-pink-900/20', borderColor: 'border-pink-300 dark:border-pink-700' },
    { id: 'genderless', label: 'Genderless', symbol: '○', color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-900/20', borderColor: 'border-gray-300 dark:border-gray-700' }
  ]

  let selectedGender = currentGender

  // Update selected gender when currentGender changes
  $: selectedGender = currentGender

  function handleSelect(genderId) {
    selectedGender = genderId
  }

  function handleSave() {
    dispatch('save', {
      gender: selectedGender
    })
    handleClose()
  }

  function handleClose() {
    dispatch('close')
  }

  function handleClear() {
    selectedGender = null
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    on:click={handleClose}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    role="button"
    tabindex="-1"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-labelledby="gender-modal-title"
    >
      <!-- Close button -->
      <button
        on:click={handleClose}
        class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Close"
      >
        <Icon icon={X} height="1.5em" />
      </button>
      
      <!-- Header -->
      <div class="mb-6 text-center">
        <h2 id="gender-modal-title" class="text-xl font-bold text-gray-900 dark:text-gray-100">
          Select Gender
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {pokemonName}
        </p>
      </div>

      <!-- Gender Selection -->
      <div class="mb-6">
        <div class="space-y-3">
          {#each genderOptions as option}
            <button
              on:click={() => handleSelect(option.id)}
              class="w-full p-4 rounded-lg border-2 transition-all duration-200 {selectedGender === option.id
                ? `${option.borderColor} ${option.bgColor}`
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-3xl {option.color}">
                    {option.symbol}
                  </span>
                  <span class="font-medium text-gray-900 dark:text-gray-100">
                    {option.label}
                  </span>
                </div>
                {#if selectedGender === option.id}
                  <div class="w-5 h-5 rounded-full {option.bgColor} {option.borderColor} border-2 flex items-center justify-center">
                    <div class="w-2.5 h-2.5 rounded-full bg-current {option.color}"></div>
                  </div>
                {/if}
              </div>
            </button>
          {/each}
        </div>

        <!-- Clear selection -->
        {#if selectedGender !== null}
          <button
            on:click={handleClear}
            class="mt-3 w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
          >
            Clear selection
          </button>
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

