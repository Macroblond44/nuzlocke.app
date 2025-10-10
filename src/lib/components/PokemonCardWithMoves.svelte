<script>
  import { onMount } from 'svelte'
  import PokemonCard from '$lib/components/pokemon-card.svelte'
  import { transformMoves } from '$lib/utils/move-transformer.js'

  // Forward all props to PokemonCard
  export let sprite
  export let fallback
  export let name
  export let types
  export let tera
  export let level = ''
  export let moves = [] // This will be the raw move names
  export let maxStat
  export let held = ''
  export let ability = ''
  export let stats
  export let nature = undefined
  export let minimal = false
  export let movesCols = 2

  let transformedMoves = []
  let loadingMoves = false

  // Transform moves when moves prop changes
  // Check if moves are already transformed (objects) or need transformation (strings)
  $: if (moves && moves.length > 0) {
    // If moves are already objects with 'name' and 'type', they're already transformed
    const alreadyTransformed = moves.every(move => 
      typeof move === 'object' && move !== null && 'name' in move && 'type' in move
    )
    
    if (alreadyTransformed) {
      transformedMoves = moves
    } else {
      transformMovesData()
    }
  } else {
    transformedMoves = []
  }

  async function transformMovesData() {
    loadingMoves = true
    try {
      transformedMoves = await transformMoves(moves)
    } catch (error) {
      console.error('Error transforming moves:', error)
      transformedMoves = []
    } finally {
      loadingMoves = false
    }
  }
</script>

<PokemonCard
  {sprite}
  {fallback}
  {name}
  {types}
  {tera}
  {level}
  moves={transformedMoves}
  {maxStat}
  {held}
  {ability}
  {stats}
  {nature}
  {minimal}
  {movesCols}
>
  <svelte:fragment slot="badges">
    <slot name="badges" />
  </svelte:fragment>
  <svelte:fragment slot="img">
    <slot name="img" />
  </svelte:fragment>
  <!-- Don't pass stats slot - let PokemonCard use its default StatBlock -->
  <svelte:fragment slot="footer">
    <slot name="footer" />
  </svelte:fragment>
</PokemonCard>
