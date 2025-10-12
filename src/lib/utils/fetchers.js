import { browser } from '$app/environment'
import { getGen } from '$store'

import { DATA } from '$utils/rewrites'
import { normalise } from '$utils/string'

const data = {}
export const fetchData = async () => {
  if (!browser) return

  const gen = await getGen()
  const uri = `${DATA}/pokemon/${gen}.json`

  if (data[gen]) return data[gen] // Return the raw data if it exists

  if (!data[uri]) {
    console.time(`data:${gen}`)
    data[uri] = fetch(uri) // "Cache" the promise rather than make a new fetch each time
      .then((res) => res.json())
      .then((data) => {
        console.timeLog(`data:${gen}`)
        let result = { idMap: {}, aliasMap: {}, nameMap: {} }
        for (const d of data) {
          result.idMap[d.num] = d
          result.aliasMap[normalise(d.alias)] = d
          result.nameMap[normalise(d.name.toLowerCase())] = d
        }
        console.timeEnd(`data:${gen}`)
        return result
      })
  }

  data[gen] = await data[uri]
  return data[gen]
}

const league = {}
export const fetchLeague = async (game, starter = 'fire') => {
  if (!browser) return

  const id = `${game}@${starter}`
  // Add cache-busting timestamp to force reload of league files
  const uri = `${DATA}/league/${game}.${starter}.json?v=${Date.now()}`

  // Temporarily disable in-memory cache to ensure fresh data
  // if (league[id]) return league[id]
  if (!league[uri]) league[uri] = fetch(uri).then((res) => res.json())

  console.time(`league:${id}`)
  league[id] = await league[uri]
  console.timeEnd(`league:${id}`)
  console.log(`[fetchLeague] Loaded ${id}, sample stats for first pokemon:`, league[id]?.['1']?.pokemon?.[0]?.stats || league[id]?.['2']?.pokemon?.[0]?.stats)
  return league[id]
}

const route = {}
export const fetchRoute = async (game) => {
  if (!browser) return

  const uri = `/api/route/${game}.json`
  if (route[game]) return route[game]
  if (!route[uri]) route[uri] = fetch(uri).then((res) => res.json())

  console.time(`route:${game}`)
  route[game] = await route[uri]
  console.timeEnd(`route:${game}`)
  return route[game]
}

const trainers = {}
export const fetchTrainers = async (game) => {
  if (!browser) return

  const uri = `/api/${game}/trainers.json`
  if (trainers[game]) return trainers[game]
  if (!trainers[uri]) trainers[uri] = fetch(uri).then((res) => res.json())

  console.time(`trainres:${game}`)
  trainers[game] = await trainers[uri]
  console.time(`trainres:${game}`)
  return trainers[game]
}
