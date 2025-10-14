<script>
  import { Icon } from '$c/core'
  import { Download, Share, X } from '$icons'
  import { exportToShowdown, copyShowdownToClipboard } from '$lib/utils/showdown-export.js'
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'

  export let team = []
  export let filename = null
  export let showCopyButton = false
  export let showDownloadButton = true
  export let variant = 'default' // 'default', 'compact', 'icon-only'
  export let size = 'sm' // 'sm', 'md', 'lg'

  const dispatch = createEventDispatcher()

  // Modal state
  let showLevelModal = false
  let customLevel = 50
  let copyType = 'clipboard' // 'clipboard' or 'download'

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2', 
    lg: 'text-base px-4 py-3'
  }

  // Variant classes
  const variantClasses = {
    default: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800',
    compact: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
    'icon-only': 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
  }

  // Icon sizes
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  function openLevelModal(type) {
    copyType = type
    showLevelModal = true
  }

  function closeLevelModal() {
    showLevelModal = false
    customLevel = 50
  }

  async function confirmCopy() {
    if (copyType === 'clipboard') {
      const success = await copyShowdownToClipboard(team, customLevel)
      dispatch('copy', { success, team, level: customLevel })
    } else {
      exportToShowdown(team, filename, customLevel)
      dispatch('export', { team, filename, level: customLevel })
    }
    closeLevelModal()
  }

  function handleExport() {
    openLevelModal('download')
  }

  function handleCopy() {
    openLevelModal('clipboard')
  }
</script>

<div class="flex items-center gap-2">
  <!-- Export Button -->
  {#if showDownloadButton}
    <button 
      on:click={handleExport}
      class="flex items-center gap-2 rounded-lg transition-colors {sizeClasses[size]} {variantClasses[variant]}"
      title="Export team to Showdown format"
    >
      <Icon icon={Download} class={iconSizes[size]} />
      {#if variant !== 'icon-only'}
        <span>Export Team</span>
      {/if}
    </button>
  {/if}

  <!-- Copy Button (optional) -->
  {#if showCopyButton}
    <button 
      on:click={handleCopy}
      class="flex items-center gap-2 rounded-lg transition-colors {sizeClasses[size]} {variantClasses[variant]}"
      title="Copy team to clipboard"
    >
      <Icon icon={Share} class={iconSizes[size]} />
      {#if variant !== 'icon-only'}
        <span>Copy</span>
      {/if}
    </button>
  {/if}
</div>

<!-- Level Selection Modal -->
{#if showLevelModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    on:click={closeLevelModal}
    on:keydown={(e) => e.key === 'Escape' && closeLevelModal()}
    role="dialog"
    tabindex="-1"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="none"
    >
      <!-- Close button -->
      <button
        on:click={closeLevelModal}
        class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <Icon icon={X} height="1.5em" />
      </button>
      
      <!-- Header -->
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          Export Team Level
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          All Pokémon will be exported at this level
        </p>
      </div>

      <!-- Level Input -->
      <div class="mb-6">
        <label for="team-level-input" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Level (1-100)
        </label>
        <input
          id="team-level-input"
          type="number"
          min="1"
          max="100"
          bind:value={customLevel}
          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          on:keydown={(e) => e.key === 'Enter' && confirmCopy()}
        />
        
        <!-- Quick level buttons -->
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            on:click={() => customLevel = 50}
            class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Lvl 50
          </button>
          <button
            type="button"
            on:click={() => customLevel = 100}
            class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Lvl 100
          </button>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-x-3">
        <button
          on:click={closeLevelModal}
          class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          on:click={confirmCopy}
          class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {copyType === 'clipboard' ? 'Copy' : 'Export'}
        </button>
      </div>
    </div>
  </div>
{/if}
