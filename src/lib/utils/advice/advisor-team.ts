import { moveResistance } from './advisor-types'
import { weaknesses } from './types'

const debug = []

export default (box, boss) => {
  // Debug: Log boss team Pokemon names and types
  console.log('Boss team:', JSON.stringify(boss.map(p => ({ name: p.name, alias: p.alias, types: p.types })), null, 2))
  
  const bossMoves = boss
    .map((poke) => poke.original.moves)
    .flat()
    .filter((move) => move.damage_class !== 'status')

  const bossMoveTypes = bossMoves.map((move) => move.type)
  const bossMoveClass = bossMoves.map((move) => move.damage_class)

  const bossTeamDmgMods = boss
    .map((poke) => weaknesses(...poke.types))
    .map((weakMap) => Object.entries(weakMap))
    .flat()

  const calcAdvMap = (compf, mods) =>
    mods.reduce((acc, [type, mod]) => {
      if (!compf(mod)) return acc
      return {
        ...acc,
        [type]: (acc[type] ?? 0) + 1
      }
    }, {})

  const calcModPct = (compf, mods, types, debug) =>
    mods.reduce((acc, type) => {
      const damageMod = moveResistance(type, types)
      if (debug) console.log(type, damageMod)
      return acc + (compf(damageMod) ? 1 : 0)
    }, 0) / mods.length

  const bossTeamWeak = calcAdvMap((mod) => mod > 1, bossTeamDmgMods)
  const bossTeamWeak4x = calcAdvMap((mod) => mod > 2, bossTeamDmgMods)
  const bossTeamResist = calcAdvMap(
    (mod) => mod < 2 && mod !== 0,
    bossTeamDmgMods
  )
  const bossTeamImmunity = calcAdvMap((mod) => mod === 0, bossTeamDmgMods)

  const recommendedMons = box
    .map((mon) => {
      const defName = mon.alias
      const defTypes = mon.types
      const stats = mon?.original?.stats || mon.baseStats

      /**
       Map over each of the box pokemon types as STAB bonuses
       and calculate an "offensive" score based on usage of STAB moves
     */
      // Generate offensive breakdown
      const offensiveBreakdown: any[] = []
      const offAdvantageScore = defTypes.reduce((acc, myType) => {
        boss.forEach((bossMon) => {
          const bossTypes = bossMon.types
          const effectiveness = moveResistance(myType, bossTypes)
          let score = 0
          let label = ''

          if (effectiveness === 4) {
            score = 4
            label = '4x effective'
          } else if (effectiveness === 2) {
            score = 2
            label = '2x effective'
          } else if (effectiveness === 0.5) {
            score = -1
            label = '0.5x effective'
          } else if (effectiveness === 0.25) {
            score = -2
            label = '0.25x effective'
          } else if (effectiveness === 0) {
            score = -4
            label = 'immune'
          } else {
            score = 0
            label = '1x neutral'
          }

          offensiveBreakdown.push({
            attackType: myType,
            defenderName: bossMon.name || bossMon.alias,
            defenderTypes: bossTypes,
            effectiveness,
            score,
            label
          })
        })

        if (bossTeamWeak4x[myType]) return acc + bossTeamWeak4x[myType] * 4
        if (bossTeamWeak[myType]) return acc + bossTeamWeak[myType] * 2
        if (bossTeamResist[myType]) return acc - bossTeamResist[myType]
        if (bossTeamImmunity[myType]) return acc - bossTeamImmunity[myType] * 4
        return acc
      }, 0)

      /**
       Look over boss team moves and calculate a score based on the
       pokemons resistances to all those moves
    */

      if (debug.includes(defName)) console.log(defName)
      
      // Generate defensive breakdown
      const defensiveBreakdown: any[] = []
      const defAdvantageScore = bossMoves.reduce((acc, move) => {
        const type = move.type
        const damageMod = moveResistance(type, defTypes)
        if (debug.includes(defName)) console.log(type, defTypes, damageMod, acc)

        let score = 0
        let label = ''

        switch (damageMod) {
          case 0:
            score = 8
            label = 'immune'
            break
          case 0.25:
            score = 4
            label = '0.25x resistant'
            break
          case 0.5:
            score = 2
            label = '0.5x resistant'
            break
          case 2:
            score = -4
            label = '2x weak'
            break
          case 4:
            score = -8
            label = '4x weak'
            break
          default:
            score = 0
            label = '1x neutral'
        }

        defensiveBreakdown.push({
          moveType: type,
          moveName: move.name,
          effectiveness: damageMod,
          score,
          label
        })

        return acc + score
      }, 0)

      if (debug.includes(defName))
        console.log(defName, '---', offAdvantageScore, defAdvantageScore)

      /**
       Look over boss move damage classes and calculate pokemon score
       based on their defensive stat advantage
    */
      const defStatAdvantageScore = bossMoveClass.reduce((acc, dmgClass) => {
        if (dmgClass === 'physical') return acc + stats.def
        if (dmgClass === 'special') return acc + stats.spd
        return acc
      }, 0)

      /**
       Look over boss team stats and calculate an offesnsive sc
       based on their defensive stat advantage
    */
      const offStatAdvantageScore = boss.reduce((acc, mon) => {
        const defstats = mon?.original?.stats || mon.baseStats
        if (defstats.spd < stats.spa) return acc + stats.spa
        if (defstats.def < stats.spa) return acc + stats.atk
        return acc + Math.max(stats.spa, stats.atk)
      }, 0)

      return {
        name: defName,
        alias: mon.alias,
        types: defTypes,
        offTypeAdv: offAdvantageScore,
        defTypeAdv: defAdvantageScore,
        defStatAdv: defStatAdvantageScore,
        offStatAdv: offStatAdvantageScore,
        offAdv: offAdvantageScore * offStatAdvantageScore,
        defAdv: defAdvantageScore * defStatAdvantageScore,
        weakPct: calcModPct(
          (m) => m > 1,
          bossMoveTypes,
          defTypes,
          debug.includes(defName)
        ),
        resistPct: calcModPct(
          (m) => m < 1,
          bossMoveTypes,
          defTypes,
          debug.includes(defName)
        ),
        immunePct: calcModPct(
          (m) => m === 0,
          bossMoveTypes,
          defTypes,
          debug.includes(defName)
        ),
        // Add calculation details for the modal
        calculationDetails: {
          offensiveBreakdown,
          defensiveBreakdown
        }
      }
    })
    .map((i) => {
      if (debug.includes(i.name)) console.log(i)
      return i
    })
    // Filter disabled: show all Pokemon regardless of scores
    // Uncomment to re-enable filtering of Pokemon with negative scores or high weakness percentage:
    // .filter(
    //   (a) =>
    //     a.offAdv >= 0 && a.defAdv >= 0 && a.weakPct < 0.5 && a.resistPct >= 0
    // )
    .sort((a, b) => {
      return (
        b.offAdv - a.offAdv ||
        b.defAdv - a.defAdv ||
        b.immunePct - a.immunePct ||
        b.resistPct - a.resistPct ||
        a.weakPct - b.weakPct
      )
    })

  return {
    recommendations: recommendedMons.slice(0, 6),
    advice: {
      dmgclass:
        [...new Set(bossMoveClass)].length === 1 ? [bossMoveClass[0]] : null,
      weak: Object.entries(bossTeamWeak)
        .filter(([, val]) => val === boss.length)
        .map(([key]) => key),
      resist: Object.entries(bossTeamResist)
        .filter(([, val]) => val === boss.length)
        .map(([key]) => key),
      immune: Object.entries(bossTeamImmunity)
        .filter(([, val]) => val >= boss.length / 2)
        .map(([key]) => key)
    }
  }
}
