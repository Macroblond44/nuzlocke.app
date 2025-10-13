<script>
  export let sprite,
    fallback,
    name,
    types,
    tera,
    level = '',
    moves,
    maxStat,
    held = '',
    ability = '',
    stats,
    nature = undefined,
    minimal = false,
    movesCols = 2,
    // New editable props
    editable = false,
    gameKey = '',
    onUpdate = null

  import { capitalise, regionise } from '$lib/utils/string'
  import { isEmpty } from '$lib/utils/obj'
  import deferStyles from '$lib/utils/defer-styles'

  import { PIcon, Icon, Tooltip } from '$c/core'

  import { Hand, Edit } from '$icons'

  import { color } from '$lib/data/colors.ts'
  import { Wrapper as SettingWrapper } from '$lib/components/Settings'

  import TypeBadge from '$lib/components/type-badge.svelte'
  import MoveCard from '$lib/components/move-card.svelte'
  import StatBlock from '$lib/components/stat-block.svelte'
  import AbilitySelector from './AbilitySelector.svelte'
  import MovesSelector from './MovesSelector.svelte'
  import NatureSelector from './NatureSelector.svelte'

  import { UNOWN } from '$utils/rewrites'
  import { Stars as Pattern } from '$utils/pattern'
  import { afterUpdate } from 'svelte'

  // State for editable modals
  let abilityModalOpen = false
  let movesModalOpen = false
  let natureModalOpen = false

  const canonname = name.replace(/-(Alola|Galar)/, '')

  // Load item CSS when held item is present
  afterUpdate(() => {
    if (held && held.sprite) {
      const timestamp = Date.now();
      deferStyles(`/assets/items.css?i=${held.sprite}&v=${timestamp}`)
    }
  })

  const anim = ['bob'][Math.floor(Math.random() * 1)]
  const animDur = Math.floor(Math.random() * 4) + 4
  const animDelay = Math.floor(Math.random() * 10) / 10

  // Functions for editable mode
  function openAbilitySelector() {
    if (editable) {
      abilityModalOpen = true
    }
  }

  function openMovesSelector() {
    if (editable) {
      movesModalOpen = true
    }
  }

  function openNatureSelector() {
    if (editable) {
      natureModalOpen = true
    }
  }

  function handleAbilityUpdate(event) {
    const { ability: newAbility } = event.detail
    if (onUpdate) {
      onUpdate({ ability: newAbility })
    }
  }

  function handleMovesUpdate(event) {
    const { moves: newMoves } = event.detail
    if (onUpdate) {
      onUpdate({ moves: newMoves })
    }
  }

  function handleNatureUpdate(event) {
    const { nature: newNature } = event.detail
    if (onUpdate) {
      onUpdate({ nature: newNature })
    }
  }
</script>

