<script>
  import { Icon } from '$c/core'
  import { Download, Share } from '$icons'
  import { exportToShowdown, copyShowdownToClipboard } from '$lib/utils/showdown-export.js'
  import { createEventDispatcher } from 'svelte'

  export let team = []
  export let filename = null

  // Debug logging
  // $: console.log('🔍 [ShowdownExportButton] Component loaded:', {
  //   teamLength: team?.length || 0,
  //   team: team,
  //   filename: filename
  // })
  export let showCopyButton = false
  export let showDownloadButton = true
  export let variant = 'default' // 'default', 'compact', 'icon-only'
  export let size = 'sm' // 'sm', 'md', 'lg'

  const dispatch = createEventDispatcher()

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

  function handleExport() {
    exportToShowdown(team, filename);
    dispatch('export', { team, filename });
  }

  async function handleCopy() {
    const success = await copyShowdownToClipboard(team);
    dispatch('copy', { success, team });
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
