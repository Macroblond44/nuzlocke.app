<script>
  export const MODES = { build: 'build', compare: 'compare' }
  export let id = 0,
    mode = MODES.build
  export let boss

  import { onMount, getContext } from 'svelte'

  import { X } from '$icons'
  import { Tabs, Button, IconButton, Loader } from '$c/core'
  import { TeamBuildCard, CompareCard, Actions } from '$c/BossBattle'
  import {
    getGameStore,
    read,
    patch,
    readdata,
    readTeam,
    readTeams,
    readBox
  } from '$lib/store'

  import calcAdvice from '$utils/advice'
  import { toList, regionise, capitalise } from '$utils/string'
  import { locid } from '$utils/pokemon'
  import { nonnull } from '$utils/obj'
  import { getSetting } from '$lib/components/Settings/_data'
  import { parse, activeGame, savedGames } from '$lib/store'

  const { getPkmn } = getContext('game')
  const { close } = getContext('simple-modal')

  let tab = mode === MODES.build ? 0 : 1,
    tabs = ['Team', 'Compare']
  
  let recommendationMethod = 'basic' // 'basic' or 'advanced'
  let defaultRecommendationSetting = 0 // 0 = Basic, 1 = Advanced

  // Util Functions
  const makeTeam = (locs, result) =>
    locs.map(makeTeammate.bind({}, result)).filter((i) => i)

  const makeTeammate = (mons, location) =>
    mons.find((m) => locid(m.original) === location)

  const settab = (i) => () => (tab = i)
  const handlesubmit = (team) => () => {
    const teamLocs = team.map((o) => locid(o.original))
    const same =
      teamLocs.every((it, i) => ogTeam[i] === it) &&
      teamLocs.length === ogTeam.length

    const teamList = toList(team.map((t) => regionise(capitalise(t.name))))

    if (
      !same &&
      window.confirm(
        `This team is different to your active one, would you like to make ${teamList} your active team?`
      )
    ) {
      gameStore.update(patch({ __team: teamLocs.slice(0, 6) }))
    }

    const teamData = nonnull({
      id: boss.id,
      name: boss.name,
      group: boss.type,
      type: boss.speciality,
      team: team.map((i) => ({ sprite: i.alias, id: locid(i.original) }))
    })

    gameStore.update(
      patch({
        __teams: bossTeams.filter((t) => t.id !== boss.id).concat(teamData)
      })
    )

    close()
  }

  const resetTeam = () => (teamLocs = readTeam(rawData))
  const clearTeam = () => (teamLocs = [])
  const toggleMon = (e) => {
    const mon = e.detail
    if (teamLocs.includes(locid(mon))) {
      teamLocs = teamLocs.filter((i) => i !== locid(mon))
    } else {
      if (teamLocs.length === 6) return
      teamLocs = teamLocs.concat(locid(mon))
    }
  }

  // Data and setup functions
  let gameStore, rawData, boxData, teamLocs, ogTeam, bossTeams

  async function setup(cb) {
    const [, , id] = readdata()

    gameStore = getGameStore(id)
    gameStore.subscribe(
      read((data) => {
        rawData = data
        bossTeams = readTeams(data)

        boxData = readBox(data)
        ogTeam = teamLocs =
          bossTeams.find((i) => i.id === boss.id)?.team?.map((i) => i.id) ||
          readTeam(data) ||
          []

        cb(rawData, boxData, teamLocs)
      })
    )
  }

  async function fetchPkmnSet(mons, key = 'pokemon') {
    // Debug: Log what names we're looking up
    const names = mons.map((m) => m[key])
    console.log('fetchPkmnSet looking up:', key, names)
    
    return await Promise.all(
      mons.map((m) => getPkmn(m[key]).then((res) => {
        // Debug: Log what we got back
        if (m[key] && m[key].includes('alola')) {
          console.log('Got back for', m[key], ':', { alias: res?.alias, types: res?.types })
        }
        return { original: m, ...res }
      }))
    )
  }

  let loading = true
  let analysisResult
  
  // Load default recommendation method from settings
  savedGames.subscribe(parse(saves => {
    const { settings } = saves[$activeGame] || {}
    const settingValue = (settings || '011101000')[getSetting('recommendation-method')]
    defaultRecommendationSetting = parseInt(settingValue) || 0
    recommendationMethod = defaultRecommendationSetting === 1 ? 'advanced' : 'basic'
  }))

  let validationError = null

  onMount(async () => {
    setup(async (_, boxData) => {
      const boxMons = await fetchPkmnSet(boxData)
      const gymMons = await fetchPkmnSet(boss.pokemon, 'name')

      let advice
      try {
        if (recommendationMethod === 'advanced') {
          // Use advanced recommendations API
          advice = await getAdvancedRecommendations(boxMons, gymMons)
          validationError = null // Clear any previous errors
        } else {
          // Use basic recommendations
          advice = calcAdvice(boxMons, gymMons)
          validationError = null // Clear any previous errors
        }
      } catch (error) {
        // If it's a validation error, store it and fallback to basic
        if (error.message && error.message.includes('Cannot use advanced recommendations')) {
          validationError = error.message
          console.warn('Validation failed, using basic recommendations:', error.message)
          advice = calcAdvice(boxMons, gymMons)
          // Also switch back to basic mode
          recommendationMethod = 'basic'
        } else {
          throw error // Re-throw other errors
        }
      }
      
      analysisResult = {
        ...advice,
        box: boxMons,
        gym: gymMons,
        mons: boxMons.concat(gymMons)
      }

      loading = false
    })
  })

  async function getAdvancedRecommendations(boxMons, gymMons) {
    try {
      // Validate that Pokémon have required data for advanced calculations
      const missingData = []
      
      for (const pokemon of boxMons) {
        const hasAbility = pokemon.original?.ability
        const hasMoves = (pokemon.original?.moves || []).length > 0
        
        if (!hasAbility && !hasMoves) {
          missingData.push({
            name: pokemon.name || pokemon.alias,
            missing: 'ability and moves'
          })
        } else if (!hasAbility) {
          missingData.push({
            name: pokemon.name || pokemon.alias,
            missing: 'ability'
          })
        } else if (!hasMoves) {
          missingData.push({
            name: pokemon.name || pokemon.alias,
            missing: 'moves'
          })
        }
      }
      
      // If any Pokémon are missing data, throw an error with details
      if (missingData.length > 0) {
        const errorMsg = missingData.map(p => `${p.name} (missing ${p.missing})`).join(', ')
        throw new Error(`Cannot use advanced recommendations. The following Pokémon need to be configured: ${errorMsg}. Please click on the Status or Nature field to open the configuration modal and add missing data.`)
      }
      
      // Prepare data for the advanced recommendations API
      const userPokemon = boxMons.map(pokemon => ({
        name: pokemon.alias || pokemon.name,
        level: pokemon.original?.level || 50,
        ability: pokemon.original?.ability || pokemon.abilities?.[0]?.name || 'unknown',
        nature: pokemon.original?.nature || 'Hardy',
        moves: (pokemon.original?.moves || pokemon.moves || []).map(m => typeof m === 'string' ? m : (m.name || m)),
        item: pokemon.original?.held?.name || pokemon.original?.held || 'none',
        evs: pokemon.original?.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        ivs: pokemon.original?.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
      }))

      const rivalPokemon = gymMons.map(pokemon => ({
        name: pokemon.alias || pokemon.name,
        level: pokemon.original?.level || pokemon.level || 50,
        ability: pokemon.original?.ability || pokemon.ability || pokemon.abilities?.[0]?.name || 'unknown',
        nature: pokemon.original?.nature || pokemon.nature || 'Hardy',
        moves: (pokemon.original?.moves || pokemon.moves || []).map(m => typeof m === 'string' ? m : (m.name || m)),
        item: pokemon.original?.held?.name || pokemon.original?.held || pokemon.held?.name || pokemon.held || 'none',
        stats: pokemon.stats || pokemon.baseStats || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, // Base stats from static league file
        evs: pokemon.original?.evs || pokemon.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        ivs: pokemon.original?.ivs || pokemon.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
      }))

      // Parse savedGames to get the game object
      let currentGame = null;
      savedGames.subscribe(
        parse((games) => {
          currentGame = games[$activeGame];
        })
      )();
      
      const gameId = currentGame?.game || 'unknown';
      console.log('[ProgressModal] Active game ID:', $activeGame);
      console.log('[ProgressModal] Current game object:', currentGame);
      console.log('[ProgressModal] Sending game ID:', gameId);
      
      const response = await fetch('/api/recommendations/advanced.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userPokemon,
          rivalPokemon,
          game: gameId, // Pass the current game to select the right calculator
          gameKey: gameId, // Pass gameKey for Radical Red data
          gameMode: 'normal'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Transform advanced recommendations to match basic format
      const recommendations = data.recommendations.map(rec => {
        const userPkmn = boxMons.find(p => (p.alias || p.name) === rec.pokemon)
        return {
          name: rec.pokemon,
          alias: rec.pokemon,
          types: userPkmn?.types || [],
          score: rec.overallScore,
          matchups: rec.matchups || [],
          calculationDetails: rec, // Store full rec for debugging
          // Add basic format compatibility
          offAdv: rec.overallScore,
          defAdv: 0,
          offTypeAdv: rec.overallScore,
          defTypeAdv: 0,
          offStatAdv: 0,
          defStatAdv: 0,
          weakPct: 0,
          resistPct: 0,
          immunePct: 0
        }
      })

      // IMPORTANT: Even in advanced mode, we need to calculate basic data (weakness, dmg, moves)
      // because CompareCard and Info.svelte components require these fields
      const basicAdvice = calcAdvice(boxMons, gymMons)

      return {
        ...basicAdvice, // Include weakness, dmg, moves, calc
        summary: {
          ...basicAdvice.summary,
          recommendations // Override recommendations with advanced ones
        }
      }

    } catch (error) {
      console.error('Error fetching advanced recommendations:', error)
      
      // If it's a validation error, re-throw it to be handled by the UI
      if (error.message && error.message.includes('Cannot use advanced recommendations')) {
        throw error
      }
      
      // For other errors, fallback to basic recommendations
      console.warn('Falling back to basic recommendations due to error:', error.message)
      return calcAdvice(boxMons, gymMons)
    }
  }
</script>

{#if loading}
  <Loader />
{:else if !analysisResult.box.length}
  <div
    class="rounded-xl bg-white px-6 py-8 text-center text-lg shadow-lg dark:bg-gray-900 dark:text-gray-50"
  >
    <p class="mb-2">
      How do you expect to beat <b>{boss.name}</b> with no Pokémon?
    </p>
    <p class="mb-4">Go back out there and Catch 'em All!</p>

    <IconButton
      borderless
      rounded
      src={X}
      on:click={close}
      containerClassName="fixed top-4 right-4 z-[100]"
    />

    <Button solid rounded on:click={close}>Close</Button>
  </div>
{:else}
  {@const team = makeTeam(teamLocs, analysisResult.mons)}

  <IconButton
    borderless
    rounded
    src={X}
    on:click={close}
    containerClassName="fixed top-4 right-4 z-[100]"
  />

  <CompareCard
    on:select={toggleMon}
    {team}
    {id}
    class={tab === 1 ? '' : 'hidden'}
    box={analysisResult.box}
    gym={analysisResult.gym}
    advice={analysisResult}
  >
    <Tabs class="flex-1" slot="tabs" bind:active={tab} {tabs} />
    <Actions
      slot="actions"
      on:toggle={settab(0)}
      on:complete={handlesubmit(team)}
      class="justify-center rounded-b-lg bg-white px-6 pt-1 pb-2 dark:bg-gray-900 md:-mt-4"
      {...boss}
      {team}
    >
      <span slot="switch-text">Build team</span>
    </Actions>
  </CompareCard>

  <TeamBuildCard
    on:select={toggleMon}
    on:clear={clearTeam}
    on:reset={resetTeam}
    {team}
    {boss}
    class={tab === 0 ? '' : 'hidden'}
    box={analysisResult.box}
    gym={analysisResult.gym}
    summary={analysisResult.summary}
  >
    <Tabs slot="tabs" bind:active={tab} {tabs} />
    <Actions
      slot="actions"
      on:toggle={settab(1)}
      on:complete={handlesubmit(team)}
      {...boss}
      {team}
    >
      <span slot="switch-text">Compare team</span>
    </Actions>
  </TeamBuildCard>
{/if}