<SettingWrapper id="theme" let:setting={themeId}>
  {@const color1 = color(types[0], themeId)}
  {@const color2 = color(types[1] || types[0], themeId)}
  {@const pattern = Pattern(color2)}
  <div
    class="card relative flex flex-col rounded-lg border bg-white dark:border-gray-900 dark:bg-gray-900 dark:shadow-lg h-full {$$restProps.class ||
      ''}"
  >
    <div
      style={`--t-col: ${color1}; background-image: url("${pattern}");`}
      class:rounded-b-lg={minimal}
      class:minimal
      class="card__header relative z-0 flex justify-between rounded-t-lg pl-4 pt-4 pb-3"
    >
      <div class="pointer-events-none flex flex-row items-end gap-x-2">
        {#if level}
          <div class="pointer-events-auto flex flex-col items-center">
            <span class="-mb-2 text-xs">Level</span>
            <span class="text-3xl font-bold">{level}</span>
            {#if typeof level === 'string' && (level.startsWith('+') || level.startsWith('-'))}
              <Tooltip>
                Calculated as your party's Max Level {level}
              </Tooltip>
            {/if}
          </div>
        {/if}
        <span
          class="mb-0.25 relative z-40 pr-2 text-xl sm:bg-transparent dark:sm:bg-transparent"
        >
          <p
            class="pointer-events-auto relative z-40 -mb-1 h-4 w-auto text-xs sm:bg-transparent dark:sm:bg-transparent"
          >
            {#if ability}
              <span 
                class:cursor-help={!!ability.effect && !editable}
                class:cursor-pointer={editable}
                class:editable-zone={editable}
                on:click={openAbilitySelector}
                on:keydown={(e) => e.key === 'Enter' && openAbilitySelector()}
                role={editable ? 'button' : undefined}
                tabindex={editable ? 0 : undefined}
              >
                {#if ability.effect && !editable}
                  <Tooltip>{ability.effect}</Tooltip>
                {/if}

                {ability.name}
                {#if editable}
                  <Icon icon={Edit} class="inline ml-1 h-3 w-3 opacity-50" />
                {/if}
              </span>
            {/if}
          </p>

          {regionise(capitalise(name))}

          {#if nature && nature.id}
            <p
              class="pointer-events-auto relative z-40 -mt-1 h-3 w-auto text-xs italic text-gray-500 dark:text-gray-400 sm:bg-transparent dark:sm:bg-transparent"
            >
              <span 
                class:cursor-pointer={editable}
                class:editable-zone={editable}
                on:click={openNatureSelector}
                on:keydown={(e) => e.key === 'Enter' && openNatureSelector()}
                role={editable ? 'button' : undefined}
                tabindex={editable ? 0 : undefined}
              >
                {nature.label || capitalise(nature.id)} Nature
                {#if editable}
                  <Icon icon={Edit} class="inline ml-1 h-3 w-3 opacity-50" />
                {/if}
              </span>
            </p>
          {/if}

          {#if held}
            <div
              class="pointer-events-auto absolute right-0 -bottom-0.5 z-20 mb-1 flex translate-x-full cursor-help flex-col items-center p-1"
            >
              <Tooltip>
                {held.name}: {held.effect?.replace(/^Held: +/g, '')}
              </Tooltip>
              <span>
                <PIcon type="item" name={held.sprite} />
              </span>
              <Icon
                inline={true}
                icon={Hand}
                class="-mt-3.5 fill-current dark:text-white"
              />
            </div>
          {/if}
        </span>
      </div>

      <div
        class="absolute -right-8 h-0 origin-bottom-right"
        class:scale-75={minimal}
      >
        <slot name="img" />
        {#if sprite}
          <img
            width="96"
            height="96"
            style="--v-anim-dur: {animDur}s; --v-anim-delay: {animDelay}s"
            class="{anim} img__pkm pointer-events-none h-40 w-auto -translate-y-16"
            src={sprite}
            onerror="this.onerror=null;this.src='{fallback}'"
            alt={name}
          />
        {:else}
          <img
            width="96"
            height="96"
            src={UNOWN}
            style="--v-anim-dur: {animDur}s; --v-anim-delay: {animDelay}s"
            class="{anim} pointer-events-none h-40 w-auto -translate-y-16 -translate-x-6 scale-75"
            alt="Unknown sprite for {name}"
          />
        {/if}
      </div>

      <div
        class:gap-1={minimal}
        class:scale-75={minimal}
        class:origin-left={minimal}
        class="type-badges absolute top-0 flex -translate-y-1/2 -translate-x-1 transform gap-x-1"
      >
        {#each types as t}
          <TypeBadge type={t} />
        {/each}
        {#if tera}
          <TypeBadge tera type={tera} />
        {/if}

        <div class="badges cursor-help" class:bottom-0={minimal}>
          <slot name="badges" />
        </div>
      </div>
    </div>

    {#if !minimal}
      <div
        style="border-color: {color(types[0], themeId)}"
        class="relative z-10 flex flex-col-reverse rounded-b-lg border-t-2 bg-white dark:bg-gray-900 sm:items-center md:inline-flex md:flex-row"
      >
        {#if moves && moves.length}
          <div
            class="my-3 ml-4 grid flex-2 gap-x-4 gap-y-0 lg:gap-y-3 {editable ? 'cursor-pointer' : ''}"
            class:grid-cols-2={movesCols === 2}
            class:grid-cols-4={movesCols === 4}
            class:editable-zone={editable}
            on:click={editable ? openMovesSelector : undefined}
            on:keydown={(e) => editable && e.key === 'Enter' && openMovesSelector()}
            role={editable ? 'button' : undefined}
            tabindex={editable ? 0 : undefined}
          >
            {#each moves.filter((m) => !isEmpty(m)) as m}
              <MoveCard {...m} stab={types.includes(m.type)} />
            {/each}
          </div>
        {/if}

        {#if $$slots.stats}
          <slot name="stats" />
        {:else}
          <StatBlock
            class="mx-4 mt-4 w-auto flex-1 grow grid-cols-20 md:mt-3"
            col={color(types[0], themeId)}
            {nature}
            max={maxStat}
            {...stats}
          />
        {/if}
      </div>

      <slot name="footer" id={canonname} />
    {/if}
  </div>
</SettingWrapper>

<style lang="postcss">
  img {
    image-rendering: pixelated;
  }

  .badge-grid::before {
    content: '';
    width: calc(100% + 4px);
    height: calc(50% + 4px);
    left: -2px;
    @apply absolute top-1/2 -z-10 bg-gray-900;
  }

  .badge-grid > :global(*) {
    @apply w-6 scale-125;
  }
  .badge-grid > :global(*:first-child) {
    @apply ml-1;
  }
  .badge-grid > :global(*:last-child) {
    @apply !mr-1;
  }

  .badge-grid > :global(*:nth-child(2n)) {
    @apply -mx-2 translate-y-1;
  }
  .badge-grid > :global(*:nth-child(2n + 1)) {
    @apply -translate-y-1;
  }

  .card {
    box-shadow: rgba(0, 0, 0, 0.18) 0px 2px 4px;
  }

  .card__header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    border-radius: 8px 8px 0 0;
  }

  .card__header.minimal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    border-radius: 8px;
  }

  .card__header {
    z-index: 0;
    background-color: var(--t-col);
  }

  .card__header::before {
    z-index: -1;
    background: linear-gradient(130deg, white 40%, transparent);
  }

  :global(.dark) .card__header::before {
    background: linear-gradient(
      130deg,
      theme('colors.gray.900') 40%,
      transparent
    );
  }

  .img__pkm {
    min-width: 160px;
  }

  img {
    animation-delay: var(--v-anim-delay);
  }
  img.bob {
    -webkit-animation: bob var(--v-anim-dur) ease infinite;
    animation: bob var(--v-anim-dur) ease infinite;
  }

  @keyframes bob {
    0%,
    100% {
      transform: translate(var(--tw-translate-x), var(--tw-translate-y))
        scaleX(1) scaleY(1);
    }
    25%,
    75% {
      transform: translate(var(--tw-translate-x), var(--tw-translate-y))
        scaleX(1.02) scaleY(0.95);
    }
    50% {
      transform: translate(var(--tw-translate-x), var(--tw-translate-y))
        scaleX(0.95) scaleY(1.03);
    }
  }

  .badges {
    @apply ml-5 -mt-1 h-4 scale-150 md:ml-2 md:scale-110;
  }

  .editable-zone {
    @apply transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5;
  }

  :global(.box) .type-badges {
    @apply origin-left scale-[0.8];
  }

  .minimal .badges {
    @apply absolute -bottom-16 origin-left translate-y-2 scale-100 max-md:-left-2;
  }

  .badges > :global(*:nth-child(even) i) {
    @apply z-50 -mx-1 translate-y-1.5;
  }
  .badges > :global(*:nth-child(odd) i) {
    @apply z-10 -mx-1 -translate-y-1;
  }
</style>

<!-- Editable Modals -->
{#if editable}
  <AbilitySelector
    pokemonName={name}
    gameKey={gameKey}
    currentAbility={ability}
    open={abilityModalOpen}
    on:save={handleAbilityUpdate}
    on:close={() => abilityModalOpen = false}
  />

  <MovesSelector
    pokemonName={name}
    gameKey={gameKey}
    currentMoves={moves || []}
    open={movesModalOpen}
    on:save={handleMovesUpdate}
    on:close={() => movesModalOpen = false}
  />

  <NatureSelector
    pokemonName={name}
    currentNature={nature}
    open={natureModalOpen}
    on:save={handleNatureUpdate}
    on:close={() => natureModalOpen = false}
  />
{/if}
